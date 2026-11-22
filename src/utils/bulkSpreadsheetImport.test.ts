import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import {
  autoMapSpreadsheetHeaders,
  buildSampleExcelMatrix,
  parseDateFlexible,
  parseMedicationsText,
  parseSpreadsheetGrid,
  planBulkPatientSync,
} from './bulkSpreadsheetImport';

test('autoMapSpreadsheetHeaders maps standard and abbreviated clinical headers cleanly', () => {
  const headers = [
    'UHID',
    'Patient Name',
    'Sex',
    'FBS',
    'PPBS',
    '1st HbA1c (%)',
    '2nd HbA1c (%)',
    'S. Creat',
    'BP',
    'FibroScan LSM (kPa)',
    'CAP',
    'Rx',
    'Custom Internal Note',
  ];
  const mapping = autoMapSpreadsheetHeaders(headers);

  assert.equal(mapping[0], 'uhid');
  assert.equal(mapping[1], 'patientName');
  assert.equal(mapping[2], 'gender');
  assert.equal(mapping[3], 'fbg');
  assert.equal(mapping[4], 'ppbg');
  assert.equal(mapping[5], 'hba1c1');
  assert.equal(mapping[6], 'hba1c2');
  assert.equal(mapping[7], 'serumCreatinine');
  assert.equal(mapping[8], 'bpCombined');
  assert.equal(mapping[9], 'lsmKpa');
  assert.equal(mapping[10], 'capDbm');
  assert.equal(mapping[11], 'medications');
  assert.equal(mapping[12], '');
});

test('parseSpreadsheetGrid skips blank preamble rows and extracts normalized grid', () => {
  const raw = [
    [],
    ['Clinic Export'],
    ['UHID', 'Patient Name', 'FBG'],
    ['NH-2026-9001', 'Asha Mehta', 142],
    ['', '', ''],
  ];
  const parsed = parseSpreadsheetGrid(raw, 'FollowUp');
  assert.equal(parsed.sheetName, 'FollowUp');
  assert.deepEqual(parsed.headers, ['UHID', 'Patient Name', 'FBG']);
  assert.equal(parsed.rows.length, 1);
  assert.deepEqual(parsed.rows[0], ['NH-2026-9001', 'Asha Mehta', '142']);
});

test('parseDateFlexible converts ISO, DD/MM/YYYY, and Excel serial numbers cleanly', () => {
  assert.equal(parseDateFlexible('2026-08-14'), '2026-08-14');
  assert.equal(parseDateFlexible('14/08/2026'), '2026-08-14');
  assert.equal(parseDateFlexible('46248'), '2026-08-14');
  assert.equal(parseDateFlexible(''), '');
});

test('parseMedicationsText splits multi-drug strings into structured MedicationRow entries', () => {
  const meds = parseMedicationsText('Metformin 1000mg BD, Dapagliflozin 10mg OD');
  assert.equal(meds.length, 2);
  assert.equal(meds[0].drugName, 'Metformin');
  assert.equal(meds[0].dose, '1000mg');
  assert.equal(meds[0].frequency, 'BD');
  assert.equal(meds[1].drugName, 'Dapagliflozin');
  assert.equal(meds[1].dose, '10mg');
  assert.equal(meds[1].frequency, 'OD');
});

test('planBulkPatientSync updates matched patients without wiping existing data and creates new patients without Participant ID', () => {
  const headers = [
    'UHID',
    'Patient Name',
    'Gender',
    'DOB',
    'Recruitment Date',
    'Height (cm)',
    'Weight (kg)',
    'BP',
    'FBG',
    '1st HbA1c (%)',
    '2nd HbA1c (%)',
    'Creatinine',
    'C-Peptide',
    'Medications',
  ];
  const rows = [
    // Matches existing NH-2026-4102 (Maheshbhai Desai) by UHID and updates 2nd HbA1c from 7.4 to 6.9
    ['NH-2026-4102', 'Maheshbhai Desai', '', '', '', '', '', '', '', '', '6.9%', '', '', ''],
    // Two brand-new male patients enrolled in 2026-08 -> created with blank participantId and UHID preserved
    [
      'NH-2026-7701',
      'Kiranbhai Solanki',
      'Male',
      '1975-03-10',
      '2026-08-22',
      '172',
      '82',
      '136/86',
      '164',
      '9.1',
      '',
      '0.95',
      '2.1',
      'Metformin 500mg BD',
    ],
    [
      'NH-2026-7702',
      'Jigneshbhai Bhatt',
      'Male',
      '1968-11-05',
      '2026-08-22',
      '168',
      '70',
      '128/78',
      '138',
      '7.6',
      '',
      '',
      '',
      '',
    ],
  ];

  const mapping = autoMapSpreadsheetHeaders(headers);
  const plan = planBulkPatientSync({
    headers,
    rows,
    mapping,
    existingPatients: SEED_PATIENTS,
    activeUser: {
      displayName: 'Bhumit Dangodara',
      email: 'bhumitdangodara1@gmail.com',
      uid: 'u1',
    },
  });

  assert.equal(plan.summary.totalRows, 3);
  assert.equal(plan.summary.toUpdate, 1);
  assert.equal(plan.summary.toCreate, 2);

  const updatedMahesh = plan.items[0];
  assert.equal(updatedMahesh.action, 'update');
  assert.equal(updatedMahesh.patient.hba1c2.value, 6.9);
  // Existing 1st HbA1c preserved untouched
  assert.equal(updatedMahesh.patient.hba1c1.value, SEED_PATIENTS[0].hba1c1.value);

  const created1 = plan.items[1];
  const created2 = plan.items[2];
  assert.equal(created1.action, 'create');
  assert.equal(created2.action, 'create');
  assert.equal(created1.patient.participantId, '');
  assert.equal(created2.patient.participantId, '');
  assert.equal(created1.patient.uhid, 'NH-2026-7701');
  assert.equal(created2.patient.uhid, 'NH-2026-7702');
  assert.ok(created1.patient.bmi !== null && created1.patient.bmi > 20);
  assert.ok(created1.patient.egfr !== null && created1.patient.egfr > 50);
  assert.ok(created1.patient.homaIR !== null);
  assert.equal(created1.patient.medicationVisits[0].drugs[0].drugName, 'Metformin');
  // Blank unentered fields on created2 stay null/blank
  assert.equal(created2.patient.serumCreatinine.value, null);
  assert.equal(created2.patient.egfr, null);
  assert.equal(created2.patient.hba1c2.value, null);
});

test('buildSampleExcelMatrix aligns 1:1 with autoMapSpreadsheetHeaders', () => {
  const matrix = buildSampleExcelMatrix();
  const headers = matrix[0].map(String);
  const mapping = autoMapSpreadsheetHeaders(headers);
  const unmapped = headers.filter((_, idx) => !mapping[idx]);
  assert.deepEqual(unmapped, []);
});
