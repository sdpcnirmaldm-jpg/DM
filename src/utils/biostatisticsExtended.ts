import type { PatientCRF } from '../types/clinical';
import { classifyAntidiabeticDrug, getActiveAntidiabeticDrugs } from './drugUtilization';
import { PROTOCOL_AGE_BANDS, classifyProtocolAgeBand } from './protocolObjectives';
import { tDistributionPValue } from './statistics';
import { resolveOptionalPatientCluster, type ClusterCode } from './statisticalCharts';

export type ProtocolDataType = 'Continuous' | 'Discrete' | 'Ordinal' | 'Nominal';

export interface ContinuousDescriptiveRow {
  variable: string;
  unit: string;
  dataType: 'Continuous' | 'Discrete';
  n: number;
  mean: number;
  sd: number;
  ciLower: number;
  ciUpper: number;
  median: number;
  q1: number;
  q3: number;
  iqr: number;
  min: number;
  max: number;
}

export interface CategoricalLevelStat {
  label: string;
  count: number;
  pct: number;
  color: string;
}

export interface CategoricalDescriptiveRow {
  variable: string;
  dataType: 'Ordinal' | 'Nominal';
  n: number;
  modalLevel: string;
  levels: CategoricalLevelStat[];
}

export interface DescriptiveProfile {
  cohortSize: number;
  continuousVariables: ContinuousDescriptiveRow[];
  discreteVariables: ContinuousDescriptiveRow[];
  ordinalVariables: CategoricalDescriptiveRow[];
  nominalVariables: CategoricalDescriptiveRow[];
}

/** Exact two-tailed 95% critical t-value using bisection on tDistributionPValue */
export function tCritical95(df: number): number {
  if (df <= 0) return 1.96;
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 45; i++) {
    const mid = (lo + hi) / 2;
    const p = tDistributionPValue(mid, df);
    if (p > 0.05) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function summarizeNumericSeries(
  variable: string,
  unit: string,
  dataType: 'Continuous' | 'Discrete',
  rawValues: Array<number | null>
): ContinuousDescriptiveRow {
  const vals = rawValues.filter((v): v is number => v !== null && Number.isFinite(v));
  const n = vals.length;
  if (n === 0) {
    return {
      variable,
      unit,
      dataType,
      n: 0,
      mean: 0,
      sd: 0,
      ciLower: 0,
      ciUpper: 0,
      median: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      min: 0,
      max: 0,
    };
  }

  const sorted = [...vals].sort((a, b) => a - b);
  const quantile = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };

  const mean = vals.reduce((a, b) => a + b, 0) / n;
  const variance = n > 1 ? vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const se = n > 1 ? sd / Math.sqrt(n) : 0;
  const tCrit = n > 1 ? tCritical95(n - 1) : 0;
  const q1 = quantile(0.25);
  const median = quantile(0.5);
  const q3 = quantile(0.75);

  return {
    variable,
    unit,
    dataType,
    n,
    mean: Number(mean.toFixed(2)),
    sd: Number(sd.toFixed(2)),
    ciLower: Number((mean - tCrit * se).toFixed(2)),
    ciUpper: Number((mean + tCrit * se).toFixed(2)),
    median: Number(median.toFixed(2)),
    q1: Number(q1.toFixed(2)),
    q3: Number(q3.toFixed(2)),
    iqr: Number((q3 - q1).toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

function summarizeCategoricalSeries(
  variable: string,
  dataType: 'Ordinal' | 'Nominal',
  levelDefs: Array<{ label: string; color: string }>,
  classifier: (p: PatientCRF) => string | null,
  patients: PatientCRF[]
): CategoricalDescriptiveRow {
  const counts = new Map<string, number>();
  for (const lvl of levelDefs) counts.set(lvl.label, 0);

  let n = 0;
  for (const p of patients) {
    const cat = classifier(p);
    if (cat && counts.has(cat)) {
      counts.set(cat, (counts.get(cat) || 0) + 1);
      n += 1;
    }
  }

  const levels: CategoricalLevelStat[] = levelDefs.map((lvl) => {
    const count = counts.get(lvl.label) || 0;
    return {
      label: lvl.label,
      count,
      pct: n > 0 ? Number(((count / n) * 100).toFixed(1)) : 0,
      color: lvl.color,
    };
  });

  const modal = [...levels].sort((a, b) => b.count - a.count)[0];

  return {
    variable,
    dataType,
    n,
    modalLevel: modal && modal.count > 0 ? `${modal.label} (${modal.pct}%)` : '—',
    levels,
  };
}

/**
 * Protocol Method 1: Descriptive Statistics stratified across all 4 Protocol Data Types:
 * Continuous, Discrete, Ordinal, and Nominal.
 */
export function computeDescriptiveProfile(patients: PatientCRF[]): DescriptiveProfile {
  const continuousVariables: ContinuousDescriptiveRow[] = [
    summarizeNumericSeries('Age', 'yrs', 'Continuous', patients.map((p) => p.age)),
    summarizeNumericSeries('BMI', 'kg/m²', 'Continuous', patients.map((p) => p.bmi)),
    summarizeNumericSeries(
      'Waist Circumference',
      'cm',
      'Continuous',
      patients.map((p) => p.waistCm)
    ),
    summarizeNumericSeries(
      'Baseline HbA1c',
      '%',
      'Continuous',
      patients.map((p) => p.hba1c1.value)
    ),
    summarizeNumericSeries(
      'Fasting Blood Glucose',
      'mg/dL',
      'Continuous',
      patients.map((p) => p.fbg.value)
    ),
    summarizeNumericSeries(
      'C-Peptide (Fasting)',
      'ng/mL',
      'Continuous',
      patients.map((p) => p.cPeptide.value)
    ),
    summarizeNumericSeries('HOMA-B', '%', 'Continuous', patients.map((p) => p.homaB)),
    summarizeNumericSeries('HOMA-IR', 'idx', 'Continuous', patients.map((p) => p.homaIR)),
    summarizeNumericSeries(
      'Triglycerides',
      'mg/dL',
      'Continuous',
      patients.map((p) => p.triglycerides.value)
    ),
    summarizeNumericSeries(
      'eGFR',
      'mL/min/1.73m²',
      'Continuous',
      patients.map((p) => p.egfr)
    ),
    summarizeNumericSeries('FibroScan LSM', 'kPa', 'Continuous', patients.map((p) => p.lsmKpa)),
    summarizeNumericSeries('FibroScan CAP', 'dB/m', 'Continuous', patients.map((p) => p.capDbm)),
    summarizeNumericSeries('Blue Index DHS', '/50', 'Continuous', patients.map((p) => p.dhsTotal)),
    summarizeNumericSeries('DDS-17 Mean Score', '/6', 'Continuous', patients.map((p) => p.ddsMean)),
  ];

  const discreteVariables: ContinuousDescriptiveRow[] = [
    summarizeNumericSeries(
      'Active Antidiabetic Agents',
      'drugs/pt',
      'Discrete',
      patients.map((p) => getActiveAntidiabeticDrugs(p).length)
    ),
    summarizeNumericSeries(
      'Total Active Medications',
      'drugs/pt',
      'Discrete',
      patients.map((p) => {
        const anti = getActiveAntidiabeticDrugs(p).length;
        const other = (p.otherMedications || []).filter(
          (m) => m.drugName.trim() !== '' && m.status !== 'Disc.'
        ).length;
        return anti + other;
      })
    ),
    summarizeNumericSeries(
      'Known Severity KS Total',
      '/15 pts',
      'Discrete',
      patients.map((p) => p.ksTotal)
    ),
    summarizeNumericSeries(
      'KS Microvascular Tier',
      '0–5 tier',
      'Discrete',
      patients.map((p) => p.ksMicrovascular)
    ),
    summarizeNumericSeries(
      'KS Macrovascular Tier',
      '0–5 tier',
      'Discrete',
      patients.map((p) => p.ksMacrovascular)
    ),
    summarizeNumericSeries(
      'Diabetes Duration',
      'years',
      'Discrete',
      patients.map((p) => p.durationYears)
    ),
  ];

  const ordinalVariables: CategoricalDescriptiveRow[] = [
    summarizeCategoricalSeries(
      'Glycemic Control Tier (HbA1c)',
      'Ordinal',
      [
        { label: 'Controlled (<7.0%)', color: '#047857' },
        { label: 'Suboptimal (7.0–8.9%)', color: '#D97706' },
        { label: 'Poor (≥9.0%)', color: '#BE185D' },
      ],
      (p) => {
        const val = p.hba1c1.value;
        if (val === null) return null;
        if (val < 7.0) return 'Controlled (<7.0%)';
        if (val < 9.0) return 'Suboptimal (7.0–8.9%)';
        return 'Poor (≥9.0%)';
      },
      patients
    ),
    summarizeCategoricalSeries(
      'Blue Index DHS Grade',
      'Ordinal',
      [
        { label: 'Excellent Status', color: '#047857' },
        { label: 'Moderate Status', color: '#D97706' },
        { label: 'Undesirable Status', color: '#BE185D' },
      ],
      (p) => p.dhsCategory || null,
      patients
    ),
    summarizeCategoricalSeries(
      'DDS-17 Distress Severity',
      'Ordinal',
      [
        { label: 'Little or No Distress', color: '#047857' },
        { label: 'Moderate Distress', color: '#D97706' },
        { label: 'High Distress', color: '#BE185D' },
      ],
      (p) => p.ddsCategory || null,
      patients
    ),
    summarizeCategoricalSeries(
      'Hepatic Fibrosis Stage (FibroScan)',
      'Ordinal',
      [
        { label: 'F0-F1', color: '#047857' },
        { label: 'F2', color: '#0D9488' },
        { label: 'F3', color: '#D97706' },
        { label: 'F4', color: '#BE185D' },
      ],
      (p) => p.fibrosisInterpretation || null,
      patients
    ),
    summarizeCategoricalSeries(
      'Hepatic Steatosis Grade (CAP)',
      'Ordinal',
      [
        { label: 'S0', color: '#047857' },
        { label: 'S1', color: '#0D9488' },
        { label: 'S2', color: '#D97706' },
        { label: 'S3', color: '#BE185D' },
      ],
      (p) => p.steatosisInterpretation || null,
      patients
    ),
    summarizeCategoricalSeries(
      'Adult Age Strata (Protocol E4)',
      'Ordinal',
      PROTOCOL_AGE_BANDS.map((band, idx) => ({
        label: band,
        color: ['#0D9488', '#047857', '#2563EB', '#D97706', '#7C3AED', '#BE185D'][idx],
      })),
      (p) => {
        const b = classifyProtocolAgeBand(p.age);
        return b && b !== 'Other (<18 / >75)' ? b : null;
      },
      patients
    ),
  ];

  const nominalVariables: CategoricalDescriptiveRow[] = [
    summarizeCategoricalSeries(
      'T2DM Phenotypic Cluster',
      'Nominal',
      [
        { label: 'SIDD', color: '#047857' },
        { label: 'SIRD', color: '#D97706' },
        { label: 'CIRDD', color: '#BE185D' },
        { label: 'MARD', color: '#7C3AED' },
      ],
      (p) => resolveOptionalPatientCluster(p),
      patients
    ),
    summarizeCategoricalSeries(
      'Biological Sex',
      'Nominal',
      [
        { label: 'Male', color: '#047857' },
        { label: 'Female', color: '#7C3AED' },
        { label: 'Other', color: '#6B8076' },
      ],
      (p) => p.gender || null,
      patients
    ),
    summarizeCategoricalSeries(
      'Dyslipidaemia Status',
      'Nominal',
      [
        { label: 'Present', color: '#D97706' },
        { label: 'Absent', color: '#047857' },
      ],
      (p) => {
        if (
          p.totalCholesterol.value === null &&
          p.triglycerides.value === null &&
          p.ldl.value === null
        ) {
          return null;
        }
        const dys =
          (p.totalCholesterol.value ?? 0) >= 200 ||
          (p.triglycerides.value ?? 0) >= 150 ||
          (p.ldl.value ?? 0) >= 100 ||
          p.onStatin;
        return dys ? 'Present' : 'Absent';
      },
      patients
    ),
    summarizeCategoricalSeries(
      'Cardiorenal Co-Therapy (Statin / Anti-HTN)',
      'Nominal',
      [
        { label: 'Both Statin & Anti-HTN', color: '#047857' },
        { label: 'Statin Only', color: '#0D9488' },
        { label: 'Anti-HTN Only', color: '#D97706' },
        { label: 'Neither', color: '#94A89E' },
      ],
      (p) => {
        if (p.onStatin && p.onAntiHtnMeds) return 'Both Statin & Anti-HTN';
        if (p.onStatin) return 'Statin Only';
        if (p.onAntiHtnMeds) return 'Anti-HTN Only';
        return 'Neither';
      },
      patients
    ),
    summarizeCategoricalSeries(
      'Insulin Utilization Status',
      'Nominal',
      [
        { label: 'Insulin-Containing', color: '#BE185D' },
        { label: 'Oral Antidiabetics Only', color: '#047857' },
        { label: 'No Active Antidiabetic Rx', color: '#94A89E' },
      ],
      (p) => {
        const drugs = getActiveAntidiabeticDrugs(p);
        if (drugs.length === 0) return 'No Active Antidiabetic Rx';
        const hasInsulin = drugs.some((d) => classifyAntidiabeticDrug(d.drugName).isInsulin);
        return hasInsulin ? 'Insulin-Containing' : 'Oral Antidiabetics Only';
      },
      patients
    ),
  ];

  return {
    cohortSize: patients.length,
    continuousVariables,
    discreteVariables,
    ordinalVariables,
    nominalVariables,
  };
}

// ---------------------------------------------------------------------------
// Method 3 Extension: Symmetric Correlation Heatmap Matrix
// ---------------------------------------------------------------------------

export interface HeatmapVariable {
  key: string;
  shortLabel: string;
  fullLabel: string;
  unit: string;
}

export interface HeatmapCell {
  rowIdx: number;
  colIdx: number;
  rowLabel: string;
  colLabel: string;
  n: number;
  r: number | null;
  p: number | null;
}

export interface CorrelationHeatmapModel {
  variables: HeatmapVariable[];
  matrix: HeatmapCell[][];
}

const HEATMAP_VARS: Array<HeatmapVariable & { get: (p: PatientCRF) => number | null }> = [
  { key: 'age', shortLabel: 'Age', fullLabel: 'Age (yrs)', unit: 'yrs', get: (p) => p.age },
  { key: 'bmi', shortLabel: 'BMI', fullLabel: 'BMI (kg/m²)', unit: 'kg/m²', get: (p) => p.bmi },
  {
    key: 'hba1c',
    shortLabel: 'HbA1c',
    fullLabel: 'Baseline HbA1c (%)',
    unit: '%',
    get: (p) => p.hba1c1.value,
  },
  {
    key: 'homair',
    shortLabel: 'HOMA-IR',
    fullLabel: 'HOMA-IR Index',
    unit: 'idx',
    get: (p) => p.homaIR,
  },
  {
    key: 'lsm',
    shortLabel: 'LSM kPa',
    fullLabel: 'FibroScan LSM (kPa)',
    unit: 'kPa',
    get: (p) => p.lsmKpa,
  },
  {
    key: 'dhs',
    shortLabel: 'DHS /50',
    fullLabel: 'Blue Index DHS (/50)',
    unit: '/50',
    get: (p) => p.dhsTotal,
  },
  {
    key: 'dds',
    shortLabel: 'DDS-17',
    fullLabel: 'DDS-17 Mean Score',
    unit: '/6',
    get: (p) => p.ddsMean,
  },
  {
    key: 'ks',
    shortLabel: 'KS Total',
    fullLabel: 'Known Severity KS (/15)',
    unit: '/15',
    get: (p) => p.ksTotal,
  },
];

export function buildCorrelationHeatmap(patients: PatientCRF[]): CorrelationHeatmapModel {
  const variables: HeatmapVariable[] = HEATMAP_VARS.map(({ key, shortLabel, fullLabel, unit }) => ({
    key,
    shortLabel,
    fullLabel,
    unit,
  }));

  const matrix: HeatmapCell[][] = HEATMAP_VARS.map((rowVar, rowIdx) =>
    HEATMAP_VARS.map((colVar, colIdx) => {
      if (rowIdx === colIdx) {
        const nSelf = patients.filter((p) => {
          const v = rowVar.get(p);
          return v !== null && Number.isFinite(v);
        }).length;
        return {
          rowIdx,
          colIdx,
          rowLabel: rowVar.fullLabel,
          colLabel: colVar.fullLabel,
          n: nSelf,
          r: nSelf >= 2 ? 1 : null,
          p: nSelf >= 2 ? 0 : null,
        };
      }

      const pairs: Array<[number, number]> = [];
      for (const p of patients) {
        const x = rowVar.get(p);
        const y = colVar.get(p);
        if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
          pairs.push([x, y]);
        }
      }
      const n = pairs.length;
      if (n < 3) {
        return {
          rowIdx,
          colIdx,
          rowLabel: rowVar.fullLabel,
          colLabel: colVar.fullLabel,
          n,
          r: null,
          p: null,
        };
      }
      const meanX = pairs.reduce((s, pt) => s + pt[0], 0) / n;
      const meanY = pairs.reduce((s, pt) => s + pt[1], 0) / n;
      let num = 0;
      let denX = 0;
      let denY = 0;
      for (const [x, y] of pairs) {
        const dx = x - meanX;
        const dy = y - meanY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      if (denX === 0 || denY === 0) {
        return {
          rowIdx,
          colIdx,
          rowLabel: rowVar.fullLabel,
          colLabel: colVar.fullLabel,
          n,
          r: null,
          p: null,
        };
      }
      const rRaw = num / Math.sqrt(denX * denY);
      const clampedR = Math.max(-0.999999, Math.min(0.999999, rRaw));
      const tStat = Math.abs(clampedR) * Math.sqrt((n - 2) / (1 - clampedR * clampedR));
      const pVal = Math.abs(rRaw) >= 0.999999 ? 0 : tDistributionPValue(tStat, n - 2);
      return {
        rowIdx,
        colIdx,
        rowLabel: rowVar.fullLabel,
        colLabel: colVar.fullLabel,
        n,
        r: Number(rRaw.toFixed(2)),
        p: Number(pVal.toFixed(4)),
      };
    })
  );

  return { variables, matrix };
}

// ---------------------------------------------------------------------------
// Method 4: OLS Linear Regression Analysis
// ---------------------------------------------------------------------------

export type RegressionOutcomeKey = 'hba1c' | 'dhs' | 'lsm';

export interface RegressionPoint {
  participantId: string;
  patientName: string;
  cluster: ClusterCode | 'Unassigned';
  x: number;
  y: number;
  fittedY: number;
  residual: number;
}

export interface SimpleRegressionRow {
  predictorKey: string;
  predictorLabel: string;
  predictorUnit: string;
  n: number;
  slope: number | null;
  standardizedBeta: number | null;
  intercept: number | null;
  seSlope: number | null;
  ciLower: number | null;
  ciUpper: number | null;
  stdBetaCiLower: number | null;
  stdBetaCiUpper: number | null;
  rSquared: number | null;
  adjRSquared: number | null;
  fStat: number | null;
  tStat: number | null;
  pValue: number | null;
  points: RegressionPoint[];
}

export interface RegressionOutcomeSuite {
  outcomeKey: RegressionOutcomeKey;
  outcomeLabel: string;
  outcomeUnit: string;
  clinicalQuestion: string;
  models: SimpleRegressionRow[];
}

export function computeOlsRegression(
  predictorKey: string,
  predictorLabel: string,
  predictorUnit: string,
  pointsRaw: Array<{
    participantId: string;
    patientName: string;
    cluster: ClusterCode | 'Unassigned';
    x: number;
    y: number;
  }>
): SimpleRegressionRow {
  const n = pointsRaw.length;
  if (n < 4) {
    return {
      predictorKey,
      predictorLabel,
      predictorUnit,
      n,
      slope: null,
      standardizedBeta: null,
      intercept: null,
      seSlope: null,
      ciLower: null,
      ciUpper: null,
      stdBetaCiLower: null,
      stdBetaCiUpper: null,
      rSquared: null,
      adjRSquared: null,
      fStat: null,
      tStat: null,
      pValue: null,
      points: [],
    };
  }

  const meanX = pointsRaw.reduce((s, p) => s + p.x, 0) / n;
  const meanY = pointsRaw.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const pt of pointsRaw) {
    const dx = pt.x - meanX;
    const dy = pt.y - meanY;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  if (sxx === 0 || syy === 0) {
    return {
      predictorKey,
      predictorLabel,
      predictorUnit,
      n,
      slope: null,
      standardizedBeta: null,
      intercept: null,
      seSlope: null,
      ciLower: null,
      ciUpper: null,
      stdBetaCiLower: null,
      stdBetaCiUpper: null,
      rSquared: null,
      adjRSquared: null,
      fStat: null,
      tStat: null,
      pValue: null,
      points: [],
    };
  }

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const df = n - 2;

  let sse = 0;
  const points: RegressionPoint[] = pointsRaw.map((pt) => {
    const fitted = slope * pt.x + intercept;
    const residual = pt.y - fitted;
    sse += residual * residual;
    return {
      participantId: pt.participantId,
      patientName: pt.patientName,
      cluster: pt.cluster,
      x: Number(pt.x.toFixed(2)),
      y: Number(pt.y.toFixed(2)),
      fittedY: Number(fitted.toFixed(2)),
      residual: Number(residual.toFixed(2)),
    };
  });

  const mse = sse / df;
  const seSlope = Math.sqrt(mse / sxx);
  const tCrit = tCritical95(df);
  const tStat = seSlope > 0 ? slope / seSlope : 0;
  const pValue = seSlope > 0 ? tDistributionPValue(Math.abs(tStat), df) : 0;

  const rSquared = Math.max(0, Math.min(1, 1 - sse / syy));
  const adjRSquared = 1 - ((1 - rSquared) * (n - 1)) / df;
  const fStat = rSquared < 0.999999 ? (rSquared / (1 - rSquared)) * df : 9999;

  const sdX = Math.sqrt(sxx / (n - 1));
  const sdY = Math.sqrt(syy / (n - 1));
  const scaleFactor = sdY > 0 ? sdX / sdY : 1;
  const stdBeta = slope * scaleFactor;
  const seStdBeta = seSlope * scaleFactor;

  return {
    predictorKey,
    predictorLabel,
    predictorUnit,
    n,
    slope: Number(slope.toFixed(3)),
    standardizedBeta: Number(stdBeta.toFixed(3)),
    intercept: Number(intercept.toFixed(3)),
    seSlope: Number(seSlope.toFixed(3)),
    ciLower: Number((slope - tCrit * seSlope).toFixed(3)),
    ciUpper: Number((slope + tCrit * seSlope).toFixed(3)),
    stdBetaCiLower: Number((stdBeta - tCrit * seStdBeta).toFixed(3)),
    stdBetaCiUpper: Number((stdBeta + tCrit * seStdBeta).toFixed(3)),
    rSquared: Number(rSquared.toFixed(3)),
    adjRSquared: Number(adjRSquared.toFixed(3)),
    fStat: Number(fStat.toFixed(2)),
    tStat: Number(tStat.toFixed(2)),
    pValue: Number(pValue.toFixed(4)),
    points,
  };
}

interface PredictorSpec {
  key: string;
  label: string;
  unit: string;
  get: (p: PatientCRF) => number | null;
}

const PREDICTOR_SPECS: Record<string, PredictorSpec> = {
  age: { key: 'age', label: 'Age', unit: 'yrs', get: (p) => p.age },
  duration: {
    key: 'duration',
    label: 'Diabetes Duration',
    unit: 'yrs',
    get: (p) => p.durationYears,
  },
  bmi: { key: 'bmi', label: 'BMI', unit: 'kg/m²', get: (p) => p.bmi },
  waist: { key: 'waist', label: 'Waist Circumference', unit: 'cm', get: (p) => p.waistCm },
  hba1c: { key: 'hba1c', label: 'Baseline HbA1c', unit: '%', get: (p) => p.hba1c1.value },
  cpep: { key: 'cpep', label: 'C-Peptide', unit: 'ng/mL', get: (p) => p.cPeptide.value },
  homab: { key: 'homab', label: 'HOMA-B', unit: '%', get: (p) => p.homaB },
  homair: { key: 'homair', label: 'HOMA-IR', unit: 'idx', get: (p) => p.homaIR },
  tg: {
    key: 'tg',
    label: 'Triglycerides',
    unit: 'mg/dL',
    get: (p) => p.triglycerides.value,
  },
  alt: { key: 'alt', label: 'ALT / SGPT', unit: 'U/L', get: (p) => p.alt.value },
  cap: { key: 'cap', label: 'FibroScan CAP', unit: 'dB/m', get: (p) => p.capDbm },
  lsm: { key: 'lsm', label: 'FibroScan LSM', unit: 'kPa', get: (p) => p.lsmKpa },
  dhs: { key: 'dhs', label: 'Blue Index DHS', unit: '/50', get: (p) => p.dhsTotal },
  dds: { key: 'dds', label: 'DDS-17 Mean Distress', unit: '/6', get: (p) => p.ddsMean },
  ks: { key: 'ks', label: 'Known Severity KS Total', unit: '/15', get: (p) => p.ksTotal },
};

export function computeStudyRegressions(patients: PatientCRF[]): RegressionOutcomeSuite[] {
  const buildModels = (
    outcomeGetter: (p: PatientCRF) => number | null,
    predictorKeys: string[]
  ): SimpleRegressionRow[] => {
    return predictorKeys
      .map((k) => {
        const spec = PREDICTOR_SPECS[k];
        const pts: Array<{
          participantId: string;
          patientName: string;
          cluster: ClusterCode | 'Unassigned';
          x: number;
          y: number;
        }> = [];
        for (const p of patients) {
          const x = spec.get(p);
          const y = outcomeGetter(p);
          if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
            pts.push({
              participantId: p.participantId,
              patientName: p.patientName,
              cluster: resolveOptionalPatientCluster(p) ?? 'Unassigned',
              x,
              y,
            });
          }
        }
        return computeOlsRegression(spec.key, spec.label, spec.unit, pts);
      })
      .sort((a, b) => (b.rSquared ?? -1) - (a.rSquared ?? -1));
  };

  return [
    {
      outcomeKey: 'hba1c',
      outcomeLabel: 'Baseline HbA1c (%)',
      outcomeUnit: '%',
      clinicalQuestion:
        'Which glycemic, beta-cell, hepatic, or distress biomarkers predict baseline HbA1c levels?',
      models: buildModels((p) => p.hba1c1.value, [
        'dhs',
        'dds',
        'homab',
        'cpep',
        'homair',
        'lsm',
        'bmi',
        'age',
        'duration',
      ]),
    },
    {
      outcomeKey: 'dhs',
      outcomeLabel: 'Blue Index DHS (/50)',
      outcomeUnit: '/50',
      clinicalQuestion:
        'How strongly do glycemic control, diabetes distress, complications, and anthropometry predict overall DHS?',
      models: buildModels((p) => p.dhsTotal, ['hba1c', 'dds', 'ks', 'bmi', 'lsm', 'age']),
    },
    {
      outcomeKey: 'lsm',
      outcomeLabel: 'FibroScan Liver Stiffness LSM (kPa)',
      outcomeUnit: 'kPa',
      clinicalQuestion:
        'Which metabolic, steatotic, and insulin-resistance factors predict hepatic stiffness (kPa)?',
      models: buildModels((p) => p.lsmKpa, ['cap', 'bmi', 'waist', 'homair', 'tg', 'alt', 'hba1c']),
    },
  ];
}
