import React from 'react';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import type { PatientCRF } from '../../types/clinical';
import { evaluateMissingDataAndStatus } from '../../utils/clinicalMath';

interface RemainingDataTabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onJumpToTab: (
    tab: 'info' | 'dds17' | 'komplications' | 'vitals' | 'labs' | 'medications'
  ) => void;
}

export const RemainingDataTab: React.FC<RemainingDataTabProps> = ({
  crf,
  onChange,
  onJumpToTab,
}) => {
  const { missingFields } = evaluateMissingDataAndStatus(crf);

  const renderDirectEditor = (key: string) => {
    switch (key) {
      case 'patientName':
        return (
          <input
            type="text"
            value={crf.patientName}
            onChange={(e) => onChange((p) => ({ ...p, patientName: e.target.value }))}
            placeholder="Enter patient name"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm"
          />
        );
      case 'uhid':
        return (
          <input
            type="text"
            value={crf.uhid}
            onChange={(e) => onChange((p) => ({ ...p, uhid: e.target.value }))}
            placeholder="Enter UHID"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'dob':
        return (
          <input
            type="date"
            value={crf.dob}
            onChange={(e) => onChange((p) => ({ ...p, dob: e.target.value }))}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'contactNumber':
        return (
          <input
            type="tel"
            maxLength={10}
            value={crf.contactNumber}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                contactNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
              }))
            }
            placeholder="10-digit mobile"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'bloodGroup':
        return (
          <select
            value={crf.bloodGroup}
            onChange={(e) => onChange((p) => ({ ...p, bloodGroup: e.target.value }))}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm bg-white"
          >
            <option value="">Select blood group</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        );
      case 'diagnosisMonthYear':
        return (
          <input
            type="month"
            value={crf.diagnosisMonthYear}
            onChange={(e) => onChange((p) => ({ ...p, diagnosisMonthYear: e.target.value }))}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'familyHistoryDM':
        return (
          <select
            value={crf.familyHistoryDM}
            onChange={(e) =>
              onChange((p) => ({ ...p, familyHistoryDM: e.target.value as 'Yes' | 'No' | '' }))
            }
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm bg-white"
          >
            <option value="">Select</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        );
      case 'heightValue':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.heightValue ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                heightValue: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder={`Height (${crf.heightUnit})`}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'weightValue':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.weightValue ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                weightValue: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder={`Weight (${crf.weightUnit})`}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'waistValue':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.waistValue ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                waistValue: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder={`Waist (${crf.waistUnit})`}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'hipValue':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.hipValue ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                hipValue: e.target.value === '' ? null : Number(e.target.value),
              }))
            }
            placeholder={`Hip (${crf.hipUnit})`}
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'bp':
        return (
          <div className="flex gap-2">
            <input
              type="number"
              value={crf.sbp ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  sbp: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="SBP"
              className="w-1/2 px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
            />
            <input
              type="number"
              value={crf.dbp ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  dbp: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="DBP"
              className="w-1/2 px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
            />
          </div>
        );
      case 'fbg':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.fbg.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                fbg: { ...p.fbg, value: e.target.value === '' ? null : Number(e.target.value) },
              }))
            }
            placeholder="FBG (mg/dL)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'ppbg':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.ppbg.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                ppbg: { ...p.ppbg, value: e.target.value === '' ? null : Number(e.target.value) },
              }))
            }
            placeholder="PPBG (mg/dL)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'hba1c1':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.hba1c1.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                hba1c1: {
                  ...p.hba1c1,
                  value: e.target.value === '' ? null : Number(e.target.value),
                },
              }))
            }
            placeholder="1st HbA1c (%)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'hba1c2':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.hba1c2.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                hba1c2: {
                  ...p.hba1c2,
                  value: e.target.value === '' ? null : Number(e.target.value),
                },
              }))
            }
            placeholder="2nd HbA1c (%)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'betaCell':
        return (
          <input
            type="number"
            step="0.01"
            value={crf.cPeptide.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                cPeptide: {
                  ...p.cPeptide,
                  value: e.target.value === '' ? null : Number(e.target.value),
                },
              }))
            }
            placeholder="C-Peptide (ng/mL)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'fibroScan':
        return (
          <div className="flex gap-2">
            <input
              type="number"
              step="0.1"
              value={crf.lsmKpa ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  lsmKpa: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="LSM (kPa)"
              className="w-1/2 px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
            />
            <input
              type="number"
              value={crf.capDbm ?? ''}
              onChange={(e) =>
                onChange((p) => ({
                  ...p,
                  capDbm: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="CAP (dB/m)"
              className="w-1/2 px-2.5 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
            />
          </div>
        );
      case 'serumCreatinine':
        return (
          <input
            type="number"
            step="0.01"
            value={crf.serumCreatinine.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                serumCreatinine: {
                  ...p.serumCreatinine,
                  value: e.target.value === '' ? null : Number(e.target.value),
                },
              }))
            }
            placeholder="Creatinine (mg/dL)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      case 'uacr':
        return (
          <input
            type="number"
            step="0.1"
            value={crf.uacr.value ?? ''}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                uacr: { ...p.uacr, value: e.target.value === '' ? null : Number(e.target.value) },
              }))
            }
            placeholder="UACR (mg/g)"
            className="w-full px-3 py-1.5 border border-[#DDE8E2] rounded-lg text-sm font-mono"
          />
        );
      default:
        return (
          <button
            type="button"
            onClick={() => onJumpToTab(missingFields.find((m) => m.key === key)?.tab || 'info')}
            className="px-3 py-1.5 rounded-lg border border-[#047857] text-[#047857] hover:bg-emerald-50 text-xs font-medium inline-flex items-center gap-1"
          >
            <span>Open Section</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        );
    }
  };

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-[#14201B]">
            Remaining Data — Unfilled Fields
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Values entered directly here automatically synchronize with Patient Information, DDS-17,
            Blue Index &amp; Komplication Score, Measurements &amp; Vitals, Lab Investigation, and
            Medication tabs.
          </p>
        </div>
        <span className="font-mono text-xs font-semibold px-3 py-1 rounded-lg bg-[#F6F9F7] border border-[#DDE8E2] text-[#14201B]">
          {missingFields.length} Remaining
        </span>
      </div>

      {missingFields.length === 0 ? (
        <div className="p-8 rounded-xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <div className="font-display font-bold text-emerald-900">
            All CRF Fields Complete
          </div>
          <p className="text-xs text-emerald-800">
            Every baseline, anthropometric, laboratory, FibroScan, Blue Index, DDS-17, and
            medication field has been filled.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[#EEF3F0] border border-[#DDE8E2] rounded-xl overflow-hidden">
          {missingFields.map((item) => (
            <div
              key={item.key}
              className="p-3.5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center bg-white"
            >
              <div className="md:col-span-5">
                <div className="text-sm font-medium text-[#14201B]">{item.label}</div>
                <div className="text-xs text-[#6B8076]">{item.section}</div>
              </div>
              <div className="md:col-span-5">{renderDirectEditor(item.key)}</div>
              <div className="md:col-span-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onJumpToTab(item.tab)}
                  className="text-xs font-medium text-[#047857] hover:underline whitespace-nowrap"
                >
                  Go to tab →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
