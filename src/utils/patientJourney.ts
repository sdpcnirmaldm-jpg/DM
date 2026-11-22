import type { DHSDomains, MedicationRow, PatientCRF } from '../types/clinical';
import {
  evaluateMissingDataAndStatus,
  toGlucoseMgDl,
  toHba1cPercent,
  toLipidMgDl,
} from './clinicalMath';
import {
  classifyAntidiabeticDrug,
  classifyConcomitantDrug,
  type AntidiabeticClass,
  type ConcomitantClass,
} from './drugUtilization';
import { CLUSTER_META, resolveOptionalPatientCluster, type ClusterCode } from './statisticalCharts';

export interface GlycemicTrajectoryPoint {
  id: string;
  label: string;
  date: string;
  hba1cPct: number;
  kind: 'baseline' | 'visit' | 'followup';
}

export interface PatientTimelineEvent {
  id: string;
  date: string;
  phase: string;
  title: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
  status: 'completed' | 'upcoming' | 'pending';
}

export interface GlycemicFollowUpProjection {
  alreadyControlled: boolean;
  projectedHba1c: number;
  nodeHint: string;
  summaryCaption: string;
  timelineDetail: string;
}

export interface PatientGlycemicSummary {
  trajectoryPoints: GlycemicTrajectoryPoint[];
  timelineEvents: PatientTimelineEvent[];
  baselineHba1c: number | null;
  latestHba1c: number | null;
  deltaHba1c: number | null;
  pctChange: number | null;
  targetHba1c: number;
  followUpProjection: GlycemicFollowUpProjection;
  trendStatus:
    | 'Target Achieved (<7%)'
    | 'Improved'
    | 'Stable'
    | 'Worsened'
    | 'Baseline Only'
    | 'Pending';
}

export function resolveGlycemicFollowUpProjection(
  baselineHba1c: number | null,
  targetHba1c = 7.0
): GlycemicFollowUpProjection {
  const safeTarget = Number.isFinite(targetHba1c) && targetHba1c > 0 ? targetHba1c : 7.0;
  if (baselineHba1c !== null && baselineHba1c < safeTarget) {
    const roundedBaseline = Number(baselineHba1c.toFixed(1));
    return {
      alreadyControlled: true,
      projectedHba1c: roundedBaseline,
      nodeHint: `Maintain (<${safeTarget.toFixed(1)}%)`,
      summaryCaption: `Good control · Maintain <${safeTarget.toFixed(1)}%`,
      timelineDetail: `Baseline HbA1c (${roundedBaseline.toFixed(1)}%) is already well controlled (<${safeTarget.toFixed(1)}%); awaiting follow-up to confirm sustained control.`,
    };
  }
  return {
    alreadyControlled: false,
    projectedHba1c: Number(safeTarget.toFixed(1)),
    nodeHint: `Goal <${safeTarget.toFixed(1)}%`,
    summaryCaption: `Target <${safeTarget.toFixed(1)}%`,
    timelineDetail: `Awaiting follow-up HbA1c against target <${safeTarget.toFixed(1)}%.`,
  };
}

export type ProblemSeverity = 'critical' | 'moderate' | 'controlled';

export interface PatientClinicalProblem {
  id: string;
  system: string;
  title: string;
  severity: ProblemSeverity;
  severityScore: number; // 0..100 for animated severity bar
  reading: string;
  target: string;
  explanation: string;
}

export interface DrugLinkedMetric {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'neutral';
}

export interface PatientDrugHealthLink {
  id: string;
  category: 'Antidiabetic' | 'Concomitant';
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  status: 'Current' | 'Disc.' | '';
  visitDate?: string;
  classLabels: string[];
  isFdc: boolean;
  mechanism: string;
  patientHealthBenefit: string;
  targetOrgans: string[];
  linkedMetrics: DrugLinkedMetric[];
}

export interface BlueIndexDomainBar {
  key: keyof DHSDomains;
  code: string;
  label: string;
  score: number | null;
  pct: number;
  tone: 'good' | 'moderate' | 'poor';
}

export interface DdsSubscaleBar {
  key: string;
  label: string;
  score: number | null;
  pct: number;
  levelLabel: string;
  tone: 'good' | 'moderate' | 'poor';
}

const DHS_DOMAIN_LABELS: Array<{ key: keyof DHSDomains; label: string }> = [
  { key: 'A', label: 'Average Blood Sugar (HbA1c)' },
  { key: 'B', label: 'Blood Pressure Control' },
  { key: 'C', label: 'Lipid Profile (LDL / TG)' },
  { key: 'D', label: 'Diet Adherence' },
  { key: 'E', label: 'Exercise & Activity' },
  { key: 'F', label: 'Follow-up Regularity' },
  { key: 'G', label: 'General Health & Comorbidity' },
  { key: 'H', label: 'Habits (Tobacco / Alcohol)' },
  { key: 'I', label: 'Infection & Vaccination' },
  { key: 'J', label: 'Jeopardy (Hypoglycemia / ADR)' },
];

const ANTIDIABETIC_MECHANISMS: Record<
  AntidiabeticClass,
  { mechanism: string; organs: string[] }
> = {
  Biguanides: {
    mechanism:
      'Suppresses hepatic gluconeogenesis via AMPK activation and enhances peripheral glucose uptake without causing hypoglycemia.',
    organs: ['Liver', 'Skeletal Muscle', 'Glycemic Control'],
  },
  Sulfonylureas: {
    mechanism:
      'Closes pancreatic beta-cell K-ATP channels to stimulate endogenous insulin secretion and lower fasting/postprandial glucose.',
    organs: ['Pancreatic Beta-Cell', 'Glycemic Control'],
  },
  'SGLT2 Inhibitors': {
    mechanism:
      'Blocks proximal renal SGLT2 glucose reabsorption, driving urinary glucose excretion, natriuresis, and intraglomerular pressure relief.',
    organs: ['Kidneys', 'Heart / Cardiorenal', 'Glycemic Control'],
  },
  'DPP-4 Inhibitors': {
    mechanism:
      'Inhibits DPP-4 enzyme breakdown of GLP-1 and GIP incretins, boosting glucose-dependent insulin release and suppressing glucagon.',
    organs: ['Incretin Axis', 'Pancreatic Islets'],
  },
  Thiazolidinediones: {
    mechanism:
      'Activates nuclear PPAR-gamma receptors in adipose, hepatic, and muscle tissue to reverse insulin resistance and reduce hepatic fat.',
    organs: ['Adipose / Insulin Sensitivity', 'Liver (MASLD)'],
  },
  'Alpha-Glucosidase Inhibitors': {
    mechanism:
      'Delays intestinal brush-border carbohydrate digestion and absorption, blunting postprandial glucose spikes.',
    organs: ['GI Tract', 'Postprandial Glucose'],
  },
  'GLP-1 Receptor Agonists': {
    mechanism:
      'Mimics gut incretin GLP-1 to enhance glucose-dependent insulin secretion, slow gastric emptying, and promote satiety and weight loss.',
    organs: ['Pancreas', 'Heart & Vascular', 'Weight / Liver'],
  },
  'Insulin Therapy': {
    mechanism:
      'Directly replaces basal or prandial insulin deficit to restore cellular glucose uptake and suppress lipolysis and hepatic glucose output.',
    organs: ['Systemic Glucose Uptake', 'Beta-Cell Rest'],
  },
  'Other Antidiabetic': {
    mechanism: 'Supports glycemic regulation through complementary metabolic pathways.',
    organs: ['Glycemic Control'],
  },
};

const CONCOMITANT_MECHANISMS: Record<
  ConcomitantClass,
  { mechanism: string; organs: string[] }
> = {
  Statins: {
    mechanism:
      'Inhibits hepatic HMG-CoA reductase to upregulate LDL receptors, lowering atherogenic LDL/non-HDL cholesterol and stabilizing vascular plaque.',
    organs: ['Vascular Endothelium', 'Liver Lipids', 'Heart'],
  },
  Antihypertensives: {
    mechanism:
      'Reduces systemic arterial resistance and intraglomerular hypertension to protect coronary, cerebral, and renal microvasculature.',
    organs: ['Systemic Arteries', 'Renal Glomeruli', 'Heart'],
  },
  Antiplatelets: {
    mechanism:
      'Inhibits platelet aggregation to lower thrombotic macrovascular event risk in high-cardiovascular-risk diabetes.',
    organs: ['Coronary & Cerebral Arteries'],
  },
  'Neuropathy Agents': {
    mechanism:
      'Modulates nociceptive nerve signaling or supports peripheral myelin/axonal repair to relieve diabetic neuropathic pain and paresthesia.',
    organs: ['Peripheral Nerves', 'Lower Limbs'],
  },
  'Other Concomitant': {
    mechanism: 'Manages comorbid organ risk alongside primary diabetes therapy.',
    organs: ['Comorbid Organ Support'],
  },
};

export function buildPatientGlycemicTimeline(patient: PatientCRF): PatientGlycemicSummary {
  const targetHba1c = patient.hba1cTarget || 7.0;
  const baselineHba1c = toHba1cPercent(patient.hba1c1.value, patient.hba1c1.unit);
  const followUpHba1c = toHba1cPercent(patient.hba1c2.value, patient.hba1c2.unit);

  const trajectoryPoints: GlycemicTrajectoryPoint[] = [];
  if (baselineHba1c !== null) {
    trajectoryPoints.push({
      id: 'hba1c-1',
      label: 'Baseline HbA1c',
      date: patient.hba1c1.date || patient.dateOfRecruitment || 'Baseline',
      hba1cPct: Number(baselineHba1c.toFixed(1)),
      kind: 'baseline',
    });
  }

  for (let i = 0; i < (patient.medicationVisits || []).length; i++) {
    const visit = patient.medicationVisits[i];
    const parsed = Number.parseFloat(visit.hba1cAtVisit);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 25) continue;
    const visitDate = visit.visitDate || `Visit ${i + 1}`;
    const alreadyMatchesBaseline =
      baselineHba1c !== null &&
      Math.abs(parsed - baselineHba1c) < 0.05 &&
      visitDate === (patient.hba1c1.date || patient.dateOfRecruitment);
    const alreadyMatchesFollowUp =
      followUpHba1c !== null &&
      Math.abs(parsed - followUpHba1c) < 0.05 &&
      visitDate === patient.hba1c2.date;
    if (!alreadyMatchesBaseline && !alreadyMatchesFollowUp) {
      trajectoryPoints.push({
        id: `visit-hba1c-${visit.id || i}`,
        label: `Rx Visit ${i + 1}`,
        date: visitDate,
        hba1cPct: Number(parsed.toFixed(1)),
        kind: 'visit',
      });
    }
  }

  if (followUpHba1c !== null) {
    trajectoryPoints.push({
      id: 'hba1c-2',
      label: 'Follow-up HbA1c',
      date: patient.hba1c2.date || patient.followUpDate || 'Follow-up',
      hba1cPct: Number(followUpHba1c.toFixed(1)),
      kind: 'followup',
    });
  }

  const latestHba1c =
    trajectoryPoints.length > 0
      ? trajectoryPoints[trajectoryPoints.length - 1].hba1cPct
      : null;

  let deltaHba1c: number | null = null;
  let pctChange: number | null = null;
  if (baselineHba1c !== null && latestHba1c !== null && trajectoryPoints.length > 1) {
    deltaHba1c = Number((latestHba1c - baselineHba1c).toFixed(1));
    pctChange =
      baselineHba1c > 0
        ? Number((((latestHba1c - baselineHba1c) / baselineHba1c) * 100).toFixed(1))
        : null;
  }

  let trendStatus: PatientGlycemicSummary['trendStatus'] = 'Pending';
  if (baselineHba1c === null && latestHba1c === null) {
    trendStatus = 'Pending';
  } else if (latestHba1c !== null && latestHba1c < targetHba1c) {
    trendStatus = 'Target Achieved (<7%)';
  } else if (deltaHba1c !== null) {
    if (deltaHba1c <= -0.3) trendStatus = 'Improved';
    else if (deltaHba1c >= 0.3) trendStatus = 'Worsened';
    else trendStatus = 'Stable';
  } else if (baselineHba1c !== null) {
    trendStatus = 'Baseline Only';
  }

  const followUpProjection = resolveGlycemicFollowUpProjection(baselineHba1c, targetHba1c);

  const clusterCode: ClusterCode | null = resolveOptionalPatientCluster(patient);
  const timelineEvents: PatientTimelineEvent[] = [];

  if (patient.diagnosisMonthYear.trim()) {
    const durParts: string[] = [];
    if (patient.durationYears !== null) durParts.push(`${patient.durationYears}y`);
    if (patient.durationMonths !== null) durParts.push(`${patient.durationMonths}m`);
    timelineEvents.push({
      id: 'ev-diagnosis',
      date: patient.diagnosisMonthYear,
      phase: 'Onset',
      title: 'T2DM Clinical Diagnosis',
      detail: `Diagnosed${
        patient.ageAtDiagnosis !== null ? ` at age ${patient.ageAtDiagnosis} yrs` : ''
      }${durParts.length > 0 ? ` · Duration ${durParts.join(' ')}` : ''}.`,
      tone: 'slate',
      status: 'completed',
    });
  }

  if (patient.dateOfRecruitment.trim()) {
    const fbgMg = toGlucoseMgDl(patient.fbg.value, patient.fbg.unit);
    const baselineParts: string[] = [
      clusterCode ? `Cluster ${clusterCode} (${CLUSTER_META[clusterCode].fullName})` : 'Cluster Unassigned',
    ];
    if (baselineHba1c !== null) baselineParts.push(`HbA1c ${baselineHba1c.toFixed(1)}%`);
    if (fbgMg !== null) baselineParts.push(`FBG ${fbgMg} mg/dL`);
    if (patient.bmi !== null) baselineParts.push(`BMI ${patient.bmi} kg/m²`);
    timelineEvents.push({
      id: 'ev-recruit',
      date: patient.dateOfRecruitment,
      phase: 'Baseline',
      title: patient.visitNo ? `Study Enrollment · Visit ${patient.visitNo}` : 'Study Enrollment',
      detail: baselineParts.join(' · '),
      tone: 'emerald',
      status: 'completed',
    });
  }

  for (let i = 0; i < (patient.medicationVisits || []).length; i++) {
    const visit = patient.medicationVisits[i];
    const activeDrugs = (visit.drugs || []).filter((d) => d.drugName.trim() !== '');
    if (activeDrugs.length === 0 && !visit.visitDate) continue;
    const drugSummary = activeDrugs
      .map((d) => `${d.drugName}${d.dose ? ` ${d.dose}` : ''}${d.status === 'Disc.' ? ' (Disc.)' : ''}`)
      .join(', ');
    timelineEvents.push({
      id: `ev-rx-${visit.id || i}`,
      date: visit.visitDate || patient.dateOfRecruitment || 'Visit',
      phase: `Regimen ${i + 1}`,
      title: `Pharmacotherapy Plan (${activeDrugs.length} agent${activeDrugs.length === 1 ? '' : 's'})`,
      detail: `${drugSummary || 'Medication documented'}${
        visit.hba1cAtVisit ? ` · Visit HbA1c ${visit.hba1cAtVisit}%` : ''
      }`,
      tone: 'emerald',
      status: 'completed',
    });
  }

  if (patient.lsmKpa !== null || patient.capDbm !== null) {
    const fibrosis = patient.fibrosisInterpretation ? ` (${patient.fibrosisInterpretation})` : '';
    const steatosis = patient.steatosisInterpretation ? ` (${patient.steatosisInterpretation})` : '';
    const elevated = (patient.lsmKpa ?? 0) >= 8.0 || (patient.capDbm ?? 0) >= 248;
    timelineEvents.push({
      id: 'ev-fibroscan',
      date: patient.fibroScanDate || patient.dateOfRecruitment || 'Baseline',
      phase: 'Elastography',
      title: 'FibroScan Hepatic Assessment',
      detail: `LSM ${patient.lsmKpa ?? '—'} kPa${fibrosis} · CAP ${patient.capDbm ?? '—'} dB/m${steatosis}`,
      tone: elevated ? 'amber' : 'emerald',
      status: 'completed',
    });
  }

  if (followUpHba1c !== null) {
    const deltaText =
      deltaHba1c !== null
        ? deltaHba1c < 0
          ? ` (${Math.abs(deltaHba1c).toFixed(1)}% reduction from baseline)`
          : deltaHba1c > 0
          ? ` (+${deltaHba1c.toFixed(1)}% change from baseline)`
          : ' (unchanged from baseline)'
        : '';
    timelineEvents.push({
      id: 'ev-hba1c2',
      date: patient.hba1c2.date || patient.followUpDate || 'Follow-up',
      phase: 'Glycemic Follow-up',
      title: `2nd HbA1c Recorded: ${followUpHba1c.toFixed(1)}%`,
      detail: `${trendStatus}${deltaText}.`,
      tone: followUpHba1c < targetHba1c ? 'emerald' : deltaHba1c !== null && deltaHba1c < 0 ? 'emerald' : 'amber',
      status: 'completed',
    });
  } else {
    timelineEvents.push({
      id: 'ev-hba1c2-pending',
      date: patient.followUpDate || 'Scheduled',
      phase: 'Follow-up Due',
      title: '2nd HbA1c Assessment Pending',
      detail: followUpProjection.timelineDetail,
      tone: followUpProjection.alreadyControlled ? 'emerald' : 'amber',
      status: 'pending',
    });
  }

  const missingEval = evaluateMissingDataAndStatus(patient);
  if (patient.followUpDate.trim()) {
    timelineEvents.push({
      id: 'ev-next-followup',
      date: patient.followUpDate,
      phase: 'Next Milestone',
      title: 'Scheduled Follow-up Review',
      detail:
        missingEval.missingFields.length > 0
          ? `${missingEval.missingFields.length} item(s) flagged for review (${missingEval.statusLabel}).`
          : 'Complete CRF verified; maintain therapeutic monitoring.',
      tone: missingEval.missingFields.length > 0 ? 'amber' : 'emerald',
      status: 'upcoming',
    });
  }

  return {
    trajectoryPoints,
    timelineEvents,
    baselineHba1c: baselineHba1c !== null ? Number(baselineHba1c.toFixed(1)) : null,
    latestHba1c: latestHba1c !== null ? Number(latestHba1c.toFixed(1)) : null,
    deltaHba1c,
    pctChange,
    targetHba1c,
    followUpProjection,
    trendStatus,
  };
}

export function buildPatientClinicalProblems(patient: PatientCRF): PatientClinicalProblem[] {
  const problems: PatientClinicalProblem[] = [];
  const baselineA1c = toHba1cPercent(patient.hba1c1.value, patient.hba1c1.unit);
  const followUpA1c = toHba1cPercent(patient.hba1c2.value, patient.hba1c2.unit);
  const activeA1c = followUpA1c ?? baselineA1c;
  const fbgMg = toGlucoseMgDl(patient.fbg.value, patient.fbg.unit);
  const ppbgMg = toGlucoseMgDl(patient.ppbg.value, patient.ppbg.unit);
  const target = patient.hba1cTarget || 7.0;

  // 1. Glycemic Control
  if (activeA1c !== null) {
    const improved =
      baselineA1c !== null && followUpA1c !== null && followUpA1c < baselineA1c
        ? ` (down from ${baselineA1c.toFixed(1)}%)`
        : '';
    if (activeA1c >= 8.5) {
      problems.push({
        id: 'prob-glycemic',
        system: 'Glycemic Axis',
        title: 'Severe Hyperglycemia',
        severity: 'critical',
        severityScore: Math.min(100, Math.round((activeA1c / 12) * 100)),
        reading: `HbA1c ${activeA1c.toFixed(1)}%${improved}`,
        target: `<${target.toFixed(1)}%`,
        explanation: `Fasting glucose ${fbgMg ?? '—'} mg/dL and postprandial ${ppbgMg ?? '—'} mg/dL indicate marked glucotoxicity requiring intensive regimen adherence.`,
      });
    } else if (activeA1c >= target) {
      problems.push({
        id: 'prob-glycemic',
        system: 'Glycemic Axis',
        title:
          baselineA1c !== null && followUpA1c !== null && followUpA1c < baselineA1c
            ? 'Improving Sub-Target Glycemia'
            : 'Above-Target Glycemia',
        severity: 'moderate',
        severityScore: Math.min(88, Math.round((activeA1c / 11) * 100)),
        reading: `HbA1c ${activeA1c.toFixed(1)}%${improved}`,
        target: `<${target.toFixed(1)}%`,
        explanation: `${
          improved
            ? 'Significant response observed on current therapy, approaching'
            : 'Requires titration or lifestyle tightening to reach'
        } the <${target.toFixed(1)}% HbA1c target.`,
      });
    } else {
      problems.push({
        id: 'prob-glycemic',
        system: 'Glycemic Axis',
        title: 'Glycemic Target Achieved',
        severity: 'controlled',
        severityScore: 24,
        reading: `HbA1c ${activeA1c.toFixed(1)}%${improved}`,
        target: `<${target.toFixed(1)}%`,
        explanation: 'Current glycemia is within study therapeutic target without escalating glucotoxicity.',
      });
    }
  }

  // 2. Beta-cell reserve & Insulin resistance
  const homaB = patient.homaB;
  const homaIR = patient.homaIR;
  const cPep = patient.cPeptide.value;
  const lowHomaBThreshold = patient.homaMethod === 'c-peptide' ? 8 : 55;
  const hasDeficit = (homaB !== null && homaB < lowHomaBThreshold) || (cPep !== null && cPep < 1.1);
  const hasResistance = homaIR !== null && homaIR >= 2.5;
  if (hasDeficit || hasResistance) {
    const title =
      hasDeficit && hasResistance
        ? 'Combined Beta-Cell Deficit & Insulin Resistance'
        : hasDeficit
        ? 'Beta-Cell Secretory Deficit'
        : 'Elevated Insulin Resistance';
    const score = hasDeficit && hasResistance ? 82 : homaIR && homaIR >= 3.2 ? 78 : 66;
    problems.push({
      id: 'prob-homa',
      system: 'Islet & Metabolic',
      title,
      severity: score >= 75 ? 'critical' : 'moderate',
      severityScore: score,
      reading: `HOMA-B ${homaB ?? '—'}% · HOMA-IR ${homaIR ?? '—'} · C-Pep ${cPep ?? '—'} ${patient.cPeptide.unit}`,
      target: 'Balanced HOMA-IR <2.5 & preserved C-peptide',
      explanation:
        hasDeficit && hasResistance
          ? 'Dual pathophysiologic defect: reduced insulin reserve combined with peripheral resistance.'
          : hasDeficit
          ? 'Reduced endogenous insulin reserve limits post-meal glucose clearance and favors secretagogue/incretin/insulin support.'
          : 'Peripheral and hepatic insulin resistance drives compensatory hyperinsulinemia and cardiometabolic stress.',
    });
  }

  // 3. Hepatic Steatosis & Fibrosis (FibroScan / LFT)
  const lsm = patient.lsmKpa;
  const cap = patient.capDbm;
  const alt = patient.alt.value;
  if (lsm !== null || cap !== null || (alt !== null && alt > 40)) {
    const advFibrosis = lsm !== null && lsm >= 8.0;
    const steatosisElevated = cap !== null && cap >= 248;
    const severity: ProblemSeverity = advFibrosis
      ? 'critical'
      : steatosisElevated || (alt !== null && alt > 45)
      ? 'moderate'
      : 'controlled';
    problems.push({
      id: 'prob-hepatic',
      system: 'Hepatic / MASLD',
      title: advFibrosis
        ? 'Significant Liver Stiffness / Fibrosis Risk'
        : steatosisElevated
        ? 'Hepatic Steatosis (MASLD)'
        : 'Normal Hepatic Parenchyma',
      severity,
      severityScore: advFibrosis ? 86 : steatosisElevated ? 64 : 20,
      reading: `LSM ${lsm ?? '—'} kPa (${patient.fibrosisInterpretation || '—'}) · CAP ${cap ?? '—'} dB/m (${patient.steatosisInterpretation || '—'})`,
      target: 'LSM <8.0 kPa · CAP <248 dB/m',
      explanation: advFibrosis
        ? 'Elevated FibroScan stiffness warrants hepatoprotective metabolic agents (SGLT2i/TZD/GLP-1) and fibrosis surveillance.'
        : steatosisElevated
        ? 'Increased controlled attenuation parameter indicates hepatic lipid accumulation linked with insulin resistance.'
        : 'No significant steatosis or stiffness detected on FibroScan elastography.',
    });
  }

  // 4. Renal & Albuminuria
  const egfr = patient.egfr;
  const uacr = patient.uacr.value;
  if (egfr !== null || uacr !== null) {
    const egfrLow = egfr !== null && egfr < 60;
    const egfrMild = egfr !== null && egfr < 90 && egfr >= 60;
    const uacrHigh = uacr !== null && uacr >= 300;
    const uacrMod = uacr !== null && uacr >= 30 && uacr < 300;
    const severity: ProblemSeverity =
      egfrLow || uacrHigh ? 'critical' : egfrMild || uacrMod ? 'moderate' : 'controlled';
    problems.push({
      id: 'prob-renal',
      system: 'Renal Function',
      title:
        egfrLow || uacrHigh
          ? 'Diabetic Kidney Disease Risk'
          : uacrMod
          ? 'Microalbuminuria'
          : egfrMild
          ? 'Mildly Reduced eGFR'
          : 'Preserved Renal Filtration',
      severity,
      severityScore: egfrLow || uacrHigh ? 85 : uacrMod ? 62 : egfrMild ? 40 : 18,
      reading: `eGFR ${egfr ?? '—'} mL/min/1.73m² · UACR ${uacr ?? '—'} mg/g`,
      target: 'eGFR ≥90 · UACR <30 mg/g',
      explanation:
        egfrLow || uacrMod || uacrHigh
          ? 'Glomerular barrier stress or filtration decline; prioritizes SGLT2 inhibitor and RAAS blockade nephroprotection.'
          : 'CKD-EPI 2021 filtration and urinary albumin excretion remain within normal physiological range.',
    });
  }

  // 5. Blood Pressure, Lipids & Macrovascular Risk
  const ldlMg = toLipidMgDl(patient.ldl.value, patient.ldl.unit, 'chol');
  const tgMg = toLipidMgDl(patient.triglycerides.value, patient.triglycerides.unit, 'tg');
  const hasMacro =
    patient.macroCad === 'Present' ||
    patient.macroStroke === 'Present' ||
    patient.macroPad === 'Present' ||
    (patient.ksMacrovascular ?? 0) > 0;
  const highBp = (patient.sbp ?? 0) >= 140 || (patient.dbp ?? 0) >= 90;
  const modBp = (patient.sbp ?? 0) >= 130 || (patient.dbp ?? 0) >= 80;
  const highLipids = (ldlMg ?? 0) >= 130 || (tgMg ?? 0) >= 200;

  if (patient.sbp !== null || ldlMg !== null || hasMacro) {
    const severity: ProblemSeverity =
      hasMacro || highBp ? 'critical' : highLipids || modBp ? 'moderate' : 'controlled';
    const findings: string[] = [];
    if (patient.sbp !== null && patient.dbp !== null) findings.push(`BP ${patient.sbp}/${patient.dbp} mmHg`);
    if (ldlMg !== null) findings.push(`LDL ${ldlMg} mg/dL`);
    if (tgMg !== null) findings.push(`TG ${tgMg} mg/dL`);
    if (patient.macroCad === 'Present') findings.push('CAD');
    if (patient.macroStroke === 'Present') findings.push('Stroke');
    if (patient.macroPad === 'Present') findings.push('PAD');
    problems.push({
      id: 'prob-cardio',
      system: 'Cardiometabolic',
      title: hasMacro
        ? 'Macrovascular Burden & Cardiometabolic Risk'
        : highBp || highLipids
        ? 'Hypertension / Dyslipidemia'
        : 'Cardiometabolic Profile Controlled',
      severity,
      severityScore: hasMacro ? 84 : highBp ? 76 : highLipids || modBp ? 56 : 22,
      reading: findings.join(' · ') || 'No baseline reading',
      target: 'BP <130/80 mmHg · LDL <100 mg/dL · TG <150 mg/dL',
      explanation:
        severity === 'controlled'
          ? 'Blood pressure and atherogenic lipid fractions are near optimal targets under preventive therapy.'
          : 'Elevated vascular load or atherogenic lipids increase ASCVD risk; requires statin and antihypertensive optimization.',
    });
  }

  // 6. Microvascular Retinopathy, Neuropathy & Foot
  const retTier = patient.ksMicroRetinopathyTier ?? 0;
  const footTier = patient.ksFootNeuropathy ?? 0;
  const footActive = patient.footUlcer === 'Yes' || patient.footAmputation === 'Yes';
  if (retTier > 0 || footTier > 0 || footActive) {
    const severity: ProblemSeverity = footActive || retTier >= 3 || footTier >= 3 ? 'critical' : 'moderate';
    problems.push({
      id: 'prob-neuro-eye',
      system: 'Retina & Foot / Nerve',
      title: footActive
        ? 'Diabetic Foot Ulcer / Limb Risk'
        : retTier > 0 && footTier > 0
        ? 'Early Retinopathy & Peripheral Neuropathy'
        : retTier > 0
        ? 'Diabetic Retinopathy'
        : 'Peripheral Neuropathy',
      severity,
      severityScore: severity === 'critical' ? 88 : Math.min(72, 35 + (retTier + footTier) * 10),
      reading: `Retinopathy Tier ${retTier}/5 · Foot/Neuropathy Tier ${footTier}/5`,
      target: 'Retinopathy 0/5 · Intact monofilament & foot skin',
      explanation:
        'Microvascular end-organ involvement captured in Known Severity (KS); tight glycemic and blood pressure control slows progression.',
    });
  }

  // 7. Hemoglobin / Anemia
  const hb = patient.hemoglobin.value;
  const anemiaCutoff = patient.gender === 'Female' ? 12.0 : 13.0;
  if (hb !== null && hb < anemiaCutoff) {
    problems.push({
      id: 'prob-heme',
      system: 'Hematology',
      title: 'Mild-to-Moderate Anemia',
      severity: hb < 10 ? 'critical' : 'moderate',
      severityScore: hb < 10 ? 78 : 50,
      reading: `Hemoglobin ${hb} g/dL`,
      target: `≥${anemiaCutoff.toFixed(1)} g/dL`,
      explanation:
        'Reduced hemoglobin can influence HbA1c interpretation and fatigue tolerance; evaluate nutritional or renal etiology.',
    });
  }

  // 8. DDS-17 Psychosocial Distress & Hypoglycemia
  const ddsMean = patient.ddsMean;
  const hypo = patient.hypoglycemiaSeverity;
  if ((ddsMean !== null && ddsMean >= 2.0) || (hypo && hypo !== 'No')) {
    const highDistress = ddsMean !== null && ddsMean >= 3.0;
    const severeHypo = hypo === 'Level 2' || hypo === 'Level 3' || hypo === 'Recurrent Level 3 or LOC';
    problems.push({
      id: 'prob-distress',
      system: 'Distress & Safety',
      title:
        highDistress || severeHypo
          ? 'High Diabetes Distress / Hypoglycemia Alert'
          : 'Moderate Distress or Mild Hypoglycemia',
      severity: highDistress || severeHypo ? 'critical' : 'moderate',
      severityScore: highDistress || severeHypo ? 75 : 46,
      reading: `DDS-17 Mean ${ddsMean ?? '—'} (${patient.ddsCategory || '—'}) · Hypo: ${hypo || '—'}`,
      target: 'DDS-17 Mean <2.0 · Zero hypoglycemia events',
      explanation:
        'Patient-reported regimen burden or hypoglycemia episodes warrant regimen simplification and structured diabetes counseling.',
    });
  }

  const order: Record<ProblemSeverity, number> = { critical: 0, moderate: 1, controlled: 2 };
  return problems.sort((a, b) => order[a.severity] - order[b.severity] || b.severityScore - a.severityScore);
}

function buildLinkedMetricsForAntidiabetic(
  classes: AntidiabeticClass[],
  patient: PatientCRF,
  summary: PatientGlycemicSummary
): { benefit: string; metrics: DrugLinkedMetric[] } {
  const metrics: DrugLinkedMetric[] = [];
  const fbgMg = toGlucoseMgDl(patient.fbg.value, patient.fbg.unit);
  const ppbgMg = toGlucoseMgDl(patient.ppbg.value, patient.ppbg.unit);
  const benefits: string[] = [];

  if (summary.baselineHba1c !== null && summary.latestHba1c !== null && summary.deltaHba1c !== null) {
    if (summary.deltaHba1c < 0) {
      benefits.push(
        `Contributed to HbA1c reduction from ${summary.baselineHba1c.toFixed(1)}% to ${summary.latestHba1c.toFixed(1)}% (${summary.deltaHba1c.toFixed(1)}%)`
      );
      metrics.push({
        label: 'HbA1c Trajectory',
        value: `${summary.baselineHba1c.toFixed(1)}% → ${summary.latestHba1c.toFixed(1)}%`,
        tone: 'good',
      });
    } else {
      metrics.push({
        label: 'Latest HbA1c',
        value: `${summary.latestHba1c.toFixed(1)}%`,
        tone: summary.latestHba1c < summary.targetHba1c ? 'good' : 'warn',
      });
    }
  } else if (summary.baselineHba1c !== null) {
    benefits.push(
      summary.baselineHba1c < summary.targetHba1c
        ? `Maintains controlled baseline HbA1c (${summary.baselineHba1c.toFixed(1)}%, already <${summary.targetHba1c.toFixed(1)}%)`
        : `Initiated at baseline HbA1c ${summary.baselineHba1c.toFixed(1)}% targeting <${summary.targetHba1c.toFixed(1)}%`
    );
    metrics.push({
      label: 'Baseline HbA1c',
      value: `${summary.baselineHba1c.toFixed(1)}%`,
      tone: summary.baselineHba1c < summary.targetHba1c ? 'good' : 'warn',
    });
  }

  if (classes.includes('Biguanides')) {
    benefits.push(
      `improves hepatic insulin sensitivity${patient.homaIR !== null ? ` (HOMA-IR ${patient.homaIR})` : ''} without weight gain`
    );
    if (fbgMg !== null) {
      metrics.push({ label: 'FBG', value: `${fbgMg} mg/dL`, tone: fbgMg <= 130 ? 'good' : 'warn' });
    }
  }

  if (classes.includes('SGLT2 Inhibitors')) {
    benefits.push(
      `provides osmotic natriuresis, blood pressure relief, and renal protection${
        patient.egfr !== null ? ` (eGFR ${patient.egfr}, UACR ${patient.uacr.value ?? '—'} mg/g)` : ''
      }`
    );
    if (patient.egfr !== null) {
      metrics.push({
        label: 'eGFR',
        value: `${patient.egfr} mL/min`,
        tone: patient.egfr >= 60 ? 'good' : 'warn',
      });
    }
    if (patient.uacr.value !== null) {
      metrics.push({
        label: 'UACR',
        value: `${patient.uacr.value} mg/g`,
        tone: patient.uacr.value < 30 ? 'good' : 'warn',
      });
    }
  }

  if (classes.includes('Sulfonylureas')) {
    benefits.push('amplifies endogenous insulin output to lower fasting and post-meal glucose');
    if (ppbgMg !== null) {
      metrics.push({ label: 'PPBG', value: `${ppbgMg} mg/dL`, tone: ppbgMg <= 180 ? 'good' : 'warn' });
    }
    if (patient.hypoglycemiaSeverity && patient.hypoglycemiaSeverity !== 'No') {
      metrics.push({
        label: 'Hypo Safety',
        value: patient.hypoglycemiaSeverity,
        tone: 'warn',
      });
    }
  }

  if (classes.includes('Thiazolidinediones')) {
    benefits.push(
      `targets adipose/hepatic insulin resistance (HOMA-IR ${patient.homaIR ?? '—'}) and helps regress MASLD steatosis${
        patient.capDbm !== null ? ` (CAP ${patient.capDbm} dB/m)` : ''
      }`
    );
    if (patient.homaIR !== null) {
      metrics.push({ label: 'HOMA-IR', value: `${patient.homaIR}`, tone: patient.homaIR < 2.5 ? 'good' : 'warn' });
    }
    if (patient.capDbm !== null) {
      metrics.push({ label: 'Liver CAP', value: `${patient.capDbm} dB/m`, tone: patient.capDbm < 248 ? 'good' : 'warn' });
    }
  }

  if (classes.includes('DPP-4 Inhibitors')) {
    benefits.push('stabilizes postprandial excursions with neutral weight and minimal hypoglycemia risk');
    if (ppbgMg !== null) {
      metrics.push({ label: 'PPBG', value: `${ppbgMg} mg/dL`, tone: ppbgMg <= 180 ? 'good' : 'warn' });
    }
  }

  if (classes.includes('GLP-1 Receptor Agonists')) {
    benefits.push('reduces appetite, visceral adiposity, hepatic fat, and cardiovascular event risk');
    if (patient.bmi !== null) {
      metrics.push({ label: 'BMI', value: `${patient.bmi} kg/m²`, tone: patient.bmi < 25 ? 'good' : 'warn' });
    }
  }

  if (classes.includes('Insulin Therapy')) {
    benefits.push('compensates for depleted pancreatic beta-cell reserve to relieve glucotoxicity');
    if (patient.homaB !== null) {
      metrics.push({ label: 'HOMA-B', value: `${patient.homaB}%`, tone: 'neutral' });
    }
  }

  if (classes.includes('Alpha-Glucosidase Inhibitors')) {
    benefits.push('flattens post-meal carbohydrate absorption peaks');
    if (ppbgMg !== null) {
      metrics.push({ label: 'PPBG', value: `${ppbgMg} mg/dL`, tone: ppbgMg <= 180 ? 'good' : 'warn' });
    }
  }

  const formatted =
    benefits.length > 0
      ? benefits[0].charAt(0).toUpperCase() +
        benefits[0].slice(1) +
        (benefits.length > 1 ? `; ${benefits.slice(1).join('; ')}.` : '.')
      : 'Supports glycemic control across daily metabolic demands.';

  return { benefit: formatted, metrics: metrics.slice(0, 3) };
}

function buildLinkedMetricsForConcomitant(
  cls: ConcomitantClass,
  patient: PatientCRF
): { benefit: string; metrics: DrugLinkedMetric[] } {
  const metrics: DrugLinkedMetric[] = [];
  const ldlMg = toLipidMgDl(patient.ldl.value, patient.ldl.unit, 'chol');
  const tgMg = toLipidMgDl(patient.triglycerides.value, patient.triglycerides.unit, 'tg');

  if (cls === 'Antihypertensives') {
    const bpText =
      patient.sbp !== null && patient.dbp !== null ? `${patient.sbp}/${patient.dbp} mmHg` : '—';
    const bpOk = patient.sbp !== null && patient.dbp !== null && patient.sbp < 130 && patient.dbp < 85;
    if (patient.sbp !== null && patient.dbp !== null) {
      metrics.push({ label: 'Clinic BP', value: bpText, tone: bpOk ? 'good' : 'warn' });
    }
    if (patient.uacr.value !== null) {
      metrics.push({
        label: 'UACR',
        value: `${patient.uacr.value} mg/g`,
        tone: patient.uacr.value < 30 ? 'good' : 'warn',
      });
    }
    return {
      benefit: `Maintains arterial blood pressure (${bpText}) and shields renal glomeruli from hyperfiltration injury.`,
      metrics,
    };
  }

  if (cls === 'Statins') {
    if (ldlMg !== null) {
      metrics.push({ label: 'LDL-C', value: `${ldlMg} mg/dL`, tone: ldlMg <= 100 ? 'good' : 'warn' });
    }
    if (patient.nonHdl !== null) {
      metrics.push({
        label: 'Non-HDL',
        value: `${patient.nonHdl} mg/dL`,
        tone: patient.nonHdl <= 130 ? 'good' : 'warn',
      });
    }
    if (tgMg !== null) {
      metrics.push({ label: 'Triglycerides', value: `${tgMg} mg/dL`, tone: tgMg < 150 ? 'good' : 'warn' });
    }
    return {
      benefit: `Lowers atherogenic LDL (${ldlMg ?? '—'} mg/dL) and non-HDL cholesterol to curb diabetic macrovascular risk.`,
      metrics,
    };
  }

  if (cls === 'Antiplatelets') {
    return {
      benefit: 'Provides secondary anti-thrombotic protection for coronary and cerebrovascular arteries.',
      metrics: [
        {
          label: 'Macrovascular KS',
          value: `${patient.ksMacrovascular ?? 0}/5`,
          tone: (patient.ksMacrovascular ?? 0) === 0 ? 'good' : 'warn',
        },
      ],
    };
  }

  if (cls === 'Neuropathy Agents') {
    return {
      benefit: 'Alleviates diabetic peripheral neuropathy symptoms and preserves lower-limb functional comfort.',
      metrics: [
        {
          label: 'Foot/Neuro KS',
          value: `${patient.ksFootNeuropathy ?? 0}/5`,
          tone: (patient.ksFootNeuropathy ?? 0) <= 1 ? 'good' : 'warn',
        },
      ],
    };
  }

  return {
    benefit: 'Supports systemic cardiometabolic stability alongside primary diabetes pharmacotherapy.',
    metrics,
  };
}

export function buildPatientDrugHealthLinks(patient: PatientCRF): PatientDrugHealthLink[] {
  const glycemicSummary = buildPatientGlycemicTimeline(patient);
  const links: PatientDrugHealthLink[] = [];

  const seenAntidiabetic = new Map<string, { row: MedicationRow; visitDate: string }>();
  for (const visit of patient.medicationVisits || []) {
    for (const drug of visit.drugs || []) {
      const cleanName = drug.drugName.trim();
      if (!cleanName) continue;
      const key = `${cleanName.toLowerCase()}__${(drug.dose || '').trim().toLowerCase()}`;
      seenAntidiabetic.set(key, { row: drug, visitDate: visit.visitDate });
    }
  }

  for (const [, entry] of seenAntidiabetic) {
    const { row, visitDate } = entry;
    const classified = classifyAntidiabeticDrug(row.drugName);
    const primaryMeta = ANTIDIABETIC_MECHANISMS[classified.classes[0] || 'Other Antidiabetic'];
    const combinedMechanism =
      classified.classes.length > 1
        ? classified.classes
            .map((c) => `${c}: ${ANTIDIABETIC_MECHANISMS[c].mechanism}`)
            .join(' ')
        : primaryMeta.mechanism;
    const organs = Array.from(
      new Set(classified.classes.flatMap((c) => ANTIDIABETIC_MECHANISMS[c].organs))
    );
    const { benefit, metrics } = buildLinkedMetricsForAntidiabetic(
      classified.classes,
      patient,
      glycemicSummary
    );

    links.push({
      id: `anti-${row.id || row.drugName}`,
      category: 'Antidiabetic',
      drugName: row.drugName,
      dose: row.dose || '—',
      route: row.route || '—',
      frequency: row.frequency || '—',
      status: row.status === 'Disc.' ? 'Disc.' : row.status === 'Current' ? 'Current' : '',
      visitDate,
      classLabels: classified.classes,
      isFdc: classified.isFdc,
      mechanism: combinedMechanism,
      patientHealthBenefit: benefit,
      targetOrgans: organs,
      linkedMetrics: metrics,
    });
  }

  for (const row of patient.otherMedications || []) {
    const cleanName = row.drugName.trim();
    if (!cleanName) continue;
    const cls = classifyConcomitantDrug(cleanName);
    const meta = CONCOMITANT_MECHANISMS[cls];
    const { benefit, metrics } = buildLinkedMetricsForConcomitant(cls, patient);

    links.push({
      id: `con-${row.id || row.drugName}`,
      category: 'Concomitant',
      drugName: row.drugName,
      dose: row.dose || '—',
      route: row.route || '—',
      frequency: row.frequency || '—',
      status: row.status === 'Disc.' ? 'Disc.' : row.status === 'Current' ? 'Current' : '',
      classLabels: [cls],
      isFdc: false,
      mechanism: meta.mechanism,
      patientHealthBenefit: benefit,
      targetOrgans: meta.organs,
      linkedMetrics: metrics,
    });
  }

  return links;
}

export function buildBlueIndexDomainBars(patient: PatientCRF): BlueIndexDomainBar[] {
  return DHS_DOMAIN_LABELS.map(({ key, label }) => {
    const raw = patient.dhsDomains?.[key] ?? null;
    const score = raw !== null && Number.isFinite(raw) ? Math.max(0, Math.min(5, raw)) : null;
    const pct = score !== null ? Math.round((score / 5) * 100) : 0;
    const tone: BlueIndexDomainBar['tone'] =
      score === null ? 'moderate' : score >= 4 ? 'good' : score >= 2.5 ? 'moderate' : 'poor';
    return {
      key,
      code: key,
      label,
      score,
      pct,
      tone,
    };
  });
}

export function buildDdsSubscaleBars(patient: PatientCRF): DdsSubscaleBar[] {
  const defs: Array<{ key: string; label: string; score: number | null }> = [
    { key: 'emotional', label: 'Emotional Burden', score: patient.ddsEmotionalBurden },
    { key: 'physician', label: 'Physician Distress', score: patient.ddsPhysicianDistress },
    { key: 'regimen', label: 'Regimen Distress', score: patient.ddsRegimenDistress },
    { key: 'interpersonal', label: 'Interpersonal Distress', score: patient.ddsInterpersonalDistress },
  ];

  return defs.map((item) => {
    const val = item.score !== null && Number.isFinite(item.score) ? item.score : null;
    const pct = val !== null ? Math.min(100, Math.max(0, Math.round((val / 6) * 100))) : 0;
    const levelLabel =
      val === null
        ? 'Pending'
        : val >= 3.0
        ? 'High Distress'
        : val >= 2.0
        ? 'Moderate Distress'
        : 'Little / No Distress';
    const tone: DdsSubscaleBar['tone'] =
      val === null ? 'moderate' : val >= 3.0 ? 'poor' : val >= 2.0 ? 'moderate' : 'good';
    return {
      key: item.key,
      label: item.label,
      score: val,
      pct,
      levelLabel,
      tone,
    };
  });
}
