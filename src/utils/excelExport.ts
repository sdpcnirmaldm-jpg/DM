import * as XLSX from 'xlsx';
import type { MedicationRow, MedicationVisitBlock, PatientCRF } from '../types/clinical.ts';
import {
  convertCircumferenceToCm,
  convertHeightToCm,
  convertWeightToKg,
  evaluateMissingDataAndStatus,
  interpretFibrosisFromKpa,
  interpretSteatosisFromCap,
  recalculatePatientCRF,
  resolveAgeAndDiagnosisFromDOB,
  toCreatinineMgDl,
  toGlucoseMgDl,
  toHba1cPercent,
  toLipidMgDl,
} from './clinicalMath.ts';

export const EXCEL_EXPORT_HEADERS: readonly string[] = [
  'Date of Recruitment',
  'Follow-up Date',
  'Patient Name',
  'UHID/IP No.',
  'Gender',
  'Age (years)',
  'Date of Birth',
  'Education Level',
  'Blood Group',
  'Contact Number',
  'Date/Year of DM Diagnosis',
  'Age at DM Diagnosis',
  'Duration of Diabetes (years)',
  'Family History of DM',
  'Other Relevant History',
  'Hypoglycemia Frequency',
  'Height (cm)',
  'Weight (kg)',
  'BMI (kg/m²)',
  'Waist Circumference (cm)',
  'Hip Circumference (cm)',
  'Waist-Hip Ratio',
  'Blood Pressure (mmHg)',
  'Pulse (bpm)',
  'Fasting Blood Glucose (mg/dL)',
  'Postprandial Blood Glucose (mg/dL)',
  'Random Blood Sugar (mg/dL)',
  'HbA1c (%) 1st',
  'HbA1c (%) 2nd',
  'Total Cholesterol (mg/dL)',
  'Triglycerides (mg/dL)',
  'HDL Cholesterol (mg/dL)',
  'LDL Cholesterol (mg/dL)',
  'Hemoglobin (g/dL)',
  'Serum Creatinine (mg/dL)',
  'eGFR (mL/min/1.73m²)',
  'Urinary Albumin/UACR (mg/g)',
  'AST/SGOT (U/L)',
  'ALT/SGPT (U/L)',
  'Stimulated C-peptide (ng/mL)',
  'HOMA-B',
  'HOMA-IR',
  'Fibrosis Interpretation',
  'Steatosis Interpretation',
  'Microvascular Complication',
  'Macrovascular Complication',
  'Foot Examination',
  'Total Komplication Score',
  '(A) Average Blood Sugar',
  '(B) Blood Pressure (BP)',
  '(C) Lipids: TC, LDL, non-HDL',
  '(D) Diet Adherence',
  '(E) Exercise / Activity',
  '(F) Follow-up & Compliance',
  '(G) General Health & Comorbidity',
  '(H) Habits',
  '(I) Infection Prevention',
  '(J) Jeopardy (Hypoglycemia / ADR)',
  'Total Blue Index Score',
  'Blue Index Interpretation',
  'Emotional Burden',
  'Physician Distress',
  'Regimen Distress',
  'Interpersonal Distress',
  'DDS-17 Total Score',
  'DDS-17 Mean Score',
  'DDS-17 Interpretation',
  'Medications (1st HbA1c)',
  'Medications (2nd HbA1c)',
  'Other Medications',
  'Phenotype Classification',
  'CRF Complete Status',
] as const;

export type ExcelCellValue = string | number;

/** Converts 1-based column count (e.g. 72) into Excel column letters (e.g. "BT"). */
export function getSpreadsheetColumnLetter(columnIndex: number): string {
  let n = Math.max(1, Math.floor(columnIndex));
  let letters = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function normalizeCPeptideNgMl(value: number | null, unit: string): number | '' {
  if (value === null || Number.isNaN(value)) return '';
  if (unit === 'nmol/L') return Number((value / 0.331).toFixed(2));
  if (unit === 'pmol/L') return Number((value / 331).toFixed(2));
  return Number(value.toFixed(2));
}

function normalizeHemoglobinGDl(value: number | null, unit: string): number | '' {
  if (value === null || Number.isNaN(value)) return '';
  if (unit === 'g/L') return Number((value / 10).toFixed(1));
  if (unit === 'mmol/L') return Number((value * 1.6114).toFixed(1));
  return Number(value.toFixed(1));
}

function formatFamilyHistory(p: PatientCRF): string {
  if (!p.familyHistoryDM) return '';
  if (p.familyHistoryDM === 'Yes' && p.familyHistoryRelations.length > 0) {
    return `Yes (${p.familyHistoryRelations.join(', ')})`;
  }
  return p.familyHistoryDM;
}

function formatHypoglycemia(p: PatientCRF): string {
  const parts: string[] = [];
  if (p.hypoglycemiaSeverity) parts.push(p.hypoglycemiaSeverity);
  if (p.hypoglycemiaAfterMedication && p.hypoglycemiaAfterMedication !== 'No') {
    parts.push(`After Meds: ${p.hypoglycemiaAfterMedication}`);
  }
  if (p.hypoglycemiaDescription?.trim()) {
    parts.push(p.hypoglycemiaDescription.trim());
  }
  return parts.join(' — ');
}

function formatBloodPressure(p: PatientCRF): string {
  if (p.sbp !== null && p.dbp !== null) return `${p.sbp}/${p.dbp}`;
  if (p.sbp !== null) return `${p.sbp}/—`;
  if (p.dbp !== null) return `—/${p.dbp}`;
  return '';
}

function formatFibrosis(p: PatientCRF): string {
  const stage = p.fibrosisInterpretation || interpretFibrosisFromKpa(p.lsmKpa);
  if (!stage && p.lsmKpa === null) return '';
  if (stage && p.lsmKpa !== null) return `${stage} (${p.lsmKpa} kPa)`;
  return stage || `${p.lsmKpa} kPa`;
}

function formatSteatosis(p: PatientCRF): string {
  const grade = p.steatosisInterpretation || interpretSteatosisFromCap(p.capDbm);
  if (!grade && p.capDbm === null) return '';
  if (grade && p.capDbm !== null) return `${grade} (${p.capDbm} dB/m)`;
  return grade || `${p.capDbm} dB/m`;
}

function formatBlueIndexInterpretation(p: PatientCRF): string {
  if (!p.dhsCategory) return '';
  if (p.blueIndexRatio && p.blueIndexRatio !== '—') {
    return `${p.dhsCategory} (BI Ratio: ${p.blueIndexRatio})`;
  }
  return p.dhsCategory;
}

function formatMedicationEntries(rows: MedicationRow[] | undefined): string {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .filter((r) => r && (r.drugName || '').trim() !== '')
    .map((r) => {
      const details = [r.dose || '', r.route || '', r.frequency || '']
        .map((x) => x.trim())
        .filter(Boolean)
        .join(' ');
      const statusSuffix = r.status ? ` [${r.status}]` : '';
      return `${r.drugName.trim()}${details ? ` ${details}` : ''}${statusSuffix}`.trim();
    })
    .join('; ');
}

function formatVisitMedications(visit: MedicationVisitBlock | undefined): string {
  if (!visit) return '';
  return formatMedicationEntries(visit.drugs);
}

function formatFollowUpVisitMedications(visits: MedicationVisitBlock[]): string {
  if (!Array.isArray(visits) || visits.length === 0) return '';
  const parts: string[] = [];
  visits.forEach((visit, idx) => {
    const formatted = formatVisitMedications(visit);
    if (!formatted) return;
    if (visits.length === 1) {
      parts.push(formatted);
    } else {
      parts.push(`Visit ${idx + 2}: ${formatted}`);
    }
  });
  return parts.join(' | ');
}

function formatPhenotype(p: PatientCRF): string {
  if (p.clusterType) return p.clusterType;
  if (p.suggestedCluster) return `${p.suggestedCluster} (Suggested)`;
  return '';
}

export function buildPatientExcelRow(input: PatientCRF): ExcelCellValue[] {
  // Always normalize and recalculate using Date of Birth as reference before exporting
  const p = recalculatePatientCRF(input);
  const resolvedAgeDiag = resolveAgeAndDiagnosisFromDOB({
    dob: p.dob,
    age: p.age,
    diagnosisMonthYear: p.diagnosisMonthYear,
    ageAtDiagnosis: p.ageAtDiagnosis,
    durationYears: p.durationYears,
    durationMonths: p.durationMonths,
    referenceDate: p.dateOfRecruitment || undefined,
  });

  const heightCm = p.heightCm ?? convertHeightToCm(p.heightValue, p.heightUnit);
  const weightKg = p.weightKg ?? convertWeightToKg(p.weightValue, p.weightUnit);
  const waistCm = p.waistCm ?? convertCircumferenceToCm(p.waistValue, p.waistUnit);
  const hipCm = p.hipCm ?? convertCircumferenceToCm(p.hipValue, p.hipUnit);
  const { statusLabel } = evaluateMissingDataAndStatus(p);

  const visits = Array.isArray(p.medicationVisits) ? p.medicationVisits : [];
  const firstVisitMeds = formatVisitMedications(visits[0]);
  const secondVisitMeds = formatFollowUpVisitMedications(visits.slice(1));
  const otherMeds = formatMedicationEntries(p.otherMedications);

  return [
    p.dateOfRecruitment || '',
    p.followUpDate || '',
    p.patientName || '',
    p.uhid || '',
    p.gender || '',
    resolvedAgeDiag.age ?? '',
    p.dob || '',
    p.education || '',
    p.bloodGroup || '',
    p.contactNumber || '',
    resolvedAgeDiag.diagnosisMonthYear || '',
    resolvedAgeDiag.ageAtDiagnosis ?? '',
    resolvedAgeDiag.durationDecimalYears ?? '',
    formatFamilyHistory(p),
    p.otherRelevantHistory || '',
    formatHypoglycemia(p),
    heightCm ?? '',
    weightKg ?? '',
    p.bmi ?? '',
    waistCm ?? '',
    hipCm ?? '',
    p.waistHipRatio ?? '',
    formatBloodPressure(p),
    p.pulse ?? p.hr ?? '',
    toGlucoseMgDl(p.fbg.value, p.fbg.unit) ?? '',
    toGlucoseMgDl(p.ppbg.value, p.ppbg.unit) ?? '',
    toGlucoseMgDl(p.rbs.value, p.rbs.unit) ?? '',
    toHba1cPercent(p.hba1c1.value, p.hba1c1.unit) ?? '',
    toHba1cPercent(p.hba1c2.value, p.hba1c2.unit) ?? '',
    toLipidMgDl(p.totalCholesterol.value, p.totalCholesterol.unit, 'chol') ?? '',
    toLipidMgDl(p.triglycerides.value, p.triglycerides.unit, 'tg') ?? '',
    toLipidMgDl(p.hdl.value, p.hdl.unit, 'chol') ?? '',
    toLipidMgDl(p.ldl.value, p.ldl.unit, 'chol') ?? '',
    normalizeHemoglobinGDl(p.hemoglobin.value, p.hemoglobin.unit),
    toCreatinineMgDl(p.serumCreatinine.value, p.serumCreatinine.unit) ?? '',
    p.egfr ?? '',
    p.uacr.value ?? '',
    p.ast.value ?? '',
    p.alt.value ?? '',
    normalizeCPeptideNgMl(p.cPeptide.value, p.cPeptide.unit),
    p.homaB ?? '',
    p.homaIR ?? '',
    formatFibrosis(p),
    formatSteatosis(p),
    p.ksMicrovascular ?? '',
    p.ksMacrovascular ?? '',
    p.ksFootNeuropathy ?? '',
    p.ksTotal ?? '',
    p.dhsDomains.A ?? '',
    p.dhsDomains.B ?? '',
    p.dhsDomains.C ?? '',
    p.dhsDomains.D ?? '',
    p.dhsDomains.E ?? '',
    p.dhsDomains.F ?? '',
    p.dhsDomains.G ?? '',
    p.dhsDomains.H ?? '',
    p.dhsDomains.I ?? '',
    p.dhsDomains.J ?? '',
    p.dhsTotal ?? '',
    formatBlueIndexInterpretation(p),
    p.ddsEmotionalBurden ?? '',
    p.ddsPhysicianDistress ?? '',
    p.ddsRegimenDistress ?? '',
    p.ddsInterpersonalDistress ?? '',
    p.ddsTotal ?? '',
    p.ddsMean ?? '',
    p.ddsCategory || '',
    firstVisitMeds,
    secondVisitMeds,
    otherMeds,
    formatPhenotype(p),
    statusLabel,
  ];
}

export function buildPatientExcelMatrix(patients: PatientCRF[]): ExcelCellValue[][] {
  return [[...EXCEL_EXPORT_HEADERS], ...patients.map(buildPatientExcelRow)];
}

export function buildPatientsExcelWorkbook(patients: PatientCRF[]): XLSX.WorkBook {
  const matrix = buildPatientExcelMatrix(patients);
  const ws = XLSX.utils.aoa_to_sheet(matrix);

  // Set readable auto-fitted column widths capped cleanly for Excel inspection
  ws['!cols'] = EXCEL_EXPORT_HEADERS.map((header, colIdx) => {
    let maxLen = header.length;
    for (let r = 1; r < matrix.length; r++) {
      const val = String(matrix[r][colIdx] ?? '');
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 14), 48) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'T2DM Study Data');
  return wb;
}

export function downloadPatientsExcelWorkbook(
  patients: PatientCRF[],
  filename?: string
): void {
  const wb = buildPatientsExcelWorkbook(patients);
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename || `Desai_T2DM_Study_Data_${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
