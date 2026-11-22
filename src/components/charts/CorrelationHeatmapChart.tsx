import React, { useMemo, useState } from 'react';
import type { PatientCRF } from '../../types/clinical';
import { buildCorrelationHeatmap, type HeatmapCell } from '../../utils/biostatisticsExtended';

interface CorrelationHeatmapChartProps {
  patients: PatientCRF[];
  animationKey: number;
}

function getCellFill(r: number | null, isDiagonal: boolean): { bg: string; text: string } {
  if (isDiagonal) return { bg: '#E6EFEA', text: '#14201B' };
  if (r === null) return { bg: '#F6F9F7', text: '#6B8076' };

  const abs = Math.abs(r);
  if (r >= 0) {
    if (abs >= 0.65) return { bg: '#047857', text: '#FFFFFF' };
    if (abs >= 0.4) return { bg: '#34D399', text: '#064E3B' };
    if (abs >= 0.18) return { bg: '#A7F3D0', text: '#065F46' };
    return { bg: '#ECFDF5', text: '#4B6157' };
  }
  if (abs >= 0.65) return { bg: '#BE185D', text: '#FFFFFF' };
  if (abs >= 0.4) return { bg: '#F472B6', text: '#500724' };
  if (abs >= 0.18) return { bg: '#FBCFE8', text: '#831843' };
  return { bg: '#FDF2F8', text: '#4B6157' };
}

export const CorrelationHeatmapChart: React.FC<CorrelationHeatmapChartProps> = ({
  patients,
  animationKey,
}) => {
  const model = useMemo(() => buildCorrelationHeatmap(patients), [patients]);
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null);

  const labelLeft = 64;
  const topOffset = 52;
  const cellSize = 40;
  const k = model.variables.length;
  const svgW = labelLeft + k * cellSize + 14;
  const svgH = topOffset + k * cellSize + 14;

  return (
    <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-[#EEF3F0]">
        <div>
          <h3 className="font-display text-sm font-bold text-[#14201B]">
            Biomarker Correlation Matrix Heatmap (Pearson r)
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Symmetric 8×8 association grid · Asterisk (*) denotes two-tailed p &lt; 0.05
          </p>
        </div>

        {/* Color Legend Scale */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#4B6157] shrink-0">
          <span>−1.0</span>
          <div className="flex h-2.5 w-24 rounded-sm overflow-hidden border border-[#DDE8E2]">
            <span className="flex-1 bg-[#BE185D]" />
            <span className="flex-1 bg-[#F472B6]" />
            <span className="flex-1 bg-[#FBCFE8]" />
            <span className="flex-1 bg-[#F6F9F7]" />
            <span className="flex-1 bg-[#A7F3D0]" />
            <span className="flex-1 bg-[#34D399]" />
            <span className="flex-1 bg-[#047857]" />
          </div>
          <span>+1.0</span>
        </div>
      </div>

      <div className="pt-4 overflow-x-auto">
        <svg
          key={animationKey}
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full max-w-[490px] mx-auto overflow-visible"
          role="img"
          aria-label="8 by 8 Pearson correlation matrix heatmap"
        >
          {/* Top column labels */}
          {model.variables.map((v, colIdx) => {
            const cx = labelLeft + colIdx * cellSize + cellSize / 2;
            const highlighted = hoveredCell?.colIdx === colIdx;
            return (
              <text
                key={v.key}
                x={cx}
                y={topOffset - 8}
                textAnchor="start"
                transform={`rotate(-35 ${cx} ${topOffset - 8})`}
                className={`font-mono text-[10px] ${
                  highlighted ? 'fill-[#047857] font-bold' : 'fill-[#4B6157] font-medium'
                }`}
              >
                {v.shortLabel}
              </text>
            );
          })}

          {/* Rows & Matrix Cells */}
          {model.matrix.map((row, rowIdx) => {
            const ry = topOffset + rowIdx * cellSize;
            const rowHighlighted = hoveredCell?.rowIdx === rowIdx;
            return (
              <g key={model.variables[rowIdx].key}>
                <text
                  x={labelLeft - 8}
                  y={ry + cellSize / 2 + 3.5}
                  textAnchor="end"
                  className={`font-mono text-[10px] ${
                    rowHighlighted ? 'fill-[#047857] font-bold' : 'fill-[#4B6157] font-medium'
                  }`}
                >
                  {model.variables[rowIdx].shortLabel}
                </text>

                {row.map((cell, colIdx) => {
                  const cx = labelLeft + colIdx * cellSize;
                  const isDiag = rowIdx === colIdx;
                  const { bg, text } = getCellFill(cell.r, isDiag);
                  const isHovered =
                    hoveredCell?.rowIdx === rowIdx && hoveredCell?.colIdx === colIdx;
                  const sig = !isDiag && cell.p !== null && cell.p < 0.05;

                  return (
                    <g
                      key={`${rowIdx}-${colIdx}`}
                      className="cursor-pointer chart-scale-in"
                      style={{
                        transformOrigin: `${cx + cellSize / 2}px ${ry + cellSize / 2}px`,
                        animationDelay: `${(rowIdx + colIdx) * 18}ms`,
                      }}
                      onMouseEnter={() => setHoveredCell(cell)}
                      onMouseLeave={() => setHoveredCell(null)}
                      onClick={() => setHoveredCell(cell)}
                    >
                      <rect
                        x={cx + 1.5}
                        y={ry + 1.5}
                        width={cellSize - 3}
                        height={cellSize - 3}
                        rx={5}
                        fill={bg}
                        stroke={isHovered ? '#14201B' : '#FFFFFF'}
                        strokeWidth={isHovered ? 1.8 : 1}
                      />
                      <text
                        x={cx + cellSize / 2}
                        y={ry + cellSize / 2 + 3.5}
                        textAnchor="middle"
                        fill={text}
                        className="font-mono text-[9.5px] font-semibold tabular-nums pointer-events-none"
                      >
                        {cell.r !== null ? `${cell.r.toFixed(2)}${sig ? '*' : ''}` : '—'}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </svg>

        <div className="mt-3 pt-2.5 border-t border-[#EEF3F0] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#4B6157] tabular-nums">
          {hoveredCell ? (
            <>
              <span className="text-[#14201B] font-semibold">
                {hoveredCell.rowLabel} × {hoveredCell.colLabel}
              </span>
              <span>
                r = {hoveredCell.r ?? '—'} ·{' '}
                {hoveredCell.p !== null
                  ? `p = ${hoveredCell.p < 0.0001 ? '<0.0001' : hoveredCell.p.toFixed(4)}`
                  : 'p = —'}{' '}
                · n = {hoveredCell.n}
              </span>
            </>
          ) : (
            <>
              <span>Emerald = positive correlation · Rose = inverse correlation</span>
              <span>Hover any cell for exact p-value</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
