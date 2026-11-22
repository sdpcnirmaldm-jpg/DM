import React, { useMemo, useState } from 'react';
import {
  Search,
  Printer,
  Download,
  Edit3,
  Check,
  FileText,
} from 'lucide-react';
import type { ClusterType, PatientCRF } from '../types/clinical';
import { getPatientKey } from '../utils/statisticalCharts';
import { CrfPages1And2 } from './crf/CrfPages1And2';
import { CrfPages3And4 } from './crf/CrfPages3And4';

interface CRFViewerProps {
  patients: PatientCRF[];
  selectedParticipantId: string | null;
  onSelectParticipant: (participantId: string) => void;
  onEditInCollectionForm: (patient: PatientCRF) => void;
  onUpdatePatientInline: (patient: PatientCRF) => Promise<void>;
}

export const CRFViewer: React.FC<CRFViewerProps> = ({
  patients,
  selectedParticipantId,
  onSelectParticipant,
  onEditInCollectionForm,
  onUpdatePatientInline,
}) => {
  const [search, setSearch] = useState('');
  const [blankMode, setBlankMode] = useState(false);
  const [inlineEditing, setInlineEditing] = useState(false);
  const [draftCluster, setDraftCluster] = useState<ClusterType | ''>('');
  const [draftNotes, setDraftNotes] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.patientName.toLowerCase().includes(q) ||
        p.uhid.toLowerCase().includes(q)
    );
  }, [patients, search]);

  const activePatient = useMemo(() => {
    return (
      (selectedParticipantId
        ? patients.find(
            (p) =>
              getPatientKey(p) === selectedParticipantId ||
              (Boolean(p.participantId) && p.participantId === selectedParticipantId)
          )
        : null) ||
      filteredList[0] ||
      patients[0] ||
      null
    );
  }, [patients, filteredList, selectedParticipantId]);

  const startInlineEdit = () => {
    if (!activePatient) return;
    setBlankMode(false);
    setDraftCluster(activePatient.clusterType);
    setDraftNotes(activePatient.otherRelevantHistory || '');
    setInlineEditing(true);
  };

  const saveInlineEdit = async () => {
    if (!activePatient) return;
    setSavingInline(true);
    try {
      await onUpdatePatientInline({
        ...activePatient,
        clusterType: draftCluster,
        otherRelevantHistory: draftNotes,
      });
      setInlineEditing(false);
    } finally {
      setSavingInline(false);
    }
  };

  const handleDownloadCrfHtml = () => {
    if (!activePatient) return;
    const container = document.getElementById('crf-printable-document');
    const bodyHtml = container ? container.innerHTML : '';
    const fileLabel = blankMode
      ? 'CRF_Blank_Template.html'
      : `CRF_${activePatient.uhid || 'NoUHID'}_${(activePatient.patientName || 'Patient').replace(/\s+/g, '_')}.html`;
    const fullDoc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${blankMode ? 'Blank Case Report Form (CRF)' : `CRF - ${activePatient.uhid || 'No UHID'} - ${activePatient.patientName || 'Unnamed'}`}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0F172A; margin: 20px; background: #F8FAFC; line-height: 1.35; }
  .crf-page { background: #FFFFFF; border: 1px solid #CBD5E1; padding: 24px 28px; margin: 0 auto 24px; max-width: 960px; }
  .crf-page-break { page-break-after: always; break-after: page; }
  h1 { color: #15345B; font-size: 16px; margin: 0; }
  h2 { color: #15345B; font-size: 13px; margin: 12px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; margin: 4px 0 12px; font-size: 11.5px; }
  th { background: #15345B; color: #FFFFFF; font-weight: 600; text-align: left; padding: 6px 8px; border: 1px solid #15345B; }
  td { border: 1px solid #94A3B8; padding: 5px 8px; vertical-align: middle; }
  img { max-height: 42px; }
  @media print {
    body { margin: 0; background: #FFFFFF; }
    .crf-page { border: none; padding: 0; margin: 0; }
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileLabel;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left Patient Roster */}
      <div className="lg:col-span-4 bg-white border border-[#DDE8E2] rounded-2xl p-4 space-y-3 no-print">
        <div>
          <h2 className="font-display text-base font-bold text-[#14201B]">
            Case Report Forms
          </h2>
          <p className="text-xs text-[#4B6157]">
            Select any enrolled participant to inspect or print 4-page structured CRF.
          </p>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-[#6B8076] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or UHID..."
            aria-label="Search CRF roster"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] text-xs focus:outline-none focus:border-[#047857]"
          />
        </div>

        <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
          {filteredList.map((p, idx) => {
            const pKey = getPatientKey(p, idx);
            const active = activePatient ? getPatientKey(activePatient) === pKey : false;
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => {
                  setInlineEditing(false);
                  onSelectParticipant(pKey);
                }}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  active
                    ? 'bg-[#053B2B] text-white border-[#053B2B]'
                    : 'bg-[#FAFDFB] hover:bg-[#EFF5F1] border-[#EEF3F0] text-[#14201B]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm truncate">
                    {p.patientName || 'Unnamed Participant'}
                  </span>
                  <span
                    className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                      active ? 'bg-emerald-800 text-emerald-100' : 'bg-[#EFF5F1] text-[#053B2B]'
                    }`}
                  >
                    {p.clusterType || '—'}
                  </span>
                </div>
                <div
                  className={`mt-1 text-xs font-mono ${
                    active ? 'text-emerald-200' : 'text-[#4B6157]'
                  }`}
                >
                  {p.uhid || 'No UHID'} · {p.gender || '—'} · {p.age ?? '?'} yrs
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Full 4-Page Structured CRF Document */}
      <div className="lg:col-span-8 space-y-4 min-w-0">
        {!activePatient ? (
          <div className="bg-white border border-[#DDE8E2] rounded-2xl p-10 text-center text-sm text-[#4B6157]">
            No patient selected.
          </div>
        ) : (
          <>
            {/* Action Toolbar */}
            <div className="bg-white border border-[#DDE8E2] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2 text-xs text-[#4B6157]">
                <FileText className="w-4 h-4 text-[#047857]" />
                <span className="font-mono font-semibold text-[#14201B]">
                  {blankMode ? 'BLANK FORM' : activePatient.uhid ? `UHID ${activePatient.uhid}` : 'NO UHID'}
                </span>
                <span>·</span>
                <span>{blankMode ? 'Standard 4-Page CRF Template' : activePatient.patientName || 'Unnamed Participant'}</span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  className="inline-flex rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] p-0.5"
                  role="group"
                  aria-label="CRF display mode"
                >
                  <button
                    type="button"
                    onClick={() => setBlankMode(false)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      !blankMode
                        ? 'bg-[#15345B] text-white'
                        : 'text-[#4B6157] hover:text-[#14201B]'
                    }`}
                  >
                    Pre-Filled CRF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInlineEditing(false);
                      setBlankMode(true);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      blankMode
                        ? 'bg-[#15345B] text-white'
                        : 'text-[#4B6157] hover:text-[#14201B]'
                    }`}
                  >
                    Blank Template
                  </button>
                </div>

                {inlineEditing ? (
                  <button
                    type="button"
                    onClick={saveInlineEdit}
                    disabled={savingInline}
                    className="px-3 py-1.5 rounded-xl bg-[#047857] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingInline ? 'Saving...' : 'Save Inline Edits'}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startInlineEdit}
                    className="px-3 py-1.5 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B] whitespace-nowrap shrink-0"
                  >
                    Quick Edit Cluster / Notes
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onEditInCollectionForm(activePatient)}
                  className="px-3 py-1.5 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#F6F9F7] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Edit Full CRF</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCrfHtml}
                  className="px-3 py-1.5 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#F6F9F7] text-xs font-medium text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-[#047857]" />
                  <span>Download CRF</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-xl bg-[#15345B] hover:bg-[#0F2744] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / Save PDF</span>
                </button>
              </div>
            </div>

            {/* Complete 4-Page Boxed CRF Document (horizontally scrollable inside container on narrow screens) */}
            <div className="overflow-x-auto pb-2">
              <div
                id="crf-printable-document"
                className="space-y-6 print-only-full"
              >
                <CrfPages1And2
                  patient={activePatient}
                  blankMode={blankMode}
                  inlineEditing={inlineEditing}
                  draftNotes={draftNotes}
                  onDraftNotesChange={setDraftNotes}
                />
                <CrfPages3And4
                  patient={activePatient}
                  blankMode={blankMode}
                  inlineEditing={inlineEditing}
                  draftCluster={draftCluster}
                  onDraftClusterChange={setDraftCluster}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
