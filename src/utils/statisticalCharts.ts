import type { PatientCRF } from '../types/clinical';
import type { CategoricalTestResult, ContinuousTestResult } from './statistics';

export function getPatientKey(patient: PatientCRF, fallbackIndex?: number): string {
  if (patient.id !== undefined && patient.id !== null) return `id:${patient.id}`;
  if (patient.participantId.trim()) return `pid:${patient.participantId.trim()}`;
  if (patient.uhid.trim()) return `uhid:${patient.uhid.trim()}`;
  if (patient.patientName.trim()) {
    return `name:${patient.patientName.trim()}${fallbackIndex !== undefined ? `#${fallbackIndex}` : ''}`;
  }
  return `row:${fallbackIndex ?? 0}`;
}

export type ClusterCode = 'SIDD' | 'SIRD' | 'CIRDD' | 'MARD';

export const CLUSTER_META: Record<
  ClusterCode,
  { code: ClusterCode; fullName: string; color: string; tint: string; focus: string }
> = {
  SIDD: {
    code: 'SIDD',
    fullName: 'Severe Insulin-Deficient',
    color: '#047857',
    tint: '#ECFDF5',
    focus: 'Low HOMA-B · Elevated HbA1c',
  },
  SIRD: {
    code: 'SIRD',
    fullName: 'Severe Insulin-Resistant',
    color: '#D97706',
    tint: '#FFFBEB',
    focus: 'Elevated HOMA-IR · Fibrosis/MAFLD risk',
  },
  CIRDD: {
    code: 'CIRDD',
    fullName: 'Combined Insulin-Resistant & Deficient',
    color: '#BE185D',
    tint: '#FDF2F8',
    focus: 'Dual Insulin Resistance & Beta-Cell Deficit',
  },
  MARD: {
    code: 'MARD',
    fullName: 'Mild Age-Related',
    color: '#7C3AED',
    tint: '#F5F3FF',
    focus: 'Older age · Moderate dysglycemia',
  },
};

export interface PieSegment {
  name: ClusterCode;
  fullName: string;
  count: number;
  pct: number;
  exactPct: number;
  color: string;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  arcLength: number;
  circumference: number;
  dashOffset: number;
  popX: number;
  popY: number;
}

export function resolveOptionalPatientCluster(patient: PatientCRF): ClusterCode | null {
  const raw = patient.clusterType;
  if (raw === 'SIDD' || raw === 'SIRD' || raw === 'CIRDD' || raw === 'MARD') {
    return raw;
  }
  const suggested = patient.suggestedCluster;
  if (suggested === 'SIDD' || suggested === 'SIRD' || suggested === 'CIRDD' || suggested === 'MARD') {
    return suggested;
  }
  return null;
}

export function resolvePatientCluster(patient: PatientCRF): ClusterCode {
  return resolveOptionalPatientCluster(patient) ?? 'MARD';
}

export function buildPieSegments(patients: PatientCRF[], radius = 78): PieSegment[] {
  const counts: Record<ClusterCode, number> = { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 };
  let total = 0;
  for (const p of patients) {
    const c = resolveOptionalPatientCluster(p);
    if (c) {
      counts[c] += 1;
      total += 1;
    }
  }
  const circumference = 2 * Math.PI * radius;
  let runningFraction = 0;

  return (['SIDD', 'SIRD', 'CIRDD', 'MARD'] as ClusterCode[]).map((name) => {
    const count = counts[name];
    const fraction = total > 0 ? count / total : 0;
    const startAngle = runningFraction * 360 - 90;
    const endAngle = (runningFraction + fraction) * 360 - 90;
    const midAngle = (startAngle + endAngle) / 2;
    const midRad = (midAngle * Math.PI) / 180;
    const arcLength = fraction * circumference;
    const dashOffset = -runningFraction * circumference;
    runningFraction += fraction;

    return {
      name,
      fullName: CLUSTER_META[name].fullName,
      count,
      pct: total > 0 ? Math.round(fraction * 100) : 0,
      exactPct: total > 0 ? Number((fraction * 100).toFixed(1)) : 0,
      color: CLUSTER_META[name].color,
      startAngle,
      endAngle,
      midAngle,
      arcLength,
      circumference,
      dashOffset,
      popX: Number((Math.cos(midRad) * 6).toFixed(2)),
      popY: Number((Math.sin(midRad) * 6).toFixed(2)),
    };
  });
}

export type ScatterPairKey =
  | 'age-hba1c'
  | 'hb-hba1c'
  | 'bmi-homair'
  | 'hba1c-dhs'
  | 'dhs-dds'
  | 'lsm-bmi'
  | 'cap-tg';

export interface ScatterPoint {
  participantId: string;
  uhid: string;
  patientName: string;
  cluster: ClusterCode | 'Unassigned';
  color: string;
  x: number;
  y: number;
}

export interface ScatterPlotModel {
  key: ScatterPairKey;
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  points: ScatterPoint[];
  xDomain: [number, number];
  yDomain: [number, number];
  slope: number | null;
  intercept: number | null;
}

const SCATTER_CONFIG: Record<
  ScatterPairKey,
  {
    title: string;
    xLabel: string;
    yLabel: string;
    xUnit: string;
    yUnit: string;
    getX: (p: PatientCRF) => number | null;
    getY: (p: PatientCRF) => number | null;
  }
> = {
  'age-hba1c': {
    title: 'Age vs. Baseline HbA1c',
    xLabel: 'Age',
    yLabel: 'HbA1c',
    xUnit: 'yrs',
    yUnit: '%',
    getX: (p) => p.age,
    getY: (p) => p.hba1c1.value,
  },
  'hb-hba1c': {
    title: 'Hemoglobin vs. Baseline HbA1c',
    xLabel: 'Hemoglobin',
    yLabel: 'HbA1c',
    xUnit: 'g/dL',
    yUnit: '%',
    getX: (p) => p.hemoglobin.value,
    getY: (p) => p.hba1c1.value,
  },
  'bmi-homair': {
    title: 'BMI vs. HOMA-IR',
    xLabel: 'BMI',
    yLabel: 'HOMA-IR',
    xUnit: 'kg/m²',
    yUnit: 'idx',
    getX: (p) => p.bmi,
    getY: (p) => p.homaIR,
  },
  'hba1c-dhs': {
    title: 'HbA1c vs. Blue Index DHS',
    xLabel: 'HbA1c',
    yLabel: 'Blue Index DHS',
    xUnit: '%',
    yUnit: '/50',
    getX: (p) => p.hba1c1.value,
    getY: (p) => p.dhsTotal,
  },
  'dhs-dds': {
    title: 'Blue Index DHS vs. DDS-17 Mean Distress',
    xLabel: 'Blue Index DHS',
    yLabel: 'DDS-17 Mean',
    xUnit: '/50',
    yUnit: '/6',
    getX: (p) => p.dhsTotal,
    getY: (p) => p.ddsMean,
  },
  'lsm-bmi': {
    title: 'BMI vs. FibroScan LSM (Stiffness)',
    xLabel: 'BMI',
    yLabel: 'FibroScan LSM',
    xUnit: 'kg/m²',
    yUnit: 'kPa',
    getX: (p) => p.bmi,
    getY: (p) => p.lsmKpa,
  },
  'cap-tg': {
    title: 'Triglycerides vs. FibroScan CAP',
    xLabel: 'Triglycerides',
    yLabel: 'FibroScan CAP',
    xUnit: 'mg/dL',
    yUnit: 'dB/m',
    getX: (p) => p.triglycerides.value,
    getY: (p) => p.capDbm,
  },
};

export function buildScatterPlotModel(
  patients: PatientCRF[],
  key: ScatterPairKey
): ScatterPlotModel {
  const cfg = SCATTER_CONFIG[key];
  const points: ScatterPoint[] = [];

  for (const p of patients) {
    const x = cfg.getX(p);
    const y = cfg.getY(p);
    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      const clusterOpt = resolveOptionalPatientCluster(p);
      points.push({
        participantId: p.participantId,
        uhid: p.uhid,
        patientName: p.patientName,
        cluster: clusterOpt ?? 'Unassigned',
        color: clusterOpt ? CLUSTER_META[clusterOpt].color : '#94A89E',
        x,
        y,
      });
    }
  }

  if (points.length === 0) {
    return {
      key,
      title: cfg.title,
      xLabel: cfg.xLabel,
      yLabel: cfg.yLabel,
      xUnit: cfg.xUnit,
      yUnit: cfg.yUnit,
      points: [],
      xDomain: [0, 10],
      yDomain: [0, 10],
      slope: null,
      intercept: null,
    };
  }

  const xs = points.map((pt) => pt.x);
  const ys = points.map((pt) => pt.y);
  const rawXMin = Math.min(...xs);
  const rawXMax = Math.max(...xs);
  const rawYMin = Math.min(...ys);
  const rawYMax = Math.max(...ys);

  const xPad = rawXMax === rawXMin ? Math.max(1, rawXMax * 0.1) : (rawXMax - rawXMin) * 0.12;
  const yPad = rawYMax === rawYMin ? Math.max(1, rawYMax * 0.1) : (rawYMax - rawYMin) * 0.14;

  let slope: number | null = null;
  let intercept: number | null = null;
  if (points.length >= 2) {
    const meanX = xs.reduce((a, b) => a + b, 0) / points.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / points.length;
    let num = 0;
    let den = 0;
    for (const pt of points) {
      num += (pt.x - meanX) * (pt.y - meanY);
      den += (pt.x - meanX) * (pt.x - meanX);
    }
    if (den > 0) {
      slope = num / den;
      intercept = meanY - slope * meanX;
    }
  }

  return {
    key,
    title: cfg.title,
    xLabel: cfg.xLabel,
    yLabel: cfg.yLabel,
    xUnit: cfg.xUnit,
    yUnit: cfg.yUnit,
    points,
    xDomain: [Math.max(0, rawXMin - xPad), rawXMax + xPad],
    yDomain: [Math.max(0, rawYMin - yPad), rawYMax + yPad],
    slope,
    intercept,
  };
}

export interface RadarAxis {
  label: string;
  shortLabel: string;
  maxValue: number;
}

export interface RadarSeries {
  cluster: ClusterCode;
  color: string;
  hasData: boolean;
  normalizedValues: number[];
  rawValues: number[];
  polygonPoints: string;
}

export function buildRadarProfile(
  continuousTests: ContinuousTestResult[],
  center = 135,
  maxRadius = 92
): { axes: RadarAxis[]; series: RadarSeries[] } {
  const axisSpecs: Array<{ variable: string; shortLabel: string }> = [
    { variable: 'HbA1c (%)', shortLabel: 'HbA1c' },
    { variable: 'BMI (kg/m²)', shortLabel: 'BMI' },
    { variable: 'HOMA-IR', shortLabel: 'HOMA-IR' },
    { variable: 'HOMA-B (%)', shortLabel: 'HOMA-B' },
    { variable: 'C-Peptide (ng/mL)', shortLabel: 'C-Peptide' },
    { variable: 'Blue Index DHS (/50)', shortLabel: 'DHS' },
  ];

  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];
  const axes: RadarAxis[] = axisSpecs.map((spec) => {
    const testRow = continuousTests.find((t) => t.variable === spec.variable);
    const maxVal = testRow
      ? Math.max(
          ...testRow.groups.filter((g) => g.n > 0).map((g) => g.mean),
          1
        )
      : 1;
    return {
      label: spec.variable,
      shortLabel: spec.shortLabel,
      maxValue: Number(maxVal.toFixed(2)),
    };
  });

  const angleStep = (2 * Math.PI) / axes.length;

  const series: RadarSeries[] = clusters.map((cluster) => {
    const normalizedValues: number[] = [];
    const rawValues: number[] = [];
    let activeAxes = 0;

    axisSpecs.forEach((spec, idx) => {
      const testRow = continuousTests.find((t) => t.variable === spec.variable);
      const groupStat = testRow?.groups.find((g) => g.group === cluster);
      const raw = groupStat && groupStat.n > 0 ? groupStat.mean : 0;
      if (groupStat && groupStat.n > 0) activeAxes += 1;
      rawValues.push(raw);
      const scaleMax = axes[idx].maxValue || 1;
      normalizedValues.push(Math.max(0.08, Math.min(1, raw / scaleMax)));
    });

    const polygonPoints = normalizedValues
      .map((val, idx) => {
        const angle = idx * angleStep - Math.PI / 2;
        const r = val * maxRadius;
        const x = center + Math.cos(angle) * r;
        const y = center + Math.sin(angle) * r;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return {
      cluster,
      color: CLUSTER_META[cluster].color,
      hasData: activeAxes > 0,
      normalizedValues,
      rawValues,
      polygonPoints,
    };
  });

  return { axes, series };
}

export interface StudyOverviewKpis {
  totalPatients: number;
  significantParamsCount: number;
  totalTestedParams: number;
  meanHba1c: string;
  meanDhs: string;
  dominantCluster: { code: ClusterCode; pct: number } | null;
}

export function buildStudyOverviewKpis(
  patients: PatientCRF[],
  continuousTests: ContinuousTestResult[],
  categoricalTests: CategoricalTestResult[],
  pieSegments: PieSegment[]
): StudyOverviewKpis {
  const sigCont = continuousTests.filter(
    (t) =>
      (t.anovaP !== null && t.anovaP < 0.05) ||
      (t.kruskalP !== null && t.kruskalP < 0.05)
  ).length;
  const sigCat = categoricalTests.filter((t) => t.pValue !== null && t.pValue < 0.05).length;

  const hba1cs = patients
    .map((p) => p.hba1c1.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const dhsVals = patients
    .map((p) => p.dhsTotal)
    .filter((v): v is number => v !== null && Number.isFinite(v));

  const meanHba1c =
    hba1cs.length > 0
      ? `${(hba1cs.reduce((a, b) => a + b, 0) / hba1cs.length).toFixed(2)}%`
      : '—';
  const meanDhs =
    dhsVals.length > 0
      ? `${(dhsVals.reduce((a, b) => a + b, 0) / dhsVals.length).toFixed(1)}/50`
      : '—';

  const topSeg = [...pieSegments].sort((a, b) => b.count - a.count)[0];
  const dominantCluster =
    topSeg && topSeg.count > 0 ? { code: topSeg.name, pct: topSeg.pct } : null;

  return {
    totalPatients: patients.length,
    significantParamsCount: sigCont + sigCat,
    totalTestedParams: continuousTests.length + categoricalTests.length,
    meanHba1c,
    meanDhs,
    dominantCluster,
  };
}
