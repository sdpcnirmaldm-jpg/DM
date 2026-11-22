import type { PatientCRF } from '../types/clinical';
import { resolveOptionalPatientCluster } from './statisticalCharts';

/** Natural logarithm of Gamma function via Lanczos approximation */
function logGamma(z: number): number {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) {
    x += p[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Regularized lower incomplete gamma P(a, x) for chi-square p-value */
function lowerIncompleteGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction for Q(a, x) = 1 - P(a, x)
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
  return 1 - q;
}

export function chiSquarePValue(chiSq: number, df: number): number {
  if (df <= 0 || chiSq <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - lowerIncompleteGammaP(df / 2, chiSq / 2)));
}

/** Regularized incomplete beta I_x(a, b) for F-distribution and t-distribution p-values */
function betacf(a: number, b: number, x: number): number {
  const maxit = 200;
  const eps = 3e-10;
  const fpmin = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxit; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function regularizedBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betacf(a, b, x)) / a;
  }
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

export function fDistributionPValue(fStat: number, df1: number, df2: number): number {
  if (fStat <= 0 || df1 <= 0 || df2 <= 0) return 1;
  const x = df2 / (df2 + df1 * fStat);
  return Math.max(0, Math.min(1, regularizedBeta(df2 / 2, df1 / 2, x)));
}

export function tDistributionPValue(tStat: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + tStat * tStat);
  return Math.max(0, Math.min(1, regularizedBeta(df / 2, 0.5, x)));
}

export interface GroupSummary {
  group: string;
  n: number;
  mean: number;
  sd: number;
  median: number;
  iqr: number;
}

export interface ContinuousTestResult {
  variable: string;
  groups: GroupSummary[];
  anovaF: number | null;
  anovaP: number | null;
  kruskalH: number | null;
  kruskalP: number | null;
}

export interface CategoricalTestResult {
  variable: string;
  categories: string[];
  groups: string[];
  counts: Record<string, Record<string, number>>; // group -> category -> count
  chiSquare: number | null;
  df: number;
  pValue: number | null;
}

export interface CorrelationResult {
  label: string;
  n: number;
  pearsonR: number | null;
  pearsonP: number | null;
  spearmanRho: number | null;
  spearmanP: number | null;
}

function computeMedianAndIqr(values: number[]): { median: number; iqr: number } {
  if (values.length === 0) return { median: 0, iqr: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return {
    median: Number(q(0.5).toFixed(2)),
    iqr: Number((q(0.75) - q(0.25)).toFixed(2)),
  };
}

/** One-way ANOVA & Kruskal-Wallis H across multiple numeric groups */
export function analyzeContinuousAcrossGroups(
  variable: string,
  groupMap: Record<string, number[]>
): ContinuousTestResult {
  const activeEntries = Object.entries(groupMap).filter(([, arr]) => arr.length > 0);
  const groups: GroupSummary[] = Object.entries(groupMap).map(([group, arr]) => {
    const n = arr.length;
    if (n === 0) return { group, n: 0, mean: 0, sd: 0, median: 0, iqr: 0 };
    const mean = arr.reduce((a, b) => a + b, 0) / n;
    const variance =
      n > 1 ? arr.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
    const { median, iqr } = computeMedianAndIqr(arr);
    return {
      group,
      n,
      mean: Number(mean.toFixed(2)),
      sd: Number(Math.sqrt(variance).toFixed(2)),
      median,
      iqr,
    };
  });

  const nonEmptyGroups = activeEntries.map(([, arr]) => arr);
  const k = nonEmptyGroups.length;
  const totalN = nonEmptyGroups.reduce((sum, arr) => sum + arr.length, 0);

  if (k < 2 || totalN <= k) {
    return { variable, groups, anovaF: null, anovaP: null, kruskalH: null, kruskalP: null };
  }

  // One-way ANOVA
  const allVals = nonEmptyGroups.flat();
  const grandMean = allVals.reduce((a, b) => a + b, 0) / totalN;
  let ssBetween = 0;
  let ssWithin = 0;
  for (const arr of nonEmptyGroups) {
    const gMean = arr.reduce((a, b) => a + b, 0) / arr.length;
    ssBetween += arr.length * Math.pow(gMean - grandMean, 2);
    for (const v of arr) {
      ssWithin += Math.pow(v - gMean, 2);
    }
  }
  const df1 = k - 1;
  const df2 = totalN - k;
  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;
  const anovaF = msWithin > 0 ? Number((msBetween / msWithin).toFixed(3)) : null;
  const anovaP = anovaF !== null ? Number(fDistributionPValue(anovaF, df1, df2).toFixed(4)) : null;

  // Kruskal-Wallis H with tie correction
  const tagged = nonEmptyGroups.flatMap((arr, gi) => arr.map((v) => ({ v, gi })));
  tagged.sort((a, b) => a.v - b.v);
  const rankSums = Array(k).fill(0);
  let i = 0;
  let tieCorrectionSum = 0;
  while (i < tagged.length) {
    let j = i;
    while (j < tagged.length && tagged[j].v === tagged[i].v) j++;
    const avgRank = (i + 1 + j) / 2;
    const tieLen = j - i;
    if (tieLen > 1) {
      tieCorrectionSum += Math.pow(tieLen, 3) - tieLen;
    }
    for (let m = i; m < j; m++) {
      rankSums[tagged[m].gi] += avgRank;
    }
    i = j;
  }

  let hSum = 0;
  for (let gi = 0; gi < k; gi++) {
    const ni = nonEmptyGroups[gi].length;
    hSum += Math.pow(rankSums[gi], 2) / ni;
  }
  const hRaw = (12 / (totalN * (totalN + 1))) * hSum - 3 * (totalN + 1);
  const denom = 1 - tieCorrectionSum / (Math.pow(totalN, 3) - totalN);
  const kruskalH = denom > 0 ? Number((hRaw / denom).toFixed(3)) : Number(hRaw.toFixed(3));
  const kruskalP = Number(chiSquarePValue(kruskalH, k - 1).toFixed(4));

  return { variable, groups, anovaF, anovaP, kruskalH, kruskalP };
}

/** Chi-square test across contingency table */
export function analyzeCategoricalAcrossGroups(
  variable: string,
  groupNames: string[],
  categories: string[],
  counts: Record<string, Record<string, number>>
): CategoricalTestResult {
  const rowTotals: Record<string, number> = {};
  const colTotals: Record<string, number> = {};
  let grandTotal = 0;

  for (const g of groupNames) {
    rowTotals[g] = 0;
    for (const c of categories) {
      const val = counts[g]?.[c] ?? 0;
      rowTotals[g] += val;
      colTotals[c] = (colTotals[c] ?? 0) + val;
      grandTotal += val;
    }
  }

  const activeGroups = groupNames.filter((g) => rowTotals[g] > 0);
  const activeCats = categories.filter((c) => (colTotals[c] ?? 0) > 0);

  if (activeGroups.length < 2 || activeCats.length < 2 || grandTotal === 0) {
    return {
      variable,
      categories,
      groups: groupNames,
      counts,
      chiSquare: null,
      df: 0,
      pValue: null,
    };
  }

  let chiSq = 0;
  for (const g of activeGroups) {
    for (const c of activeCats) {
      const obs = counts[g]?.[c] ?? 0;
      const exp = (rowTotals[g] * colTotals[c]) / grandTotal;
      if (exp > 0) {
        chiSq += Math.pow(obs - exp, 2) / exp;
      }
    }
  }

  const df = (activeGroups.length - 1) * (activeCats.length - 1);
  const chiSquare = Number(chiSq.toFixed(3));
  const pValue = Number(chiSquarePValue(chiSquare, df).toFixed(4));

  return { variable, categories, groups: groupNames, counts, chiSquare, df, pValue };
}

function assignAverageRanks(values: number[]): number[] {
  const indexed = values.map((v, idx) => ({ v, idx })).sort((a, b) => a.v - b.v);
  const ranks = Array(values.length).fill(0);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avg = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].idx] = avg;
    }
    i = j;
  }
  return ranks;
}

/** Pearson r & Spearman rho correlation with two-tailed p-values */
export function analyzeCorrelation(
  label: string,
  pairs: Array<[number, number]>
): CorrelationResult {
  const n = pairs.length;
  if (n < 3) {
    return { label, n, pearsonR: null, pearsonP: null, spearmanRho: null, spearmanP: null };
  }

  const calcR = (xs: number[], ys: number[]): { r: number | null; p: number | null } => {
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let denX = 0;
    let denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    if (denX === 0 || denY === 0) return { r: null, p: null };
    const r = num / Math.sqrt(denX * denY);
    const clampedR = Math.max(-0.999999, Math.min(0.999999, r));
    const tStat = Math.abs(clampedR) * Math.sqrt((n - 2) / (1 - clampedR * clampedR));
    const p = Math.abs(r) >= 0.999999 ? 0 : tDistributionPValue(tStat, n - 2);
    return { r: Number(r.toFixed(3)), p: Number(p.toFixed(4)) };
  };

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const pearson = calcR(xs, ys);
  const spearman = calcR(assignAverageRanks(xs), assignAverageRanks(ys));

  return {
    label,
    n,
    pearsonR: pearson.r,
    pearsonP: pearson.p,
    spearmanRho: spearman.r,
    spearmanP: spearman.p,
  };
}

/** Full cohort statistical battery matching STATISTICAL_ANALYSIS_FOR_DIABETES_SUBTYPES_CLASSIFICATION_2.pdf */
export function runStudyStatisticalBattery(patients: PatientCRF[]) {
  const clusters = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];

  const buildGroups = (getter: (p: PatientCRF) => number | null): Record<string, number[]> => {
    const map: Record<string, number[]> = { SIDD: [], SIRD: [], CIRDD: [], MARD: [] };
    for (const p of patients) {
      const c = resolveOptionalPatientCluster(p);
      if (!c) continue;
      const val = getter(p);
      if (val !== null && !Number.isNaN(val)) {
        map[c].push(val);
      }
    }
    return map;
  };

  const continuousTests: ContinuousTestResult[] = [
    analyzeContinuousAcrossGroups('Age (years)', buildGroups((p) => p.age)),
    analyzeContinuousAcrossGroups('BMI (kg/m²)', buildGroups((p) => p.bmi)),
    analyzeContinuousAcrossGroups('Waist Circumference (cm)', buildGroups((p) => p.waistCm)),
    analyzeContinuousAcrossGroups('Waist-Hip Ratio', buildGroups((p) => p.waistHipRatio)),
    analyzeContinuousAcrossGroups('HbA1c (%)', buildGroups((p) => p.hba1c1.value)),
    analyzeContinuousAcrossGroups('Fasting Blood Glucose (mg/dL)', buildGroups((p) => p.fbg.value)),
    analyzeContinuousAcrossGroups('Postprandial Blood Glucose (mg/dL)', buildGroups((p) => p.ppbg.value)),
    analyzeContinuousAcrossGroups('Total Cholesterol (mg/dL)', buildGroups((p) => p.totalCholesterol.value)),
    analyzeContinuousAcrossGroups('Triglycerides (mg/dL)', buildGroups((p) => p.triglycerides.value)),
    analyzeContinuousAcrossGroups('HDL-C (mg/dL)', buildGroups((p) => p.hdl.value)),
    analyzeContinuousAcrossGroups('LDL-C (mg/dL)', buildGroups((p) => p.ldl.value)),
    analyzeContinuousAcrossGroups('Hemoglobin (g/dL)', buildGroups((p) => p.hemoglobin.value)),
    analyzeContinuousAcrossGroups('eGFR (mL/min/1.73m²)', buildGroups((p) => p.egfr)),
    analyzeContinuousAcrossGroups('AST / SGOT (U/L)', buildGroups((p) => p.ast.value)),
    analyzeContinuousAcrossGroups('ALT / SGPT (U/L)', buildGroups((p) => p.alt.value)),
    analyzeContinuousAcrossGroups('C-Peptide (ng/mL)', buildGroups((p) => p.cPeptide.value)),
    analyzeContinuousAcrossGroups('HOMA-B (%)', buildGroups((p) => p.homaB)),
    analyzeContinuousAcrossGroups('HOMA-IR', buildGroups((p) => p.homaIR)),
    analyzeContinuousAcrossGroups('FibroScan LSM (kPa)', buildGroups((p) => p.lsmKpa)),
    analyzeContinuousAcrossGroups('FibroScan CAP (dB/m)', buildGroups((p) => p.capDbm)),
    analyzeContinuousAcrossGroups('Known Severity KS Total (/15)', buildGroups((p) => p.ksTotal)),
    analyzeContinuousAcrossGroups('Blue Index DHS (/50)', buildGroups((p) => p.dhsTotal)),
    analyzeContinuousAcrossGroups('DDS-17 Mean Score (/6)', buildGroups((p) => p.ddsMean)),
    analyzeContinuousAcrossGroups('DDS-17 Total Score', buildGroups((p) => p.ddsTotal)),
    analyzeContinuousAcrossGroups('DDS-17 Emotional Burden', buildGroups((p) => p.ddsEmotionalBurden)),
    analyzeContinuousAcrossGroups('DDS-17 Physician Distress', buildGroups((p) => p.ddsPhysicianDistress)),
    analyzeContinuousAcrossGroups('DDS-17 Regimen Distress', buildGroups((p) => p.ddsRegimenDistress)),
    analyzeContinuousAcrossGroups('DDS-17 Interpersonal Distress', buildGroups((p) => p.ddsInterpersonalDistress)),
  ];

  const buildCounts = (
    categories: string[],
    classifier: (p: PatientCRF) => string | null
  ): Record<string, Record<string, number>> => {
    const counts: Record<string, Record<string, number>> = {};
    for (const c of clusters) {
      counts[c] = {};
      for (const cat of categories) counts[c][cat] = 0;
    }
    for (const p of patients) {
      const g = resolveOptionalPatientCluster(p);
      if (!g) continue;
      const cat = classifier(p);
      if (cat && counts[g] && cat in counts[g]) {
        counts[g][cat] += 1;
      }
    }
    return counts;
  };

  const categoricalTests: CategoricalTestResult[] = [
    analyzeCategoricalAcrossGroups(
      'Gender Distribution',
      clusters,
      ['Male', 'Female', 'Other'],
      buildCounts(['Male', 'Female', 'Other'], (p) => p.gender || null)
    ),
    analyzeCategoricalAcrossGroups(
      'Dyslipidaemia',
      clusters,
      ['Present', 'Absent'],
      buildCounts(['Present', 'Absent'], (p) => {
        if (p.totalCholesterol.value === null && p.triglycerides.value === null && p.ldl.value === null) return null;
        const dys =
          (p.totalCholesterol.value ?? 0) >= 200 ||
          (p.triglycerides.value ?? 0) >= 150 ||
          (p.ldl.value ?? 0) >= 100 ||
          p.onStatin;
        return dys ? 'Present' : 'Absent';
      })
    ),
    analyzeCategoricalAcrossGroups(
      'Microvascular Complication (KS M ≥ 2)',
      clusters,
      ['Present', 'Absent'],
      buildCounts(['Present', 'Absent'], (p) =>
        p.ksMicrovascular === null ? null : p.ksMicrovascular >= 2 ? 'Present' : 'Absent'
      )
    ),
    analyzeCategoricalAcrossGroups(
      'Macrovascular Complication (KS C ≥ 2)',
      clusters,
      ['Present', 'Absent'],
      buildCounts(['Present', 'Absent'], (p) =>
        p.ksMacrovascular === null ? null : p.ksMacrovascular >= 2 ? 'Present' : 'Absent'
      )
    ),
    analyzeCategoricalAcrossGroups(
      'Significant Fibrosis Category (F2–F4)',
      clusters,
      ['Significant (F2–F4)', 'No/Mild (F0–F1)'],
      buildCounts(['Significant (F2–F4)', 'No/Mild (F0–F1)'], (p) => {
        if (!p.fibrosisInterpretation) return null;
        return p.fibrosisInterpretation === 'F0-F1' ? 'No/Mild (F0–F1)' : 'Significant (F2–F4)';
      })
    ),
    analyzeCategoricalAcrossGroups(
      'Hepatic Steatosis Category (S2–S3)',
      clusters,
      ['Mod-Severe (S2–S3)', 'None/Mild (S0–S1)'],
      buildCounts(['Mod-Severe (S2–S3)', 'None/Mild (S0–S1)'], (p) => {
        if (!p.steatosisInterpretation) return null;
        return p.steatosisInterpretation === 'S2' || p.steatosisInterpretation === 'S3'
          ? 'Mod-Severe (S2–S3)'
          : 'None/Mild (S0–S1)';
      })
    ),
    analyzeCategoricalAcrossGroups(
      'Glycemic Control Tier (Baseline HbA1c)',
      clusters,
      ['Controlled (<7.0%)', 'Suboptimal (7.0–8.9%)', 'Poor (≥9.0%)'],
      buildCounts(['Controlled (<7.0%)', 'Suboptimal (7.0–8.9%)', 'Poor (≥9.0%)'], (p) => {
        const val = p.hba1c1.value;
        if (val === null) return null;
        if (val < 7.0) return 'Controlled (<7.0%)';
        if (val < 9.0) return 'Suboptimal (7.0–8.9%)';
        return 'Poor (≥9.0%)';
      })
    ),
    analyzeCategoricalAcrossGroups(
      'Blue Index DHS Status',
      clusters,
      ['Excellent Status', 'Moderate Status', 'Undesirable Status'],
      buildCounts(['Excellent Status', 'Moderate Status', 'Undesirable Status'], (p) =>
        p.dhsCategory || null
      )
    ),
    analyzeCategoricalAcrossGroups(
      'DDS-17 Distress Category',
      clusters,
      ['Little or No Distress', 'Moderate Distress', 'High Distress'],
      buildCounts(['Little or No Distress', 'Moderate Distress', 'High Distress'], (p) =>
        p.ddsCategory || null
      )
    ),
  ];

  const ageHba1cPairs: Array<[number, number]> = [];
  const hbHba1cPairs: Array<[number, number]> = [];
  const dhsDdsPairs: Array<[number, number]> = [];
  const dhsHba1cPairs: Array<[number, number]> = [];
  const lsmBmiPairs: Array<[number, number]> = [];
  for (const p of patients) {
    if (p.age !== null && p.hba1c1.value !== null) {
      ageHba1cPairs.push([p.age, p.hba1c1.value]);
    }
    if (p.hemoglobin.value !== null && p.hba1c1.value !== null) {
      hbHba1cPairs.push([p.hemoglobin.value, p.hba1c1.value]);
    }
    if (p.dhsTotal !== null && p.ddsMean !== null) {
      dhsDdsPairs.push([p.dhsTotal, p.ddsMean]);
    }
    if (p.dhsTotal !== null && p.hba1c1.value !== null) {
      dhsHba1cPairs.push([p.dhsTotal, p.hba1c1.value]);
    }
    if (p.lsmKpa !== null && p.bmi !== null) {
      lsmBmiPairs.push([p.lsmKpa, p.bmi]);
    }
  }

  const correlations: CorrelationResult[] = [
    analyzeCorrelation('Age vs. HbA1c (%)', ageHba1cPairs),
    analyzeCorrelation('Hemoglobin (Hb) vs. HbA1c (%)', hbHba1cPairs),
    analyzeCorrelation('Blue Index DHS vs. DDS-17 Mean', dhsDdsPairs),
    analyzeCorrelation('Blue Index DHS vs. HbA1c (%)', dhsHba1cPairs),
    analyzeCorrelation('FibroScan LSM (kPa) vs. BMI (kg/m²)', lsmBmiPairs),
  ];

  return { continuousTests, categoricalTests, correlations };
}
