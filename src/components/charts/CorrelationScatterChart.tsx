import React, { useMemo, useState } from 'react';
import type { PatientCRF } from '../../types/clinical';
import { analyzeCorrelation } from '../../utils/statistics';
import {
  buildScatterPlotModel,
  type ClusterCode,
  type ScatterPairKey,
  type ScatterPoint,
} from '../../utils/statisticalCharts';

interface CorrelationScatterChartProps {
  patients: PatientCRF[];
  activeCluster: ClusterCode | null;
  animationKey: number;
}

const PAIR_OPTIONS: Array<{ key: ScatterPairKey; label: string }> = [
  { key: 'age-hba1c', label: 'Age vs HbA1c' },
  { key: 'hb-hba1c', label: 'Hb vs HbA1c' },
  { key: 'bmi-homair', label: 'BMI vs HOMA-IR' },
  { key: 'hba1c-dhs', label: 'HbA1c vs Blue Index DHS' },
  { key: 'dhs-dds', label: 'Blue Index DHS vs DDS-17' },
  { key: 'lsm-bmi', label: 'BMI vs FibroScan LSM' },
  { key: 'cap-tg', label: 'Triglycerides vs FibroScan CAP' },
];

export const CorrelationScatterChart: React.FC<CorrelationScatterChartProps> = ({
  patients,
  activeCluster,
  animationKey,
}) => {
  const [pairKey, setPairKey] = useState<ScatterPairKey>('age-hba1c');
  const [hoveredPoint, setHoveredPoint] = useState<ScatterPoint | null>(null);

  const model = useMemo(() => buildScatterPlotModel(patients, pairKey), [patients, pairKey]);
  const stats = useMemo(
    () =>
      analyzeCorrelation(
        model.title,
        model.points.map((pt) => [pt.x, pt.y])
      ),
    [model]
  );

  const plotLeft = 52;
  const plotRight = 436;
  const plotTop = 18;
  const plotBottom = 198;
  const plotW = plotRight - plotLeft;
  const plotH = plotBottom - plotTop;

  const scaleX = (x: number) =>
    plotLeft + ((x - model.xDomain[0]) / (model.xDomain[1] - model.xDomain[0])) * plotW;
  const scaleY = (y: number) =>
    plotBottom - ((y - model.yDomain[0]) / (model.yDomain[1] - model.yDomain[0])) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const val = model.yDomain[0] + f * (model.yDomain[1] - model.yDomain[0]);
    return { y: plotBottom - f * plotH, label: val.toFixed(1) };
  });

  const xTicks = [0, 0.5, 1].map((f) => {
    const val = model.xDomain[0] + f * (model.xDomain[1] - model.xDomain[0]);
    return { x: plotLeft + f * plotW, label: val.toFixed(1) };
  });

  const regressionCoords = useMemo(() => {
    if (model.slope === null || model.intercept === null) return null;
    const x1 = model.xDomain[0];
    const x2 = model.xDomain[1];
    const y1 = Math.max(
      model.yDomain[0],
      Math.min(model.yDomain[1], model.slope * x1 + model.intercept)
    );
    const y2 = Math.max(
      model.yDomain[0],
      Math.min(model.yDomain[1], model.slope * x2 + model.intercept)
    );
    return { x1: scaleX(x1), y1: scaleY(y1), x2: scaleX(x2), y2: scaleY(y2) };
  }, [model]);

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Correlation &amp; Linear Trend Graph
          </h3>
          <p className="text-xs font-mono text-[#4B6157] tabular-nums mt-0.5 truncate">
            Pearson r = {stats.pearsonR ?? '—'} (p={stats.pearsonP ?? '—'}) · Spearman ρ ={' '}
            {stats.spearmanRho ?? '—'} · n = {stats.n}
          </p>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[#4B6157] shrink-0">
          <span className="sr-only">Correlation variable pair</span>
          <select
            aria-label="Correlation variable pair"
            value={pairKey}
            onChange={(e) => setPairKey(e.target.value as ScatterPairKey)}
            className="px-2.5 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#FAFDFB] text-xs font-medium text-[#14201B] focus:outline-none focus:border-[#047857]"
          >
            {PAIR_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="pt-3 flex-1 flex flex-col justify-between">
        <svg
          key={`${pairKey}-${animationKey}`}
          viewBox="0 0 460 238"
          className="w-full h-64 overflow-visible cursor-crosshair"
          role="img"
          aria-label={`Scatter regression graph for ${model.title}`}
        >
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={plotLeft}
                y1={t.y}
                x2={plotRight}
                y2={t.y}
                stroke={i === 0 ? '#CBD8D1' : '#EEF3F0'}
                strokeDasharray={i === 0 ? undefined : '3 3'}
                strokeWidth={1}
              />
              <text
                x={plotLeft - 7}
                y={t.y + 3}
                textAnchor="end"
                className="fill-[#6B8076] font-mono text-[10px]"
              >
                {t.label}
              </text>
            </g>
          ))}

          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={plotBottom + 16}
              textAnchor="middle"
              className="fill-[#6B8076] font-mono text-[10px]"
            >
              {t.label}
            </text>
          ))}

          <text
            x={(plotLeft + plotRight) / 2}
            y={232}
            textAnchor="middle"
            className="fill-[#4B6157] font-mono text-[10px] font-semibold"
          >
            {model.xLabel} ({model.xUnit})
          </text>
          <text
            x={14}
            y={(plotTop + plotBottom) / 2}
            textAnchor="middle"
            transform={`rotate(-90 14 ${(plotTop + plotBottom) / 2})`}
            className="fill-[#4B6157] font-mono text-[10px] font-semibold"
          >
            {model.yLabel} ({model.yUnit})
          </text>

          {regressionCoords && (
            <line
              x1={regressionCoords.x1}
              y1={regressionCoords.y1}
              x2={regressionCoords.x2}
              y2={regressionCoords.y2}
              stroke="#14201B"
              strokeWidth={1.75}
              className="chart-line-draw"
            />
          )}

          {hoveredPoint && (
            <g className="pointer-events-none">
              <line
                x1={scaleX(hoveredPoint.x)}
                y1={plotTop}
                x2={scaleX(hoveredPoint.x)}
                y2={plotBottom}
                stroke="#94A89E"
                strokeDasharray="2 2"
                strokeWidth={1}
              />
              <line
                x1={plotLeft}
                y1={scaleY(hoveredPoint.y)}
                x2={plotRight}
                y2={scaleY(hoveredPoint.y)}
                stroke="#94A89E"
                strokeDasharray="2 2"
                strokeWidth={1}
              />
            </g>
          )}

          {model.points.map((pt, idx) => {
            const cx = scaleX(pt.x);
            const cy = scaleY(pt.y);
            const isHovered = hoveredPoint === pt;
            const dimmed = activeCluster !== null && activeCluster !== pt.cluster;

            return (
              <g
                key={`${pt.uhid || pt.participantId || pt.patientName || 'pt'}-${idx}`}
                style={{
                  opacity: dimmed ? 0.22 : 0.95,
                  transition: 'opacity 180ms ease',
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isHovered ? 7.5 : 5.5}
                  fill={pt.color}
                  stroke="#FFFFFF"
                  strokeWidth={1.75}
                  className="cursor-pointer chart-scale-in"
                  style={{
                    transformOrigin: `${cx}px ${cy}px`,
                    animationDelay: `${Math.min(idx * 45, 360)}ms`,
                    transition: 'r 150ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={() => setHoveredPoint(pt)}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              </g>
            );
          })}
        </svg>

        <div className="mt-2 pt-2.5 border-t border-[#EEF3F0] flex items-center justify-between gap-2 text-[11px] font-mono text-[#4B6157] tabular-nums">
          {hoveredPoint ? (
            <>
              <span className="truncate">
                <strong className="text-[#14201B]">{hoveredPoint.patientName || 'Unnamed'}</strong> (
                {hoveredPoint.uhid ? `${hoveredPoint.uhid} · ` : ''}
                {hoveredPoint.cluster})
              </span>
              <span className="shrink-0">
                {model.xLabel} {hoveredPoint.x} · {model.yLabel} {hoveredPoint.y}
              </span>
            </>
          ) : (
            <>
              <span>Dashed line: ordinary least-squares fit</span>
              <span>Hover dot to inspect point</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
