import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Send,
  Volume2,
  AlertCircle,
  Trash2,
  ShieldCheck,
  Paperclip,
  User,
  AudioLines,
  Play,
  Square,
} from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import {
  buildAttachmentManifest,
  buildCompactCohortVoiceDirectory,
  findAttachmentPayload,
  stripPatientForAI,
} from '../utils/aiContext';
import { getPatientKey } from '../utils/statisticalCharts';
import { AIAssistantFace, type VoiceFaceState } from './AIAssistantFace';

interface LiveVoicePanelProps {
  patients: PatientCRF[];
  compact?: boolean;
}

type VoiceName = 'Zephyr' | 'Kore' | 'Puck' | 'Charon' | 'Fenrir';

const VOICE_OPTIONS: Array<{ value: VoiceName; label: string }> = [
  { value: 'Zephyr', label: 'Zephyr (Bright)' },
  { value: 'Kore', label: 'Kore (Firm)' },
  { value: 'Puck', label: 'Puck (Upbeat)' },
  { value: 'Charon', label: 'Charon (Informative)' },
  { value: 'Fenrir', label: 'Fenrir (Warm)' },
];

const QUICK_VOICE_PROMPTS = [
  'Compare SIDD vs SIRD complication patterns in this cohort.',
  'Read Blue Index DHS and Known Severity for Maheshbhai Desai.',
  'List participants with pending 2nd HbA1c or FibroScan.',
];

const BRIDGE_BARS = [0.4, 0.68, 0.9, 0.58, 1, 0.65, 0.86, 0.52, 0.38];
const ASKER_BARS = [0.45, 0.8, 1, 0.75, 0.5];

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function measureAnalyserLevel(
  analyser: AnalyserNode | null,
  scratch: Uint8Array<ArrayBuffer>
): number {
  if (!analyser) return 0;
  analyser.getByteTimeDomainData(scratch);
  let sumSq = 0;
  for (let i = 0; i < scratch.length; i++) {
    const centered = (scratch[i] - 128) / 128;
    sumSq += centered * centered;
  }
  const rms = Math.sqrt(sumSq / scratch.length);
  return Math.min(1, rms * 3.8);
}

export const LiveVoicePanel: React.FC<LiveVoicePanelProps> = ({ patients, compact = false }) => {
  const [voiceActive, setVoiceActive] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [muted, setMuted] = useState(false);
  const [modelSpeaking, setModelSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState('Ready to connect');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceName, setVoiceName] = useState<VoiceName>('Zephyr');
  const [contextPid, setContextPid] = useState<string>('cohort');
  const [accessGranted, setAccessGranted] = useState<boolean>(true);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const [liveTextInput, setLiveTextInput] = useState('');
  const [transcripts, setTranscripts] = useState<
    Array<{ role: 'user' | 'assistant'; text: string }>
  >([]);

  // Real-time audio energy meters (0..1) + interactive preview
  const [micLevel, setMicLevel] = useState(0);
  const [aiLevel, setAiLevel] = useState(0);
  const [previewStage, setPreviewStage] = useState<'off' | 'asker' | 'ai'>('off');

  const wsRef = useRef<WebSocket | null>(null);
  const captureCtxRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const captureAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const mutedRef = useRef(false);
  const patientsRef = useRef<PatientCRF[]>(patients);
  const accessGrantedRef = useRef(accessGranted);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const attachmentManifest = useMemo(() => buildAttachmentManifest(patients), [patients]);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    patientsRef.current = patients;
  }, [patients]);

  useEffect(() => {
    accessGrantedRef.current = accessGranted;
  }, [accessGranted]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Real Web Audio RMS meter loop when connected
  useEffect(() => {
    if (!voiceActive) {
      setMicLevel(0);
      setAiLevel(0);
      return;
    }

    const micBuf = new Uint8Array(new ArrayBuffer(256));
    const aiBuf = new Uint8Array(new ArrayBuffer(256));
    const timer = window.setInterval(() => {
      const nextMic = mutedRef.current
        ? 0
        : measureAnalyserLevel(captureAnalyserRef.current, micBuf);
      const nextAi = measureAnalyserLevel(playbackAnalyserRef.current, aiBuf);
      setMicLevel((prev) => prev * 0.45 + nextMic * 0.55);
      setAiLevel((prev) => prev * 0.4 + nextAi * 0.6);
    }, 65);

    return () => window.clearInterval(timer);
  }, [voiceActive]);

  // Interactive preview cycle when user toggles "Preview AI Talking" before live call
  useEffect(() => {
    if (voiceActive || previewStage === 'off') return;
    const cycleTimer = window.setInterval(() => {
      setPreviewStage((prev) => (prev === 'ai' ? 'asker' : 'ai'));
    }, 2800);
    return () => window.clearInterval(cycleTimer);
  }, [voiceActive, previewStage]);

  const clearPlaybackQueue = () => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore stopped nodes
      }
    }
    activeSourcesRef.current.clear();
    if (playbackCtxRef.current) {
      nextStartTimeRef.current = playbackCtxRef.current.currentTime;
    } else {
      nextStartTimeRef.current = 0;
    }
    setModelSpeaking(false);
  };

  const stopVoiceSession = () => {
    clearPlaybackQueue();
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current.onaudioprocess = null;
      processorRef.current = null;
    }
    captureAnalyserRef.current = null;
    playbackAnalyserRef.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (captureCtxRef.current) {
      captureCtxRef.current.close().catch(() => {});
      captureCtxRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close().catch(() => {});
      playbackCtxRef.current = null;
    }
    setVoiceActive(false);
    setConnecting(false);
    setMuted(false);
    setMicLevel(0);
    setAiLevel(0);
    setVoiceStatus('Disconnected');
  };

  useEffect(() => {
    return () => stopVoiceSession();
  }, []);

  const playPcmChunk = (base64Pcm: string) => {
    const ctx = playbackCtxRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const raw = base64ToUint8Array(base64Pcm);
    const int16 = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2));
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (playbackAnalyserRef.current) {
      source.connect(playbackAnalyserRef.current);
    } else {
      source.connect(ctx.destination);
    }

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setModelSpeaking(false);
      }
    };
    activeSourcesRef.current.add(source);
    setModelSpeaking(true);
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
  };

  const buildContextSummary = (pid: string): string => {
    if (!accessGrantedRef.current) {
      return 'Patient data access is currently restricted by the investigator. Answer only general T2DM protocol questions without citing individual patient records.';
    }
    const currentPatients = patientsRef.current;
    const directory = buildCompactCohortVoiceDirectory(currentPatients);
    if (pid === 'cohort') {
      return directory;
    }
    const patient = currentPatients.find(
      (p, idx) => getPatientKey(p, idx) === pid || (Boolean(p.participantId) && p.participantId === pid)
    );
    if (!patient) return directory;
    const stripped = stripPatientForAI(patient);
    return `${directory}\n\nPRIMARY FOCUS PATIENT (${patient.uhid ? `UHID ${patient.uhid} — ` : ''}${patient.patientName}):\n${JSON.stringify(
      stripped
    )}`;
  };

  const syncRecordsToSocket = (ws: WebSocket | null) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const granted = accessGrantedRef.current;
    ws.send(
      JSON.stringify({
        accessGranted: granted,
        syncRecords: granted ? patientsRef.current.map(stripPatientForAI) : [],
      })
    );
  };

  useEffect(() => {
    if (voiceActive && wsRef.current?.readyState === WebSocket.OPEN) {
      syncRecordsToSocket(wsRef.current);
      const ctxText = buildContextSummary(contextPid);
      if (ctxText) {
        wsRef.current.send(JSON.stringify({ context: ctxText }));
      }
    }
  }, [patients, accessGranted]);

  const appendTranscript = (role: 'user' | 'assistant', chunk: string) => {
    const clean = chunk.trim();
    if (!clean) return;
    setTranscripts((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { role, text: `${last.text} ${clean}` }];
      }
      return [...prev, { role, text: clean }];
    });
  };

  const startVoiceSession = async () => {
    setPreviewStage('off');
    setVoiceError(null);
    setConnecting(true);
    setVoiceStatus('Requesting microphone...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const captureCtx = new AudioContext({ sampleRate: 16000 });
      captureCtxRef.current = captureCtx;
      const capAnalyser = captureCtx.createAnalyser();
      capAnalyser.fftSize = 256;
      captureAnalyserRef.current = capAnalyser;

      const playbackCtx = new AudioContext({ sampleRate: 24000 });
      playbackCtxRef.current = playbackCtx;
      const playAnalyser = playbackCtx.createAnalyser();
      playAnalyser.fftSize = 256;
      playAnalyser.connect(playbackCtx.destination);
      playbackAnalyserRef.current = playAnalyser;
      nextStartTimeRef.current = playbackCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(
        `${protocol}//${window.location.host}/live?voice=${encodeURIComponent(voiceName)}`
      );
      wsRef.current = ws;
      setVoiceStatus('Connecting Live API...');

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string) as {
          ready?: boolean;
          audio?: string;
          inputTranscript?: string;
          outputTranscript?: string;
          interrupted?: boolean;
          turnComplete?: boolean;
          toolEvent?: string;
          fetchAttachment?: {
            requestId: string;
            patientQuery: string;
            fileName?: string;
          };
          error?: string;
          closed?: boolean;
        };
        if (msg.ready) {
          setConnecting(false);
          setVoiceActive(true);
          setToolActivity(null);
          setVoiceStatus(`Live (${voiceName})`);
          syncRecordsToSocket(ws);
          const ctxText = buildContextSummary(contextPid);
          if (ctxText && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ context: ctxText }));
          }
        }
        if (msg.fetchAttachment?.requestId) {
          const { requestId, patientQuery, fileName } = msg.fetchAttachment;
          const attachment = accessGrantedRef.current
            ? findAttachmentPayload(patientsRef.current, patientQuery, undefined, fileName)
            : null;
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                attachmentData: {
                  requestId,
                  found: Boolean(attachment),
                  attachment: attachment || undefined,
                },
              })
            );
          }
        }
        if (msg.toolEvent) {
          setToolActivity(msg.toolEvent);
        }
        if (msg.error) {
          setVoiceError(msg.error);
          stopVoiceSession();
        }
        if (msg.interrupted) {
          clearPlaybackQueue();
        }
        if (msg.turnComplete) {
          setToolActivity(null);
          if (activeSourcesRef.current.size === 0) {
            setModelSpeaking(false);
          }
        }
        if (msg.audio) {
          playPcmChunk(msg.audio);
        }
        if (msg.inputTranscript) {
          appendTranscript('user', msg.inputTranscript);
        }
        if (msg.outputTranscript) {
          appendTranscript('assistant', msg.outputTranscript);
        }
        if (msg.closed) {
          stopVoiceSession();
        }
      };

      ws.onerror = () => {
        setVoiceError('WebSocket connection error with Live API bridge.');
        stopVoiceSession();
      };

      ws.onclose = () => {
        setVoiceActive(false);
        setConnecting(false);
        setVoiceStatus('Disconnected');
      };

      const source = captureCtx.createMediaStreamSource(stream);
      source.connect(capAnalyser);
      const processor = captureCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN || mutedRef.current) return;
        const inputData = ev.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(JSON.stringify({ audio: uint8ToBase64(new Uint8Array(pcm16.buffer)) }));
      };
      source.connect(processor);
      processor.connect(captureCtx.destination);
    } catch (err: unknown) {
      setVoiceError(
        err instanceof Error ? err.message : 'Microphone permission is required for live voice.'
      );
      stopVoiceSession();
    }
  };

  const handleContextChange = (nextPid: string) => {
    setContextPid(nextPid);
    if (voiceActive && wsRef.current?.readyState === WebSocket.OPEN) {
      const ctxText = buildContextSummary(nextPid);
      if (ctxText) {
        wsRef.current.send(JSON.stringify({ context: ctxText }));
      }
    }
  };

  const sendLiveTextPrompt = (overrideText?: string) => {
    const text = (overrideText ?? liveTextInput).trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    setTranscripts((prev) => [...prev, { role: 'user', text }]);
    wsRef.current.send(JSON.stringify({ text }));
    if (!overrideText) setLiveTextInput('');
  };

  // Derive visual stage state (Live session takes precedence over offline preview)
  const isAiTalking = voiceActive ? modelSpeaking : previewStage === 'ai';
  const isAskerTalking = voiceActive
    ? !muted && !modelSpeaking && micLevel > 0.06
    : previewStage === 'asker';
  const isListeningStandby = voiceActive && !muted && !modelSpeaking && !isAskerTalking;

  const effectiveAiEnergy = voiceActive
    ? modelSpeaking
      ? Math.max(0.45, aiLevel)
      : 0.12
    : previewStage === 'ai'
    ? 0.85
    : 0.14;

  const effectiveAskerEnergy = voiceActive
    ? muted
      ? 0
      : Math.max(isAskerTalking ? 0.45 : 0.14, micLevel)
    : previewStage === 'asker'
    ? 0.82
    : 0.14;

  const stageStatusText = connecting
    ? 'Connecting Live Voice Bridge...'
    : isAiTalking
    ? `${voiceName} AI is speaking to you`
    : isAskerTalking
    ? 'Investigator speaking — AI listening'
    : isListeningStandby
    ? 'Listening — speak naturally anytime'
    : muted && voiceActive
    ? 'Microphone muted'
    : 'Interactive Voice Stage Ready';

  const voiceFaceState: VoiceFaceState = connecting
    ? 'connecting'
    : isAiTalking
    ? 'ai-talking'
    : isAskerTalking
    ? 'asker-talking'
    : voiceActive
    ? 'listening'
    : 'idle';

  return (
    <div className={compact ? 'space-y-3' : 'bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:p-5 space-y-3.5'}>
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#EEF3F0] pb-3">
        {compact ? (
          <div className="text-xs text-[#4B6157]">
            Voice:{' '}
            <span className="font-mono font-semibold text-[#053B2B]">{voiceStatus}</span>
          </div>
        ) : (
          <div>
            <h3 className="font-display text-sm font-bold text-[#14201B]">
              Real-Time Voice Assistant
            </h3>
            <p className="text-[11px] text-[#4B6157] mt-0.5">
              Speak naturally about phenotypes, Blue Index, DDS-17, or CRFs ·{' '}
              <span className="font-mono font-semibold text-[#053B2B]">{voiceStatus}</span>
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {!voiceActive && !connecting && (
            <button
              type="button"
              onClick={() =>
                setPreviewStage((prev) => (prev === 'off' ? 'ai' : 'off'))
              }
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                previewStage !== 'off'
                  ? 'border-[#047857] bg-[#F2FBF6] text-[#053B2B]'
                  : 'border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#14201B]'
              }`}
            >
              {previewStage !== 'off' ? (
                <>
                  <Square className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Stop Preview</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Preview AI Talking</span>
                </>
              )}
            </button>
          )}

          {voiceActive && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                muted
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-[#DDE8E2] bg-[#F6F9F7] text-[#14201B]'
              }`}
            >
              {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#047857]" />}
              <span>{muted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>
          )}

          {voiceActive ? (
            <button
              type="button"
              onClick={stopVoiceSession}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Conversation</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={startVoiceSession}
              disabled={connecting}
              className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <PhoneCall className="w-4 h-4" />
              <span>{connecting ? 'Connecting...' : 'Start Voice Conversation'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Two-Way Conversational AI Stage (Asker <-> AI Assistant) */}
      <div
        data-voice-state={
          connecting
            ? 'connecting'
            : isAiTalking
            ? 'ai-talking'
            : isAskerTalking
            ? 'asker-talking'
            : voiceActive
            ? 'listening'
            : 'idle'
        }
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#03241A] via-[#053628] to-[#021A12] text-white px-4 py-3.5 border border-emerald-900/70 shadow-[inset_0_1px_0_rgba(167,243,208,0.08)]"
      >
        {/* Top Stage Caption */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-100">
            <AudioLines className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{stageStatusText}</span>
          </div>
          <span className="font-mono text-[10px] text-emerald-200/80">
            {previewStage !== 'off' && !voiceActive
              ? `Demo · ${voiceName}`
              : `Voice: ${voiceName}`}
          </span>
        </div>

        {/* 3-Zone Compact Dialogue Stage */}
        <div className="grid grid-cols-3 items-center gap-2 sm:gap-3">
          {/* Left Side: Investigator (Asker) */}
          <div className="flex flex-col items-center text-center gap-1.5">
            <div className="relative flex items-center justify-center w-16 h-16">
              {isAskerTalking && (
                <>
                  <span
                    aria-hidden="true"
                    className="voice-orb-ripple-1 absolute inset-0 rounded-full border border-emerald-300/60"
                  />
                  <span
                    aria-hidden="true"
                    className="voice-orb-ripple-2 absolute inset-0 rounded-full border border-teal-200/40"
                  />
                </>
              )}
              <div
                className={`relative z-10 w-14 h-14 rounded-full border flex flex-col items-center justify-center transition-all duration-200 ${
                  isAskerTalking
                    ? 'bg-emerald-500/25 border-emerald-300 scale-105 shadow-lg shadow-emerald-950/60'
                    : muted && voiceActive
                    ? 'bg-amber-500/15 border-amber-300/60'
                    : 'bg-white/[0.06] border-white/20'
                }`}
              >
                {muted && voiceActive ? (
                  <MicOff className="w-4 h-4 text-amber-200" />
                ) : (
                  <User className="w-4 h-4 text-emerald-100" />
                )}
                <div className="flex items-center gap-0.5 h-2.5 mt-1" aria-hidden="true">
                  {ASKER_BARS.map((weight, idx) => (
                    <span
                      key={idx}
                      style={{
                        height: `${Math.max(2, Math.round(weight * effectiveAskerEnergy * 10))}px`,
                        animationDelay: `${idx * 95}ms`,
                      }}
                      className={`w-0.5 rounded-full bg-emerald-200 transition-transform duration-100 ${
                        isAskerTalking ? 'voice-eq-speak' : isListeningStandby ? 'voice-eq-idle' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-white">Investigator</div>
              <div className="text-[10px] text-emerald-200/75">
                {muted && voiceActive
                  ? 'Muted'
                  : isAskerTalking
                  ? 'Speaking...'
                  : voiceActive
                  ? 'Mic active'
                  : 'Asker'}
              </div>
            </div>
          </div>

          {/* Center Acoustic Dialogue Bridge */}
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="relative w-full h-10 flex items-center justify-center">
              <div className="absolute inset-x-1 h-px bg-gradient-to-r from-emerald-400/10 via-emerald-300/35 to-emerald-400/10" />

              {(isAiTalking || isAskerTalking || connecting) && (
                <div
                  aria-hidden="true"
                  className={`absolute w-10 h-1 rounded-full bg-gradient-to-r from-emerald-300/0 via-emerald-200 to-emerald-300/0 ${
                    isAiTalking
                      ? 'voice-bridge-left'
                      : 'voice-bridge-right'
                  }`}
                />
              )}

              <div className="relative z-10 flex items-center justify-center gap-1 px-2.5 py-1 bg-[#042D21]/85 rounded-lg">
                {BRIDGE_BARS.map((w, idx) => {
                  const activeBoost = isAiTalking
                    ? effectiveAiEnergy
                    : isAskerTalking
                    ? effectiveAskerEnergy
                    : 0.24;
                  return (
                    <span
                      key={idx}
                      style={{
                        height: `${Math.max(3, Math.round(w * activeBoost * 20))}px`,
                        animationDelay: `${idx * 75}ms`,
                      }}
                      className={`w-0.5 rounded-full transition-opacity duration-200 ${
                        isAiTalking
                          ? 'bg-emerald-300 voice-eq-speak'
                          : isAskerTalking
                          ? 'bg-teal-200 voice-eq-speak'
                          : 'bg-emerald-400/45 voice-eq-idle'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            <div className="text-[9px] font-mono uppercase tracking-wider text-emerald-200/80 whitespace-nowrap">
              {isAiTalking
                ? '← AI Responding'
                : isAskerTalking
                ? 'Asking AI →'
                : connecting
                ? 'Handshaking...'
                : 'Audio Link'}
            </div>
          </div>

          {/* Right Side: Compact OLED AI Assistant Visor */}
          <AIAssistantFace
            state={voiceFaceState}
            speechLevel={effectiveAiEnergy}
            personaName={voiceName}
            size={compact ? 88 : 104}
          />
        </div>

        {previewStage !== 'off' && !voiceActive && (
          <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] text-emerald-100/85 truncate">
            {previewStage === 'ai'
              ? `${voiceName} AI: "Comparing SIRD vs SIDD HOMA-IR (CP), Blue Index DHS, and pending HbA1c schedules..."`
              : 'Investigator: "Which participants still need their 2nd HbA1c or FibroScan follow-up?"'}
          </div>
        )}
      </div>

      {/* Permission & Scope Banner */}
      <div className="px-3.5 py-2.5 rounded-xl border border-[#BFD5C9] bg-[#F2FBF6] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 text-xs text-[#053B2B]">
          <ShieldCheck className="w-4 h-4 text-[#047857] shrink-0" />
          <span>
            <strong>Data Access:</strong>{' '}
            {accessGranted
              ? `Permission granted for all ${patients.length} patient records & ${attachmentManifest.length} attached files`
              : 'Restricted (general protocol Q&A only)'}
          </span>
        </div>
        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#14201B] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={accessGranted}
            onChange={(e) => setAccessGranted(e.target.checked)}
            className="w-4 h-4 accent-[#047857] rounded"
          />
          <span>Grant full patient &amp; file access</span>
        </label>
      </div>

      {/* Voice & Patient Context Selectors */}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className="block text-[11px] font-medium text-[#4B6157] mb-1">
            Assistant Voice Persona
          </label>
          <select
            aria-label="Assistant voice persona"
            value={voiceName}
            disabled={voiceActive || connecting}
            onChange={(e) => setVoiceName(e.target.value as VoiceName)}
            className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs font-medium text-[#14201B] disabled:bg-[#F6F9F7]"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-[#4B6157] mb-1">
            Clinical Conversation Context
          </label>
          <select
            aria-label="Clinical conversation context"
            value={contextPid}
            onChange={(e) => handleContextChange(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs font-medium text-[#14201B]"
          >
            <option value="cohort">
              All Patient Records ({patients.length}) &amp; Attachments ({attachmentManifest.length})
            </option>
            {patients.map((p, idx) => {
              const pKey = getPatientKey(p, idx);
              return (
                <option key={pKey} value={pKey}>
                  {p.uhid || 'No UHID'} — {p.patientName || 'Unnamed'} ({p.clusterType || 'Unassigned'}
                  {p.attachments?.length ? ` · ${p.attachments.length} file${p.attachments.length > 1 ? 's' : ''}` : ''})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {voiceError && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2 msg-slide-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{voiceError}</span>
        </div>
      )}

      {toolActivity && (
        <div className="px-3.5 py-2 rounded-xl bg-[#FAFDFB] border border-[#DDE8E2] text-xs text-[#053B2B] flex items-center gap-2 msg-slide-in">
          <Paperclip className="w-3.5 h-3.5 text-[#047857] shrink-0" />
          <span>{toolActivity}</span>
        </div>
      )}

      {/* Live Audio Indicator Bar */}
      {voiceActive && (
        <div className="px-4 py-2.5 rounded-xl bg-[#F2FBF6] border border-[#BFD5C9] flex items-center justify-between text-xs msg-slide-in">
          <div className="flex items-center gap-2 text-[#053B2B] font-medium">
            {modelSpeaking ? (
              <>
                <Volume2 className="w-4 h-4 text-[#047857]" />
                <span>Assistant speaking (speak anytime to interrupt)...</span>
              </>
            ) : muted ? (
              <>
                <MicOff className="w-4 h-4 text-amber-700" />
                <span>Microphone muted</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 text-[#047857]" />
                <span>Listening — speak clearly into your microphone</span>
              </>
            )}
          </div>
          {transcripts.length > 0 && (
            <button
              type="button"
              onClick={() => setTranscripts([])}
              className="text-[11px] text-[#4B6157] hover:text-[#14201B] inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      )}

      {/* Transcript Stream */}
      <div className="min-h-[115px] max-h-44 overflow-y-auto p-3.5 rounded-xl bg-[#FAFDFB] border border-[#DDE8E2] space-y-2">
        {transcripts.length === 0 ? (
          <div className="text-xs text-[#6B8076] text-center py-8 space-y-1.5">
            <div>
              Click <strong>Start Voice Conversation</strong> to speak directly with the clinical AI assistant.
            </div>
            <div className="text-[11px]">
              Try asking: &ldquo;Summarize this patient&apos;s Blue Index DHS and Known Severity scores.&rdquo;
            </div>
          </div>
        ) : (
          transcripts.map((t, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl text-xs msg-slide-in ${
                t.role === 'user'
                  ? 'bg-[#EFF5F1] text-[#14201B] ml-8'
                  : 'bg-white border border-[#DDE8E2] text-[#053B2B] mr-8'
              }`}
            >
              <div className="font-semibold uppercase text-[10px] text-[#6B8076] mb-0.5">
                {t.role === 'user' ? 'Investigator' : `${voiceName} Assistant`}
              </div>
              <div className="leading-relaxed">{t.text}</div>
            </div>
          ))
        )}
        <div ref={transcriptEndRef} />
      </div>

      {/* Quick Prompts & Text Prompt Fallback While Connected */}
      {voiceActive && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_VOICE_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendLiveTextPrompt(q)}
                className="px-2.5 py-1 rounded-lg border border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1] text-[11px] text-[#053B2B] text-left"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={liveTextInput}
              onChange={(e) => setLiveTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendLiveTextPrompt()}
              placeholder="Or type a message into the live voice conversation..."
              aria-label="Live voice text prompt"
              className="flex-1 px-3.5 py-2 rounded-xl border border-[#DDE8E2] text-xs focus:outline-none focus:border-[#047857]"
            />
            <button
              type="button"
              onClick={() => sendLiveTextPrompt()}
              className="px-4 py-2 rounded-xl bg-[#053B2B] hover:bg-[#047857] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
