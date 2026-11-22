import React, { useMemo, useRef, useState } from 'react';
import {
  Sparkles,
  Send,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  ShieldCheck,
  Paperclip,
  FileText,
  Upload,
  UserCheck,
  UserPlus,
  ExternalLink,
  ArrowRight,
  Stethoscope,
  Activity,
  ClipboardList,
  Layers,
  HeartPulse,
  Microscope,
  Mic,
  MicOff,
  Pill,
} from 'lucide-react';
import type { AttachmentFile, ClusterType, PatientCRF } from '../types/clinical';
import {
  buildAttachmentManifest,
  collectPatientAttachments,
  parseDataUrl,
  stripPatientForAI,
  type ParsedAttachmentPayload,
} from '../utils/aiContext';
import { evaluateMissingDataAndStatus } from '../utils/clinicalMath';
import { getPatientKey } from '../utils/statisticalCharts';
import {
  applyExtractedReportToPatient,
  createDraftPatientFromReport,
  matchPatientFromReport,
  type ExtractedReportPayload,
  type PatientMatchResult,
  type ReportFieldChange,
} from '../utils/reportAutoSync';
import { parseJsonSafe } from '../utils/http';
import { LiveVoicePanel } from './LiveVoicePanel';
import { MarkdownClinicalReport } from './MarkdownClinicalReport';
import {
  BulkSpreadsheetSyncPanel,
  type BatchUpsertInputItem,
  type BatchUpsertResult,
} from './BulkSpreadsheetSyncPanel';

interface AIWorkspaceViewProps {
  patients: PatientCRF[];
  accessToken: string | null;
  activeUser?: { displayName?: string; email?: string; uid?: string } | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onUpdatePatientInline?: (patient: PatientCRF) => Promise<void> | void;
  onBatchUpsertPatients?: (items: BatchUpsertInputItem[]) => Promise<BatchUpsertResult>;
  onCreatePatientFromReport?: (draftCrf: PatientCRF) => void;
  onViewCRF?: (patient: PatientCRF) => void;
  onNavigateToData?: () => void;
}

interface ChatSpace {
  name: string;
  displayName?: string;
  spaceType?: string;
}

interface ChatMessage {
  name: string;
  text?: string;
  createTime?: string;
  sender?: { displayName?: string; type?: string };
}

interface WorkflowTemplate {
  id: string;
  title: string;
  category: string;
  scope: 'cohort' | 'patient';
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface AutoSyncRecord {
  fileName: string;
  attachment: AttachmentFile;
  extracted: ExtractedReportPayload;
  match: PatientMatchResult;
  appliedPatient: PatientCRF | null;
  appliedChanges: ReportFieldChange[];
  autoApplied: boolean;
  timestamp: string;
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'cluster-stratification',
    title: 'Cluster Complication Stratification',
    category: 'Phenotypes',
    scope: 'cohort',
    icon: Layers,
    prompt:
      'Compare SIDD, SIRD, CIRDD, and MARD microvascular severity (UACR, eGFR, KS microvascular tier) and FibroScan stiffness across this cohort. Highlight highest-risk clusters with exact UHID and patient names.',
  },
  {
    id: 'distress-triage',
    title: 'High-Risk & DDS-17 Triage',
    category: 'Triage',
    scope: 'cohort',
    icon: HeartPulse,
    prompt:
      'Identify patients with high DDS-17 diabetes distress (>= 3.0), red/orange status, or low Blue Index (DHS/KS ratio) who require urgent clinical outreach and regimen simplification.',
  },
  {
    id: 'glycemic-response',
    title: 'Glycemic & Regimen Response Audit',
    category: 'Therapeutics',
    scope: 'cohort',
    icon: Activity,
    prompt:
      'Analyze 1st vs 2nd HbA1c change across recorded medication regimens (Metformin, SGLT2i, GLP-1RA, SU, Insulin). Identify non-responders and summarize potential intensification options.',
  },
  {
    id: 'masld-fibroscan',
    title: 'MASLD / FibroScan Review',
    category: 'Hepatic',
    scope: 'cohort',
    icon: Microscope,
    prompt:
      'Evaluate hepatic steatosis (CAP dB/m, S0-S3) and fibrosis (LSM kPa, F0-F4) alongside AST/ALT, BMI, and HOMA-IR (CP) across the cohort. Flag F2-F4 or S3 patients.',
  },
  {
    id: 'pending-workup',
    title: 'Pending Workup & Follow-Up List',
    category: 'Operations',
    scope: 'cohort',
    icon: ClipboardList,
    prompt:
      'List all participants with pending 2nd HbA1c, missing C-Peptide/HOMA-IR, missing UACR, or pending FibroScan ordered by clinical urgency for the upcoming clinic schedule.',
  },
  {
    id: 'drug-utilization',
    title: 'Drug Utilisation Evaluation (DUE)',
    category: 'WHO & Clusters',
    scope: 'cohort',
    icon: Pill,
    prompt:
      'Perform a Drug Utilisation Evaluation (DUE) across SIDD, SIRD, CIRDD, and MARD: summarize antidiabetic classes (Biguanides, SU, SGLT2i, DPP-4i, TZD, GLP-1RA, Insulin), monotherapy vs dual/triple+ complexity, polypharmacy, FDC use, cardiorenal co-prescriptions (statins, antihypertensives), and HbA1c control per regimen tier.',
  },
  {
    id: 'protocol-e4-audit',
    title: 'Protocol E4 Objectives (1–12) Synthesis',
    category: 'Study Report',
    scope: 'cohort',
    icon: ClipboardList,
    prompt:
      'Generate a comprehensive interim study summary aligned with Protocol SDPC-IEC/DHR2026/05 Secondary Objectives 1–12: predefined age-group distribution (18–25 through 66–75 yrs), cluster glycemic/lipid/C-peptide differences, microvascular & macrovascular burden, Blue Index DHS, DDS-17 distress domains, and FibroScan LSM/CAP associations.',
  },
  {
    id: 'patient-soap',
    title: 'Individual SOAP & Action Plan',
    category: 'Patient Brief',
    scope: 'patient',
    icon: Stethoscope,
    prompt:
      'Generate a structured clinical SOAP note for the selected patient covering phenotypic cluster classification, C-Peptide HOMA-B/HOMA-IR, Blue Index (DHS vs KS), FibroScan, DDS-17 distress, attached reports, and next-visit lab priorities.',
  },
];

const CLUSTERS: ClusterType[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];

export const AIWorkspaceView: React.FC<AIWorkspaceViewProps> = ({
  patients,
  accessToken,
  activeUser,
  onRequestGoogleSignIn,
  onUpdatePatientInline,
  onBatchUpsertPatients,
  onCreatePatientFromReport,
  onViewCRF,
  onNavigateToData,
}) => {
  const [subTab, setSubTab] = useState<'analysis' | 'voice' | 'chat' | 'bulk-sync'>('analysis');

  // Deep Clinical Analysis state
  const [analysisMode, setAnalysisMode] = useState<'cohort' | 'patient'>('cohort');
  const [selectedPid, setSelectedPid] = useState(
    patients[0] ? getPatientKey(patients[0], 0) : ''
  );
  const [accessGranted, setAccessGranted] = useState<boolean>(true);
  const [extraFiles, setExtraFiles] = useState<ParsedAttachmentPayload[]>([]);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState(WORKFLOW_TEMPLATES[0].prompt);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(WORKFLOW_TEMPLATES[0].id);
  const [analysisOutput, setAnalysisOutput] = useState('');
  const [outputMeta, setOutputMeta] = useState<{ title: string; subtitle: string }>({
    title: 'Clinical Analysis Brief',
    subtitle: '',
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Smart Report Auto-Sync state
  const autoSyncInputRef = useRef<HTMLInputElement>(null);
  const [autoApplyEnabled, setAutoApplyEnabled] = useState<boolean>(true);
  const [draggingReport, setDraggingReport] = useState<boolean>(false);
  const [ingestingReport, setIngestingReport] = useState<boolean>(false);
  const [ingestError, setIngestError] = useState<string | null>(null);
  const [lastSyncRecord, setLastSyncRecord] = useState<AutoSyncRecord | null>(null);
  const [syncHistoryCount, setSyncHistoryCount] = useState<number>(0);
  const [manualAssignPid, setManualAssignPid] = useState<string>(
    patients[0] ? getPatientKey(patients[0], 0) : ''
  );

  // Google Chat state
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState('');
  const [confirmChatSend, setConfirmChatSend] = useState(false);
  const [sendingChat, setSendingChat] = useState(false);
  const [chatVoiceOpen, setChatVoiceOpen] = useState(true);
  const [dictatingChat, setDictatingChat] = useState(false);
  const recognitionRef = useRef<{ stop?: () => void } | null>(null);

  const selectedPatient = useMemo(
    () =>
      patients.find((p, idx) => getPatientKey(p, idx) === selectedPid) || patients[0] || null,
    [patients, selectedPid]
  );

  const attachmentManifest = useMemo(() => buildAttachmentManifest(patients), [patients]);
  const activeScopeAttachments = useMemo(() => {
    if (!accessGranted) return extraFiles;
    const keyFilter =
      analysisMode === 'patient' && selectedPatient ? getPatientKey(selectedPatient) : undefined;
    return [...collectPatientAttachments(patients, keyFilter), ...extraFiles];
  }, [accessGranted, analysisMode, selectedPatient, patients, extraFiles]);

  const cohortStats = useMemo(() => {
    const clusterCounts: Record<ClusterType, number> = {
      SIDD: 0,
      SIRD: 0,
      CIRDD: 0,
      MARD: 0,
    };
    let priorityAlerts = 0;
    let missingHba1c2Count = 0;
    let highDistressCount = 0;
    let significantFibrosisCount = 0;

    for (const p of patients) {
      if (p.clusterType && clusterCounts[p.clusterType] !== undefined) {
        clusterCounts[p.clusterType] += 1;
      }
      const missingHba1c2 = p.hba1c2.value === null;
      const highDistress = (p.ddsMean ?? 0) >= 3.0;
      const significantFibrosis =
        p.fibrosisInterpretation === 'F2' ||
        p.fibrosisInterpretation === 'F3' ||
        p.fibrosisInterpretation === 'F4';
      if (missingHba1c2) missingHba1c2Count += 1;
      if (highDistress) highDistressCount += 1;
      if (significantFibrosis) significantFibrosisCount += 1;
      if (missingHba1c2 || highDistress || significantFibrosis || p.statusColor === 'red') {
        priorityAlerts += 1;
      }
    }

    return {
      clusterCounts,
      priorityAlerts,
      missingHba1c2Count,
      highDistressCount,
      significantFibrosisCount,
    };
  }, [patients]);

  const selectedPatientPendingCount = useMemo(() => {
    if (!selectedPatient) return 0;
    return evaluateMissingDataAndStatus(selectedPatient).missingFields.length;
  }, [selectedPatient]);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error(`Unable to read file "${file.name}".`));
      reader.readAsDataURL(file);
    });

  const handleSmartReportIngest = async (file: File) => {
    setIngestingReport(true);
    setIngestError(null);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      const parsed = parseDataUrl(dataUrl, file.name);
      if (!parsed) {
        throw new Error('Unsupported file encoding. Please upload a PDF, image, CSV, or text report.');
      }

      const patientDirectory = patients.map((p) => ({
        participantId: p.participantId,
        uhid: p.uhid,
        patientName: p.patientName,
        gender: p.gender,
        dob: p.dob,
        contactNumber: p.contactNumber,
      }));

      const res = await fetch('/api/ai/ingest-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data: parsed.base64Data,
          mimeType: parsed.mimeType,
          fileName: file.name,
          patientDirectory,
        }),
      });

      const extracted = await parseJsonSafe<ExtractedReportPayload & { error?: string }>(res);
      if (!res.ok || !extracted) {
        throw new Error(
          extracted?.error || 'Could not process the uploaded report.'
        );
      }

      const attachment: AttachmentFile = {
        id: `sync-${Date.now()}`,
        name: file.name,
        section: extracted.documentType || 'AI Auto-Sync Report',
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };

      const match = matchPatientFromReport(patients, extracted);
      let appliedPatient: PatientCRF | null = null;
      let appliedChanges: ReportFieldChange[] = [];
      let autoApplied = false;

      if (match.matchedPatient) {
        const matchedKey = getPatientKey(match.matchedPatient);
        setManualAssignPid(matchedKey);
        const merged = applyExtractedReportToPatient(
          match.matchedPatient,
          extracted,
          attachment
        );
        appliedChanges = merged.appliedChanges;

        const shouldAutoSave =
          autoApplyEnabled &&
          (match.confidence === 'exact' || match.confidence === 'high') &&
          Boolean(onUpdatePatientInline);

        if (shouldAutoSave && onUpdatePatientInline) {
          await onUpdatePatientInline(merged.updatedPatient);
          appliedPatient = merged.updatedPatient;
          autoApplied = true;
          setSelectedPid(getPatientKey(merged.updatedPatient));
          setSyncHistoryCount((c) => c + 1);
        } else {
          appliedPatient = merged.updatedPatient;
        }
      }

      setLastSyncRecord({
        fileName: file.name,
        attachment,
        extracted,
        match,
        appliedPatient,
        appliedChanges,
        autoApplied,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } catch (err: unknown) {
      setIngestError(
        err instanceof Error ? err.message : 'Unable to extract and sync patient report.'
      );
    } finally {
      setIngestingReport(false);
    }
  };

  const handleManualApplySync = async (targetKey: string) => {
    if (!lastSyncRecord || !onUpdatePatientInline) return;
    const target = patients.find((p, idx) => getPatientKey(p, idx) === targetKey);
    if (!target) return;

    const merged = applyExtractedReportToPatient(
      target,
      lastSyncRecord.extracted,
      lastSyncRecord.attachment
    );
    await onUpdatePatientInline(merged.updatedPatient);
    setSelectedPid(getPatientKey(merged.updatedPatient));
    setSyncHistoryCount((c) => c + 1);
    setLastSyncRecord({
      ...lastSyncRecord,
      match: {
        matchedPatient: target,
        confidence: 'exact',
        matchReason: `Assigned to ${target.patientName}${target.uhid ? ` (UHID ${target.uhid})` : ''}`,
      },
      appliedPatient: merged.updatedPatient,
      appliedChanges: merged.appliedChanges,
      autoApplied: true,
    });
  };

  const handleAttachExtraFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const parsed = parseDataUrl(dataUrl, file.name);
      if (!parsed) return;
      setExtraFiles((prev) => [
        ...prev,
        {
          participantId: analysisMode === 'patient' && selectedPatient ? selectedPatient.participantId : 'QUERY-UPLOAD',
          patientName:
            analysisMode === 'patient' && selectedPatient
              ? selectedPatient.patientName
              : 'Investigator Upload',
          id: `extra-${Date.now()}`,
          name: file.name,
          section: 'AI Query Attachment',
          uploadedAt: new Date().toISOString(),
          mimeType: parsed.mimeType,
          base64Data: parsed.base64Data,
        },
      ]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInspectSingleAttachment = async (file: ParsedAttachmentPayload) => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch('/api/ai/read-attachment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachment: file,
          question: prompt.trim() || undefined,
        }),
      });
      const data = await parseJsonSafe<{ summary?: string; error?: string }>(res);
      if (!res.ok || !data) throw new Error(data?.error || 'Failed to read attached file.');
      setOutputMeta({
        title: `Attachment Inspection: ${file.name}`,
        subtitle: `${file.patientName} · ${file.section}`,
      });
      setAnalysisOutput(data.summary || '');
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to read attached file.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const targetPatient = selectedPatient;
      const contextData = !accessGranted
        ? { note: 'Patient data access is restricted by investigator; answer general clinical protocol query only.' }
        : analysisMode === 'patient' && targetPatient
        ? stripPatientForAI(targetPatient)
        : patients.map((p) => stripPatientForAI(p));

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: analysisMode,
          contextData,
          attachedFiles: activeScopeAttachments,
        }),
      });
      const data = await parseJsonSafe<{ analysis?: string; error?: string }>(res);
      if (!res.ok || !data) throw new Error(data?.error || 'Analysis failed.');
      setOutputMeta({
        title:
          analysisMode === 'patient' && targetPatient
            ? `Clinical Analysis — ${targetPatient.patientName}`
            : `Cohort Analysis Brief (${patients.length} Participants)`,
        subtitle:
          analysisMode === 'patient' && targetPatient
            ? `${targetPatient.uhid ? `UHID ${targetPatient.uhid} · ` : ''}${targetPatient.clusterType || 'Unassigned'} · ${activeScopeAttachments.length} files included`
            : `SIDD/SIRD/CIRDD/MARD Cohort · ${activeScopeAttachments.length} multimodal files included`,
      });
      setAnalysisOutput(data.analysis || '');
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Unable to complete AI analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuickSummary = async () => {
    const targetPatient = selectedPatient;
    if (!targetPatient) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const patientFiles = accessGranted
        ? collectPatientAttachments(patients, getPatientKey(targetPatient))
        : [];
      const res = await fetch('/api/ai/quick-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient: accessGranted
            ? stripPatientForAI(targetPatient)
            : { uhid: targetPatient.uhid, patientName: targetPatient.patientName },
          attachedFiles: patientFiles,
        }),
      });
      const data = await parseJsonSafe<{ summary?: string; error?: string }>(res);
      if (!res.ok || !data) throw new Error(data?.error || 'Quick summary failed.');
      setOutputMeta({
        title: `4-Point Clinical Summary — ${targetPatient.patientName || 'Unnamed'}`,
        subtitle: `${targetPatient.uhid ? `UHID ${targetPatient.uhid} · ` : ''}${targetPatient.clusterType || 'Unassigned'} · Blue Index ${targetPatient.blueIndexRatio || '—'}`,
      });
      setAnalysisOutput(data.summary || '');
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Quick summary failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Google Chat functions
  const loadChatSpaces = async () => {
    setLoadingChat(true);
    setChatError(null);
    try {
      const token = accessToken || (await onRequestGoogleSignIn());
      if (!token) {
        throw new Error('Google sign-in with Chat permissions is required.');
      }

      const res = await fetch('https://chat.googleapis.com/v1/spaces', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJsonSafe<{ spaces?: ChatSpace[]; error?: { message?: string } }>(res);
      if (!res.ok || !data) {
        const msg = data?.error?.message || 'Unable to load Google Chat spaces.';
        if (res.status === 404 || msg.includes('Chat app not found')) {
          throw new Error(
            'Google Chat spaces require a Google Workspace account and an active Chat API app configuration in Google Cloud Console.'
          );
        }
        throw new Error(msg);
      }

      const list: ChatSpace[] = data.spaces || [];
      setSpaces(list);
      if (list.length > 0) {
        const first = list[0].name;
        setSelectedSpace(first);
        await loadSpaceMessages(first, token);
      }
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Failed to load Google Chat spaces.');
    } finally {
      setLoadingChat(false);
    }
  };

  const loadSpaceMessages = async (spaceName: string, providedToken?: string) => {
    setLoadingChat(true);
    setChatError(null);
    try {
      const token = providedToken || accessToken || (await onRequestGoogleSignIn());
      if (!token) throw new Error('Google authentication required.');
      const res = await fetch(
        `https://chat.googleapis.com/v1/${spaceName}/messages?pageSize=25&orderBy=createTime%20desc`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await parseJsonSafe<{ messages?: ChatMessage[]; error?: { message?: string } }>(res);
      if (!res.ok || !data) throw new Error(data?.error?.message || 'Failed to read Chat messages.');
      setMessages(data.messages || []);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Failed to fetch Chat messages.');
    } finally {
      setLoadingChat(false);
    }
  };

  const handleConfirmSendChat = async () => {
    setConfirmChatSend(false);
    if (!selectedSpace || !chatDraft.trim()) return;
    setSendingChat(true);
    setChatError(null);
    try {
      const token = accessToken || (await onRequestGoogleSignIn());
      if (!token) throw new Error('Google authentication required.');

      const res = await fetch(`https://chat.googleapis.com/v1/${selectedSpace}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: chatDraft.trim() }),
      });
      const data = await parseJsonSafe<{ error?: { message?: string } }>(res);
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to send Chat message.');
      setChatDraft('');
      await loadSpaceMessages(selectedSpace, token);
    } catch (err: unknown) {
      setChatError(err instanceof Error ? err.message : 'Message send failed.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleToggleChatDictation = () => {
    if (dictatingChat) {
      recognitionRef.current?.stop?.();
      setDictatingChat(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
        onerror: (() => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
    };

    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setChatError(
        'Browser speech-to-text dictation is unavailable here — use the Voice Assistant panel on the right for bidirectional voice conversation.'
      );
      return;
    }

    setChatError(null);
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';
    rec.onresult = (ev) => {
      const last = ev.results?.[ev.results.length - 1]?.[0]?.transcript || '';
      if (last.trim()) {
        setChatDraft((prev) => (prev ? `${prev} ${last.trim()}` : last.trim()));
      }
    };
    rec.onerror = () => setDictatingChat(false);
    rec.onend = () => setDictatingChat(false);
    recognitionRef.current = rec;
    setDictatingChat(true);
    rec.start();
  };

  const handleSelectTemplate = (tpl: WorkflowTemplate) => {
    setActiveTemplateId(tpl.id);
    setAnalysisMode(tpl.scope);
    setPrompt(tpl.prompt);
  };

  return (
    <div className="space-y-5">
      {/* Header & Workspace Mode Switcher */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-[#14201B]">
            AI Clinical Intelligence &amp; Report Auto-Sync
          </h2>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Drop patient reports to auto-update CRFs, run cohort phenotyping queries, or launch clinical voice &amp; chat.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 bg-[#EFF5F1] border border-[#DDE8E2] rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('analysis')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              subTab === 'analysis' ? 'bg-white text-[#053B2B] shadow-sm' : 'text-[#4B6157]'
            }`}
          >
            Clinical Analysis &amp; Auto-Sync
          </button>
          <button
            type="button"
            onClick={() => setSubTab('voice')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              subTab === 'voice' ? 'bg-white text-[#053B2B] shadow-sm' : 'text-[#4B6157]'
            }`}
          >
            Live Voice Assistant
          </button>
          <button
            type="button"
            onClick={() => setSubTab('chat')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              subTab === 'chat' ? 'bg-white text-[#053B2B] shadow-sm' : 'text-[#4B6157]'
            }`}
          >
            Google Chat
          </button>
          <button
            type="button"
            onClick={() => setSubTab('bulk-sync')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              subTab === 'bulk-sync' ? 'bg-white text-[#053B2B] shadow-sm' : 'text-[#4B6157]'
            }`}
          >
            Bulk Excel &amp; Sheet Sync
          </button>
        </div>
      </div>

      {/* SubTab 1: Clinical Analysis & Report Auto-Sync */}
      {subTab === 'analysis' && (
        <div className="space-y-5 view-enter">
          {/* Cohort Clinical Readiness Strip (single flat bordered surface, tabular figures) */}
          <div className="bg-white border border-[#DDE8E2] rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EEF3F0]">
            <div className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
                Priority Follow-Up Alerts
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-[#14201B] tabular-nums">
                  {cohortStats.priorityAlerts}
                </span>
                <span className="text-xs text-[#4B6157] tabular-nums">
                  of {patients.length} participants
                </span>
              </div>
              <div className="text-[11px] text-[#6B8076] tabular-nums">
                {cohortStats.missingHba1c2Count} pending HbA1c₂ · {cohortStats.highDistressCount} DDS-17 high · {cohortStats.significantFibrosisCount} F2–F4
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
                4-Cluster Phenotypes
              </div>
              <div className="grid grid-cols-4 gap-2 pt-0.5">
                {CLUSTERS.map((c) => (
                  <div key={c}>
                    <div className="text-[10px] font-semibold text-[#6B8076]">{c}</div>
                    <div className="font-mono text-base font-bold text-[#053B2B] tabular-nums">
                      {cohortStats.clusterCounts[c]}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
                Multimodal Evidence Access
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-lg font-bold text-[#14201B] tabular-nums">
                  {patients.length} CRFs · {attachmentManifest.length} Files
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-[11px] font-medium text-[#053B2B] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={accessGranted}
                  onChange={(e) => setAccessGranted(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#047857] rounded"
                />
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#047857]" />
                  {accessGranted ? 'Full CRF & file access granted' : 'Restricted protocol mode'}
                </span>
              </label>
            </div>

            <div className="p-4 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
                Report Auto-Sync Status
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-bold text-[#047857] tabular-nums">
                  {syncHistoryCount}
                </span>
                <span className="text-xs text-[#4B6157]">
                  {syncHistoryCount === 1 ? 'report synced' : 'reports synced'}
                </span>
              </div>
              <div className="text-[11px] text-[#6B8076]">
                Auto-matches UHID, phone, or patient name
              </div>
            </div>
          </div>

          {/* Main 2-Column Studio Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* LEFT RAIL: Smart Report Auto-Sync + Scope & Patient Attachments */}
            <div className="xl:col-span-5 space-y-5">
              {/* 1. Smart Patient Report Auto-Sync */}
              <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#14201B]">
                      Smart Report Auto-Sync
                    </h3>
                    <p className="text-xs text-[#4B6157] mt-0.5">
                      Upload any lab report, FibroScan, or prescription directly here — matches the patient and updates their CRF automatically.
                    </p>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-[#14201B] cursor-pointer select-none px-3 py-2 rounded-xl bg-[#F2FBF6] border border-[#BFD5C9]">
                  <input
                    type="checkbox"
                    checked={autoApplyEnabled}
                    onChange={(e) => setAutoApplyEnabled(e.target.checked)}
                    className="w-4 h-4 accent-[#047857] rounded"
                  />
                  <span>Auto-update matched patient details immediately</span>
                </label>

                <input
                  ref={autoSyncInputRef}
                  type="file"
                  accept="image/*,application/pdf,text/plain,text/csv,.txt,.csv"
                  className="hidden"
                  aria-label="Smart report file upload input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSmartReportIngest(file);
                    e.target.value = '';
                  }}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDraggingReport(true);
                  }}
                  onDragLeave={() => setDraggingReport(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDraggingReport(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleSmartReportIngest(file);
                  }}
                  className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
                    draggingReport
                      ? 'border-[#047857] bg-[#EFF5F1]'
                      : 'border-[#BFD5C9] bg-[#FAFDFB]'
                  }`}
                >
                  <Upload className="w-6 h-6 text-[#047857] mx-auto mb-2" />
                  <div className="text-xs font-semibold text-[#14201B]">
                    {ingestingReport
                      ? 'Extracting values & matching patient record...'
                      : 'Drop lab report, FibroScan, or prescription here'}
                  </div>
                  <div className="text-[11px] text-[#6B8076] mt-1">
                    Supports PDF, JPG/PNG photo, CSV, or TXT · No manual patient lookup needed
                  </div>
                  <button
                    type="button"
                    disabled={ingestingReport}
                    onClick={() => autoSyncInputRef.current?.click()}
                    className="mt-3 px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{ingestingReport ? 'Processing Report...' : 'Upload Patient Report'}</span>
                  </button>
                </div>

                {ingestError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{ingestError}</span>
                  </div>
                )}

                {/* Sync Result & Field Diff Audit */}
                {lastSyncRecord && (
                  <div className="msg-slide-in border border-[#DDE8E2] rounded-xl bg-[#FAFDFB] p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#053B2B] flex items-center gap-1.5">
                          {lastSyncRecord.autoApplied ? (
                            <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                          ) : (
                            <UserCheck className="w-4 h-4 text-[#D97706] shrink-0" />
                          )}
                          <span className="truncate">
                            {lastSyncRecord.autoApplied
                              ? 'Patient CRF Updated Automatically'
                              : lastSyncRecord.match.matchedPatient
                              ? 'Match Found — Review & Apply'
                              : 'Unmatched Patient Report'}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#4B6157] mt-0.5 truncate">
                          {lastSyncRecord.fileName} · {lastSyncRecord.extracted.documentType || 'Clinical Report'} · {lastSyncRecord.timestamp}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-[#14201B] px-3 py-2 rounded-lg bg-white border border-[#EEF3F0] space-y-1">
                      <div>
                        <span className="text-[#4B6157]">Match Status:</span>{' '}
                        <span className="font-semibold text-[#053B2B]">
                          {lastSyncRecord.match.matchReason}
                        </span>
                      </div>
                      {lastSyncRecord.extracted.patientName && (
                        <div className="text-[11px] text-[#4B6157]">
                          Extracted Identity: {lastSyncRecord.extracted.patientName}
                          {lastSyncRecord.extracted.uhid
                            ? ` · UHID ${lastSyncRecord.extracted.uhid}`
                            : ''}
                        </div>
                      )}
                      {lastSyncRecord.extracted.summary && (
                        <div className="text-[11px] text-[#4B6157] pt-0.5">
                          {lastSyncRecord.extracted.summary}
                        </div>
                      )}
                    </div>

                    {lastSyncRecord.appliedChanges.length > 0 && (
                      <div className="overflow-x-auto border border-[#DDE8E2] rounded-lg bg-white">
                        <table className="w-full text-[11px] text-left border-collapse">
                          <thead className="bg-[#F6F9F7] border-b border-[#EEF3F0]">
                            <tr>
                              <th className="px-2.5 py-1.5 font-semibold text-[#4B6157]">Field</th>
                              <th className="px-2.5 py-1.5 font-semibold text-[#4B6157]">Previous</th>
                              <th className="px-2.5 py-1.5 font-semibold text-[#053B2B]">Saved Value</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#EEF3F0]">
                            {lastSyncRecord.appliedChanges.map((chg, idx) => (
                              <tr key={`${chg.fieldLabel}-${idx}`}>
                                <td className="px-2.5 py-1.5 font-medium text-[#14201B]">
                                  {chg.fieldLabel}
                                </td>
                                <td className="px-2.5 py-1.5 font-mono text-[#6B8076] tabular-nums">
                                  {chg.previousValue}
                                </td>
                                <td className="px-2.5 py-1.5 font-mono font-semibold text-[#047857] tabular-nums">
                                  {chg.newValue}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Action Controls: View Updated CRF / Manual Assign / Enroll New */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {lastSyncRecord.autoApplied && lastSyncRecord.appliedPatient && onViewCRF && (
                        <button
                          type="button"
                          onClick={() => onViewCRF(lastSyncRecord.appliedPatient!)}
                          className="px-3 py-1.5 rounded-lg bg-[#053B2B] hover:bg-[#042f22] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span>Open Updated CRF</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {(!lastSyncRecord.autoApplied || lastSyncRecord.match.confidence === 'none') &&
                        patients.length > 0 &&
                        onUpdatePatientInline && (
                          <div className="flex flex-wrap items-center gap-2 w-full">
                            <select
                              value={manualAssignPid}
                              onChange={(e) => setManualAssignPid(e.target.value)}
                              aria-label="Assign report to existing patient"
                              className="flex-1 min-w-[160px] px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white text-xs"
                            >
                              {patients.map((p, idx) => {
                                const pKey = getPatientKey(p, idx);
                                return (
                                  <option key={pKey} value={pKey}>
                                    {p.uhid || 'No UHID'} — {p.patientName || 'Unnamed'}
                                  </option>
                                );
                              })}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleManualApplySync(manualAssignPid)}
                              className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                            >
                              Apply to Patient
                            </button>
                          </div>
                        )}

                      {!lastSyncRecord.match.matchedPatient && onCreatePatientFromReport && (
                        <button
                          type="button"
                          onClick={() =>
                            onCreatePatientFromReport(
                              createDraftPatientFromReport(
                                patients,
                                lastSyncRecord.extracted,
                                lastSyncRecord.attachment
                              )
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-[#047857] text-[#047857] hover:bg-[#F2FBF6] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Enroll New Patient from Report</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* 2. Analysis Scope & Patient Evidence Selector */}
              <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-[#14201B]">
                    Analysis Scope &amp; Evidence
                  </h3>
                  <span className="text-[11px] font-mono text-[#4B6157] tabular-nums">
                    {activeScopeAttachments.length} files active
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="ai-analysis-scope"
                      className="block text-xs font-medium text-[#4B6157] mb-1"
                    >
                      Analysis Scope
                    </label>
                    <select
                      id="ai-analysis-scope"
                      value={analysisMode}
                      onChange={(e) =>
                        setAnalysisMode(e.target.value as 'cohort' | 'patient')
                      }
                      className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-sm"
                    >
                      <option value="cohort">
                        All Patient Records ({patients.length} patients)
                      </option>
                      <option value="patient">Single Patient CRF</option>
                    </select>
                  </div>

                  {analysisMode === 'patient' && (
                    <div className="space-y-2.5">
                      <div>
                        <label
                          htmlFor="ai-select-patient"
                          className="block text-xs font-medium text-[#4B6157] mb-1"
                        >
                          Select Patient
                        </label>
                        <select
                          id="ai-select-patient"
                          value={selectedPatient ? getPatientKey(selectedPatient) : ''}
                          onChange={(e) => setSelectedPid(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-sm"
                        >
                          {patients.map((p, idx) => {
                            const pKey = getPatientKey(p, idx);
                            return (
                              <option key={pKey} value={pKey}>
                                {p.uhid || 'No UHID'} — {p.patientName || 'Unnamed'} ({p.clusterType || 'Unassigned'}
                                {p.attachments?.length
                                  ? ` · ${p.attachments.length} file${
                                      p.attachments.length > 1 ? 's' : ''
                                    }`
                                  : ''}
                                )
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {selectedPatient && (
                        <div className="p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0] space-y-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[#053B2B]">
                              {selectedPatient.patientName || 'Unnamed'} · {selectedPatient.clusterType || 'Unassigned'}
                            </span>
                            {onViewCRF && (
                              <button
                                type="button"
                                onClick={() => onViewCRF(selectedPatient)}
                                className="text-[11px] font-semibold text-[#047857] hover:underline inline-flex items-center gap-1"
                              >
                                <span>Open CRF</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-[#14201B] tabular-nums">
                            <div>
                              <span className="text-[#6B8076] font-sans block text-[10px]">
                                HbA1c₁ / ₂
                              </span>
                              {selectedPatient.hba1c1.value ?? '—'}% /{' '}
                              {selectedPatient.hba1c2.value ?? '—'}%
                            </div>
                            <div>
                              <span className="text-[#6B8076] font-sans block text-[10px]">
                                Blue Index
                              </span>
                              {selectedPatient.blueIndexRatio}
                            </div>
                            <div>
                              <span className="text-[#6B8076] font-sans block text-[10px]">
                                Pending
                              </span>
                              {selectedPatientPendingCount} items
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Patient Attachment Library & Ad-Hoc Query Attachment */}
                <div className="pt-2 border-t border-[#EEF3F0] space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-[#047857]" />
                      <span>Patient Attachment Library</span>
                    </div>
                    <input
                      ref={extraFileRef}
                      type="file"
                      accept="image/*,application/pdf,text/plain,text/csv"
                      className="hidden"
                      onChange={handleAttachExtraFile}
                    />
                    <button
                      type="button"
                      onClick={() => extraFileRef.current?.click()}
                      className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-[#047857]" />
                      <span>Attach to Query</span>
                    </button>
                  </div>

                  {activeScopeAttachments.length === 0 ? (
                    <p className="text-[11px] text-[#6B8076]">
                      No files attached to this scope yet. Reports uploaded in Smart Auto-Sync or any CRF tab appear here automatically for multimodal AI reading.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
                      {activeScopeAttachments.map((file) => (
                        <div
                          key={file.id}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAFDFB] border border-[#DDE8E2] text-xs text-[#14201B]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#047857] shrink-0" />
                          <button
                            type="button"
                            onClick={() => handleInspectSingleAttachment(file)}
                            disabled={analyzing}
                            title="Inspect this attached file with AI"
                            className="hover:underline text-left max-w-[200px] truncate font-medium"
                          >
                            {file.patientName}: {file.name}
                          </button>
                          {file.id.startsWith('extra-') && (
                            <button
                              type="button"
                              onClick={() =>
                                setExtraFiles((prev) => prev.filter((f) => f.id !== file.id))
                              }
                              aria-label={`Remove ${file.name}`}
                              className="text-[#6B8076] hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* RIGHT WORKSPACE: Curated Workflows + Investigator Query + Formatted Brief */}
            <div className="xl:col-span-7 bg-white border border-[#DDE8E2] rounded-2xl p-5 sm:p-6 space-y-5">
              {/* Curated Clinical Workflows */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-bold text-[#14201B]">
                    Clinical Analysis Workflows
                  </h3>
                  <span className="text-[11px] text-[#6B8076]">
                    Select a template or write a custom clinical question
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {WORKFLOW_TEMPLATES.map((tpl) => {
                    const Icon = tpl.icon;
                    const active = activeTemplateId === tpl.id && prompt === tpl.prompt;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl)}
                        className={`card-elevate p-3 rounded-xl border text-left transition-colors flex items-start gap-2.5 ${
                          active
                            ? 'border-[#047857] bg-[#F2FBF6]'
                            : 'border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1]'
                        }`}
                      >
                        <Icon className="w-4 h-4 text-[#047857] shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#14201B] leading-snug">
                            {tpl.title}
                          </div>
                          <div className="text-[11px] text-[#6B8076] mt-0.5">
                            {tpl.category} · {tpl.scope === 'patient' ? 'Single Patient' : 'Full Cohort'}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Investigator Query Composer */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="investigator-query-input"
                    className="block text-xs font-semibold text-[#4B6157]"
                  >
                    Investigator Query
                  </label>
                  <span className="text-[11px] text-[#6B8076]">Ctrl+Enter to run</span>
                </div>
                <textarea
                  id="investigator-query-input"
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !analyzing) {
                      e.preventDefault();
                      handleRunAnalysis();
                    }
                  }}
                  placeholder="Ask about phenotypic clusters, Blue Index, DDS-17 distress, FibroScan stiffness, or attached patient lab reports..."
                  className="w-full px-4 py-3 rounded-xl border border-[#DDE8E2] text-sm text-[#14201B] focus:outline-none focus:border-[#047857]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleRunAnalysis}
                  disabled={analyzing || !prompt.trim()}
                  className="px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{analyzing ? 'Analyzing Cohort...' : 'Run Deep Clinical Analysis'}</span>
                </button>

                {selectedPatient && (
                  <button
                    type="button"
                    onClick={handleQuickSummary}
                    disabled={analyzing}
                    className="px-4 py-2.5 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] disabled:opacity-60 text-xs font-semibold text-[#14201B] whitespace-nowrap shrink-0"
                  >
                    Quick 4-Point Summary ({selectedPatient.patientName || selectedPatient.uhid || 'Patient'})
                  </button>
                )}
              </div>

              {analysisError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              {analyzing && (
                <div className="border border-[#DDE8E2] rounded-xl p-5 space-y-3 bg-[#FAFDFB]">
                  <div className="h-4 w-48 bg-[#DDE8E2] rounded animate-pulse" />
                  <div className="h-3 w-full bg-[#EEF3F0] rounded animate-pulse" />
                  <div className="h-3 w-5/6 bg-[#EEF3F0] rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-[#EEF3F0] rounded animate-pulse" />
                </div>
              )}

              {!analyzing && analysisOutput && (
                <div className="msg-slide-in">
                  <MarkdownClinicalReport
                    content={analysisOutput}
                    title={outputMeta.title}
                    subtitle={outputMeta.subtitle}
                  />
                </div>
              )}

              {!analyzing && !analysisOutput && !analysisError && (
                <div className="border border-dashed border-[#DDE8E2] rounded-xl p-6 text-center bg-[#FAFDFB] space-y-1.5">
                  <Sparkles className="w-5 h-5 text-[#047857] mx-auto" />
                  <div className="text-xs font-semibold text-[#14201B]">
                    Structured Clinical Output Ready
                  </div>
                  <p className="text-[11px] text-[#6B8076] max-w-md mx-auto">
                    Select one of the 6 clinical workflows above or click Run Deep Clinical Analysis to generate a formatted brief with copy and Markdown export.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Live Voice Conversation */}
      {subTab === 'voice' && <LiveVoicePanel patients={patients} />}

      {/* SubTab 3: Google Chat + Integrated Voice Assistant */}
      {subTab === 'chat' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start view-enter">
          {/* Google Chat Panel */}
          <div
            className={`${
              chatVoiceOpen ? 'xl:col-span-7' : 'xl:col-span-12'
            } bg-white border border-[#DDE8E2] rounded-2xl p-5 sm:p-6 space-y-4`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-[#047857]" />
                <div>
                  <h3 className="font-display text-base font-bold text-[#14201B]">
                    Investigator Google Chat Spaces
                  </h3>
                  <p className="text-xs text-[#4B6157]">
                    Read and post study updates or use voice dictation &amp; the docked Voice Assistant.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setChatVoiceOpen((v) => !v)}
                  className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    chatVoiceOpen
                      ? 'border-[#047857] bg-[#F2FBF6] text-[#053B2B]'
                      : 'border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#14201B]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-[#047857]" />
                  <span>{chatVoiceOpen ? 'Hide Voice Assistant' : 'Open Voice Assistant'}</span>
                </button>

                <button
                  type="button"
                  onClick={loadChatSpaces}
                  disabled={loadingChat}
                  className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingChat ? 'animate-spin' : ''}`} />
                  <span>{loadingChat ? 'Loading...' : 'Load Google Chat Spaces'}</span>
                </button>
              </div>
            </div>

            {chatError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{chatError}</span>
              </div>
            )}

            {spaces.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 space-y-1.5 border border-[#EEF3F0] rounded-xl p-2 bg-[#FAFDFB]">
                  {spaces.map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      onClick={() => {
                        setSelectedSpace(s.name);
                        loadSpaceMessages(s.name);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium ${
                        selectedSpace === s.name
                          ? 'bg-[#053B2B] text-white'
                          : 'hover:bg-[#EFF5F1] text-[#14201B]'
                      }`}
                    >
                      {s.displayName || s.name}
                    </button>
                  ))}
                </div>

                <div className="md:col-span-8 flex flex-col justify-between border border-[#DDE8E2] rounded-xl p-4 space-y-3">
                  <div className="max-h-72 overflow-y-auto space-y-2">
                    {messages.length === 0 ? (
                      <div className="text-xs text-[#6B8076] py-8 text-center">
                        No messages loaded in this space.
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div key={m.name} className="p-2.5 rounded-lg bg-[#F6F9F7] text-xs">
                          <div className="font-semibold text-[#053B2B]">
                            {m.sender?.displayName || m.sender?.type || 'Member'}
                          </div>
                          <div className="text-[#14201B] mt-0.5">{m.text || '(Attachment)'}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-[#EEF3F0]">
                    <input
                      type="text"
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder="Write or dictate study update to post to Google Chat..."
                      className="flex-1 px-3 py-2 rounded-xl border border-[#DDE8E2] text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleToggleChatDictation}
                      aria-label={dictatingChat ? 'Stop voice dictation' : 'Dictate chat message'}
                      title={dictatingChat ? 'Stop dictation' : 'Speak to compose'}
                      className={`px-3 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                        dictatingChat
                          ? 'border-red-300 bg-red-50 text-red-700'
                          : 'border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#053B2B]'
                      }`}
                    >
                      {dictatingChat ? (
                        <MicOff className="w-3.5 h-3.5" />
                      ) : (
                        <Mic className="w-3.5 h-3.5 text-[#047857]" />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={!chatDraft.trim() || sendingChat}
                      onClick={() => setConfirmChatSend(true)}
                      className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingChat ? 'Posting...' : 'Post Message'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {spaces.length === 0 && !chatError && (
              <div className="p-5 rounded-xl bg-[#FAFDFB] border border-[#DDE8E2] text-xs text-[#4B6157] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#047857] shrink-0" />
                <span>
                  Click <strong>Load Google Chat Spaces</strong> to fetch your clinic Google Chat
                  rooms, or speak directly with the <strong>Voice Assistant</strong> beside Chat.
                </span>
              </div>
            )}
          </div>

          {/* Voice Assistant Docked Inside Chat Tab */}
          {chatVoiceOpen && (
            <div className="xl:col-span-5 bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#14201B]">
                    Voice Assistant in Chat
                  </h3>
                  <p className="text-[11px] text-[#4B6157]">
                    Ask clinical questions hands-free while collaborating in Chat.
                  </p>
                </div>
              </div>
              <LiveVoicePanel patients={patients} compact />
            </div>
          )}
        </div>
      )}

      {/* SubTab 4: Bulk Excel & Google Sheets Multi-Patient Sync */}
      {subTab === 'bulk-sync' && (
        <BulkSpreadsheetSyncPanel
          patients={patients}
          accessToken={accessToken}
          activeUser={activeUser}
          onRequestGoogleSignIn={onRequestGoogleSignIn}
          onBatchUpsertPatients={onBatchUpsertPatients}
          onViewCRF={onViewCRF}
          onNavigateToData={onNavigateToData}
        />
      )}

      {/* Mandatory Confirmation Dialog Before Posting Google Chat Message */}
      {confirmChatSend && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE8E2] rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-bold text-[#14201B]">
                Post Message to Google Chat?
              </h3>
              <button
                type="button"
                onClick={() => setConfirmChatSend(false)}
                className="p-1 rounded-lg hover:bg-[#F6F9F7]"
              >
                <X className="w-4 h-4 text-[#4B6157]" />
              </button>
            </div>
            <p className="text-sm text-[#4B6157]">
              This message will be sent to all members in space{' '}
              <span className="font-mono font-semibold text-[#14201B]">
                {spaces.find((s) => s.name === selectedSpace)?.displayName || selectedSpace}
              </span>
              :
            </p>
            <div className="p-3 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2] text-xs text-[#14201B]">
              {chatDraft}
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmChatSend(false)}
                className="px-4 py-2 rounded-xl border border-[#DDE8E2] text-sm font-medium text-[#14201B]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendChat}
                className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-sm font-semibold"
              >
                Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
