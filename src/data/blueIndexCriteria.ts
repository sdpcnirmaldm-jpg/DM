import type { DHSDomains, PatientCRF } from '../types/clinical';

export interface DHSCategorySpec {
  id: Exclude<PatientCRF['dhsCategory'], ''>;
  title: string;
  thresholdLabel: string;
  description: string;
  tone: 'emerald' | 'amber' | 'rose';
}

export const DHS_CATEGORY_SPECS: DHSCategorySpec[] = [
  {
    id: 'Excellent Status',
    title: 'Excellent Status',
    thresholdLabel: 'DHS > 45',
    description:
      'Tight metabolic alignment across all arms; zero significant lifestyle barriers; minimal therapeutic risk.',
    tone: 'emerald',
  },
  {
    id: 'Moderate Status',
    title: 'Moderate Status',
    thresholdLabel: 'DHS 35 – 45',
    description:
      'Acceptable control with localized gaps in adherence, mild dyslipidemia, or occasional hypoglycemia.',
    tone: 'amber',
  },
  {
    id: 'Undesirable Status',
    title: 'Undesirable Status',
    thresholdLabel: 'DHS < 35',
    description:
      'High clinical jeopardy; unmanaged glycemia or severe non-adherence requiring immediate therapeutic escalation.',
    tone: 'rose',
  },
];

export type ScoreValue = 5 | 4 | 3 | 2 | 1 | 0;

export interface DHSDomainSpec {
  key: keyof DHSDomains;
  number: number;
  title: string;
  metricLabel: string;
  sourceKind: 'lab' | 'vitals' | 'clinical' | 'lifestyle';
  sourceBadge: string;
  criteria: Record<ScoreValue, string>;
}

export const DHS_SCORE_ORDER: ScoreValue[] = [5, 4, 3, 2, 1, 0];

export const DHS_DOMAIN_SPECS: DHSDomainSpec[] = [
  {
    key: 'A',
    number: 1,
    title: '(A) Average Blood Sugar',
    metricLabel: 'HbA1c individualized target',
    sourceKind: 'lab',
    sourceBadge: 'Auto from Lab HbA1c',
    criteria: {
      5: 'At or below target (e.g. ≤7.0%)',
      4: '0.1%–0.5% above target',
      3: '0.6%–1.0% above target',
      2: '1.1%–2.0% above target',
      1: '2.1%–4.0% off target',
      0: '>4.0% off target (>11.0%)',
    },
  },
  {
    key: 'B',
    number: 2,
    title: '(B) Blood Pressure (BP)',
    metricLabel: 'SBP / DBP targets (130/80 mmHg)',
    sourceKind: 'vitals',
    sourceBadge: 'Auto from Vitals BP',
    criteria: {
      5: 'Normotensive without meds',
      4: 'At target with anti-HTN meds',
      3: 'SBP 0–10 / DBP 0–5 above',
      2: 'SBP 11–20 / DBP 6–10 above',
      1: 'SBP 21–40 / DBP 11–20 above',
      0: 'SBP >40 or DBP >20 above',
    },
  },
  {
    key: 'C',
    number: 3,
    title: '(C) Lipids: TC, LDL, non-HDL',
    metricLabel: 'Atherogenic profile criteria',
    sourceKind: 'lab',
    sourceBadge: 'Auto from Lipid Lab',
    criteria: {
      5: 'No dyslipidemia without meds',
      4: 'All 3 parameters at target with statin',
      3: '1 of 3 parameters above target',
      2: '2 of 3 parameters above target',
      1: 'All 3 parameters above target',
      0: 'TG >500, LDL >190, or non-HDL >220',
    },
  },
  {
    key: 'D',
    number: 4,
    title: '(D) Diet Adherence',
    metricLabel: 'MNT & carbohydrate limits',
    sourceKind: 'lifestyle',
    sourceBadge: 'Synced from Section C',
    criteria: {
      5: 'Fully adherent to meal plan',
      4: 'Mostly adherent (infrequent lapses)',
      3: 'Partially adherent to regimen',
      2: 'Mostly non-adherent',
      1: 'Totally non-adherent',
      0: 'Unwilling / defiant to diet',
    },
  },
  {
    key: 'E',
    number: 5,
    title: '(E) Exercise / Activity',
    metricLabel: 'Standard: ≥150 min/wk moderate',
    sourceKind: 'lifestyle',
    sourceBadge: 'Synced from Section C',
    criteria: {
      5: 'Fully adherent (≥150 min/wk)',
      4: 'Mostly adherent (90–149 min/wk)',
      3: 'Partially adherent (30–89 min/wk)',
      2: 'Mostly non-adherent (minimal)',
      1: 'Totally non-adherent (sedentary)',
      0: 'Unwilling / bedridden',
    },
  },
  {
    key: 'F',
    number: 6,
    title: '(F) Follow-up & Compliance',
    metricLabel: 'Clinic schedule & prescriptions',
    sourceKind: 'lifestyle',
    sourceBadge: 'Synced from Section C',
    criteria: {
      5: 'Fully adherent to visits & Rx',
      4: 'Mostly adherent (minor delay)',
      3: 'Partially adherent (missed doses)',
      2: 'Mostly non-adherent',
      1: 'Totally non-adherent',
      0: 'Defaulter / lost to care',
    },
  },
  {
    key: 'G',
    number: 7,
    title: '(G) General Health & Comorbidity',
    metricLabel: 'Non-DM chronic disease burden',
    sourceKind: 'clinical',
    sourceBadge: 'Synced from Section C',
    criteria: {
      5: 'No comorbidities (normal BMI)',
      4: '1 mild stable comorbidity',
      3: '2 stable comorbidities',
      2: 'Multiple moderate comorbidities',
      1: '1 severe comorbidity',
      0: 'End-stage non-DM failure',
    },
  },
  {
    key: 'H',
    number: 8,
    title: '(H) Habits',
    metricLabel: 'Tobacco, bidi, alcohol consumption',
    sourceKind: 'lifestyle',
    sourceBadge: 'Auto from Habits History',
    criteria: {
      5: 'Never smoker; no tobacco/alcohol',
      4: 'Ex-smoker / tobacco-free >1 yr',
      3: 'Light (<10 cigs/d; ≤5 sachets)',
      2: 'Moderate (10–20 cigs; 5–10 sachets)',
      1: 'Heavy (>20 cigs; >10 sachets)',
      0: 'Substance abuse; unwilling',
    },
  },
  {
    key: 'I',
    number: 9,
    title: '(I) Infection Prevention',
    metricLabel: 'Vaccination status & frequency',
    sourceKind: 'lifestyle',
    sourceBadge: 'Synced from Section C',
    criteria: {
      5: 'Fully vaccinated; zero infection',
      4: 'Partially vaccinated; zero infection',
      3: 'Unvaccinated; zero infection',
      2: 'Vaccinated; 1 mild infection/yr',
      1: 'Recurrent non-severe infection',
      0: 'Recurrent severe / sepsis',
    },
  },
  {
    key: 'J',
    number: 10,
    title: '(J) Jeopardy (Hypoglycemia / ADR)',
    metricLabel: 'Treatment toxicity & neuroglycopenia',
    sourceKind: 'clinical',
    sourceBadge: 'Auto from Section B Hypoglycemia',
    criteria: {
      5: 'No hypoglycemia; zero ADR',
      4: 'Level 1 asymptomatic (<70 mg/dL)',
      3: 'Level 1 symptomatic (managed)',
      2: 'Level 2 hypo (<54 mg/dL), no LOC',
      1: 'Level 3 hypo (severe, no LOC)',
      0: 'Recurrent Level 3 or LOC',
    },
  },
];

export interface KSCriterionRow {
  score: ScoreValue;
  shortTitle: string;
  description: string;
}

export const KS_MACRO_CRITERIA: KSCriterionRow[] = [
  {
    score: 0,
    shortTitle: 'Optimally evaluated for CVD/CAD and normal',
    description:
      'Normal baseline 12-lead ECG and normal Echo or TMT where clinically indicated; no angina or peripheral arterial signs.',
  },
  {
    score: 1,
    shortTitle: 'No clinical evidence (not optimally evaluated)',
    description:
      'Asymptomatic patient with no abnormal physical signs, but has not been optimally evaluated by standard diagnostic testing.',
  },
  {
    score: 2,
    shortTitle: 'Suspected CVD/CAD',
    description:
      'Suggestive symptoms or clinical signs (atypical chest pain, exertional dyspnea, resting ECG abnormalities without enzymatic confirmation).',
  },
  {
    score: 3,
    shortTitle: 'Established CVD/CAD, optimally treated',
    description:
      'Confirmed stable angina, past MI, prior ACS, prior CABG/PCI, or prior TIA/stroke without persistent neurological deficit.',
  },
  {
    score: 4,
    shortTitle: 'CAD not optimally treated / HF NYHA 2–3 / minor stroke',
    description:
      'CAD not optimally treated OR Heart Failure with NYHA Class 2–3 OR past stroke with minimal persistent functional/neurological deficit.',
  },
  {
    score: 5,
    shortTitle: 'End-stage macrovascular disease',
    description:
      'Severe CAD or Heart Failure with NYHA Class 4 OR Cerebrovascular stroke with significant permanent neurological disability.',
  },
];

export interface KSMicroSubCriteria {
  score: ScoreValue;
  label: string;
  detail: string;
}

export const KS_MICRO_EGFR_CRITERIA: KSMicroSubCriteria[] = [
  { score: 0, label: '≥90 (Optimally screened)', detail: 'eGFR ≥ 90 mL/min/1.73m²' },
  { score: 1, label: '>60 (Incompletely screened)', detail: 'Incompletely screened; asymptomatic' },
  { score: 2, label: '60 – 89 (Mild decline)', detail: 'eGFR 60 – 89 mL/min/1.73m²' },
  { score: 3, label: '30 – 59 (CKD Stage G3)', detail: 'eGFR 30 – 59 mL/min/1.73m² (Stage G3)' },
  { score: 4, label: '15 – 29 (CKD Stage G4)', detail: 'eGFR <30 / 15–29 mL/min/1.73m² (Stage G4)' },
  { score: 5, label: '<15 or RRT / Dialysis (ESRD)', detail: 'eGFR < 15 mL/min/1.73m² or on Dialysis' },
];

export const KS_MICRO_UACR_CRITERIA: KSMicroSubCriteria[] = [
  { score: 0, label: '<30 (Normoalbuminuria)', detail: 'UACR < 30 mg/g' },
  { score: 1, label: '<30 or not assessed', detail: 'Incompletely screened; asymptomatic' },
  { score: 2, label: '30 – 299 (Microalbuminuria)', detail: 'UACR 30 – 299 mg/g' },
  { score: 3, label: '≥300 (Macroalbuminuria)', detail: 'UACR ≥ 300 mg/g' },
  { score: 4, label: '>300 with active decline', detail: 'UACR > 300 mg/g with declining GFR (<60)' },
  { score: 5, label: 'Nephrotic range proteinuria', detail: 'UACR ≥ 2200 mg/g (nephrotic range)' },
];

export const KS_MICRO_EYE_CRITERIA: KSMicroSubCriteria[] = [
  { score: 0, label: 'Normal fundus', detail: 'No diabetic retinopathy detected' },
  { score: 1, label: 'Screening incomplete', detail: 'No visual complaints, screening incomplete' },
  { score: 2, label: 'Mild-to-moderate NPDR', detail: 'Mild-to-moderate Non-Proliferative Retinopathy' },
  { score: 3, label: 'Severe NPDR (no DME)', detail: 'Severe NPDR without Macular Edema' },
  { score: 4, label: 'PDR or CSME', detail: 'Proliferative DR or Clinically Significant Macular Edema' },
  { score: 5, label: 'Vitreous hemorrhage / Blindness', detail: 'Advanced diabetic eye disease' },
];

export interface KSFootCriterionRow {
  score: ScoreValue;
  structural: string;
  functionalVascular: string;
}

export const KS_FOOT_CRITERIA: KSFootCriterionRow[] = [
  {
    score: 0,
    structural: 'Normal foot architecture; intact skin barrier',
    functionalVascular: 'Intact sensation (10g monofilament); normal palpable pulses',
  },
  {
    score: 1,
    structural: 'Dry skin, cracks, fissures, or abnormal pressure site',
    functionalVascular: 'Positive neuropathy symptoms (burning, tingling, paresthesias)',
  },
  {
    score: 2,
    structural: 'Corns, callosities, or past healed superficial ulcer',
    functionalVascular: 'Loss of protective sensation (LOPS) OR intermittent claudication',
  },
  {
    score: 3,
    structural: 'Deformities (claw/hammer toes), midfoot collapse, or acute superficial ulcer',
    functionalVascular: 'Absent peripheral pulses OR abnormal Ankle-Brachial Index (ABI <0.9)',
  },
  {
    score: 4,
    structural: 'Active deep infection, deep ulceration, or established Charcot arthropathy',
    functionalVascular: 'Insensate foot with severe PVD (ABI <0.7) OR autonomic neuropathy',
  },
  {
    score: 5,
    structural: 'Active gangrene, extensive proximal tissue necrosis, or chronic non-healing ulcer',
    functionalVascular: 'History of partial foot, ray, or major lower limb amputation',
  },
];

export const MICROVASCULAR_CASE_EXAMPLES = [
  {
    title: 'Case 1: Isolated Retinal Disease',
    points: ['eGFR: 92 mL/min (Tier 0)', 'UACR: 14 mg/g (Tier 0)', 'Eye: PDR on exam (Tier 4)'],
    result: 'Final Score M = 4',
    rationale: 'Governed by severe retinal damage despite normal renal indices.',
  },
  {
    title: 'Case 2: Moderate Nephropathy',
    points: ['eGFR: 44 mL/min (Tier 3)', 'UACR: 340 mg/g (Tier 3)', 'Eye: Mild NPDR (Tier 2)'],
    result: 'Final Score M = 3',
    rationale: 'Governed by Stage 3b CKD and overt macroalbuminuria.',
  },
  {
    title: 'Case 3: Completely Normal Organs',
    points: ['eGFR: 104 mL/min (Tier 0)', 'UACR: 8 mg/g (Tier 0)', 'Eye: Normal fundus (Tier 0)'],
    result: 'Final Score M = 0',
    rationale: 'All evaluated organs confirmed within normal reference limits.',
  },
];

export const BLUE_INDEX_REFERENCES = [
  'Chatterjee R, Naskar A, Samajdar SS, Mukherjee S, Joshi S, Karmakar PS. Blue Index as a Comprehensive, Patient-centered Assessment of Care in Diabetic Patients. J Assoc Physicians India (JAPI) 2024; 72(10): e1–e5.',
  'Phatak S, Shah SD, Zinzuwadia P, Saboo B, Panchal D, Hasnani D. The Blue Index – A Comprehensive Diabetes Assessment Score (CHALLENGES APLENTY). J Clin Diabetol (JCD) 2018; 5(2): 1–5.',
  'American Diabetes Association (ADA). Standards of Care in Diabetes—2024 / 2025. Diabetes Care 2024; 47(Suppl. 1): S1–S343.',
];
