import React from 'react';
import { ClipboardCheck, ArrowUpRight, Users, GitCompare } from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import { buildProtocolObjectivesReport } from '../utils/protocolObjectives';
import { CLUSTER_META, type ClusterCode } from '../utils/statisticalCharts';

export type ObjectiveJumpTarget =
  | 'objectives'
  | 'due'
  | 'overview'
  | 'descriptive'
  | 'comparative'
  | 'modeling';

interface ProtocolObjectivesPanelProps {
  patients: PatientCRF[];
  activeCluster: ClusterCode | null;
  animationKey?: number;
  onJumpToSection: (section: ObjectiveJumpTarget) => void;
}

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.0001) return '<0.0001*';
  return p < 0.05 ? `${p.toFixed(4)}*` : p.toFixed(4);
}

function mapLegacyTarget(
  target: 'objectives' | 'due' | 'charts' | 'parametric' | 'categorical'
): ObjectiveJumpTarget {
  if (target === 'charts') return 'overview';
  if (target === 'parametric' || target === 'categorical') return 'comparative';
  return target;
}

export const ProtocolObjectivesPanel: React.FC<ProtocolObjectivesPanelProps> = ({
  patients,
  activeCluster,
  animationKey = 0,
  onJumpToSection,
}) => {
  const report = React.useMemo(() => buildProtocolObjectivesReport(patients), [patients]);
  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];

  return (
    <div className="space-y-5">
      {/* Section E4 Protocol Secondary Objectives Coverage (1–12) */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] border border-[#BFD5C9] flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-4 h-4 text-[#047857]" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Protocol E4 Secondary Objectives Matrix (1–12)
              </h3>
              <p className="text-xs font-mono text-[#6B8076] mt-0.5">
                SDPC-IEC/DHR2026/05 · Live cohort endpoints
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-semibold text-[#047857]">
            12 / 12 Objectives Tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {report.objectivesMatrix.map((obj, idx) => (
            <div
              key={`${obj.number}-${animationKey}`}
              className="chart-fade-up card-elevate p-3.5 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] flex flex-col justify-between gap-2.5"
              style={{ animationDelay: `${Math.min(idx * 35, 350)}ms` }}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-mono font-bold text-[#047857]">
                    OBJ {String(obj.number).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] font-mono text-[#6B8076]">{obj.sampleCoverage}</span>
                </div>
                <div className="text-xs font-semibold text-[#14201B] leading-snug">
                  {obj.title}
                </div>
              </div>

              <div className="pt-2 border-t border-[#EEF3F0] flex items-center justify-between gap-2">
                <span className="text-[11px] text-[#4B6157] leading-snug">{obj.liveFinding}</span>
                {obj.targetSection !== 'objectives' && (
                  <button
                    type="button"
                    onClick={() => onJumpToSection(mapLegacyTarget(obj.targetSection))}
                    className="text-[11px] font-semibold text-[#047857] hover:underline inline-flex items-center gap-0.5 shrink-0"
                  >
                    <span>{obj.sectionLabel}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Graphical Age-Group Phenotypic Cluster & Complication Burden Plot */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
          <div>
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Graphical Age-Band Cluster Composition &amp; Complication Profile (18–75 yrs)
            </h4>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Stacked cluster distribution per protocol age stratum with mean HbA1c and microvascular/macrovascular rates
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7">
            {(() => {
              const maxBandCount = Math.max(1, ...report.ageBands.map((b) => b.count));
              const colW = 62;
              const chartTop = 18;
              const chartBottom = 152;
              const chartH = chartBottom - chartTop;
              const startX = 36;
              return (
                <svg
                  key={`age-stack-${animationKey}`}
                  viewBox={`0 0 ${startX + report.ageBands.length * colW + 14} 182`}
                  className="w-full h-48 overflow-visible"
                  role="img"
                  aria-label="Age group stacked cluster distribution bar chart"
                >
                  {[0, 0.5, 1].map((f, i) => {
                    const y = chartBottom - f * chartH;
                    const val = Math.round(maxBandCount * f);
                    return (
                      <g key={i}>
                        <line
                          x1={startX - 6}
                          y1={y}
                          x2={startX + report.ageBands.length * colW}
                          y2={y}
                          stroke={i === 0 ? '#CBD8D1' : '#EEF3F0'}
                          strokeDasharray={i === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={startX - 10}
                          y={y + 3}
                          textAnchor="end"
                          className="font-mono text-[9.5px] fill-[#6B8076]"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {report.ageBands.map((row, idx) => {
                    const cx = startX + idx * colW + colW / 2;
                    let currentBottom = chartBottom;
                    return (
                      <g key={row.band}>
                        {clusters.map((c, cIdx) => {
                          const cnt = row.clusters[c];
                          if (cnt === 0) return null;
                          const segH = (cnt / maxBandCount) * chartH;
                          const segY = currentBottom - segH;
                          currentBottom = segY;
                          const dimmed = activeCluster !== null && activeCluster !== c;
                          return (
                            <rect
                              key={c}
                              x={cx - 16}
                              y={segY}
                              width={32}
                              height={Math.max(2, segH)}
                              rx={2}
                              fill={CLUSTER_META[c].color}
                              stroke="#FFFFFF"
                              strokeWidth={0.8}
                              opacity={dimmed ? 0.25 : 0.94}
                              className="chart-bar-rise"
                              style={{
                                transformOrigin: `${cx}px ${chartBottom}px`,
                                animationDelay: `${idx * 45 + cIdx * 25}ms`,
                              }}
                            >
                              <title>{`${row.band} yrs · ${c}: ${cnt} patients`}</title>
                            </rect>
                          );
                        })}

                        {row.count > 0 && (
                          <text
                            x={cx}
                            y={currentBottom - 5}
                            textAnchor="middle"
                            className="font-mono text-[9.5px] font-bold fill-[#14201B]"
                          >
                            {row.count}
                          </text>
                        )}
                        <text
                          x={cx}
                          y={chartBottom + 15}
                          textAnchor="middle"
                          className="font-mono text-[9.5px] fill-[#4B6157]"
                        >
                          {row.band}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              );
            })()}
          </div>

          <div className="lg:col-span-5 space-y-2.5">
            {report.ageBands
              .filter((b) => b.count > 0)
              .map((row, idx) => (
                <div
                  key={`${row.band}-${animationKey}`}
                  className="chart-fade-up p-3 rounded-lg bg-[#FAFDFB] border border-[#EEF3F0] space-y-2 text-xs"
                  style={{ animationDelay: `${idx * 45}ms` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-[#14201B]">{row.band} yrs</span>
                    <span className="text-[11px] font-mono text-[#4B6157] tabular-nums">
                      HbA1c {row.meanHba1c ?? '—'}% · DHS {row.meanDhs ?? '—'}/50
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono tabular-nums">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[#047857] font-semibold">
                        <span>Micro</span>
                        <span>{row.microvascularPct ?? 0}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EEF3F0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                          style={{
                            width: `${row.microvascularPct ?? 0}%`,
                            transformOrigin: 'left center',
                            animationDelay: `${idx * 50}ms`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-[#D97706] font-semibold">
                        <span>Macro</span>
                        <span>{row.macrovascularPct ?? 0}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[#EEF3F0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#D97706] chart-bar-horiz"
                          style={{
                            width: `${row.macrovascularPct ?? 0}%`,
                            transformOrigin: 'left center',
                            animationDelay: `${idx * 50 + 40}ms`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Objectives 1 & 12: Predefined Adult Age-Group Stratification (18-25 to 66-75) */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#047857]" />
            <div>
              <h4 className="font-display text-sm font-bold text-[#14201B]">
                Predefined Age-Group Stratification (Objectives 1 &amp; 12)
              </h4>
              <p className="text-xs text-[#4B6157]">
                Cluster χ² = {report.ageClusterChiSquare.chiSquare ?? '—'} (p=
                {formatP(report.ageClusterChiSquare.pValue)}) · Blue Index DHS χ² ={' '}
                {report.ageDhsChiSquare.chiSquare ?? '—'} (p={formatP(report.ageDhsChiSquare.pValue)})
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-2.5 px-4">Age Group (yrs)</th>
                <th className="py-2.5 px-3">Patients n (%)</th>
                <th className="py-2.5 px-3">Phenotypic Clusters</th>
                <th className="py-2.5 px-3 text-right">Mean HbA1c</th>
                <th className="py-2.5 px-3 text-right">Blue Index DHS</th>
                <th className="py-2.5 px-3 text-right">DDS-17 Mean / Distress</th>
                <th className="py-2.5 px-4 text-right">Complications (KS / Micro / Macro)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {report.ageBands.map((row) => (
                <tr key={row.band} className="hover:bg-[#FAFDFB]">
                  <td className="py-2.5 px-4 font-mono font-bold text-[#14201B] whitespace-nowrap">
                    {row.band}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#14201B]">
                    {row.count} <span className="text-[#6B8076]">({row.pct}%)</span>
                  </td>
                  <td className="py-2.5 px-3">
                    {row.count === 0 ? (
                      <span className="text-[#6B8076] font-mono">—</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                        {clusters.map((c) => {
                          const cnt = row.clusters[c];
                          if (cnt === 0) return null;
                          const dimmed = activeCluster !== null && activeCluster !== c;
                          return (
                            <span
                              key={c}
                              className={`inline-flex items-center gap-1 ${
                                dimmed ? 'opacity-35' : 'opacity-100'
                              }`}
                            >
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: CLUSTER_META[c].color }}
                              />
                              <span className="text-[#14201B]">
                                {c}: {cnt}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B]">
                    {row.meanHba1c !== null ? `${row.meanHba1c}%` : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {row.meanDhs !== null ? (
                      <div>
                        <span className="text-[#14201B] font-semibold">{row.meanDhs}/50</span>
                        {row.excellentDhsPct !== null && (
                          <div className="text-[10px] text-[#6B8076]">
                            Excl {row.excellentDhsPct}% · Undes {row.undesirableDhsPct ?? 0}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#6B8076]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {row.meanDdsMean !== null ? (
                      <div>
                        <span className="text-[#14201B]">{row.meanDdsMean}/6</span>
                        {row.distressModHighPct !== null && (
                          <div className="text-[10px] text-[#6B8076]">
                            Mod/High {row.distressModHighPct}%
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#6B8076]">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                    {row.meanKsTotal !== null ? (
                      <div>
                        <span className="text-[#14201B]">KS {row.meanKsTotal}/15</span>
                        <div className="text-[10px] text-[#6B8076]">
                          Micro {row.microvascularPct ?? 0}% · Macro {row.macrovascularPct ?? 0}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#6B8076]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Objectives 6 & 8 Correlation Matrix (Blue Index · DDS-17 · FibroScan · HbA1c · Complications) */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-[#047857]" />
          <div>
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Blue Index, DDS-17 Distress, FibroScan &amp; Complication Correlations (Objectives 6 &amp; 8)
            </h4>
            <p className="text-xs text-[#4B6157]">
              Bivariate Pearson r and non-parametric Spearman ρ with two-tailed p-values
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-2.5 px-4">Protocol Relationship Pair</th>
                <th className="py-2.5 px-3 text-right">Paired n</th>
                <th className="py-2.5 px-3 text-right">Pearson r</th>
                <th className="py-2.5 px-3 text-right">Pearson p</th>
                <th className="py-2.5 px-3 text-right">Spearman ρ</th>
                <th className="py-2.5 px-4 text-right">Spearman p</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {report.objectiveCorrelations.map((corr) => (
                <tr key={corr.label} className="hover:bg-[#FAFDFB]">
                  <td className="py-2.5 px-4 font-medium text-[#14201B]">{corr.label}</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                    {corr.n}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B] font-semibold">
                    {corr.pearsonR ?? '—'}
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                      corr.pearsonP !== null && corr.pearsonP < 0.05
                        ? 'font-bold text-[#047857]'
                        : 'text-[#4B6157]'
                    }`}
                  >
                    {formatP(corr.pearsonP)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B] font-semibold">
                    {corr.spearmanRho ?? '—'}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums ${
                      corr.spearmanP !== null && corr.spearmanP < 0.05
                        ? 'font-bold text-[#047857]'
                        : 'text-[#4B6157]'
                    }`}
                  >
                    {formatP(corr.spearmanP)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
