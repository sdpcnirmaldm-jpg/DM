import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  Table2,
  Upload,
} from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import { parseJsonSafe } from '../utils/http';
import {
  autoMapSpreadsheetHeaders,
  buildSampleExcelMatrix,
  CRF_FIELD_DEFINITIONS,
  parseSpreadsheetGrid,
  planBulkPatientSync,
  type BulkSyncPlan,
  type BulkSyncRowPlan,
  type CrfColumnTarget,
  type ParsedSpreadsheetGrid,
} from '../utils/bulkSpreadsheetImport';

export interface BatchUpsertInputItem {
  matchedExistingKey?: string;
  patient: PatientCRF;
}

export interface BatchUpsertResult {
  updatedCount: number;
  createdCount: number;
  savedPatients: PatientCRF[];
}

interface BulkSpreadsheetSyncPanelProps {
  patients: PatientCRF[];
  accessToken: string | null;
  activeUser?: { displayName?: string; email?: string; uid?: string } | null;
  onRequestGoogleSignIn: () => Promise<string | null>;
  onBatchUpsertPatients?: (items: BatchUpsertInputItem[]) => Promise<BatchUpsertResult>;
  onViewCRF?: (patient: PatientCRF) => void;
  onNavigateToData?: () => void;
}

const SHEET_STORAGE_KEY = 'desai_t2dm_sheet_config';

function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(trimmed);
  if (match) return match[1];
  return trimmed;
}

function escapeA1SheetName(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

export const BulkSpreadsheetSyncPanel: React.FC<BulkSpreadsheetSyncPanelProps> = ({
  patients,
  accessToken,
  activeUser,
  onRequestGoogleSignIn,
  onBatchUpsertPatients,
  onViewCRF,
  onNavigateToData,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const savedSheetCfg = useMemo(() => {
    try {
      const raw = localStorage.getItem(SHEET_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as {
          spreadsheetUrl?: string;
          spreadsheetId?: string;
          sheetName?: string;
        };
      }
    } catch {
      // ignore storage errors
    }
    return {};
  }, []);

  // Auto-update setting (ON by default so upload/import updates Data, CRF & whole site automatically)
  const [autoApplyEnabled, setAutoApplyEnabled] = useState(true);
  const [draggingFile, setDraggingFile] = useState(false);

  // Parsed spreadsheet state (shared across Excel file & Google Sheet)
  const [sourceKind, setSourceKind] = useState<'excel' | 'gsheet' | null>(null);
  const [sourceLabel, setSourceLabel] = useState('');
  const [workbookRef, setWorkbookRef] = useState<XLSX.WorkBook | null>(null);
  const [excelSheetNames, setExcelSheetNames] = useState<string[]>([]);
  const [activeExcelSheet, setActiveExcelSheet] = useState('');
  const [grid, setGrid] = useState<ParsedSpreadsheetGrid | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<number, CrfColumnTarget | ''>>({});
  const [plan, setPlan] = useState<BulkSyncPlan | null>(null);
  const [mappingOpen, setMappingOpen] = useState(false);
  const [aiMappingBusy, setAiMappingBusy] = useState(false);

  // Sync status & audit feedback
  const [processingExcel, setProcessingExcel] = useState(false);
  const [applyingSync, setApplyingSync] = useState(false);
  const [appliedBanner, setAppliedBanner] = useState<{
    updatedCount: number;
    createdCount: number;
    timestamp: string;
    source: string;
  } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Google Sheets state
  const [sheetInput, setSheetInput] = useState(
    savedSheetCfg.spreadsheetUrl || savedSheetCfg.spreadsheetId || ''
  );
  const [googleSheetTitle, setGoogleSheetTitle] = useState('');
  const [googleTabs, setGoogleTabs] = useState<string[]>(
    savedSheetCfg.sheetName ? [savedSheetCfg.sheetName] : []
  );
  const [selectedGoogleTab, setSelectedGoogleTab] = useState(
    savedSheetCfg.sheetName || 'Patients_CRF'
  );
  const [loadingGoogleTabs, setLoadingGoogleTabs] = useState(false);
  const [syncingGoogleSheet, setSyncingGoogleSheet] = useState(false);

  const groupedFields = useMemo(() => {
    const groups = new Map<string, typeof CRF_FIELD_DEFINITIONS>();
    for (const def of CRF_FIELD_DEFINITIONS) {
      const list = groups.get(def.group) || [];
      list.push(def);
      groups.set(def.group, list);
    }
    return Array.from(groups.entries());
  }, []);

  const mappedColumnsCount = useMemo(
    () => Object.values(columnMapping).filter(Boolean).length,
    [columnMapping]
  );

  const applyPlanToWebsite = async (
    nextPlan: BulkSyncPlan,
    sourceName: string
  ) => {
    if (!onBatchUpsertPatients) return;
    const itemsToPersist: BatchUpsertInputItem[] = nextPlan.items
      .filter((item) => item.action === 'update' || item.action === 'create')
      .map((item) => ({
        matchedExistingKey: item.matchedExistingKey,
        patient: item.patient,
      }));

    if (itemsToPersist.length === 0) {
      setAppliedBanner({
        updatedCount: 0,
        createdCount: 0,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: sourceName,
      });
      return;
    }

    setApplyingSync(true);
    try {
      const res = await onBatchUpsertPatients(itemsToPersist);
      setAppliedBanner({
        updatedCount: res.updatedCount,
        createdCount: res.createdCount,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        source: sourceName,
      });
    } finally {
      setApplyingSync(false);
    }
  };

  const processParsedMatrix = async (
    rawMatrix: unknown[][],
    tabName: string,
    kind: 'excel' | 'gsheet',
    label: string,
    overrideMapping?: Record<number, CrfColumnTarget | ''>,
    forceAutoApply?: boolean
  ) => {
    const parsedGrid = parseSpreadsheetGrid(rawMatrix, tabName);
    if (parsedGrid.headers.length === 0 || parsedGrid.rows.length === 0) {
      throw new Error(
        `Sheet "${tabName}" has no readable patient rows. Ensure row 1 contains column headers and row 2+ contains patient entries.`
      );
    }

    const mapping = overrideMapping || autoMapSpreadsheetHeaders(parsedGrid.headers);
    const mappedCount = Object.values(mapping).filter(Boolean).length;
    const computedPlan = planBulkPatientSync({
      existingPatients: patients,
      headers: parsedGrid.headers,
      rows: parsedGrid.rows,
      mapping,
      activeUser,
    });

    setSourceKind(kind);
    setSourceLabel(label);
    setGrid(parsedGrid);
    setColumnMapping(mapping);
    setPlan(computedPlan);
    setAppliedBanner(null);

    if (mappedCount < parsedGrid.headers.length && mappedCount < 3) {
      setMappingOpen(true);
    }

    if (forceAutoApply ?? autoApplyEnabled) {
      await applyPlanToWebsite(computedPlan, label);
    }
  };

  const handleExcelFile = async (file: File) => {
    setProcessingExcel(true);
    setSyncError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        throw new Error('This spreadsheet file contains no worksheets.');
      }

      const firstSheet = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheet];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: '',
      });

      setWorkbookRef(wb);
      setExcelSheetNames(wb.SheetNames);
      setActiveExcelSheet(firstSheet);

      await processParsedMatrix(
        matrix,
        firstSheet,
        'excel',
        `${file.name} (${firstSheet})`
      );
    } catch (err: unknown) {
      setSyncError(
        err instanceof Error ? err.message : 'Unable to parse the uploaded Excel/CSV file.'
      );
    } finally {
      setProcessingExcel(false);
    }
  };

  const handleSwitchExcelSheet = async (sheetName: string) => {
    if (!workbookRef || !workbookRef.Sheets[sheetName]) return;
    setProcessingExcel(true);
    setSyncError(null);
    try {
      setActiveExcelSheet(sheetName);
      const ws = workbookRef.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
        header: 1,
        raw: true,
        defval: '',
      });
      const baseFile = sourceLabel.replace(/\s*\([^)]*\)$/, '') || 'Workbook';
      await processParsedMatrix(matrix, sheetName, 'excel', `${baseFile} (${sheetName})`);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Unable to load selected worksheet.');
    } finally {
      setProcessingExcel(false);
    }
  };

  const persistSheetConfig = (spreadsheetId: string, tabName: string) => {
    try {
      localStorage.setItem(
        SHEET_STORAGE_KEY,
        JSON.stringify({
          spreadsheetUrl: sheetInput.trim(),
          spreadsheetId,
          sheetName: tabName,
        })
      );
    } catch {
      // ignore storage errors
    }
  };

  const handleLoadGoogleSheetTabs = async () => {
    setSyncError(null);
    const spreadsheetId = extractSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      setSyncError('Paste a valid Google Sheet URL or Spreadsheet ID first.');
      return;
    }

    setLoadingGoogleTabs(true);
    try {
      const token = accessToken || (await onRequestGoogleSignIn());
      if (!token) {
        throw new Error('Google Sign-In with Google Sheets permission is required.');
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
        throw new Error(
          data?.error?.message || 'Unable to read Google Sheet metadata. Verify sharing access.'
        );
      }

      const tabTitles = (data.sheets || [])
        .map((s) => s.properties?.title || '')
        .filter(Boolean);

      setGoogleSheetTitle(data.properties?.title || 'Google Spreadsheet');
      setGoogleTabs(tabTitles);
      const nextTab = tabTitles.includes(selectedGoogleTab)
        ? selectedGoogleTab
        : tabTitles[0] || 'Sheet1';
      setSelectedGoogleTab(nextTab);
      persistSheetConfig(spreadsheetId, nextTab);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Failed to load Google Sheet tabs.');
    } finally {
      setLoadingGoogleTabs(false);
    }
  };

  const handleSyncGoogleSheet = async () => {
    setSyncError(null);
    const spreadsheetId = extractSpreadsheetId(sheetInput);
    if (!spreadsheetId) {
      setSyncError('Paste a Google Sheet URL or Spreadsheet ID first.');
      return;
    }

    setSyncingGoogleSheet(true);
    try {
      const token = accessToken || (await onRequestGoogleSignIn());
      if (!token) {
        throw new Error('Google Sign-In with Google Sheets permission is required.');
      }

      let tabName = selectedGoogleTab.trim();
      let titleLabel = googleSheetTitle;

      // Auto-fetch first tab name if user clicked Sync before clicking Load Tabs
      if (googleTabs.length === 0 || !tabName) {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
            spreadsheetId
          )}?fields=properties.title,sheets.properties.title`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const meta = await parseJsonSafe<{
          properties?: { title?: string };
          sheets?: Array<{ properties?: { title?: string } }>;
          error?: { message?: string };
        }>(metaRes);
        if (!metaRes.ok || !meta) {
          throw new Error(
            meta?.error?.message || 'Unable to access Google Sheet. Check permissions and URL.'
          );
        }
        const discoveredTabs = (meta.sheets || [])
          .map((s) => s.properties?.title || '')
          .filter(Boolean);
        titleLabel = meta.properties?.title || 'Google Spreadsheet';
        setGoogleSheetTitle(titleLabel);
        if (discoveredTabs.length > 0) {
          setGoogleTabs(discoveredTabs);
          if (!discoveredTabs.includes(tabName)) {
            tabName = discoveredTabs[0];
            setSelectedGoogleTab(tabName);
          }
        }
      }

      const targetRange = `${escapeA1SheetName(tabName || 'Sheet1')}!A1:ZZ1000`;
      const valuesRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
          spreadsheetId
        )}/values/${encodeURIComponent(targetRange)}?valueRenderOption=FORMATTED_VALUE`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const valuesData = await parseJsonSafe<{
        values?: unknown[][];
        error?: { message?: string };
      }>(valuesRes);

      if (!valuesRes.ok || !valuesData) {
        throw new Error(
          valuesData?.error?.message || 'Unable to read rows from the selected Google Sheet tab.'
        );
      }

      persistSheetConfig(spreadsheetId, tabName || 'Sheet1');
      await processParsedMatrix(
        valuesData.values || [],
        tabName || 'Sheet1',
        'gsheet',
        `${titleLabel || 'Google Sheet'} (${tabName || 'Sheet1'})`
      );
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Google Sheet sync failed.');
    } finally {
      setSyncingGoogleSheet(false);
    }
  };

  const handleAiSmartMapHeaders = async () => {
    if (!grid) return;
    setAiMappingBusy(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/ai/map-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          headers: grid.headers,
          sampleRows: grid.rows.slice(0, 3),
          validTargets: CRF_FIELD_DEFINITIONS.map((d) => ({
            key: d.key,
            label: d.label,
          })),
        }),
      });
      const data = await parseJsonSafe<{
        mappings?: Array<{ columnIndex: number; targetKey: string }>;
        error?: string;
      }>(res);
      if (!res.ok || !data) {
        throw new Error(data?.error || 'AI column mapping failed.');
      }

      const validSet = new Set<string>(CRF_FIELD_DEFINITIONS.map((d) => d.key));
      const mergedMapping = { ...columnMapping };
      for (const item of data.mappings || []) {
        if (
          typeof item.columnIndex === 'number' &&
          item.targetKey &&
          validSet.has(item.targetKey) &&
          !mergedMapping[item.columnIndex]
        ) {
          mergedMapping[item.columnIndex] = item.targetKey as CrfColumnTarget;
        }
      }

      setColumnMapping(mergedMapping);
      const updatedPlan = planBulkPatientSync({
        existingPatients: patients,
        headers: grid.headers,
        rows: grid.rows,
        mapping: mergedMapping,
        activeUser,
      });
      setPlan(updatedPlan);
      setAppliedBanner(null);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'AI column mapping failed.');
    } finally {
      setAiMappingBusy(false);
    }
  };

  const handleApplyMappingAndReSync = async () => {
    if (!grid) return;
    const recomputed = planBulkPatientSync({
      existingPatients: patients,
      headers: grid.headers,
      rows: grid.rows,
      mapping: columnMapping,
      activeUser,
    });
    setPlan(recomputed);
    await applyPlanToWebsite(recomputed, sourceLabel || grid.sheetName);
  };

  const handleDownloadSampleTemplate = () => {
    const matrix = buildSampleExcelMatrix();
    const ws = XLSX.utils.aoa_to_sheet(matrix);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Patients_CRF');
    XLSX.writeFile(wb, 'ClinicoData_MultiPatient_Import_Template.xlsx');
  };

  const handleOpenRowCRF = (row: BulkSyncRowPlan) => {
    if (!onViewCRF) return;
    const liveMatch = patients.find(
      (p) =>
        (row.patient.uhid && p.uhid.toUpperCase() === row.patient.uhid.toUpperCase()) ||
        (row.patient.patientName &&
          p.patientName.toLowerCase() === row.patient.patientName.toLowerCase())
    );
    onViewCRF(liveMatch || row.patient);
  };

  return (
    <div className="space-y-5 view-enter">
      {/* KPI Overview Strip */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EEF3F0]">
        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
            Dataset Patients
          </div>
          <div className="font-mono text-2xl font-bold text-[#14201B] tabular-nums">
            {patients.length}
          </div>
          <div className="text-[11px] text-[#6B8076]">
            Synced across Data, CRF &amp; Analytics
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
            Parsed Sheet Rows
          </div>
          <div className="font-mono text-2xl font-bold text-[#14201B] tabular-nums">
            {plan ? plan.summary.totalRows : 0}
          </div>
          <div className="text-[11px] text-[#6B8076] truncate">
            {sourceLabel || 'Upload Excel or load Google Sheet'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
            Matched Updates
          </div>
          <div className="font-mono text-2xl font-bold text-[#047857] tabular-nums">
            {plan ? plan.summary.toUpdate : 0}
          </div>
          <div className="text-[11px] text-[#6B8076] tabular-nums">
            {plan ? `${plan.summary.unchanged} already up to date` : 'Merges without wiping empty cells'}
          </div>
        </div>

        <div className="p-4 space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#4B6157]">
            New Enrollments
          </div>
          <div className="font-mono text-2xl font-bold text-[#053B2B] tabular-nums">
            {plan ? plan.summary.toCreate : 0}
          </div>
          <div className="text-[11px] text-[#6B8076] tabular-nums">
            {plan ? `${plan.summary.skipped} skipped rows` : 'Auto-assigns BMI, eGFR & Cluster'}
          </div>
        </div>
      </div>

      {/* Auto-Sync Setting & Template Strip */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:px-5 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#14201B] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoApplyEnabled}
            onChange={(e) => setAutoApplyEnabled(e.target.checked)}
            className="w-4 h-4 accent-[#047857] rounded"
          />
          <span>
            Auto-update <strong>Data tab, CRF &amp; whole website</strong> immediately on Excel upload or Sheet sync
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadSampleTemplate}
            className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-semibold text-[#053B2B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#047857]" />
            <span>Download Excel Template (.xlsx)</span>
          </button>

          {onNavigateToData && (
            <button
              type="button"
              onClick={onNavigateToData}
              className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#F6F9F7] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Table2 className="w-3.5 h-3.5 text-[#047857]" />
              <span>Open Data Tab</span>
            </button>
          )}
        </div>
      </div>

      {/* Dual Source Import Grid: Excel / CSV + Google Sheets */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Excel / CSV Multi-Patient Upload */}
        <section className="xl:col-span-6 bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-[#047857] shrink-0" />
              <h3 className="font-display text-base font-bold text-[#14201B]">
                Upload Multi-Patient Excel / CSV
              </h3>
            </div>
            <p className="text-xs text-[#4B6157]">
              Drop your master patient spreadsheet (.xlsx, .xls, .csv). Every row updates matched patients or creates new CRFs across the entire portal.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            aria-label="Upload multi-patient Excel or CSV file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleExcelFile(file);
              e.target.value = '';
            }}
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDraggingFile(true);
            }}
            onDragLeave={() => setDraggingFile(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDraggingFile(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleExcelFile(file);
            }}
            className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
              draggingFile
                ? 'border-[#047857] bg-[#EFF5F1]'
                : 'border-[#BFD5C9] bg-[#FAFDFB]'
            }`}
          >
            <FileSpreadsheet className="w-7 h-7 text-[#047857] mx-auto mb-2" />
            <div className="text-xs font-semibold text-[#14201B]">
              {processingExcel
                ? 'Reading workbook & updating patient records...'
                : 'Drag & drop multi-patient Excel (.xlsx / .xls / .csv)'}
            </div>
            <div className="text-[11px] text-[#6B8076] mt-1">
              Updates existing patients by UHID, phone, or Name; empty cells stay blank
            </div>
            <button
              type="button"
              disabled={processingExcel || applyingSync}
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{processingExcel ? 'Processing Excel...' : 'Choose Excel / CSV File'}</span>
            </button>
          </div>

          {excelSheetNames.length > 1 && sourceKind === 'excel' && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EEF3F0]">
              <label
                htmlFor="excel-sheet-select"
                className="text-xs font-medium text-[#4B6157]"
              >
                Worksheet Tab:
              </label>
              <select
                id="excel-sheet-select"
                value={activeExcelSheet}
                onChange={(e) => handleSwitchExcelSheet(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-white text-xs font-medium text-[#14201B]"
              >
                {excelSheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {/* Right: Google Sheets Live Sync */}
        <section className="xl:col-span-6 bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#047857] shrink-0" />
              <h3 className="font-display text-base font-bold text-[#14201B]">
                Import &amp; Sync from Google Sheets
              </h3>
            </div>
            <p className="text-xs text-[#4B6157]">
              Paste your Google Sheet link or ID to pull live patient rows directly into the Data tab, CRFs, and study analytics.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="gsheet-sync-url"
                className="block text-xs font-medium text-[#4B6157] mb-1"
              >
                Google Spreadsheet URL or ID
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  id="gsheet-sync-url"
                  type="text"
                  value={sheetInput}
                  onChange={(e) => setSheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs text-[#14201B] focus:outline-none focus:border-[#047857]"
                />
                <button
                  type="button"
                  disabled={loadingGoogleTabs || !sheetInput.trim()}
                  onClick={handleLoadGoogleSheetTabs}
                  className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] disabled:opacity-50 text-xs font-semibold text-[#053B2B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingGoogleTabs ? 'animate-spin' : ''}`} />
                  <span>{loadingGoogleTabs ? 'Loading...' : 'Load Tabs'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
              <div className="sm:col-span-6">
                <label
                  htmlFor="gsheet-tab-select"
                  className="block text-xs font-medium text-[#4B6157] mb-1"
                >
                  Sheet Tab {googleSheetTitle ? `(${googleSheetTitle})` : ''}
                </label>
                {googleTabs.length > 0 ? (
                  <select
                    id="gsheet-tab-select"
                    value={selectedGoogleTab}
                    onChange={(e) => setSelectedGoogleTab(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs text-[#14201B]"
                  >
                    {googleTabs.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="gsheet-tab-select"
                    type="text"
                    value={selectedGoogleTab}
                    onChange={(e) => setSelectedGoogleTab(e.target.value)}
                    placeholder="Patients_CRF"
                    className="w-full px-3 py-2 rounded-xl border border-[#DDE8E2] bg-white text-xs text-[#14201B]"
                  />
                )}
              </div>

              <div className="sm:col-span-6">
                <button
                  type="button"
                  disabled={syncingGoogleSheet || applyingSync || !sheetInput.trim()}
                  onClick={handleSyncGoogleSheet}
                  className="w-full px-4 py-2 rounded-xl bg-[#053B2B] hover:bg-[#042f22] disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingGoogleSheet ? 'animate-spin' : ''}`} />
                  <span>
                    {syncingGoogleSheet
                      ? 'Syncing Sheet...'
                      : sourceKind === 'gsheet'
                      ? 'Re-Sync Google Sheet'
                      : 'Import & Update Website'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="text-[11px] text-[#6B8076] pt-2 border-t border-[#EEF3F0] flex items-center justify-between gap-2">
            <span>
              {accessToken
                ? 'Google Sheets OAuth session connected'
                : 'Prompts Google Sign-In when loading or syncing a Sheet'}
            </span>
            {sheetInput.trim() && extractSpreadsheetId(sheetInput) && (
              <a
                href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(
                  extractSpreadsheetId(sheetInput)
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#047857] hover:underline font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span>Open Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </section>
      </div>

      {/* Error Alert */}
      {syncError && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{syncError}</span>
        </div>
      )}

      {/* Sync Confirmation / Manual Apply Banner */}
      {plan && (
        <div className="bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
          {appliedBanner ? (
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#053B2B]">
                  Website Automatically Updated — {appliedBanner.updatedCount} updated,{' '}
                  {appliedBanner.createdCount} new enrolled
                </div>
                <div className="text-xs text-[#4B6157] mt-0.5 truncate">
                  Source: {appliedBanner.source} · Synced at {appliedBanner.timestamp} to Data tab, CRF Viewer, Patient Profile &amp; Statistics
                </div>
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#14201B]">
                Sync Preview Ready — {plan.summary.toUpdate} updates, {plan.summary.toCreate} new patients
              </div>
              <div className="text-xs text-[#4B6157] mt-0.5">
                Review detected fields below or click Apply to push all entries across the entire portal.
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!appliedBanner && (plan.summary.toUpdate > 0 || plan.summary.toCreate > 0) && (
              <button
                type="button"
                disabled={applyingSync}
                onClick={() => applyPlanToWebsite(plan, sourceLabel || 'Spreadsheet')}
                className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{applyingSync ? 'Applying Updates...' : 'Apply Updates to Website'}</span>
              </button>
            )}

            {appliedBanner && onNavigateToData && (
              <button
                type="button"
                onClick={onNavigateToData}
                className="px-4 py-2 rounded-xl bg-[#053B2B] hover:bg-[#042f22] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <span>View All in Data Tab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collapsible Column Mapping Inspector */}
      {grid && (
        <section className="bg-white border border-[#DDE8E2] rounded-2xl overflow-hidden">
          <button
            type="button"
            aria-expanded={mappingOpen}
            onClick={() => setMappingOpen((v) => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAFDFB] transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#14201B]">
                Column Mapping Inspector
              </div>
              <div className="text-xs text-[#4B6157] tabular-nums">
                {mappedColumnsCount} of {grid.headers.length} columns mapped to CRF fields · Click to customize or run AI header matching
              </div>
            </div>
            {mappingOpen ? (
              <ChevronUp className="w-4 h-4 text-[#4B6157] shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#4B6157] shrink-0" />
            )}
          </button>

          {mappingOpen && (
            <div className="px-5 pb-5 pt-2 border-t border-[#EEF3F0] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[#4B6157]">
                  Verify or override how each spreadsheet column maps to ClinicoData CRF fields, then re-sync.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={aiMappingBusy}
                    onClick={handleAiSmartMapHeaders}
                    className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] disabled:opacity-60 text-xs font-semibold text-[#053B2B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#047857]" />
                    <span>{aiMappingBusy ? 'Mapping...' : 'AI Smart-Map Headers'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={applyingSync}
                    onClick={handleApplyMappingAndReSync}
                    className="px-3 py-1.5 rounded-lg bg-[#047857] hover:bg-[#065F46] disabled:opacity-60 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Apply Mapping &amp; Re-Sync
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#DDE8E2] rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-[#F6F9F7] border-b border-[#EEF3F0] text-[#4B6157]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Spreadsheet Column</th>
                      <th className="px-3 py-2 font-semibold">First Sample Value</th>
                      <th className="px-3 py-2 font-semibold">Target CRF Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF3F0]">
                    {grid.headers.map((header, idx) => {
                      const firstSample =
                        grid.rows.find((r) => (r[idx] || '').trim() !== '')?.[idx] || '—';
                      return (
                        <tr key={`${header}-${idx}`} className="bg-white">
                          <td className="px-3 py-2 font-medium text-[#14201B]">{header}</td>
                          <td className="px-3 py-2 font-mono text-[11px] text-[#6B8076] max-w-[200px] truncate">
                            {firstSample}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              aria-label={`Map column ${header}`}
                              value={columnMapping[idx] || ''}
                              onChange={(e) =>
                                setColumnMapping((prev) => ({
                                  ...prev,
                                  [idx]: e.target.value as CrfColumnTarget | '',
                                }))
                              }
                              className="w-full max-w-xs px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-white text-xs text-[#14201B]"
                            >
                              <option value="">Ignore / Unmapped</option>
                              {groupedFields.map(([groupName, defs]) => (
                                <optgroup key={groupName} label={groupName}>
                                  {defs.map((d) => (
                                    <option key={d.key} value={d.key}>
                                      {d.label}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Batch Sync Audit Table */}
      {plan && (
        <section className="bg-white border border-[#DDE8E2] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#EEF3F0] flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Batch Sync Audit ({plan.items.length} rows)
              </h3>
              <p className="text-[11px] text-[#4B6157]">
                Each matched or newly enrolled row is recalculated with BMI, WHR, eGFR, HOMA-IR/B, Blue Index &amp; Cluster rules.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-[#F6F9F7] border-b border-[#EEF3F0] text-[#4B6157]">
                <tr>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Row</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Patient</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">UHID</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Sync Action</th>
                  <th className="px-4 py-2.5 font-semibold">Updated / Imported Fields</th>
                  <th className="px-4 py-2.5 font-semibold whitespace-nowrap">Cluster</th>
                  <th className="px-4 py-2.5 font-semibold text-right whitespace-nowrap">CRF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F0]">
                {plan.items.map((item) => {
                  const statusTone =
                    item.action === 'update'
                      ? 'text-[#047857] bg-[#F2FBF6] border-[#BFD5C9]'
                      : item.action === 'create'
                      ? 'text-[#053B2B] bg-[#EFF5F1] border-[#BFD5C9]'
                      : item.action === 'unchanged'
                      ? 'text-[#4B6157] bg-[#F6F9F7] border-[#DDE8E2]'
                      : 'text-[#B45309] bg-amber-50 border-amber-200';

                  const actionText =
                    item.action === 'update'
                      ? 'Updated'
                      : item.action === 'create'
                      ? 'New Enrolled'
                      : item.action === 'unchanged'
                      ? 'Up to Date'
                      : 'Skipped';

                  return (
                    <tr key={`${item.rowIndex}-${item.rawId}-${item.rawName}`} className="hover:bg-[#FAFDFB]">
                      <td className="px-4 py-2.5 font-mono text-[#6B8076] tabular-nums">
                        #{item.rowIndex}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-[#14201B]">{item.rawName}</div>
                        <div className="text-[11px] text-[#6B8076]">{item.matchReason}</div>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-[#14201B] whitespace-nowrap">
                        {item.patient.uhid || '—'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${statusTone}`}
                        >
                          {actionText}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[11px] text-[#4B6157] max-w-md">
                        {item.action === 'skipped' ? (
                          <span className="text-amber-800">{item.skipReason}</span>
                        ) : item.changes.length === 0 ? (
                          <span className="text-[#6B8076]">No new changes</span>
                        ) : (
                          <span>
                            {item.changes
                              .slice(0, 4)
                              .map((c) => `${c.fieldLabel}: ${c.newValue}`)
                              .join(' · ')}
                            {item.changes.length > 4 ? ` (+${item.changes.length - 4} more)` : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-[#053B2B] whitespace-nowrap">
                        {item.patient.clusterType || '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {item.action !== 'skipped' && onViewCRF && (
                          <button
                            type="button"
                            onClick={() => handleOpenRowCRF(item)}
                            className="px-2.5 py-1 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[11px] font-semibold text-[#053B2B] inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            <span>Open CRF</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};
