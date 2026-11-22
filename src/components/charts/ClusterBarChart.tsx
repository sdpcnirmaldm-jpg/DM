import React, { useMemo, useState } from 'react';
import type { ContinuousTestResult } from '../../utils/statistics';
import { CLUSTER_META, type ClusterCode } from '../../utils/statisticalCharts';

interface ClusterBarChartProps {
  continuousTests: ContinuousTestResult[];
  activeCluster: ClusterCode | null;
  onSelectCluster: (cluster: ClusterCode | null) => void;
  animationKey: number;
}

export const ClusterBarChart: React.FC<ClusterBarChartProps> = ({
  continuousTests,
  activeCluster,
  onSelectCluster,
  animationKey,
}) => {
  const defaultVar =
    continuousTests.find((t) => t.variable === 'HbA1c (%)')?.variable ||
    continuousTests[0]?.variable ||
    'HbA1c (%)';
  const [selectedVar, setSelectedVar] = useState<string>(defaultVar);
  const [hoveredCluster, setHoveredCluster] = useState<ClusterCode | null>(null);

  const metric = useMemo(
    () => continuousTests.find((t) => t.variable === selectedVar) || continuousTests[0],
    [continuousTests, selectedVar]
  );

  const chartHeight = 190;
  const baselineY = 205;
  const maxVal = useMemo(() => {
    if (!metric) return 10;
    const rawMax = Math.max(
      ...metric.groups.map((g) => (g.n > 0 ? g.mean + g.sd * 0.6 : 0)),
      1
    );
    return rawMax * 1.16;
  }, [metric]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((frac) => ({
    y: baselineY - frac * chartHeight,
    label: Number((frac * maxVal).toFixed(maxVal >= 20 ? 0 : 1)),
  }));

  const hoveredGroup = hoveredCluster
    ? metric?.groups.find((g) => g.group === hoveredCluster)
    : null;

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EEF3F0]">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Biomarker Mean ± SD Across Phenotypes
          </h3>
          {metric && (
            <p className="text-[11px] font-mono text-[#4B6157] tabular-nums mt-0.5 leading-snug">
              ANOVA F={metric.anovaF ?? '—'} · p=
              <span
                className={
                  metric.anovaP !== null && metric.anovaP < 0.05
                    ? 'font-bold text-[#047857]'
                    : ''
                }
              >
                {metric.anovaP === null
                  ? '—'
                  : metric.anovaP < 0.0001
                  ? '<0.0001*'
                  : metric.anovaP < 0.05
                  ? `${metric.anovaP.toFixed(4)}*`
                  : metric.anovaP.toFixed(4)}
              </span>{' '}
              · H={metric.kruskalH ?? '—'}
            </p>
          )}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[#4B6157] shrink-0">
          <span className="sr-only">Select biomarker parameter</span>
          <select
            aria-label="Select biomarker for bar chart"
            value={metric?.variable || selectedVar}
            onChange={(e) => setSelectedVar(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#FAFDFB] text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
          >
            {continuousTests.map((t) => (
              <option key={t.variable} value={t.variable}>
                {t.variable}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pt-4 relative">
        <svg
          key={`${metric?.variable}-${animationKey}`}
          viewBox="0 0 460 242"
          className="w-full h-56 overflow-visible"
          role="img"
          aria-label={`Cluster mean comparison chart for ${metric?.variable || 'biomarker'}`}
        >
          {yTicks.map((tick, idx) => (
            <g key={idx}>
              <line
                x1={48}
                y1={tick.y}
                x2={444}
                y2={tick.y}
                stroke={idx === 0 ? '#CBD8D1' : '#EEF3F0'}
                strokeDasharray={idx === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text
                x={40}
                y={tick.y + 3.5}
                textAnchor="end"
                className="fill-[#6B8076] font-mono text-[10px]"
              >
                {tick.label}
              </text>
            </g>
          ))}

          {(['SIDD', 'SIRD', 'CIRDD', 'MARD'] as ClusterCode[]).map((code, idx) => {
            const g = metric?.groups.find((item) => item.group === code);
            const colCenter = 100 + idx * 96;
            const barWidth = 46;
            const barX = colCenter - barWidth / 2;
            const hasVal = Boolean(g && g.n > 0);
            const rawBarHeight = hasVal ? Math.max(4, (g!.mean / maxVal) * chartHeight) : 0;
            const barY = baselineY - rawBarHeight;
            const color = CLUSTER_META[code].color;
            const isDimmed =
              (activeCluster !== null && activeCluster !== code) ||
              (hoveredCluster !== null && hoveredCluster !== code);

            const sdHalfPx = hasVal ? ((g!.sd * 0.5) / maxVal) * chartHeight : 0;
            const whiskerTop = Math.max(12, barY - sdHalfPx);
            const whiskerBot = Math.min(baselineY - 2, barY + sdHalfPx);

            return (
              <g
                key={code}
                className="cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.32 : 1,
                  transition: 'opacity 180ms ease',
                }}
                onMouseEnter={() => setHoveredCluster(code)}
                onMouseLeave={() => setHoveredCluster(null)}
                onClick={() => onSelectCluster(activeCluster === code ? null : code)}
              >
                <rect x={barX - 12} y={12} width={barWidth + 24} height={baselineY} fill="transparent" />

                {hasVal ? (
                  <>
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={rawBarHeight}
                      rx={5}
                      fill={color}
                      className="chart-bar-rise"
                      style={{
                        transformOrigin: `${colCenter}px ${baselineY}px`,
                        animationDelay: `${idx * 80}ms`,
                      }}
                    />

                    {g!.sd > 0 && (
                      <g
                        className="chart-fade-up"
                        style={{ animationDelay: `${260 + idx * 50}ms` }}
                      >
                        <line
                          x1={colCenter}
                          y1={whiskerTop}
                          x2={colCenter}
                          y2={whiskerBot}
                          stroke="#14201B"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={colCenter - 6}
                          y1={whiskerTop}
                          x2={colCenter + 6}
                          y2={whiskerTop}
                          stroke="#14201B"
                          strokeWidth={1.5}
                        />
                        <line
                          x1={colCenter - 6}
                          y1={whiskerBot}
                          x2={colCenter + 6}
                          y2={whiskerBot}
                          stroke="#14201B"
                          strokeWidth={1.5}
                        />
                      </g>
                    )}

                    <text
                      x={colCenter}
                      y={Math.max(12, whiskerTop - 7)}
                      textAnchor="middle"
                      className="fill-[#14201B] font-mono text-[10px] font-bold chart-fade-up"
                      style={{ animationDelay: `${240 + idx * 50}ms` }}
                    >
                      {g!.mean}
                    </text>
                  </>
                ) : (
                  <text
                    x={colCenter}
                    y={baselineY - 10}
                    textAnchor="middle"
                    className="fill-[#6B8076] font-mono text-[10px]"
                  >
                    n=0
                  </text>
                )}

                <text
                  x={colCenter}
                  y={226}
                  textAnchor="middle"
                  className="font-mono text-[11px] font-bold"
                  fill={isDimmed ? '#6B8076' : '#14201B'}
                >
                  {code}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-2 pt-2.5 border-t border-[#EEF3F0] flex items-center justify-between gap-2 text-[11px] font-mono text-[#4B6157] tabular-nums">
          {hoveredGroup && hoveredGroup.n > 0 ? (
            <>
              <span>
                <strong className="text-[#14201B]">{hoveredCluster}</strong> · Mean{' '}
                {hoveredGroup.mean} ± {hoveredGroup.sd}
              </span>
              <span>
                Med {hoveredGroup.median} [IQR {hoveredGroup.iqr}] · n={hoveredGroup.n}
              </span>
            </>
          ) : (
            <>
              <span>Whiskers: ±0.5 SD spread</span>
              <span>Hover bar for Median &amp; IQR</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
