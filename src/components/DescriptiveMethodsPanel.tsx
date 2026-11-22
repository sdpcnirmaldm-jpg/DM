import React, { useMemo, useState } from 'react';
import { BarChart3, Layers, ListChecks, Hash, SlidersHorizontal } from 'lucide-react';
import type { PatientCRF } from '../types/clinical';
import {
  computeDescriptiveProfile,
  type CategoricalDescriptiveRow,
  type ContinuousDescriptiveRow,
  type ProtocolDataType,
} from '../utils/biostatisticsExtended';

interface DescriptiveMethodsPanelProps {
  patients: PatientCRF[];
  animationKey: number;
}

type DataTypeFilter = 'All' | ProtocolDataType;

const NumericDistributionRow: React.FC<{
  row: ContinuousDescriptiveRow;
  animationKey: number;
  index: number;
}> = ({ row, animationKey, index }) => {
  const span = Math.max(0.0001, row.max - row.min);
  const toPct = (v: number) => Math.max(0, Math.min(100, ((v - row.min) / span) * 100));
  const q1Pct = toPct(row.q1);
  const q3Pct = toPct(row.q3);
  const medPct = toPct(row.median);
  const meanPct = toPct(row.mean);

  return (
    <tr className="hover:bg-[#FAFDFB]">
      <td className="py-2.5 px-4">
        <div className="font-semibold text-[#14201B]">{row.variable}</div>
        <div className="text-[10px] font-mono text-[#6B8076]">{row.unit}</div>
      </td>
      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#4B6157]">{row.n}</td>
      <td className="py-2.5 px-3 font-mono tabular-nums text-[#14201B] whitespace-nowrap">
        {row.n > 0 ? `${row.mean} ± ${row.sd}` : '—'}
      </td>
      <td className="py-2.5 px-3 font-mono tabular-nums text-[#047857] whitespace-nowrap">
        {row.n > 1 ? `[${row.ciLower}, ${row.ciUpper}]` : '—'}
      </td>
      <td className="py-2.5 px-3 font-mono tabular-nums text-[#4B6157] whitespace-nowrap">
        {row.n > 0 ? `${row.median} [${row.iqr}]` : '—'}
      </td>
      <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B8076] whitespace-nowrap">
        {row.n > 0 ? `${row.min} – ${row.max}` : '—'}
      </td>
      <td className="py-2.5 px-4 min-w-[160px]">
        {row.n > 0 ? (
          <svg
            key={`${row.variable}-${animationKey}`}
            viewBox="0 0 140 22"
            className="w-full h-5 overflow-visible"
            aria-label={`Box and mean whisker plot for ${row.variable}`}
          >
            {/* Min–Max whisker */}
            <line x1={6} y1={11} x2={134} y2={11} stroke="#CBD8D1" strokeWidth={1.5} />
            <line x1={6} y1={7} x2={6} y2={15} stroke="#94A89E" strokeWidth={1.2} />
            <line x1={134} y1={7} x2={134} y2={15} stroke="#94A89E" strokeWidth={1.2} />
            {/* IQR Box */}
            <rect
              x={6 + (q1Pct / 100) * 128}
              y={5}
              width={Math.max(4, ((q3Pct - q1Pct) / 100) * 128)}
              height={12}
              rx={2.5}
              fill="#D1FAE5"
              stroke="#047857"
              strokeWidth={1.2}
              className="chart-bar-horiz"
              style={{
                transformOrigin: `${6 + (q1Pct / 100) * 128}px 11px`,
                animationDelay: `${Math.min(index * 30, 300)}ms`,
              }}
            />
            {/* Median line */}
            <line
              x1={6 + (medPct / 100) * 128}
              y1={4}
              x2={6 + (medPct / 100) * 128}
              y2={18}
              stroke="#065F46"
              strokeWidth={2}
              className="chart-fade-up"
              style={{ animationDelay: `${Math.min(index * 30 + 120, 420)}ms` }}
            />
            {/* Mean diamond */}
            <circle
              cx={6 + (meanPct / 100) * 128}
              cy={11}
              r={2.8}
              fill="#D97706"
              stroke="#FFFFFF"
              strokeWidth={1}
              className="chart-scale-in"
              style={{
                transformOrigin: `${6 + (meanPct / 100) * 128}px 11px`,
                animationDelay: `${Math.min(index * 30 + 160, 460)}ms`,
              }}
            />
          </svg>
        ) : (
          <span className="text-[11px] font-mono text-[#6B8076]">No data</span>
        )}
      </td>
    </tr>
  );
};

const CategoricalStackedCard: React.FC<{
  row: CategoricalDescriptiveRow;
  animationKey: number;
  index: number;
}> = ({ row, animationKey, index }) => {
  return (
    <div className="p-4 rounded-xl border border-[#DDE8E2] bg-[#FAFDFB] space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white border border-[#DDE8E2] text-[#047857]">
              {row.dataType}
            </span>
            <span className="text-[11px] font-mono text-[#6B8076] tabular-nums">n = {row.n}</span>
          </div>
          <h4 className="font-display text-xs font-bold text-[#14201B] mt-1.5">{row.variable}</h4>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] text-[#6B8076]">Modal tier</div>
          <div className="text-[11px] font-mono font-semibold text-[#14201B]">{row.modalLevel}</div>
        </div>
      </div>

      {/* 100% Stacked Horizontal Distribution Bar */}
      <div className="h-3 w-full rounded-full bg-[#EEF3F0] overflow-hidden flex">
        {row.levels.map((lvl, lIdx) => {
          if (lvl.pct <= 0) return null;
          return (
            <div
              key={`${row.variable}-${lvl.label}-${animationKey}`}
              className="h-full chart-bar-horiz first:rounded-l-full last:rounded-r-full"
              style={{
                width: `${lvl.pct}%`,
                backgroundColor: lvl.color,
                transformOrigin: 'left center',
                animationDelay: `${index * 40 + lIdx * 35}ms`,
              }}
              title={`${lvl.label}: ${lvl.count} (${lvl.pct}%)`}
            />
          );
        })}
      </div>

      {/* Category Frequency Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
        {row.levels.map((lvl) => (
          <div
            key={lvl.label}
            className="flex items-center justify-between gap-2 text-[11px] px-2 py-1 rounded bg-white border border-[#EEF3F0]"
          >
            <span className="inline-flex items-center gap-1.5 text-[#14201B] truncate">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: lvl.color }}
              />
              <span className="truncate">{lvl.label}</span>
            </span>
            <span className="font-mono font-semibold text-[#4B6157] tabular-nums shrink-0">
              {lvl.count} ({lvl.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const DescriptiveMethodsPanel: React.FC<DescriptiveMethodsPanelProps> = ({
  patients,
  animationKey,
}) => {
  const [dataTypeFilter, setDataTypeFilter] = useState<DataTypeFilter>('All');
  const profile = useMemo(() => computeDescriptiveProfile(patients), [patients]);

  const showContinuous = dataTypeFilter === 'All' || dataTypeFilter === 'Continuous';
  const showDiscrete = dataTypeFilter === 'All' || dataTypeFilter === 'Discrete';
  const showOrdinal = dataTypeFilter === 'All' || dataTypeFilter === 'Ordinal';
  const showNominal = dataTypeFilter === 'All' || dataTypeFilter === 'Nominal';

  const taxonomyCards: Array<{
    type: ProtocolDataType;
    icon: React.ReactNode;
    count: number;
    summary: string;
    metricSpec: string;
  }> = [
    {
      type: 'Continuous',
      icon: <SlidersHorizontal className="w-4 h-4 text-[#047857]" />,
      count: profile.continuousVariables.length,
      summary: 'Biomarkers, anthropometry, FibroScan kPa/CAP & DHS/DDS scores',
      metricSpec: 'Mean ± SD · 95% CI · Median [IQR]',
    },
    {
      type: 'Discrete',
      icon: <Hash className="w-4 h-4 text-[#D97706]" />,
      count: profile.discreteVariables.length,
      summary: 'Integer drug counts, Known Severity scores & diabetes duration',
      metricSpec: 'Count Mean ± SD · Median [IQR] · Min–Max',
    },
    {
      type: 'Ordinal',
      icon: <Layers className="w-4 h-4 text-[#7C3AED]" />,
      count: profile.ordinalVariables.length,
      summary: 'Fibrosis F0–F4, Steatosis S0–S3, HbA1c tiers, DHS & DDS grades',
      metricSpec: 'Ordered n (%) Stacked Distribution',
    },
    {
      type: 'Nominal',
      icon: <ListChecks className="w-4 h-4 text-[#BE185D]" />,
      count: profile.nominalVariables.length,
      summary: 'Phenotypic clusters, sex, dyslipidaemia & cardiorenal therapy',
      metricSpec: 'Category n (%) · Modal Class',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header + Protocol Section 2 Data Type Taxonomy Strip */}
      <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#EEF3F0]">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#ECFDF5] border border-[#BFD5C9] flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-[#047857]" />
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-[#14201B]">
                Descriptive Statistics Across All 4 Protocol Data Types
              </h3>
              <p className="text-xs font-mono text-[#6B8076] mt-0.5 tabular-nums">
                n = {profile.cohortSize} · Nominal, Ordinal, Discrete &amp; Continuous
              </p>
            </div>
          </div>

          <div
            className="inline-flex flex-wrap items-center p-1 bg-[#F6F9F7] border border-[#DDE8E2] rounded-lg gap-1"
            role="tablist"
            aria-label="Filter descriptive statistics by protocol data type"
          >
            {(['All', 'Continuous', 'Discrete', 'Ordinal', 'Nominal'] as DataTypeFilter[]).map(
              (dt) => (
                <button
                  key={dt}
                  type="button"
                  role="tab"
                  aria-selected={dataTypeFilter === dt}
                  onClick={() => setDataTypeFilter(dt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    dataTypeFilter === dt
                      ? 'bg-[#047857] text-white'
                      : 'text-[#4B6157] hover:text-[#14201B]'
                  }`}
                >
                  {dt === 'All' ? 'All 4 Types' : dt}
                </button>
              )
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {taxonomyCards.map((card, idx) => {
            const active = dataTypeFilter === card.type;
            return (
              <button
                key={`${card.type}-${animationKey}`}
                type="button"
                onClick={() => setDataTypeFilter(active ? 'All' : card.type)}
                className={`analysis-stagger-${idx + 1} card-elevate text-left p-3.5 rounded-xl border transition-all ${
                  active
                    ? 'bg-[#ECFDF5] border-[#047857]'
                    : 'bg-[#FAFDFB] border-[#DDE8E2] hover:border-[#BFD5C9]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-display text-xs font-bold text-[#14201B]">
                    {card.icon}
                    <span>{card.type} Data</span>
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-[#047857]">
                    {card.count} vars
                  </span>
                </div>
                <p className="text-[11px] text-[#4B6157] mt-1.5 leading-snug">{card.summary}</p>
                <div className="text-[10px] font-mono text-[#6B8076] mt-2">{card.metricSpec}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Continuous & Discrete Box-and-Whisker Distribution Tables */}
      {(showContinuous || showDiscrete) && (
        <div className="bg-white border border-[#DDE8E2] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#DDE8E2] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-sm font-bold text-[#14201B]">
                {showContinuous && showDiscrete
                  ? 'Continuous & Discrete Variables — Parametric & Non-Parametric Summaries'
                  : showContinuous
                  ? 'Continuous Variables — Parametric & Non-Parametric Summaries'
                  : 'Discrete Count Variables — Parametric & Non-Parametric Summaries'}
              </h4>
              <p className="text-xs text-[#4B6157] mt-0.5">
                Inline whisker shows Min–Max range, shaded emerald IQR [Q1–Q3], vertical Median line,
                and amber Mean dot.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-[#6B8076]">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-2 rounded-sm bg-[#D1FAE5] border border-[#047857] inline-block" />
                IQR
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-0.5 h-3 bg-[#065F46] inline-block" />
                Median
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#D97706] inline-block" />
                Mean
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#F6F9F7] border-b border-[#DDE8E2] text-[10px] font-semibold uppercase tracking-wider text-[#4B6157]">
                  <th className="py-2.5 px-4">Parameter</th>
                  <th className="py-2.5 px-3 text-right">n</th>
                  <th className="py-2.5 px-3">Mean ± SD</th>
                  <th className="py-2.5 px-3">95% CI (Mean)</th>
                  <th className="py-2.5 px-3">Median [IQR]</th>
                  <th className="py-2.5 px-3">Min – Max</th>
                  <th className="py-2.5 px-4">Distribution Strip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF3F0]">
                {showContinuous && (
                  <>
                    <tr className="bg-[#FAFDFB]">
                      <td
                        colSpan={7}
                        className="py-1.5 px-4 text-[10px] font-mono font-bold uppercase tracking-wider text-[#047857]"
                      >
                        Continuous Biomarkers &amp; Clinical Scales ({profile.continuousVariables.length})
                      </td>
                    </tr>
                    {profile.continuousVariables.map((row, idx) => (
                      <NumericDistributionRow
                        key={row.variable}
                        row={row}
                        animationKey={animationKey}
                        index={idx}
                      />
                    ))}
                  </>
                )}

                {showDiscrete && (
                  <>
                    <tr className="bg-[#FAFDFB]">
                      <td
                        colSpan={7}
                        className="py-1.5 px-4 text-[10px] font-mono font-bold uppercase tracking-wider text-[#D97706]"
                      >
                        Discrete Counts &amp; Integer Scores ({profile.discreteVariables.length})
                      </td>
                    </tr>
                    {profile.discreteVariables.map((row, idx) => (
                      <NumericDistributionRow
                        key={row.variable}
                        row={row}
                        animationKey={animationKey}
                        index={idx}
                      />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ordinal & Nominal Stacked Distribution Visual Grid */}
      {(showOrdinal || showNominal) && (
        <div className="bg-white border border-[#DDE8E2] rounded-xl p-5 space-y-4">
          <div className="pb-3 border-b border-[#EEF3F0]">
            <h4 className="font-display text-sm font-bold text-[#14201B]">
              {showOrdinal && showNominal
                ? 'Ordinal Grades & Nominal Categories — Proportional Cohort Distribution'
                : showOrdinal
                ? 'Ordinal Severity & Clinical Grade Distribution'
                : 'Nominal Categorical Variables Distribution'}
            </h4>
            <p className="text-xs text-[#4B6157] mt-0.5">
              100% stacked proportional bars with absolute counts n (%) and modal classification
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {showOrdinal &&
              profile.ordinalVariables.map((row, idx) => (
                <CategoricalStackedCard
                  key={row.variable}
                  row={row}
                  animationKey={animationKey}
                  index={idx}
                />
              ))}
            {showNominal &&
              profile.nominalVariables.map((row, idx) => (
                <CategoricalStackedCard
                  key={row.variable}
                  row={row}
                  animationKey={animationKey}
                  index={idx}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
