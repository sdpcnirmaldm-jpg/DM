import React from 'react';
import { Activity } from 'lucide-react';
import type { ClusterCode } from '../utils/statisticalCharts';
import type { VisualStudyInsights } from '../utils/visualInsights';

interface VisualClusterStoryPanelProps {
  insights: VisualStudyInsights;
  activeCluster: ClusterCode | null;
  onSelectCluster: (cluster: ClusterCode | null) => void;
  animationKey: number;
}

export const VisualClusterStoryPanel: React.FC<VisualClusterStoryPanelProps> = ({
  insights,
  activeCluster,
  onSelectCluster,
  animationKey,
}) => {
  const ringRadius = 18;
  const ringCirc = 2 * Math.PI * ringRadius;

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#EEF3F0]">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#047857]" />
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Phenotype Cluster Profiles
          </h3>
        </div>
        {activeCluster && (
          <button
            type="button"
            onClick={() => onSelectCluster(null)}
            className="text-xs font-semibold text-[#047857] hover:underline whitespace-nowrap shrink-0"
          >
            Show All 4 Groups
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {insights.clusterCards.map((card, idx) => {
          const isSelected = activeCluster === card.code;
          const isDimmed = activeCluster !== null && !isSelected;
          const ringOffset = ringCirc * (1 - Math.max(0, Math.min(100, card.pct)) / 100);
          const staggerClass = `analysis-stagger-${Math.min(idx + 1, 6)}`;

          return (
            <button
              key={`${card.code}-${animationKey}`}
              type="button"
              onClick={() => onSelectCluster(isSelected ? null : card.code)}
              className={`${staggerClass} card-elevate text-left rounded-xl border p-4 transition-all relative overflow-hidden ${
                isSelected
                  ? 'bg-[#F2FBF6] border-[#047857] shadow-sm ring-1 ring-[#047857]/30'
                  : 'bg-[#FAFDFB] border-[#DDE8E2] hover:border-[#BFD5C9]'
              } ${isDimmed ? 'opacity-45' : 'opacity-100'}`}
            >
              {/* Animated top cluster accent stripe */}
              <div
                key={`stripe-${card.code}-${animationKey}`}
                className="absolute top-0 left-0 right-0 h-1 chart-bar-horiz"
                style={{
                  backgroundColor: card.color,
                  transformOrigin: 'left center',
                  animationDelay: `${idx * 65}ms`,
                }}
              />

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: card.color }}
                      aria-hidden="true"
                    />
                    <span className="font-display text-sm font-bold text-[#14201B]">
                      {card.code}
                    </span>
                    <span className="text-[11px] font-mono text-[#6B8076] tabular-nums">
                      · {card.count} {card.count === 1 ? 'pt' : 'pts'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#4B6157] mt-1 leading-snug truncate">
                    {card.plainTagline}
                  </div>
                </div>

                {/* Animated radial cohort-share gauge */}
                <div className="relative w-11 h-11 shrink-0 flex items-center justify-center">
                  <svg
                    key={`ring-${card.code}-${animationKey}`}
                    viewBox="0 0 44 44"
                    className="w-11 h-11 -rotate-90"
                    aria-hidden="true"
                  >
                    <circle
                      cx={22}
                      cy={22}
                      r={ringRadius}
                      fill="none"
                      stroke="#E6EEEA"
                      strokeWidth={4}
                    />
                    <circle
                      cx={22}
                      cy={22}
                      r={ringRadius}
                      fill="none"
                      stroke={card.color}
                      strokeWidth={4}
                      strokeLinecap="round"
                      strokeDasharray={ringCirc}
                      strokeDashoffset={ringOffset}
                      className="chart-ring-sweep"
                      style={
                        {
                          '--ring-circ': ringCirc,
                          '--ring-offset': ringOffset,
                          animationDelay: `${120 + idx * 75}ms`,
                        } as React.CSSProperties
                      }
                    />
                  </svg>
                  <span
                    className="absolute font-mono text-[10px] font-bold tabular-nums"
                    style={{ color: card.color }}
                  >
                    {card.pct}%
                  </span>
                </div>
              </div>

              {/* 3 Animated Visual Metric Gauges */}
              <div className="mt-3.5 space-y-2.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#4B6157]">Avg HbA1c</span>
                    <span className="font-mono font-bold text-[#14201B] tabular-nums">
                      {card.meanHba1c !== null ? `${card.meanHba1c}%` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#EEF3F0] overflow-hidden">
                    <div
                      key={`hba1c-${card.code}-${animationKey}`}
                      className="h-full rounded-full chart-bar-horiz"
                      style={{
                        width: `${card.hba1cGaugePct}%`,
                        backgroundColor: card.color,
                        transformOrigin: 'left center',
                        animationDelay: `${160 + idx * 60}ms`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#4B6157]">BMI · Age</span>
                    <span className="font-mono font-semibold text-[#14201B] tabular-nums">
                      {card.meanBmi ?? '—'} kg/m² · {card.meanAge ?? '—'}y
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#EEF3F0] overflow-hidden">
                    <div
                      key={`bmi-${card.code}-${animationKey}`}
                      className="h-full rounded-full bg-[#64748B]/75 chart-bar-horiz"
                      style={{
                        width: `${card.bmiGaugePct}%`,
                        transformOrigin: 'left center',
                        animationDelay: `${210 + idx * 60}ms`,
                      }}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-[#4B6157]">Blue Index DHS</span>
                    <span className="font-mono font-semibold text-[#047857] tabular-nums">
                      {card.meanDhs !== null ? `${card.meanDhs}/50` : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#EEF3F0] overflow-hidden">
                    <div
                      key={`dhs-${card.code}-${animationKey}`}
                      className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                      style={{
                        width: `${card.dhsGaugePct}%`,
                        transformOrigin: 'left center',
                        animationDelay: `${260 + idx * 60}ms`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 border-t border-[#EEF3F0] flex items-center justify-between text-[10px] font-mono">
                <span className="font-semibold" style={{ color: card.color }}>
                  {card.clinicalBadge}
                </span>
                <span className="text-[#6B8076]">
                  {isSelected ? 'Focused' : 'Filter'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
