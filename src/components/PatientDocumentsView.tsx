import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronRight,
  Download,
  ExternalLink,
  File,
  FileText,
  FolderOpen,
  HeartPulse,
  Image as ImageIcon,
  Maximize2,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { AttachmentFile, PatientCRF } from '../types/clinical';
import {
  buildPatientDocumentGroups,
  dataUrlToBlobUrl,
  decodeTextDataUrl,
  type DocumentKindFilter,
  type EnrichedPatientDocument,
  type PatientRosterFilter,
} from '../utils/patientDocuments';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface PatientDocumentsViewProps {
  patients: PatientCRF[];
  selectedParticipantId: string | null;
  onSelectParticipant: (patientKey: string) => void;
  onUpdatePatientInline: (patient: PatientCRF) => Promise<void>;
  onOpenProfile: (patient: PatientCRF) => void;
  onViewCRF: (patient: PatientCRF) => void;
  onEditPatient: (patient: PatientCRF) => void;
  onNewPatient: () => void;
}

const UPLOAD_SECTION_OPTIONS = [
  { value: 'labGlycemic', label: 'Glycemic Profile (HbA1c / Glucose)' },
  { value: 'labLipids', label: 'Lipid Profile' },
  { value: 'labRenalHepatic', label: 'Renal & Hepatic Panel' },
  { value: 'labFibroScan', label: 'FibroScan Report' },
  { value: 'medications', label: 'Medications & Prescription' },
  { value: 'vitals', label: 'Measurements & Vitals' },
  { value: 'sectionD', label: 'Komplications Score (KS)' },
  { value: 'patient-documents', label: 'General Clinical Document' },
];

function formatUploadDate(iso?: string): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const DocumentKindIcon: React.FC<{ kind: EnrichedPatientDocument['kind']; className?: string }> = ({
  kind,
  className = 'w-4 h-4',
}) => {
  if (kind === 'pdf') return <FileText className={className} />;
  if (kind === 'image') return <ImageIcon className={className} />;
  return <File className={className} />;
};

export const PatientDocumentsView: React.FC<PatientDocumentsViewProps> = ({
  patients,
  selectedParticipantId,
  onSelectParticipant,
  onUpdatePatientInline,
  onOpenProfile,
  onViewCRF,
  onEditPatient,
  onNewPatient,
}) => {
  const [search, setSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<PatientRosterFilter>('all');
  const [kindFilter, setKindFilter] = useState<DocumentKindFilter>('all');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [uploadSection, setUploadSection] = useState<string>('labGlycemic');
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [docZoom, setDocZoom] = useState(100);
  const [imageFailed, setImageFailed] = useState(false);
  const [activeBlobUrl, setActiveBlobUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerPaneRef = useRef<HTMLDivElement>(null);

  const allGroups = useMemo(() => buildPatientDocumentGroups(patients), [patients]);

  const filteredGroups = useMemo(
    () =>
      buildPatientDocumentGroups(patients, {
        search,
        rosterFilter,
        kindFilter,
      }),
    [patients, search, rosterFilter, kindFilter]
  );

  const cohortStats = useMemo(() => {
    const patientsWithDocs = allGroups.filter((g) => g.totalCount > 0).length;
    const totalDocs = allGroups.reduce((sum, g) => sum + g.totalCount, 0);
    const totalPdfs = allGroups.reduce((sum, g) => sum + g.pdfCount, 0);
    const totalImages = allGroups.reduce((sum, g) => sum + g.imageCount, 0);
    return { patientsWithDocs, totalDocs, totalPdfs, totalImages };
  }, [allGroups]);

  const activeGroup = useMemo(() => {
    if (filteredGroups.length === 0) return null;
    if (selectedParticipantId) {
      const matched = filteredGroups.find(
        (g) =>
          g.patientKey === selectedParticipantId ||
          (Boolean(g.patient.participantId) &&
            g.patient.participantId === selectedParticipantId)
      );
      if (matched) return matched;
    }
    return filteredGroups.find((g) => g.totalCount > 0) || filteredGroups[0];
  }, [filteredGroups, selectedParticipantId]);

  const activeDoc = useMemo(() => {
    if (!activeGroup || activeGroup.documents.length === 0) return null;
    if (selectedDocId) {
      const found = activeGroup.documents.find((d) => d.attachment.id === selectedDocId);
      if (found) return found;
    }
    return activeGroup.documents[0];
  }, [activeGroup, selectedDocId]);

  // Reset per-document UI controls when switching documents
  useEffect(() => {
    setConfirmDeleteId(null);
    setDocZoom(100);
    setImageFailed(false);
  }, [activeDoc?.attachment.id]);

  // Close fullscreen modal on Escape
  useEffect(() => {
    if (!fullscreenOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreenOpen]);

  // Create and revoke download Blob URL inside the same effect (React 19 StrictMode safe)
  useEffect(() => {
    if (!activeDoc?.hasPayload || !activeDoc.attachment.dataUrl) {
      setActiveBlobUrl(null);
      return;
    }
    const url = dataUrlToBlobUrl(activeDoc.attachment.dataUrl, activeDoc.attachment.name);
    setActiveBlobUrl(url);
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [activeDoc?.attachment.id, activeDoc?.attachment.dataUrl, activeDoc?.attachment.name, activeDoc?.hasPayload]);

  const decodedTextPreview = useMemo(() => {
    if (!activeDoc || activeDoc.kind !== 'text' || !activeDoc.attachment.dataUrl) return null;
    return decodeTextDataUrl(activeDoc.attachment.dataUrl);
  }, [activeDoc]);

  const handleSelectPatientRow = (groupKey: string, firstDocId?: string) => {
    onSelectParticipant(groupKey);
    setSelectedDocId(firstDocId ?? null);
    setConfirmDeleteId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      viewerPaneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !activeGroup) return;

    setUploading(true);
    try {
      const readAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(new Error('Unable to read file'));
          reader.readAsDataURL(file);
        });

      const uploadedAttachments: AttachmentFile[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await readAsDataUrl(file);
        uploadedAttachments.push({
          id: `${uploadSection}-${Date.now()}-${i}`,
          name: file.name,
          section: uploadSection,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        });
      }

      const nextPatient: PatientCRF = {
        ...activeGroup.patient,
        attachments: [...(activeGroup.patient.attachments || []), ...uploadedAttachments],
      };
      await onUpdatePatientInline(nextPatient);
      if (uploadedAttachments[0]) {
        setSelectedDocId(uploadedAttachments[0].id);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmDeleteDoc = async (docId: string) => {
    if (!activeGroup) return;
    const remaining = (activeGroup.patient.attachments || []).filter((a) => a.id !== docId);
    await onUpdatePatientInline({
      ...activeGroup.patient,
      attachments: remaining,
    });
    setConfirmDeleteId(null);
    setSelectedDocId(remaining[0]?.id ?? null);
    if (remaining.length === 0) {
      setFullscreenOpen(false);
    }
  };

  if (patients.length === 0) {
    return (
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-10 text-center max-w-2xl mx-auto">
        <FolderOpen className="w-10 h-10 text-[#047857] mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold text-[#14201B]">
          No Patient Documents Yet
        </h2>
        <p className="text-sm text-[#4B6157] mt-1.5 mb-5">
          Enroll a patient and attach lab PDFs, FibroScan charts, or clinical prescriptions to inspect them here.
        </p>
        <button
          type="button"
          onClick={onNewPatient}
          className="px-4 py-2 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>New Patient</span>
        </button>
      </div>
    );
  }

  const downloadHref = activeBlobUrl || activeDoc?.attachment.dataUrl || undefined;

  return (
    <div className="space-y-5 pb-8">
      {/* Hidden multi-file uploader bound to active patient */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="application/pdf,image/*,.txt,.csv"
        className="hidden"
        onChange={(e) => void handleUploadFiles(e)}
      />

      {/* Top Summary Header */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-bold text-[#14201B]">
            Patient Attached PDFs &amp; Documents
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B6157] font-mono tabular-nums">
            <span>{patients.length} Patients</span>
            <span aria-hidden="true">·</span>
            <span>{cohortStats.patientsWithDocs} With Documents</span>
            <span aria-hidden="true">·</span>
            <span>{cohortStats.totalDocs} Total Files</span>
            <span aria-hidden="true">·</span>
            <span>{cohortStats.totalPdfs} PDFs</span>
            <span aria-hidden="true">·</span>
            <span>{cohortStats.totalImages} Images</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="doc-upload-section" className="sr-only">
            Target section for new attachment
          </label>
          <select
            id="doc-upload-section"
            value={uploadSection}
            onChange={(e) => setUploadSection(e.target.value)}
            className="px-3 py-2 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
          >
            {UPLOAD_SECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Section: {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!activeGroup || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>
              {uploading
                ? 'Attaching...'
                : `Attach to ${activeGroup?.patient.patientName?.split(' ')[0] || 'Patient'}`}
            </span>
          </button>
        </div>
      </section>

      {/* Master-Detail Patient Directory & Embedded Document Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Every Patient Roster */}
        <aside
          aria-label="Patient document directory"
          className="lg:col-span-4 bg-white border border-[#DDE8E2] rounded-2xl p-4 space-y-3.5"
        >
          <div>
            <h2 className="font-display text-sm font-bold text-[#14201B]">
              Select Patient to View Documents
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Tap any patient name to open their attached PDFs and files inside this portal.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-[#6B8076] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient name, UHID, or file..."
              aria-label="Search patient or document"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] text-xs text-[#14201B] focus:outline-none focus:border-[#047857] focus:bg-white"
            />
          </div>

          {/* Segmented Roster & Kind Filters */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-1 p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg"
              role="group"
              aria-label="Filter patients by attachment status"
            >
              {(
                [
                  { id: 'all', label: `All Patients (${patients.length})` },
                  { id: 'with-docs', label: `With Docs (${cohortStats.patientsWithDocs})` },
                ] as Array<{ id: PatientRosterFilter; label: string }>
              ).map((opt) => {
                const selected = rosterFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRosterFilter(opt.id)}
                    aria-pressed={selected}
                    className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-white text-[#053B2B] shadow-xs font-semibold'
                        : 'text-[#4B6157] hover:text-[#14201B]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div
              className="flex items-center gap-1 p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg"
              role="group"
              aria-label="Filter by document file type"
            >
              {(
                [
                  { id: 'all', label: 'All Types' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'image', label: 'Images' },
                  { id: 'other', label: 'Other' },
                ] as Array<{ id: DocumentKindFilter; label: string }>
              ).map((opt) => {
                const selected = kindFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setKindFilter(opt.id)}
                    aria-pressed={selected}
                    className={`flex-1 px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                      selected
                        ? 'bg-white text-[#053B2B] shadow-xs font-semibold'
                        : 'text-[#4B6157] hover:text-[#14201B]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Patient List */}
          {filteredGroups.length === 0 ? (
            <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-5 text-center space-y-2">
              <p className="text-xs text-[#4B6157]">
                No patients match your current search or document filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRosterFilter('all');
                  setKindFilter('all');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-xs font-semibold text-[#053B2B]"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[68vh] overflow-y-auto pr-1">
              {filteredGroups.map((group) => {
                const isSelected = activeGroup?.patientKey === group.patientKey;
                const patientName = group.patient.patientName || 'Unnamed Participant';
                const firstDocId = group.documents[0]?.attachment.id;

                return (
                  <button
                    key={group.patientKey}
                    type="button"
                    aria-current={isSelected ? 'true' : undefined}
                    onClick={() => handleSelectPatientRow(group.patientKey, firstDocId)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors ${
                      isSelected
                        ? 'bg-[#053B2B] text-white border-[#053B2B] shadow-xs'
                        : 'bg-[#FAFDFB] hover:bg-[#EFF5F1] border-[#E6EFEA] text-[#14201B]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm truncate">{patientName}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isSelected ? 'text-emerald-200' : 'text-[#047857] font-semibold'
                          }`}
                        >
                          {group.totalCount === 0
                            ? '0 files'
                            : `${group.totalCount} ${group.totalCount === 1 ? 'doc' : 'docs'}`}
                        </span>
                        <ChevronRight
                          className={`w-3.5 h-3.5 ${
                            isSelected ? 'text-emerald-200' : 'text-[#6B8076]'
                          }`}
                        />
                      </div>
                    </div>

                    <div
                      className={`mt-1 text-[11px] font-mono tabular-nums truncate ${
                        isSelected ? 'text-emerald-100/85' : 'text-[#4B6157]'
                      }`}
                    >
                      {group.patient.uhid || 'No UHID'} · {group.patient.gender || '—'} ·{' '}
                      {group.patient.age ?? '?'} yrs
                      {group.pdfCount > 0 ? ` · ${group.pdfCount} PDF` : ''}
                      {group.imageCount > 0 ? ` · ${group.imageCount} Img` : ''}
                    </div>

                    {group.documents.length > 0 && (
                      <div
                        className={`mt-2 pt-2 border-t text-[11px] space-y-1 ${
                          isSelected ? 'border-emerald-800/80 text-emerald-100' : 'border-[#E6EFEA] text-[#4B6157]'
                        }`}
                      >
                        {group.documents.slice(0, 3).map((d) => (
                          <div key={d.attachment.id} className="flex items-center gap-1.5 truncate">
                            <DocumentKindIcon
                              kind={d.kind}
                              className={`w-3 h-3 shrink-0 ${
                                isSelected ? 'text-emerald-300' : 'text-[#047857]'
                              }`}
                            />
                            <span className="truncate">{d.attachment.name}</span>
                          </div>
                        ))}
                        {group.documents.length > 3 && (
                          <div
                            className={`text-[10px] font-mono ${
                              isSelected ? 'text-emerald-200/80' : 'text-[#6B8076]'
                            }`}
                          >
                            +{group.documents.length - 3} more attached files
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Right: Active Patient's Attached Documents & Embedded In-Website Viewer */}
        <section
          ref={viewerPaneRef}
          aria-label="Patient attached documents viewer"
          className="lg:col-span-8 space-y-4 min-w-0"
        >
          {!activeGroup ? (
            <div className="bg-white border border-[#DDE8E2] rounded-2xl p-10 text-center text-sm text-[#4B6157]">
              Select a patient from the directory to view their attached PDFs and clinical documents.
            </div>
          ) : (
            <>
              {/* Active Patient Header & Attached File Tabs */}
              <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold text-[#14201B] truncate">
                      {activeGroup.patient.patientName || 'Unnamed Participant'}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#4B6157] font-mono tabular-nums">
                      <span>UHID {activeGroup.patient.uhid || '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{activeGroup.patient.clusterType || 'Cluster Unassigned'}</span>
                      <span aria-hidden="true">·</span>
                      <span>Visit {activeGroup.patient.visitNo || '—'}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {activeGroup.totalCount}{' '}
                        {activeGroup.totalCount === 1 ? 'Attached Document' : 'Attached Documents'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenProfile(activeGroup.patient)}
                      className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <HeartPulse className="w-3.5 h-3.5 text-[#047857]" />
                      <span>Patient Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewCRF(activeGroup.patient)}
                      className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#047857]" />
                      <span>Open CRF</span>
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add File</span>
                    </button>
                  </div>
                </div>

                {/* Clickable list of this patient's different attached PDFs / documents */}
                {activeGroup.documents.length > 0 ? (
                  <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    role="listbox"
                    aria-label={`Attached documents for ${activeGroup.patient.patientName}`}
                  >
                    {activeGroup.documents.map((doc) => {
                      const isCurrent = activeDoc?.attachment.id === doc.attachment.id;
                      return (
                        <button
                          key={doc.attachment.id}
                          type="button"
                          role="option"
                          aria-selected={isCurrent}
                          onClick={() => setSelectedDocId(doc.attachment.id)}
                          className={`text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
                            isCurrent
                              ? 'bg-[#ECFDF5] border-[#047857] text-[#053B2B]'
                              : 'bg-[#F6F9F7] hover:bg-[#EFF5F1] border-[#E6EFEA] text-[#14201B]'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isCurrent
                                ? 'bg-[#047857] text-white'
                                : 'bg-white border border-[#DDE8E2] text-[#047857]'
                            }`}
                          >
                            <DocumentKindIcon kind={doc.kind} className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold truncate">
                              {doc.attachment.name}
                            </div>
                            <div className="text-[11px] text-[#4B6157] mt-0.5 truncate">
                              {doc.sectionLabel}
                            </div>
                            <div className="text-[10px] font-mono tabular-nums text-[#6B8076] mt-1">
                              {doc.kind.toUpperCase()} · {doc.sizeLabel} ·{' '}
                              {formatUploadDate(doc.attachment.uploadedAt)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-6 text-center space-y-3">
                    <FolderOpen className="w-8 h-8 text-[#047857] mx-auto" />
                    <div className="space-y-1">
                      <h3 className="font-display text-sm font-bold text-[#14201B]">
                        No Attached PDFs or Documents Yet
                      </h3>
                      <p className="text-xs text-[#4B6157] max-w-md mx-auto">
                        Attach lab report PDFs, FibroScan scans, or prescriptions for{' '}
                        <strong>{activeGroup.patient.patientName || 'this patient'}</strong> to view them directly inside the study portal.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Attach PDF or Document</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditPatient(activeGroup.patient)}
                        className="px-4 py-2 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-[#047857]" />
                        <span>Open Collection Form</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Embedded In-Website Document Previewer */}
              {activeDoc && (
                <div className="bg-white border border-[#DDE8E2] rounded-2xl overflow-hidden">
                  {/* Viewer Toolbar */}
                  <div className="px-5 py-3.5 bg-[#F6F9F7] border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <DocumentKindIcon
                        kind={activeDoc.kind}
                        className="w-4 h-4 text-[#047857] shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#14201B] truncate">
                          {activeDoc.attachment.name}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[#4B6157] truncate">
                          {activeDoc.sectionLabel} · {activeDoc.mimeType} · {activeDoc.sizeLabel}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {(activeDoc.kind === 'image' || activeDoc.kind === 'pdf') && activeDoc.hasPayload && (
                        <div className="flex items-center gap-1 bg-white border border-[#DDE8E2] rounded-lg px-1.5 py-1">
                          <button
                            type="button"
                            onClick={() => setDocZoom((z) => Math.max(50, z - 25))}
                            aria-label="Zoom out document"
                            className="p-1 rounded hover:bg-[#F6F9F7] text-[#053B2B]"
                          >
                            <ZoomOut className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[11px] font-mono tabular-nums text-[#14201B] px-1">
                            {docZoom}%
                          </span>
                          <button
                            type="button"
                            onClick={() => setDocZoom((z) => Math.min(200, z + 25))}
                            aria-label="Zoom in document"
                            className="p-1 rounded hover:bg-[#F6F9F7] text-[#053B2B]"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {activeDoc.hasPayload && (
                        <button
                          type="button"
                          onClick={() => setFullscreenOpen(true)}
                          className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Maximize2 className="w-3.5 h-3.5 text-[#047857]" />
                          <span>Expand</span>
                        </button>
                      )}

                      {downloadHref && (
                        <a
                          href={downloadHref}
                          download={activeDoc.attachment.name}
                          className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Download className="w-3.5 h-3.5 text-[#047857]" />
                          <span>Download</span>
                        </a>
                      )}

                      {confirmDeleteId === activeDoc.attachment.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleConfirmDeleteDoc(activeDoc.attachment.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Confirm Remove
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white text-[#4B6157] text-xs font-medium whitespace-nowrap"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(activeDoc.attachment.id)}
                          aria-label={`Remove ${activeDoc.attachment.name}`}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-rose-700 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Viewer Body */}
                  <div className="p-4 bg-[#FAFDFB] min-h-[540px] flex flex-col">
                    {!activeDoc.hasPayload ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
                        <File className="w-9 h-9 text-[#6B8076]" />
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-[#14201B]">
                            File Preview Unavailable
                          </div>
                          <p className="text-xs text-[#4B6157] max-w-md">
                            This entry contains attachment metadata without an embedded file payload. Upload the PDF or scan again to preview it directly here.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Re-upload Document</span>
                        </button>
                      </div>
                    ) : activeDoc.kind === 'pdf' && activeDoc.attachment.dataUrl ? (
                      <PdfCanvasViewer
                        key={activeDoc.attachment.id}
                        dataUrl={activeDoc.attachment.dataUrl}
                        fileName={activeDoc.attachment.name}
                        zoomPct={docZoom}
                        maxHeightClass="max-h-[560px]"
                      />
                    ) : activeDoc.kind === 'image' && !imageFailed ? (
                      <div className="flex-1 overflow-auto flex items-center justify-center rounded-xl border border-[#DDE8E2] bg-white p-4 min-h-[520px]">
                        <img
                          src={activeDoc.attachment.dataUrl}
                          alt={activeDoc.attachment.name}
                          referrerPolicy="no-referrer"
                          onError={() => setImageFailed(true)}
                          style={{ width: `${docZoom}%` }}
                          className="max-w-full max-h-[560px] object-contain transition-transform duration-150"
                        />
                      </div>
                    ) : activeDoc.kind === 'text' && decodedTextPreview !== null ? (
                      <pre className="flex-1 w-full rounded-xl border border-[#DDE8E2] bg-white p-5 font-mono text-xs text-[#14201B] whitespace-pre-wrap overflow-auto max-h-[560px] leading-relaxed">
                        {decodedTextPreview}
                      </pre>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3 bg-white rounded-xl border border-[#DDE8E2]">
                        <FileText className="w-10 h-10 text-[#047857]" />
                        <div className="space-y-1">
                          <div className="text-sm font-bold text-[#14201B]">
                            {activeDoc.attachment.name}
                          </div>
                          <p className="text-xs text-[#4B6157]">
                            Inline browser preview is not supported for {activeDoc.mimeType}. Download the file to open it locally.
                          </p>
                        </div>
                        {downloadHref && (
                          <a
                            href={downloadHref}
                            download={activeDoc.attachment.name}
                            className="px-4 py-2 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download {activeDoc.attachment.name}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Fullscreen In-Website Document Modal */}
      {fullscreenOpen && activeDoc && activeGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Document preview: ${activeDoc.attachment.name}`}
        >
          <div className="bg-white border border-[#DDE8E2] rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-5 py-3.5 bg-[#053B2B] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">
                  {activeGroup.patient.patientName} — {activeDoc.attachment.name}
                </div>
                <div className="text-[11px] font-mono text-emerald-200 truncate">
                  UHID {activeGroup.patient.uhid || '—'} · {activeDoc.sectionLabel} ·{' '}
                  {activeDoc.sizeLabel}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {downloadHref && (
                  <a
                    href={downloadHref}
                    download={activeDoc.attachment.name}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#053B2B] hover:bg-emerald-50 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setFullscreenOpen(false)}
                  aria-label="Close expanded document viewer"
                  className="p-1.5 rounded-lg hover:bg-emerald-800 text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-[#F6F9F7] p-4 overflow-auto flex flex-col">
              {activeDoc.kind === 'pdf' && activeDoc.attachment.dataUrl ? (
                <PdfCanvasViewer
                  key={`expanded-${activeDoc.attachment.id}`}
                  dataUrl={activeDoc.attachment.dataUrl}
                  fileName={activeDoc.attachment.name}
                  zoomPct={115}
                  maxHeightClass="h-full"
                />
              ) : activeDoc.kind === 'image' && !imageFailed ? (
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={activeDoc.attachment.dataUrl}
                    alt={activeDoc.attachment.name}
                    referrerPolicy="no-referrer"
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                </div>
              ) : activeDoc.kind === 'text' && decodedTextPreview !== null ? (
                <pre className="w-full h-full rounded-xl border border-[#DDE8E2] bg-white p-6 font-mono text-xs text-[#14201B] whitespace-pre-wrap overflow-auto">
                  {decodedTextPreview}
                </pre>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
