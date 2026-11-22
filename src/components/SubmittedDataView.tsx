import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  FileSpreadsheet,
  Edit3,
  FileText,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import type { PatientCRF, StatusColor } from '../types/clinical';
import { getIdToken } from '../lib/firebase';
import { evaluateMissingDataAndStatus } from '../utils/clinicalMath';
import { summarizePendingFields } from '../utils/dashboardCalendar';
import { parseJsonSafe } from '../utils/http';
import { getPatientKey } from '../utils/statisticalCharts';
import type { FormTabKey } from './ClinicalCollectionView';
import { DoubleConfirmDeleteModal } from './DoubleConfirmDeleteModal';
import {
  EXCEL_EXPORT_HEADERS,
  buildPatientExcelMatrix,
  downloadPatientsExcelWorkbook,
  getSpreadsheetColumnLetter,
} from '../utils/excelExport';

interface SubmittedDataViewProps {
  patients: PatientCRF[];
  isInvestigator: boolean;
  initialContributorFilter?: string;
  accessToken: string | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onEditPatient: (patient: PatientCRF, tab?: FormTabKey) => void;
  onViewCRF: (patient: PatientCRF) => void;
  onDeletePatient: (patient: PatientCRF) => void;
}

const STATUS_DOT: Record<StatusColor, string> = {
  green: 'bg-emerald-600',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-500',
  red: 'bg-red-600',
};

const SHEET_STORAGE_KEY = 'desai_t2dm_sheet_config';

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (match) return match[1];
  return trimmed;
}

export const SubmittedDataView: React.FC<SubmittedDataViewProps> = ({
  patients,
  isInvestigator,
  initialContributorFilter = 'All',
  accessToken,
  onRequestGoogleSignIn,
  onEditPatient,
  onViewCRF,
  onDeletePatient,
}) => {
  const [search, setSearch] = useState('');
  const [clusterFilter, setClusterFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [contributorFilter, setContributorFilter] = useState(initialContributorFilter || 'All');

  React.useEffect(() => {
    if (initialContributorFilter) {
      setContributorFilter(initialContributorFilter);
    }
  }, [initialContributorFilter]);

  // Google Sheets sync state (stores spreadsheet ID & tab name only; never tokens)
  const savedCfg = useMemo(() => {
    try {
      const raw = localStorage.getItem(SHEET_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as { url?: string; sheetName?: string }) : {};
    } catch {
      return {};
    }
  }, []);

  const [sheetInput, setSheetInput] = useState(savedCfg.url || '');
  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [selectedTab, setSelectedTab] = useState(savedCfg.sheetName || '');
  const [sheetTitle, setSheetTitle] = useState('');
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [confirmDeletePatient, setConfirmDeletePatient] = useState<PatientCRF | null>(null);
  const [syncBanner, setSyncBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  const contributorOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of patients) {
      const email = (p.investigatorEmail || '').trim().toLowerCase();
      if (email) {
        map.set(email, p.investigatorName || email);
      }
    }
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [patients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return patients
      .map((p) => ({
        patient: p,
        evalResult: evaluateMissingDataAndStatus(p),
      }))
      .filter(({ patient, evalResult }) => {
        if (clusterFilter !== 'All' && patient.clusterType !== clusterFilter) return false;
        if (statusFilter === 'pending') {
          if (evalResult.statusColor === 'green') return false;
        } else if (statusFilter !== 'All' && evalResult.statusColor !== statusFilter) {
          return false;
        }
        if (
          isInvestigator &&
          contributorFilter !== 'All' &&
          (patient.investigatorEmail || '').trim().toLowerCase() !== contributorFilter.toLowerCase()
        ) {
          return false;
        }
        if (!q) return true;
        return (
          patient.patientName.toLowerCase().includes(q) ||
          patient.uhid.toLowerCase().includes(q) ||
          (patient.investigatorName || '').toLowerCase().includes(q)
        );
      });
  }, [patients, search, clusterFilter, statusFilter, contributorFilter, isInvestigator]);

  const handleDownloadExcel = () => {
    downloadPatientsExcelWorkbook(filtered.map((f) => f.patient));
  };

  const ensureToken = async (): Promise<string | null> => {
    if (accessToken) return accessToken;
    return await onRequestGoogleSignIn();
  };

  const handleLoadSpreadsheetTabs = async () => {
    const spreadsheetId = extractSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      setSyncBanner({
        type: 'error',
        text: 'Paste your existing Google Sheet URL or Spreadsheet ID first.',
      });
      return;
    }

    setLoadingTabs(true);
    setSyncBanner(null);
    try {
      const token = await ensureToken();
      if (!token) {
        throw new Error('Google sign-in with Sheets permission is required to access your sheet.');
      }

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}?fields=properties.title,sheets.properties.title`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await parseJsonSafe<{
        properties?: { title?: string };
        sheets?: Array<{ properties?: { title?: string } }>;
        error?: { message?: string };
      }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error?.message || 'Unable to inspect Google Sheet metadata.');
      }

      const tabs: string[] = (data.sheets || []).map(
        (s: { properties?: { title?: string } }) => s.properties?.title || 'Sheet1'
      );
      setSheetTitle(data.properties?.title || 'Connected Spreadsheet');
      setAvailableTabs(tabs);
      const nextTab = tabs.includes(selectedTab) ? selectedTab : tabs[0] || '';
      setSelectedTab(nextTab);

      try {
        localStorage.setItem(
          SHEET_STORAGE_KEY,
          JSON.stringify({ url: sheetInput, sheetName: nextTab })
        );
      } catch {
        // ignore storage quota errors
      }

      setSyncBanner({
        type: 'success',
        text: `Connected "${data.properties?.title || spreadsheetId}" (${tabs.length} tab${
          tabs.length === 1 ? '' : 's'
        } detected).`,
      });
    } catch (err: unknown) {
      setSyncBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to load spreadsheet tabs.',
      });
    } finally {
      setLoadingTabs(false);
    }
  };

  const handleSyncToSheetConfirmed = async () => {
    setShowConfirmSync(false);
    const spreadsheetId = extractSpreadsheetId(sheetInput);
    if (!spreadsheetId || !selectedTab) {
      setSyncBanner({
        type: 'error',
        text: 'Load and select a target tab from your existing Google Sheet before syncing.',
      });
      return;
    }

    setSyncingSheet(true);
    setSyncBanner(null);
    try {
      const token = await ensureToken();
      if (!token) {
        throw new Error('Google sign-in with Sheets permission is required.');
      }

      const matrix = buildPatientExcelMatrix(patients);
      const lastCol = getSpreadsheetColumnLetter(matrix[0]?.length || EXCEL_EXPORT_HEADERS.length);
      const range = `'${selectedTab.replace(/'/g, "''")}'!A1:${lastCol}${matrix.length}`;

      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            range,
            majorDimension: 'ROWS',
            values: matrix,
          }),
        }
      );

      const data = await parseJsonSafe<{ updatedRows?: number; error?: { message?: string } }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error?.message || 'Google Sheets update failed.');
      }

      try {
        localStorage.setItem(
          SHEET_STORAGE_KEY,
          JSON.stringify({ url: sheetInput, sheetName: selectedTab })
        );
      } catch {
        // ignore
      }

      // Persist config on server if authenticated
      getIdToken()
        .then((idToken) => {
          if (!idToken) return;
          return fetch('/api/settings/sheet', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              spreadsheetId,
              spreadsheetUrl: sheetInput,
              sheetName: selectedTab,
            }),
          });
        })
        .catch(() => {});

      setSyncBanner({
        type: 'success',
        text: `Updated "${sheetTitle || spreadsheetId}" -> tab "${selectedTab}" in place (${
          data.updatedRows ?? matrix.length
        } rows written).`,
      });
    } catch (err: unknown) {
      setSyncBanner({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update Google Sheet.',
      });
    } finally {
      setSyncingSheet(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Exports */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex-1 min-w-[260px]">
          <h2 className="font-display text-xl font-bold text-[#14201B]">
            Submitted Study Dataset
          </h2>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Complete {EXCEL_EXPORT_HEADERS.length}-column clinical registry across all enrolled T2DM
            participants with Excel (.xlsx) workbook export and in-place Google Sheets
            synchronization.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadExcel}
          className="px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download Excel Sheet ({filtered.length})</span>
        </button>
      </div>

      {/* Google Sheets In-Place Sync Panel */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#047857]" />
            <div>
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Google Sheets In-Place Master Sync
              </h3>
              <p className="text-xs text-[#4B6157]">
                Updates your existing research spreadsheet directly without creating duplicate files.
              </p>
            </div>
          </div>
          {sheetTitle && (
            <span className="text-xs font-medium text-[#047857] bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              {sheetTitle}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-6">
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Existing Google Sheet URL or Spreadsheet ID
            </label>
            <input
              type="text"
              value={sheetInput}
              onChange={(e) => setSheetInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/.../edit"
              className="w-full px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] text-xs font-mono focus:outline-none focus:border-[#047857]"
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Target Sheet Tab
            </label>
            <select
              aria-label="Target Google Sheet tab"
              value={selectedTab}
              onChange={(e) => setSelectedTab(e.target.value)}
              disabled={availableTabs.length === 0}
              className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs font-medium text-[#14201B] disabled:bg-[#F6F9F7]"
            >
              {availableTabs.length === 0 ? (
                <option value="">Load sheet to detect tabs...</option>
              ) : (
                availableTabs.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="lg:col-span-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadSpreadsheetTabs}
              disabled={loadingTabs}
              className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingTabs ? 'animate-spin' : ''}`} />
              <span>{loadingTabs ? 'Loading...' : 'Load Tabs'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowConfirmSync(true)}
              disabled={syncingSheet || !selectedTab}
              className="px-3.5 py-2 rounded-xl bg-[#053B2B] hover:bg-[#047857] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{syncingSheet ? 'Syncing...' : 'Update Sheet'}</span>
            </button>
          </div>
        </div>

        {syncBanner && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              syncBanner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {syncBanner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{syncBanner.text}</span>
          </div>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-[#6B8076] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter Excel table by Name or UHID..."
            aria-label="Filter submitted data"
            className="w-full pl-10 pr-4 py-2 bg-white border border-[#DDE8E2] rounded-xl text-sm focus:outline-none focus:border-[#047857]"
          />
        </div>

        <select
          aria-label="Filter table by cluster"
          value={clusterFilter}
          onChange={(e) => setClusterFilter(e.target.value)}
          className="px-3.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B]"
        >
          <option value="All">All Clusters</option>
          <option value="SIDD">SIDD</option>
          <option value="SIRD">SIRD</option>
          <option value="CIRDD">CIRDD</option>
          <option value="MARD">MARD</option>
        </select>

        <select
          aria-label="Filter table by status color"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B]"
        >
          <option value="All">All Statuses</option>
          <option value="pending">All Pending (Incomplete)</option>
          <option value="green">Green — Complete</option>
          <option value="yellow">Yellow — 2nd HbA1c Pending</option>
          <option value="orange">Orange — Reports Pending</option>
          <option value="red">Red — Multiple Pending</option>
        </select>

        {isInvestigator && (
          <select
            aria-label="Filter table by login participant"
            value={contributorFilter}
            onChange={(e) => setContributorFilter(e.target.value)}
            className="px-3.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B]"
          >
            <option value="All">All Login Participants ({patients.length})</option>
            {contributorOptions.map((c) => (
              <option key={c.email} value={c.email}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Excel-Style Spreadsheet Table */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10.5px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-3 px-2">Status</th>
                <th className="py-3 px-2">UHID</th>
                <th className="py-3 px-2">Patient Name</th>
                {isInvestigator && <th className="py-3 px-2">Submitted By</th>}
                <th className="py-3 px-1.5">Gender</th>
                <th className="py-3 px-1.5 text-right">Age</th>
                <th className="py-3 px-1.5 text-right">HbA1c</th>
                <th className="py-3 px-1.5 text-right">TG</th>
                <th className="py-3 px-1.5 text-right">BMI</th>
                <th className="py-3 px-1.5 text-right">C-Pep</th>
                <th className="py-3 px-1.5 text-right">HOMA-B</th>
                <th className="py-3 px-1.5 text-right">HOMA-IR</th>
                <th className="py-3 px-1.5 text-right">Blue Idx</th>
                <th className="py-3 px-2">Cluster</th>
                <th className="py-3 px-2">Pending</th>
                <th className="py-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={isInvestigator ? 16 : 15} className="py-10 text-center text-[#6B8076]">
                    No submitted records match the current filter.
                  </td>
                </tr>
              ) : (
                filtered.map(({ patient, evalResult }, idx) => (
                  <tr key={getPatientKey(patient, idx)} className="hover:bg-[#FAFDFB] transition-colors">
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${
                          STATUS_DOT[evalResult.statusColor]
                        }`}
                        title={evalResult.statusLabel}
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[#4B6157] whitespace-nowrap">
                      {patient.uhid || '—'}
                    </td>
                    <td className="py-2.5 px-2 font-medium text-[#14201B] whitespace-nowrap">
                      {patient.patientName || 'Unnamed Participant'}
                    </td>
                    {isInvestigator && (
                      <td className="py-2.5 px-2 text-[#4B6157] whitespace-nowrap max-w-[140px]">
                        <div className="font-medium text-[#14201B] truncate">
                          {patient.investigatorName || '—'}
                        </div>
                        <div className="text-[10px] text-[#6B8076] truncate">
                          {patient.investigatorEmail || ''}
                        </div>
                      </td>
                    )}
                    <td className="py-2.5 px-1.5 text-[#4B6157]">{patient.gender || '—'}</td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.age ?? '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.hba1c1.value !== null ? `${patient.hba1c1.value}%` : '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.triglycerides.value ?? '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.bmi !== null ? patient.bmi.toFixed(1) : '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.cPeptide.value ?? '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.homaB ?? '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums">
                      {patient.homaIR ?? '—'}
                    </td>
                    <td className="py-2.5 px-1.5 text-right font-mono tabular-nums whitespace-nowrap">
                      {patient.dhsTotal ?? '—'}:{patient.ksTotal ?? '—'}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-semibold text-[#047857]">
                      {patient.clusterType || '—'}
                    </td>
                    <td className="py-2.5 px-2">
                      {evalResult.missingFields.length === 0 ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[10.5px] font-medium whitespace-nowrap">
                          0 pending
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onEditPatient(patient, 'remaining')}
                          title={evalResult.missingFields.map((m) => m.label).join(', ')}
                          className="text-left group"
                        >
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 group-hover:bg-amber-100 text-[10.5px] font-medium whitespace-nowrap">
                            {evalResult.missingFields.length} pending
                          </span>
                          <div className="text-[10px] text-[#6B8076] mt-0.5 max-w-[110px] truncate">
                            {summarizePendingFields(evalResult.missingFields, 2)}
                          </div>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onViewCRF(patient)}
                          title="Open CRF"
                          className="p-1.5 rounded-lg hover:bg-[#EFF5F1] text-[#047857]"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditPatient(patient)}
                          title="Edit Patient"
                          className="p-1.5 rounded-lg hover:bg-[#EFF5F1] text-[#14201B]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePatient(patient)}
                          title="Delete Patient"
                          aria-label={`Delete ${patient.patientName}`}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mandatory Confirmation Dialog Before Updating User Google Sheet */}
      {showConfirmSync && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDE8E2] rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-bold text-[#14201B]">
                Confirm Google Sheet Update
              </h3>
              <button
                type="button"
                onClick={() => setShowConfirmSync(false)}
                className="p-1 rounded-lg hover:bg-[#F6F9F7]"
              >
                <X className="w-4 h-4 text-[#4B6157]" />
              </button>
            </div>
            <p className="text-sm text-[#4B6157] leading-relaxed">
              This will overwrite range{' '}
              <span className="font-mono font-semibold">
                A1:{getSpreadsheetColumnLetter(EXCEL_EXPORT_HEADERS.length)}
                {patients.length + 1}
              </span>{' '}
              in tab <span className="font-mono font-semibold text-[#14201B]">{selectedTab}</span>{' '}
              of spreadsheet{' '}
              <span className="font-semibold text-[#14201B]">{sheetTitle || extractSpreadsheetId(sheetInput)}</span>{' '}
              with all {patients.length} patient records.
            </p>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmSync(false)}
                className="px-4 py-2 rounded-xl border border-[#DDE8E2] text-sm font-medium text-[#14201B] hover:bg-[#F6F9F7]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSyncToSheetConfirmed}
                className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-sm font-semibold"
              >
                Confirm &amp; Update Sheet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2-Step Patient Delete Confirmation */}
      <DoubleConfirmDeleteModal
        open={Boolean(confirmDeletePatient)}
        title="Delete Patient Record?"
        itemName={confirmDeletePatient?.patientName || 'Unnamed Participant'}
        itemMeta={
          confirmDeletePatient ? `UHID ${confirmDeletePatient.uhid || '—'}` : undefined
        }
        description="This permanently removes the patient's entire CRF, laboratory values, medications, and attached clinical reports."
        confirmLabel="Yes, Delete Patient Record"
        onCancel={() => setConfirmDeletePatient(null)}
        onConfirm={() => {
          if (!confirmDeletePatient) return;
          onDeletePatient(confirmDeletePatient);
          setConfirmDeletePatient(null);
        }}
      />
    </div>
  );
};
