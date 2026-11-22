import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AttachmentFile, ClusterType, LabMetric, PatientCRF } from '../../types/clinical';
import { SectionAttachmentBar } from './SectionAttachmentBar';

interface LabsTabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy: boolean;
  onSubmitPatient: () => void;
  saving: boolean;
}

interface LabRowProps {
  label: string;
  metric: LabMetric;
  units: string[];
  onUpdate: (next: LabMetric) => void;
  step?: string;
}

const LabRow: React.FC<LabRowProps> = ({ label, metric, units, onUpdate, step = '0.1' }) => (
  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center py-2 border-b border-[#EEF3F0] last:border-b-0">
    <div className="sm:col-span-4 text-xs font-medium text-[#14201B]">{label}</div>
    <div className="sm:col-span-3">
      <input
        type="date"
        value={metric.date}
        onChange={(e) => onUpdate({ ...metric, date: e.target.value })}
        aria-label={`${label} Date`}
        className="w-full px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-xs font-mono"
      />
    </div>
    <div className="sm:col-span-3">
      <input
        type="number"
        step={step}
        value={metric.value ?? ''}
        onChange={(e) =>
          onUpdate({
            ...metric,
            value: e.target.value === '' ? null : Number(e.target.value),
          })
        }
        placeholder="Value"
        aria-label={label}
        className="w-full px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
      />
    </div>
    <div className="sm:col-span-2">
      <select
        value={metric.unit}
        onChange={(e) => onUpdate({ ...metric, unit: e.target.value })}
        aria-label={`${label} Unit`}
        className="w-full px-2 py-1.5 border border-[#DDE8E2] rounded-lg text-xs bg-white font-mono"
      >
        {units.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  </div>
);

export const LabsTab: React.FC<LabsTabProps> = ({
  crf,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
  onSubmitPatient,
  saving,
}) => {
  const updateLab = (key: keyof PatientCRF, next: LabMetric) => {
    onChange((prev) => ({
      ...prev,
      [key]: next,
      ...(key === 'serumCreatinine' ? { ksMicroEgfrManualOverride: false } : {}),
      ...(key === 'uacr'
        ? { ksMicroUacrManualOverride: false, microalbuminManualOverride: false }
        : {}),
    }));
  };

  return (
    <div className="space-y-6">
      {/* 1. Glycemic Profile */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5">
        <h3 className="font-display text-base font-bold text-[#14201B] mb-3">
          1. Glycemic Profile
        </h3>
        <div>
          <LabRow
            label="Fasting Blood Glucose (FBG)"
            metric={crf.fbg}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('fbg', n)}
          />
          <LabRow
            label="Postprandial Blood Glucose (PPBG)"
            metric={crf.ppbg}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('ppbg', n)}
          />
          <LabRow
            label="Random Blood Sugar (RBS)"
            metric={crf.rbs}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('rbs', n)}
          />
          <LabRow
            label="1st HbA1c (Baseline)"
            metric={crf.hba1c1}
            units={['%', 'mmol/mol']}
            onUpdate={(n) => updateLab('hba1c1', n)}
          />
          <LabRow
            label="2nd HbA1c (Follow-up)"
            metric={crf.hba1c2}
            units={['%', 'mmol/mol']}
            onUpdate={(n) => updateLab('hba1c2', n)}
          />
        </div>
        <SectionAttachmentBar
          sectionKey="labGlycemic"
          sectionLabel="Glycemic Profile"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* 2. Beta-Cell Function & Insulin Resistance */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-[#14201B]">
              2. Beta-Cell Function &amp; Insulin Resistance
            </h3>
            <p className="text-xs text-[#4B6157]">
              Calculates HOMA-B and HOMA-IR automatically from C-Peptide or Fasting Insulin + FBG.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#4B6157]">HOMA Source:</span>
            {(['c-peptide', 'insulin'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, homaMethod: m }))}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                  crf.homaMethod === m
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B]'
                }`}
              >
                {m === 'c-peptide' ? 'C-Peptide' : 'Fasting Insulin'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <LabRow
            label="Stimulated / Fasting C-Peptide"
            metric={crf.cPeptide}
            units={['ng/mL', 'nmol/L', 'pmol/L']}
            step="0.01"
            onUpdate={(n) => updateLab('cPeptide', n)}
          />
          <LabRow
            label="Fasting Insulin"
            metric={crf.fastingInsulin}
            units={['µIU/mL', 'pmol/L']}
            step="0.1"
            onUpdate={(n) => updateLab('fastingInsulin', n)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#EEF3F0]">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              HOMA-B (%)
            </label>
            <input
              type="number"
              step="0.1"
              readOnly={!crf.homaManualOverride}
              value={crf.homaB ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  homaB: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="HOMA-B"
              className={`w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono font-semibold ${
                crf.homaManualOverride ? 'bg-white' : 'bg-[#F6F9F7] text-[#053B2B]'
              }`}
            />
            <p className="mt-1 text-[11px] font-mono text-[#6B8076]">
              {crf.homaMethod === 'c-peptide'
                ? 'Matthews: (360 × C-pep ng/mL) / (FPG − 63)'
                : 'Matthews: (360 × Insulin µIU/mL) / (FPG − 63)'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              {crf.homaMethod === 'c-peptide' ? 'HOMA-IR (CP)' : 'HOMA-IR'}
            </label>
            <input
              type="number"
              step="0.01"
              readOnly={!crf.homaManualOverride}
              value={crf.homaIR ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  homaIR: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="HOMA-IR"
              className={`w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono font-semibold ${
                crf.homaManualOverride ? 'bg-white' : 'bg-[#F6F9F7] text-[#053B2B]'
              }`}
            />
            <p className="mt-1 text-[11px] font-mono text-[#6B8076]">
              {crf.homaMethod === 'c-peptide'
                ? 'Oxford/Asian: (FPG mg/dL × C-pep ng/mL) / 115'
                : 'Matthews: (FPG mg/dL × Insulin µIU/mL) / 405'}
            </p>
          </div>
          <div className="flex items-center pb-2">
            <label className="inline-flex items-center gap-2 text-xs text-[#4B6157] cursor-pointer">
              <input
                type="checkbox"
                checked={crf.homaManualOverride}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, homaManualOverride: e.target.checked }))
                }
                className="accent-[#047857]"
              />
              <span>Manual HOMA Override</span>
            </label>
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="labBetaCell"
          sectionLabel="Beta-Cell Report"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* 3. Lipid Profile */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[#14201B]">3. Lipid Profile</h3>
          <label className="inline-flex items-center gap-2 text-xs text-[#4B6157] cursor-pointer">
            <input
              type="checkbox"
              checked={crf.onStatin}
              onChange={(e) => onChange((prev) => ({ ...prev, onStatin: e.target.checked }))}
              className="accent-[#047857]"
            />
            <span>On Statin Therapy</span>
          </label>
        </div>

        <div>
          <LabRow
            label="Total Cholesterol"
            metric={crf.totalCholesterol}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('totalCholesterol', n)}
          />
          <LabRow
            label="Triglycerides"
            metric={crf.triglycerides}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('triglycerides', n)}
          />
          <LabRow
            label="HDL Cholesterol"
            metric={crf.hdl}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('hdl', n)}
          />
          <LabRow
            label="LDL Cholesterol"
            metric={crf.ldl}
            units={['mg/dL', 'mmol/L']}
            onUpdate={(n) => updateLab('ldl', n)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 bg-[#F6F9F7] border border-[#DDE8E2] rounded-xl p-3 text-xs">
          <div>
            <span className="text-[#4B6157]">Non-HDL Cholesterol: </span>
            <span className="font-mono font-bold text-[#14201B]">
              {crf.nonHdl !== null ? `${crf.nonHdl} mg/dL` : '—'}
            </span>
          </div>
          <div>
            <span className="text-[#4B6157]">LDL / HDL Ratio: </span>
            <span className="font-mono font-bold text-[#14201B]">{crf.ldlHdlRatio ?? '—'}</span>
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="labLipids"
          sectionLabel="Lipid Profile"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* 4. Haematology */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5">
        <h3 className="font-display text-base font-bold text-[#14201B] mb-3">4. Haematology</h3>
        <div>
          <LabRow
            label="Hemoglobin (Hb)"
            metric={crf.hemoglobin}
            units={['g/dL', 'g/L']}
            onUpdate={(n) => updateLab('hemoglobin', n)}
          />
          <LabRow
            label="PCV (Hematocrit)"
            metric={crf.pcv ?? { date: '', value: null, unit: '%' }}
            units={['%']}
            onUpdate={(n) => updateLab('pcv', n)}
          />
          <LabRow
            label="MCV"
            metric={crf.mcv}
            units={['fL']}
            onUpdate={(n) => updateLab('mcv', n)}
          />
          <LabRow
            label="MCH"
            metric={crf.mch}
            units={['pg', 'g/dL']}
            onUpdate={(n) => updateLab('mch', n)}
          />
          <LabRow
            label="MCHC"
            metric={crf.mchc}
            units={['g/dL', '%']}
            onUpdate={(n) => updateLab('mchc', n)}
          />
          <LabRow
            label="Platelets"
            metric={crf.platelets}
            units={['10^3/µL', 'lakhs/mm³']}
            onUpdate={(n) => updateLab('platelets', n)}
          />
          <LabRow
            label="Total Count (TC / WBC)"
            metric={crf.totalCount}
            units={['cells/mm³', '10^9/L']}
            step="1"
            onUpdate={(n) => updateLab('totalCount', n)}
          />
        </div>
        <SectionAttachmentBar
          sectionKey="labHaematology"
          sectionLabel="Haematology"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* 5. Hepatic & Renal Parameters */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-[#14201B]">
          5. Hepatic &amp; Renal Parameters
        </h3>
        <div>
          <LabRow
            label="Serum Creatinine"
            metric={crf.serumCreatinine}
            units={['mg/dL', 'µmol/L']}
            step="0.01"
            onUpdate={(n) => updateLab('serumCreatinine', n)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center py-2 border-b border-[#EEF3F0]">
            <div className="sm:col-span-4 text-xs font-medium text-[#14201B]">
              eGFR (CKD-EPI 2021)
            </div>
            <div className="sm:col-span-3">
              <label className="inline-flex items-center gap-1.5 text-xs text-[#4B6157] cursor-pointer">
                <input
                  type="checkbox"
                  checked={crf.egfrManualOverride}
                  onChange={(e) =>
                    onChange((prev) => ({ ...prev, egfrManualOverride: e.target.checked }))
                  }
                  className="accent-[#047857]"
                />
                <span>Manual eGFR</span>
              </label>
            </div>
            <div className="sm:col-span-3">
              <input
                type="number"
                readOnly={!crf.egfrManualOverride}
                value={crf.egfr ?? ''}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    egfr: e.target.value === '' ? null : Number(e.target.value),
                  }))
                }
                aria-label="eGFR"
                className={`w-full px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono font-semibold ${
                  crf.egfrManualOverride ? 'bg-white' : 'bg-[#F6F9F7] text-[#053B2B]'
                }`}
              />
            </div>
            <div className="sm:col-span-2 text-xs font-mono text-[#4B6157]">mL/min/1.73m²</div>
          </div>

          <LabRow
            label="Urinary Albumin / UACR"
            metric={crf.uacr}
            units={['mg/g', 'mg/L']}
            onUpdate={(n) => updateLab('uacr', n)}
          />

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center py-2 border-b border-[#EEF3F0]">
            <div className="sm:col-span-4 text-xs font-medium text-[#14201B]">
              Microalbuminuria Status
            </div>
            <div className="sm:col-span-8 flex flex-wrap items-center gap-2">
              {(['Normoalbuminuria', 'Microalbuminuria', 'Macroalbuminuria'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        microalbuminStatus: st,
                        microalbuminManualOverride: true,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                      crf.microalbuminStatus === st
                        ? 'bg-[#047857] text-white border-[#047857]'
                        : 'bg-white border-[#DDE8E2] text-[#14201B]'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
              {crf.microalbuminManualOverride && crf.uacr.value !== null && (
                <button
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({ ...prev, microalbuminManualOverride: false }))
                  }
                  className="text-[11px] font-semibold text-[#047857] hover:underline ml-1"
                >
                  Sync from UACR
                </button>
              )}
            </div>
          </div>

          <LabRow
            label="Urine Glucose"
            metric={crf.urineGlucose}
            units={['mg/dL', 'mmol/L', '+/-']}
            onUpdate={(n) => updateLab('urineGlucose', n)}
          />
          <LabRow
            label="Epithelial Cells"
            metric={crf.epithelialCells}
            units={['/HPF']}
            onUpdate={(n) => updateLab('epithelialCells', n)}
          />
          <LabRow
            label="Liver Function — AST / SGOT"
            metric={crf.ast}
            units={['U/L']}
            onUpdate={(n) => updateLab('ast', n)}
          />
          <LabRow
            label="Liver Function — ALT / SGPT"
            metric={crf.alt}
            units={['U/L']}
            onUpdate={(n) => updateLab('alt', n)}
          />
        </div>

        <SectionAttachmentBar
          sectionKey="labRenalHepatic"
          sectionLabel="Hepatic & Renal Reports"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* 6. FibroScan */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-[#14201B]">6. FibroScan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              FibroScan Overall Header / Notes
            </label>
            <input
              type="text"
              value={crf.fibroScanNotes}
              onChange={(e) => onChange((prev) => ({ ...prev, fibroScanNotes: e.target.value }))}
              placeholder="Probe used (M/XL), clinical remarks"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Date of FibroScan
            </label>
            <input
              type="date"
              value={crf.fibroScanDate}
              onChange={(e) => onChange((prev) => ({ ...prev, fibroScanDate: e.target.value }))}
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Fasting Duration (hours)
            </label>
            <input
              type="number"
              value={crf.fastingDurationHours ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  fastingDurationHours: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              LSM / Liver Stiffness (kPa)
            </label>
            <input
              type="number"
              step="0.1"
              value={crf.lsmKpa ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  lsmKpa: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">CAP (dB/m)</label>
            <input
              type="number"
              value={crf.capDbm ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  capDbm: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">IQR (kPa)</label>
            <input
              type="number"
              step="0.1"
              value={crf.iqr ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  iqr: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              IQR / Median (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={crf.iqrMedianPct ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  iqrMedianPct: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Valid Measurements
            </label>
            <input
              type="number"
              value={crf.validMeasurements ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  validMeasurements: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Success Rate (%)
            </label>
            <input
              type="number"
              value={crf.successRatePct ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  successRatePct: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Fibrosis Interpretation
            </label>
            <select
              value={crf.fibrosisInterpretation}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  fibrosisInterpretation: e.target.value as PatientCRF['fibrosisInterpretation'],
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm bg-white font-mono"
            >
              <option value="">Select F-stage</option>
              <option value="F0-F1">F0-F1 (No/Mild Fibrosis)</option>
              <option value="F2">F2 (Significant Fibrosis)</option>
              <option value="F3">F3 (Advanced Fibrosis)</option>
              <option value="F4">F4 (Cirrhosis)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Steatosis Interpretation
            </label>
            <select
              value={crf.steatosisInterpretation}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  steatosisInterpretation: e.target.value as PatientCRF['steatosisInterpretation'],
                }))
              }
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm bg-white font-mono"
            >
              <option value="">Select S-stage</option>
              <option value="S0">S0 (&lt;238 dB/m)</option>
              <option value="S1">S1 (238–259 dB/m)</option>
              <option value="S2">S2 (260–289 dB/m)</option>
              <option value="S3">S3 (≥290 dB/m)</option>
            </select>
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="labFibroScan"
          sectionLabel="FibroScan Report"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* Live Lab Auto-Calculated Blue Index & Komplications Score Summary */}
      <section
        data-testid="labs-auto-score-preview"
        className="bg-[#FAFDFB] border border-[#DDE8E2] rounded-2xl p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-[#14201B]">
              Auto-Calculated Blue Index (DHS) &amp; Komplications Score (KS) from Laboratory Data
            </h3>
            <p className="text-xs text-[#4B6157]">
              HbA1c, Lipid Profile, eGFR &amp; UACR automatically update DHS Domains (A, C) and KS Microvascular Tiers.
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold tabular-nums">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-[#DDE8E2] text-[#14201B]">
              DHS: {crf.dhsTotal ?? '—'} / 50
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-white border border-[#DDE8E2] text-[#14201B]">
              KS: {crf.ksTotal ?? '—'} / 15
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-[#053B2B] text-white">
              BI: {crf.blueIndexRatio}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          <div className="p-3 rounded-xl border border-[#DDE8E2] bg-white">
            <div className="text-[11px] text-[#4B6157]">DHS Domain A (HbA1c)</div>
            <div className="font-mono text-base font-bold text-[#047857] tabular-nums mt-0.5">
              {crf.dhsDomains.A ?? '—'} / 5
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#DDE8E2] bg-white">
            <div className="text-[11px] text-[#4B6157]">DHS Domain C (Lipids)</div>
            <div className="font-mono text-base font-bold text-[#047857] tabular-nums mt-0.5">
              {crf.dhsDomains.C ?? '—'} / 5
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#DDE8E2] bg-white">
            <div className="text-[11px] text-[#4B6157]">KS eGFR Tier</div>
            <div className="font-mono text-base font-bold text-[#14201B] tabular-nums mt-0.5">
              {crf.ksMicroEgfrTier ?? '—'} / 5
              <span className="text-[11px] font-normal text-[#4B6157] ml-1.5">
                ({crf.egfr ?? '—'})
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#DDE8E2] bg-white">
            <div className="text-[11px] text-[#4B6157]">KS UACR Tier</div>
            <div className="font-mono text-base font-bold text-[#14201B] tabular-nums mt-0.5">
              {crf.ksMicroUacrTier ?? '—'} / 5
              <span className="text-[11px] font-normal text-[#4B6157] ml-1.5">
                ({crf.uacr.value ?? '—'})
              </span>
            </div>
          </div>
          <div className="p-3 rounded-xl border border-[#DDE8E2] bg-[#ECFDF5]">
            <div className="text-[11px] font-medium text-[#053B2B]">KS Microvascular (M)</div>
            <div className="font-mono text-base font-bold text-[#047857] tabular-nums mt-0.5">
              {crf.ksMicrovascular ?? '—'} / 5
            </div>
          </div>
        </div>
      </section>

      {/* 7. Phenotypic Cluster Assignment & Submit */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#4B6157] uppercase tracking-wider">
            Final Phenotypic Subclassification
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={crf.clusterType}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  clusterType: e.target.value as ClusterType | '',
                }))
              }
              aria-label="Assigned T2DM Phenotype Cluster"
              className="px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono font-bold text-[#053B2B] bg-[#F6F9F7]"
            >
              <option value="">Select cluster (optional)</option>
              <option value="SIDD">SIDD — Severe Insulin-Deficient Diabetes</option>
              <option value="SIRD">SIRD — Severe Insulin-Resistant Diabetes</option>
              <option value="CIRDD">CIRDD — Combined Insulin-Resistant &amp; Deficient Diabetes</option>
              <option value="MARD">MARD — Mild Age-Related Diabetes</option>
            </select>
            <span className="text-xs text-[#4B6157]">
              Model suggestion:{' '}
              <strong className="font-mono">{crf.suggestedCluster || '—'}</strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSubmitPatient}
          disabled={saving}
          className="px-6 py-3 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>{saving ? 'Submitting...' : 'Submit Data'}</span>
        </button>
      </section>
    </div>
  );
};
