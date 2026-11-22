import React from 'react';
import { Check, RotateCcw } from 'lucide-react';
import type { AttachmentFile, PatientCRF } from '../../types/clinical';
import {
  KS_FOOT_CRITERIA,
  KS_MACRO_CRITERIA,
  KS_MICRO_EGFR_CRITERIA,
  KS_MICRO_EYE_CRITERIA,
  KS_MICRO_UACR_CRITERIA,
} from '../../data/blueIndexCriteria';
import { SectionAttachmentBar } from './SectionAttachmentBar';

interface KomplicationsScoreSectionProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy: boolean;
}

const CheckboxGlyph: React.FC<{ checked: boolean }> = ({ checked }) => (
  <span
    aria-hidden="true"
    className={`w-5 h-5 rounded-md border inline-flex items-center justify-center shrink-0 ${
      checked
        ? 'bg-[#047857] border-[#047857] text-white shadow-xs'
        : 'bg-white border-[#C5D6CD] text-transparent'
    }`}
  >
    {checked && <Check className="w-3.5 h-3.5 stroke-[2.75]" />}
  </span>
);

export const KomplicationsScoreSection: React.FC<KomplicationsScoreSectionProps> = ({
  crf,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
}) => {
  const governingMarkers: string[] = [];
  if (crf.ksMicrovascular !== null) {
    if (crf.ksMicroEgfrTier === crf.ksMicrovascular) governingMarkers.push('eGFR');
    if (crf.ksMicroUacrTier === crf.ksMicrovascular) governingMarkers.push('UACR');
    if (crf.ksMicroRetinopathyTier === crf.ksMicrovascular) governingMarkers.push('Retinopathy');
  }

  return (
    <section
      id="section-komplications-score"
      className="scroll-mt-20 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-6"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
        <div>
          <h3 className="font-display text-base font-bold text-[#14201B]">
            Komplications Score (KS) — Standardized Criteria (0 to 15)
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            KS = Score<sub>Macrovascular (C)</sub> + Score<sub>Microvascular (M)</sub> + Score
            <sub>Foot/Neuro (F)</sub> · eGFR &amp; UACR tiers auto-calculate from Lab Investigation.
          </p>
        </div>
        <div className="font-mono tabular-nums text-sm font-bold text-[#053B2B] bg-[#F6F9F7] border border-[#DDE8E2] px-3.5 py-1.5 rounded-xl">
          KS Total: {crf.ksTotal ?? '—'} / 15
        </div>
      </div>

      {/* Arm 3: Diabetic Foot & Neuropathy Examination (F: 0-5) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#14201B]">
              Arm 3: Foot Examination &amp; Diabetic Neuropathy (F: 0–5)
            </h4>
            <p className="text-xs text-[#4B6157]">
              Evaluate both structural architecture and functional/vascular parameters (select highest applicable severity).
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#053B2B] tabular-nums">
            Score F: {crf.ksFootNeuropathy ?? '—'} / 5
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Arm 3 Foot Examination Score (0 to 5)"
          className="border border-[#DDE8E2] rounded-xl overflow-hidden divide-y divide-[#EEF3F0]"
        >
          <div className="hidden md:grid md:grid-cols-12 gap-3 px-3.5 py-2 bg-[#F6F9F7] text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
            <div className="md:col-span-1">Score</div>
            <div className="md:col-span-5">Structural Examination Parameters</div>
            <div className="md:col-span-5">Functional / Vascular Examination Parameters</div>
            <div className="md:col-span-1 text-right">Select</div>
          </div>
          {KS_FOOT_CRITERIA.map((row) => {
            const selected = crf.ksFootNeuropathy === row.score;
            return (
              <button
                key={row.score}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Foot score ${row.score}: ${row.structural}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    ksFootNeuropathy: prev.ksFootNeuropathy === row.score ? null : row.score,
                  }))
                }
                className={`w-full text-left px-3.5 py-2.5 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 items-center ${
                  selected
                    ? 'bg-[#E6F7F0] shadow-[inset_3px_0_0_0_#047857]'
                    : 'bg-white hover:bg-[#FAFDFB]'
                }`}
              >
                <div className="md:col-span-1 flex items-center gap-2">
                  <span
                    className={`font-mono font-bold text-sm tabular-nums ${
                      selected ? 'text-[#047857]' : 'text-[#14201B]'
                    }`}
                  >
                    {row.score}
                  </span>
                </div>
                <div className="md:col-span-5 text-xs text-[#14201B] leading-snug">
                  <span className="md:hidden font-semibold text-[#4B6157]">Structural: </span>
                  {row.structural}
                </div>
                <div className="md:col-span-5 text-xs text-[#4B6157] leading-snug">
                  <span className="md:hidden font-semibold text-[#4B6157]">Functional: </span>
                  {row.functionalVascular}
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <CheckboxGlyph checked={selected} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arm 1: Cardiac / Macrovascular Complications (C: 0-5) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#14201B]">
              Arm 1: Cardiac / Macrovascular Complications (C: 0–5)
            </h4>
            <p className="text-xs text-[#4B6157]">
              Standard clinical diagnostic criteria for CVD/CAD, heart failure, and cerebrovascular disease.
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#053B2B] tabular-nums">
            Score C: {crf.ksMacrovascular ?? '—'} / 5
          </span>
        </div>

        <div
          role="radiogroup"
          aria-label="Arm 1 Cardiac / Macrovascular Complications Score (0 to 5)"
          className="border border-[#DDE8E2] rounded-xl overflow-hidden divide-y divide-[#EEF3F0]"
        >
          {KS_MACRO_CRITERIA.map((row) => {
            const selected = crf.ksMacrovascular === row.score;
            return (
              <button
                key={row.score}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Macrovascular score ${row.score}: ${row.shortTitle}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    ksMacrovascular: prev.ksMacrovascular === row.score ? null : row.score,
                  }))
                }
                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 ${
                  selected
                    ? 'bg-[#E6F7F0] shadow-[inset_3px_0_0_0_#047857]'
                    : 'bg-white hover:bg-[#FAFDFB]'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={`font-mono font-bold text-sm tabular-nums w-5 shrink-0 ${
                      selected ? 'text-[#047857]' : 'text-[#14201B]'
                    }`}
                  >
                    {row.score}
                  </span>
                  <div className="text-xs leading-snug">
                    <span className="font-semibold text-[#14201B]">{row.shortTitle}: </span>
                    <span className="text-[#4B6157]">{row.description}</span>
                  </div>
                </div>
                <CheckboxGlyph checked={selected} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Arm 2: Reno-Retinal / Microvascular Complications (M: 0-5) - 3 Side-by-Side Panels */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-[#14201B]">
              Arm 2: Microvascular Complications (M: 0–5) — Maximal Severity Principle
            </h4>
            <p className="text-xs text-[#4B6157]">
              Official Rule: <span className="font-mono font-semibold text-[#14201B]">Score M = max(Score_eGFR, Score_UACR, Score_Eye)</span>
              {governingMarkers.length > 0 && (
                <span> · Governed by {governingMarkers.join(' & ')}</span>
              )}
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-[#053B2B] tabular-nums">
            Score M: {crf.ksMicrovascular ?? '—'} / 5
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Panel 1: eGFR */}
          <div className="border border-[#DDE8E2] rounded-2xl bg-[#FAFDFB] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#EFF5F1] border-b border-[#DDE8E2] flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#14201B]">eGFR (mL/min/1.73m²)</div>
                <div className="text-[11px] font-mono text-[#4B6157]">
                  Lab Value: {crf.egfr !== null ? `${crf.egfr} mL/min` : 'Pending'} ·{' '}
                  {crf.ksMicroEgfrManualOverride ? 'Manual' : 'Auto from Lab'}
                </div>
              </div>
              {crf.ksMicroEgfrManualOverride && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({ ...prev, ksMicroEgfrManualOverride: false }))
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sync Lab</span>
                </button>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Microvascular eGFR Tier (0 to 5)"
              className="divide-y divide-[#EEF3F0] flex-1"
            >
              {KS_MICRO_EGFR_CRITERIA.map((tier) => {
                const selected = crf.ksMicroEgfrTier === tier.score;
                return (
                  <button
                    key={tier.score}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`eGFR tier ${tier.score}: ${tier.label}`}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        ksMicroEgfrManualOverride: true,
                        ksMicroEgfrTier: tier.score,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[#E6F7F0] shadow-[inset_3px_0_0_0_#047857]'
                        : 'bg-white hover:bg-[#F6F9F7]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums w-4 shrink-0 ${
                          selected ? 'text-[#047857]' : 'text-[#14201B]'
                        }`}
                      >
                        {tier.score}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#14201B] leading-tight">
                          {tier.label}
                        </div>
                        <div className="text-[11px] text-[#4B6157] leading-tight mt-0.5">
                          {tier.detail}
                        </div>
                      </div>
                    </div>
                    <CheckboxGlyph checked={selected} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel 2: UACR */}
          <div className="border border-[#DDE8E2] rounded-2xl bg-[#FAFDFB] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#EFF5F1] border-b border-[#DDE8E2] flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#14201B]">UACR (Spot Urine, mg/g)</div>
                <div className="text-[11px] font-mono text-[#4B6157]">
                  Lab Value:{' '}
                  {crf.uacr.value !== null ? `${crf.uacr.value} ${crf.uacr.unit}` : 'Pending'} ·{' '}
                  {crf.ksMicroUacrManualOverride ? 'Manual' : 'Auto from Lab'}
                </div>
              </div>
              {crf.ksMicroUacrManualOverride && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({ ...prev, ksMicroUacrManualOverride: false }))
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] hover:underline"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sync Lab</span>
                </button>
              )}
            </div>
            <div
              role="radiogroup"
              aria-label="Microvascular UACR Tier (0 to 5)"
              className="divide-y divide-[#EEF3F0] flex-1"
            >
              {KS_MICRO_UACR_CRITERIA.map((tier) => {
                const selected = crf.ksMicroUacrTier === tier.score;
                return (
                  <button
                    key={tier.score}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`UACR tier ${tier.score}: ${tier.label}`}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        ksMicroUacrManualOverride: true,
                        ksMicroUacrTier: tier.score,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[#E6F7F0] shadow-[inset_3px_0_0_0_#047857]'
                        : 'bg-white hover:bg-[#F6F9F7]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums w-4 shrink-0 ${
                          selected ? 'text-[#047857]' : 'text-[#14201B]'
                        }`}
                      >
                        {tier.score}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#14201B] leading-tight">
                          {tier.label}
                        </div>
                        <div className="text-[11px] text-[#4B6157] leading-tight mt-0.5">
                          {tier.detail}
                        </div>
                      </div>
                    </div>
                    <CheckboxGlyph checked={selected} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panel 3: Retinopathy */}
          <div className="border border-[#DDE8E2] rounded-2xl bg-[#FAFDFB] flex flex-col overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#EFF5F1] border-b border-[#DDE8E2] flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-[#14201B]">
                  Retinopathy (Fundoscopy / Grading)
                </div>
                <div className="text-[11px] font-mono text-[#4B6157]">
                  Eye Exam Tier: {crf.ksMicroRetinopathyTier ?? 'Unselected'}
                </div>
              </div>
            </div>
            <div
              role="radiogroup"
              aria-label="Microvascular Retinopathy Tier (0 to 5)"
              className="divide-y divide-[#EEF3F0] flex-1"
            >
              {KS_MICRO_EYE_CRITERIA.map((tier) => {
                const selected = crf.ksMicroRetinopathyTier === tier.score;
                return (
                  <button
                    key={tier.score}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Retinopathy tier ${tier.score}: ${tier.label}`}
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        ksMicroRetinopathyTier:
                          prev.ksMicroRetinopathyTier === tier.score ? null : tier.score,
                      }))
                    }
                    className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 ${
                      selected
                        ? 'bg-[#E6F7F0] shadow-[inset_3px_0_0_0_#047857]'
                        : 'bg-white hover:bg-[#F6F9F7]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className={`font-mono text-xs font-bold tabular-nums w-4 shrink-0 ${
                          selected ? 'text-[#047857]' : 'text-[#14201B]'
                        }`}
                      >
                        {tier.score}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#14201B] leading-tight">
                          {tier.label}
                        </div>
                        <div className="text-[11px] text-[#4B6157] leading-tight mt-0.5">
                          {tier.detail}
                        </div>
                      </div>
                    </div>
                    <CheckboxGlyph checked={selected} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column KS Summary Strip (matching IMG_4129 bottom of KS section) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border border-[#DDE8E2] rounded-xl overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-[#DDE8E2] bg-[#F6F9F7]">
        <div className="p-3 text-center">
          <div className="text-[11px] font-medium text-[#4B6157]">Microvascular Complication (M)</div>
          <div
            data-testid="ks-micro-summary"
            className="font-mono text-lg font-bold text-[#14201B] tabular-nums mt-0.5"
          >
            {crf.ksMicrovascular ?? '—'} / 5
          </div>
        </div>
        <div className="p-3 text-center">
          <div className="text-[11px] font-medium text-[#4B6157]">Macrovascular Complication (C)</div>
          <div
            data-testid="ks-macro-summary"
            className="font-mono text-lg font-bold text-[#14201B] tabular-nums mt-0.5"
          >
            {crf.ksMacrovascular ?? '—'} / 5
          </div>
        </div>
        <div className="p-3 text-center">
          <div className="text-[11px] font-medium text-[#4B6157]">Diabetic Foot &amp; Neuropathy (F)</div>
          <div
            data-testid="ks-foot-summary"
            className="font-mono text-lg font-bold text-[#14201B] tabular-nums mt-0.5"
          >
            {crf.ksFootNeuropathy ?? '—'} / 5
          </div>
        </div>
        <div className="p-3 text-center bg-[#ECFDF5]">
          <div className="text-[11px] font-semibold text-[#053B2B]">KS Total (C + M + F)</div>
          <div
            data-testid="ks-total-summary"
            className="font-mono text-lg font-bold text-[#047857] tabular-nums mt-0.5"
          >
            {crf.ksTotal ?? '—'} / 15
          </div>
        </div>
      </div>

      <SectionAttachmentBar
        sectionKey="sectionD"
        sectionLabel="File / Photo Attach (KS)"
        attachments={crf.attachments}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onAIExtract={onAIExtract}
        aiBusy={aiBusy}
      />
    </section>
  );
};
