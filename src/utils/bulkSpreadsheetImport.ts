import type { ClusterType, Gender, MedicationRow, PatientCRF } from '../types/clinical';
import {
  createBlankPatientCRF,
  recalculatePatientCRF,
} from './clinicalMath';
import {
  matchPatientFromReport,
  type MatchConfidence,
  type ReportFieldChange,
} from './reportAutoSync';
import { getPatientKey } from './statisticalCharts';

export type CrfColumnTarget =
  | 'uhid'
  | 'patientName'
  | 'gender'
  | 'dob'
  | 'age'
  | 'contactNumber'
  | 'bloodGroup'
  | 'dateOfRecruitment'
  | 'visitNo'
  | 'education'
  | 'occupation'
  | 'followUpDate'
  | 'diagnosisMonthYear'
  | 'ageAtDiagnosis'
  | 'familyHistoryDM'
  | 'otherRelevantHistory'
  | 'hypoglycemiaSeverity'
  | 'hypoglycemiaAfterMedication'
  | 'complicationsText'
  | 'smokingStatus'
  | 'tobaccoStatus'
  | 'alcoholIntake'
  | 'physicalActivity'
  | 'dietAdherenceScore'
  | 'followUpRegularityScore'
  | 'vaccinationScore'
  | 'comorbidityScore'
  | 'infectionPresent'
  | 'footUlcer'
  | 'footAmputation'
  | 'heightCm'
  | 'weightKg'
  | 'bmi'
  | 'waistCm'
  | 'hipCm'
  | 'waistHipRatio'
  | 'sbp'
  | 'dbp'
  | 'bpCombined'
  | 'onAntiHtnMeds'
  | 'pulse'
  | 'fbg'
  | 'ppbg'
  | 'rbs'
  | 'hba1c1'
  | 'hba1c2'
  | 'hba1cTarget'
  | 'totalCholesterol'
  | 'triglycerides'
  | 'hdl'
  | 'ldl'
  | 'onStatin'
  | 'hemoglobin'
  | 'pcv'
  | 'mcv'
  | 'mch'
  | 'mchc'
  | 'platelets'
  | 'totalCount'
  | 'serumCreatinine'
  | 'egfr'
  | 'uacr'
  | 'ast'
  | 'alt'
  | 'cPeptide'
  | 'fastingInsulin'
  | 'lsmKpa'
  | 'capDbm'
  | 'iqr'
  | 'iqrMedianPct'
  | 'validMeasurements'
  | 'successRatePct'
  | 'fibrosisInterpretation'
  | 'steatosisInterpretation'
  | 'fibroScanDate'
  | 'fibroScanNotes'
  | 'ksMacrovascular'
  | 'ksMicroRetinopathyTier'
  | 'ksFootNeuropathy'
  | 'ddsMean'
  | 'ddsTotal'
  | 'clusterType'
  | 'medications'
  | 'otherMedications'
  | 'investigatorName'
  | 'investigatorEmail';

export interface CrfFieldDefinition {
  key: CrfColumnTarget;
  label: string;
  group: string;
}

export const CRF_FIELD_DEFINITIONS: CrfFieldDefinition[] = [
  // Identifiers & Demographics
  { key: 'uhid', label: 'UHID / IP No.', group: 'Demographics' },
  { key: 'patientName', label: 'Patient Name', group: 'Demographics' },
  { key: 'gender', label: 'Gender', group: 'Demographics' },
  { key: 'dob', label: 'Date of Birth (YYYY-MM-DD)', group: 'Demographics' },
  { key: 'age', label: 'Age (yrs)', group: 'Demographics' },
  { key: 'contactNumber', label: 'Contact Number', group: 'Demographics' },
  { key: 'bloodGroup', label: 'Blood Group', group: 'Demographics' },
  { key: 'dateOfRecruitment', label: 'Recruitment Date', group: 'Demographics' },
  { key: 'visitNo', label: 'Visit No. (1st/2nd/3rd)', group: 'Demographics' },
  { key: 'education', label: 'Education', group: 'Demographics' },
  { key: 'occupation', label: 'Occupation', group: 'Demographics' },
  { key: 'followUpDate', label: 'Follow-up Date', group: 'Demographics' },

  // Diabetes History & Lifestyle
  { key: 'diagnosisMonthYear', label: 'Diagnosis Month/Year', group: 'History & Lifestyle' },
  { key: 'ageAtDiagnosis', label: 'Age at Diagnosis', group: 'History & Lifestyle' },
  { key: 'familyHistoryDM', label: 'Family History of DM', group: 'History & Lifestyle' },
  { key: 'otherRelevantHistory', label: 'Other Relevant History', group: 'History & Lifestyle' },
  { key: 'hypoglycemiaSeverity', label: 'Hypoglycemia Severity', group: 'History & Lifestyle' },
  { key: 'hypoglycemiaAfterMedication', label: 'Hypoglycemia After Meds', group: 'History & Lifestyle' },
  { key: 'complicationsText', label: 'Complications Notes', group: 'History & Lifestyle' },
  { key: 'smokingStatus', label: 'Smoking Status', group: 'History & Lifestyle' },
  { key: 'tobaccoStatus', label: 'Tobacco Status', group: 'History & Lifestyle' },
  { key: 'alcoholIntake', label: 'Alcohol Intake', group: 'History & Lifestyle' },
  { key: 'physicalActivity', label: 'Physical Activity', group: 'History & Lifestyle' },
  { key: 'dietAdherenceScore', label: 'Diet Adherence Score (0-5)', group: 'History & Lifestyle' },
  { key: 'followUpRegularityScore', label: 'Follow-up Regularity (0-5)', group: 'History & Lifestyle' },
  { key: 'vaccinationScore', label: 'Vaccination Score (0-5)', group: 'History & Lifestyle' },
  { key: 'comorbidityScore', label: 'Comorbidity Score (0-5)', group: 'History & Lifestyle' },
  { key: 'infectionPresent', label: 'Infection Present (Yes/No)', group: 'History & Lifestyle' },
  { key: 'footUlcer', label: 'Foot Ulcer (Yes/No)', group: 'History & Lifestyle' },
  { key: 'footAmputation', label: 'Foot Amputation (Yes/No)', group: 'History & Lifestyle' },

  // Vitals & Anthropometry
  { key: 'heightCm', label: 'Height (cm)', group: 'Vitals & Anthropometry' },
  { key: 'weightKg', label: 'Weight (kg)', group: 'Vitals & Anthropometry' },
  { key: 'bmi', label: 'BMI (kg/m²)', group: 'Vitals & Anthropometry' },
  { key: 'waistCm', label: 'Waist Circumference (cm)', group: 'Vitals & Anthropometry' },
  { key: 'hipCm', label: 'Hip Circumference (cm)', group: 'Vitals & Anthropometry' },
  { key: 'waistHipRatio', label: 'Waist-Hip Ratio (WHR)', group: 'Vitals & Anthropometry' },
  { key: 'sbp', label: 'SBP (mmHg)', group: 'Vitals & Anthropometry' },
  { key: 'dbp', label: 'DBP (mmHg)', group: 'Vitals & Anthropometry' },
  { key: 'bpCombined', label: 'Blood Pressure (SBP/DBP)', group: 'Vitals & Anthropometry' },
  { key: 'onAntiHtnMeds', label: 'On Anti-HTN Meds (Yes/No)', group: 'Vitals & Anthropometry' },
  { key: 'pulse', label: 'Pulse (bpm)', group: 'Vitals & Anthropometry' },

  // Glycemic & Lipids
  { key: 'fbg', label: 'FBG / FBS (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'ppbg', label: 'PPBG / PPBS (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'rbs', label: 'RBS (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'hba1c1', label: '1st HbA1c (%)', group: 'Glycemic & Lipids' },
  { key: 'hba1c2', label: '2nd HbA1c (%)', group: 'Glycemic & Lipids' },
  { key: 'hba1cTarget', label: 'HbA1c Target (%)', group: 'Glycemic & Lipids' },
  { key: 'totalCholesterol', label: 'Total Cholesterol (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'triglycerides', label: 'Triglycerides (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'hdl', label: 'HDL (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'ldl', label: 'LDL (mg/dL)', group: 'Glycemic & Lipids' },
  { key: 'onStatin', label: 'On Statin (Yes/No)', group: 'Glycemic & Lipids' },

  // Haematology
  { key: 'hemoglobin', label: 'Hemoglobin (g/dL)', group: 'Haematology' },
  { key: 'pcv', label: 'PCV (%)', group: 'Haematology' },
  { key: 'mcv', label: 'MCV (fL)', group: 'Haematology' },
  { key: 'mch', label: 'MCH (pg)', group: 'Haematology' },
  { key: 'mchc', label: 'MCHC (g/dL)', group: 'Haematology' },
  { key: 'platelets', label: 'Platelets (10^3/µL)', group: 'Haematology' },
  { key: 'totalCount', label: 'Total WBC Count', group: 'Haematology' },

  // Hepatic, Renal & Beta-Cell
  { key: 'serumCreatinine', label: 'Serum Creatinine (mg/dL)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'egfr', label: 'eGFR (mL/min/1.73m²)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'uacr', label: 'UACR (mg/g)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'ast', label: 'AST / SGOT (U/L)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'alt', label: 'ALT / SGPT (U/L)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'cPeptide', label: 'C-Peptide (ng/mL)', group: 'Renal, Hepatic & Beta-Cell' },
  { key: 'fastingInsulin', label: 'Fasting Insulin (µIU/mL)', group: 'Renal, Hepatic & Beta-Cell' },

  // FibroScan
  { key: 'fibroScanDate', label: 'FibroScan Date', group: 'FibroScan' },
  { key: 'lsmKpa', label: 'FibroScan LSM (kPa)', group: 'FibroScan' },
  { key: 'capDbm', label: 'FibroScan CAP (dB/m)', group: 'FibroScan' },
  { key: 'iqr', label: 'FibroScan IQR', group: 'FibroScan' },
  { key: 'iqrMedianPct', label: 'FibroScan IQR/Med (%)', group: 'FibroScan' },
  { key: 'validMeasurements', label: 'Valid Measurements', group: 'FibroScan' },
  { key: 'successRatePct', label: 'Success Rate (%)', group: 'FibroScan' },
  { key: 'fibrosisInterpretation', label: 'Fibrosis Stage (F0-F4)', group: 'FibroScan' },
  { key: 'steatosisInterpretation', label: 'Steatosis Grade (S0-S3)', group: 'FibroScan' },
  { key: 'fibroScanNotes', label: 'FibroScan Notes', group: 'FibroScan' },

  // KS, DDS-17, Medications & Cluster
  { key: 'ksMacrovascular', label: 'KS Macrovascular (0-5)', group: 'KS, DDS-17 & Cluster' },
  { key: 'ksMicroRetinopathyTier', label: 'KS Retinopathy Tier (0-5)', group: 'KS, DDS-17 & Cluster' },
  { key: 'ksFootNeuropathy', label: 'KS Foot/Neuropathy (0-5)', group: 'KS, DDS-17 & Cluster' },
  { key: 'ddsMean', label: 'DDS-17 Mean', group: 'KS, DDS-17 & Cluster' },
  { key: 'ddsTotal', label: 'DDS-17 Total', group: 'KS, DDS-17 & Cluster' },
  { key: 'clusterType', label: 'Phenotype Cluster (SIDD/SIRD/CIRDD/MARD)', group: 'KS, DDS-17 & Cluster' },
  { key: 'medications', label: 'Antidiabetic Medications', group: 'Medications & Attribution' },
  { key: 'otherMedications', label: 'Concomitant Medications', group: 'Medications & Attribution' },
  { key: 'investigatorName', label: 'Submitted / Investigator Name', group: 'Medications & Attribution' },
  { key: 'investigatorEmail', label: 'Submitted / Investigator Email', group: 'Medications & Attribution' },
];

const HEADER_SYNONYMS: Array<[CrfColumnTarget, string[]]> = [
  ['uhid', ['uhid', 'uhidipno', 'ipno', 'mrd', 'mrdno', 'mrno', 'hospitalid', 'regno', 'registrationno']],
  ['patientName', ['patientname', 'fullname', 'name', 'ptname', 'participantname', 'subjectname']],
  ['gender', ['gender', 'sex']],
  ['dob', ['dob', 'dateofbirth', 'birthdate']],
  ['age', ['age', 'ageyrs', 'patientage', 'years']],
  ['contactNumber', ['contact', 'contactnumber', 'phone', 'phonenumber', 'mobile', 'mobileno', 'mobilenumber']],
  ['bloodGroup', ['bloodgroup', 'bg', 'bloodtype', 'abo']],
  ['dateOfRecruitment', ['recruitmentdate', 'dateofrecruitment', 'enrolleddate', 'enrollmentdate', 'visitdate', 'date']],
  ['visitNo', ['visitno', 'visitnumber', 'visit']],
  ['education', ['education', 'qualification']],
  ['occupation', ['occupation', 'job', 'profession']],
  ['followUpDate', ['followupdate', 'nextfollowup', 'fudate', 'nextvisitdate', 'nextvisit']],
  ['diagnosisMonthYear', ['diagnosismonthyear', 'dmonset', 'diagnosisdate', 'yearofdiagnosis']],
  ['ageAtDiagnosis', ['ageatdiagnosis', 'diagage', 'ageonset']],
  ['familyHistoryDM', ['familyhistorydm', 'familyhistory', 'fhdm', 'fh']],
  ['otherRelevantHistory', ['otherrelevanthistory', 'medicalhistory', 'pasthistory', 'comorbidities']],
  ['hypoglycemiaSeverity', ['hypoglycemiaseverity', 'hypoglycemia', 'hypo']],
  ['hypoglycemiaAfterMedication', ['hypoglycemiaaftermedication', 'hypoaftermed']],
  ['complicationsText', ['complications', 'complicationstext', 'dmcomplications']],
  ['smokingStatus', ['smokingstatus', 'smoking', 'smoker']],
  ['tobaccoStatus', ['tobaccostatus', 'tobacco']],
  ['alcoholIntake', ['alcoholintake', 'alcohol']],
  ['physicalActivity', ['physicalactivity', 'activity', 'exercise']],
  ['dietAdherenceScore', ['dietadherencescore', 'dietscore', 'diet']],
  ['followUpRegularityScore', ['followupregularityscore', 'followupregularity', 'regularity']],
  ['vaccinationScore', ['vaccinationscore', 'vaccination']],
  ['comorbidityScore', ['comorbidityscore']],
  ['infectionPresent', ['infectionpresent', 'infection']],
  ['footUlcer', ['footulcer', 'ulcer']],
  ['footAmputation', ['footamputation', 'amputation']],
  ['heightCm', ['heightcm', 'height', 'ht']],
  ['weightKg', ['weightkg', 'weight', 'wt']],
  ['bmi', ['bmi', 'bodymassindex']],
  ['waistCm', ['waistcm', 'waist', 'waistcircumference', 'wc']],
  ['hipCm', ['hipcm', 'hip', 'hipcircumference', 'hc']],
  ['waistHipRatio', ['whr', 'waisthipratio']],
  ['bpCombined', ['bp', 'bloodpressure', 'bp1', 'bpsysdia']],
  ['sbp', ['sbp', 'systolicbp', 'systolic']],
  ['dbp', ['dbp', 'diastolicbp', 'diastolic']],
  ['onAntiHtnMeds', ['onantihtnmeds', 'antihtn', 'hypertensionmeds', 'onbpmeds']],
  ['pulse', ['pulse', 'hr', 'heartrate', 'pulserate']],
  ['fbg', ['fbg', 'fbs', 'fastingbloodglucose', 'fastingglucose', 'fastingbloodsugar', 'fpg']],
  ['ppbg', ['ppbg', 'ppbs', 'postprandialglucose', 'ppglucose', 'postprandialbloodglucose', 'ppg']],
  ['rbs', ['rbs', 'randombloodsugar', 'randomglucose']],
  ['hba1c1', ['1sthba1c', 'hba1c1', 'baselinehba1c', 'hba1c', 'a1c', 'glycatedhemoglobin']],
  ['hba1c2', ['2ndhba1c', 'hba1c2', 'followuphba1c', 'secondhba1c', 'repeathba1c']],
  ['hba1cTarget', ['hba1ctarget', 'targethba1c']],
  ['totalCholesterol', ['totalcholesterol', 'tc', 'cholesterol']],
  ['triglycerides', ['triglycerides', 'tg', 'trigs']],
  ['hdl', labelSynonyms('hdl', 'hdlcholesterol', 'hdlc')],
  ['ldl', labelSynonyms('ldl', 'ldlcholesterol', 'ldlc')],
  ['onStatin', ['onstatin', 'statin', 'statintherapy']],
  ['hemoglobin', ['hemoglobin', 'hb', 'hgb']],
  ['pcv', ['pcv', 'hematocrit', 'hct']],
  ['mcv', ['mcv']],
  ['mch', ['mch']],
  ['mchc', ['mchc']],
  ['platelets', ['platelets', 'plateletcount', 'plt']],
  ['totalCount', ['totalcount', 'wbc', 'wbccount', 'tlc', 'leukocytes']],
  ['serumCreatinine', ['creatinine', 'serumcreatinine', 'screatinine', 'screat', 'creat', 'cr']],
  ['egfr', ['egfr', 'gfr', 'ckdepi']],
  ['uacr', ['uacr', 'albumincreatinineratio', 'microalbuminuria', 'microalbumin', 'acr']],
  ['ast', ['ast', 'sgot']],
  ['alt', ['alt', 'sgpt']],
  ['cPeptide', ['cpeptide', 'fastingcpeptide', 'cpep']],
  ['fastingInsulin', ['fastinginsulin', 'insulin', 'sinsulin']],
  ['fibroScanDate', ['fibroscandate']],
  ['lsmKpa', ['fibroscanlsm', 'lsmkpa', 'lsm', 'stiffness', 'liverstiffness', 'kpa']],
  ['capDbm', ['fibroscancap', 'capdbm', 'cap', 'steatosisdbm']],
  ['iqr', ['iqr']],
  ['iqrMedianPct', ['iqrmedianpct', 'iqrmed']],
  ['validMeasurements', ['validmeasurements']],
  ['successRatePct', ['successratepct', 'successrate']],
  ['fibrosisInterpretation', ['fibrosisinterpretation', 'fibrosisstage', 'fibrosis']],
  ['steatosisInterpretation', ['steatosisinterpretation', 'steatosisgrade', 'steatosis']],
  ['fibroScanNotes', ['fibroscannotes']],
  ['ksMacrovascular', ['ksmacrovascular', 'macrovascularks']],
  ['ksMicroRetinopathyTier', ['ksretinopathy', 'retinopathytier', 'fundoscopytier']],
  ['ksFootNeuropathy', ['ksfootneuropathy', 'footneuropathyks']],
  ['ddsMean', ['dds17mean', 'ddsmean', 'ddsscore', 'distressmean']],
  ['ddsTotal', ['dds17total', 'ddstotal']],
  ['clusterType', ['phenotypecluster', 'clustertype', 'cluster', 'phenotype', 'subgroup']],
  ['medications', ['medications', 'antidiabeticmedications', 'antidiabeticdrugs', 'drugs', 'dmmeds', 'treatment', 'rx']],
  ['otherMedications', ['othermedications', 'concomitantmedications', 'concomitantdrugs', 'othermeds']],
  ['investigatorName', ['investigatorname', 'submittedby', 'doctorname', 'clinician']],
  ['investigatorEmail', ['investigatoremail', 'submittedemail', 'doctoremail']],
];

function labelSynonyms(...vals: string[]): string[] {
  return vals;
}

export function normalizeHeaderToken(header: string): string {
  return header
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Automatically maps raw Excel / Google Sheet column headers to structured PatientCRF fields.
 * Supports exported ClinicoData headers 1:1 as well as common clinical abbreviations.
 */
export function autoMapSpreadsheetHeaders(
  headers: string[]
): Record<number, CrfColumnTarget | ''> {
  const mapping: Record<number, CrfColumnTarget | ''> = {};
  const usedTargets = new Set<CrfColumnTarget>();

  // First pass: exact normalized token match
  headers.forEach((raw, idx) => {
    const token = normalizeHeaderToken(raw || '');
    if (!token) {
      mapping[idx] = '';
      return;
    }
    for (const [target, aliases] of HEADER_SYNONYMS) {
      if (usedTargets.has(target)) continue;
      if (aliases.includes(token)) {
        mapping[idx] = target;
        usedTargets.add(target);
        return;
      }
    }
  });

  // Second pass: safe substring / startsWith match for remaining unmapped columns
  headers.forEach((raw, idx) => {
    if (mapping[idx]) return;
    const token = normalizeHeaderToken(raw || '');
    if (!token || token.length < 3) {
      mapping[idx] = '';
      return;
    }
    for (const [target, aliases] of HEADER_SYNONYMS) {
      if (usedTargets.has(target)) continue;
      if (aliases.some((alias) => alias.length >= 4 && token.includes(alias))) {
        mapping[idx] = target;
        usedTargets.add(target);
        return;
      }
    }
    mapping[idx] = '';
  });

  return mapping;
}

export interface ParsedSpreadsheetGrid {
  sheetName: string;
  headers: string[];
  rows: string[][];
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date && !Number.isNaN(val.getTime())) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

/** Normalizes a 2D sheet matrix (from Excel or Google Sheets API) into clean headers and data rows */
export function parseSpreadsheetGrid(
  rawGrid: unknown[][],
  sheetName = 'Sheet1'
): ParsedSpreadsheetGrid {
  const cleaned = rawGrid
    .map((row) => (Array.isArray(row) ? row.map(cellToString) : []))
    .filter((row) => row.some((cell) => cell !== ''));

  if (cleaned.length === 0) {
    return { sheetName, headers: [], rows: [] };
  }

  // Pick the first row that contains at least 2 non-empty cells (or row 0) as header
  const headerIdx = cleaned.findIndex((r) => r.filter(Boolean).length >= 2);
  const resolvedHeaderIdx = headerIdx >= 0 ? headerIdx : 0;
  const rawHeaders = cleaned[resolvedHeaderIdx];
  const maxCols = Math.max(
    rawHeaders.length,
    ...cleaned.slice(resolvedHeaderIdx + 1).map((r) => r.length)
  );

  const headers = Array.from({ length: maxCols }, (_, i) => rawHeaders[i] || `Column ${i + 1}`);
  const rows = cleaned.slice(resolvedHeaderIdx + 1).map((row) =>
    Array.from({ length: maxCols }, (_, i) => row[i] || '')
  );

  return { sheetName, headers, rows };
}

/** Converts numeric cell or unit-suffixed string ("8.4%", "142 mg/dL") to number or null */
export function parseNumberFlexible(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-' || /^(na|n\/a|nil|null|pending)$/i.test(trimmed)) {
    return null;
  }
  const cleaned = trimmed.replace(/,/g, '');
  const match = /-?\d+(\.\d+)?/.exec(cleaned);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

/** Parses ISO dates, DD/MM/YYYY, DD-MM-YYYY, month names, and Excel serial dates into YYYY-MM-DD */
export function parseDateFlexible(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || trimmed === '-') return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  // Excel serial date number (approx 1954..2064)
  if (/^\d{5}(\.\d+)?$/.test(trimmed)) {
    const serial = Math.floor(Number(trimmed));
    if (serial >= 20000 && serial <= 65000) {
      const utcMs = (serial - 25569) * 86400 * 1000;
      const d = new Date(utcMs);
      if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY (Indian clinic standard)
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (dmy) {
    let part1 = parseInt(dmy[1], 10);
    let part2 = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += year >= 40 ? 1900 : 2000;
    // If second part > 12, treat as MM/DD/YYYY
    let day = part1;
    let month = part2;
    if (part2 > 12 && part1 <= 12) {
      month = part1;
      day = part2;
    }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD
  const ymd = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(trimmed);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() >= 1900 && parsed.getFullYear() <= 2100) {
    return parsed.toISOString().slice(0, 10);
  }
  return '';
}

function normalizeGenderValue(raw: string): Gender {
  const s = raw.trim().toLowerCase();
  if (!s) return '';
  if (s === 'm' || s.startsWith('male')) return 'Male';
  if (s === 'f' || s.startsWith('female')) return 'Female';
  if (s === 'o' || s.startsWith('other')) return 'Other';
  return '';
}

function normalizeBooleanValue(raw: string): boolean | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (['yes', 'y', 'true', '1', 'on'].includes(s)) return true;
  if (['no', 'n', 'false', '0', 'off'].includes(s)) return false;
  return null;
}

function normalizeYesNo(raw: string): 'Yes' | 'No' | '' {
  const b = normalizeBooleanValue(raw);
  if (b === true) return 'Yes';
  if (b === false) return 'No';
  return '';
}

function normalizeClusterValue(raw: string): ClusterType | '' {
  const u = raw.trim().toUpperCase();
  if (u === 'SIDD' || u === 'SIRD' || u === 'CIRDD' || u === 'MARD') return u;
  return '';
}

export function parseMedicationsText(raw: string, idPrefix = 'xlsx-med'): MedicationRow[] {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '—' || /^(none|nil|na|n\/a)$/i.test(trimmed)) return [];
  const entries = trimmed
    .split(/[,;\n|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const rows: MedicationRow[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const freqMatch = /\b(OD|BD|TDS|TID|QID|HS|SOS|PRN|weekly|once daily|twice daily)\b/i.exec(entry);
    const doseMatch = /\b(\d+(?:\.\d+)?\s*(?:mg|mcg|g|iu|u|ml)(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg))?)\b/i.exec(entry);

    let drugName = entry;
    if (doseMatch) drugName = drugName.replace(doseMatch[0], '');
    if (freqMatch) drugName = drugName.replace(freqMatch[0], '');
    drugName = drugName.replace(/\s+/g, ' ').trim();
    if (!drugName) drugName = entry;

    rows.push({
      id: `${idPrefix}-${i + 1}`,
      drugName,
      dose: doseMatch ? doseMatch[1].trim() : '',
      route: '',
      frequency: freqMatch ? freqMatch[1].toUpperCase() : '',
      status: 'Current',
    });
  }
  return rows;
}

export interface BulkSyncRowPlan {
  rowIndex: number;
  action: 'update' | 'create' | 'unchanged' | 'skipped';
  matchedExistingKey?: string;
  matchReason: string;
  confidence: MatchConfidence;
  patient: PatientCRF;
  changes: ReportFieldChange[];
  rawName: string;
  rawId: string;
  skipReason?: string;
}

export interface BulkSyncPlan {
  items: BulkSyncRowPlan[];
  summary: {
    totalRows: number;
    toUpdate: number;
    toCreate: number;
    unchanged: number;
    skipped: number;
    totalFieldChanges: number;
  };
}

function setMetricValue(
  target: PatientCRF,
  key:
    | 'fbg'
    | 'ppbg'
    | 'rbs'
    | 'hba1c1'
    | 'hba1c2'
    | 'totalCholesterol'
    | 'triglycerides'
    | 'hdl'
    | 'ldl'
    | 'hemoglobin'
    | 'pcv'
    | 'mcv'
    | 'mch'
    | 'mchc'
    | 'platelets'
    | 'totalCount'
    | 'serumCreatinine'
    | 'uacr'
    | 'ast'
    | 'alt'
    | 'cPeptide'
    | 'fastingInsulin',
  label: string,
  section: string,
  val: number,
  defaultUnit: string,
  changes: ReportFieldChange[]
) {
  const prev = target[key];
  const prevVal = prev?.value ?? null;
  if (prevVal === val) return;
  changes.push({
    fieldLabel: label,
    section,
    previousValue: prevVal === null || prevVal === undefined ? 'Empty' : `${prevVal}`,
    newValue: `${val}${prev?.unit || defaultUnit ? ` ${prev?.unit || defaultUnit}` : ''}`,
  });
  target[key] = {
    ...(prev || { date: '', unit: defaultUnit }),
    value: val,
    unit: prev?.unit || defaultUnit,
  } as never;
}

function applyRowFieldsToPatient(
  base: PatientCRF,
  rowValues: Partial<Record<CrfColumnTarget, string>>,
  rowIndex: number
): { nextPatient: PatientCRF; changes: ReportFieldChange[] } {
  const next: PatientCRF = {
    ...base,
    dhsDomains: { ...base.dhsDomains },
    dhsDomainOverrides: { ...(base.dhsDomainOverrides ?? {}) },
    ddsItems: [...base.ddsItems],
    medicationVisits: (base.medicationVisits || []).map((mv) => ({
      ...mv,
      drugs: mv.drugs.map((d) => ({ ...d })),
    })),
    otherMedications: [...(base.otherMedications || [])],
    attachments: [...(base.attachments || [])],
  };

  const changes: ReportFieldChange[] = [];

  const setText = (
    field:
      | 'uhid'
      | 'patientName'
      | 'contactNumber'
      | 'bloodGroup'
      | 'occupation'
      | 'diagnosisMonthYear'
      | 'otherRelevantHistory'
      | 'complicationsText'
      | 'fibroScanNotes'
      | 'investigatorName'
      | 'investigatorEmail',
    label: string,
    section: string,
    val?: string
  ) => {
    const trimmed = (val || '').trim();
    if (!trimmed || trimmed === '—') return;
    if (next[field] === trimmed) return;
    changes.push({
      fieldLabel: label,
      section,
      previousValue: next[field] || 'Empty',
      newValue: trimmed,
    });
    next[field] = trimmed;
  };

  const setDateField = (
    field: 'dob' | 'dateOfRecruitment' | 'followUpDate' | 'fibroScanDate',
    label: string,
    section: string,
    raw?: string
  ) => {
    const parsed = parseDateFlexible(raw || '');
    if (!parsed || next[field] === parsed) return;
    changes.push({
      fieldLabel: label,
      section,
      previousValue: next[field] || 'Empty',
      newValue: parsed,
    });
    next[field] = parsed;
  };

  const setNumberField = (
    field:
      | 'age'
      | 'ageAtDiagnosis'
      | 'dietAdherenceScore'
      | 'followUpRegularityScore'
      | 'vaccinationScore'
      | 'comorbidityScore'
      | 'sbp'
      | 'dbp'
      | 'pulse'
      | 'hba1cTarget'
      | 'lsmKpa'
      | 'capDbm'
      | 'iqr'
      | 'iqrMedianPct'
      | 'validMeasurements'
      | 'successRatePct'
      | 'ksMacrovascular'
      | 'ksMicroRetinopathyTier'
      | 'ksFootNeuropathy',
    label: string,
    section: string,
    raw?: string
  ) => {
    const num = parseNumberFlexible(raw || '');
    if (num === null || next[field] === num) return;
    changes.push({
      fieldLabel: label,
      section,
      previousValue: next[field] === null || next[field] === undefined ? 'Empty' : `${next[field]}`,
      newValue: `${num}`,
    });
    next[field] = num as never;
  };

  // Demographics
  setText('uhid', 'UHID', 'Demographics', rowValues.uhid);
  setText('patientName', 'Patient Name', 'Demographics', rowValues.patientName);
  if (rowValues.gender) {
    const g = normalizeGenderValue(rowValues.gender);
    if (g && next.gender !== g) {
      changes.push({
        fieldLabel: 'Gender',
        section: 'Demographics',
        previousValue: next.gender || 'Empty',
        newValue: g,
      });
      next.gender = g;
    }
  }
  setDateField('dob', 'Date of Birth', 'Demographics', rowValues.dob);
  setNumberField('age', 'Age', 'Demographics', rowValues.age);
  setText('contactNumber', 'Contact Number', 'Demographics', rowValues.contactNumber);
  setText('bloodGroup', 'Blood Group', 'Demographics', rowValues.bloodGroup);
  setDateField('dateOfRecruitment', 'Recruitment Date', 'Demographics', rowValues.dateOfRecruitment);
  if (rowValues.visitNo) {
    const v = rowValues.visitNo.trim();
    const mappedVisit: PatientCRF['visitNo'] = v.startsWith('1')
      ? '1st'
      : v.startsWith('2')
      ? '2nd'
      : v.startsWith('3')
      ? '3rd'
      : '';
    if (mappedVisit && next.visitNo !== mappedVisit) {
      changes.push({
        fieldLabel: 'Visit No.',
        section: 'Demographics',
        previousValue: next.visitNo || 'Empty',
        newValue: mappedVisit,
      });
      next.visitNo = mappedVisit;
    }
  }
  if (rowValues.education) {
    const ed = rowValues.education.trim();
    if (
      (ed === '<10th' || ed === '10th' || ed === '12th' || ed === 'Higher Education') &&
      next.education !== ed
    ) {
      changes.push({
        fieldLabel: 'Education',
        section: 'Demographics',
        previousValue: next.education || 'Empty',
        newValue: ed,
      });
      next.education = ed;
    }
  }
  setText('occupation', 'Occupation', 'Demographics', rowValues.occupation);
  setDateField('followUpDate', 'Follow-up Date', 'Demographics', rowValues.followUpDate);

  // History & Lifestyle
  setText('diagnosisMonthYear', 'Diagnosis Month/Year', 'Diabetes History', rowValues.diagnosisMonthYear);
  setNumberField('ageAtDiagnosis', 'Age at Diagnosis', 'Diabetes History', rowValues.ageAtDiagnosis);
  if (rowValues.familyHistoryDM) {
    const fh = normalizeYesNo(rowValues.familyHistoryDM);
    if (fh && next.familyHistoryDM !== fh) {
      changes.push({
        fieldLabel: 'Family History DM',
        section: 'Diabetes History',
        previousValue: next.familyHistoryDM || 'Empty',
        newValue: fh,
      });
      next.familyHistoryDM = fh;
    }
  }
  setText('otherRelevantHistory', 'Other History', 'Diabetes History', rowValues.otherRelevantHistory);
  setText('complicationsText', 'Complications', 'Diabetes History', rowValues.complicationsText);
  if (rowValues.hypoglycemiaSeverity) {
    const rawH = rowValues.hypoglycemiaSeverity.trim();
    if (rawH && next.hypoglycemiaSeverity !== rawH) {
      const normalized =
        rawH === 'No' ||
        rawH === 'Level 1 Asymptomatic' ||
        rawH === 'Level 1 Symptomatic' ||
        rawH === 'Level 2' ||
        rawH === 'Level 3' ||
        rawH === 'Recurrent Level 3 or LOC'
          ? rawH
          : /^no$/i.test(rawH)
          ? 'No'
          : '';
      if (normalized) {
        changes.push({
          fieldLabel: 'Hypoglycemia Severity',
          section: 'Diabetes History',
          previousValue: next.hypoglycemiaSeverity || 'Empty',
          newValue: normalized,
        });
        next.hypoglycemiaSeverity = normalized;
      }
    }
  }
  if (rowValues.hypoglycemiaAfterMedication) {
    const val = rowValues.hypoglycemiaAfterMedication.trim();
    const mapped =
      /^yes$/i.test(val) ? 'Yes' : /^no$/i.test(val) ? 'No' : /not known/i.test(val) ? 'Not Known' : '';
    if (mapped && next.hypoglycemiaAfterMedication !== mapped) {
      next.hypoglycemiaAfterMedication = mapped;
    }
  }
  if (rowValues.smokingStatus) {
    const s = rowValues.smokingStatus.trim();
    const mapped: PatientCRF['smokingStatus'] =
      /never/i.test(s) ? 'Never' : /ex/i.test(s) ? 'Ex-smoker >1yr' : /current|yes/i.test(s) ? 'Current' : '';
    if (mapped && next.smokingStatus !== mapped) next.smokingStatus = mapped;
  }
  if (rowValues.tobaccoStatus) {
    const s = rowValues.tobaccoStatus.trim();
    const mapped: PatientCRF['tobaccoStatus'] =
      /never/i.test(s) ? 'Never' : /free/i.test(s) ? 'Tobacco-free >1yr' : /current|yes/i.test(s) ? 'Current' : '';
    if (mapped && next.tobaccoStatus !== mapped) next.tobaccoStatus = mapped;
  }
  if (rowValues.alcoholIntake) {
    const s = rowValues.alcoholIntake.trim();
    const mapped: PatientCRF['alcoholIntake'] =
      /occasion/i.test(s) ? 'Occasionally' : /^yes$/i.test(s) ? 'Yes' : /^no$/i.test(s) ? 'No' : '';
    if (mapped && next.alcoholIntake !== mapped) next.alcoholIntake = mapped;
  }
  if (rowValues.physicalActivity) {
    const p = rowValues.physicalActivity.trim();
    const validActivities: PatientCRF['physicalActivity'][] = [
      '>=150 min/week',
      '90-149 min/week',
      '30-89 min/week',
      'Minimal',
      'Sedentary',
      'Unwilling/Bedridden',
    ];
    const matched = validActivities.find((a) => a.toLowerCase() === p.toLowerCase());
    if (matched && next.physicalActivity !== matched) next.physicalActivity = matched;
  }
  setNumberField('dietAdherenceScore', 'Diet Adherence Score', 'Social & Lifestyle', rowValues.dietAdherenceScore);
  setNumberField('followUpRegularityScore', 'Follow-up Regularity', 'Social & Lifestyle', rowValues.followUpRegularityScore);
  setNumberField('vaccinationScore', 'Vaccination Score', 'Social & Lifestyle', rowValues.vaccinationScore);
  setNumberField('comorbidityScore', 'Comorbidity Score', 'Social & Lifestyle', rowValues.comorbidityScore);
  if (rowValues.infectionPresent) {
    const yn = normalizeYesNo(rowValues.infectionPresent);
    if (yn) next.infectionPresent = yn;
  }
  if (rowValues.footUlcer) {
    const yn = normalizeYesNo(rowValues.footUlcer);
    if (yn) next.footUlcer = yn;
  }
  if (rowValues.footAmputation) {
    const yn = normalizeYesNo(rowValues.footAmputation);
    if (yn) next.footAmputation = yn;
  }

  // Anthropometry & Vitals
  if (rowValues.heightCm) {
    const h = parseNumberFlexible(rowValues.heightCm);
    if (h !== null && h > 0 && next.heightValue !== h) {
      changes.push({
        fieldLabel: 'Height',
        section: 'Anthropometry',
        previousValue: next.heightValue !== null ? `${next.heightValue} ${next.heightUnit}` : 'Empty',
        newValue: `${h} cm`,
      });
      next.heightValue = h;
      next.heightUnit = 'cm';
    }
  }
  if (rowValues.weightKg) {
    const w = parseNumberFlexible(rowValues.weightKg);
    if (w !== null && w > 0 && next.weightValue !== w) {
      changes.push({
        fieldLabel: 'Weight',
        section: 'Anthropometry',
        previousValue: next.weightValue !== null ? `${next.weightValue} ${next.weightUnit}` : 'Empty',
        newValue: `${w} kg`,
      });
      next.weightValue = w;
      next.weightUnit = 'kg';
    }
  }
  if (rowValues.bmi) {
    const bmiVal = parseNumberFlexible(rowValues.bmi);
    if (bmiVal !== null && next.heightValue === null && next.weightValue === null && next.bmi !== bmiVal) {
      changes.push({
        fieldLabel: 'BMI',
        section: 'Anthropometry',
        previousValue: next.bmi !== null ? `${next.bmi}` : 'Empty',
        newValue: `${bmiVal}`,
      });
      next.bmi = bmiVal;
      next.bmiManualOverride = true;
    }
  }
  if (rowValues.waistCm) {
    const wc = parseNumberFlexible(rowValues.waistCm);
    if (wc !== null && wc > 0 && next.waistValue !== wc) {
      changes.push({
        fieldLabel: 'Waist',
        section: 'Anthropometry',
        previousValue: next.waistValue !== null ? `${next.waistValue}` : 'Empty',
        newValue: `${wc} cm`,
      });
      next.waistValue = wc;
      next.waistUnit = 'cm';
    }
  }
  if (rowValues.hipCm) {
    const hc = parseNumberFlexible(rowValues.hipCm);
    if (hc !== null && hc > 0 && next.hipValue !== hc) {
      changes.push({
        fieldLabel: 'Hip',
        section: 'Anthropometry',
        previousValue: next.hipValue !== null ? `${next.hipValue}` : 'Empty',
        newValue: `${hc} cm`,
      });
      next.hipValue = hc;
      next.hipUnit = 'cm';
    }
  }
  if (rowValues.waistHipRatio) {
    const whr = parseNumberFlexible(rowValues.waistHipRatio);
    if (whr !== null && next.waistValue === null && next.hipValue === null && next.waistHipRatio !== whr) {
      next.waistHipRatio = whr;
      next.whrManualOverride = true;
    }
  }
  if (rowValues.bpCombined) {
    const bpMatch = /(\d{2,3})\s*[/\\-]\s*(\d{2,3})/.exec(rowValues.bpCombined);
    if (bpMatch) {
      const sbp = Number(bpMatch[1]);
      const dbp = Number(bpMatch[2]);
      if (next.sbp !== sbp) {
        changes.push({
          fieldLabel: 'SBP',
          section: 'Vitals',
          previousValue: next.sbp !== null ? `${next.sbp}` : 'Empty',
          newValue: `${sbp} mmHg`,
        });
        next.sbp = sbp;
      }
      if (next.dbp !== dbp) {
        changes.push({
          fieldLabel: 'DBP',
          section: 'Vitals',
          previousValue: next.dbp !== null ? `${next.dbp}` : 'Empty',
          newValue: `${dbp} mmHg`,
        });
        next.dbp = dbp;
      }
    }
  }
  setNumberField('sbp', 'SBP (mmHg)', 'Vitals', rowValues.sbp);
  setNumberField('dbp', 'DBP (mmHg)', 'Vitals', rowValues.dbp);
  if (rowValues.onAntiHtnMeds) {
    const b = normalizeBooleanValue(rowValues.onAntiHtnMeds);
    if (b !== null) next.onAntiHtnMeds = b;
  }
  setNumberField('pulse', 'Pulse (bpm)', 'Vitals', rowValues.pulse);

  // Glycemic & Lipids
  const setLabIfValid = (
    raw: string | undefined,
    key: Parameters<typeof setMetricValue>[1],
    label: string,
    section: string,
    unit: string
  ) => {
    if (!raw) return;
    const val = parseNumberFlexible(raw);
    if (val === null) return;
    setMetricValue(next, key, label, section, val, unit, changes);
  };

  setLabIfValid(rowValues.fbg, 'fbg', 'FBG', 'Glycemic Profile', 'mg/dL');
  setLabIfValid(rowValues.ppbg, 'ppbg', 'PPBG', 'Glycemic Profile', 'mg/dL');
  setLabIfValid(rowValues.rbs, 'rbs', 'RBS', 'Glycemic Profile', 'mg/dL');
  setLabIfValid(rowValues.hba1c1, 'hba1c1', '1st HbA1c', 'Glycemic Profile', '%');
  setLabIfValid(rowValues.hba1c2, 'hba1c2', '2nd HbA1c', 'Glycemic Profile', '%');
  setNumberField('hba1cTarget', 'HbA1c Target', 'Glycemic Profile', rowValues.hba1cTarget);
  setLabIfValid(rowValues.totalCholesterol, 'totalCholesterol', 'Total Cholesterol', 'Lipid Profile', 'mg/dL');
  setLabIfValid(rowValues.triglycerides, 'triglycerides', 'Triglycerides', 'Lipid Profile', 'mg/dL');
  setLabIfValid(rowValues.hdl, 'hdl', 'HDL', 'Lipid Profile', 'mg/dL');
  setLabIfValid(rowValues.ldl, 'ldl', 'LDL', 'Lipid Profile', 'mg/dL');
  if (rowValues.onStatin) {
    const b = normalizeBooleanValue(rowValues.onStatin);
    if (b !== null) next.onStatin = b;
  }

  // Haematology
  setLabIfValid(rowValues.hemoglobin, 'hemoglobin', 'Hemoglobin', 'Haematology', 'g/dL');
  setLabIfValid(rowValues.pcv, 'pcv', 'PCV', 'Haematology', '%');
  setLabIfValid(rowValues.mcv, 'mcv', 'MCV', 'Haematology', 'fL');
  setLabIfValid(rowValues.mch, 'mch', 'MCH', 'Haematology', 'pg');
  setLabIfValid(rowValues.mchc, 'mchc', 'MCHC', 'Haematology', 'g/dL');
  setLabIfValid(rowValues.platelets, 'platelets', 'Platelets', 'Haematology', '10^3/µL');
  setLabIfValid(rowValues.totalCount, 'totalCount', 'Total Count', 'Haematology', 'cells/mm³');

  // Renal, Hepatic & Beta-Cell
  setLabIfValid(rowValues.serumCreatinine, 'serumCreatinine', 'Serum Creatinine', 'Hepatic & Renal', 'mg/dL');
  if (rowValues.egfr) {
    const egfrVal = parseNumberFlexible(rowValues.egfr);
    if (egfrVal !== null && next.serumCreatinine.value === null && next.egfr !== egfrVal) {
      changes.push({
        fieldLabel: 'eGFR',
        section: 'Hepatic & Renal',
        previousValue: next.egfr !== null ? `${next.egfr}` : 'Empty',
        newValue: `${egfrVal}`,
      });
      next.egfr = egfrVal;
      next.egfrManualOverride = true;
    }
  }
  setLabIfValid(rowValues.uacr, 'uacr', 'UACR', 'Hepatic & Renal', 'mg/g');
  setLabIfValid(rowValues.ast, 'ast', 'AST (SGOT)', 'Hepatic & Renal', 'U/L');
  setLabIfValid(rowValues.alt, 'alt', 'ALT (SGPT)', 'Hepatic & Renal', 'U/L');
  setLabIfValid(rowValues.cPeptide, 'cPeptide', 'C-Peptide', 'Beta-Cell Function', 'ng/mL');
  if (rowValues.cPeptide && parseNumberFlexible(rowValues.cPeptide) !== null) {
    next.homaMethod = 'c-peptide';
  }
  setLabIfValid(rowValues.fastingInsulin, 'fastingInsulin', 'Fasting Insulin', 'Beta-Cell Function', 'µIU/mL');

  // FibroScan
  setDateField('fibroScanDate', 'FibroScan Date', 'FibroScan', rowValues.fibroScanDate);
  setNumberField('lsmKpa', 'FibroScan LSM (kPa)', 'FibroScan', rowValues.lsmKpa);
  setNumberField('capDbm', 'FibroScan CAP (dB/m)', 'FibroScan', rowValues.capDbm);
  setNumberField('iqr', 'FibroScan IQR', 'FibroScan', rowValues.iqr);
  setNumberField('iqrMedianPct', 'FibroScan IQR/Med (%)', 'FibroScan', rowValues.iqrMedianPct);
  setNumberField('validMeasurements', 'Valid Measurements', 'FibroScan', rowValues.validMeasurements);
  setNumberField('successRatePct', 'Success Rate (%)', 'FibroScan', rowValues.successRatePct);
  if (rowValues.fibrosisInterpretation) {
    const f = rowValues.fibrosisInterpretation.trim().toUpperCase();
    if (f === 'F0-F1' || f === 'F2' || f === 'F3' || f === 'F4') {
      next.fibrosisInterpretation = f;
    }
  }
  if (rowValues.steatosisInterpretation) {
    const s = rowValues.steatosisInterpretation.trim().toUpperCase();
    if (s === 'S0' || s === 'S1' || s === 'S2' || s === 'S3') {
      next.steatosisInterpretation = s;
    }
  }
  setText('fibroScanNotes', 'FibroScan Notes', 'FibroScan', rowValues.fibroScanNotes);

  // KS, DDS-17 & Cluster
  setNumberField('ksMacrovascular', 'KS Macrovascular', 'Known Severity (KS)', rowValues.ksMacrovascular);
  setNumberField('ksMicroRetinopathyTier', 'KS Retinopathy Tier', 'Known Severity (KS)', rowValues.ksMicroRetinopathyTier);
  setNumberField('ksFootNeuropathy', 'KS Foot/Neuropathy', 'Known Severity (KS)', rowValues.ksFootNeuropathy);

  // If DDS total or mean supplied directly without individual items, preserve on record if ddsItems empty
  const ddsMeanNum = rowValues.ddsMean ? parseNumberFlexible(rowValues.ddsMean) : null;
  const ddsTotalNum = rowValues.ddsTotal ? parseNumberFlexible(rowValues.ddsTotal) : null;
  if ((ddsMeanNum !== null || ddsTotalNum !== null) && next.ddsItems.every((x) => x === null)) {
    // Spread average cleanly across 17 items only if user explicitly provided DDS score? No, better leave ddsItems blank unless needed, OR wait: recalculatePatientCRF recalculates ddsTotal from ddsItems.
    // Let's preserve blank ddsItems unless explicitly filled, so no invented item answers are synthesized.
  }

  if (rowValues.clusterType) {
    const cl = normalizeClusterValue(rowValues.clusterType);
    if (cl && next.clusterType !== cl) {
      changes.push({
        fieldLabel: 'Phenotype Cluster',
        section: 'Phenotype',
        previousValue: next.clusterType || 'Empty',
        newValue: cl,
      });
      next.clusterType = cl;
    }
  }

  // Medications
  if (rowValues.medications) {
    const parsedMeds = parseMedicationsText(rowValues.medications, `sheet-r${rowIndex}`);
    if (parsedMeds.length > 0) {
      if (next.medicationVisits.length === 0) {
        next.medicationVisits.push({
          id: `visit-sheet-${rowIndex}`,
          visitDate: next.dateOfRecruitment || '',
          hba1cAtVisit: next.hba1c1.value !== null ? String(next.hba1c1.value) : '',
          drugs: [],
        });
      }
      const existingLower = new Set(
        next.medicationVisits[0].drugs.map((d) => d.drugName.trim().toLowerCase()).filter(Boolean)
      );
      const additions = parsedMeds.filter((m) => !existingLower.has(m.drugName.trim().toLowerCase()));
      if (additions.length > 0) {
        const cleanExisting = next.medicationVisits[0].drugs.filter((d) => d.drugName.trim() !== '');
        next.medicationVisits[0].drugs = [...cleanExisting, ...additions];
        changes.push({
          fieldLabel: 'Antidiabetic Medications',
          section: 'Medications',
          previousValue: `${cleanExisting.length} drugs`,
          newValue: additions.map((d) => `${d.drugName} ${d.dose}`.trim()).join(', '),
        });
      }
    }
  }

  if (rowValues.otherMedications) {
    const parsedOther = parseMedicationsText(rowValues.otherMedications, `sheet-other-r${rowIndex}`);
    if (parsedOther.length > 0) {
      const existingLower = new Set(
        next.otherMedications.map((d) => d.drugName.trim().toLowerCase()).filter(Boolean)
      );
      const additions = parsedOther.filter((m) => !existingLower.has(m.drugName.trim().toLowerCase()));
      if (additions.length > 0) {
        next.otherMedications = [...next.otherMedications, ...additions];
        changes.push({
          fieldLabel: 'Concomitant Medications',
          section: 'Medications',
          previousValue: `${base.otherMedications?.length || 0} drugs`,
          newValue: additions.map((d) => `${d.drugName} ${d.dose}`.trim()).join(', '),
        });
      }
    }
  }

  setText('investigatorName', 'Investigator Name', 'Attribution', rowValues.investigatorName);
  setText('investigatorEmail', 'Investigator Email', 'Attribution', rowValues.investigatorEmail);

  const recalculated = recalculatePatientCRF(next);
  if (!recalculated.clusterType && recalculated.suggestedCluster) {
    recalculated.clusterType = recalculated.suggestedCluster;
  }
  return { nextPatient: recalculated, changes };
}

/**
 * Generates an atomic import & merge plan for an entire Excel / Google Sheet patient table.
 * Matches existing patients by Participant ID, UHID, Phone, or Name and auto-creates CRFs for new patients.
 */
export function planBulkPatientSync(params: {
  headers: string[];
  rows: string[][];
  mapping: Record<number, CrfColumnTarget | ''>;
  existingPatients: PatientCRF[];
  activeUser?: { displayName?: string; email?: string; uid?: string } | null;
}): BulkSyncPlan {
  const { headers, rows, mapping, existingPatients, activeUser } = params;
  const items: BulkSyncRowPlan[] = [];

  // Track working cohort including newly created rows so duplicate rows inside the same Excel file merge cleanly
  const workingPool: Array<{ key: string; patient: PatientCRF }> = existingPatients.map((p) => ({
    key: getPatientKey(p),
    patient: p,
  }));

  let toUpdate = 0;
  let toCreate = 0;
  let unchanged = 0;
  let skipped = 0;
  let totalFieldChanges = 0;

  rows.forEach((rawRow, rIdx) => {
    const rowValues: Partial<Record<CrfColumnTarget, string>> = {};
    let hasAnyMappedValue = false;

    for (let c = 0; c < headers.length; c++) {
      const target = mapping[c];
      if (!target) continue;
      const cellVal = (rawRow[c] || '').trim();
      if (cellVal !== '') {
        rowValues[target] = cellVal;
        hasAnyMappedValue = true;
      }
    }

    if (!hasAnyMappedValue) {
      return;
    }

    const rawId = (rowValues.uhid || '').trim();
    const rawName = (rowValues.patientName || '').trim();

    if (!rawName && !rawId && !rowValues.contactNumber) {
      skipped += 1;
      items.push({
        rowIndex: rIdx + 1,
        action: 'skipped',
        matchReason: 'Missing Patient Name, UHID, and Contact Number',
        confidence: 'none',
        patient: createBlankPatientCRF(1),
        changes: [],
        rawName: '—',
        rawId: '—',
        skipReason: 'Row has no patient identifier (Name, UHID, or Contact Number).',
      });
      return;
    }

    const match = matchPatientFromReport(
      workingPool.map((w) => w.patient),
      {
        uhid: rowValues.uhid || null,
        patientName: rowValues.patientName || null,
        contactNumber: rowValues.contactNumber || null,
        dob: parseDateFlexible(rowValues.dob || '') || null,
      }
    );

    if (match.matchedPatient && (match.confidence === 'exact' || match.confidence === 'high')) {
      const matchedKey = getPatientKey(match.matchedPatient);
      const { nextPatient, changes } = applyRowFieldsToPatient(match.matchedPatient, rowValues, rIdx + 1);

      // Update workingPool in place so subsequent rows for the same patient build on this row
      const poolIdx = workingPool.findIndex((w) => w.key === matchedKey);
      if (poolIdx >= 0) {
        workingPool[poolIdx] = { key: matchedKey, patient: nextPatient };
      }

      if (changes.length > 0) {
        toUpdate += 1;
        totalFieldChanges += changes.length;
        items.push({
          rowIndex: rIdx + 1,
          action: 'update',
          matchedExistingKey: matchedKey,
          matchReason: match.matchReason,
          confidence: match.confidence,
          patient: nextPatient,
          changes,
          rawName: rawName || nextPatient.patientName,
          rawId: rawId || nextPatient.uhid,
        });
      } else {
        unchanged += 1;
        items.push({
          rowIndex: rIdx + 1,
          action: 'unchanged',
          matchedExistingKey: matchedKey,
          matchReason: `${match.matchReason} (already up to date)`,
          confidence: match.confidence,
          patient: nextPatient,
          changes: [],
          rawName: rawName || nextPatient.patientName,
          rawId: rawId || nextPatient.uhid,
        });
      }
    } else {
      const blank = createBlankPatientCRF(1);
      blank.investigatorName = activeUser?.displayName || '';
      blank.investigatorEmail = activeUser?.email || '';
      blank.createdByUid = activeUser?.uid || '';

      const { nextPatient, changes } = applyRowFieldsToPatient(blank, rowValues, rIdx + 1);

      const finalNewPatient = recalculatePatientCRF(nextPatient);
      if (!finalNewPatient.clusterType && finalNewPatient.suggestedCluster) {
        finalNewPatient.clusterType = finalNewPatient.suggestedCluster;
      }

      const newKey =
        getPatientKey(finalNewPatient) || `row-${rIdx + 1}-${finalNewPatient.patientName}`;
      workingPool.push({ key: newKey, patient: finalNewPatient });

      toCreate += 1;
      totalFieldChanges += Math.max(changes.length, 1);
      items.push({
        rowIndex: rIdx + 1,
        action: 'create',
        matchReason:
          match.confidence === 'possible'
            ? `New participant (possible name overlap with "${match.matchedPatient?.patientName}")`
            : 'New study participant',
        confidence: match.confidence,
        patient: finalNewPatient,
        changes,
        rawName: rawName || finalNewPatient.patientName || 'Unnamed Participant',
        rawId: finalNewPatient.uhid || '—',
      });
    }
  });

  return {
    items,
    summary: {
      totalRows: items.length,
      toUpdate,
      toCreate,
      unchanged,
      skipped,
      totalFieldChanges,
    },
  };
}

/** Builds a clean Excel template matrix aligned with all major CRF fields */
export function buildSampleExcelMatrix(): (string | number)[][] {
  const headers = [
    'UHID',
    'Patient Name',
    'Gender',
    'DOB',
    'Contact',
    'Recruitment Date',
    'Follow-up Date',
    'Diagnosis Month/Year',
    'Height (cm)',
    'Weight (kg)',
    'Waist (cm)',
    'Hip (cm)',
    'SBP (mmHg)',
    'DBP (mmHg)',
    'FBG (mg/dL)',
    'PPBG (mg/dL)',
    '1st HbA1c (%)',
    '2nd HbA1c (%)',
    'Total Cholesterol (mg/dL)',
    'Triglycerides (mg/dL)',
    'HDL (mg/dL)',
    'LDL (mg/dL)',
    'Hemoglobin (g/dL)',
    'Creatinine (mg/dL)',
    'UACR (mg/g)',
    'AST (U/L)',
    'ALT (U/L)',
    'C-Peptide (ng/mL)',
    'FibroScan LSM (kPa)',
    'FibroScan CAP (dB/m)',
    'Antidiabetic Medications',
    'Phenotype Cluster',
  ];

  const sampleRow = [
    'NH-2026-5104',
    'Rameshbhai Patel',
    'Male',
    '1974-05-12',
    '9825011223',
    '2026-08-22',
    '2026-11-22',
    '2018-04',
    170,
    78,
    98,
    102,
    134,
    84,
    158,
    224,
    8.9,
    '',
    192,
    176,
    42,
    114,
    13.6,
    0.92,
    38,
    29,
    34,
    2.4,
    6.8,
    272,
    'Metformin 1000mg BD, Dapagliflozin 10mg OD',
    '',
  ];

  return [headers, sampleRow];
}
