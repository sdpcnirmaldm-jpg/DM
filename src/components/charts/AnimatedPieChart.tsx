import React, { useState } from 'react';
import { CLUSTER_META, type ClusterCode, type PieSegment } from '../../utils/statisticalCharts';

interface AnimatedPieChartProps {
  segments: PieSegment[];
  totalPatients: number;
  activeCluster: ClusterCode | null;
  onSelectCluster: (cluster: ClusterCode | null) => void;
  animationKey: number;
}

function describePieWedge(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const sweep = endAngleDeg - startAngleDeg;
  if (sweep >= 359.99) {
    return `M ${cx} ${cy - radius} A ${radius} ${radius} 0 1 1 ${cx - 0.01} ${
      cy - radius
    } Z`;
  }
  const startRad = (startAngleDeg * Math.PI) / 180;
  const endRad = (endAngleDeg * Math.PI) / 180;
  const x1 = cx + radius * Math.cos(startRad);
  const y1 = cy + radius * Math.sin(startRad);
  const x2 = cx + radius * Math.cos(endRad);
  const y2 = cy + radius * Math.sin(endRad);
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(
    2
  )} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

export const AnimatedPieChart: React.FC<AnimatedPieChartProps> = ({
  segments,
  totalPatients,
  activeCluster,
  onSelectCluster,
  animationKey,
}) => {
  const [hovered, setHovered] = useState<ClusterCode | null>(null);
  const [chartStyle, setChartStyle] = useState<'donut' | 'pie'>('donut');

  const focusedCode = hovered ?? activeCluster;
  const focusedSegment = focusedCode ? segments.find((s) => s.name === focusedCode) : null;
  const radius = 78;
  const cx = 120;
  const cy = 120;

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#EEF3F0]">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Phenotype Cluster Proportion (Pie Chart)
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5 truncate">
            Click any slice or row to focus cluster
          </p>
        </div>

        <div
          className="inline-flex items-center p-0.5 bg-[#F2F6F4] border border-[#DDE8E2] rounded-lg shrink-0"
          role="group"
          aria-label="Pie display style"
        >
          <button
            type="button"
            onClick={() => setChartStyle('donut')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              chartStyle === 'donut'
                ? 'bg-white text-[#14201B] shadow-xs'
                : 'text-[#4B6157] hover:text-[#14201B]'
            }`}
          >
            Ring Donut
          </button>
          <button
            type="button"
            onClick={() => setChartStyle('pie')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              chartStyle === 'pie'
                ? 'bg-white text-[#14201B] shadow-xs'
                : 'text-[#4B6157] hover:text-[#14201B]'
            }`}
          >
            Full Pie
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-5 pt-4">
        <div className="sm:col-span-5 flex flex-col items-center justify-center relative">
          <svg
            key={`${chartStyle}-${animationKey}`}
            viewBox="0 0 240 240"
            className="w-52 h-52 max-w-full overflow-visible"
            role="img"
            aria-label="Phenotype cluster distribution pie chart"
          >
            {totalPatients === 0 ? (
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="#E4ECE8"
                strokeWidth={chartStyle === 'donut' ? 32 : 2}
              />
            ) : chartStyle === 'donut' ? (
              <>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke="#EEF3F0"
                  strokeWidth={34}
                />
                {segments.map((seg, idx) => {
                  if (seg.count === 0) return null;
                  const isFocused = focusedCode === seg.name;
                  const dimmed = focusedCode !== null && !isFocused;
                  const shiftX = isFocused ? seg.popX : 0;
                  const shiftY = isFocused ? seg.popY : 0;
                  return (
                    <g
                      key={seg.name}
                      style={{
                        transform: `translate(${shiftX}px, ${shiftY}px)`,
                        transition:
                          'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
                        opacity: dimmed ? 0.35 : 1,
                      }}
                    >
                      <circle
                        cx={cx}
                        cy={cy}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={isFocused ? 40 : 34}
                        strokeDasharray={`${seg.arcLength} ${seg.circumference}`}
                        strokeDashoffset={seg.dashOffset}
                        strokeLinecap="butt"
                        transform={`rotate(-90 ${cx} ${cy})`}
                        className="cursor-pointer chart-pie-sweep"
                        style={
                          {
                            '--pie-start-offset': seg.circumference,
                            '--pie-end-offset': seg.dashOffset,
                            animationDelay: `${idx * 75}ms`,
                            transition: 'stroke-width 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                          } as React.CSSProperties
                        }
                        onMouseEnter={() => setHovered(seg.name)}
                        onMouseLeave={() => setHovered(null)}
                        onClick={() =>
                          onSelectCluster(activeCluster === seg.name ? null : seg.name)
                        }
                      />
                    </g>
                  );
                })}
                <text
                  x={cx}
                  y={cy - 6}
                  textAnchor="middle"
                  className="fill-[#14201B] font-mono text-[24px] font-bold"
                >
                  {focusedSegment ? `${focusedSegment.pct}%` : totalPatients}
                </text>
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  className="fill-[#4B6157] font-mono text-[10px] font-semibold"
                >
                  {focusedSegment
                    ? `${focusedSegment.name} (n=${focusedSegment.count})`
                    : 'TOTAL COHORT'}
                </text>
              </>
            ) : (
              segments.map((seg, idx) => {
                if (seg.count === 0) return null;
                const isFocused = focusedCode === seg.name;
                const dimmed = focusedCode !== null && !isFocused;
                const shiftX = isFocused ? seg.popX : 0;
                const shiftY = isFocused ? seg.popY : 0;
                return (
                  <g
                    key={seg.name}
                    style={{
                      transform: `translate(${shiftX}px, ${shiftY}px)`,
                      transition:
                        'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 220ms ease',
                      opacity: dimmed ? 0.38 : 1,
                    }}
                  >
                    <path
                      d={describePieWedge(cx, cy, 94, seg.startAngle, seg.endAngle)}
                      fill={seg.color}
                      stroke="#FFFFFF"
                      strokeWidth={2.5}
                      className="cursor-pointer chart-scale-in"
                      style={{
                        transformOrigin: `${cx}px ${cy}px`,
                        animationDelay: `${idx * 65}ms`,
                      }}
                      onMouseEnter={() => setHovered(seg.name)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() =>
                        onSelectCluster(activeCluster === seg.name ? null : seg.name)
                      }
                    />
                  </g>
                );
              })
            )}
          </svg>
        </div>

        <div className="sm:col-span-7 divide-y divide-[#EEF3F0]">
          {segments.map((seg, idx) => {
            const isSelected = activeCluster === seg.name;
            const meta = CLUSTER_META[seg.name];
            return (
              <button
                key={seg.name}
                type="button"
                onMouseEnter={() => setHovered(seg.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelectCluster(isSelected ? null : seg.name)}
                className={`w-full text-left py-2.5 px-2.5 transition-colors rounded-lg flex items-center justify-between gap-3 ${
                  isSelected ? 'bg-[#F2F7F4]' : 'hover:bg-[#FAFDFB]'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs font-bold text-[#14201B]">
                      {seg.name}
                    </span>
                    <span className="text-xs text-[#4B6157] truncate">{meta.fullName}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-40 max-w-full bg-[#EEF3F0] rounded-full overflow-hidden">
                    <div
                      key={`${seg.name}-bar-${animationKey}`}
                      className="h-full rounded-full chart-bar-horiz"
                      style={{
                        width: `${seg.pct}%`,
                        backgroundColor: seg.color,
                        transformOrigin: 'left center',
                        animationDelay: `${idx * 70}ms`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums shrink-0">
                  <div className="text-xs font-bold text-[#14201B]">{seg.exactPct}%</div>
                  <div className="text-[11px] text-[#6B8076]">n = {seg.count}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
