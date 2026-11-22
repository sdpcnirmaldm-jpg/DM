import React, { useMemo, useState } from 'react';
import type { ContinuousTestResult } from '../../utils/statistics';
import {
  buildRadarProfile,
  CLUSTER_META,
  type ClusterCode,
} from '../../utils/statisticalCharts';

interface ClusterRadarChartProps {
  continuousTests: ContinuousTestResult[];
  activeCluster: ClusterCode | null;
  onSelectCluster: (cluster: ClusterCode | null) => void;
  animationKey: number;
}

export const ClusterRadarChart: React.FC<ClusterRadarChartProps> = ({
  continuousTests,
  activeCluster,
  onSelectCluster,
  animationKey,
}) => {
  const [hoveredCluster, setHoveredCluster] = useState<ClusterCode | null>(null);
  const center = 140;
  const maxRadius = 92;

  const { axes, series } = useMemo(
    () => buildRadarProfile(continuousTests, center, maxRadius),
    [continuousTests]
  );

  const focused = hoveredCluster ?? activeCluster;
  const angleStep = (2 * Math.PI) / axes.length;
  const ringLevels = [0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#EEF3F0]">
        <div>
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Multi-Axis Phenotype Calibration Radar
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Normalized cluster signature across glycemic, adiposity, beta-cell &amp; Blue Index axes
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {series.map((s) => {
            const isSelected = activeCluster === s.cluster;
            return (
              <button
                key={s.cluster}
                type="button"
                disabled={!s.hasData}
                onMouseEnter={() => setHoveredCluster(s.cluster)}
                onMouseLeave={() => setHoveredCluster(null)}
                onClick={() => onSelectCluster(isSelected ? null : s.cluster)}
                className={`px-2 py-1 rounded-md text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-[#14201B] text-white'
                    : s.hasData
                    ? 'bg-[#F2F6F4] text-[#14201B] hover:bg-[#E5EFEA]'
                    : 'bg-[#F8FAF9] text-[#9EB0A6] cursor-not-allowed'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-xs shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span>{s.cluster}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4 pt-4">
        <div className="sm:col-span-7 flex justify-center">
          <svg
            key={`radar-${animationKey}`}
            viewBox="0 0 280 280"
            className="w-64 h-64 max-w-full overflow-visible"
            role="img"
            aria-label="Multi-axis phenotype radar calibration chart"
          >
            {ringLevels.map((lvl, rIdx) => {
              const pts = axes
                .map((_, i) => {
                  const angle = i * angleStep - Math.PI / 2;
                  const r = lvl * maxRadius;
                  return `${(center + Math.cos(angle) * r).toFixed(1)},${(
                    center +
                    Math.sin(angle) * r
                  ).toFixed(1)}`;
                })
                .join(' ');
              return (
                <polygon
                  key={lvl}
                  points={pts}
                  fill="none"
                  stroke={lvl === 1 ? '#CBD8D1' : '#E6EEEA'}
                  strokeWidth={1}
                  className="chart-radar-reveal"
                  style={{
                    transformOrigin: `${center}px ${center}px`,
                    animationDelay: `${rIdx * 45}ms`,
                  }}
                />
              );
            })}

            {axes.map((axis, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const x2 = center + Math.cos(angle) * maxRadius;
              const y2 = center + Math.sin(angle) * maxRadius;
              const labelX = center + Math.cos(angle) * (maxRadius + 20);
              const labelY = center + Math.sin(angle) * (maxRadius + 18);
              const anchor =
                Math.abs(Math.cos(angle)) < 0.25
                  ? 'middle'
                  : Math.cos(angle) > 0
                  ? 'start'
                  : 'end';

              return (
                <g key={axis.shortLabel}>
                  <line
                    x1={center}
                    y1={center}
                    x2={x2}
                    y2={y2}
                    stroke="#E6EEEA"
                    strokeWidth={1}
                  />
                  <text
                    x={labelX}
                    y={labelY + 3}
                    textAnchor={anchor}
                    className="fill-[#14201B] font-mono text-[10px] font-semibold"
                  >
                    {axis.shortLabel}
                  </text>
                </g>
              );
            })}

            {series.map((s, idx) => {
              if (!s.hasData) return null;
              const isFocused = focused === s.cluster;
              const isDimmed = focused !== null && !isFocused;
              const vertexCoords = s.polygonPoints
                .split(' ')
                .map((pair) => pair.split(',').map(Number))
                .filter(([x, y]) => !Number.isNaN(x) && !Number.isNaN(y));

              return (
                <g
                  key={s.cluster}
                  style={{
                    opacity: isDimmed ? 0.22 : 1,
                    transition: 'opacity 200ms ease',
                  }}
                >
                  <polygon
                    points={s.polygonPoints}
                    fill={s.color}
                    fillOpacity={isFocused ? 0.28 : 0.14}
                    stroke={s.color}
                    strokeWidth={isFocused ? 2.5 : 1.75}
                    className="cursor-pointer chart-radar-reveal"
                    style={{
                      transformOrigin: `${center}px ${center}px`,
                      animationDelay: `${110 + idx * 80}ms`,
                      transition: 'fill-opacity 180ms ease, stroke-width 180ms ease',
                    }}
                    onMouseEnter={() => setHoveredCluster(s.cluster)}
                    onMouseLeave={() => setHoveredCluster(null)}
                    onClick={() => onSelectCluster(activeCluster === s.cluster ? null : s.cluster)}
                  />
                  {vertexCoords.map(([vx, vy], vIdx) => (
                    <circle
                      key={`${s.cluster}-v-${vIdx}`}
                      cx={vx}
                      cy={vy}
                      r={isFocused ? 3.5 : 2.5}
                      fill={s.color}
                      stroke="#FFFFFF"
                      strokeWidth={1}
                      className="pointer-events-none chart-scale-in"
                      style={{
                        transformOrigin: `${vx}px ${vy}px`,
                        animationDelay: `${220 + idx * 70 + vIdx * 20}ms`,
                      }}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="sm:col-span-5 space-y-2 border-t sm:border-t-0 sm:border-l border-[#EEF3F0] pt-3 sm:pt-0 sm:pl-4">
          <div className="text-xs font-semibold text-[#14201B]">
            {focused ? `${focused} Mean Vector` : 'Scale Ceilings (100% Ring)'}
          </div>
          <div className="divide-y divide-[#EEF3F0]">
            {axes.map((axis, i) => {
              const focusedSeries = focused
                ? series.find((s) => s.cluster === focused)
                : null;
              return (
                <div
                  key={axis.shortLabel}
                  className="py-1.5 flex items-center justify-between gap-2 text-xs font-mono tabular-nums"
                >
                  <span className="text-[#4B6157]">{axis.shortLabel}</span>
                  <span className="font-semibold text-[#14201B]">
                    {focusedSeries && focusedSeries.hasData
                      ? focusedSeries.rawValues[i]
                      : `≤ ${axis.maxValue}`}
                  </span>
                </div>
              );
            })}
          </div>
          {focused && (
            <p className="text-[11px] text-[#4B6157] pt-1">
              {CLUSTER_META[focused].focus}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
