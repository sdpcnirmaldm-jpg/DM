import React, { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import {
  computeStudyRegressions,
  type RegressionOutcomeKey,
} from '../utils/biostatisticsExtended';
import { CLUSTER_META, type ClusterCode } from '../utils/statisticalCharts';
import { describeRegressionPlain } from '../utils/visualInsights';

interface RegressionAnalysisPanelProps {
  patients: PatientCRF[];
  activeCluster: ClusterCode | null;
  animationKey: number;
}

function formatP(p: number | null): string {
  if (p === null) return '—';
  if (p < 0.0001) return '<0.0001*';
  return p < 0.05 ? `${p.toFixed(4)}*` : p.toFixed(4);
}

export const RegressionAnalysisPanel: React.FC<RegressionAnalysisPanelProps> = ({
  patients,
  activeCluster,
  animationKey,
}) => {
  const suites = useMemo(() => computeStudyRegressions(patients), [patients]);
  const [outcomeKey, setOutcomeKey] = useState<RegressionOutcomeKey>('hba1c');
  const [selectedPredictorKey, setSelectedPredictorKey] = useState<string | null>(null);

  const activeSuite = suites.find((s) => s.outcomeKey === outcomeKey) || suites[0];

  const activeModel = useMemo(() => {
    if (selectedPredictorKey) {
      const match = activeSuite.models.find((m) => m.predictorKey === selectedPredictorKey);
      if (match) return match;
    }
    return activeSuite.models[0];
  }, [activeSuite, selectedPredictorKey]);

  // Forest Plot Geometry for Standardized Beta (95% CI)
  const validForestModels = activeSuite.models.filter((m) => m.standardizedBeta !== null);
  const maxAbsBeta = useMemo(() => {
    let maxVal = 0.6;
    for (const m of validForestModels) {
      if (m.stdBetaCiLower !== null) maxVal = Math.max(maxVal, Math.abs(m.stdBetaCiLower));
      if (m.stdBetaCiUpper !== null) maxVal = Math.max(maxVal, Math.abs(m.stdBetaCiUpper));
    }
    return Math.min(2.2, Math.max(0.8, Number((maxVal * 1.15).toFixed(2))));
  }, [validForestModels]);

  const forestLeft = 138;
  const forestRight = 326;
  const forestW = forestRight - forestLeft;
  const scaleBetaX = (b: number) => {
    const clamped = Math.max(-maxAbsBeta, Math.min(maxAbsBeta, b));
    return forestLeft + ((clamped + maxAbsBeta) / (2 * maxAbsBeta)) * forestW;
  };
  const zeroX = scaleBetaX(0);

  // Fitted Curve Geometry for selected OLS Model
  const scatterBounds = useMemo(() => {
    if (!activeModel || activeModel.points.length === 0) {
      return { xMin: 0, xMax: 10, yMin: 0, yMax: 10 };
    }
    const xs = activeModel.points.map((p) => p.x);
    const ys = activeModel.points.map((p) => p.y);
    const rxMin = Math.min(...xs);
    const rxMax = Math.max(...xs);
    const ryMin = Math.min(...ys);
    const ryMax = Math.max(...ys);
    const xPad = rxMax === rxMin ? 1 : (rxMax - rxMin) * 0.1;
    const yPad = ryMax === ryMin ? 1 : (ryMax - ryMin) * 0.14;
    return {
      xMin: Math.max(0, rxMin - xPad),
      xMax: rxMax + xPad,
      yMin: Math.max(0, ryMin - yPad),
      yMax: ryMax + yPad,
    };
  }, [activeModel]);

  const pLeft = 50;
  const pRight = 436;
  const pTop = 18;
  const pBottom = 186;
  const pW = pRight - pLeft;
  const pH = pBottom - pTop;
  const scalePlotX = (x: number) =>
    pLeft + ((x - scatterBounds.xMin) / Math.max(0.001, scatterBounds.xMax - scatterBounds.xMin)) * pW;
  const scalePlotY = (y: number) =>
    pBottom - ((y - scatterBounds.yMin) / Math.max(0.001, scatterBounds.yMax - scatterBounds.yMin)) * pH;

  const lineCoords = useMemo(() => {
    if (!activeModel || activeModel.slope === null || activeModel.intercept === null) return null;
    const x1 = scatterBounds.xMin;
    const x2 = scatterBounds.xMax;
    const y1 = Math.max(
      scatterBounds.yMin,
      Math.min(scatterBounds.yMax, activeModel.slope * x1 + activeModel.intercept)
    );
    const y2 = Math.max(
      scatterBounds.yMin,
      Math.min(scatterBounds.yMax, activeModel.slope * x2 + activeModel.intercept)
    );
    return { x1: scalePlotX(x1), y1: scalePlotY(y1), x2: scalePlotX(x2), y2: scalePlotY(y2) };
  }, [activeModel, scatterBounds]);

  return (
    <div className="space-y-5">
      {/* Header & Outcome Switcher */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5 max-w-2xl">
          <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] border border-[#BFD5C9] flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4 text-[#047857]" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold text-[#14201B]">
              Method 4: Ordinary Least Squares (OLS) Linear Regression Modeling
            </h3>
            <p className="text-xs text-[#4B6157] mt-0.5">{activeSuite.clinicalQuestion}</p>
          </div>
        </div>

        <div
          className="inline-flex flex-wrap items-center p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg gap-1"
          role="tablist"
          aria-label="Select regression target outcome"
        >
          {suites.map((s) => (
            <button
              key={s.outcomeKey}
              type="button"
              role="tab"
              aria-selected={outcomeKey === s.outcomeKey}
              onClick={() => {
                setOutcomeKey(s.outcomeKey);
                setSelectedPredictorKey(null);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                outcomeKey === s.outcomeKey
                  ? 'bg-[#047857] text-white'
                  : 'text-[#4B6157] hover:text-[#14201B]'
              }`}
            >
              {s.outcomeLabel}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Model Fit & Explained Variance Bar */}
      {activeModel && (
        <div className="bg-[#FAFDFB] border border-[#DDE8E2] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="text-[11px] font-mono font-semibold text-[#047857]">
              {activeModel.predictorLabel} → {activeSuite.outcomeLabel}
            </div>
            <div className="text-xs font-medium text-[#14201B]">
              {describeRegressionPlain(
                activeSuite.outcomeLabel,
                activeModel.predictorLabel,
                activeModel.slope,
                activeModel.rSquared,
                activeModel.pValue
              )}
            </div>
          </div>
          {activeModel.rSquared !== null && (
            <div className="w-44 shrink-0 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums">
                <span className="text-[#4B6157]">Variance (R²)</span>
                <span className="font-bold text-[#047857]">
                  {Math.round(activeModel.rSquared * 100)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6EEEA] overflow-hidden">
                <div
                  key={`rsq-${outcomeKey}-${activeModel.predictorKey}-${animationKey}`}
                  className="h-full rounded-full bg-[#047857] chart-bar-horiz"
                  style={{
                    width: `${Math.min(100, Math.max(4, Math.round(activeModel.rSquared * 100)))}%`,
                    transformOrigin: 'left center',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Graphical Twin: Forest Plot (Standardized Beta 95% CI) + OLS Fitted Trend & Residuals */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Left: Forest Plot of Predictor Effect Sizes */}
        <div className="xl:col-span-6 bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
          <div className="pb-3 border-b border-[#EEF3F0]">
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              Predictor Effect Forest Plot (Standardized β ± 95% CI)
            </h4>
            <p className="text-xs text-[#4B6157] mt-0.5">
              Outcome: {activeSuite.outcomeLabel} · Click any predictor row to inspect its fitted regression line
            </p>
          </div>

          <div className="pt-3">
            <svg
              key={`forest-${outcomeKey}-${animationKey}`}
              viewBox={`0 0 460 ${Math.max(180, validForestModels.length * 28 + 34)}`}
              className="w-full overflow-visible"
              role="img"
              aria-label={`Regression effect forest plot predicting ${activeSuite.outcomeLabel}`}
            >
              {/* Null effect vertical line (beta = 0) */}
              <line
                x1={zeroX}
                y1={8}
                x2={zeroX}
                y2={validForestModels.length * 28 + 8}
                stroke="#94A89E"
                strokeDasharray="3 3"
                strokeWidth={1.2}
              />

              {validForestModels.map((m, idx) => {
                const y = 20 + idx * 28;
                const isSelected = activeModel?.predictorKey === m.predictorKey;
                const isSig = m.pValue !== null && m.pValue < 0.05;
                const color = isSig ? '#047857' : '#64748B';
                const xLo = scaleBetaX(m.stdBetaCiLower ?? 0);
                const xHi = scaleBetaX(m.stdBetaCiUpper ?? 0);
                const xPt = scaleBetaX(m.standardizedBeta ?? 0);

                return (
                  <g
                    key={m.predictorKey}
                    className="cursor-pointer"
                    onClick={() => setSelectedPredictorKey(m.predictorKey)}
                  >
                    <rect
                      x={2}
                      y={y - 12}
                      width={454}
                      height={24}
                      rx={5}
                      fill={isSelected ? '#ECFDF5' : 'transparent'}
                    />
                    <text
                      x={8}
                      y={y + 3.5}
                      className={`text-[11px] ${
                        isSelected
                          ? 'fill-[#047857] font-bold'
                          : 'fill-[#14201B] font-medium'
                      }`}
                    >
                      {m.predictorLabel}
                    </text>

                    {/* 95% CI Line */}
                    <line
                      x1={xLo}
                      y1={y}
                      x2={xHi}
                      y2={y}
                      stroke={color}
                      strokeWidth={isSelected ? 2.4 : 1.7}
                      className="chart-bar-horiz"
                      style={{
                        transformOrigin: `${xPt}px ${y}px`,
                        animationDelay: `${idx * 45}ms`,
                      }}
                    />
                    {/* Whisker caps */}
                    <line x1={xLo} y1={y - 3.5} x2={xLo} y2={y + 3.5} stroke={color} strokeWidth={1.3} />
                    <line x1={xHi} y1={y - 3.5} x2={xHi} y2={y + 3.5} stroke={color} strokeWidth={1.3} />

                    {/* Point estimate circle */}
                    <circle
                      cx={xPt}
                      cy={y}
                      r={isSelected ? 5.5 : 4.2}
                      fill={color}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                      className="chart-scale-in"
                      style={{
                        transformOrigin: `${xPt}px ${y}px`,
                        animationDelay: `${120 + idx * 45}ms`,
                      }}
                    />

                    <text
                      x={452}
                      y={y + 3.5}
                      textAnchor="end"
                      className="font-mono text-[10px] fill-[#4B6157] tabular-nums"
                    >
                      β={m.standardizedBeta?.toFixed(2)} (R²={m.rSquared?.toFixed(2)})
                    </text>
                  </g>
                );
              })}

              {/* Bottom Axis Ticks */}
              {[-maxAbsBeta, 0, maxAbsBeta].map((tick, i) => (
                <text
                  key={i}
                  x={scaleBetaX(tick)}
                  y={validForestModels.length * 28 + 24}
                  textAnchor="middle"
                  className="font-mono text-[10px] fill-[#6B8076]"
                >
                  {tick === 0 ? '0.0 (Null)' : tick.toFixed(1)}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Fitted Regression Curve + Residual Band */}
        <div className="xl:col-span-6 bg-white border border-[#DDE8E2] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#EEF3F0]">
            <div>
              <h4 className="font-display text-sm font-bold text-[#14201B]">
                OLS Regression Fit: {activeModel?.predictorLabel} → {activeSuite.outcomeLabel}
              </h4>
              <p className="text-xs font-mono text-[#047857] font-semibold tabular-nums mt-0.5">
                {activeModel && activeModel.slope !== null && activeModel.intercept !== null
                  ? `ŷ = ${activeModel.slope.toFixed(3)}·x ${
                      activeModel.intercept >= 0 ? '+' : '−'
                    } ${Math.abs(activeModel.intercept).toFixed(3)} · R² = ${activeModel.rSquared} · F = ${activeModel.fStat} · p = ${formatP(activeModel.pValue)}`
                  : 'Insufficient paired observations (need n ≥ 4)'}
              </p>
            </div>
          </div>

          <div className="pt-3">
            {activeModel && activeModel.points.length >= 4 ? (
              <svg
                key={`fit-${outcomeKey}-${activeModel.predictorKey}-${animationKey}`}
                viewBox="0 0 460 226"
                className="w-full h-56 overflow-visible"
                role="img"
                aria-label={`OLS regression scatter fit of ${activeModel.predictorLabel} predicting ${activeSuite.outcomeLabel}`}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
                  const val =
                    scatterBounds.yMin + f * (scatterBounds.yMax - scatterBounds.yMin);
                  const yPos = pBottom - f * pH;
                  return (
                    <g key={i}>
                      <line
                        x1={pLeft}
                        y1={yPos}
                        x2={pRight}
                        y2={yPos}
                        stroke={i === 0 ? '#CBD8D1' : '#EEF3F0'}
                        strokeDasharray={i === 0 ? undefined : '3 3'}
                      />
                      <text
                        x={pLeft - 6}
                        y={yPos + 3}
                        textAnchor="end"
                        className="font-mono text-[10px] fill-[#6B8076]"
                      >
                        {val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {[0, 0.5, 1].map((f, i) => {
                  const val =
                    scatterBounds.xMin + f * (scatterBounds.xMax - scatterBounds.xMin);
                  const xPos = pLeft + f * pW;
                  return (
                    <text
                      key={i}
                      x={xPos}
                      y={pBottom + 15}
                      textAnchor="middle"
                      className="font-mono text-[10px] fill-[#6B8076]"
                    >
                      {val.toFixed(1)}
                    </text>
                  );
                })}

                <text
                  x={(pLeft + pRight) / 2}
                  y={218}
                  textAnchor="middle"
                  className="font-mono text-[10px] font-semibold fill-[#4B6157]"
                >
                  {activeModel.predictorLabel} ({activeModel.predictorUnit})
                </text>
                <text
                  x={14}
                  y={(pTop + pBottom) / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 14 ${(pTop + pBottom) / 2})`}
                  className="font-mono text-[10px] font-semibold fill-[#4B6157]"
                >
                  {activeSuite.outcomeLabel}
                </text>

                {/* Residual vertical drop stems */}
                {activeModel.points.map((pt, idx) => {
                  const cx = scalePlotX(pt.x);
                  const cy = scalePlotY(pt.y);
                  const fy = scalePlotY(
                    Math.max(scatterBounds.yMin, Math.min(scatterBounds.yMax, pt.fittedY))
                  );
                  const dimmed = activeCluster !== null && activeCluster !== pt.cluster;
                  const ptColor =
                    pt.cluster === 'Unassigned' ? '#94A89E' : CLUSTER_META[pt.cluster].color;
                  return (
                    <line
                      key={`res-${pt.patientName || pt.participantId || 'pt'}-${idx}`}
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={fy}
                      stroke={ptColor}
                      strokeOpacity={dimmed ? 0.1 : 0.32}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                  );
                })}

                {/* OLS Regression Line */}
                {lineCoords && (
                  <line
                    x1={lineCoords.x1}
                    y1={lineCoords.y1}
                    x2={lineCoords.x2}
                    y2={lineCoords.y2}
                    stroke="#14201B"
                    strokeWidth={2}
                    className="chart-line-draw"
                  />
                )}

                {/* Observation Dots */}
                {activeModel.points.map((pt, idx) => {
                  const cx = scalePlotX(pt.x);
                  const cy = scalePlotY(pt.y);
                  const dimmed = activeCluster !== null && activeCluster !== pt.cluster;
                  const ptColor =
                    pt.cluster === 'Unassigned' ? '#94A89E' : CLUSTER_META[pt.cluster].color;
                  return (
                    <circle
                      key={`dot-${pt.patientName || pt.participantId || 'pt'}-${idx}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={ptColor}
                      stroke="#FFFFFF"
                      strokeWidth={1.6}
                      opacity={dimmed ? 0.25 : 0.95}
                      className="chart-scale-in"
                      style={{
                        transformOrigin: `${cx}px ${cy}px`,
                        animationDelay: `${Math.min(idx * 35, 320)}ms`,
                      }}
                    >
                      <title>{`${pt.patientName || 'Unnamed'} (${pt.cluster}): ${activeModel.predictorLabel}=${pt.x}, Obs=${pt.y}, Pred=${pt.fittedY}, Resid=${pt.residual}`}</title>
                    </circle>
                  );
                })}
              </svg>
            ) : (
              <div className="h-56 flex items-center justify-center text-xs text-[#6B8076]">
                Insufficient paired data to fit OLS curve.
              </div>
            )}

            <div className="mt-2 pt-2 border-t border-[#EEF3F0] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#6B8076]">
              <span>Vertical dashed stems represent OLS residuals (y − ŷ)</span>
              <span>n = {activeModel?.n ?? 0} paired</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full OLS Linear Regression Model Table */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#DDE8E2]">
          <h4 className="font-display text-sm font-bold text-[#14201B]">
            OLS Linear Regression Parameter Estimates — Outcome: {activeSuite.outcomeLabel}
          </h4>
          <p className="text-xs text-[#4B6157]">
            Ranked by explained variance (R²). Click any row to load its fitted regression curve above.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                <th className="py-2.5 px-4">Predictor Variable</th>
                <th className="py-2.5 px-3 text-right">n</th>
                <th className="py-2.5 px-3 text-right">Slope β (95% CI)</th>
                <th className="py-2.5 px-3 text-right">Std. β</th>
                <th className="py-2.5 px-3 text-right">SE(β)</th>
                <th className="py-2.5 px-3 text-right">R²</th>
                <th className="py-2.5 px-3 text-right">Adj. R²</th>
                <th className="py-2.5 px-3 text-right">F-stat</th>
                <th className="py-2.5 px-3 text-right">t-stat</th>
                <th className="py-2.5 px-3 text-right">p-value</th>
                <th className="py-2.5 px-4">Plain Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EEF3F0]">
              {activeSuite.models.map((m) => {
                const isSelected = activeModel?.predictorKey === m.predictorKey;
                const isSig = m.pValue !== null && m.pValue < 0.05;
                const rSq = m.rSquared ?? 0;
                const verdict =
                  m.slope === null
                    ? 'Insufficient data'
                    : isSig && rSq >= 0.5
                    ? 'Strong Predictor ✓'
                    : isSig
                    ? 'Confirmed Link ✓'
                    : rSq >= 0.3
                    ? 'Moderate Trend'
                    : 'Weak Link';
                return (
                  <tr
                    key={m.predictorKey}
                    onClick={() => setSelectedPredictorKey(m.predictorKey)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#ECFDF5]' : 'hover:bg-[#FAFDFB]'
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-[#14201B]">
                      {m.predictorLabel}{' '}
                      <span className="font-mono text-[10px] font-normal text-[#6B8076]">
                        ({m.predictorUnit})
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                      {m.n}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B] whitespace-nowrap">
                      {m.slope !== null
                        ? `${m.slope} [${m.ciLower}, ${m.ciUpper}]`
                        : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#14201B]">
                      {m.standardizedBeta ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                      {m.seSlope ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-[#14201B]">
                      {m.rSquared ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                      {m.adjRSquared ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                      {m.fStat ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">
                      {m.tStat ?? '—'}
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                        isSig ? 'font-bold text-[#047857]' : 'text-[#4B6157]'
                      }`}
                    >
                      {formatP(m.pValue)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          isSig
                            ? 'bg-[#ECFDF5] text-[#047857] border border-[#BFD5C9]'
                            : 'bg-[#F6F9F7] text-[#4B6157] border border-[#DDE8E2]'
                        }`}
                      >
                        {verdict}
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
  );
};
