import React, { useEffect, useRef } from 'react';

export type VoiceFaceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'asker-talking'
  | 'ai-talking';

interface AIAssistantFaceProps {
  state: VoiceFaceState;
  speechLevel: number; // 0..1 audio RMS energy
  personaName: string;
  size?: number;
}

export const AIAssistantFace: React.FC<AIAssistantFaceProps> = ({
  state,
  speechLevel,
  personaName,
  size = 104,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Refs read directly inside the 60fps canvas loop (zero React re-renders per frame)
  const targetGazeRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentGazeRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const stateRef = useRef<VoiceFaceState>(state);
  const speechTargetRef = useRef<number>(speechLevel);
  const speechSmoothRef = useRef<number>(0);
  const blinkAmountRef = useRef<number>(0); // 0 = open, 1 = closed

  stateRef.current = state;
  speechTargetRef.current = speechLevel;

  // Pointer-based optical gaze tracking relative to avatar center
  useEffect(() => {
    const handlePointerMove = (ev: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (ev.clientX - cx) / Math.max(220, window.innerWidth * 0.32);
      const dy = (ev.clientY - cy) / Math.max(160, window.innerHeight * 0.32);
      targetGazeRef.current = {
        x: Math.max(-1, Math.min(1, dx)),
        y: Math.max(-1, Math.min(1, dy)),
      };
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('mousemove', handlePointerMove);
  }, []);

  // Attentive conversational gaze shift when Investigator talks vs AI responds
  useEffect(() => {
    if (state === 'asker-talking') {
      targetGazeRef.current = { x: -0.72, y: -0.05 };
    } else if (state === 'ai-talking') {
      targetGazeRef.current = { x: 0, y: 0 };
    }
  }, [state]);

  // 60fps High-DPI OLED Clinical AI Visor & Acoustic Harmonic Field renderer
  useEffect(() => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const BASE_COORD = 200;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const scaleFactor = (size / BASE_COORD) * dpr;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let rafId = 0;
    let lastTime = performance.now();
    let nextBlinkAt = performance.now() + 2600;
    let blinkProgress = -1;

    const drawRoundedPill = (
      x: number,
      y: number,
      w: number,
      h: number,
      radius: number
    ) => {
      const r = Math.min(radius, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + r, y - h / 2);
      ctx.lineTo(x + w / 2 - r, y - h / 2);
      ctx.quadraticCurveTo(x + w / 2, y - h / 2, x + w / 2, y - h / 2 + r);
      ctx.lineTo(x + w / 2, y + h / 2 - r);
      ctx.quadraticCurveTo(x + w / 2, y + h / 2, x + w / 2 - r, y + h / 2);
      ctx.lineTo(x - w / 2 + r, y + h / 2);
      ctx.quadraticCurveTo(x - w / 2, y + h / 2, x - w / 2, y + h / 2 - r);
      ctx.lineTo(x - w / 2, y - h / 2 + r);
      ctx.quadraticCurveTo(x - w / 2, y - h / 2, x - w / 2 + r, y - h / 2);
      ctx.closePath();
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const curState = stateRef.current;
      const isTalking = curState === 'ai-talking';
      const isListening = curState === 'asker-talking' || curState === 'listening';
      const isConnecting = curState === 'connecting';

      const gazeLerp = prefersReducedMotion ? 1 : 1 - Math.exp(-9 * dt);
      currentGazeRef.current.x +=
        (targetGazeRef.current.x - currentGazeRef.current.x) * gazeLerp;
      currentGazeRef.current.y +=
        (targetGazeRef.current.y - currentGazeRef.current.y) * gazeLerp;

      const gx = currentGazeRef.current.x;
      const gy = currentGazeRef.current.y;

      const targetEnergy = isTalking ? Math.max(0.45, speechTargetRef.current) : isListening ? 0.14 : 0.04;
      speechSmoothRef.current += (targetEnergy - speechSmoothRef.current) * (1 - Math.exp(-12 * dt));
      const energy = speechSmoothRef.current;

      if (!prefersReducedMotion) {
        if (blinkProgress < 0 && now >= nextBlinkAt) {
          blinkProgress = 0;
        }
        if (blinkProgress >= 0) {
          blinkProgress += dt / 0.16;
          if (blinkProgress >= 1) {
            blinkAmountRef.current = 0;
            blinkProgress = -1;
            nextBlinkAt = now + 2600 + Math.random() * 2800;
          } else {
            blinkAmountRef.current = Math.sin(blinkProgress * Math.PI);
          }
        }
      }

      ctx.save();
      ctx.scale(scaleFactor, scaleFactor);
      ctx.clearRect(0, 0, BASE_COORD, BASE_COORD);

      const cx = BASE_COORD / 2;
      const cy = BASE_COORD / 2;
      const t = prefersReducedMotion ? 0 : now * 0.001;

      // 1. Ambient Volumetric Acoustic Glow
      const glowRadius = 90 + (isTalking ? energy * 10 : 0);
      const ambientGlow = ctx.createRadialGradient(cx, cy, 34, cx, cy, glowRadius);
      ambientGlow.addColorStop(
        0,
        isTalking
          ? `rgba(16, 185, 129, ${(0.28 + energy * 0.22).toFixed(3)})`
          : isListening
          ? 'rgba(45, 212, 191, 0.20)'
          : 'rgba(16, 185, 129, 0.10)'
      );
      ambientGlow.addColorStop(1, 'rgba(5, 59, 43, 0)');
      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 2. Polar Harmonic Sound-Field Rings
      const ringCount = isTalking ? 2 : 1;
      for (let rIdx = 0; rIdx < ringCount; rIdx++) {
        const baseR = 66 + rIdx * 12;
        const amp = isTalking ? 3.5 + energy * (6.5 + rIdx * 3) : isListening ? 1.8 : 0.7;
        const alpha = isTalking ? 0.58 - rIdx * 0.24 : isListening ? 0.34 : 0.2;

        ctx.beginPath();
        const steps = 96;
        for (let i = 0; i <= steps; i++) {
          const theta = (i / steps) * Math.PI * 2;
          const wave =
            Math.sin(theta * 4 + t * (4.2 - rIdx * 1.1)) * 0.55 +
            Math.cos(theta * 6 - t * 3.1 + rIdx) * 0.45;
          const rad = baseR + wave * amp;
          const px = cx + Math.cos(theta) * rad;
          const py = cy + Math.sin(theta) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.strokeStyle =
          rIdx === 0
            ? `rgba(110, 231, 183, ${alpha})`
            : `rgba(94, 234, 212, ${alpha})`;
        ctx.lineWidth = rIdx === 0 ? 1.8 : 1.3;
        ctx.stroke();
      }

      // 3. Connecting Orbital Sweep Arc
      if (isConnecting) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * 2.8);
        ctx.beginPath();
        ctx.arc(0, 0, 64, 0, Math.PI * 0.85);
        ctx.strokeStyle = 'rgba(167, 243, 208, 0.9)';
        ctx.lineWidth = 2.6;
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.restore();
      }

      // 4. Sleek Obsidian-Emerald Smart Visor Sphere
      const visorX = cx + gx * 6.5;
      const visorY = cy + gy * 4.5 + Math.sin(t * 2.1) * (prefersReducedMotion ? 0 : 1.2);
      const visorR = 52;

      ctx.save();
      ctx.shadowColor = 'rgba(2, 19, 14, 0.65)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;

      const visorGrad = ctx.createRadialGradient(
        visorX - 16 + gx * 8,
        visorY - 18 + gy * 6,
        6,
        visorX,
        visorY,
        visorR + 4
      );
      visorGrad.addColorStop(0, '#0D4F3C');
      visorGrad.addColorStop(0.55, '#05281E');
      visorGrad.addColorStop(1, '#02130E');

      ctx.fillStyle = visorGrad;
      ctx.beginPath();
      ctx.arc(visorX, visorY, visorR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = isTalking
        ? 'rgba(110, 231, 183, 0.72)'
        : isListening
        ? 'rgba(94, 234, 212, 0.55)'
        : 'rgba(167, 243, 208, 0.30)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(visorX, visorY, visorR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(visorX, visorY, visorR - 4, -Math.PI * 0.78, -Math.PI * 0.32);
      ctx.stroke();

      // Clip interior facial OLED optics cleanly
      ctx.save();
      ctx.beginPath();
      ctx.arc(visorX, visorY, visorR - 3, 0, Math.PI * 2);
      ctx.clip();

      // 5. Perspective-Tracked Luminous OLED Optics (Eyes)
      const faceCenterX = visorX + gx * 14;
      const faceCenterY = visorY + gy * 9.5;
      const eyeSpacing = 18;
      const blinkScale = Math.max(0.08, 1 - blinkAmountRef.current * 0.92);
      const leftEyeScale = 1 + gx * 0.08;
      const rightEyeScale = 1 - gx * 0.08;
      const eyeBaseH = isListening ? 15 : isTalking ? 13 : 13.5;
      const eyeBaseW = 10;

      const drawOpticEye = (ex: number, ey: number, horizScale: number) => {
        ctx.save();
        ctx.translate(ex, ey);
        ctx.shadowColor = isTalking ? '#34D399' : '#6EE7B7';
        ctx.shadowBlur = isTalking ? 12 : 8;

        const h = eyeBaseH * blinkScale;
        const w = eyeBaseW * horizScale;

        if (isTalking && blinkScale > 0.65 && energy > 0.55) {
          ctx.strokeStyle = '#ECFDF5';
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 2.5, w * 0.68, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ECFDF5';
          drawRoundedPill(0, 0, w, h, w / 2);
          ctx.fill();

          if (blinkScale > 0.5) {
            ctx.fillStyle = '#34D399';
            ctx.beginPath();
            ctx.arc(gx * 1.2, gy * 1.0 - 1.2, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();
      };

      drawOpticEye(faceCenterX - eyeSpacing, faceCenterY - 7, leftEyeScale);
      drawOpticEye(faceCenterX + eyeSpacing, faceCenterY - 7, rightEyeScale);

      // 6. Harmonic Voice Ribbon (Mouth / Acoustic Resonance Waveform)
      const mouthX = faceCenterX;
      const mouthY = faceCenterY + 16;
      const mouthHalfW = isTalking ? 22 : 15;

      ctx.save();
      ctx.shadowColor = '#34D399';
      ctx.shadowBlur = isTalking ? 10 : 4;

      if (isTalking) {
        const samples = 28;
        const topPoints: Array<[number, number]> = [];
        const botPoints: Array<[number, number]> = [];
        const voiceAmp = (4.8 + energy * 8.8) * (0.65 + 0.35 * Math.sin(t * 9.5));

        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          const x = mouthX - mouthHalfW + u * mouthHalfW * 2;
          const envelope = Math.sin(u * Math.PI);
          const harmonic =
            0.58 * Math.sin(u * Math.PI * 3 + t * 14) +
            0.42 * Math.cos(u * Math.PI * 5 - t * 19);
          const displacement = Math.max(1.3, (0.55 + Math.abs(harmonic) * 0.65) * voiceAmp) * envelope;
          topPoints.push([x, mouthY - displacement]);
          botPoints.push([x, mouthY + displacement]);
        }

        ctx.beginPath();
        topPoints.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        for (let i = botPoints.length - 1; i >= 0; i--) {
          ctx.lineTo(botPoints[i][0], botPoints[i][1]);
        }
        ctx.closePath();
        ctx.fillStyle = 'rgba(52, 211, 153, 0.32)';
        ctx.fill();

        ctx.strokeStyle = '#ECFDF5';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        topPoints.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();

        ctx.strokeStyle = '#6EE7B7';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        botPoints.forEach(([x, y], idx) => (idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
        ctx.stroke();
      } else if (isConnecting) {
        ctx.strokeStyle = '#6EE7B7';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const u = i / 24;
          const x = mouthX - 18 + u * 36;
          const y = mouthY + Math.sin(u * Math.PI * 3 + t * 8) * 3 * Math.sin(u * Math.PI);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = isListening ? '#A7F3D0' : 'rgba(167, 243, 208, 0.75)';
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(mouthX - 12, mouthY - 1);
        ctx.quadraticCurveTo(mouthX, mouthY + (isListening ? 4.5 : 3.5), mouthX + 12, mouthY - 1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();

      ctx.restore();
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [size]);

  const isAiTalking = state === 'ai-talking';
  const isListeningToAsker = state === 'asker-talking' || state === 'listening';

  return (
    <div
      ref={containerRef}
      data-testid="ai-assistant-face"
      data-face-state={state}
      className="relative flex flex-col items-center justify-center select-none"
    >
      <canvas
        ref={displayCanvasRef}
        style={{ width: size, height: size }}
        aria-label={`${personaName} AI Clinical Assistant animated acoustic visor`}
        role="img"
        className="block"
      />

      <div className="-mt-1 text-center">
        <div className="text-[11px] font-semibold text-white whitespace-nowrap">
          {personaName} · Clinical AI
        </div>
        <div className="text-[10px] text-emerald-200/80 whitespace-nowrap">
          {isAiTalking
            ? 'Speaking'
            : state === 'connecting'
            ? 'Connecting...'
            : isListeningToAsker
            ? 'Listening'
            : 'Ready'}
        </div>
      </div>
    </div>
  );
};
