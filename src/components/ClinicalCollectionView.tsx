import React, { useRef, useState } from 'react';
import { Sparkles, Save, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import type { AttachmentFile, Gender, PatientCRF } from '../types/clinical';
import { recalculatePatientCRF } from '../utils/clinicalMath';
import { parseJsonSafe } from '../utils/http';
import { PatientInfoTab } from './patient-form/PatientInfoTab';
import { Dds17Tab } from './patient-form/Dds17Tab';
import { BlueIndexSection } from './patient-form/BlueIndexSection';
import { KomplicationsScoreSection } from './patient-form/KomplicationsScoreSection';
import { VitalsTab } from './patient-form/VitalsTab';
import { LabsTab } from './patient-form/LabsTab';
import { MedicationsTab } from './patient-form/MedicationsTab';
import { RemainingDataTab } from './patient-form/RemainingDataTab';
import { DoubleConfirmDeleteModal } from './DoubleConfirmDeleteModal';

export type FormTabKey =
  | 'info'
  | 'dds17'
  | 'komplications'
  | 'vitals'
  | 'labs'
  | 'medications'
  | 'remaining';

interface ClinicalCollectionViewProps {
  crf: PatientCRF;
  existingParticipantIds: string[];
  isEditing: boolean;
  initialTab?: FormTabKey;
  onUpdateCrf: (next: PatientCRF) => void;
  onSavePatient: (finalCrf: PatientCRF) => Promise<void>;
  onCancel: () => void;
}

export const ClinicalCollectionView: React.FC<ClinicalCollectionViewProps> = ({
  crf,
  existingParticipantIds,
  isEditing,
  initialTab = 'info',
  onUpdateCrf,
  onSavePatient,
  onCancel,
}) => {
  const [activeTab, setActiveTab] = useState<FormTabKey>(initialTab);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingDeleteAttachmentId, setPendingDeleteAttachmentId] = useState<string | null>(null);
  const topAiUploadRef = useRef<HTMLInputElement>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  const applyCrfChange = (updater: (prev: PatientCRF) => PatientCRF) => {
    const updated = recalculatePatientCRF(updater(crf));
    onUpdateCrf(updated);
  };

  const handleGenderOrDateChange = (gender: Gender, recruitmentDate: string) => {
    applyCrfChange((prev) => ({
      ...prev,
      gender,
      dateOfRecruitment: recruitmentDate,
    }));
  };

  const handleAddAttachment = (file: AttachmentFile) => {
    applyCrfChange((prev) => ({
      ...prev,
      attachments: [...prev.attachments, file],
    }));
  };

  const handleRemoveAttachment = (id: string) => {
    setPendingDeleteAttachmentId(id);
  };

  const confirmRemoveAttachment = () => {
    if (!pendingDeleteAttachmentId) return;
    const id = pendingDeleteAttachmentId;
    applyCrfChange((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((a) => a.id !== id),
    }));
    setPendingDeleteAttachmentId(null);
  };

  const pendingAttachment = pendingDeleteAttachmentId
    ? crf.attachments.find((a) => a.id === pendingDeleteAttachmentId) || null
    : null;

  const handleAIExtract = async (base64Data: string, mimeType: string, sectionLabel: string) => {
    setAiBusy(true);
    setBanner(null);
    try {
      const res = await fetch('/api/ai/extract-crf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64Data,
          mimeType,
          targetSection: sectionLabel,
        }),
      });
      const data = await parseJsonSafe<Record<string, any>>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'Extraction service returned an unexpected response.');
      }

      applyCrfChange((prev) => {
        const next: PatientCRF = { ...prev };
        if (data.patientName && !next.patientName) next.patientName = data.patientName;
        if (data.uhid && !next.uhid) next.uhid = data.uhid;
        if (data.contactNumber && !next.contactNumber) next.contactNumber = data.contactNumber;
        if (typeof data.sbp === 'number') next.sbp = data.sbp;
        if (typeof data.dbp === 'number') next.dbp = data.dbp;
        if (typeof data.pulse === 'number') next.pulse = data.pulse;
        if (typeof data.heightCm === 'number') {
          next.heightValue = data.heightCm;
          next.heightUnit = 'cm';
        }
        if (typeof data.weightKg === 'number') {
          next.weightValue = data.weightKg;
          next.weightUnit = 'kg';
        }
        if (typeof data.fbg === 'number') next.fbg = { ...next.fbg, value: data.fbg };
        if (typeof data.ppbg === 'number') next.ppbg = { ...next.ppbg, value: data.ppbg };
        if (typeof data.rbs === 'number') next.rbs = { ...next.rbs, value: data.rbs };
        if (typeof data.hba1c1 === 'number') next.hba1c1 = { ...next.hba1c1, value: data.hba1c1 };
        if (typeof data.hba1c2 === 'number') next.hba1c2 = { ...next.hba1c2, value: data.hba1c2 };
        if (typeof data.totalCholesterol === 'number')
          next.totalCholesterol = { ...next.totalCholesterol, value: data.totalCholesterol };
        if (typeof data.triglycerides === 'number')
          next.triglycerides = { ...next.triglycerides, value: data.triglycerides };
        if (typeof data.hdl === 'number') next.hdl = { ...next.hdl, value: data.hdl };
        if (typeof data.ldl === 'number') next.ldl = { ...next.ldl, value: data.ldl };
        if (typeof data.hemoglobin === 'number')
          next.hemoglobin = { ...next.hemoglobin, value: data.hemoglobin };
        if (typeof data.mcv === 'number') next.mcv = { ...next.mcv, value: data.mcv };
        if (typeof data.mch === 'number') next.mch = { ...next.mch, value: data.mch };
        if (typeof data.mchc === 'number') next.mchc = { ...next.mchc, value: data.mchc };
        if (typeof data.platelets === 'number')
          next.platelets = { ...next.platelets, value: data.platelets };
        if (typeof data.totalCount === 'number')
          next.totalCount = { ...next.totalCount, value: data.totalCount };
        if (typeof data.serumCreatinine === 'number')
          next.serumCreatinine = { ...next.serumCreatinine, value: data.serumCreatinine };
        if (typeof data.uacr === 'number') next.uacr = { ...next.uacr, value: data.uacr };
        if (typeof data.ast === 'number') next.ast = { ...next.ast, value: data.ast };
        if (typeof data.alt === 'number') next.alt = { ...next.alt, value: data.alt };
        if (typeof data.cPeptide === 'number')
          next.cPeptide = { ...next.cPeptide, value: data.cPeptide };
        if (typeof data.fastingInsulin === 'number')
          next.fastingInsulin = { ...next.fastingInsulin, value: data.fastingInsulin };
        if (typeof data.lsmKpa === 'number') next.lsmKpa = data.lsmKpa;
        if (typeof data.capDbm === 'number') next.capDbm = data.capDbm;
        if (Array.isArray(data.medications) && data.medications.length > 0) {
          const extractedRows = data.medications.map((m: Record<string, string>, idx: number) => ({
            id: `ai-med-${Date.now()}-${idx}`,
            drugName: m.drugName || '',
            dose: m.dose || '',
            route: m.route || '',
            frequency: m.frequency || '',
            status: '' as const,
          }));
          if (next.medicationVisits.length > 0) {
            const firstVisit = next.medicationVisits[0];
            const cleanExisting = firstVisit.drugs.filter((d) => d.drugName.trim() !== '');
            next.medicationVisits = [
              { ...firstVisit, drugs: [...cleanExisting, ...extractedRows] },
              ...next.medicationVisits.slice(1),
            ];
          }
        }
        return next;
      });

      setBanner({
        type: 'success',
        text: `Autofilled extracted values from ${sectionLabel}${
          data.summary ? `: ${data.summary}` : '.'
        }`,
      });
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'AI extraction failed.',
      });
    } finally {
      setAiBusy(false);
    }
  };

  const handleTopAiFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (dataUrl.includes(',')) {
        handleAIExtract(dataUrl.split(',')[1], file.type || 'image/jpeg', 'Full Clinical Document');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Auto-advance on Enter key inside inputs
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!autoAdvance || e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    e.preventDefault();
    const focusables = Array.from(
      formContainerRef.current?.querySelectorAll<HTMLElement>(
        'input:not([type="hidden"]):not([readonly]):not([disabled]), select:not([disabled])'
      ) || []
    );
    const idx = focusables.indexOf(target);
    if (idx >= 0 && idx + 1 < focusables.length) {
      focusables[idx + 1].focus();
    }
  };

  const handleSave = async () => {
    if (!crf.patientName.trim()) {
      setBanner({ type: 'error', text: 'Please enter the Patient Name before saving.' });
      setActiveTab('info');
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      await onSavePatient(recalculatePatientCRF(crf));
      setBanner({ type: 'success', text: 'Patient CRF saved successfully.' });
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save patient CRF.',
      });
    } finally {
      setSaving(false);
    }
  };

  const TABS: Array<{ key: FormTabKey; label: string }> = [
    { key: 'info', label: 'Patient Information' },
    { key: 'dds17', label: 'DDS-17' },
    { key: 'komplications', label: 'Blue Index & Komplication Score' },
    { key: 'vitals', label: 'Measurements & Vitals' },
    { key: 'labs', label: 'Lab Investigation' },
    { key: 'medications', label: 'Medication' },
    { key: 'remaining', label: 'Remaining Data' },
  ];

  return (
    <div ref={formContainerRef} onKeyDown={handleFormKeyDown} className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-[#DDE8E2] rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-xl border border-[#DDE8E2] hover:bg-[#F6F9F7] text-[#4B6157]"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="font-display text-lg font-bold text-[#14201B]">
              Clinical Data Collection
            </h2>
            <div className="text-xs text-[#4B6157] font-mono">
              {crf.uhid ? `UHID ${crf.uhid} · ` : ''}
              {crf.patientName || 'New Participant'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-[#4B6157] px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] cursor-pointer">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(e) => setAutoAdvance(e.target.checked)}
              className="accent-[#047857]"
            />
            <span>Auto-Advance (Enter)</span>
          </label>

          <input
            ref={topAiUploadRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={handleTopAiFile}
          />
          <button
            type="button"
            onClick={() => topAiUploadRef.current?.click()}
            disabled={aiBusy}
            className="px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-xs font-semibold text-[#053B2B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-4 h-4 text-[#047857]" />
            <span>{aiBusy ? 'Autofilling...' : 'AI Photo / File Upload & Autofill'}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : isEditing ? 'Update Record' : 'Save Patient'}</span>
          </button>
        </div>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* 5-Tab Bar */}
      <div
        role="tablist"
        aria-label="Clinical data collection tabs"
        className="flex flex-wrap gap-1.5 p-1.5 bg-[#EFF5F1] border border-[#DDE8E2] rounded-2xl"
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white text-[#053B2B] shadow-sm'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'info' && (
        <PatientInfoTab
          crf={crf}
          onChange={applyCrfChange}
          onGenderOrDateChange={handleGenderOrDateChange}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          onAIExtract={handleAIExtract}
          aiBusy={aiBusy}
        />
      )}
      {activeTab === 'dds17' && (
        <Dds17Tab
          crf={crf}
          onChange={applyCrfChange}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
        />
      )}
      {activeTab === 'komplications' && (
        <div className="space-y-6">
          <KomplicationsScoreSection
            crf={crf}
            onChange={applyCrfChange}
            onAddAttachment={handleAddAttachment}
            onRemoveAttachment={handleRemoveAttachment}
            onAIExtract={handleAIExtract}
            aiBusy={aiBusy}
          />
          <BlueIndexSection crf={crf} onChange={applyCrfChange} />
        </div>
      )}
      {activeTab === 'vitals' && (
        <VitalsTab
          crf={crf}
          onChange={applyCrfChange}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          onAIExtract={handleAIExtract}
          aiBusy={aiBusy}
        />
      )}
      {activeTab === 'labs' && (
        <LabsTab
          crf={crf}
          onChange={applyCrfChange}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          onAIExtract={handleAIExtract}
          aiBusy={aiBusy}
          onSubmitPatient={handleSave}
          saving={saving}
        />
      )}
      {activeTab === 'medications' && (
        <MedicationsTab
          crf={crf}
          onChange={applyCrfChange}
          onAddAttachment={handleAddAttachment}
          onRemoveAttachment={handleRemoveAttachment}
          onAIExtract={handleAIExtract}
          aiBusy={aiBusy}
        />
      )}
      {activeTab === 'remaining' && (
        <RemainingDataTab
          crf={crf}
          onChange={applyCrfChange}
          onJumpToTab={(t) => setActiveTab(t)}
        />
      )}

      <DoubleConfirmDeleteModal
        open={Boolean(pendingAttachment)}
        title="Delete Attached Document?"
        itemName={pendingAttachment?.name || 'Attachment'}
        itemMeta={pendingAttachment ? `Section: ${pendingAttachment.section}` : undefined}
        description="This uploaded clinical document or prescription attachment will be removed from this participant's CRF."
        confirmLabel="Yes, Delete Attachment"
        onCancel={() => setPendingDeleteAttachmentId(null)}
        onConfirm={confirmRemoveAttachment}
      />
    </div>
  );
};
