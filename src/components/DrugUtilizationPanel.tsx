import React from 'react';
import { Download, Pill, ShieldCheck, Activity, Layers } from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import { computeDrugUtilizationEvaluation } from '../utils/drugUtilization';
import { CLUSTER_META, type ClusterCode } from '../utils/statisticalCharts';

interface DrugUtilizationPanelProps {
  patients: PatientCRF[];
  activeCluster: ClusterCode | null;
  onSelectCluster: (cluster: ClusterCode | null) => void;
  animationKey: number;
}

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.0001) return '<0.0001*';
  return p < 0.05 ? `${p.toFixed(4)}*` : p.toFixed(4);
}

export const DrugUtilizationPanel: React.FC<DrugUtilizationPanelProps> = ({
  patients,
  activeCluster,
  onSelectCluster,
  animationKey,
}) => {
  const due = React.useMemo(() => computeDrugUtilizationEvaluation(patients), [patients]);
  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];

  const handleExportDueCsv = () => {
    const lines: string[] = [
      'Section,Metric/Class,Overall n (%),SIDD,SIRD,CIRDD,MARD,Chi-Square p',
      `WHO Indicator,Mean Antidiabetic Drugs/Patient,${due.indicators.meanAntidiabeticsPerPatient},,,,,`,
      `WHO Indicator,Polypharmacy Rate (%),${due.indicators.polypharmacyRatePct}%,,,,,`,
      `WHO Indicator,Insulin Utilization (%),${due.indicators.insulinUtilizationPct}%,,,,,`,
      `WHO Indicator,Fixed-Dose Combination (FDC %),${due.indicators.fdcUtilizationPct}%,,,,,`,
      `WHO Indicator,Statin Co-Prescription (%),${due.indicators.statinCoRxPct}%,,,,,`,
      `WHO Indicator,Anti-HTN Co-Prescription (%),${due.indicators.antiHtnCoRxPct}%,,,,,`,
    ];

    for (const row of due.classMatrix) {
      const cells = clusters.map((c) => {
        const b = row.byCluster[c];
        return `${b.count}/${b.total} (${b.pct}%)`;
      });
      lines.push(
        `Antidiabetic Class,"${row.drugClass}","${row.totalPatients} (${row.totalPct}%)",${cells
          .map((x) => `"${x}"`)
          .join(',')},${row.pValue ?? ''}`
      );
    }

    lines.push('');
    lines.push(
      'Complexity Tier,Patients n (%),SIDD,SIRD,CIRDD,MARD,Mean Baseline HbA1c,Mean Follow-up HbA1c,Delta HbA1c,Controlled (<7.0%)'
    );
    for (const row of due.complexityRows) {
      const cells = clusters.map((c) => `${row.byCluster[c].count}/${row.byCluster[c].total}`);
      lines.push(
        `"${row.tier}","${row.count} (${row.pct}%)",${cells.join(',')},${
          row.meanBaselineHba1c ?? ''
        },${row.meanFollowupHba1c ?? ''},${row.meanHba1cReduction ?? ''},${
          row.controlledPct !== null ? `${row.controlledPct}%` : ''
        }`
      );
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Desai_T2DM_Drug_Utilization_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header + WHO Core Prescribing Indicators */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] border border-[#BFD5C9] flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4 text-[#047857]" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Drug Utilisation Evaluation (DUE)
              </h3>
              <p className="text-xs font-mono text-[#6B8076] mt-0.5">
                WHO Prescribing Indicators &amp; Cluster Formulary Audit
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleExportDueCsv}
            className="px-3.5 py-2 rounded-lg border border-[#DDE8E2] bg-[#FAFDFB] hover:bg-[#EFF5F1] text-xs font-semibold text-[#14201B] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-[#047857]" />
            <span>Export DUE CSV</span>
          </button>
        </div>

        {/* WHO Core Prescribing KPI Strip */}
        <div key={`due-kpis-${animationKey}`} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="analysis-stagger-1 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">Antidiabetics / Pt</div>
            <div className="text-lg font-display font-bold text-[#14201B] tabular-nums mt-0.5">
              {due.indicators.meanAntidiabeticsPerPatient}
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              {due.indicators.totalActiveAntidiabeticPrescriptions} active Rx
            </div>
          </div>

          <div className="analysis-stagger-2 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">Dual / Triple+ OAD</div>
            <div className="text-lg font-display font-bold text-[#047857] tabular-nums mt-0.5">
              {due.indicators.dualTherapyRatePct}% / {due.indicators.triplePlusRatePct}%
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              Mono: {due.indicators.monotherapyRatePct}%
            </div>
          </div>

          <div className="analysis-stagger-3 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">Insulin Utilization</div>
            <div className="text-lg font-display font-bold text-[#14201B] tabular-nums mt-0.5">
              {due.indicators.insulinUtilizationPct}%
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              Oral-only: {due.indicators.oralOnlyRatePct}%
            </div>
          </div>

          <div className="analysis-stagger-4 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">Polypharmacy Rate</div>
            <div className="text-lg font-display font-bold text-[#14201B] tabular-nums mt-0.5">
              {due.indicators.polypharmacyRatePct}%
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              ≥3 OAD or ≥5 total drugs
            </div>
          </div>

          <div className="analysis-stagger-5 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">FDC Prescribing</div>
            <div className="text-lg font-display font-bold text-[#14201B] tabular-nums mt-0.5">
              {due.indicators.fdcUtilizationPct}%
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              Fixed-dose combos
            </div>
          </div>

          <div className="analysis-stagger-6 p-3 rounded-xl bg-[#FAFDFB] border border-[#EEF3F0]">
            <div className="text-[11px] font-medium text-[#4B6157]">Statin / Anti-HTN</div>
            <div className="text-lg font-display font-bold text-[#14201B] tabular-nums mt-0.5">
              {due.indicators.statinCoRxPct}% / {due.indicators.antiHtnCoRxPct}%
            </div>
            <div className="text-[10px] font-mono text-[#6B8076] tabular-nums">
              Cardiorenal co-therapy
            </div>
          </div>
        </div>
      </div>

      {/* Graphical DUE Visualization Suite: Class Utilization x Cluster & Complexity HbA1c Impact */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Clustered Class Utilization SVG Bar Chart */}
        <div className="xl:col-span-7 bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#EEF3F0]">
            <div>
              <h4 className="font-display text-sm font-bold text-[#14201B]">
                Graphical Antidiabetic Class Share by Cluster (%)
              </h4>
              <p className="text-xs text-[#4B6157] mt-0.5">
                Cluster-wise prescribing rate (%) across leading antidiabetic drug classes
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-[#4B6157]">
              {clusters.map((c) => (
                <span key={c} className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: CLUSTER_META[c].color }}
                  />
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3">
            {(() => {
              const topClasses = due.classMatrix.slice(0, 5);
              const leftPad = 148;
              const rightPad = 24;
              const barW = 460 - leftPad - rightPad;
              const rowH = 40;
              const svgH = Math.max(150, topClasses.length * rowH + 22);
              return (
                <svg
                  key={`due-cls-${animationKey}`}
                  viewBox={`0 0 460 ${svgH}`}
                  className="w-full overflow-visible"
                  role="img"
                  aria-label="Antidiabetic drug class utilization grouped bar chart across clusters"
                >
                  {[0, 25, 50, 75, 100].map((tick) => {
                    const x = leftPad + (tick / 100) * barW;
                    return (
                      <g key={tick}>
                        <line
                          x1={x}
                          y1={6}
                          x2={x}
                          y2={topClasses.length * rowH + 4}
                          stroke={tick === 0 ? '#CBD8D1' : '#EEF3F0'}
                          strokeDasharray={tick === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={x}
                          y={topClasses.length * rowH + 17}
                          textAnchor="middle"
                          className="font-mono text-[9.5px] fill-[#6B8076]"
                        >
                          {tick}%
                        </text>
                      </g>
                    );
                  })}

                  {topClasses.map((row, rIdx) => {
                    const yTop = 8 + rIdx * rowH;
                    return (
                      <g key={row.drugClass}>
                        <text
                          x={leftPad - 8}
                          y={yTop + 18}
                          textAnchor="end"
                          className="text-[10.5px] font-semibold fill-[#14201B]"
                        >
                          {row.drugClass.replace(' Inhibitors', '').replace(' Receptor Agonists', '')}
                        </text>
                        {clusters.map((c, cIdx) => {
                          const pctVal = row.byCluster[c].pct;
                          const dimmed = activeCluster !== null && activeCluster !== c;
                          const w = Math.max(1.5, (pctVal / 100) * barW);
                          const by = yTop + cIdx * 7.5;
                          return (
                            <rect
                              key={c}
                              x={leftPad}
                              y={by}
                              width={w}
                              height={5.5}
                              rx={2}
                              fill={CLUSTER_META[c].color}
                              opacity={dimmed ? 0.25 : 0.92}
                              className="chart-bar-horiz"
                              style={{
                                transformOrigin: `${leftPad}px ${by + 2.75}px`,
                                animationDelay: `${rIdx * 50 + cIdx * 30}ms`,
                              }}
                            >
                              <title>{`${row.drugClass} · ${c}: ${row.byCluster[c].count}/${row.byCluster[c].total} (${pctVal}%)`}</title>
                            </rect>
                          );
                        })}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* Right: Regimen Complexity vs Glycemic Trajectory */}
        <div className="xl:col-span-5 bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
          <div className="pb-3 border-b border-[#EEF3F0]">
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Regimen Complexity &amp; Mean HbA1c (%)
            </h4>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Baseline vs. follow-up HbA1c across monotherapy, dual, triple+ &amp; insulin tiers
            </p>
          </div>

          <div className="pt-3 space-y-3">
            {due.complexityRows
              .filter((r) => r.count > 0)
              .map((row, idx) => {
                const basePct = row.meanBaselineHba1c
                  ? Math.min(100, Math.max(8, (row.meanBaselineHba1c / 14) * 100))
                  : 0;
                const fuPct = row.meanFollowupHba1c
                  ? Math.min(100, Math.max(8, (row.meanFollowupHba1c / 14) * 100))
                  : 0;
                return (
                  <div
                    key={row.tier}
                    className="p-2.5 rounded-lg bg-[#FAFDFB] border border-[#EEF3F0] space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#14201B]">
                        {row.tier}{' '}
                        <span className="font-mono text-[10px] font-normal text-[#6B8076]">
                          ({row.count} pts · {row.pct}%)
                        </span>
                      </span>
                      <span className="font-mono text-[11px] font-semibold text-[#047857] tabular-nums">
                        {row.controlledPct !== null ? `${row.controlledPct}% <7%` : '—'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-[#4B6157]">
                        <span className="w-12 shrink-0">Base</span>
                        <div className="flex-1 h-2 rounded-full bg-[#EEF3F0] overflow-hidden">
                          <div
                            key={`base-${row.tier}-${animationKey}`}
                            className="h-full rounded-full bg-[#D97706] chart-bar-horiz"
                            style={{
                              width: `${basePct}%`,
                              transformOrigin: 'left center',
                              animationDelay: `${idx * 55}ms`,
                            }}
                          />
                        </div>
                        <span className="w-11 text-right tabular-nums">
                          {row.meanBaselineHba1c !== null ? `${row.meanBaselineHba1c}%` : '—'}
                        </span>
                      </div>

                      {row.meanFollowupHba1c !== null && (
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#047857]">
                          <span className="w-12 shrink-0">F/Up</span>
                          <div className="flex-1 h-2 rounded-full bg-[#EEF3F0] overflow-hidden">
                            <div
                              key={`fu-${row.tier}-${animationKey}`}
                              className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                              style={{
                                width: `${fuPct}%`,
                                transformOrigin: 'left center',
                                animationDelay: `${idx * 55 + 40}ms`,
                              }}
                            />
                          </div>
                          <span className="w-11 text-right tabular-nums font-semibold">
                            {row.meanFollowupHba1c}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Antidiabetic Class Utilization Across Clusters (Objective 9) */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Antidiabetic Class Utilization Across Phenotypic Clusters (Objective 9)
            </h4>
            <p className="text-xs text-[#4B6157]">
              Number and percentage of patients prescribed each pharmacological class per cluster
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {clusters.map((c) => {
              const selected = activeCluster === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onSelectCluster(selected ? null : c)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold border transition-colors ${
                    selected
                      ? 'text-white border-transparent'
                      : 'bg-[#FAFDFB] text-[#4B6157] border-[#DDE8E2] hover:text-[#14201B]'
                  }`}
                  style={selected ? { backgroundColor: CLUSTER_META[c].color } : undefined}
                >
                  {c} (n={due.clusterTotals[c]})
                </button>
              );
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-2.5 px-4">Pharmacological Class</th>
                <th className="py-2.5 px-3">Overall Cohort</th>
                {clusters.map((c) => (
                  <th key={c} className="py-2.5 px-3">
                    {c}
                  </th>
                ))}
                <th className="py-2.5 px-4 text-right whitespace-nowrap">χ² p-value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {due.classMatrix.map((row, rIdx) => (
                <tr key={row.drugClass} className="hover:bg-[#FAFDFB]">
                  <td className="py-2.5 px-4 font-semibold text-[#14201B] whitespace-nowrap">
                    {row.drugClass}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[#14201B] tabular-nums w-20 shrink-0">
                        {row.totalPatients} ({row.totalPct}%)
                      </span>
                      <div className="w-20 h-1.5 rounded-full bg-[#EEF3F0] overflow-hidden hidden sm:block">
                        <div
                          key={`${row.drugClass}-overall-${animationKey}`}
                          className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                          style={{
                            width: `${Math.min(100, row.totalPct)}%`,
                            transformOrigin: 'left center',
                            animationDelay: `${rIdx * 45}ms`,
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  {clusters.map((c) => {
                    const cell = row.byCluster[c];
                    const dimmed = activeCluster !== null && activeCluster !== c;
                    return (
                      <td
                        key={c}
                        className={`py-2.5 px-3 font-mono tabular-nums ${
                          activeCluster === c ? 'bg-[#F2F7F4]' : ''
                        } ${dimmed ? 'opacity-40' : 'opacity-100'}`}
                      >
                        <div className="text-[#14201B]">
                          {cell.count}/{cell.total}{' '}
                          <span className="text-[#6B8076]">({cell.pct}%)</span>
                        </div>
                        <div className="h-1 w-16 rounded-full bg-[#EEF3F0] overflow-hidden mt-1">
                          <div
                            key={`${row.drugClass}-${c}-${animationKey}`}
                            className="h-full rounded-full chart-bar-horiz"
                            style={{
                              width: `${cell.pct}%`,
                              backgroundColor: CLUSTER_META[c].color,
                              transformOrigin: 'left center',
                              animationDelay: `${rIdx * 40}ms`,
                            }}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                      row.pValue !== null && row.pValue < 0.05
                        ? 'font-bold text-[#047857]'
                        : 'text-[#4B6157]'
                    }`}
                  >
                    {formatP(row.pValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Treatment Complexity vs Glycemic Control & Clusters (Objective 10) */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#047857]" />
            <div>
              <h4 className="font-display text-sm font-bold text-[#14201B]">
                Treatment Complexity, Glycemic Control &amp; Cluster Association (Objective 10)
              </h4>
              <p className="text-xs text-[#4B6157]">
                χ² = {due.complexityChiSquare.chiSquare ?? '—'} (df={due.complexityChiSquare.df}, p=
                {formatP(due.complexityChiSquare.pValue)})
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-2.5 px-4">Regimen Complexity Tier</th>
                <th className="py-2.5 px-3">Patients n (%)</th>
                {clusters.map((c) => (
                  <th key={c} className="py-2.5 px-2.5">
                    {c}
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right">Baseline HbA1c</th>
                <th className="py-2.5 px-3 text-right">Follow-up HbA1c</th>
                <th className="py-2.5 px-3 text-right">Δ HbA1c</th>
                <th className="py-2.5 px-4 text-right">HbA1c &lt; 7.0%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {due.complexityRows.map((row) => (
                <tr key={row.tier} className="hover:bg-[#FAFDFB]">
                  <td className="py-2.5 px-4 font-semibold text-[#14201B] whitespace-nowrap">
                    {row.tier}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#14201B]">
                    {row.count} <span className="text-[#6B8076]">({row.pct}%)</span>
                  </td>
                  {clusters.map((c) => {
                    const cell = row.byCluster[c];
                    return (
                      <td
                        key={c}
                        className={`py-2.5 px-2.5 font-mono tabular-nums ${
                          activeCluster === c ? 'bg-[#F2F7F4] font-semibold' : 'text-[#4B6157]'
                        }`}
                      >
                        {cell.count} <span className="text-[#6B8076]">({cell.pct}%)</span>
                      </td>
                    );
                  })}
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B]">
                    {row.meanBaselineHba1c !== null ? `${row.meanBaselineHba1c}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B]">
                    {row.meanFollowupHba1c !== null ? `${row.meanFollowupHba1c}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#047857] font-semibold">
                    {row.meanHba1cReduction !== null
                      ? `${row.meanHba1cReduction > 0 ? '−' : '+'}${Math.abs(
                          row.meanHba1cReduction
                        ).toFixed(2)}%`
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {row.controlledPct !== null ? `${row.controlledPct}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Individual Drug Utilization & Concomitant Cardiorenal Therapy */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        <div className="xl:col-span-8 bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#047857]" />
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Antidiabetic Formulary &amp; Dosing Pattern Breakdown
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                  <th className="py-2.5 px-4">Generic Agent</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3">Patients</th>
                  <th className="py-2.5 px-3">Modal Dose / Freq</th>
                  <th className="py-2.5 px-3 text-right">Mean HbA1c</th>
                  <th className="py-2.5 px-4">Clusters</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F0]">
                {due.topDrugs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#6B8076]">
                      No antidiabetic prescriptions entered in CRFs yet.
                    </td>
                  </tr>
                ) : (
                  due.topDrugs.map((drug) => (
                    <tr key={drug.drugName} className="hover:bg-[#FAFDFB]">
                      <td className="py-2.5 px-4 font-semibold text-[#14201B]">
                        {drug.drugName}
                      </td>
                      <td className="py-2.5 px-3 text-[#4B6157]">{drug.drugClass}</td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-[#14201B]">
                        {drug.patientCount} ({drug.patientPct}%)
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#4B6157]">
                        {drug.topDoses} · {drug.commonRoute} · {drug.commonFrequency}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                        {drug.meanPatientHba1c !== null ? `${drug.meanPatientHba1c}%` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-[#047857]">
                        {drug.clustersUsed.join(', ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 pb-2.5 border-b border-[#EEF3F0]">
            <ShieldCheck className="w-4 h-4 text-[#047857]" />
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Concomitant Cardiorenal Therapy
            </h4>
          </div>
          <div className="space-y-3">
            {due.concomitantSummary.map((item, idx) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#14201B]">{item.category}</span>
                  <span className="font-mono tabular-nums text-[#4B6157]">
                    {item.patientCount} pts ({item.patientPct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#EEF3F0] overflow-hidden">
                  <div
                    key={`${item.category}-${animationKey}`}
                    className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                    style={{
                      width: `${Math.min(100, item.patientPct)}%`,
                      transformOrigin: 'left center',
                      animationDelay: `${idx * 65}ms`,
                    }}
                  />
                </div>
                <div className="text-[11px] text-[#6B8076] truncate">{item.topAgents}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
