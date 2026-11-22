import React, { useRef, useState } from 'react';
import { Plus, Trash2, Sparkles } from 'lucide-react';
import type { AttachmentFile, MedicationRow, PatientCRF } from '../../types/clinical';
import { SectionAttachmentBar } from './SectionAttachmentBar';
import { DoubleConfirmDeleteModal } from '../DoubleConfirmDeleteModal';

interface MedicationsTabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy: boolean;
}

const COMMON_ANTIDIABETICS = [
  'Metformin',
  'Glimepiride',
  'Gliclazide',
  'Sitagliptin',
  'Vildagliptin',
  'Teneligliptin',
  'Linagliptin',
  'Dapagliflozin',
  'Empagliflozin',
  'Remogliflozin',
  'Pioglitazone',
  'Voglibose',
  'Semaglutide',
  'Liraglutide',
  'Insulin Glargine',
  'Insulin Degludec',
  'Insulin Aspart',
  'Premix Insulin 30/70',
  'Regular Insulin',
];

export const MedicationsTab: React.FC<MedicationsTabProps> = ({
  crf,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
}) => {
  const aiPrescInput = useRef<HTMLInputElement>(null);
  const [pendingDeleteMed, setPendingDeleteMed] = useState<
    | { kind: 'visitDrug'; visitId: string; drugId: string; name: string; meta?: string }
    | { kind: 'otherMed'; medId: string; name: string; meta?: string }
    | null
  >(null);

  const handleUploadPrescription = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      onAddAttachment({
        id: `med-${Date.now()}`,
        name: file.name,
        section: 'medications',
        dataUrl,
        uploadedAt: new Date().toISOString(),
      });
      if (dataUrl.includes(',')) {
        onAIExtract(dataUrl.split(',')[1], file.type || 'image/jpeg', 'Medication Prescription');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const addVisitBlock = () => {
    onChange((prev) => ({
      ...prev,
      medicationVisits: [
        ...prev.medicationVisits,
        {
          id: `visit-${Date.now()}`,
          visitDate: '',
          hba1cAtVisit: '',
          drugs: [
            {
              id: `drug-${Date.now()}`,
              drugName: '',
              dose: '',
              route: '',
              frequency: '',
              startDuration: '',
              status: '',
            },
          ],
        },
      ],
    }));
  };

  const addDrugToVisit = (visitId: string) => {
    onChange((prev) => ({
      ...prev,
      medicationVisits: prev.medicationVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              drugs: [
                ...v.drugs,
                {
                  id: `drug-${Date.now()}-${Math.random()}`,
                  drugName: '',
                  dose: '',
                  route: '',
                  frequency: '',
                  startDuration: '',
                  status: '',
                },
              ],
            }
          : v
      ),
    }));
  };

  const updateDrug = (
    visitId: string,
    drugId: string,
    field: keyof MedicationRow,
    val: string
  ) => {
    onChange((prev) => ({
      ...prev,
      medicationVisits: prev.medicationVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              drugs: v.drugs.map((d) => (d.id === drugId ? { ...d, [field]: val } : d)),
            }
          : v
      ),
    }));
  };

  const removeDrug = (visitId: string, drugId: string) => {
    onChange((prev) => ({
      ...prev,
      medicationVisits: prev.medicationVisits.map((v) =>
        v.id === visitId ? { ...v, drugs: v.drugs.filter((d) => d.id !== drugId) } : v
      ),
    }));
  };

  const confirmDeleteMed = () => {
    if (!pendingDeleteMed) return;
    if (pendingDeleteMed.kind === 'visitDrug') {
      removeDrug(pendingDeleteMed.visitId, pendingDeleteMed.drugId);
    } else {
      const targetId = pendingDeleteMed.medId;
      onChange((prev) => ({
        ...prev,
        otherMedications: prev.otherMedications.filter((m) => m.id !== targetId),
      }));
    }
    setPendingDeleteMed(null);
  };

  const addOtherMedication = () => {
    onChange((prev) => ({
      ...prev,
      otherMedications: [
        ...prev.otherMedications,
        {
          id: `other-${Date.now()}`,
          drugName: '',
          dose: '',
          route: '',
          frequency: '',
          status: '',
        },
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <input
        ref={aiPrescInput}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleUploadPrescription}
      />

      {/* Antidiabetic Medication Blocks */}
      {crf.medicationVisits.map((visit, vIdx) => (
        <section key={visit.id} className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#14201B]">
              Antidiabetic Medication — Visit {vIdx + 1}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => aiPrescInput.current?.click()}
                disabled={aiBusy}
                className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-[#053B2B] inline-flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
                <span>{aiBusy ? 'Reading Rx...' : 'AI Upload'}</span>
              </button>
              <button
                type="button"
                onClick={() => addDrugToVisit(visit.id)}
                className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-medium inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Drug</span>
              </button>
            </div>
          </div>

          <datalist id="antidiabetic-drugs">
            {COMMON_ANTIDIABETICS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>

          <div className="space-y-2.5">
            {visit.drugs.map((drug) => (
              <div
                key={drug.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-[#FAFDFB] p-2.5 rounded-xl border border-[#EEF3F0]"
              >
                <div className="sm:col-span-3">
                  <input
                    type="text"
                    list="antidiabetic-drugs"
                    value={drug.drugName}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'drugName', e.target.value)}
                    placeholder="Generic drug name"
                    aria-label="Drug Name"
                    className="w-full px-3 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={drug.dose}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'dose', e.target.value)}
                    placeholder="Dose (e.g. 500mg)"
                    aria-label="Dose"
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-sm font-mono bg-white"
                  />
                </div>
                <div className="sm:col-span-1">
                  <select
                    value={drug.route}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'route', e.target.value)}
                    aria-label="Route"
                    className="w-full px-2 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white"
                  >
                    <option value="">—</option>
                    <option value="Oral">Oral</option>
                    <option value="SC">SC</option>
                    <option value="IV">IV</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <select
                    value={drug.frequency}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'frequency', e.target.value)}
                    aria-label="Frequency"
                    className="w-full px-2 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white font-mono"
                  >
                    <option value="">—</option>
                    <option value="OD">OD</option>
                    <option value="BD">BD</option>
                    <option value="TDS">TDS</option>
                    <option value="QID">QID</option>
                    <option value="HS">HS</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={drug.startDuration || ''}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'startDuration', e.target.value)}
                    placeholder="Start / Duration"
                    aria-label="Start or Duration"
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-xs bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={drug.status || ''}
                    onChange={(e) => updateDrug(visit.id, drug.id, 'status', e.target.value)}
                    aria-label="Medication Status"
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-xs bg-white font-medium"
                  >
                    <option value="">—</option>
                    <option value="Current">Current</option>
                    <option value="Disc.">Disc.</option>
                  </select>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDeleteMed({
                        kind: 'visitDrug',
                        visitId: visit.id,
                        drugId: drug.id,
                        name: drug.drugName.trim() || `Medication Row (Visit ${vIdx + 1})`,
                        meta: [drug.dose, drug.route, drug.frequency].filter(Boolean).join(' · ') || undefined,
                      })
                    }
                    aria-label="Remove drug"
                    className="p-2 text-[#6B8076] hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#EEF3F0]">
            <div>
              <label className="block text-xs font-medium text-[#4B6157] mb-1">
                Prescription Date
              </label>
              <input
                type="date"
                value={visit.visitDate}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    medicationVisits: prev.medicationVisits.map((v) =>
                      v.id === visit.id ? { ...v, visitDate: e.target.value } : v
                    ),
                  }))
                }
                className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4B6157] mb-1">
                HbA1c at Visit (%)
              </label>
              <input
                type="text"
                value={visit.hba1cAtVisit}
                onChange={(e) =>
                  onChange((prev) => ({
                    ...prev,
                    medicationVisits: prev.medicationVisits.map((v) =>
                      v.id === visit.id ? { ...v, hba1cAtVisit: e.target.value } : v
                    ),
                  }))
                }
                placeholder="e.g. 8.4"
                className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
              />
            </div>
          </div>
        </section>
      ))}

      <div>
        <button
          type="button"
          onClick={addVisitBlock}
          className="px-4 py-2 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#F6F9F7] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 text-[#047857]" />
          <span>Add Follow-up Antidiabetic Regimen Block</span>
        </button>
      </div>

      {/* Other Medications */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-[#14201B]">
            Other Medications (Anti-HTN, Statins, Neuropathy, Antiplatelets)
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => aiPrescInput.current?.click()}
              disabled={aiBusy}
              className="px-3 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-medium text-[#053B2B] inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
              <span>AI Upload</span>
            </button>
            <button
              type="button"
              onClick={addOtherMedication}
              className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-medium inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Drug</span>
            </button>
          </div>
        </div>

        {crf.otherMedications.length === 0 ? (
          <div className="text-xs text-[#6B8076] py-3">
            No concomitant medications added yet. Click &ldquo;Add Drug&rdquo; to record statins,
            antihypertensives, or neuropathy drugs.
          </div>
        ) : (
          <div className="space-y-2.5">
            {crf.otherMedications.map((med) => (
              <div
                key={med.id}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center bg-[#FAFDFB] p-2.5 rounded-xl border border-[#EEF3F0]"
              >
                <div className="sm:col-span-5">
                  <input
                    type="text"
                    value={med.drugName}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        otherMedications: prev.otherMedications.map((m) =>
                          m.id === med.id ? { ...m, drugName: e.target.value } : m
                        ),
                      }))
                    }
                    placeholder="Drug name (e.g. Telmisartan)"
                    className="w-full px-3 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={med.dose}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        otherMedications: prev.otherMedications.map((m) =>
                          m.id === med.id ? { ...m, dose: e.target.value } : m
                        ),
                      }))
                    }
                    placeholder="Dose"
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-sm font-mono bg-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={med.route}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        otherMedications: prev.otherMedications.map((m) =>
                          m.id === med.id ? { ...m, route: e.target.value } : m
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white"
                  >
                    <option value="">—</option>
                    <option value="Oral">Oral</option>
                    <option value="SC">SC</option>
                    <option value="Topical">Topical</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <select
                    value={med.frequency}
                    onChange={(e) =>
                      onChange((prev) => ({
                        ...prev,
                        otherMedications: prev.otherMedications.map((m) =>
                          m.id === med.id ? { ...m, frequency: e.target.value } : m
                        ),
                      }))
                    }
                    className="w-full px-2.5 py-2 border border-[#DDE8E2] rounded-lg text-sm bg-white font-mono"
                  >
                    <option value="">—</option>
                    <option value="OD">OD</option>
                    <option value="BD">BD</option>
                    <option value="HS">HS</option>
                    <option value="SOS">SOS</option>
                  </select>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() =>
                      setPendingDeleteMed({
                        kind: 'otherMed',
                        medId: med.id,
                        name: med.drugName.trim() || 'Concomitant Medication',
                        meta: [med.dose, med.route, med.frequency].filter(Boolean).join(' · ') || undefined,
                      })
                    }
                    aria-label="Remove other medication"
                    className="p-2 text-[#6B8076] hover:text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <SectionAttachmentBar
          sectionKey="medications"
          sectionLabel="Medications"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      <DoubleConfirmDeleteModal
        open={Boolean(pendingDeleteMed)}
        title="Delete Medication Entry?"
        itemName={pendingDeleteMed?.name || 'Medication Entry'}
        itemMeta={pendingDeleteMed?.meta}
        description="This medication row will be permanently removed from the participant's CRF regimen record."
        confirmLabel="Yes, Delete Medication"
        onCancel={() => setPendingDeleteMed(null)}
        onConfirm={confirmDeleteMed}
      />
    </div>
  );
};
