import React from 'react';
import { BookOpen, RotateCcw } from 'lucide-react';
import type { DHSDomains, PatientCRF } from '../../types/clinical';
import {
  BLUE_INDEX_REFERENCES,
  DHS_CATEGORY_SPECS,
  DHS_DOMAIN_SPECS,
  DHS_SCORE_ORDER,
  MICROVASCULAR_CASE_EXAMPLES,
  type ScoreValue,
} from '../../data/blueIndexCriteria';
import { toHba1cPercent, toLipidMgDl } from '../../utils/clinicalMath';

interface BlueIndexSectionProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
}

const PHYSICAL_ACTIVITY_BY_SCORE: Record<ScoreValue, PatientCRF['physicalActivity']> = {
  5: '>=150 min/week',
  4: '90-149 min/week',
  3: '30-89 min/week',
  2: 'Minimal',
  1: 'Sedentary',
  0: 'Unwilling/Bedridden',
};

function getLiveSourceSummary(crf: PatientCRF, key: keyof DHSDomains): string {
  switch (key) {
    case 'A': {
      const a1c =
        toHba1cPercent(crf.hba1c2.value, crf.hba1c2.unit) ??
        toHba1cPercent(crf.hba1c1.value, crf.hba1c1.unit);
      return a1c !== null
        ? `Lab HbA1c: ${a1c}% (Target ≤${crf.hba1cTarget || 7.0}%)`
        : 'Lab HbA1c pending';
    }
    case 'B':
      return crf.sbp !== null && crf.dbp !== null
        ? `BP: ${crf.sbp}/${crf.dbp} mmHg · ${crf.onAntiHtnMeds ? 'On Anti-HTN' : 'No Anti-HTN'}`
        : 'Vitals BP pending';
    case 'C': {
      const tc = toLipidMgDl(crf.totalCholesterol.value, crf.totalCholesterol.unit, 'chol');
      const ldl = toLipidMgDl(crf.ldl.value, crf.ldl.unit, 'chol');
      const tg = toLipidMgDl(crf.triglycerides.value, crf.triglycerides.unit, 'tg');
      if (tc === null && ldl === null && tg === null) return 'Lipid lab pending';
      return `TC ${tc ?? '—'} · LDL ${ldl ?? '—'} · Non-HDL ${crf.nonHdl ?? '—'} · TG ${tg ?? '—'} · ${crf.onStatin ? 'Statin' : 'No Statin'}`;
    }
    case 'D':
      return crf.dietAdherenceScore !== null ? `Diet score: ${crf.dietAdherenceScore}/5` : 'Pending';
    case 'E':
      return crf.physicalActivity ? `Activity: ${crf.physicalActivity}` : 'Pending';
    case 'F':
      return crf.followUpRegularityScore !== null
        ? `Compliance: ${crf.followUpRegularityScore}/5`
        : 'Pending';
    case 'G':
      return crf.comorbidityScore !== null ? `Comorbidity: ${crf.comorbidityScore}/5` : 'Pending';
    case 'H':
      return crf.smokingStatus || crf.tobaccoStatus || crf.alcoholIntake
        ? `Smoke: ${crf.smokingStatus || '—'} · Tobacco: ${crf.tobaccoStatus || '—'} · Alc: ${crf.alcoholIntake || '—'}`
        : 'Pending';
    case 'I':
      return crf.vaccinationScore !== null ? `Vaccination: ${crf.vaccinationScore}/5` : 'Pending';
    case 'J':
      return crf.hypoglycemiaSeverity ? `Hypo: ${crf.hypoglycemiaSeverity}` : 'Pending';
  }
}

export const BlueIndexSection: React.FC<BlueIndexSectionProps> = ({ crf, onChange }) => {
  const handleSelectDomainScore = (key: keyof DHSDomains, score: ScoreValue) => {
    onChange((prev) => {
      const nextOverrides = { ...(prev.dhsDomainOverrides ?? {}) };

      if (key === 'D') {
        delete nextOverrides.D;
        return { ...prev, dietAdherenceScore: score, dhsDomainOverrides: nextOverrides };
      }
      if (key === 'E') {
        delete nextOverrides.E;
        return {
          ...prev,
          physicalActivity: PHYSICAL_ACTIVITY_BY_SCORE[score],
          dhsDomainOverrides: nextOverrides,
        };
      }
      if (key === 'F') {
        delete nextOverrides.F;
        return { ...prev, followUpRegularityScore: score, dhsDomainOverrides: nextOverrides };
      }
      if (key === 'G') {
        delete nextOverrides.G;
        return { ...prev, comorbidityScore: score, dhsDomainOverrides: nextOverrides };
      }
      if (key === 'I') {
        delete nextOverrides.I;
        return { ...prev, vaccinationScore: score, dhsDomainOverrides: nextOverrides };
      }

      nextOverrides[key] = true;
      return {
        ...prev,
        dhsDomainOverrides: nextOverrides,
        dhsDomains: {
          ...prev.dhsDomains,
          [key]: score,
        },
      };
    });
  };

  const handleResetOverride = (key: keyof DHSDomains) => {
    onChange((prev) => {
      const nextOverrides = { ...(prev.dhsDomainOverrides ?? {}) };
      delete nextOverrides[key];
      return {
        ...prev,
        dhsDomainOverrides: nextOverrides,
      };
    });
  };

  return (
    <section
      id="section-blue-index"
      className="scroll-mt-20 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-5"
    >
      {/* Top Vector & Formula Banner */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[#EEF3F0]">
        <div>
          <h3 className="font-display text-base font-bold text-[#14201B]">
            Blue Index (BI) / Diabetes Health Status (DHS 0–50)
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Integrative Ratio: <span className="font-mono font-semibold text-[#14201B]">BI = DHS / KS</span> ·
            Clinical Vector: <span className="font-mono font-semibold text-[#14201B]">DHS (0–50) : KS (0–15)</span> (Higher DHS is optimal; Lower KS is optimal).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 font-mono tabular-nums text-sm">
          <div
            data-testid="dhs-total-badge"
            className="px-3.5 py-1.5 rounded-xl bg-[#F6F9F7] border border-[#DDE8E2] font-bold text-[#14201B]"
          >
            DHS: {crf.dhsTotal ?? '—'} / 50
          </div>
          <div
            data-testid="blue-index-badge"
            className="px-3.5 py-1.5 rounded-xl bg-[#053B2B] text-white font-bold"
          >
            BI: {crf.blueIndexRatio}
          </div>
        </div>
      </div>

      {/* 1. DHS Categorization & Targets */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-[#4B6157]">
          1. Diabetes Health Status (DHS) Categorization &amp; Targets
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {DHS_CATEGORY_SPECS.map((cat) => {
            const active = crf.dhsCategory === cat.id;
            const activeClasses =
              cat.tone === 'emerald'
                ? 'bg-[#ECFDF5] border-[#047857]'
                : cat.tone === 'amber'
                  ? 'bg-amber-50 border-amber-500'
                  : 'bg-rose-50 border-rose-500';
            const titleColor =
              cat.tone === 'emerald'
                ? 'text-[#065F46]'
                : cat.tone === 'amber'
                  ? 'text-amber-800'
                  : 'text-rose-800';

            return (
              <div
                key={cat.id}
                className={`p-3.5 rounded-xl border ${
                  active ? activeClasses : 'bg-[#FAFDFB] border-[#DDE8E2]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-xs font-bold ${titleColor}`}>{cat.title}</span>
                  <span className="font-mono text-sm font-bold text-[#14201B] tabular-nums">
                    {cat.thresholdLabel}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#4B6157] mt-1.5 leading-snug">
                  {cat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. DHS Standard 6-Point Metric Criteria (Domains A through J) */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#4B6157]">
            2. DHS Standard 6-Point Metric Criteria (Domains A through J · Score 5 to 0)
          </div>
          <div className="text-[11px] text-[#4B6157]">
            Auto-calculated from Labs, Vitals &amp; History · Click any cell to set/override
          </div>
        </div>

        <div className="space-y-3">
          {DHS_DOMAIN_SPECS.map((spec) => {
            const currentScore = crf.dhsDomains[spec.key];
            const isOverridden = Boolean(crf.dhsDomainOverrides?.[spec.key]);
            const sourceSummary = getLiveSourceSummary(crf, spec.key);

            return (
              <div
                key={spec.key}
                data-testid={`dhs-domain-${spec.key}`}
                className="border border-[#DDE8E2] rounded-xl overflow-hidden bg-white"
              >
                {/* Domain Header */}
                <div className="px-3.5 py-2.5 bg-[#F6F9F7] border-b border-[#EEF3F0] flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-xs font-bold text-[#053B2B]">
                        {spec.number}.
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#14201B]">
                        {spec.title}
                      </span>
                      <span className="text-[11px] text-[#4B6157]">· {spec.metricLabel}</span>
                    </div>
                    <div className="text-[11px] font-mono text-[#4B6157] mt-0.5">
                      {sourceSummary} ·{' '}
                      <span className={isOverridden ? 'text-amber-700 font-semibold' : 'text-[#047857]'}>
                        {isOverridden ? 'Manual Override' : spec.sourceBadge}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => handleResetOverride(spec.key)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#DDE8E2] bg-white text-[11px] font-semibold text-[#047857] hover:bg-[#ECFDF5]"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Auto</span>
                      </button>
                    )}
                    <div
                      data-testid={`dhs-domain-${spec.key}-score`}
                      className="font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-[#DDE8E2] text-[#053B2B]"
                    >
                      {currentScore !== null ? `${currentScore} / 5` : '— / 5'}
                    </div>
                  </div>
                </div>

                {/* 6 Criteria Score Buttons (5 down to 0) */}
                <div
                  role="radiogroup"
                  aria-label={`${spec.title} Score (5 to 0)`}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 p-2 bg-white"
                >
                  {DHS_SCORE_ORDER.map((scoreVal) => {
                    const selected = currentScore === scoreVal;
                    return (
                      <button
                        key={scoreVal}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${spec.title} Score ${scoreVal}: ${spec.criteria[scoreVal]}`}
                        onClick={() => handleSelectDomainScore(spec.key, scoreVal)}
                        className={`p-2 rounded-lg border text-left flex flex-col justify-between ${
                          selected
                            ? 'bg-[#047857] text-white border-[#047857]'
                            : 'bg-[#FAFDFB] border-[#DDE8E2] text-[#14201B] hover:bg-[#EFF5F1]'
                        }`}
                      >
                        <div
                          className={`font-mono text-[11px] font-bold tabular-nums ${
                            selected ? 'text-emerald-100' : 'text-[#053B2B]'
                          }`}
                        >
                          Score {scoreVal}
                        </div>
                        <div
                          className={`text-[11px] leading-snug mt-1 ${
                            selected ? 'text-white' : 'text-[#4B6157]'
                          }`}
                        >
                          {spec.criteria[scoreVal]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Protocol Examples & Peer-Reviewed Citations */}
      <details className="border border-[#DDE8E2] rounded-xl bg-[#FAFDFB] px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold text-[#053B2B] inline-flex items-center gap-2 select-none">
          <BookOpen className="w-4 h-4 text-[#047857]" />
          <span>Clinical Application Examples (Max-Severity Rule) &amp; JAPI / RSSDI References</span>
        </summary>
        <div className="mt-3 space-y-4 pt-3 border-t border-[#EEF3F0]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {MICROVASCULAR_CASE_EXAMPLES.map((ex) => (
              <div
                key={ex.title}
                className="p-3 rounded-xl border border-[#DDE8E2] bg-white space-y-1.5"
              >
                <div className="text-xs font-bold text-[#14201B]">{ex.title}</div>
                <ul className="text-[11px] text-[#4B6157] space-y-0.5 font-mono">
                  {ex.points.map((pt) => (
                    <li key={pt}>• {pt}</li>
                  ))}
                </ul>
                <div className="text-xs font-mono font-bold text-[#047857] pt-1">{ex.result}</div>
                <div className="text-[11px] text-[#4B6157]">{ex.rationale}</div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#4B6157]">
              Authentic Peer-Reviewed References
            </div>
            <ol className="list-decimal list-inside text-[11px] text-[#4B6157] space-y-1">
              {BLUE_INDEX_REFERENCES.map((ref) => (
                <li key={ref}>{ref}</li>
              ))}
            </ol>
          </div>
        </div>
      </details>
    </section>
  );
};
