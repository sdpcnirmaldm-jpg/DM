import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit3,
  FileText,
  HeartPulse,
  Microscope,
  Pill,
  Plus,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  UserCheck,
} from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import {
  evaluateMissingDataAndStatus,
  toCreatinineMgDl,
  toGlucoseMgDl,
  toLipidMgDl,
} from '../utils/clinicalMath';
import {
  buildBlueIndexDomainBars,
  buildDdsSubscaleBars,
  buildPatientClinicalProblems,
  buildPatientDrugHealthLinks,
  buildPatientGlycemicTimeline,
  type GlycemicTrajectoryPoint,
} from '../utils/patientJourney';
import {
  CLUSTER_META,
  getPatientKey,
  resolveOptionalPatientCluster,
} from '../utils/statisticalCharts';

interface PatientProfileViewProps {
  patients: PatientCRF[];
  selectedParticipantId: string | null;
  onSelectParticipant: (participantId: string) => void;
  onViewCRF: (patient: PatientCRF) => void;
  onEditPatient: (patient: PatientCRF) => void;
  onNewPatient: () => void;
}

type DrugFilter = 'all' | 'Antidiabetic' | 'Concomitant';
type RecordTab = 'overview' | 'labs' | 'specialized';

const KpiRing: React.FC<{
  pct: number;
  color: string;
  animKey: number;
  delayMs?: number;
}> = ({ pct, color, animKey, delayMs = 0 }) => {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const safePct = Number.isFinite(pct) ? pct : 0;
  const clamped = Math.max(0, Math.min(100, safePct));
  const offset = circ * (1 - clamped / 100);
  return (
    <svg
      key={`${color}-${clamped}-${animKey}`}
      viewBox="0 0 40 40"
      className="w-10 h-10 -rotate-90 shrink-0"
      aria-hidden="true"
    >
      <circle cx={20} cy={20} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={3.5} />
      <circle
        cx={20}
        cy={20}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        className="chart-ring-sweep"
        style={
          {
            '--ring-circ': circ,
            '--ring-offset': offset,
            animationDelay: `${delayMs}ms`,
          } as React.CSSProperties
        }
      />
    </svg>
  );
};

function fmtVal(v: number | null | undefined, suffix = ''): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return suffix ? `${v} ${suffix}` : String(v);
}

const DataRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-4 py-2 border-b border-[#EEF4F0] last:border-b-0 text-xs">
    <span className="text-[#4B6157]">{label}</span>
    <span className="font-mono tabular-nums font-medium text-[#14201B] text-right">{value}</span>
  </div>
);

export const PatientProfileView: React.FC<PatientProfileViewProps> = ({
  patients,
  selectedParticipantId,
  onSelectParticipant,
  onViewCRF,
  onEditPatient,
  onNewPatient,
}) => {
  const [animKey, setAnimKey] = useState(0);
  const [drugFilter, setDrugFilter] = useState<DrugFilter>('all');
  const [recordTab, setRecordTab] = useState<RecordTab>('overview');
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);

  const activeIndex = useMemo(() => {
    if (patients.length === 0) return -1;
    if (!selectedParticipantId) return 0;
    const idx = patients.findIndex(
      (p) =>
        getPatientKey(p) === selectedParticipantId ||
        (Boolean(p.participantId) && p.participantId === selectedParticipantId)
    );
    return idx >= 0 ? idx : 0;
  }, [patients, selectedParticipantId]);

  const activePatient = activeIndex >= 0 ? patients[activeIndex] : null;

  const trajectory = useMemo(
    () => (activePatient ? buildPatientGlycemicTimeline(activePatient) : null),
    [activePatient]
  );

  const problems = useMemo(
    () => (activePatient ? buildPatientClinicalProblems(activePatient) : []),
    [activePatient]
  );

  const drugLinks = useMemo(
    () => (activePatient ? buildPatientDrugHealthLinks(activePatient) : []),
    [activePatient]
  );

  const blueIndexBars = useMemo(
    () => (activePatient ? buildBlueIndexDomainBars(activePatient) : []),
    [activePatient]
  );

  const ddsBars = useMemo(
    () => (activePatient ? buildDdsSubscaleBars(activePatient) : []),
    [activePatient]
  );

  const missingEval = useMemo(
    () => (activePatient ? evaluateMissingDataAndStatus(activePatient) : null),
    [activePatient]
  );

  const visibleDrugs = useMemo(() => {
    if (drugFilter === 'all') return drugLinks;
    return drugLinks.filter((d) => d.category === drugFilter);
  }, [drugLinks, drugFilter]);

  if (!activePatient || !trajectory || !missingEval) {
    return (
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-10 text-center max-w-2xl mx-auto">
        <HeartPulse className="w-10 h-10 text-[#047857] mx-auto mb-3" />
        <h2 className="font-display text-xl font-bold text-[#14201B]">
          No Patient Selected
        </h2>
        <p className="text-sm text-[#4B6157] mt-1.5 mb-5">
          Add a clinical participant record to inspect their disease trajectory, active complications, and medication response.
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

  const clusterCode = resolveOptionalPatientCluster(activePatient);
  const clusterMeta = clusterCode ? CLUSTER_META[clusterCode] : null;
  const activeKey = getPatientKey(activePatient, activeIndex);
  const safeSvgKey = activeKey.replace(/[^a-zA-Z0-9_-]/g, '_');

  const switchByDelta = (delta: number) => {
    if (patients.length <= 1) return;
    const nextIdx = (activeIndex + delta + patients.length) % patients.length;
    onSelectParticipant(getPatientKey(patients[nextIdx], nextIdx));
    setHoveredPointId(null);
    setAnimKey((k) => k + 1);
  };

  // Trajectory chart SVG geometry
  const svgW = 600;
  const svgH = 232;
  const padL = 56;
  const padR = 54;
  const padT = 22;
  const padB = 40;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;
  const pts = trajectory.trajectoryPoints;
  const allVals = [...pts.map((p) => p.hba1cPct), trajectory.targetHba1c, 5.5, 10.5];
  const minVal = Math.max(4, Math.floor(Math.min(...allVals) - 0.5));
  const maxVal = Math.min(16, Math.ceil(Math.max(...allVals) + 0.5));
  const valSpan = Math.max(1, maxVal - minVal);

  const yForVal = (val: number) => padT + ((maxVal - val) / valSpan) * innerH;
  const targetY = yForVal(trajectory.targetHba1c);
  const projectedFollowUpY = yForVal(trajectory.followUpProjection.projectedHba1c);
  const baselineAlreadyControlled = trajectory.followUpProjection.alreadyControlled;

  const plottedPoints: Array<GlycemicTrajectoryPoint & { x: number; y: number }> = pts.map(
    (pt, idx) => {
      const x =
        pts.length === 1
          ? padL + innerW * 0.25
          : padL + (idx / (pts.length - 1)) * innerW;
      const y = yForVal(pt.hba1cPct);
      return { ...pt, x, y };
    }
  );

  const linePath =
    plottedPoints.length >= 2
      ? plottedPoints
          .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ')
      : '';

  const areaPath =
    plottedPoints.length >= 2
      ? `${linePath} L ${plottedPoints[plottedPoints.length - 1].x.toFixed(1)} ${(
          padT + innerH
        ).toFixed(1)} L ${plottedPoints[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : '';

  const activeHoverPoint =
    plottedPoints.find((p) => p.id === hoveredPointId) ||
    plottedPoints[plottedPoints.length - 1] ||
    null;

  // Derived labs for dossier tables
  const fbgMg = toGlucoseMgDl(activePatient.fbg.value, activePatient.fbg.unit);
  const ppbgMg = toGlucoseMgDl(activePatient.ppbg.value, activePatient.ppbg.unit);
  const rbsMg = toGlucoseMgDl(activePatient.rbs.value, activePatient.rbs.unit);
  const tcMg = toLipidMgDl(activePatient.totalCholesterol.value, activePatient.totalCholesterol.unit, 'chol');
  const tgMg = toLipidMgDl(activePatient.triglycerides.value, activePatient.triglycerides.unit, 'tg');
  const hdlMg = toLipidMgDl(activePatient.hdl.value, activePatient.hdl.unit, 'chol');
  const ldlMg = toLipidMgDl(activePatient.ldl.value, activePatient.ldl.unit, 'chol');
  const creatMg = toCreatinineMgDl(activePatient.serumCreatinine.value, activePatient.serumCreatinine.unit);

  const latestA1c = trajectory.latestHba1c;
  const a1cRingPct = latestA1c !== null ? Math.min(100, Math.round((latestA1c / 14) * 100)) : 0;
  const dhsRingPct =
    activePatient.dhsTotal !== null ? Math.round((activePatient.dhsTotal / 50) * 100) : 0;
  const ksRingPct =
    activePatient.ksTotal !== null ? Math.round((activePatient.ksTotal / 15) * 100) : 0;
  const ddsRingPct =
    activePatient.ddsMean !== null ? Math.round((activePatient.ddsMean / 6) * 100) : 0;

  return (
    <div key={`${activeKey}-${animKey}`} className="space-y-6 pb-8">
      {/* Top Patient Switcher & Quick Action Bar */}
      <div className="bg-white border border-[#DDE8E2] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 min-w-0 flex-1">
          <label
            htmlFor="patient-profile-selector"
            className="text-xs font-semibold text-[#4B6157] whitespace-nowrap"
          >
            Patient Dossier
          </label>
          <div className="flex items-center gap-1.5 min-w-0 w-full sm:w-auto sm:min-w-[240px] max-w-md flex-1">
            <button
              type="button"
              onClick={() => switchByDelta(-1)}
              disabled={patients.length <= 1}
              aria-label="Previous patient"
              className="p-2 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#053B2B] disabled:opacity-40 shrink-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              id="patient-profile-selector"
              value={activeKey}
              onChange={(e) => {
                onSelectParticipant(e.target.value);
                setHoveredPointId(null);
                setAnimKey((k) => k + 1);
              }}
              className="min-w-0 w-full px-3 py-2 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
            >
              {patients.map((p, idx) => {
                const pKey = getPatientKey(p, idx);
                const pCluster = resolveOptionalPatientCluster(p);
                return (
                  <option key={pKey} value={pKey}>
                    {p.uhid || 'No UHID'} — {p.patientName || 'Unnamed'} ({pCluster || 'Unassigned'})
                  </option>
                );
              })}
            </select>
            <button
              type="button"
              onClick={() => switchByDelta(1)}
              disabled={patients.length <= 1}
              aria-label="Next patient"
              className="p-2 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-[#053B2B] disabled:opacity-40 shrink-0"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#4B6157] whitespace-nowrap">
            {activeIndex + 1} / {patients.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setAnimKey((k) => k + 1)}
            className="px-3.5 py-2 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#047857]" />
            <span>Replay Visuals</span>
          </button>
          <button
            type="button"
            onClick={() => onViewCRF(activePatient)}
            className="px-3.5 py-2 rounded-lg border border-[#DDE8E2] bg-white hover:bg-[#EFF5F1] text-[#053B2B] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <FileText className="w-3.5 h-3.5 text-[#047857]" />
            <span>Open CRF</span>
          </button>
          <button
            type="button"
            onClick={() => onEditPatient(activePatient)}
            className="px-3.5 py-2 rounded-lg bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Patient</span>
          </button>
        </div>
      </div>

      {/* Section 1: Executive Patient Hero + 4 Animated Radial Gauges */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#053B2B] via-[#064E3B] to-[#022C22] text-white p-6 md:p-7 shadow-sm">
        <div className="hero-sheen" aria-hidden="true" />
        {/* Subtle Clinical Telemetry ECG / Glucose Background Trace */}
        <svg
          viewBox="0 0 640 110"
          className="absolute right-0 top-0 h-44 w-[420px] opacity-20 pointer-events-none"
          aria-hidden="true"
        >
          <path
            d="M0 64 L90 64 L112 64 L126 36 L142 90 L158 18 L174 78 L192 64 L290 64 L312 64 L326 40 L340 84 L356 26 L372 74 L390 64 L520 64"
            fill="none"
            stroke="#6EE7B7"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="clinical-ecg-trace"
          />
          <path
            d="M0 84 Q120 48, 240 72 T480 56 T640 66"
            fill="none"
            stroke="#34D399"
            strokeWidth="1.4"
            className="clinical-glucose-wave"
          />
        </svg>

        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-emerald-200/90">
                <span>UHID {activePatient.uhid || '—'}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {clusterMeta ? `${clusterMeta.code} (${clusterMeta.fullName})` : 'Cluster Unassigned'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{missingEval.statusLabel}</span>
              </div>

              <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-white">
                {activePatient.patientName || 'Unnamed Participant'}
              </h1>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-emerald-100/85">
                <span>{activePatient.gender || 'Gender Unspecified'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{fmtVal(activePatient.age, 'yrs')}</span>
                <span aria-hidden="true">·</span>
                <span>DOB {activePatient.dob || '—'}</span>
                <span aria-hidden="true">·</span>
                <span>Blood Group {activePatient.bloodGroup || '—'}</span>
                <span aria-hidden="true">·</span>
                <span>Visit {activePatient.visitNo || '—'}</span>
                <span aria-hidden="true">·</span>
                <span>Recruited {activePatient.dateOfRecruitment || '—'}</span>
                <span aria-hidden="true">·</span>
                <span>Follow-up {activePatient.followUpDate || '—'}</span>
              </div>
            </div>

            <div className="text-right text-xs text-emerald-100/85 space-y-1 shrink-0">
              <div className="font-medium text-white">
                Investigator: {activePatient.investigatorName || '—'}
              </div>
              <div className="font-mono text-[11px] text-emerald-200/80">
                Diagnosis: {activePatient.diagnosisMonthYear || '—'}
                {activePatient.durationYears !== null
                  ? ` (${activePatient.durationYears}y ${activePatient.durationMonths ?? 0}m)`
                  : ''}
              </div>
            </div>
          </div>

          {/* 4 Animated Radial Health Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="analysis-stagger-1 bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 flex items-center gap-3">
              <KpiRing
                pct={a1cRingPct}
                color={latestA1c !== null && latestA1c < trajectory.targetHba1c ? '#34D399' : '#FBBF24'}
                animKey={animKey}
                delayMs={40}
              />
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100/80">
                  {trajectory.trajectoryPoints.length > 1 ? 'Follow-up HbA1c' : 'Baseline HbA1c'}
                </div>
                <div className="font-mono tabular-nums text-xl font-bold text-white">
                  {latestA1c !== null ? `${latestA1c.toFixed(1)}%` : '—'}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-emerald-200 truncate">
                  {trajectory.deltaHba1c !== null
                    ? `${trajectory.deltaHba1c > 0 ? '+' : ''}${trajectory.deltaHba1c.toFixed(1)}% vs ${trajectory.baselineHba1c?.toFixed(1)}%`
                    : latestA1c !== null && latestA1c < trajectory.targetHba1c
                    ? `Good Control · <${trajectory.targetHba1c.toFixed(1)}%`
                    : `Target <${trajectory.targetHba1c.toFixed(1)}%`}
                </div>
              </div>
            </div>

            <div className="analysis-stagger-2 bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 flex items-center gap-3">
              <KpiRing pct={dhsRingPct} color="#6EE7B7" animKey={animKey} delayMs={110} />
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100/80">Blue Index (DHS)</div>
                <div className="font-mono tabular-nums text-xl font-bold text-white">
                  {activePatient.dhsTotal !== null ? `${activePatient.dhsTotal} / 50` : '—'}
                </div>
                <div className="text-[11px] text-emerald-200 truncate">
                  {activePatient.dhsCategory || '—'} · {activePatient.blueIndexRatio || '—'}
                </div>
              </div>
            </div>

            <div className="analysis-stagger-3 bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 flex items-center gap-3">
              <KpiRing
                pct={ksRingPct}
                color={(activePatient.ksTotal ?? 0) >= 6 ? '#FB7185' : '#FCD34D'}
                animKey={animKey}
                delayMs={180}
              />
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100/80">Known Severity (KS)</div>
                <div className="font-mono tabular-nums text-xl font-bold text-white">
                  {activePatient.ksTotal !== null ? `${activePatient.ksTotal} / 15` : '—'}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-emerald-200 truncate">
                  Macro {activePatient.ksMacrovascular ?? '—'} · Micro {activePatient.ksMicrovascular ?? '—'} · Foot {activePatient.ksFootNeuropathy ?? '—'}
                </div>
              </div>
            </div>

            <div className="analysis-stagger-4 bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-3.5 flex items-center gap-3">
              <KpiRing
                pct={ddsRingPct}
                color={(activePatient.ddsMean ?? 0) >= 3 ? '#FB7185' : '#34D399'}
                animKey={animKey}
                delayMs={250}
              />
              <div className="min-w-0">
                <div className="text-[11px] text-emerald-100/80">DDS-17 Mean</div>
                <div className="font-mono tabular-nums text-xl font-bold text-white">
                  {activePatient.ddsMean !== null ? `${activePatient.ddsMean.toFixed(2)} / 6` : '—'}
                </div>
                <div className="text-[11px] text-emerald-200 truncate">
                  {activePatient.ddsCategory || '—'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Disease Improvement Over Time + Chronological Journey */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Animated Glycemic Improvement Curve */}
        <div className="lg:col-span-7 analysis-stagger-1 bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-[#047857]" />
                  <span>Disease Condition &amp; Glycemic Improvement Over Time</span>
                </h2>
                <p className="text-xs text-[#4B6157] mt-0.5">
                  {plottedPoints.length === 1 && baselineAlreadyControlled
                    ? `Baseline HbA1c (${trajectory.baselineHba1c?.toFixed(1)}%) is already within the good <${trajectory.targetHba1c.toFixed(1)}% range; follow-up monitors maintenance.`
                    : `Serial HbA1c trajectory tracked from baseline recruitment against the <${trajectory.targetHba1c.toFixed(1)}% treatment target.`}
                </p>
              </div>
              <div className="text-right">
                <div className="inline-flex items-center gap-1 font-mono tabular-nums text-sm font-bold text-[#053B2B]">
                  {trajectory.deltaHba1c !== null ? (
                    <>
                      {trajectory.deltaHba1c <= 0 ? (
                        <ArrowDownRight className="w-4 h-4 text-[#047857]" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-600" />
                      )}
                      <span>
                        {trajectory.deltaHba1c > 0 ? '+' : ''}
                        {trajectory.deltaHba1c.toFixed(1)}%
                      </span>
                      {trajectory.pctChange !== null && (
                        <span className="text-xs font-normal text-[#4B6157]">
                          ({trajectory.pctChange > 0 ? '+' : ''}
                          {trajectory.pctChange}%)
                        </span>
                      )}
                    </>
                  ) : (
                    <span>{trajectory.trendStatus}</span>
                  )}
                </div>
                <div className="text-[11px] text-[#4B6157]">
                  {trajectory.deltaHba1c !== null
                    ? trajectory.trendStatus
                    : plottedPoints.length > 0
                    ? trajectory.followUpProjection.summaryCaption
                    : 'Awaiting Baseline HbA1c'}
                </div>
              </div>
            </div>

            {plottedPoints.length > 0 ? (
              <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-3">
                <div className="flex items-center justify-end gap-3 mb-1 px-1">
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-[#047857]">
                    <span className="inline-block w-4 border-t-2 border-dashed border-[#059669]" />
                    <span>Good Control (&lt;{trajectory.targetHba1c.toFixed(1)}%)</span>
                  </span>
                </div>
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full h-56 overflow-visible"
                  role="img"
                  aria-label="Patient HbA1c improvement trajectory chart"
                >
                  <defs>
                    <linearGradient id={`a1cGrad-${safeSvgKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#047857" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="#047857" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Target green zone (< 7.0%) */}
                  <rect
                    x={padL}
                    y={targetY}
                    width={innerW}
                    height={Math.max(0, padT + innerH - targetY)}
                    fill="#ECFDF5"
                    opacity="0.85"
                  />
                  <line
                    x1={padL}
                    x2={padL + innerW}
                    y1={targetY}
                    y2={targetY}
                    stroke="#059669"
                    strokeDasharray="5 4"
                    strokeWidth="1.2"
                  />
                  <text
                    x={padL + innerW + 8}
                    y={targetY + 3}
                    textAnchor="start"
                    className="fill-[#047857] text-[10px] font-mono font-semibold tabular-nums"
                  >
                    {trajectory.targetHba1c.toFixed(1)}%
                  </text>

                  {/* Horizontal reference ticks */}
                  {[minVal, Math.round((minVal + maxVal) / 2), maxVal].map((tick) => {
                    const ty = yForVal(tick);
                    return (
                      <g key={tick}>
                        <line
                          x1={padL}
                          x2={padL + innerW}
                          y1={ty}
                          y2={ty}
                          stroke="#DDE8E2"
                          strokeWidth="1"
                        />
                        <text
                          x={padL - 8}
                          y={ty + 3}
                          textAnchor="end"
                          className="fill-[#4B6157] text-[10px] font-mono tabular-nums"
                        >
                          {tick}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Gradient area & animated path */}
                  {areaPath && (
                    <path
                      d={areaPath}
                      fill={`url(#a1cGrad-${safeSvgKey})`}
                      className="journey-area-fade"
                    />
                  )}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#047857"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="journey-line-draw"
                    />
                  )}

                  {/* Single-point projection dashed path when 2nd HbA1c pending */}
                  {plottedPoints.length === 1 && (
                    <path
                      data-testid="hba1c-followup-projection"
                      data-controlled={baselineAlreadyControlled ? 'true' : 'false'}
                      d={
                        baselineAlreadyControlled
                          ? `M ${plottedPoints[0].x.toFixed(1)} ${plottedPoints[0].y.toFixed(1)} L ${(
                              padL +
                              innerW * 0.85
                            ).toFixed(1)} ${projectedFollowUpY.toFixed(1)}`
                          : `M ${plottedPoints[0].x.toFixed(1)} ${plottedPoints[0].y.toFixed(1)} Q ${(
                              padL +
                              innerW * 0.6
                            ).toFixed(1)} ${((plottedPoints[0].y + projectedFollowUpY) / 2).toFixed(1)} ${(
                              padL +
                              innerW * 0.85
                            ).toFixed(1)} ${projectedFollowUpY.toFixed(1)}`
                      }
                      fill="none"
                      stroke={baselineAlreadyControlled ? '#047857' : '#D97706'}
                      strokeWidth="2"
                      strokeDasharray="6 5"
                      className="journey-line-draw"
                    />
                  )}

                  {/* Interactive Data Nodes */}
                  {plottedPoints.map((pt, idx) => {
                    const isHovered = activeHoverPoint?.id === pt.id;
                    const color =
                      pt.hba1cPct < trajectory.targetHba1c
                        ? '#047857'
                        : pt.kind === 'followup'
                        ? '#059669'
                        : '#D97706';
                    return (
                      <g
                        key={pt.id}
                        className="cursor-pointer chart-scale-in"
                        style={{
                          transformOrigin: `${pt.x}px ${pt.y}px`,
                          animationDelay: `${160 + idx * 140}ms`,
                        }}
                        onMouseEnter={() => setHoveredPointId(pt.id)}
                        onClick={() => setHoveredPointId(pt.id)}
                      >
                        <circle cx={pt.x} cy={pt.y} r={isHovered ? 12 : 9} fill={color} opacity="0.16" />
                        <circle cx={pt.x} cy={pt.y} r={6} fill="#FFFFFF" stroke={color} strokeWidth="3" />
                        <text
                          x={pt.x}
                          y={pt.y - 12}
                          textAnchor="middle"
                          className="fill-[#14201B] text-[11px] font-mono font-bold tabular-nums"
                        >
                          {pt.hba1cPct.toFixed(1)}%
                        </text>
                        <text
                          x={pt.x}
                          y={svgH - 20}
                          textAnchor="middle"
                          className="fill-[#14201B] text-[10px] font-medium"
                        >
                          {pt.label}
                        </text>
                        <text
                          x={pt.x}
                          y={svgH - 6}
                          textAnchor="middle"
                          className="fill-[#4B6157] text-[9px] font-mono tabular-nums"
                        >
                          {pt.date}
                        </text>
                      </g>
                    );
                  })}

                  {plottedPoints.length === 1 && (
                    <g>
                      <circle
                        data-testid="hba1c-followup-node"
                        cx={padL + innerW * 0.85}
                        cy={projectedFollowUpY}
                        r={5}
                        fill={baselineAlreadyControlled ? '#ECFDF5' : '#FFFBEB'}
                        stroke={baselineAlreadyControlled ? '#047857' : '#D97706'}
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                      <text
                        x={padL + innerW * 0.85}
                        y={projectedFollowUpY - 12}
                        textAnchor="middle"
                        className={`${
                          baselineAlreadyControlled ? 'fill-[#047857]' : 'fill-[#92400E]'
                        } text-[10px] font-mono font-semibold`}
                      >
                        {trajectory.followUpProjection.nodeHint}
                      </text>
                      <text
                        x={padL + innerW * 0.85}
                        y={svgH - 20}
                        textAnchor="middle"
                        className={`${
                          baselineAlreadyControlled ? 'fill-[#047857]' : 'fill-[#92400E]'
                        } text-[10px] font-medium`}
                      >
                        2nd HbA1c Due
                      </text>
                      <text
                        x={padL + innerW * 0.85}
                        y={svgH - 6}
                        textAnchor="middle"
                        className="fill-[#4B6157] text-[9px] font-mono"
                      >
                        {activePatient.followUpDate || 'Pending'}
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            ) : (
              <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-6 text-xs text-[#4B6157]">
                No HbA1c laboratory values recorded yet for trajectory plotting.
              </div>
            )}
          </div>

          {/* Glycemic & Metabolic Snapshot Grid to balance 2-column height */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-3">
                <div className="text-[11px] text-[#4B6157]">Glycemic Profile</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#14201B] mt-0.5">
                  FBG {fmtVal(fbgMg)} · PPBG {fmtVal(ppbgMg)}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#4B6157] mt-0.5">
                  mg/dL · RBS {fmtVal(rbsMg, 'mg/dL')}
                </div>
              </div>

              <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-3">
                <div className="text-[11px] text-[#4B6157]">Islet &amp; Resistance</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#14201B] mt-0.5">
                  HOMA-B {fmtVal(activePatient.homaB, '%')}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#4B6157] mt-0.5">
                  HOMA-IR {fmtVal(activePatient.homaIR)} · C-Pep {fmtVal(activePatient.cPeptide.value, activePatient.cPeptide.unit)}
                </div>
              </div>

              <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-3">
                <div className="text-[11px] text-[#4B6157]">Vitals &amp; Cardiorenal</div>
                <div className="font-mono tabular-nums text-sm font-bold text-[#14201B] mt-0.5">
                  {activePatient.sbp !== null && activePatient.dbp !== null
                    ? `${activePatient.sbp}/${activePatient.dbp} mmHg`
                    : '—'}
                </div>
                <div className="text-[11px] font-mono tabular-nums text-[#4B6157] mt-0.5">
                  BMI {fmtVal(activePatient.bmi)} · eGFR {fmtVal(activePatient.egfr)}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#EEF4F0] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-[#4B6157]">
                {activeHoverPoint ? (
                  <span>
                    Selected: <strong className="text-[#14201B]">{activeHoverPoint.label}</strong> ({activeHoverPoint.date}) —{' '}
                    <strong className="font-mono tabular-nums text-[#047857]">
                      {activeHoverPoint.hba1cPct.toFixed(1)}%
                    </strong>
                  </span>
                ) : (
                  <span>Awaiting longitudinal HbA1c observations.</span>
                )}
              </div>
              <div className="font-mono tabular-nums text-[#14201B]">
                {drugLinks.filter((d) => d.status === 'Current').length} Active Meds ·{' '}
                {problems.filter((p) => p.severity !== 'controlled').length} Flagged Risks
              </div>
            </div>
          </div>
        </div>

        {/* Right: Animated Chronological Care Timeline */}
        <div className="lg:col-span-5 analysis-stagger-2 bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col">
          <div className="mb-4">
            <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#047857]" />
              <span>Chronological Clinical Journey</span>
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Progression from initial diagnosis through enrollment, pharmacotherapy, and follow-up.
            </p>
          </div>

          <div className="relative pl-6 space-y-4 flex-1">
            <div
              className="journey-spine-reveal absolute left-2.5 top-2 bottom-2 w-0.5 bg-[#DDE8E2]"
              aria-hidden="true"
            />
            {trajectory.timelineEvents.map((ev, idx) => {
              const nodeTone =
                ev.tone === 'emerald'
                  ? 'bg-[#047857] ring-emerald-100'
                  : ev.tone === 'amber'
                  ? 'bg-amber-500 ring-amber-100'
                  : ev.tone === 'rose'
                  ? 'bg-rose-600 ring-rose-100'
                  : 'bg-[#4B6157] ring-slate-100';
              return (
                <div
                  key={ev.id}
                  className="relative analysis-panel-enter"
                  style={{ animationDelay: `${80 + idx * 80}ms` }}
                >
                  <span
                    className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full ring-4 ${nodeTone}`}
                    aria-hidden="true"
                  />
                  <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#4B6157]">
                      <span className="font-semibold text-[#053B2B]">{ev.phase}</span>
                      <span className="font-mono tabular-nums">{ev.date}</span>
                    </div>
                    <div className="text-xs font-semibold text-[#14201B] mt-0.5">{ev.title}</div>
                    <p className="text-xs text-[#4B6157] mt-1 leading-relaxed">{ev.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3: What Are The Clinical Problems (Organ-by-Organ Breakdown) */}
      <section className="analysis-stagger-3 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-[#047857]" />
              <span>Identified Clinical Problems &amp; Organ Risk Profile</span>
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Active metabolic, hepatic, cardiorenal, microvascular, and psychosocial findings derived from the patient&apos;s CRF.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-[#4B6157]">
            {problems.filter((p) => p.severity === 'critical').length} Critical ·{' '}
            {problems.filter((p) => p.severity === 'moderate').length} Moderate ·{' '}
            {problems.filter((p) => p.severity === 'controlled').length} Controlled
          </div>
        </div>

        {problems.length === 0 ? (
          <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-5 text-xs text-[#4B6157]">
            Complete laboratory and clinical examination tabs to generate automated organ-system problem profiling.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {problems.map((prob, idx) => {
              const barColor =
                prob.severity === 'critical'
                  ? 'bg-rose-600'
                  : prob.severity === 'moderate'
                  ? 'bg-amber-500'
                  : 'bg-[#047857]';
              const toneText =
                prob.severity === 'critical'
                  ? 'text-rose-700'
                  : prob.severity === 'moderate'
                  ? 'text-amber-700'
                  : 'text-[#047857]';
              const SeverityIcon =
                prob.severity === 'critical'
                  ? AlertTriangle
                  : prob.severity === 'moderate'
                  ? Activity
                  : CheckCircle2;

              return (
                <div
                  key={prob.id}
                  className="card-elevate bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-4 flex flex-col justify-between gap-3 analysis-panel-enter"
                  style={{ animationDelay: `${idx * 65}ms` }}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-semibold text-[#4B6157]">{prob.system}</span>
                      <span className={`inline-flex items-center gap-1 font-semibold ${toneText}`}>
                        <SeverityIcon className="w-3.5 h-3.5" />
                        <span>
                          {prob.severity === 'critical'
                            ? 'High Priority'
                            : prob.severity === 'moderate'
                            ? 'Moderate'
                            : 'Controlled'}
                        </span>
                      </span>
                    </div>

                    <h3 className="font-display text-sm font-bold text-[#14201B]">
                      {prob.title}
                    </h3>

                    <div className="text-xs font-mono tabular-nums text-[#053B2B] font-medium">
                      {prob.reading}
                    </div>

                    <p className="text-xs text-[#4B6157] leading-relaxed">{prob.explanation}</p>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-[#4B6157]">
                      <span>Target: {prob.target}</span>
                      <span className="font-mono tabular-nums">{prob.severityScore}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#DDE8E2] overflow-hidden">
                      <div
                        className={`h-full rounded-full journey-bar-fill ${barColor}`}
                        style={{
                          width: `${prob.severityScore}%`,
                          animationDelay: `${140 + idx * 65}ms`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 4: Prescribed Drugs & How Each Drug Improves Patient Health */}
      <section className="analysis-stagger-4 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
              <Pill className="w-4 h-4 text-[#047857]" />
              <span>Active Drugs &amp; Health Improvement Mapping</span>
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Pharmacological mechanism, target organ systems, and observed clinical biomarker response for every prescribed medication.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-1 p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg max-w-full"
            role="tablist"
            aria-label="Filter medication categories"
          >
            {(['all', 'Antidiabetic', 'Concomitant'] as DrugFilter[]).map((key) => {
              const active = drugFilter === key;
              const label =
                key === 'all'
                  ? `All (${drugLinks.length})`
                  : key === 'Antidiabetic'
                  ? `Antidiabetic (${drugLinks.filter((d) => d.category === 'Antidiabetic').length})`
                  : `Concomitant (${drugLinks.filter((d) => d.category === 'Concomitant').length})`;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setDrugFilter(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-white text-[#053B2B] shadow-xs font-semibold'
                      : 'text-[#4B6157] hover:text-[#14201B]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleDrugs.length === 0 ? (
          <div className="bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-5 text-xs text-[#4B6157]">
            No medications recorded in this category.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {visibleDrugs.map((drug, idx) => (
              <article
                key={drug.id}
                className="card-elevate bg-[#F6F9F7] border border-[#E6EFEA] rounded-xl p-4 space-y-3 analysis-panel-enter"
                style={{ animationDelay: `${idx * 70}ms` }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#4B6157]">
                      <span className="font-semibold text-[#047857]">{drug.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{drug.classLabels.join(' + ')}</span>
                      {drug.isFdc && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-[#053B2B]">FDC</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-[#14201B] mt-0.5">
                      {drug.drugName}{' '}
                      <span className="font-mono tabular-nums text-xs font-semibold text-[#053B2B]">
                        {drug.dose}
                      </span>
                    </h3>
                  </div>

                  <div className="text-right text-[11px] font-mono tabular-nums text-[#4B6157]">
                    <div>
                      {[drug.route, drug.frequency].filter(Boolean).join(' · ') || '—'}
                    </div>
                    <div
                      className={
                        drug.status === 'Disc.'
                          ? 'text-rose-700 font-semibold'
                          : drug.status === 'Current'
                          ? 'text-[#047857] font-semibold'
                          : 'text-[#6B8076]'
                      }
                    >
                      {drug.status === 'Disc.'
                        ? 'Discontinued'
                        : drug.status === 'Current'
                        ? 'Active'
                        : '—'}
                      {drug.visitDate ? ` · ${drug.visitDate}` : ''}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-[#14201B]">Mechanism: </span>
                    <span className="text-[#4B6157]">{drug.mechanism}</span>
                  </div>
                  <div className="bg-white border border-[#DDE8E2] rounded-lg p-3">
                    <div className="text-[11px] font-semibold text-[#047857] mb-0.5">
                      How It Improves This Patient&apos;s Health
                    </div>
                    <p className="text-xs text-[#14201B] leading-relaxed">
                      {drug.patientHealthBenefit}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <span className="text-[#4B6157]">
                    Targets: {drug.targetOrgans.join(' · ')}
                  </span>
                  {drug.linkedMetrics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
                      {drug.linkedMetrics.map((m) => (
                        <span
                          key={`${drug.id}-${m.label}`}
                          className={
                            m.tone === 'good'
                              ? 'text-[#047857] font-semibold'
                              : m.tone === 'warn'
                              ? 'text-amber-700 font-semibold'
                              : 'text-[#14201B]'
                          }
                        >
                          {m.label}: {m.value}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 5: Blue Index 10-Domain Matrix & DDS-17 Psychosocial Bars */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 analysis-stagger-5 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#047857]" />
                <span>Blue Index (DHS) 10-Domain Health Matrix</span>
              </h2>
              <p className="text-xs text-[#4B6157] mt-0.5">
                Each domain is scored 0–5 (higher = healthier status). Total DHS:{' '}
                <strong className="font-mono tabular-nums text-[#14201B]">
                  {activePatient.dhsTotal ?? '—'} / 50
                </strong>
              </p>
            </div>
            <div className="text-xs font-mono tabular-nums text-[#047857] font-semibold">
              Ratio {activePatient.blueIndexRatio || '—'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {blueIndexBars.map((dom, idx) => {
              const barColor =
                dom.tone === 'good'
                  ? 'bg-[#047857]'
                  : dom.tone === 'moderate'
                  ? 'bg-amber-500'
                  : 'bg-rose-600';
              return (
                <div key={dom.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-[#14201B] truncate">
                      <strong className="font-mono text-[#053B2B] mr-1">{dom.code}.</strong>
                      {dom.label}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#14201B] shrink-0">
                      {dom.score !== null ? `${dom.score}/5` : '—'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#EEF4F0] overflow-hidden">
                    <div
                      className={`h-full rounded-full journey-bar-fill ${barColor}`}
                      style={{
                        width: `${dom.pct}%`,
                        animationDelay: `${100 + idx * 45}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 analysis-stagger-6 bg-white border border-[#DDE8E2] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#047857]" />
              <span>DDS-17 Distress &amp; Known Severity</span>
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Mean DDS-17:{' '}
              <strong className="font-mono tabular-nums text-[#14201B]">
                {activePatient.ddsMean !== null ? activePatient.ddsMean.toFixed(2) : '—'}
              </strong>{' '}
              ({activePatient.ddsCategory || '—'})
            </p>
          </div>

          <div className="space-y-3">
            {ddsBars.map((sub, idx) => {
              const barColor =
                sub.tone === 'good'
                  ? 'bg-[#047857]'
                  : sub.tone === 'moderate'
                  ? 'bg-amber-500'
                  : 'bg-rose-600';
              return (
                <div key={sub.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <span className="text-[#14201B]">{sub.label}</span>
                    <span className="font-mono tabular-nums text-[#4B6157]">
                      {sub.score !== null ? `${sub.score.toFixed(2)} / 6 · ${sub.levelLabel}` : 'Pending'}
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#EEF4F0] overflow-hidden">
                    <div
                      className={`h-full rounded-full journey-bar-fill ${barColor}`}
                      style={{
                        width: `${sub.pct}%`,
                        animationDelay: `${140 + idx * 65}ms`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#EEF4F0] grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#F6F9F7] rounded-lg p-2.5">
              <div className="text-[11px] text-[#4B6157]">Macrovascular</div>
              <div className="font-mono tabular-nums text-sm font-bold text-[#14201B]">
                {activePatient.ksMacrovascular ?? '—'} / 5
              </div>
            </div>
            <div className="bg-[#F6F9F7] rounded-lg p-2.5">
              <div className="text-[11px] text-[#4B6157]">Microvascular</div>
              <div className="font-mono tabular-nums text-sm font-bold text-[#14201B]">
                {activePatient.ksMicrovascular ?? '—'} / 5
              </div>
            </div>
            <div className="bg-[#F6F9F7] rounded-lg p-2.5">
              <div className="text-[11px] text-[#4B6157]">Foot / Neuro</div>
              <div className="font-mono tabular-nums text-sm font-bold text-[#14201B]">
                {activePatient.ksFootNeuropathy ?? '—'} / 5
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Complete Patient Information & Biomarker Dossier */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-bold text-[#14201B] flex items-center gap-2">
              <Microscope className="w-4 h-4 text-[#047857]" />
              <span>Complete Patient Clinical Dossier</span>
            </h2>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Full demographics, anthropometry, blood chemistry, beta-cell HOMA indices, and FibroScan measurements.
            </p>
          </div>

          <div
            className="flex items-center gap-1 p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg overflow-x-auto"
            role="tablist"
            aria-label="Patient dossier sections"
          >
            {(
              [
                { key: 'overview', label: 'Demographics & Lifestyle' },
                { key: 'labs', label: 'Vitals, Glycemic, Lipid & Renal' },
                { key: 'specialized', label: 'HOMA, FibroScan & Neuropathy' },
              ] as Array<{ key: RecordTab; label: string }>
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={recordTab === t.key}
                onClick={() => setRecordTab(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  recordTab === t.key
                    ? 'bg-white text-[#053B2B] shadow-xs font-semibold'
                    : 'text-[#4B6157] hover:text-[#14201B]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {recordTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 analysis-panel-enter">
            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Demographics &amp; Study Enrollment</h3>
              <DataRow label="UHID / IP No." value={activePatient.uhid || '—'} />
              <DataRow label="Contact Number" value={activePatient.contactNumber || '—'} />
              <DataRow label="Date of Birth / Age" value={`${activePatient.dob || '—'} (${fmtVal(activePatient.age, 'yrs')})`} />
              <DataRow label="Education" value={activePatient.education || '—'} />
              <DataRow label="Occupation" value={activePatient.occupation || '—'} />
              <DataRow label="Recruitment Date" value={activePatient.dateOfRecruitment || '—'} />
              <DataRow label="Next Follow-up" value={activePatient.followUpDate || '—'} />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Diabetes History &amp; Complications</h3>
              <DataRow label="Diagnosis Month/Year" value={activePatient.diagnosisMonthYear || '—'} />
              <DataRow label="Age at Diagnosis" value={fmtVal(activePatient.ageAtDiagnosis, 'yrs')} />
              <DataRow
                label="Duration of T2DM"
                value={
                  activePatient.durationYears !== null
                    ? `${activePatient.durationYears}y ${activePatient.durationMonths ?? 0}m`
                    : '—'
                }
              />
              <DataRow
                label="Family History DM"
                value={
                  activePatient.familyHistoryDM === 'Yes' && activePatient.familyHistoryRelations.length > 0
                    ? `Yes (${activePatient.familyHistoryRelations.join(', ')})`
                    : activePatient.familyHistoryDM || '—'
                }
              />
              <DataRow label="Hypoglycemia" value={activePatient.hypoglycemiaSeverity || '—'} />
              <DataRow label="After Medication" value={activePatient.hypoglycemiaAfterMedication || '—'} />
              <DataRow label="Complications Notes" value={activePatient.complicationsText || activePatient.otherRelevantHistory || '—'} />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Lifestyle, Foot &amp; Adherence</h3>
              <DataRow label="Physical Activity" value={activePatient.physicalActivity || '—'} />
              <DataRow label="Smoking Status" value={activePatient.smokingStatus || '—'} />
              <DataRow label="Tobacco Status" value={activePatient.tobaccoStatus || '—'} />
              <DataRow label="Alcohol Intake" value={activePatient.alcoholIntake || '—'} />
              <DataRow label="Diet Adherence (0-5)" value={fmtVal(activePatient.dietAdherenceScore)} />
              <DataRow label="Follow-up Score (0-5)" value={fmtVal(activePatient.followUpRegularityScore)} />
              <DataRow label="Foot Ulcer / Amputation" value={`${activePatient.footUlcer || '—'} / ${activePatient.footAmputation || '—'}`} />
              <DataRow label="Active Infection" value={activePatient.infectionPresent || '—'} />
            </div>
          </div>
        )}

        {recordTab === 'labs' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 analysis-panel-enter">
            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Anthropometry &amp; Vitals</h3>
              <DataRow label="Height / Weight" value={`${fmtVal(activePatient.heightCm, 'cm')} / ${fmtVal(activePatient.weightKg, 'kg')}`} />
              <DataRow label="BMI" value={fmtVal(activePatient.bmi, 'kg/m²')} />
              <DataRow label="Waist / Hip" value={`${fmtVal(activePatient.waistCm, 'cm')} / ${fmtVal(activePatient.hipCm, 'cm')}`} />
              <DataRow label="Waist-Hip Ratio" value={fmtVal(activePatient.waistHipRatio)} />
              <DataRow
                label="Blood Pressure"
                value={
                  activePatient.sbp !== null && activePatient.dbp !== null
                    ? `${activePatient.sbp}/${activePatient.dbp} mmHg`
                    : '—'
                }
              />
              <DataRow label="Pulse Rate" value={fmtVal(activePatient.pulse, 'bpm')} />
              <DataRow
                label="On Anti-HTN Meds"
                value={
                  activePatient.onAntiHtnMeds
                    ? 'Yes'
                    : activePatient.sbp !== null || activePatient.dbp !== null
                    ? 'No'
                    : '—'
                }
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Glycemic &amp; Lipid Profile</h3>
              <DataRow label="FBG / PPBG" value={`${fmtVal(fbgMg, 'mg/dL')} / ${fmtVal(ppbgMg, 'mg/dL')}`} />
              <DataRow label="Random Blood Sugar" value={fmtVal(rbsMg, 'mg/dL')} />
              <DataRow
                label="1st / 2nd HbA1c"
                value={`${fmtVal(trajectory.baselineHba1c, '%')} / ${
                  activePatient.hba1c2.value !== null ? `${activePatient.hba1c2.value}%` : '—'
                }`}
              />
              <DataRow label="Total Cholesterol" value={fmtVal(tcMg, 'mg/dL')} />
              <DataRow label="Triglycerides" value={fmtVal(tgMg, 'mg/dL')} />
              <DataRow label="HDL / LDL" value={`${fmtVal(hdlMg, 'mg/dL')} / ${fmtVal(ldlMg, 'mg/dL')}`} />
              <DataRow label="Non-HDL / LDL:HDL" value={`${fmtVal(activePatient.nonHdl, 'mg/dL')} / ${fmtVal(activePatient.ldlHdlRatio)}`} />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Renal, Hepatic &amp; Hematology</h3>
              <DataRow label="Serum Creatinine" value={fmtVal(creatMg, 'mg/dL')} />
              <DataRow label="eGFR (CKD-EPI 2021)" value={fmtVal(activePatient.egfr, 'mL/min/1.73m²')} />
              <DataRow label="UACR" value={fmtVal(activePatient.uacr.value, 'mg/g')} />
              <DataRow label="Albuminuria Status" value={activePatient.microalbuminStatus || '—'} />
              <DataRow label="AST / ALT" value={`${fmtVal(activePatient.ast.value, 'U/L')} / ${fmtVal(activePatient.alt.value, 'U/L')}`} />
              <DataRow label="Hemoglobin" value={fmtVal(activePatient.hemoglobin.value, 'g/dL')} />
              <DataRow label="Platelets / WBC" value={`${fmtVal(activePatient.platelets.value)} / ${fmtVal(activePatient.totalCount.value)}`} />
            </div>
          </div>
        )}

        {recordTab === 'specialized' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1 analysis-panel-enter">
            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Beta-Cell &amp; HOMA Indices</h3>
              <DataRow label="C-Peptide" value={fmtVal(activePatient.cPeptide.value, activePatient.cPeptide.unit)} />
              <DataRow label="Fasting Insulin" value={fmtVal(activePatient.fastingInsulin.value, activePatient.fastingInsulin.unit)} />
              <DataRow
                label="HOMA Calculation Method"
                value={
                  activePatient.homaB !== null || activePatient.homaIR !== null
                    ? activePatient.homaMethod === 'c-peptide'
                      ? 'C-Peptide'
                      : 'Fasting Insulin'
                    : '—'
                }
              />
              <DataRow label="HOMA-B (%)" value={fmtVal(activePatient.homaB, '%')} />
              <DataRow label="HOMA-IR" value={fmtVal(activePatient.homaIR)} />
              <DataRow
                label="Assigned Cluster"
                value={clusterMeta ? `${clusterCode} (${clusterMeta.fullName})` : 'Unassigned'}
              />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">FibroScan Elastography</h3>
              <DataRow label="Scan Date" value={activePatient.fibroScanDate || '—'} />
              <DataRow label="LSM Stiffness" value={fmtVal(activePatient.lsmKpa, 'kPa')} />
              <DataRow label="Fibrosis Stage" value={activePatient.fibrosisInterpretation || '—'} />
              <DataRow label="CAP Steatosis" value={fmtVal(activePatient.capDbm, 'dB/m')} />
              <DataRow label="Steatosis Grade" value={activePatient.steatosisInterpretation || '—'} />
              <DataRow label="IQR / Med (%) &amp; Shots" value={`${fmtVal(activePatient.iqrMedianPct, '%')} · ${fmtVal(activePatient.validMeasurements)} valid`} />
            </div>

            <div>
              <h3 className="text-xs font-bold text-[#053B2B] mb-2">Known Severity &amp; Neuropathy</h3>
              <DataRow label="KS Total" value={`${fmtVal(activePatient.ksTotal)} / 15`} />
              <DataRow label="CAD / Stroke / PAD" value={`${activePatient.macroCad || '—'} · ${activePatient.macroStroke || '—'} · ${activePatient.macroPad || '—'}`} />
              <DataRow label="eGFR / UACR KS Tiers" value={`${fmtVal(activePatient.ksMicroEgfrTier)} / ${fmtVal(activePatient.ksMicroUacrTier)}`} />
              <DataRow label="Retinopathy Tier" value={`${fmtVal(activePatient.ksMicroRetinopathyTier)} / 5`} />
              <DataRow label="Monofilament / Vibration" value={`${activePatient.neuroMonofilament || '—'} / ${activePatient.neuroVibration || '—'}`} />
              <DataRow label="Ankle-Brachial Index (ABI)" value={activePatient.neuroAbi || '—'} />
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
