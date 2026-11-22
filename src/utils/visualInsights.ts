import type { PatientCRF } from '../types/clinical';
import type { RegressionOutcomeSuite } from './biostatisticsExtended';
import type { DrugUtilizationReport } from './drugUtilization';
import type { ContinuousTestResult } from './statistics';
import { CLUSTER_META, resolveOptionalPatientCluster, type ClusterCode } from './statisticalCharts';

export interface ClusterStoryCard {
  code: ClusterCode;
  fullName: string;
  plainTagline: string;
  clinicalBadge: string;
  color: string;
  tint: string;
  count: number;
  pct: number;
  meanAge: number | null;
  meanHba1c: number | null;
  meanBmi: number | null;
  meanDhs: number | null;
  hba1cGaugePct: number;
  bmiGaugePct: number;
  dhsGaugePct: number;
}

export interface PlainKeyTakeaway {
  id: 'glycemic' | 'predictor' | 'risk' | 'treatment';
  kicker: string;
  headline: string;
  metricValue: string;
  explanation: string;
  accentColor: string;
}

export interface VisualStudyInsights {
  clusterCards: ClusterStoryCard[];
  takeaways: PlainKeyTakeaway[];
  headlineSummary: string;
}

const CLUSTER_PLAIN_META: Record<
  ClusterCode,
  { plainTagline: string; clinicalBadge: string }
> = {
  SIDD: {
    plainTagline: 'Low insulin output · Highest blood sugar',
    clinicalBadge: 'Intensive Sugar Control',
  },
  SIRD: {
    plainTagline: 'High insulin resistance · Weight & liver risk',
    clinicalBadge: 'Liver & Metabolic Watch',
  },
  CIRDD: {
    plainTagline: 'Both low insulin & high resistance combined',
    clinicalBadge: 'Dual Therapy Focus',
  },
  MARD: {
    plainTagline: 'Older onset · Mildest blood sugar elevation',
    clinicalBadge: 'Best Controlled Profile',
  },
};

export function describePValuePlain(p: number | null): {
  label: string;
  isSignificant: boolean;
  tone: 'emerald' | 'amber' | 'slate';
} {
  if (p === null) return { label: 'Insufficient data', isSignificant: false, tone: 'slate' };
  if (p < 0.05) return { label: 'Clear Difference', isSignificant: true, tone: 'emerald' };
  if (p < 0.1) return { label: 'Possible Trend', isSignificant: false, tone: 'amber' };
  return { label: 'Similar Across Groups', isSignificant: false, tone: 'slate' };
}

export function describeCorrelationPlain(
  r: number | null,
  p: number | null
): {
  strengthLabel: string;
  directionLabel: string;
  isSignificant: boolean;
} {
  if (r === null) {
    return { strengthLabel: 'No data', directionLabel: '—', isSignificant: false };
  }
  const abs = Math.abs(r);
  const strengthLabel =
    abs >= 0.7 ? 'Strong Link' : abs >= 0.4 ? 'Moderate Link' : 'Weak Link';
  const directionLabel =
    abs < 0.15
      ? 'No Clear Trend'
      : r > 0
      ? 'Move Together ↑↑'
      : 'Opposite Direction ↑↓';
  return {
    strengthLabel,
    directionLabel,
    isSignificant: p !== null && p < 0.05,
  };
}

export function describeRegressionPlain(
  outcomeLabel: string,
  predictorLabel: string,
  slope: number | null,
  rSquared: number | null,
  pValue: number | null
): string {
  if (slope === null || rSquared === null) {
    return `Need at least 4 paired patient records to model how ${predictorLabel} affects ${outcomeLabel}.`;
  }
  const pctExplained = Math.round(rSquared * 100);
  const direction = slope >= 0 ? 'higher' : 'lower';
  const strength =
    rSquared >= 0.6
      ? 'strongly predicts'
      : rSquared >= 0.3
      ? 'moderately tracks with'
      : 'shows a mild link to';
  const sigText =
    pValue !== null && pValue < 0.05 ? ' (statistically confirmed)' : ' (exploratory trend)';
  return `Higher ${predictorLabel} ${strength} ${direction} ${outcomeLabel} — explains ${pctExplained}% of patient differences${sigText}.`;
}

export function buildVisualStudyInsights(
  patients: PatientCRF[],
  continuousTests: ContinuousTestResult[],
  due: DrugUtilizationReport,
  regressions: RegressionOutcomeSuite[]
): VisualStudyInsights {
  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];
  const total = patients.length;

  const avg = (nums: Array<number | null>): number | null => {
    const valid = nums.filter((v): v is number => v !== null && Number.isFinite(v));
    if (valid.length === 0) return null;
    return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
  };

  const clusterCards: ClusterStoryCard[] = clusters.map((code) => {
    const groupPts = patients.filter((p) => resolveOptionalPatientCluster(p) === code);
    const meanAge = avg(groupPts.map((p) => p.age));
    const meanHba1c = avg(groupPts.map((p) => p.hba1c1.value));
    const meanBmi = avg(groupPts.map((p) => p.bmi));
    const meanDhs = avg(groupPts.map((p) => p.dhsTotal));
    const count = groupPts.length;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;

    return {
      code,
      fullName: CLUSTER_META[code].fullName,
      plainTagline: CLUSTER_PLAIN_META[code].plainTagline,
      clinicalBadge: CLUSTER_PLAIN_META[code].clinicalBadge,
      color: CLUSTER_META[code].color,
      tint: CLUSTER_META[code].tint,
      count,
      pct,
      meanAge: meanAge !== null ? Math.round(meanAge) : null,
      meanHba1c,
      meanBmi: meanBmi !== null ? Number(meanBmi.toFixed(1)) : null,
      meanDhs: meanDhs !== null ? Number(meanDhs.toFixed(1)) : null,
      hba1cGaugePct: meanHba1c !== null ? Math.min(100, Math.max(10, (meanHba1c / 12) * 100)) : 0,
      bmiGaugePct: meanBmi !== null ? Math.min(100, Math.max(10, (meanBmi / 36) * 100)) : 0,
      dhsGaugePct: meanDhs !== null ? Math.min(100, Math.max(10, (meanDhs / 50) * 100)) : 0,
    };
  });

  // 1. Glycemic Hotspot takeaway
  const withHba1c = clusterCards.filter((c) => c.meanHba1c !== null);
  const highestSugar = [...withHba1c].sort((a, b) => (b.meanHba1c ?? 0) - (a.meanHba1c ?? 0))[0];
  const lowestSugar = [...withHba1c].sort((a, b) => (a.meanHba1c ?? 99) - (b.meanHba1c ?? 99))[0];
  const hba1cTest = continuousTests.find((t) => t.variable === 'HbA1c (%)');
  const hba1cSig = hba1cTest?.anovaP !== null && (hba1cTest?.anovaP ?? 1) < 0.05;

  const glycemicCard: PlainKeyTakeaway = {
    id: 'glycemic',
    kicker: 'Blood Sugar Gap',
    headline:
      highestSugar && lowestSugar && highestSugar.code !== lowestSugar.code
        ? `${highestSugar.code} highest vs ${lowestSugar.code} lowest`
        : 'Baseline HbA1c Profile',
    metricValue:
      highestSugar && lowestSugar
        ? `${highestSugar.meanHba1c}% → ${lowestSugar.meanHba1c}%`
        : '—',
    explanation:
      highestSugar && lowestSugar
        ? `${highestSugar.code} averages ${highestSugar.meanHba1c}% HbA1c while ${lowestSugar.code} averages ${lowestSugar.meanHba1c}%${
            hba1cSig ? ' (statistically significant group difference).' : '.'
          }`
        : 'Enter baseline HbA1c values to compare glycemic burden across groups.',
    accentColor: '#047857',
  };

  // 2. Strongest Predictor takeaway (from OLS Regression)
  const allModels = regressions.flatMap((suite) =>
    suite.models
      .filter((m) => m.rSquared !== null && m.pValue !== null)
      .map((m) => ({ suite, m }))
  );
  const bestModelEntry = [...allModels].sort(
    (a, b) => (b.m.rSquared ?? 0) - (a.m.rSquared ?? 0)
  )[0];

  const predictorCard: PlainKeyTakeaway = bestModelEntry
    ? {
        id: 'predictor',
        kicker: 'Strongest Driver Found',
        headline: `${bestModelEntry.m.predictorLabel} → ${bestModelEntry.suite.outcomeLabel}`,
        metricValue: `${Math.round((bestModelEntry.m.rSquared ?? 0) * 100)}% fit`,
        explanation: describeRegressionPlain(
          bestModelEntry.suite.outcomeLabel,
          bestModelEntry.m.predictorLabel,
          bestModelEntry.m.slope,
          bestModelEntry.m.rSquared,
          bestModelEntry.m.pValue
        ),
        accentColor: '#7C3AED',
      }
    : {
        id: 'predictor',
        kicker: 'Strongest Driver Found',
        headline: 'Biomarker Predictor Modeling',
        metricValue: '—',
        explanation: 'Add at least 4 paired patient records to unlock regression predictions.',
        accentColor: '#7C3AED',
      };

  // 3. Complication & Liver Alert takeaway
  const microCount = patients.filter((p) => (p.ksMicrovascular ?? 0) >= 2).length;
  const fibroCount = patients.filter(
    (p) => p.fibrosisInterpretation && p.fibrosisInterpretation !== 'F0-F1'
  ).length;
  const microPct = total > 0 ? Math.round((microCount / total) * 100) : 0;

  const riskCard: PlainKeyTakeaway = {
    id: 'risk',
    kicker: 'Complication Watch',
    headline: `${microCount} of ${total} show microvascular signs`,
    metricValue: `${microPct}% micro`,
    explanation:
      fibroCount > 0
        ? `${fibroCount} ${fibroCount === 1 ? 'patient also shows' : 'patients also show'} F2–F4 liver stiffness on FibroScan requiring metabolic follow-up.`
        : 'Monitor UACR, retinopathy, and FibroScan CAP/LSM regularly in high-risk clusters.',
    accentColor: '#D97706',
  };

  // 4. Treatment Pattern takeaway
  const leadDrug = due.classMatrix[0];
  const treatmentCard: PlainKeyTakeaway = {
    id: 'treatment',
    kicker: 'Prescribing Pattern',
    headline: leadDrug ? `${leadDrug.drugClass} leads therapy` : 'Medication Utilization',
    metricValue: leadDrug ? `${leadDrug.totalPct}% use` : '—',
    explanation: `${due.indicators.dualTherapyRatePct}% on Dual therapy and ${due.indicators.triplePlusRatePct}% on Triple+ therapy (avg ${due.indicators.meanAntidiabeticsPerPatient} diabetes drugs/patient).`,
    accentColor: '#BE185D',
  };

  const assignedCards = clusterCards.filter((c) => c.count > 0);
  const leadCluster = [...assignedCards].sort((a, b) => b.count - a.count)[0];
  const headlineSummary =
    total > 0 && leadCluster
      ? `Across ${total} patients, ${leadCluster.code} (${leadCluster.pct}%) is the largest group. ${glycemicCard.explanation}`
      : total > 0
      ? `Across ${total} patients, phenotypic cluster assignments are pending clinical classification. ${glycemicCard.explanation}`
      : 'Add patient records to view live visual study insights.';

  return {
    clusterCards,
    takeaways: [glycemicCard, predictorCard, riskCard, treatmentCard],
    headlineSummary,
  };
}
