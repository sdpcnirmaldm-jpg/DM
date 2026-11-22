import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { SEED_PATIENTS } from '../data/seedPatients.ts';
import { createBlankPatientCRF, recalculatePatientCRF } from './clinicalMath.ts';
import {
  EXCEL_EXPORT_HEADERS,
  buildPatientExcelMatrix,
  buildPatientExcelRow,
  buildPatientsExcelWorkbook,
  getSpreadsheetColumnLetter,
} from './excelExport.ts';

const EXPECTED_72_HEADERS = [
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
];

test('EXCEL_EXPORT_HEADERS contains exact 72 columns in exact order without Patient ID', () => {
  assert.equal(EXCEL_EXPORT_HEADERS.length, 72);
  assert.deepEqual([...EXCEL_EXPORT_HEADERS], EXPECTED_72_HEADERS);
  assert.equal(
    EXCEL_EXPORT_HEADERS.some((h) => /patient\s*id|participant\s*id/i.test(h)),
    false
  );
});

test('getSpreadsheetColumnLetter converts 1-based column indices cleanly', () => {
  assert.equal(getSpreadsheetColumnLetter(1), 'A');
  assert.equal(getSpreadsheetColumnLetter(26), 'Z');
  assert.equal(getSpreadsheetColumnLetter(27), 'AA');
  assert.equal(getSpreadsheetColumnLetter(72), 'BT');
});

test('buildPatientExcelRow populates all 72 fields accurately for complete seed patient without participantId', () => {
  const mahesh = structuredClone(SEED_PATIENTS[0]);
  mahesh.medicationVisits.push({
    id: 'mv-2',
    visitDate: '2026-11-10',
    hba1cAtVisit: '7.4',
    drugs: [
      { id: 'd4', drugName: 'Metformin', dose: '1000 mg', route: 'Oral', frequency: 'BD', status: 'Current' },
      { id: 'd5', drugName: 'Sitagliptin', dose: '100 mg', route: 'Oral', frequency: 'OD', status: 'Current' },
    ],
  });

  const row = buildPatientExcelRow(mahesh);
  assert.equal(row.length, 72);

  const byHeader = Object.fromEntries(EXCEL_EXPORT_HEADERS.map((h, i) => [h, row[i]]));
  assert.equal(byHeader['Date of Recruitment'], '2026-08-14');
  assert.equal(byHeader['Follow-up Date'], '2026-11-18');
  assert.equal(byHeader['Patient Name'], 'Maheshbhai Desai');
  assert.equal(byHeader['UHID/IP No.'], 'NH-2026-4102');
  assert.equal(byHeader['Gender'], 'Male');
  assert.equal(byHeader['Age (years)'], 47);
  assert.equal(byHeader['Date of Birth'], '1979-03-18');
  assert.equal(byHeader['Education Level'], 'Higher Education');
  assert.equal(byHeader['Blood Group'], 'B+');
  assert.equal(byHeader['Contact Number'], '9825112044');
  assert.equal(byHeader['Date/Year of DM Diagnosis'], '2018-06');
  assert.equal(byHeader['Age at DM Diagnosis'], 39);
  assert.equal(byHeader['Duration of Diabetes (years)'], 8.2);
  assert.equal(byHeader['Family History of DM'], 'Yes (Father, Brother)');
  assert.equal(byHeader['Hypoglycemia Frequency'], 'Level 1 Asymptomatic');
  assert.equal(byHeader['Height (cm)'], 171);
  assert.equal(byHeader['Weight (kg)'], 72);
  assert.equal(byHeader['Blood Pressure (mmHg)'], '126/78');
  assert.equal(byHeader['Pulse (bpm)'], 76);
  assert.equal(byHeader['Fasting Blood Glucose (mg/dL)'], 186);
  assert.equal(byHeader['Postprandial Blood Glucose (mg/dL)'], 268);
  assert.equal(byHeader['Random Blood Sugar (mg/dL)'], 234);
  assert.equal(byHeader['HbA1c (%) 1st'], 9.8);
  assert.equal(byHeader['HbA1c (%) 2nd'], 7.4);
  assert.equal(byHeader['Total Cholesterol (mg/dL)'], 188);
  assert.equal(byHeader['Triglycerides (mg/dL)'], 142);
  assert.equal(byHeader['HDL Cholesterol (mg/dL)'], 44);
  assert.equal(byHeader['LDL Cholesterol (mg/dL)'], 108);
  assert.equal(byHeader['Hemoglobin (g/dL)'], 13.9);
  assert.equal(byHeader['Serum Creatinine (mg/dL)'], 0.95);
  assert.equal(byHeader['Urinary Albumin/UACR (mg/g)'], 24);
  assert.equal(byHeader['AST/SGOT (U/L)'], 28);
  assert.equal(byHeader['ALT/SGPT (U/L)'], 31);
  assert.equal(byHeader['Stimulated C-peptide (ng/mL)'], 0.88);
  assert.equal(byHeader['Fibrosis Interpretation'], 'F0-F1 (6.2 kPa)');
  assert.equal(byHeader['Steatosis Interpretation'], 'S0 (232 dB/m)');

  // Komplication Score (KS)
  assert.equal(byHeader['Microvascular Complication'], mahesh.ksMicrovascular);
  assert.equal(byHeader['Macrovascular Complication'], 0);
  assert.equal(byHeader['Foot Examination'], 1);
  assert.equal(byHeader['Total Komplication Score'], mahesh.ksTotal);

  // Blue Index (A..J + Total + Interpretation)
  assert.equal(byHeader['(A) Average Blood Sugar'], mahesh.dhsDomains.A);
  assert.equal(byHeader['(B) Blood Pressure (BP)'], mahesh.dhsDomains.B);
  assert.equal(byHeader['(C) Lipids: TC, LDL, non-HDL'], mahesh.dhsDomains.C);
  assert.equal(byHeader['(D) Diet Adherence'], 4);
  assert.equal(byHeader['(E) Exercise / Activity'], 5);
  assert.equal(byHeader['(F) Follow-up & Compliance'], 5);
  assert.equal(byHeader['(G) General Health & Comorbidity'], 4);
  assert.equal(byHeader['(H) Habits'], 5);
  assert.equal(byHeader['(I) Infection Prevention'], 4);
  assert.equal(byHeader['(J) Jeopardy (Hypoglycemia / ADR)'], 4);
  assert.equal(byHeader['Total Blue Index Score'], mahesh.dhsTotal);
  assert.match(String(byHeader['Blue Index Interpretation']), /Moderate Status|Excellent Status/);

  // DDS-17 Subscales + Total + Mean + Interpretation
  assert.equal(byHeader['Emotional Burden'], mahesh.ddsEmotionalBurden);
  assert.equal(byHeader['Physician Distress'], mahesh.ddsPhysicianDistress);
  assert.equal(byHeader['Regimen Distress'], mahesh.ddsRegimenDistress);
  assert.equal(byHeader['Interpersonal Distress'], mahesh.ddsInterpersonalDistress);
  assert.equal(byHeader['DDS-17 Total Score'], mahesh.ddsTotal);
  assert.equal(byHeader['DDS-17 Mean Score'], mahesh.ddsMean);
  assert.equal(byHeader['DDS-17 Interpretation'], mahesh.ddsCategory);

  // Split Medications (1st HbA1c, 2nd HbA1c, Other)
  assert.match(String(byHeader['Medications (1st HbA1c)']), /Metformin 1000 mg Oral BD/);
  assert.match(String(byHeader['Medications (1st HbA1c)']), /Dapagliflozin 10 mg Oral OD/);
  assert.equal(String(byHeader['Medications (1st HbA1c)']).includes('Rosuvastatin'), false);
  assert.match(String(byHeader['Medications (2nd HbA1c)']), /Sitagliptin 100 mg Oral OD/);
  assert.match(String(byHeader['Other Medications']), /Telmisartan 40 mg Oral OD/);
  assert.match(String(byHeader['Other Medications']), /Rosuvastatin 10 mg Oral HS/);

  assert.equal(byHeader['Phenotype Classification'], 'SIDD');
  assert.equal(byHeader['CRF Complete Status'], 'Complete');

  // Ensure participantId ('M08001') does not appear anywhere in the exported row
  assert.equal(
    row.some((cell) => String(cell).includes(mahesh.participantId)),
    false
  );
});

test('buildPatientExcelRow recalculates age, diagnosis date, age at diagnosis, and duration from DOB and converts units', () => {
  const custom = createBlankPatientCRF(1);
  custom.patientName = 'Unit & DOB Reference Case';
  custom.uhid = 'NH-UNIT-01';
  custom.gender = 'Female';
  custom.dob = '1980-01-15';
  custom.age = 99; // stale manual value should be overwritten using DOB
  custom.dateOfRecruitment = '2026-10-01';
  custom.ageAtDiagnosis = 40; // missing diagnosisMonthYear -> derived from DOB (1980-01 + 40y = 2020-01)
  custom.heightValue = 65;
  custom.heightUnit = 'inch';
  custom.weightValue = 154;
  custom.weightUnit = 'lbs';
  custom.fbg = { date: '2026-10-01', value: 7.0, unit: 'mmol/L' };
  custom.hba1c1 = { date: '2026-10-01', value: 64, unit: 'mmol/mol' };
  custom.totalCholesterol = { date: '2026-10-01', value: 5.0, unit: 'mmol/L' };
  custom.hemoglobin = { date: '2026-10-01', value: 135, unit: 'g/L' };
  custom.serumCreatinine = { date: '2026-10-01', value: 88.4, unit: 'µmol/L' };
  custom.cPeptide = { date: '2026-10-01', value: 662, unit: 'pmol/L', method: 'ECLIA' };

  const recalculated = recalculatePatientCRF(custom);
  const row = buildPatientExcelRow(recalculated);
  const byHeader = Object.fromEntries(EXCEL_EXPORT_HEADERS.map((h, i) => [h, row[i]]));

  assert.equal(byHeader['Age (years)'], 46);
  assert.equal(byHeader['Date/Year of DM Diagnosis'], '2020-01');
  assert.equal(byHeader['Age at DM Diagnosis'], 40);
  assert.equal(byHeader['Duration of Diabetes (years)'], 6.8);
  assert.equal(byHeader['Height (cm)'], 165.1);
  assert.equal(byHeader['Weight (kg)'], 69.9);
  assert.equal(byHeader['Fasting Blood Glucose (mg/dL)'], 126.1);
  assert.equal(byHeader['HbA1c (%) 1st'], 8.01);
  assert.equal(byHeader['Total Cholesterol (mg/dL)'], 193.4);
  assert.equal(byHeader['Hemoglobin (g/dL)'], 13.5);
  assert.equal(byHeader['Serum Creatinine (mg/dL)'], 1);
  assert.equal(byHeader['Stimulated C-peptide (ng/mL)'], 2);
});

test('buildPatientsExcelWorkbook serializes and round-trips a valid XLSX sheet with exact 72 headers', () => {
  const wb = buildPatientsExcelWorkbook(SEED_PATIENTS);
  const bytes = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
  const parsedWb = XLSX.read(bytes, { type: 'buffer' });

  assert.deepEqual(parsedWb.SheetNames, ['T2DM Study Data']);
  const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(
    parsedWb.Sheets['T2DM Study Data'],
    { header: 1, defval: '' }
  );

  assert.equal(aoa.length, SEED_PATIENTS.length + 1);
  assert.deepEqual(aoa[0], EXPECTED_72_HEADERS);

  const matrix = buildPatientExcelMatrix([createBlankPatientCRF(1)]);
  assert.equal(matrix.length, 2);
  assert.equal(matrix[1].length, 72);
  assert.match(String(matrix[1][71]), /Pending/);
});
