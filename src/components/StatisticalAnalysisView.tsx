import React, { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Download,
  GitCompare,
  RotateCcw,
  X,
} from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import {
  computeDescriptiveProfile,
  computeStudyRegressions,
} from '../utils/biostatisticsExtended';
import { computeDrugUtilizationEvaluation } from '../utils/drugUtilization';
import { runStudyStatisticalBattery } from '../utils/statistics';
import {
  buildPieSegments,
  buildStudyOverviewKpis,
  CLUSTER_META,
  type ClusterCode,
} from '../utils/statisticalCharts';
import {
  buildVisualStudyInsights,
  describeCorrelationPlain,
  describePValuePlain,
} from '../utils/visualInsights';
import { AnimatedPieChart } from './charts/AnimatedPieChart';
import { ClusterBarChart } from './charts/ClusterBarChart';
import { ClusterRadarChart } from './charts/ClusterRadarChart';
import { CorrelationHeatmapChart } from './charts/CorrelationHeatmapChart';
import { CorrelationScatterChart } from './charts/CorrelationScatterChart';
import { DescriptiveMethodsPanel } from './DescriptiveMethodsPanel';
import { DrugUtilizationPanel } from './DrugUtilizationPanel';
import { ProtocolObjectivesPanel } from './ProtocolObjectivesPanel';
import { RegressionAnalysisPanel } from './RegressionAnalysisPanel';
import { VisualClusterStoryPanel } from './VisualClusterStoryPanel';

interface StatisticalAnalysisViewProps {
  patients: PatientCRF[];
  onNewPatient?: () => void;
}

export type StudioSectionFilter =
  | 'overview'
  | 'descriptive'
  | 'comparative'
  | 'modeling'
  | 'due'
  | 'objectives';

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.0001) return '<0.0001*';
  return p < 0.05 ? `${p.toFixed(4)}*` : p.toFixed(4);
}

const KpiRadialRing: React.FC<{
  pct: number;
  color: string;
  animationKey: number;
  delayMs?: number;
}> = ({ pct, color, animationKey, delayMs = 0 }) => {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const safePct = Number.isFinite(pct) ? pct : 0;
  const clamped = Math.max(0, Math.min(100, safePct));
  const offset = circ * (1 - clamped / 100);
  return (
    <svg
      key={`${color}-${clamped}-${animationKey}`}
      viewBox="0 0 38 38"
      className="w-9 h-9 -rotate-90 shrink-0"
      aria-hidden="true"
    >
      <circle cx={19} cy={19} r={r} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={3.5} />
      <circle
        cx={19}
        cy={19}
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

export const StatisticalAnalysisView: React.FC<StatisticalAnalysisViewProps> = ({
  patients,
  onNewPatient,
}) => {
  const [activeCluster, setActiveCluster] = useState<ClusterCode | null>(null);
  const [sectionFilter, setSectionFilter] = useState<StudioSectionFilter>('overview');
  const [significantOnly, setSignificantOnly] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const battery = useMemo(() => runStudyStatisticalBattery(patients), [patients]);
  const pieSegments = useMemo(() => buildPieSegments(patients), [patients]);
  const overviewKpis = useMemo(
    () =>
      buildStudyOverviewKpis(
        patients,
        battery.continuousTests,
        battery.categoricalTests,
        pieSegments
      ),
    [patients, battery, pieSegments]
  );
  const descriptiveProfile = useMemo(() => computeDescriptiveProfile(patients), [patients]);
  const dueReport = useMemo(() => computeDrugUtilizationEvaluation(patients), [patients]);
  const regressionSuites = useMemo(() => computeStudyRegressions(patients), [patients]);

  const visualInsights = useMemo(
    () =>
      buildVisualStudyInsights(
        patients,
        battery.continuousTests,
        dueReport,
        regressionSuites
      ),
    [patients, battery.continuousTests, dueReport, regressionSuites]
  );

  const controlledCount = useMemo(
    () => patients.filter((p) => (p.hba1c2.value ?? p.hba1c1.value ?? 99) < 7.0).length,
    [patients]
  );

  const visibleContinuousRows = useMemo(() => {
    if (!significantOnly) return battery.continuousTests;
    return battery.continuousTests.filter(
      (r) =>
        (r.anovaP !== null && r.anovaP < 0.05) ||
        (r.kruskalP !== null && r.kruskalP < 0.05)
    );
  }, [battery.continuousTests, significantOnly]);

  const categoricalBarModels = useMemo(() => {
    const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];
    return battery.categoricalTests.slice(1, 5).map((cat) => {
      const targetCat = cat.categories[0];
      return {
        variable: cat.variable,
        targetLabel: targetCat,
        pValue: cat.pValue,
        bars: clusters.map((c) => {
          const groupTotal = Object.values(cat.counts[c] || {}).reduce((a, b) => a + b, 0);
          const count = cat.counts[c]?.[targetCat] ?? 0;
          const pct = groupTotal > 0 ? Math.round((count / groupTotal) * 100) : 0;
          return { cluster: c, count, total: groupTotal, pct, color: CLUSTER_META[c].color };
        }),
      };
    });
  }, [battery.categoricalTests]);

  const handleExportStatsCsv = () => {
    const lines: string[] = [
      'SECTION 1: DESCRIPTIVE STATISTICS (CONTINUOUS & DISCRETE)',
      'Data Type,Variable,Unit,n,Mean +/- SD,95% CI,Median [IQR],Min - Max',
    ];
    for (const row of [
      ...descriptiveProfile.continuousVariables,
      ...descriptiveProfile.discreteVariables,
    ]) {
      lines.push(
        `"${row.dataType}","${row.variable}","${row.unit}",${row.n},"${row.mean} +/- ${row.sd}","[${row.ciLower}, ${row.ciUpper}]","${row.median} [${row.iqr}]","${row.min} - ${row.max}"`
      );
    }

    lines.push('');
    lines.push('SECTION 2: COMPARATIVE ANALYSIS (ANOVA & KRUSKAL-WALLIS)');
    lines.push(
      'Continuous Variable,SIDD (Mean+/-SD),SIRD (Mean+/-SD),CIRDD (Mean+/-SD),MARD (Mean+/-SD),ANOVA F,ANOVA p,Kruskal H,Kruskal p'
    );
    for (const row of battery.continuousTests) {
      const cells = ['SIDD', 'SIRD', 'CIRDD', 'MARD'].map((c) => {
        const g = row.groups.find((x) => x.group === c);
        return g && g.n > 0 ? `${g.mean} +/- ${g.sd} (n=${g.n})` : '0';
      });
      lines.push(
        `"${row.variable}",${cells.map((c) => `"${c}"`).join(',')},${row.anovaF ?? ''},${
          row.anovaP ?? ''
        },${row.kruskalH ?? ''},${row.kruskalP ?? ''}`
      );
    }

    lines.push('');
    lines.push('SECTION 3: ASSOCIATION & CORRELATION');
    lines.push('Pair,n,Pearson r,Pearson p,Spearman rho,Spearman p');
    for (const c of battery.correlations) {
      lines.push(
        `"${c.label}",${c.n},${c.pearsonR ?? ''},${c.pearsonP ?? ''},${c.spearmanRho ?? ''},${
          c.spearmanP ?? ''
        }`
      );
    }

    lines.push('');
    lines.push('SECTION 4: OLS LINEAR REGRESSION');
    lines.push('Outcome,Predictor,n,Slope beta,95% CI,Std Beta,R^2,Adj R^2,F-stat,p-value');
    for (const suite of regressionSuites) {
      for (const m of suite.models) {
        lines.push(
          `"${suite.outcomeLabel}","${m.predictorLabel}",${m.n},${m.slope ?? ''},"[${
            m.ciLower ?? ''
          }, ${m.ciUpper ?? ''}]",${m.standardizedBeta ?? ''},${m.rSquared ?? ''},${
            m.adjRSquared ?? ''
          },${m.fStat ?? ''},${m.pValue ?? ''}`
        );
      }
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Desai_T2DM_Biostatistics_Suite_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const navTabs: Array<{ key: StudioSectionFilter; label: string }> = [
    { key: 'overview', label: 'Visual Summary' },
    { key: 'descriptive', label: 'Patient Averages' },
    { key: 'comparative', label: 'Group Comparison' },
    { key: 'modeling', label: 'Links & Predictors' },
    { key: 'due', label: 'Medications (DUE)' },
    { key: 'objectives', label: 'Study Goals (E4)' },
  ];

  const renderCategoricalRiskCard = () => (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#EEF3F0]">
        <h3 className="font-display text-sm font-bold text-[#14201B]">
          Complication &amp; Risk Rates by Diabetes Group (%)
        </h3>
        <span className="text-[11px] font-mono text-[#6B8076]">χ² Group Comparison</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
        {categoricalBarModels.map((item) => {
          const verdict = describePValuePlain(item.pValue);
          return (
            <div
              key={item.variable}
              className="space-y-2.5 pb-2 md:pb-0 border-b md:border-b-0 md:border-r last:border-b-0 last:border-r-0 border-[#EEF3F0] md:pr-4 last:pr-0"
            >
              <div>
                <div className="text-xs font-semibold text-[#14201B] leading-snug">
                  {item.variable}
                </div>
                <div className="flex items-center justify-between gap-1 mt-1">
                  <span className="text-[10px] font-mono text-[#6B8076] tabular-nums">
                    p = {formatP(item.pValue)}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      verdict.isSignificant
                        ? 'bg-[#ECFDF5] text-[#047857]'
                        : 'bg-[#F6F9F7] text-[#6B8076]'
                    }`}
                  >
                    {verdict.label}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {item.bars.map((bar, barIdx) => {
                  const dimmed = activeCluster !== null && activeCluster !== bar.cluster;
                  return (
                    <div
                      key={bar.cluster}
                      className={`space-y-1 transition-opacity ${
                        dimmed ? 'opacity-35' : 'opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                        <span className="font-semibold text-[#14201B]">{bar.cluster}</span>
                        <span className="text-[#4B6157]">
                          {bar.count}/{bar.total} ({bar.pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-[#EEF3F0] overflow-hidden">
                        <div
                          key={`${item.variable}-${bar.cluster}-${animationKey}`}
                          className="h-full rounded-full chart-bar-horiz"
                          style={{
                            width: `${bar.pct}%`,
                            backgroundColor: bar.color,
                            transformOrigin: 'left center',
                            animationDelay: `${barIdx * 60}ms`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const controlledPct =
    patients.length > 0 ? Math.round((controlledCount / patients.length) * 100) : 0;
  const parsedMeanDhs = Number.parseFloat(String(overviewKpis.meanDhs || '0'));
  const dhsPct = Number.isFinite(parsedMeanDhs) ? Math.round((parsedMeanDhs / 50) * 100) : 0;
  const sigPct =
    overviewKpis.totalTestedParams > 0
      ? Math.round((overviewKpis.significantParamsCount / overviewKpis.totalTestedParams) * 100)
      : 0;

  return (
    <div className="space-y-5">
      {/* Executive Visual Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#053B2B] via-[#064E3B] to-[#047857] text-white p-5 shadow-sm chart-fade-up">
        <div className="hero-sheen" aria-hidden="true" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono text-emerald-200/90 tracking-wide">
                SDPC-IEC/DHR2026/05 · Live Cohort (n = {patients.length})
              </div>
              <h2 className="font-display text-xl font-bold text-white tracking-tight mt-0.5">
                Clinical Statistical Analysis
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {activeCluster && (
                <button
                  type="button"
                  onClick={() => setActiveCluster(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-medium text-white inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <span>Clear focus: {activeCluster}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setAnimationKey((k) => k + 1)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 text-emerald-200" />
                <span>Replay Visuals</span>
              </button>

              <button
                type="button"
                onClick={handleExportStatsCsv}
                className="px-3.5 py-1.5 rounded-lg bg-white text-[#053B2B] hover:bg-emerald-50 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-[#047857]" />
                <span>Export Full CSV</span>
              </button>
            </div>
          </div>

          {/* Animated Visual KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div
              key={`kpi-1-${animationKey}`}
              className="analysis-stagger-1 px-3.5 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-100/80">Total Cohort</div>
                <div className="text-lg font-display font-bold text-white tabular-nums">
                  {overviewKpis.totalPatients}
                </div>
                <div className="text-[10px] font-mono text-emerald-200 truncate">
                  {overviewKpis.dominantCluster
                    ? `${overviewKpis.dominantCluster.code} · ${overviewKpis.dominantCluster.pct}%`
                    : 'No clusters'}
                </div>
              </div>
              <KpiRadialRing
                pct={overviewKpis.dominantCluster?.pct ?? 0}
                color="#6EE7B7"
                animationKey={animationKey}
                delayMs={80}
              />
            </div>

            <div
              key={`kpi-2-${animationKey}`}
              className="analysis-stagger-2 px-3.5 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-100/80">Mean HbA1c</div>
                <div className="text-lg font-display font-bold text-white tabular-nums">
                  {overviewKpis.meanHba1c}
                </div>
                <div className="text-[10px] font-mono text-emerald-100/85 tabular-nums truncate">
                  {controlledCount}/{patients.length} (&lt;7%)
                </div>
              </div>
              <KpiRadialRing
                pct={controlledPct}
                color="#34D399"
                animationKey={animationKey}
                delayMs={140}
              />
            </div>

            <div
              key={`kpi-3-${animationKey}`}
              className="analysis-stagger-3 px-3.5 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-100/80">Blue Index DHS</div>
                <div className="text-lg font-display font-bold text-white tabular-nums">
                  {overviewKpis.meanDhs}
                </div>
                <div className="text-[10px] font-mono text-emerald-100/85 tabular-nums">
                  Out of 50 pts
                </div>
              </div>
              <KpiRadialRing
                pct={dhsPct}
                color="#A7F3D0"
                animationKey={animationKey}
                delayMs={200}
              />
            </div>

            <div
              key={`kpi-4-${animationKey}`}
              className="analysis-stagger-4 px-3.5 py-3 rounded-xl bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-100/80">Group Differences</div>
                <div className="text-lg font-display font-bold text-emerald-200 tabular-nums">
                  {overviewKpis.significantParamsCount}/{overviewKpis.totalTestedParams}
                </div>
                <div className="text-[10px] font-mono text-emerald-100/85">p &lt; 0.05</div>
              </div>
              <KpiRadialRing
                pct={sigPct}
                color="#FCD34D"
                animationKey={animationKey}
                delayMs={260}
              />
            </div>

            <div
              key={`kpi-5-${animationKey}`}
              className="analysis-stagger-5 px-3.5 py-3 rounded-xl bg-white/15 border border-emerald-200/35 backdrop-blur-sm col-span-2 md:col-span-1 flex items-center justify-between gap-2.5"
            >
              <div className="min-w-0">
                <div className="text-[10px] font-medium text-emerald-100">Protocol Suite</div>
                <div className="text-lg font-display font-bold text-white tabular-nums inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                  <span>4 / 4</span>
                </div>
                <div className="text-[10px] font-mono text-emerald-100/90 truncate">
                  Active Methods
                </div>
              </div>
              <KpiRadialRing
                pct={100}
                color="#6EE7B7"
                animationKey={animationKey}
                delayMs={320}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex flex-wrap items-center p-1 bg-white border border-[#DDE8E2] rounded-xl gap-1 shadow-xs"
          role="tablist"
          aria-label="Statistical analysis studio sections"
        >
          {navTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={sectionFilter === tab.key}
              onClick={() => setSectionFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                sectionFilter === tab.key
                  ? 'bg-[#047857] text-white shadow-xs'
                  : 'text-[#4B6157] hover:text-[#14201B] hover:bg-[#F6F9F7]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeCluster && (
          <div className="text-xs font-mono text-[#047857] font-semibold tabular-nums">
            Focused: {activeCluster} · {CLUSTER_META[activeCluster].fullName}
          </div>
        )}
      </div>

      {/* Empty state when Normal user has not logged any patients yet */}
      {patients.length === 0 ? (
        <div className="bg-white border border-[#DDE8E2] rounded-2xl p-10 text-center space-y-3">
          <Activity className="w-8 h-8 text-[#047857] mx-auto" />
          <h3 className="font-display text-lg font-bold text-[#14201B]">
            No patient records under your login yet
          </h3>
          <p className="text-sm text-[#4B6157] max-w-lg mx-auto">
            Your portal statistics update automatically once you add or import your first patient
            Case Report Form.
          </p>
          {onNewPatient && (
            <button
              type="button"
              onClick={onNewPatient}
              className="mt-2 px-4 py-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <span>Enroll First Patient CRF</span>
            </button>
          )}
        </div>
      ) : (
        <div key={sectionFilter} className="analysis-panel-enter">
          {/* SECTION 0: VISUAL SUMMARY */}
      {sectionFilter === 'overview' && (
        <div className="space-y-6">
          {/* Interactive 4-Cluster Visual Profile Cards */}
          <VisualClusterStoryPanel
            insights={visualInsights}
            activeCluster={activeCluster}
            onSelectCluster={setActiveCluster}
            animationKey={animationKey}
          />

          {/* Primary Graphical Suite: Pie + Bar Whiskers + Radar + Heatmap */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <AnimatedPieChart
                segments={pieSegments}
                totalPatients={patients.length}
                activeCluster={activeCluster}
                onSelectCluster={setActiveCluster}
                animationKey={animationKey}
              />
            </div>
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <ClusterBarChart
                continuousTests={battery.continuousTests}
                activeCluster={activeCluster}
                onSelectCluster={setActiveCluster}
                animationKey={animationKey}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <ClusterRadarChart
                continuousTests={battery.continuousTests}
                activeCluster={activeCluster}
                onSelectCluster={setActiveCluster}
                animationKey={animationKey}
              />
            </div>
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <CorrelationHeatmapChart patients={patients} animationKey={animationKey} />
            </div>
          </div>

          {renderCategoricalRiskCard()}
        </div>
      )}

      {/* SECTION 1: PATIENT AVERAGES (DESCRIPTIVE ACROSS 4 DATA TYPES) */}
      {sectionFilter === 'descriptive' && (
        <DescriptiveMethodsPanel patients={patients} animationKey={animationKey} />
      )}

      {/* SECTION 2: GROUP COMPARISON (ANOVA / KRUSKAL / CHI-SQUARE + PLAIN VERDICT) */}
      {sectionFilter === 'comparative' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <ClusterBarChart
                continuousTests={battery.continuousTests}
                activeCluster={activeCluster}
                onSelectCluster={setActiveCluster}
                animationKey={animationKey}
              />
            </div>
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <ClusterRadarChart
                continuousTests={battery.continuousTests}
                activeCluster={activeCluster}
                onSelectCluster={setActiveCluster}
                animationKey={animationKey}
              />
            </div>
          </div>

          {renderCategoricalRiskCard()}

          {/* Continuous Variables Table */}
          <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#047857] shrink-0" />
                <h3 className="font-display text-sm font-bold text-[#14201B]">
                  Biomarker Comparison Across Groups (ANOVA &amp; Kruskal-Wallis)
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSignificantOnly((v) => !v)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  significantOnly
                    ? 'bg-[#047857] border-[#047857] text-white'
                    : 'bg-[#FAFDFB] border-[#DDE8E2] text-[#4B6157] hover:text-[#14201B]'
                }`}
              >
                {significantOnly ? 'Showing Clear Differences Only' : 'Show Clear Differences Only'}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                    <th className="py-2.5 px-3">Parameter</th>
                    <th className="py-2.5 px-2">SIDD</th>
                    <th className="py-2.5 px-2">SIRD</th>
                    <th className="py-2.5 px-2">CIRDD</th>
                    <th className="py-2.5 px-2">MARD</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">ANOVA p</th>
                    <th className="py-2.5 px-2 text-right whitespace-nowrap">Kruskal p</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Plain Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F0]">
                  {visibleContinuousRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-xs text-[#6B8076]">
                        No parameters reached p &lt; 0.05 in the current sample. Toggle filter off to
                        inspect all continuous parameters.
                      </td>
                    </tr>
                  ) : (
                    visibleContinuousRows.map((row) => {
                      const bestP =
                        row.anovaP !== null && row.kruskalP !== null
                          ? Math.min(row.anovaP, row.kruskalP)
                          : row.anovaP ?? row.kruskalP;
                      const verdict = describePValuePlain(bestP);
                      return (
                        <tr key={row.variable} className="hover:bg-[#FAFDFB]">
                          <td className="py-2.5 px-3 font-medium text-[#14201B]">{row.variable}</td>
                          {(['SIDD', 'SIRD', 'CIRDD', 'MARD'] as ClusterCode[]).map((c) => {
                            const g = row.groups.find((x) => x.group === c);
                            const isHighlighted = activeCluster === c;
                            return (
                              <td
                                key={c}
                                className={`py-2.5 px-2 font-mono tabular-nums ${
                                  isHighlighted ? 'bg-[#F2F7F4]' : ''
                                }`}
                              >
                                {g && g.n > 0 ? (
                                  <div>
                                    <div className="text-[#14201B] whitespace-nowrap">
                                      {g.mean} ± {g.sd}
                                    </div>
                                    <div className="text-[10px] text-[#6B8076] whitespace-nowrap">
                                      Med {g.median} [{g.iqr}] · n={g.n}
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[#6B8076]">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td
                            className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                              row.anovaP !== null && row.anovaP < 0.05
                                ? 'font-bold text-[#047857]'
                                : 'text-[#4B6157]'
                            }`}
                          >
                            {formatP(row.anovaP)}
                          </td>
                          <td
                            className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                              row.kruskalP !== null && row.kruskalP < 0.05
                                ? 'font-bold text-[#047857]'
                                : 'text-[#4B6157]'
                            }`}
                          >
                            {formatP(row.kruskalP)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                verdict.tone === 'emerald'
                                  ? 'bg-[#ECFDF5] text-[#047857] border border-[#BFD5C9]'
                                  : verdict.tone === 'amber'
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-[#F6F9F7] text-[#4B6157] border border-[#DDE8E2]'
                              }`}
                            >
                              {verdict.isSignificant ? `${verdict.label} ✓` : verdict.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Categorical Variables Table */}
          <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE8E2]">
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Categorical Risks &amp; Grades — Chi-Square (χ²) Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                    <th className="py-3 px-4">Clinical Category</th>
                    <th className="py-3 px-3">SIDD</th>
                    <th className="py-3 px-3">SIRD</th>
                    <th className="py-3 px-3">CIRDD</th>
                    <th className="py-3 px-3">MARD</th>
                    <th className="py-3 px-3 text-right">χ²</th>
                    <th className="py-3 px-3 text-right">p-value</th>
                    <th className="py-3 px-4">Plain Verdict</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F0]">
                  {battery.categoricalTests.map((row) => {
                    const verdict = describePValuePlain(row.pValue);
                    return (
                      <tr key={row.variable} className="hover:bg-[#FAFDFB]">
                        <td className="py-2.5 px-4 font-medium text-[#14201B] whitespace-nowrap">
                          {row.variable}
                        </td>
                        {(['SIDD', 'SIRD', 'CIRDD', 'MARD'] as ClusterCode[]).map((g) => (
                          <td
                            key={g}
                            className={`py-2.5 px-3 font-mono text-[11px] text-[#4B6157] tabular-nums ${
                              activeCluster === g ? 'bg-[#F2F7F4]' : ''
                            }`}
                          >
                            {row.categories
                              .map((cat) => `${cat}: ${row.counts[g]?.[cat] ?? 0}`)
                              .join(' · ')}
                          </td>
                        ))}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          {row.chiSquare ?? '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                            row.pValue !== null && row.pValue < 0.05
                              ? 'font-bold text-[#047857]'
                              : 'text-[#4B6157]'
                          }`}
                        >
                          {formatP(row.pValue)}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                              verdict.tone === 'emerald'
                                ? 'bg-[#ECFDF5] text-[#047857] border border-[#BFD5C9]'
                                : 'bg-[#F6F9F7] text-[#4B6157] border border-[#DDE8E2]'
                            }`}
                          >
                            {verdict.isSignificant ? `${verdict.label} ✓` : verdict.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTIONS 3 & 4: LINKS & PREDICTORS (CORRELATION + OLS REGRESSION) */}
      {sectionFilter === 'modeling' && (
        <div className="space-y-5">
          {/* Graphical Pair: 8x8 Heatmap + Interactive Scatter Plot */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <CorrelationHeatmapChart patients={patients} animationKey={animationKey} />
            </div>
            <div className="xl:col-span-6 flex flex-col [&>*]:flex-1">
              <CorrelationScatterChart
                patients={patients}
                activeCluster={activeCluster}
                animationKey={animationKey}
              />
            </div>
          </div>

          {/* Method 3 Summary Table with Plain-English Meaning */}
          <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-[#047857]" />
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Clinical Correlation Pairs (Pearson r &amp; Spearman ρ)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                    <th className="py-2.5 px-4">Clinical Pair</th>
                    <th className="py-2.5 px-3 text-right">Paired n</th>
                    <th className="py-2.5 px-3 text-right">Pearson r</th>
                    <th className="py-2.5 px-3 text-right">p-value</th>
                    <th className="py-2.5 px-3 text-right">Spearman ρ</th>
                    <th className="py-2.5 px-4">Plain Meaning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF3F0]">
                  {battery.correlations.map((c) => {
                    const plain = describeCorrelationPlain(c.pearsonR, c.pearsonP);
                    return (
                      <tr key={c.label} className="hover:bg-[#FAFDFB]">
                        <td className="py-2.5 px-4 font-semibold text-[#14201B]">{c.label}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                          {c.n}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#14201B]">
                          {c.pearsonR ?? '—'}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                            c.pearsonP !== null && c.pearsonP < 0.05
                              ? 'font-bold text-[#047857]'
                              : 'text-[#4B6157]'
                          }`}
                        >
                          {formatP(c.pearsonP)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#14201B]">
                          {c.spearmanRho ?? '—'}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                              plain.isSignificant
                                ? 'bg-[#ECFDF5] text-[#047857] border border-[#BFD5C9]'
                                : 'bg-[#F6F9F7] text-[#4B6157] border border-[#DDE8E2]'
                            }`}
                          >
                            {plain.strengthLabel} · {plain.directionLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Method 4: OLS Regression Studio */}
          <RegressionAnalysisPanel
            patients={patients}
            activeCluster={activeCluster}
            animationKey={animationKey}
          />
        </div>
      )}

      {/* DRUG UTILISATION EVALUATION (DUE) */}
      {sectionFilter === 'due' && (
        <DrugUtilizationPanel
          patients={patients}
          activeCluster={activeCluster}
          onSelectCluster={setActiveCluster}
          animationKey={animationKey}
        />
      )}

      {/* STUDY PROTOCOL E4 SECONDARY OBJECTIVES (1–12) */}
      {sectionFilter === 'objectives' && (
        <ProtocolObjectivesPanel
          patients={patients}
          activeCluster={activeCluster}
          animationKey={animationKey}
          onJumpToSection={(target) => setSectionFilter(target)}
        />
      )}
        </div>
      )}
    </div>
  );
};
