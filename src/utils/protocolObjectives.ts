import type { PatientCRF } from '../types/clinical';
import { computeDrugUtilizationEvaluation } from './drugUtilization';
import {
  analyzeCategoricalAcrossGroups,
  analyzeCorrelation,
  type CorrelationResult,
} from './statistics';
import { resolveOptionalPatientCluster, type ClusterCode } from './statisticalCharts';

export type PredefinedAgeBand =
  | '18–25'
  | '26–35'
  | '36–45'
  | '46–55'
  | '56–65'
  | '66–75'
  | 'Other (<18 / >75)';

export const PROTOCOL_AGE_BANDS: PredefinedAgeBand[] = [
  '18–25',
  '26–35',
  '36–45',
  '46–55',
  '56–65',
  '66–75',
];

export function classifyProtocolAgeBand(age: number | null): PredefinedAgeBand | null {
  if (age === null || !Number.isFinite(age)) return null;
  if (age >= 18 && age <= 25) return '18–25';
  if (age >= 26 && age <= 35) return '26–35';
  if (age >= 36 && age <= 45) return '36–45';
  if (age >= 46 && age <= 55) return '46–55';
  if (age >= 56 && age <= 65) return '56–65';
  if (age >= 66 && age <= 75) return '66–75';
  return 'Other (<18 / >75)';
}

export interface AgeBandAnalysisRow {
  band: PredefinedAgeBand;
  count: number;
  pct: number;
  clusters: Record<ClusterCode, number>;
  meanHba1c: number | null;
  meanDhs: number | null;
  excellentDhsPct: number | null;
  undesirableDhsPct: number | null;
  meanDdsMean: number | null;
  distressModHighPct: number | null;
  meanKsTotal: number | null;
  microvascularPct: number | null;
  macrovascularPct: number | null;
}

export interface ProtocolObjectiveStatus {
  number: number;
  title: string;
  targetSection: 'objectives' | 'due' | 'charts' | 'parametric' | 'categorical';
  sectionLabel: string;
  sampleCoverage: string;
  liveFinding: string;
}

export interface ProtocolObjectivesReport {
  ageBands: AgeBandAnalysisRow[];
  ageClusterChiSquare: { chiSquare: number | null; df: number; pValue: number | null };
  ageDhsChiSquare: { chiSquare: number | null; df: number; pValue: number | null };
  objectiveCorrelations: CorrelationResult[];
  objectivesMatrix: ProtocolObjectiveStatus[];
}

export function buildProtocolObjectivesReport(
  patients: PatientCRF[]
): ProtocolObjectivesReport {
  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];
  const bandPatients = new Map<PredefinedAgeBand, PatientCRF[]>();
  for (const b of PROTOCOL_AGE_BANDS) {
    bandPatients.set(b, []);
  }
  const extraBand: PatientCRF[] = [];

  for (const p of patients) {
    const band = classifyProtocolAgeBand(p.age);
    if (!band) continue;
    if (band === 'Other (<18 / >75)') {
      extraBand.push(p);
    } else {
      bandPatients.get(band)!.push(p);
    }
  }

  const activeBands: PredefinedAgeBand[] =
    extraBand.length > 0 ? [...PROTOCOL_AGE_BANDS, 'Other (<18 / >75)'] : [...PROTOCOL_AGE_BANDS];
  if (extraBand.length > 0) {
    bandPatients.set('Other (<18 / >75)', extraBand);
  }

  const totalWithAge = patients.filter((p) => p.age !== null && Number.isFinite(p.age)).length;
  const ageClusterCounts: Record<string, Record<string, number>> = {};
  const ageDhsCounts: Record<string, Record<string, number>> = {};

  const avgOrNull = (arr: Array<number | null>): number | null => {
    const valid = arr.filter((v): v is number => v !== null && Number.isFinite(v));
    if (valid.length === 0) return null;
    return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2));
  };

  const ageBands: AgeBandAnalysisRow[] = activeBands.map((band) => {
    const list = bandPatients.get(band) || [];
    const clusterMap: Record<ClusterCode, number> = { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 };
    for (const p of list) {
      const c = resolveOptionalPatientCluster(p);
      if (c) clusterMap[c] += 1;
    }

    ageClusterCounts[band] = { ...clusterMap };
    ageDhsCounts[band] = {
      'Excellent Status': list.filter((p) => p.dhsCategory === 'Excellent Status').length,
      'Moderate Status': list.filter((p) => p.dhsCategory === 'Moderate Status').length,
      'Undesirable Status': list.filter((p) => p.dhsCategory === 'Undesirable Status').length,
    };

    const withDhsCat = list.filter((p) => Boolean(p.dhsCategory));
    const withDds = list.filter((p) => p.ddsMean !== null);
    const withMicro = list.filter((p) => p.ksMicrovascular !== null);
    const withMacro = list.filter((p) => p.ksMacrovascular !== null);

    return {
      band,
      count: list.length,
      pct: totalWithAge > 0 ? Number(((list.length / totalWithAge) * 100).toFixed(1)) : 0,
      clusters: clusterMap,
      meanHba1c: avgOrNull(list.map((p) => p.hba1c1.value)),
      meanDhs: avgOrNull(list.map((p) => p.dhsTotal)),
      excellentDhsPct:
        withDhsCat.length > 0
          ? Math.round(
              (withDhsCat.filter((p) => p.dhsCategory === 'Excellent Status').length /
                withDhsCat.length) *
                100
            )
          : null,
      undesirableDhsPct:
        withDhsCat.length > 0
          ? Math.round(
              (withDhsCat.filter((p) => p.dhsCategory === 'Undesirable Status').length /
                withDhsCat.length) *
                100
            )
          : null,
      meanDdsMean: avgOrNull(list.map((p) => p.ddsMean)),
      distressModHighPct:
        withDds.length > 0
          ? Math.round(
              (withDds.filter(
                (p) =>
                  p.ddsCategory === 'Moderate Distress' || p.ddsCategory === 'High Distress'
              ).length /
                withDds.length) *
                100
            )
          : null,
      meanKsTotal: avgOrNull(list.map((p) => p.ksTotal)),
      microvascularPct:
        withMicro.length > 0
          ? Math.round(
              (withMicro.filter((p) => (p.ksMicrovascular ?? 0) >= 2).length / withMicro.length) *
                100
            )
          : null,
      macrovascularPct:
        withMacro.length > 0
          ? Math.round(
              (withMacro.filter((p) => (p.ksMacrovascular ?? 0) >= 2).length / withMacro.length) *
                100
            )
          : null,
    };
  });

  const ageClusterChi = analyzeCategoricalAcrossGroups(
    'Age Band vs. Phenotypic Cluster',
    activeBands,
    clusters,
    ageClusterCounts
  );

  const ageDhsChi = analyzeCategoricalAcrossGroups(
    'Age Band vs. Blue Index DHS Status',
    activeBands,
    ['Excellent Status', 'Moderate Status', 'Undesirable Status'],
    ageDhsCounts
  );

  // Objectives 6 & 8 correlation pairs
  const pairExtract = (
    gx: (p: PatientCRF) => number | null,
    gy: (p: PatientCRF) => number | null
  ): Array<[number, number]> => {
    const pairs: Array<[number, number]> = [];
    for (const p of patients) {
      const x = gx(p);
      const y = gy(p);
      if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
        pairs.push([x, y]);
      }
    }
    return pairs;
  };

  const objectiveCorrelations: CorrelationResult[] = [
    analyzeCorrelation(
      'Blue Index DHS (/50) vs. DDS-17 Mean Distress (Obj 6)',
      pairExtract((p) => p.dhsTotal, (p) => p.ddsMean)
    ),
    analyzeCorrelation(
      'Blue Index DHS (/50) vs. Baseline HbA1c (%) (Obj 6)',
      pairExtract((p) => p.dhsTotal, (p) => p.hba1c1.value)
    ),
    analyzeCorrelation(
      'Blue Index DHS (/50) vs. Known Severity KS Total (Obj 6)',
      pairExtract((p) => p.dhsTotal, (p) => p.ksTotal)
    ),
    analyzeCorrelation(
      'DDS-17 Mean Distress vs. Baseline HbA1c (%) (Obj 6)',
      pairExtract((p) => p.ddsMean, (p) => p.hba1c1.value)
    ),
    analyzeCorrelation(
      'DDS-17 Mean Distress vs. Known Severity KS Total (Obj 6)',
      pairExtract((p) => p.ddsMean, (p) => p.ksTotal)
    ),
    analyzeCorrelation(
      'FibroScan LSM (kPa) vs. Baseline HbA1c (%) (Obj 8)',
      pairExtract((p) => p.lsmKpa, (p) => p.hba1c1.value)
    ),
    analyzeCorrelation(
      'FibroScan LSM (kPa) vs. BMI (kg/m²) (Obj 8)',
      pairExtract((p) => p.lsmKpa, (p) => p.bmi)
    ),
    analyzeCorrelation(
      'FibroScan CAP (dB/m) vs. Triglycerides (mg/dL) (Obj 8)',
      pairExtract((p) => p.capDbm, (p) => p.triglycerides.value)
    ),
    analyzeCorrelation(
      'FibroScan LSM (kPa) vs. Known Severity KS Total (Obj 8)',
      pairExtract((p) => p.lsmKpa, (p) => p.ksTotal)
    ),
  ];

  // Build concise live findings for all 12 E4 Secondary Objectives
  const due = computeDrugUtilizationEvaluation(patients);
  const peakBand = [...ageBands].sort((a, b) => b.count - a.count)[0];
  const meanHba1cAll = avgOrNull(patients.map((p) => p.hba1c1.value));
  const controlledCnt = patients.filter(
    (p) => (p.hba1c2.value ?? p.hba1c1.value ?? 99) < 7.0
  ).length;
  const microPresent = patients.filter((p) => (p.ksMicrovascular ?? 0) >= 2).length;
  const macroPresent = patients.filter((p) => (p.ksMacrovascular ?? 0) >= 2).length;
  const meanDhsAll = avgOrNull(patients.map((p) => p.dhsTotal));
  const meanDdsAll = avgOrNull(patients.map((p) => p.ddsMean));
  const highModDistress = patients.filter(
    (p) => p.ddsCategory === 'Moderate Distress' || p.ddsCategory === 'High Distress'
  ).length;
  const fibroEvaluated = patients.filter((p) => p.lsmKpa !== null || p.capDbm !== null);
  const sigFibrosis = fibroEvaluated.filter(
    (p) => p.fibrosisInterpretation && p.fibrosisInterpretation !== 'F0-F1'
  ).length;
  const topClass = due.classMatrix[0];
  const dhsHba1cCorr = objectiveCorrelations[1];
  const lsmBmiCorr = objectiveCorrelations[6];

  const objectivesMatrix: ProtocolObjectiveStatus[] = [
    {
      number: 1,
      title: 'Phenotypic cluster distribution across predefined age groups (18–75 yrs)',
      targetSection: 'objectives',
      sectionLabel: 'Age-Group Analysis',
      sampleCoverage: `${totalWithAge}/${patients.length} with age`,
      liveFinding:
        peakBand && peakBand.count > 0
          ? `Peak cohort band: ${peakBand.band} yrs (${peakBand.count} pts, ${peakBand.pct}%)`
          : 'No age data recorded yet',
    },
    {
      number: 2,
      title: 'Phenotypic clusters & glycemic control (HbA1c)',
      targetSection: 'parametric',
      sectionLabel: 'ANOVA & Kruskal',
      sampleCoverage: `${patients.filter((p) => p.hba1c1.value !== null).length}/${patients.length} HbA1c`,
      liveFinding: `Mean baseline HbA1c ${meanHba1cAll ?? '—'}% · ${controlledCnt}/${patients.length} < 7.0%`,
    },
    {
      number: 3,
      title: 'Phenotypic clusters & microvascular / macrovascular complications',
      targetSection: 'categorical',
      sectionLabel: 'Chi-Square & Risks',
      sampleCoverage: `${patients.filter((p) => p.ksTotal !== null).length}/${patients.length} KS scored`,
      liveFinding: `Microvascular (KS≥2): ${microPresent}/${patients.length} · Macrovascular: ${macroPresent}/${patients.length}`,
    },
    {
      number: 4,
      title: 'Blue Index Diabetic Health Status (DHS) score & distribution across clusters',
      targetSection: 'charts',
      sectionLabel: 'Visual Charts',
      sampleCoverage: `${patients.filter((p) => p.dhsTotal !== null).length}/${patients.length} DHS`,
      liveFinding: `Mean Blue Index DHS ${meanDhsAll ?? '—'}/50 across 4 clusters`,
    },
    {
      number: 5,
      title: 'Diabetes Distress Scale-17 (overall & 4 domain scores across clusters)',
      targetSection: 'parametric',
      sectionLabel: 'ANOVA & Kruskal',
      sampleCoverage: `${patients.filter((p) => p.ddsMean !== null).length}/${patients.length} DDS-17`,
      liveFinding: `Mean DDS-17 ${meanDdsAll ?? '—'}/6 · ${highModDistress} with Moderate/High distress`,
    },
    {
      number: 6,
      title: 'Relationship: Blue Index, DDS-17, glycemic control & complications',
      targetSection: 'objectives',
      sectionLabel: 'Correlation Matrix',
      sampleCoverage: `${dhsHba1cCorr.n} paired`,
      liveFinding:
        dhsHba1cCorr.pearsonR !== null
          ? `DHS vs HbA1c r=${dhsHba1cCorr.pearsonR} (p=${dhsHba1cCorr.pearsonP ?? '—'})`
          : 'Need ≥3 paired records',
    },
    {
      number: 7,
      title: 'Phenotypic clusters & FibroScan hepatic fibrosis (LSM) & steatosis (CAP)',
      targetSection: 'parametric',
      sectionLabel: 'ANOVA & Kruskal',
      sampleCoverage: `${fibroEvaluated.length}/${patients.length} scanned`,
      liveFinding: `${sigFibrosis}/${fibroEvaluated.length} with significant fibrosis (F2–F4)`,
    },
    {
      number: 8,
      title: 'FibroScan parameters vs. glycemic, anthropometric, metabolic & complications',
      targetSection: 'objectives',
      sectionLabel: 'Correlation Matrix',
      sampleCoverage: `${lsmBmiCorr.n} paired`,
      liveFinding:
        lsmBmiCorr.pearsonR !== null
          ? `LSM vs BMI r=${lsmBmiCorr.pearsonR} (p=${lsmBmiCorr.pearsonP ?? '—'})`
          : 'Need ≥3 FibroScan records',
    },
    {
      number: 9,
      title: 'Antidiabetic medication utilization patterns across phenotypic clusters',
      targetSection: 'due',
      sectionLabel: 'Drug Utilisation (DUE)',
      sampleCoverage: `${due.indicators.totalActiveAntidiabeticPrescriptions} active Rx`,
      liveFinding: topClass
        ? `Lead class: ${topClass.drugClass} (${topClass.totalPct}% of cohort)`
        : 'No medications recorded',
    },
    {
      number: 10,
      title: 'Treatment complexity, glycemic control & phenotypic clusters',
      targetSection: 'due',
      sectionLabel: 'Drug Utilisation (DUE)',
      sampleCoverage: `${due.indicators.meanAntidiabeticsPerPatient} OAD/Ins per pt`,
      liveFinding: `Dual ${due.indicators.dualTherapyRatePct}% · Triple+ ${due.indicators.triplePlusRatePct}% · Insulin ${due.indicators.insulinUtilizationPct}%`,
    },
    {
      number: 11,
      title: 'Phenotypic clusters & BMI, waist circumference, TG, HDL-C, C-peptide',
      targetSection: 'parametric',
      sectionLabel: 'ANOVA & Kruskal',
      sampleCoverage: `${patients.filter((p) => p.cPeptide.value !== null).length}/${patients.length} C-pep`,
      liveFinding: 'All 5 anthropometric & lipid/C-peptide endpoints included in ANOVA/Kruskal',
    },
    {
      number: 12,
      title: 'Age-wise clusters, Blue Index, diabetes distress & complication burden',
      targetSection: 'objectives',
      sectionLabel: 'Age-Group Analysis',
      sampleCoverage: `${totalWithAge}/${patients.length} age-stratified`,
      liveFinding: `6 predefined adult strata (18–25 through 66–75 yrs) evaluated`,
    },
  ];

  return {
    ageBands,
    ageClusterChiSquare: {
      chiSquare: ageClusterChi.chiSquare,
      df: ageClusterChi.df,
      pValue: ageClusterChi.pValue,
    },
    ageDhsChiSquare: {
      chiSquare: ageDhsChi.chiSquare,
      df: ageDhsChi.df,
      pValue: ageDhsChi.pValue,
    },
    objectiveCorrelations,
    objectivesMatrix,
  };
}
