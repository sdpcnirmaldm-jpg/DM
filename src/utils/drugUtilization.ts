import type { MedicationRow, PatientCRF } from '../types/clinical';
import { analyzeCategoricalAcrossGroups } from './statistics';
import { CLUSTER_META, resolveOptionalPatientCluster, type ClusterCode } from './statisticalCharts';

export type AntidiabeticClass =
  | 'Biguanides'
  | 'Sulfonylureas'
  | 'SGLT2 Inhibitors'
  | 'DPP-4 Inhibitors'
  | 'Thiazolidinediones'
  | 'Alpha-Glucosidase Inhibitors'
  | 'GLP-1 Receptor Agonists'
  | 'Insulin Therapy'
  | 'Other Antidiabetic';

export type ConcomitantClass =
  | 'Statins'
  | 'Antihypertensives'
  | 'Antiplatelets'
  | 'Neuropathy Agents'
  | 'Other Concomitant';

export type RegimenComplexityTier =
  | 'No Antidiabetic Rx'
  | 'Monotherapy'
  | 'Dual Therapy'
  | 'Triple+ Therapy'
  | 'Insulin-Containing';

export const ANTIDIABETIC_CLASSES: AntidiabeticClass[] = [
  'Biguanides',
  'Sulfonylureas',
  'SGLT2 Inhibitors',
  'DPP-4 Inhibitors',
  'Thiazolidinediones',
  'Alpha-Glucosidase Inhibitors',
  'GLP-1 Receptor Agonists',
  'Insulin Therapy',
  'Other Antidiabetic',
];

export const COMPLEXITY_TIERS: RegimenComplexityTier[] = [
  'No Antidiabetic Rx',
  'Monotherapy',
  'Dual Therapy',
  'Triple+ Therapy',
  'Insulin-Containing',
];

const CLASS_RULES: Array<{ cls: AntidiabeticClass; keywords: string[] }> = [
  {
    cls: 'Biguanides',
    keywords: ['metformin', 'glycomet', 'glucophage', 'obimet', 'biguanide'],
  },
  {
    cls: 'Sulfonylureas',
    keywords: [
      'glimepiride',
      'gliclazide',
      'glipizide',
      'glibenclamide',
      'glyburide',
      'amaryl',
      'diamicron',
      'glimi',
      'sulfonylurea',
    ],
  },
  {
    cls: 'SGLT2 Inhibitors',
    keywords: [
      'dapagliflozin',
      'empagliflozin',
      'canagliflozin',
      'remogliflozin',
      'ertugliflozin',
      'forxiga',
      'jardiance',
      'udapa',
      'sglt2',
    ],
  },
  {
    cls: 'DPP-4 Inhibitors',
    keywords: [
      'sitagliptin',
      'vildagliptin',
      'teneligliptin',
      'linagliptin',
      'saxagliptin',
      'alogliptin',
      'evogliptin',
      'januvia',
      'galvus',
      'trajenta',
      'dpp4',
      'dpp-4',
    ],
  },
  {
    cls: 'Thiazolidinediones',
    keywords: ['pioglitazone', 'rosiglitazone', 'lobeglitazone', 'tzd', 'pioglit'],
  },
  {
    cls: 'Alpha-Glucosidase Inhibitors',
    keywords: ['voglibose', 'acarbose', 'miglitol', 'vogliboz', 'glucobay'],
  },
  {
    cls: 'GLP-1 Receptor Agonists',
    keywords: [
      'semaglutide',
      'liraglutide',
      'dulaglutide',
      'tirzepatide',
      'exenatide',
      'rybelsus',
      'ozempic',
      'victoza',
      'trulicity',
      'mounjaro',
      'glp-1',
      'glp1',
    ],
  },
  {
    cls: 'Insulin Therapy',
    keywords: [
      'insulin',
      'glargine',
      'degludec',
      'detemir',
      'aspart',
      'lispro',
      'glulisine',
      'premix',
      'mixtard',
      'novomix',
      'lantus',
      'tresiba',
      'toujeo',
      'humalog',
      'novorapid',
      'actrapid',
      'nph',
      'ryzodeg',
    ],
  },
];

const CONCOMITANT_RULES: Array<{ cls: ConcomitantClass; keywords: string[] }> = [
  {
    cls: 'Statins',
    keywords: ['statin', 'rosuvastatin', 'atorvastatin', 'simvastatin', 'pravastatin', 'pitavastatin'],
  },
  {
    cls: 'Antihypertensives',
    keywords: [
      'telmisartan',
      'losartan',
      'olmesartan',
      'valsartan',
      'irbesartan',
      'amlodipine',
      'cilnidipine',
      'nifedipine',
      'ramipril',
      'enalapril',
      'lisinopril',
      'perindopril',
      'metoprolol',
      'bisoprolol',
      'nebivolol',
      'atenolol',
      'hydrochlorothiazide',
      'chlorthalidone',
      'furosemide',
      'spironolactone',
    ],
  },
  {
    cls: 'Antiplatelets',
    keywords: ['aspirin', 'ecosprin', 'clopidogrel', 'ticagrelor', 'prasugrel'],
  },
  {
    cls: 'Neuropathy Agents',
    keywords: [
      'pregabalin',
      'gabapentin',
      'methylcobalamin',
      'mecobalamin',
      'duloxetine',
      'amitriptyline',
      'alpha lipoic',
      'thiamine',
    ],
  },
];

/** Classify an antidiabetic drug string (handles single agents and FDCs split on '+' or '/') */
export function classifyAntidiabeticDrug(drugName: string): {
  classes: AntidiabeticClass[];
  isFdc: boolean;
  isInsulin: boolean;
} {
  const clean = drugName.trim().toLowerCase();
  if (!clean) {
    return { classes: [], isFdc: false, isInsulin: false };
  }

  const parts = clean
    .split(/[+/&,]|\bwith\b/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const matched = new Set<AntidiabeticClass>();
  for (const part of parts) {
    for (const rule of CLASS_RULES) {
      if (rule.keywords.some((kw) => part.includes(kw))) {
        matched.add(rule.cls);
      }
    }
  }

  if (matched.size === 0) {
    for (const rule of CLASS_RULES) {
      if (rule.keywords.some((kw) => clean.includes(kw))) {
        matched.add(rule.cls);
      }
    }
  }

  if (matched.size === 0) {
    matched.add('Other Antidiabetic');
  }

  const classes = Array.from(matched);
  const isFdc = parts.length > 1 || classes.length > 1;
  const isInsulin = classes.includes('Insulin Therapy');
  return { classes, isFdc, isInsulin };
}

export function classifyConcomitantDrug(drugName: string): ConcomitantClass {
  const clean = drugName.trim().toLowerCase();
  for (const rule of CONCOMITANT_RULES) {
    if (rule.keywords.some((kw) => clean.includes(kw))) {
      return rule.cls;
    }
  }
  return 'Other Concomitant';
}

/** Extract the active antidiabetic regimen rows for a patient (latest visit block with active drugs) */
export function getActiveAntidiabeticDrugs(patient: PatientCRF): MedicationRow[] {
  const visits = patient.medicationVisits || [];
  for (let i = visits.length - 1; i >= 0; i--) {
    const active = (visits[i].drugs || []).filter(
      (d) => d.drugName.trim() !== '' && d.status !== 'Disc.'
    );
    if (active.length > 0) return active;
  }
  return [];
}

/** Classify patient's treatment complexity tier (Objective 10) */
export function classifyRegimenComplexity(patient: PatientCRF): RegimenComplexityTier {
  const activeDrugs = getActiveAntidiabeticDrugs(patient);
  if (activeDrugs.length === 0) return 'No Antidiabetic Rx';

  let hasInsulin = false;
  let componentCount = 0;
  for (const row of activeDrugs) {
    const info = classifyAntidiabeticDrug(row.drugName);
    if (info.isInsulin) hasInsulin = true;
    componentCount += Math.max(1, info.classes.length);
  }

  if (hasInsulin) return 'Insulin-Containing';
  if (componentCount === 1) return 'Monotherapy';
  if (componentCount === 2) return 'Dual Therapy';
  return 'Triple+ Therapy';
}

export interface WhoPrescribingIndicators {
  totalPatients: number;
  totalActiveAntidiabeticPrescriptions: number;
  totalActiveAllPrescriptions: number;
  meanAntidiabeticsPerPatient: number;
  meanTotalDrugsPerPatient: number;
  monotherapyRatePct: number;
  dualTherapyRatePct: number;
  triplePlusRatePct: number;
  insulinUtilizationPct: number;
  fdcUtilizationPct: number;
  polypharmacyRatePct: number; // >= 3 antidiabetics OR >= 5 total drugs
  oralOnlyRatePct: number;
  injectableRatePct: number;
  statinCoRxPct: number;
  antiHtnCoRxPct: number;
}

export interface DrugClassClusterRow {
  drugClass: AntidiabeticClass;
  totalPatients: number;
  totalPct: number;
  prescriptionCount: number;
  byCluster: Record<ClusterCode, { count: number; total: number; pct: number }>;
  pValue: number | null;
}

export interface ComplexityClusterSummary {
  tier: RegimenComplexityTier;
  count: number;
  pct: number;
  byCluster: Record<ClusterCode, { count: number; total: number; pct: number }>;
  meanBaselineHba1c: number | null;
  meanFollowupHba1c: number | null;
  meanHba1cReduction: number | null;
  controlledPct: number | null; // HbA1c < 7.0% (latest available HbA1c)
}

export interface IndividualDrugUsageRow {
  drugName: string;
  drugClass: AntidiabeticClass;
  patientCount: number;
  patientPct: number;
  topDoses: string;
  commonRoute: string;
  commonFrequency: string;
  meanPatientHba1c: number | null;
  clustersUsed: ClusterCode[];
}

export interface ConcomitantCategorySummary {
  category: ConcomitantClass;
  patientCount: number;
  patientPct: number;
  topAgents: string;
}

export interface DrugUtilizationReport {
  indicators: WhoPrescribingIndicators;
  clusterTotals: Record<ClusterCode, number>;
  classMatrix: DrugClassClusterRow[];
  complexityRows: ComplexityClusterSummary[];
  complexityChiSquare: { chiSquare: number | null; df: number; pValue: number | null };
  topDrugs: IndividualDrugUsageRow[];
  concomitantSummary: ConcomitantCategorySummary[];
}

export function computeDrugUtilizationEvaluation(
  patients: PatientCRF[]
): DrugUtilizationReport {
  const clusters: ClusterCode[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];
  const clusterTotals: Record<ClusterCode, number> = { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 };
  for (const p of patients) {
    const c = resolveOptionalPatientCluster(p);
    if (c) clusterTotals[c] += 1;
  }

  let totalAntidiabeticRx = 0;
  let totalAllRx = 0;
  let monoCount = 0;
  let dualCount = 0;
  let triplePlusCount = 0;
  let insulinPatients = 0;
  let fdcPatients = 0;
  let polypharmacyPatients = 0;
  let oralOnlyPatients = 0;
  let injectablePatients = 0;
  let statinPatients = 0;
  let antiHtnPatients = 0;

  const classPatients: Record<AntidiabeticClass, Set<string>> = {
    Biguanides: new Set(),
    Sulfonylureas: new Set(),
    'SGLT2 Inhibitors': new Set(),
    'DPP-4 Inhibitors': new Set(),
    Thiazolidinediones: new Set(),
    'Alpha-Glucosidase Inhibitors': new Set(),
    'GLP-1 Receptor Agonists': new Set(),
    'Insulin Therapy': new Set(),
    'Other Antidiabetic': new Set(),
  };

  const classClusterCounts: Record<AntidiabeticClass, Record<ClusterCode, number>> = {
    Biguanides: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    Sulfonylureas: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'SGLT2 Inhibitors': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'DPP-4 Inhibitors': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    Thiazolidinediones: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'Alpha-Glucosidase Inhibitors': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'GLP-1 Receptor Agonists': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'Insulin Therapy': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
    'Other Antidiabetic': { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 },
  };

  const classRxCounts: Record<AntidiabeticClass, number> = {
    Biguanides: 0,
    Sulfonylureas: 0,
    'SGLT2 Inhibitors': 0,
    'DPP-4 Inhibitors': 0,
    Thiazolidinediones: 0,
    'Alpha-Glucosidase Inhibitors': 0,
    'GLP-1 Receptor Agonists': 0,
    'Insulin Therapy': 0,
    'Other Antidiabetic': 0,
  };

  const complexityBuckets: Record<
    RegimenComplexityTier,
    {
      patients: PatientCRF[];
      byCluster: Record<ClusterCode, number>;
    }
  > = {
    'No Antidiabetic Rx': { patients: [], byCluster: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 } },
    Monotherapy: { patients: [], byCluster: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 } },
    'Dual Therapy': { patients: [], byCluster: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 } },
    'Triple+ Therapy': { patients: [], byCluster: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 } },
    'Insulin-Containing': { patients: [], byCluster: { SIDD: 0, SIRD: 0, CIRDD: 0, MARD: 0 } },
  };

  const drugAccumulator = new Map<
    string,
    {
      displayName: string;
      drugClass: AntidiabeticClass;
      patientIds: Set<string>;
      doses: Map<string, number>;
      routes: Map<string, number>;
      frequencies: Map<string, number>;
      hba1cs: number[];
      clusters: Set<ClusterCode>;
    }
  >();

  const concomitantBuckets: Record<
    ConcomitantClass,
    { patientIds: Set<string>; agents: Map<string, number> }
  > = {
    Statins: { patientIds: new Set(), agents: new Map() },
    Antihypertensives: { patientIds: new Set(), agents: new Map() },
    Antiplatelets: { patientIds: new Set(), agents: new Map() },
    'Neuropathy Agents': { patientIds: new Set(), agents: new Map() },
    'Other Concomitant': { patientIds: new Set(), agents: new Map() },
  };

  for (let idx = 0; idx < patients.length; idx++) {
    const p = patients[idx];
    const pid = p.participantId || `row-${p.id ?? idx}`;
    const cluster = resolveOptionalPatientCluster(p);
    const activeAntidiabetics = getActiveAntidiabeticDrugs(p);
    const activeOther = (p.otherMedications || []).filter(
      (m) => m.drugName.trim() !== '' && m.status !== 'Disc.'
    );

    totalAntidiabeticRx += activeAntidiabetics.length;
    totalAllRx += activeAntidiabetics.length + activeOther.length;

    const complexity = classifyRegimenComplexity(p);
    complexityBuckets[complexity].patients.push(p);
    if (cluster) {
      complexityBuckets[complexity].byCluster[cluster] += 1;
    }

    if (complexity === 'Monotherapy') monoCount += 1;
    if (complexity === 'Dual Therapy') dualCount += 1;
    if (complexity === 'Triple+ Therapy') triplePlusCount += 1;
    if (complexity === 'Insulin-Containing') insulinPatients += 1;

    let patientHasFdc = false;
    let patientHasInjectable = false;
    const patientClasses = new Set<AntidiabeticClass>();

    for (const row of activeAntidiabetics) {
      const info = classifyAntidiabeticDrug(row.drugName);
      if (info.isFdc) patientHasFdc = true;
      if (row.route === 'SC' || row.route === 'IV' || info.isInsulin) {
        patientHasInjectable = true;
      }

      for (const cls of info.classes) {
        patientClasses.add(cls);
        classRxCounts[cls] += 1;
      }

      const normKey = row.drugName.trim().toLowerCase();
      const existing = drugAccumulator.get(normKey) || {
        displayName: row.drugName.trim(),
        drugClass: info.classes[0] || 'Other Antidiabetic',
        patientIds: new Set<string>(),
        doses: new Map<string, number>(),
        routes: new Map<string, number>(),
        frequencies: new Map<string, number>(),
        hba1cs: [],
        clusters: new Set<ClusterCode>(),
      };
      if (!existing.patientIds.has(pid)) {
        existing.patientIds.add(pid);
        if (p.hba1c1.value !== null && Number.isFinite(p.hba1c1.value)) {
          existing.hba1cs.push(p.hba1c1.value);
        }
      }
      if (row.dose.trim()) {
        existing.doses.set(row.dose.trim(), (existing.doses.get(row.dose.trim()) || 0) + 1);
      }
      if (row.route.trim()) {
        existing.routes.set(row.route.trim(), (existing.routes.get(row.route.trim()) || 0) + 1);
      }
      if (row.frequency.trim()) {
        existing.frequencies.set(
          row.frequency.trim(),
          (existing.frequencies.get(row.frequency.trim()) || 0) + 1
        );
      }
      if (cluster) existing.clusters.add(cluster);
      drugAccumulator.set(normKey, existing);
    }

    for (const cls of patientClasses) {
      classPatients[cls].add(pid);
      if (cluster) classClusterCounts[cls][cluster] += 1;
    }

    if (patientHasFdc) fdcPatients += 1;
    if (patientHasInjectable) injectablePatients += 1;
    else if (activeAntidiabetics.length > 0) oralOnlyPatients += 1;

    if (
      activeAntidiabetics.length >= 3 ||
      activeAntidiabetics.length + activeOther.length >= 5
    ) {
      polypharmacyPatients += 1;
    }

    let hasStatin = p.onStatin;
    let hasAntiHtn = p.onAntiHtnMeds;

    for (const med of activeOther) {
      const cat = classifyConcomitantDrug(med.drugName);
      concomitantBuckets[cat].patientIds.add(pid);
      const label = med.drugName.trim();
      concomitantBuckets[cat].agents.set(
        label,
        (concomitantBuckets[cat].agents.get(label) || 0) + 1
      );
      if (cat === 'Statins') hasStatin = true;
      if (cat === 'Antihypertensives') hasAntiHtn = true;
    }

    if (hasStatin) {
      statinPatients += 1;
      concomitantBuckets.Statins.patientIds.add(pid);
    }
    if (hasAntiHtn) {
      antiHtnPatients += 1;
      concomitantBuckets.Antihypertensives.patientIds.add(pid);
    }
  }

  const n = patients.length;
  const pct = (count: number) => (n > 0 ? Number(((count / n) * 100).toFixed(1)) : 0);

  const indicators: WhoPrescribingIndicators = {
    totalPatients: n,
    totalActiveAntidiabeticPrescriptions: totalAntidiabeticRx,
    totalActiveAllPrescriptions: totalAllRx,
    meanAntidiabeticsPerPatient: n > 0 ? Number((totalAntidiabeticRx / n).toFixed(2)) : 0,
    meanTotalDrugsPerPatient: n > 0 ? Number((totalAllRx / n).toFixed(2)) : 0,
    monotherapyRatePct: pct(monoCount),
    dualTherapyRatePct: pct(dualCount),
    triplePlusRatePct: pct(triplePlusCount),
    insulinUtilizationPct: pct(insulinPatients),
    fdcUtilizationPct: pct(fdcPatients),
    polypharmacyRatePct: pct(polypharmacyPatients),
    oralOnlyRatePct: pct(oralOnlyPatients),
    injectableRatePct: pct(injectablePatients),
    statinCoRxPct: pct(statinPatients),
    antiHtnCoRxPct: pct(antiHtnPatients),
  };

  const classMatrix: DrugClassClusterRow[] = ANTIDIABETIC_CLASSES.map((cls) => {
    const totalCount = classPatients[cls].size;
    const byCluster = {} as Record<ClusterCode, { count: number; total: number; pct: number }>;
    const contingency: Record<string, Record<string, number>> = {};

    for (const c of clusters) {
      const cTotal = clusterTotals[c];
      const count = classClusterCounts[cls][c];
      byCluster[c] = {
        count,
        total: cTotal,
        pct: cTotal > 0 ? Math.round((count / cTotal) * 100) : 0,
      };
      contingency[c] = {
        Prescribed: count,
        'Not Prescribed': Math.max(0, cTotal - count),
      };
    }

    const chi = analyzeCategoricalAcrossGroups(
      cls,
      clusters,
      ['Prescribed', 'Not Prescribed'],
      contingency
    );

    return {
      drugClass: cls,
      totalPatients: totalCount,
      totalPct: pct(totalCount),
      prescriptionCount: classRxCounts[cls],
      byCluster,
      pValue: chi.pValue,
    };
  }).filter((row) => row.totalPatients > 0 || row.drugClass === 'Biguanides' || row.drugClass === 'Sulfonylureas' || row.drugClass === 'SGLT2 Inhibitors' || row.drugClass === 'DPP-4 Inhibitors' || row.drugClass === 'Insulin Therapy');

  const complexityContingency: Record<string, Record<string, number>> = {};
  for (const c of clusters) {
    complexityContingency[c] = {};
    for (const tier of COMPLEXITY_TIERS) {
      complexityContingency[c][tier] = complexityBuckets[tier].byCluster[c];
    }
  }
  const complexityChi = analyzeCategoricalAcrossGroups(
    'Treatment Complexity Tier',
    clusters,
    COMPLEXITY_TIERS,
    complexityContingency
  );

  const complexityRows: ComplexityClusterSummary[] = COMPLEXITY_TIERS.map((tier) => {
    const bucket = complexityBuckets[tier];
    const byCluster = {} as Record<ClusterCode, { count: number; total: number; pct: number }>;
    for (const c of clusters) {
      const cTotal = clusterTotals[c];
      const count = bucket.byCluster[c];
      byCluster[c] = {
        count,
        total: cTotal,
        pct: cTotal > 0 ? Math.round((count / cTotal) * 100) : 0,
      };
    }

    const baseVals = bucket.patients
      .map((p) => p.hba1c1.value)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const fuVals = bucket.patients
      .map((p) => p.hba1c2.value)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const pairedDeltas = bucket.patients
      .filter(
        (p) =>
          p.hba1c1.value !== null &&
          p.hba1c2.value !== null &&
          Number.isFinite(p.hba1c1.value) &&
          Number.isFinite(p.hba1c2.value)
      )
      .map((p) => Number(((p.hba1c1.value as number) - (p.hba1c2.value as number)).toFixed(2)));

    const latestVals = bucket.patients
      .map((p) => p.hba1c2.value ?? p.hba1c1.value)
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const controlledCount = latestVals.filter((v) => v < 7.0).length;

    return {
      tier,
      count: bucket.patients.length,
      pct: pct(bucket.patients.length),
      byCluster,
      meanBaselineHba1c:
        baseVals.length > 0
          ? Number((baseVals.reduce((a, b) => a + b, 0) / baseVals.length).toFixed(2))
          : null,
      meanFollowupHba1c:
        fuVals.length > 0
          ? Number((fuVals.reduce((a, b) => a + b, 0) / fuVals.length).toFixed(2))
          : null,
      meanHba1cReduction:
        pairedDeltas.length > 0
          ? Number((pairedDeltas.reduce((a, b) => a + b, 0) / pairedDeltas.length).toFixed(2))
          : null,
      controlledPct:
        latestVals.length > 0 ? Math.round((controlledCount / latestVals.length) * 100) : null,
    };
  });

  const topEntry = (map: Map<string, number>, fallback: string) => {
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || fallback;
  };

  const topDrugs: IndividualDrugUsageRow[] = Array.from(drugAccumulator.values())
    .sort((a, b) => b.patientIds.size - a.patientIds.size)
    .map((entry) => {
      const dosesList = Array.from(entry.doses.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([d]) => d)
        .join(', ');
      return {
        drugName: entry.displayName,
        drugClass: entry.drugClass,
        patientCount: entry.patientIds.size,
        patientPct: pct(entry.patientIds.size),
        topDoses: dosesList || '—',
        commonRoute: topEntry(entry.routes, '—'),
        commonFrequency: topEntry(entry.frequencies, '—'),
        meanPatientHba1c:
          entry.hba1cs.length > 0
            ? Number((entry.hba1cs.reduce((a, b) => a + b, 0) / entry.hba1cs.length).toFixed(2))
            : null,
        clustersUsed: clusters.filter((c) => entry.clusters.has(c)),
      };
    });

  const concomitantSummary: ConcomitantCategorySummary[] = (
    ['Statins', 'Antihypertensives', 'Antiplatelets', 'Neuropathy Agents', 'Other Concomitant'] as ConcomitantClass[]
  )
    .map((cat) => {
      const bucket = concomitantBuckets[cat];
      const topAgents = Array.from(bucket.agents.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, cnt]) => `${name} (${cnt})`)
        .join(', ');
      return {
        category: cat,
        patientCount: bucket.patientIds.size,
        patientPct: pct(bucket.patientIds.size),
        topAgents: topAgents || (cat === 'Statins' ? 'CRF Statin Flag' : cat === 'Antihypertensives' ? 'CRF Anti-HTN Flag' : '—'),
      };
    })
    .filter((row) => row.patientCount > 0 || row.category === 'Statins' || row.category === 'Antihypertensives');

  return {
    indicators,
    clusterTotals,
    classMatrix,
    complexityRows,
    complexityChiSquare: {
      chiSquare: complexityChi.chiSquare,
      df: complexityChi.df,
      pValue: complexityChi.pValue,
    },
    topDrugs,
    concomitantSummary,
  };
}

export { CLUSTER_META };
