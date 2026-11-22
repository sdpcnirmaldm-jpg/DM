import React, { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  Bell,
  Edit3,
  FileText,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Users,
  Calendar,
  FlaskConical,
  X,
} from 'lucide-react';
import type { MissingFieldItem, PatientCRF, StatusColor } from '../types/clinical';
import { evaluateMissingDataAndStatus } from '../utils/clinicalMath';
import {
  buildDashboardSideQueue,
  buildMonthCalendarCells,
  doesPatientMatchDate,
  getInitialDashboardCalendarState,
  summarizePendingFields,
} from '../utils/dashboardCalendar';
import { getPatientKey } from '../utils/statisticalCharts';
import { StatusLegend } from './StatusLegend';
import { DoubleConfirmDeleteModal } from './DoubleConfirmDeleteModal';
import type { FormTabKey } from './ClinicalCollectionView';

interface DashboardViewProps {
  patients: PatientCRF[];
  isInvestigator: boolean;
  userName?: string;
  onNewPatient: () => void;
  onEditPatient: (patient: PatientCRF, targetTab?: FormTabKey) => void;
  onViewCRF: (patient: PatientCRF) => void;
  onDeletePatient: (patient: PatientCRF) => void;
}

const STATUS_CONFIG: Record<
  StatusColor,
  { dotClass: string; badgeClass: string; shortLabel: string; legend: string }
> = {
  green: {
    dotClass: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    shortLabel: 'Complete',
    legend: 'All data entered',
  },
  yellow: {
    dotClass: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    shortLabel: '2nd HbA1c Pending',
    legend: 'Only 2nd HbA1c pending',
  },
  orange: {
    dotClass: 'bg-orange-500',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
    shortLabel: 'Reports Pending',
    legend: 'Only 2nd HbA1c / FibroScan / Beta-cell pending',
  },
  red: {
    dotClass: 'bg-red-600',
    badgeClass: 'bg-red-50 text-red-800 border-red-200',
    shortLabel: 'Multiple Pending',
    legend: 'Multiple clinical fields pending',
  },
};

const CLUSTER_COLORS: Record<string, string> = {
  SIDD: '#047857',
  SIRD: '#D97706',
  CIRDD: '#BE185D',
  MARD: '#7C3AED',
};

export const DashboardView: React.FC<DashboardViewProps> = ({
  patients,
  isInvestigator,
  userName,
  onNewPatient,
  onEditPatient,
  onViewCRF,
  onDeletePatient,
}) => {
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<string>('All');
  const [clusterFilter, setClusterFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('FollowupDate');
  const [contributorFilter, setContributorFilter] = useState<string>('All');
  const [sideMode, setSideMode] = useState<'patient' | 'followup' | 'pending'>('patient');

  // Calendar state (defaults to today's real local month, year, and date on first open)
  const initialCalendar = useMemo(() => getInitialDashboardCalendarState(), []);
  const [calYear, setCalYear] = useState(initialCalendar.calYear);
  const [calMonth, setCalMonth] = useState(initialCalendar.calMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialCalendar.selectedDate);
  const [filterRegistryByDate, setFilterRegistryByDate] = useState(false);

  // Quick-inspect patient modal/drawer (shows exact missing fields when clicked)
  const [inspectPatient, setInspectPatient] = useState<PatientCRF | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<PatientCRF | null>(null);

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

  const enrichedPatients = useMemo(() => {
    return patients.map((p) => {
      const evaluation = evaluateMissingDataAndStatus(p);
      return {
        patient: { ...p, statusColor: evaluation.statusColor },
        missingFields: evaluation.missingFields,
        statusLabel: evaluation.statusLabel,
      };
    });
  }, [patients]);

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = enrichedPatients.filter(({ patient }) => {
      if (genderFilter !== 'All' && patient.gender !== genderFilter) return false;
      if (
        clusterFilter === 'Unassigned'
          ? Boolean(patient.clusterType)
          : clusterFilter !== 'All' && patient.clusterType !== clusterFilter
      ) {
        return false;
      }
      if (
        isInvestigator &&
        contributorFilter !== 'All' &&
        (patient.investigatorEmail || '').trim().toLowerCase() !== contributorFilter.toLowerCase()
      ) {
        return false;
      }
      if (statusFilter === 'Complete' && patient.statusColor !== 'green') return false;
      if (statusFilter === 'AllPending' && patient.statusColor === 'green') return false;
      if (
        statusFilter === 'ReportPending' &&
        patient.statusColor !== 'yellow' &&
        patient.statusColor !== 'orange'
      ) {
        return false;
      }
      if (statusFilter === 'MultiplePending' && patient.statusColor !== 'red') return false;
      if (
        filterRegistryByDate &&
        selectedDate &&
        !doesPatientMatchDate(patient, selectedDate)
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

    if (statusFilter === 'FollowupDate') {
      return [...list].sort((a, b) =>
        (a.patient.followUpDate || '9999-99-99').localeCompare(
          b.patient.followUpDate || '9999-99-99'
        )
      );
    }
    return list;
  }, [
    enrichedPatients,
    search,
    genderFilter,
    clusterFilter,
    statusFilter,
    selectedDate,
    filterRegistryByDate,
    contributorFilter,
    isInvestigator,
  ]);

  // 4 Summary Metrics + Status Breakdown
  const stats = useMemo(() => {
    const total = enrichedPatients.length;
    const monthPrefix = `${calYear}-${String(calMonth + 1).padStart(2, '0')}`;
    const monthEntries = enrichedPatients.filter((e) =>
      e.patient.dateOfRecruitment.startsWith(monthPrefix)
    );
    const thisMonth = monthEntries.length;
    const monthPending = monthEntries.filter((e) => e.patient.statusColor !== 'green').length;
    const complete = enrichedPatients.filter((e) => e.patient.statusColor === 'green').length;
    const pending = total - complete;
    const hba1c2Missing = enrichedPatients.filter((e) => e.patient.hba1c2.value === null).length;

    const statusCounts: Record<StatusColor, number> = {
      green: 0,
      yellow: 0,
      orange: 0,
      red: 0,
    };
    const breakdownSource = thisMonth > 0 ? monthEntries : enrichedPatients;
    for (const e of breakdownSource) {
      statusCounts[e.patient.statusColor] += 1;
    }

    return {
      total,
      thisMonth,
      monthPending,
      complete,
      pending,
      hba1c2Missing,
      statusCounts,
      breakdownCount: breakdownSource.length,
      breakdownIsMonth: thisMonth > 0,
    };
  }, [enrichedPatients, calYear, calMonth]);

  // Calendar grid generation
  const calendarDays = useMemo(
    () => buildMonthCalendarCells(calYear, calMonth),
    [calYear, calMonth]
  );

  const dateDotsMap = useMemo(() => {
    const map: Record<string, StatusColor[]> = {};
    for (let i = 0; i < enrichedPatients.length; i++) {
      const { patient } = enrichedPatients[i];
      const uniqueDates = new Set(
        [patient.dateOfRecruitment, patient.followUpDate].filter(Boolean)
      );
      for (const dateKey of uniqueDates) {
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(patient.statusColor);
      }
    }
    return map;
  }, [enrichedPatients]);

  const sideListPatients = useMemo(
    () =>
      buildDashboardSideQueue({
        items: enrichedPatients,
        sideMode,
        selectedDate,
        filterRegistryByDate,
      }),
    [enrichedPatients, selectedDate, sideMode, filterRegistryByDate]
  );

  const clusterCoverage = useMemo(() => {
    const total = Math.max(patients.length, 1);
    const counts: Record<string, number> = { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 };
    for (const p of patients) {
      if (p.clusterType in counts) {
        counts[p.clusterType] += 1;
      }
    }
    return ['SIDD', 'SIRD', 'CIRDD', 'MARD'].map((c) => ({
      name: c,
      count: counts[c],
      pct: Math.round((counts[c] / total) * 100),
      color: CLUSTER_COLORS[c],
    }));
  }, [patients]);

  const monthLabel = new Date(calYear, calMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const shiftMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setCalMonth(m);
    setCalYear(y);
  };

  const handleJumpToToday = () => {
    const fresh = getInitialDashboardCalendarState();
    setCalYear(fresh.calYear);
    setCalMonth(fresh.calMonth);
    setSelectedDate(fresh.todayIso);
    setFilterRegistryByDate(false);
  };

  const handleSelectCalendarDate = (iso: string) => {
    if (selectedDate === iso && filterRegistryByDate) {
      setSelectedDate(null);
      setFilterRegistryByDate(false);
    } else {
      setSelectedDate(iso);
      setFilterRegistryByDate(true);
    }
  };

  const isViewingToday =
    calYear === initialCalendar.calYear &&
    calMonth === initialCalendar.calMonth &&
    selectedDate === initialCalendar.todayIso &&
    !filterRegistryByDate;

  const firstName = useMemo(() => {
    const trimmed = (userName || '').trim();
    if (!trimmed) return 'Investigator';
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && /^(dr|prof|mr|mrs|ms)\.?$/i.test(parts[0])) {
      return `${parts[0]} ${parts[1]}`;
    }
    return parts[0];
  }, [userName]);

  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    const [y, m, d] = selectedDate.split('-').map(Number);
    if (!y || !m || !d) return selectedDate;
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  return (
    <div className="space-y-5">
      {/* Greeting Header & Primary Enrollment CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4 view-enter">
        <div className="space-y-1">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#047857]">
            Dashboard
          </div>
          <h2 className="font-display text-2xl sm:text-[28px] font-bold tracking-tight text-[#14201B] leading-tight">
            Hello, {firstName}
          </h2>
          <p className="text-xs sm:text-sm text-[#4B6157]">
            Phenotypic classification of T2DM · data collection overview
          </p>
        </div>

        <button
          type="button"
          onClick={onNewPatient}
          className="px-4 py-2.5 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#14201B] text-sm font-semibold transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 shadow-[0_8px_18px_-10px_rgba(217,119,6,0.65)]"
        >
          <Plus className="w-4 h-4" />
          <span>New Patient</span>
        </button>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 view-enter stagger-1">
        <button
          type="button"
          onClick={() => {
            setStatusFilter('FollowupDate');
            setFilterRegistryByDate(false);
          }}
          className="text-left card-elevate rounded-2xl bg-gradient-to-br from-[#053B2B] via-[#064533] to-[#045A41] text-white p-4 sm:p-5 shadow-[0_12px_26px_-16px_rgba(5,59,43,0.65)] flex flex-col justify-between gap-3 cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-200/90">
              Total Collections
            </span>
            <Users className="w-4 h-4 text-emerald-300/85 shrink-0" />
          </div>
          <div>
            <div className="font-mono text-3xl font-bold tabular-nums leading-none">
              {stats.total}
            </div>
            <div className="text-xs text-emerald-100/80 mt-1.5">patients enrolled</div>
          </div>
        </button>

        <div className="card-elevate rounded-2xl bg-white border border-[#DDE8E2] p-4 sm:p-5 shadow-[0_4px_16px_-12px_rgba(5,59,43,0.16)] flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B6157]">
              This Month
            </span>
            <Calendar className="w-4 h-4 text-[#6B8076] shrink-0" />
          </div>
          <div>
            <div className="font-mono text-3xl font-bold text-[#14201B] tabular-nums leading-none">
              {stats.thisMonth}
            </div>
            <div className="text-xs text-[#6B8076] mt-1.5">
              {stats.monthPending} pending this month
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'Complete' ? 'FollowupDate' : 'Complete')
          }
          className={`text-left card-elevate rounded-2xl bg-white border p-4 sm:p-5 shadow-[0_4px_16px_-12px_rgba(5,59,43,0.16)] flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
            statusFilter === 'Complete'
              ? 'border-[#047857] ring-2 ring-[#047857]/20'
              : 'border-[#DDE8E2] hover:border-[#A7C9B8]'
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B6157]">
              Complete
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          </div>
          <div>
            <div className="font-mono text-3xl font-bold text-[#047857] tabular-nums leading-none">
              {stats.complete}
            </div>
            <div className="text-xs text-[#6B8076] mt-1.5">all CRF &amp; labs entered</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setStatusFilter(statusFilter === 'AllPending' ? 'FollowupDate' : 'AllPending')
          }
          className={`text-left card-elevate rounded-2xl bg-white border p-4 sm:p-5 shadow-[0_4px_16px_-12px_rgba(5,59,43,0.16)] flex flex-col justify-between gap-3 cursor-pointer transition-colors ${
            statusFilter === 'AllPending'
              ? 'border-amber-500 ring-2 ring-amber-400/25'
              : 'border-[#DDE8E2] hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2 w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#4B6157]">
              Pending Completion
            </span>
            <FlaskConical className="w-4 h-4 text-amber-600 shrink-0" />
          </div>
          <div>
            <div className="font-mono text-3xl font-bold text-amber-700 tabular-nums leading-none">
              {stats.pending}
            </div>
            <div className="text-xs text-[#6B8076] mt-1.5">
              {stats.hba1c2Missing} missing 2nd HbA1c
            </div>
          </div>
        </button>
      </div>

      {/* Interactive Status Legend Bar */}
      <StatusLegend
        activeStatusFilter={statusFilter}
        onSelectStatusFilter={(val) => setStatusFilter(val)}
        selectedDate={filterRegistryByDate ? selectedDate : null}
        onClearDate={() => {
          setSelectedDate(null);
          setFilterRegistryByDate(false);
        }}
      />

      {/* Main Split: Patient Registry + Cluster Coverage (Left) | Calendar + Date/Study Queue (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
        {/* Left Column: Filters + Patient Table + Phenotype Cluster Coverage */}
        <div className="space-y-4 min-w-0">
          {/* Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2 view-enter stagger-1">
            <div className="relative flex-1 min-w-[165px]">
              <Search className="w-3.5 h-3.5 text-[#6B8076] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search patient name or UHID..."
                aria-label="Search patients"
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#047857]/25 focus:border-[#047857]"
              />
            </div>

            <select
              aria-label="Filter by gender"
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
            >
              <option value="All">All Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>

            <select
              aria-label="Filter by cluster"
              value={clusterFilter}
              onChange={(e) => setClusterFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
            >
              <option value="All">All Cluster</option>
              <option value="SIDD">SIDD</option>
              <option value="SIRD">SIRD</option>
              <option value="CIRDD">CIRDD</option>
              <option value="MARD">MARD</option>
              <option value="Unassigned">Unassigned</option>
            </select>

            <select
              aria-label="Filter by completion status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
            >
              <option value="FollowupDate">Follow-up Date wise</option>
              <option value="AllPending">All Pending ({stats.pending})</option>
              <option value="Complete">Complete</option>
              <option value="ReportPending">Report pending</option>
              <option value="MultiplePending">Multiple pending</option>
            </select>

            {isInvestigator && (
              <select
                aria-label="Filter by login participant"
                value={contributorFilter}
                onChange={(e) => setContributorFilter(e.target.value)}
                className="px-2.5 py-2 bg-white border border-[#DDE8E2] rounded-xl text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
              >
                <option value="All">All Participants ({patients.length})</option>
                {contributorOptions.map((c) => (
                  <option key={c.email} value={c.email}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Patient Data Table */}
          <div className="bg-white border border-[#DDE8E2] rounded-2xl overflow-hidden view-enter stagger-1 shadow-[0_6px_22px_-16px_rgba(5,59,43,0.18)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#DDE8E2] bg-[#F6F9F7] text-[10.5px] font-semibold uppercase tracking-wider text-[#4B6157]">
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">UHID</th>
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-1.5">Gender</th>
                    <th className="py-3 px-1.5 text-right">Age</th>
                    <th className="py-3 px-1.5">Cluster</th>
                    <th className="py-3 px-1.5 text-right">HbA1c</th>
                    <th className="py-3 px-1.5 text-right">BMI</th>
                    <th className="py-3 px-2">Follow-up</th>
                    <th className="py-3 px-2">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F0] text-xs">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 px-6 text-center text-[#4B6157]">
                        <div className="font-medium text-[#14201B]">
                          {patients.length === 0
                            ? 'No patient records under your login yet'
                            : 'No matching patient records'}
                        </div>
                        <p className="text-xs mt-1">
                          {patients.length === 0
                            ? 'Enroll your first patient CRF or upload a lab report in AI Analysis to populate your study workspace.'
                            : 'Clear active filters or enroll a new study participant.'}
                        </p>
                        {patients.length === 0 && (
                          <button
                            type="button"
                            onClick={onNewPatient}
                            className="mt-3 px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add First Patient</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map(({ patient, missingFields }, idx) => {
                      const cfg = STATUS_CONFIG[patient.statusColor];
                      return (
                        <tr
                          key={getPatientKey(patient, idx)}
                          onClick={() => setInspectPatient(patient)}
                          className="row-interactive cursor-pointer"
                        >
                          <td className="py-2.5 px-2">
                            <span
                              className={`inline-block w-3 h-3 rounded-full ${cfg.dotClass}`}
                              title={cfg.legend}
                              aria-label={cfg.shortLabel}
                            />
                          </td>
                          <td className="py-2.5 px-2 font-mono text-xs text-[#14201B] whitespace-nowrap">
                            <div>{patient.uhid || '—'}</div>
                          </td>
                          <td className="py-2.5 px-2 font-medium text-[#14201B] whitespace-nowrap">
                            <div>{patient.patientName || 'Unnamed Participant'}</div>
                            {isInvestigator && patient.investigatorName && (
                              <div className="text-[11px] font-normal text-[#6B8076]">
                                By {patient.investigatorName}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-1.5 text-[#4B6157] text-xs">{patient.gender || '—'}</td>
                          <td className="py-2.5 px-1.5 text-right font-mono tabular-nums text-xs">
                            {patient.age ?? '—'}
                          </td>
                          <td className="py-2.5 px-1.5">
                            <span className="font-mono text-xs font-semibold text-[#053B2B]">
                              {patient.clusterType || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-mono tabular-nums text-xs">
                            {patient.hba1c1.value !== null ? `${patient.hba1c1.value}%` : '—'}
                          </td>
                          <td className="py-2.5 px-1.5 text-right font-mono tabular-nums text-xs">
                            {patient.bmi !== null ? patient.bmi.toFixed(1) : '—'}
                          </td>
                          <td className="py-2.5 px-2 font-mono text-xs text-[#4B6157] whitespace-nowrap">
                            {patient.followUpDate || '—'}
                          </td>
                          <td className="py-2.5 px-2">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${cfg.badgeClass}`}
                            >
                              {missingFields.length === 0 ? '0 pending' : `${missingFields.length} pending`}
                            </span>
                            {missingFields.length > 0 && (
                              <div
                                className="text-[10px] text-[#6B8076] mt-0.5 max-w-[140px] truncate"
                                title={missingFields.map((m) => m.label).join(', ')}
                              >
                                {summarizePendingFields(missingFields, 2)}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phenotype Cluster Coverage Bar */}
          <div className="card-elevate stagger-4 bg-white border border-[#DDE8E2] rounded-2xl p-4 space-y-3 shadow-[0_6px_20px_-14px_rgba(5,59,43,0.14)]">
            <div className="flex items-center justify-between text-xs font-semibold text-[#14201B]">
              <span>Phenotype Cluster Coverage</span>
              <span className="font-mono text-[#047857] bg-[#EFF7F3] px-2 py-0.5 rounded-md tabular-nums">
                {patients.length} total
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-[#EEF3F0] gap-[1px]">
              {clusterCoverage.map((seg) =>
                seg.count > 0 ? (
                  <div
                    key={seg.name}
                    style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
                    className="transition-all duration-500 ease-out first:rounded-l-full last:rounded-r-full"
                    title={`${seg.name}: ${seg.count} (${seg.pct}%)`}
                  />
                ) : null
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {clusterCoverage.map((seg) => (
                <div
                  key={seg.name}
                  className="rounded-xl bg-[#F7FAF8] border border-[#EEF3F0] px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#14201B]">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span>{seg.name}</span>
                  </div>
                  <div className="font-mono text-xs text-[#4B6157] tabular-nums">
                    <span className="font-semibold text-[#14201B]">{seg.pct}%</span>{' '}
                    <span className="text-[11px] text-[#6B8076]">({seg.count})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Date Calendar & Date/Study Queue Card */}
        <div className="space-y-4">
          {/* Interactive Calendar (Highlighted tiles with collection counts & dots) */}
          <div className="card-elevate stagger-2 bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:p-5 shadow-[0_6px_22px_-16px_rgba(5,59,43,0.16)]">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-base sm:text-lg font-bold text-[#14201B] tracking-tight">
                {monthLabel}
              </h3>
              <div className="flex items-center gap-1.5">
                {!isViewingToday && (
                  <button
                    type="button"
                    onClick={handleJumpToToday}
                    className="px-2.5 py-1 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1] text-[11px] font-semibold text-[#047857] transition-colors whitespace-nowrap"
                  >
                    Today
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="p-1.5 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1] text-[#4B6157] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="p-1.5 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1] text-[#4B6157] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-[#6B8076] mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                <div key={`${d}-${idx}`}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calendarDays.map((cell, idx) => {
                if (!cell.day || !cell.iso) {
                  return <div key={`empty-${idx}`} className="min-h-[44px]" />;
                }
                const dots = dateDotsMap[cell.iso] || [];
                const isSelected = selectedDate === cell.iso;
                const isToday = cell.iso === initialCalendar.todayIso;
                const hasActivity = dots.length > 0;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    aria-label={isToday ? `${cell.day} ${monthLabel} (Today)` : `${cell.day} ${monthLabel}`}
                    onClick={() => handleSelectCalendarDate(cell.iso!)}
                    className={`min-h-[44px] rounded-xl flex flex-col items-center justify-center py-1 transition-all ${
                      isSelected
                        ? 'bg-[#053B2B] text-white font-semibold shadow-sm ring-2 ring-[#053B2B]/20'
                        : isToday
                        ? 'bg-[#EFF7F3] border border-[#047857] text-[#053B2B] font-semibold'
                        : hasActivity
                        ? 'bg-[#F3FBF7] border border-emerald-300/80 hover:bg-[#E6F6EE] text-[#14201B]'
                        : 'hover:bg-[#F6F9F7] text-[#4B6157]'
                    }`}
                  >
                    <span className="text-xs font-medium leading-none">{cell.day}</span>
                    {hasActivity && (
                      <>
                        <span
                          className={`text-[10px] font-mono font-bold leading-none mt-1 tabular-nums ${
                            isSelected ? 'text-emerald-200' : 'text-[#047857]'
                          }`}
                        >
                          {dots.length}
                        </span>
                        <span className="flex items-center gap-0.5 mt-1">
                          {dots.slice(0, 4).map((c, i) => (
                            <span
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-emerald-300' : STATUS_CONFIG[c].dotClass
                              }`}
                            />
                          ))}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Date / Study Queue Card */}
          <div className="card-elevate stagger-3 bg-white border border-[#DDE8E2] rounded-2xl p-4 sm:p-5 space-y-3 shadow-[0_6px_22px_-16px_rgba(5,59,43,0.16)]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#EEF3F0]">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-[#14201B] truncate">
                  {sideMode === 'pending' && !filterRegistryByDate
                    ? 'Pending Data'
                    : sideMode === 'followup' && !filterRegistryByDate
                    ? 'Follow-up Schedule'
                    : formattedSelectedDate || 'Study Queue'}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono font-semibold text-[#047857] bg-[#EFF7F3] px-2 py-0.5 rounded-md tabular-nums">
                  {sideListPatients.length}{' '}
                  {sideMode === 'pending'
                    ? 'pending'
                    : sideMode === 'followup' && !filterRegistryByDate
                    ? 'scheduled'
                    : selectedDate
                    ? 'collected'
                    : 'patients'}
                </span>
                <select
                  aria-label="Side queue view mode"
                  value={sideMode}
                  onChange={(e) => setSideMode(e.target.value as 'patient' | 'followup' | 'pending')}
                  className="px-2 py-1 bg-[#F6F9F7] hover:bg-[#EFF5F1] border border-[#DDE8E2] rounded-lg text-[11px] font-medium text-[#14201B] focus:outline-none focus:border-[#047857] transition-colors"
                >
                  <option value="patient">1. Patient</option>
                  <option value="followup">2. Follow up</option>
                  <option value="pending">3. Pending</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5 max-h-[228px] overflow-y-auto pr-1">
              {sideListPatients.length === 0 ? (
                <div className="py-7 px-3 text-center text-xs text-[#6B8076] space-y-2">
                  <div>
                    {sideMode === 'pending' && filterRegistryByDate && selectedDate
                      ? `No pending patients on ${formattedSelectedDate}.`
                      : selectedDate && sideMode === 'patient'
                      ? 'No patients collected on this day. Pick a highlighted date.'
                      : 'No patients in this queue filter.'}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {selectedDate && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(null);
                          setFilterRegistryByDate(false);
                        }}
                        className="text-xs font-medium text-[#047857] hover:underline"
                      >
                        {sideMode === 'pending' ? `Show all ${stats.pending} pending` : 'Show all patients'}
                      </button>
                    )}
                    {sideMode !== 'pending' && stats.pending > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setSideMode('pending');
                          setFilterRegistryByDate(false);
                        }}
                        className="text-xs font-medium text-amber-700 hover:underline"
                      >
                        View {stats.pending} pending
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                sideListPatients.map(({ patient, missingFields }, idx) => {
                  const cfg = STATUS_CONFIG[patient.statusColor];
                  return (
                    <div
                      key={`side-${getPatientKey(patient, idx)}`}
                      className="group flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl border border-[#EEF3F0] hover:border-[#A7C9B8] bg-[#FAFDFB] hover:bg-[#F2FBF6] transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setInspectPatient(patient)}
                        className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                      >
                        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                        <div className="min-w-0">
                          <div className="text-xs sm:text-[13px] font-semibold text-[#14201B] group-hover:text-[#053B2B] truncate transition-colors">
                            {patient.patientName || 'Unnamed Participant'}
                          </div>
                          <div className="text-[11px] font-mono text-[#6B8076] truncate">
                            {patient.uhid || '—'} [{patient.gender ? patient.gender[0] : '?'}-
                            {patient.age ?? '?'}]
                          </div>
                          {missingFields.length > 0 && (
                            <div className="text-[10.5px] text-amber-800 truncate">
                              Pending: {summarizePendingFields(missingFields, 2)}
                            </div>
                          )}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setInspectPatient(patient)}
                        aria-label={`View pending items for ${patient.patientName}`}
                        title={
                          missingFields.length > 0
                            ? `${missingFields.length} fields remaining: ${missingFields
                                .map((m) => m.label)
                                .join(', ')}`
                            : 'Complete'
                        }
                        className={`px-2 py-1 rounded-lg border text-[11px] shrink-0 inline-flex items-center gap-1 transition-colors ${
                          missingFields.length > 0
                            ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {missingFields.length > 0 ? (
                          <>
                            <Bell className="w-3 h-3" />
                            <span className="font-mono font-semibold">{missingFields.length}</span>
                          </>
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Cohort / Month Status Breakdown Strip */}
            <div className="pt-2.5 border-t border-[#EEF3F0] space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6B8076]">
                {stats.breakdownIsMonth
                  ? `This Month · ${stats.breakdownCount} Patients`
                  : `All Enrolled · ${stats.breakdownCount} Patients`}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'Complete' ? 'FollowupDate' : 'Complete')}
                  className="px-2 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-[11px] font-medium hover:bg-emerald-100 transition-colors tabular-nums text-center"
                >
                  Complete: {stats.statusCounts.green}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'ReportPending' ? 'FollowupDate' : 'ReportPending')}
                  className="px-2 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-medium hover:bg-amber-100 transition-colors tabular-nums text-center"
                >
                  2nd HbA1c: {stats.statusCounts.yellow}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'ReportPending' ? 'FollowupDate' : 'ReportPending')}
                  className="px-2 py-1.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 text-[11px] font-medium hover:bg-orange-100 transition-colors tabular-nums text-center"
                >
                  Reports: {stats.statusCounts.orange}
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter(statusFilter === 'MultiplePending' ? 'FollowupDate' : 'MultiplePending')}
                  className="px-2 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-[11px] font-medium hover:bg-red-100 transition-colors tabular-nums text-center"
                >
                  Multiple: {stats.statusCounts.red}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Quick-Inspect & Remaining Data Modal */}
      {inspectPatient && (
        <PatientInspectModal
          patient={inspectPatient}
          onClose={() => setInspectPatient(null)}
          onEdit={(tab) => {
            const p = inspectPatient;
            setInspectPatient(null);
            onEditPatient(p, tab);
          }}
          onViewCRF={() => {
            const p = inspectPatient;
            setInspectPatient(null);
            onViewCRF(p);
          }}
          onRequestDelete={() => {
            const p = inspectPatient;
            setInspectPatient(null);
            setConfirmDelete(p);
          }}
        />
      )}

      {/* 2-Step Delete Confirmation Dialog */}
      <DoubleConfirmDeleteModal
        open={Boolean(confirmDelete)}
        title="Delete Patient Record?"
        itemName={confirmDelete?.patientName || 'Unnamed Participant'}
        itemMeta={
          confirmDelete ? `UHID ${confirmDelete.uhid || '—'}` : undefined
        }
        description="This permanently removes the patient's entire CRF, laboratory values, medications, and attached clinical reports."
        confirmLabel="Yes, Delete Patient Record"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          onDeletePatient(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
};

interface PatientInspectModalProps {
  patient: PatientCRF;
  onClose: () => void;
  onEdit: (tab?: FormTabKey) => void;
  onViewCRF: () => void;
  onRequestDelete: () => void;
}

const PatientInspectModal: React.FC<PatientInspectModalProps> = ({
  patient,
  onClose,
  onEdit,
  onViewCRF,
  onRequestDelete,
}) => {
  const { missingFields, statusColor, statusLabel } = evaluateMissingDataAndStatus(patient);
  const cfg = STATUS_CONFIG[statusColor];

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4">
      <div className="modal-pop-in bg-white border border-[#DDE8E2] rounded-2xl max-w-2xl w-full max-h-[88vh] flex flex-col overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#DDE8E2] flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#4B6157]">
              <span>UHID {patient.uhid || '—'}</span>
              <span aria-hidden="true">·</span>
              <span>
                {patient.gender || 'Unspecified'} · {patient.age ?? '?'} yrs
              </span>
            </div>
            <h3 className="font-display text-xl font-bold text-[#14201B] mt-0.5">
              {patient.patientName || 'Unnamed Participant'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inspector"
            className="p-2 rounded-lg hover:bg-[#F6F9F7] text-[#4B6157]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Quick Clinical Snapshot */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2]">
              <div className="text-[11px] text-[#4B6157]">Cluster</div>
              <div className="font-mono text-base font-bold text-[#053B2B] mt-0.5">
                {patient.clusterType || '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2]">
              <div className="text-[11px] text-[#4B6157]">Blue Index</div>
              <div className="font-mono text-base font-bold text-[#14201B] mt-0.5 tabular-nums">
                {patient.dhsTotal ?? '—'}/50 : {patient.ksTotal ?? '—'}/15
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2]">
              <div className="text-[11px] text-[#4B6157]">HbA1c (1st / 2nd)</div>
              <div className="font-mono text-base font-bold text-[#14201B] mt-0.5 tabular-nums">
                {patient.hba1c1.value ?? '—'}% / {patient.hba1c2.value ?? '—'}%
              </div>
            </div>
            <div className="p-3 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2]">
              <div className="text-[11px] text-[#4B6157]">DDS-17 Mean</div>
              <div className="font-mono text-base font-bold text-[#14201B] mt-0.5 tabular-nums">
                {patient.ddsMean ?? '—'}
              </div>
            </div>
          </div>

          {/* Remaining / Unfilled Data */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14201B]">
                {missingFields.length > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <span>Remaining &amp; Unfilled Data</span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-md border text-xs font-medium ${cfg.badgeClass}`}>
                {statusLabel}
              </span>
            </div>

            {missingFields.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                All required CRF sections, lab investigations, and follow-up HbA1c values are
                complete.
              </div>
            ) : (
              <div className="divide-y divide-[#EEF3F0] border border-[#DDE8E2] rounded-xl overflow-hidden">
                {missingFields.map((item: MissingFieldItem) => (
                  <div
                    key={item.key}
                    className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm bg-white"
                  >
                    <div>
                      <div className="font-medium text-[#14201B]">{item.label}</div>
                      <div className="text-xs text-[#6B8076]">{item.section}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEdit(item.tab)}
                      className="px-2.5 py-1 rounded-lg bg-[#F6F9F7] hover:bg-[#E7F2EC] text-xs font-medium text-[#047857] inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Fill Now</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#DDE8E2] bg-[#F6F9F7] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onRequestDelete}
            className="px-3.5 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete</span>
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onViewCRF}
              className="px-3.5 py-2 rounded-xl border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-sm font-medium text-[#14201B] inline-flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-[#047857]" />
              <span>View CRF</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit('remaining')}
              className="px-3.5 py-2 rounded-xl border border-[#047857] text-[#047857] bg-white hover:bg-emerald-50 text-sm font-medium"
            >
              Fill Remaining Data
            </button>
            <button
              type="button"
              onClick={() => onEdit('info')}
              className="px-4 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-sm font-semibold inline-flex items-center gap-1.5"
            >
              <Edit3 className="w-4 h-4" />
              <span>Edit Patient</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
