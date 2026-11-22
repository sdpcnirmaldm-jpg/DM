import React from 'react';
import type { AttachmentFile, PatientCRF } from '../../types/clinical';
import { SectionAttachmentBar } from './SectionAttachmentBar';

interface VitalsTabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy: boolean;
}

export const VitalsTab: React.FC<VitalsTabProps> = ({
  crf,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
}) => {
  return (
    <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-6">
      <div>
        <h3 className="font-display text-base font-bold text-[#14201B]">
          Anthropometric Measurements &amp; Vital Signs
        </h3>
        <p className="text-xs text-[#4B6157] mt-0.5">
          Supports cm / inch / feet and kg / lbs with automatic BMI &amp; Waist-Hip Ratio (or manual
          override).
        </p>
      </div>

      {/* Height, Weight, BMI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">Height</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={crf.heightValue ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  heightValue: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Height value"
              className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
            <select
              value={crf.heightUnit}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  heightUnit: e.target.value as 'cm' | 'inch' | 'feet',
                }))
              }
              aria-label="Height unit"
              className="px-2.5 py-2 border border-[#DDE8E2] rounded-xl text-xs bg-white font-medium"
            >
              <option value="cm">cm</option>
              <option value="inch">inch</option>
              <option value="feet">feet</option>
            </select>
          </div>
          {crf.heightCm !== null && crf.heightUnit !== 'cm' && (
            <div className="text-[11px] font-mono text-[#6B8076] mt-1">
              = {crf.heightCm} cm
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">Weight</label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={crf.weightValue ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  weightValue: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Weight value"
              className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
            <select
              value={crf.weightUnit}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, weightUnit: e.target.value as 'kg' | 'lbs' }))
              }
              aria-label="Weight unit"
              className="px-2.5 py-2 border border-[#DDE8E2] rounded-xl text-xs bg-white font-medium"
            >
              <option value="kg">kg</option>
              <option value="lbs">lbs</option>
            </select>
          </div>
          {crf.weightKg !== null && crf.weightUnit !== 'kg' && (
            <div className="text-[11px] font-mono text-[#6B8076] mt-1">
              = {crf.weightKg} kg
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-[#4B6157]">BMI (kg/m²)</label>
            <label className="inline-flex items-center gap-1 text-[11px] text-[#4B6157] cursor-pointer">
              <input
                type="checkbox"
                checked={crf.bmiManualOverride}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, bmiManualOverride: e.target.checked }))
                }
                className="accent-[#047857]"
              />
              <span>Manual</span>
            </label>
          </div>
          <input
            type="number"
            step="0.1"
            readOnly={!crf.bmiManualOverride}
            value={crf.bmi ?? ''}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                bmi: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            aria-label="Body Mass Index"
            className={`w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono font-semibold ${
              crf.bmiManualOverride ? 'bg-white' : 'bg-[#F6F9F7] text-[#053B2B]'
            }`}
          />
        </div>
      </div>

      {/* Waist, Hip, WHR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">
            Waist Circumference
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={crf.waistValue ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  waistValue: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Waist circumference"
              className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
            <select
              value={crf.waistUnit}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, waistUnit: e.target.value as 'cm' | 'inch' }))
              }
              aria-label="Waist unit"
              className="px-2.5 py-2 border border-[#DDE8E2] rounded-xl text-xs bg-white font-medium"
            >
              <option value="cm">cm</option>
              <option value="inch">inch</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">
            Hip Circumference
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={crf.hipValue ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  hipValue: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Hip circumference"
              className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
            <select
              value={crf.hipUnit}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, hipUnit: e.target.value as 'cm' | 'inch' }))
              }
              aria-label="Hip unit"
              className="px-2.5 py-2 border border-[#DDE8E2] rounded-xl text-xs bg-white font-medium"
            >
              <option value="cm">cm</option>
              <option value="inch">inch</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-[#4B6157]">Waist-Hip Ratio</label>
            <label className="inline-flex items-center gap-1 text-[11px] text-[#4B6157] cursor-pointer">
              <input
                type="checkbox"
                checked={crf.whrManualOverride}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, whrManualOverride: e.target.checked }))
                }
                className="accent-[#047857]"
              />
              <span>Manual</span>
            </label>
          </div>
          <input
            type="number"
            step="0.01"
            readOnly={!crf.whrManualOverride}
            value={crf.waistHipRatio ?? ''}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                waistHipRatio: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            aria-label="Waist-Hip Ratio"
            className={`w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono font-semibold ${
              crf.whrManualOverride ? 'bg-white' : 'bg-[#F6F9F7] text-[#053B2B]'
            }`}
          />
        </div>
      </div>

      {/* BP & Pulse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#EEF3F0]">
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">
            Systolic BP (mmHg)
          </label>
          <input
            type="number"
            value={crf.sbp ?? ''}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                sbp: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder="e.g. 128"
            aria-label="Systolic BP"
            className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">
            Diastolic BP (mmHg)
          </label>
          <input
            type="number"
            value={crf.dbp ?? ''}
            onChange={(e) =>
              onChange((prev) => ({
                ...prev,
                dbp: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder="e.g. 80"
            aria-label="Diastolic BP"
            className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1">Pulse (bpm)</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={crf.pulse ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  pulse: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="e.g. 76"
              aria-label="Pulse"
              className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
            <label className="inline-flex items-center gap-1.5 text-xs text-[#4B6157] cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={crf.onAntiHtnMeds}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, onAntiHtnMeds: e.target.checked }))
                }
                className="accent-[#047857]"
              />
              <span>On anti-HTN</span>
            </label>
          </div>
        </div>
      </div>

      <SectionAttachmentBar
        sectionKey="vitals"
        sectionLabel="Measurements & Vitals"
        attachments={crf.attachments}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
        onAIExtract={onAIExtract}
        aiBusy={aiBusy}
      />
    </div>
  );
};
