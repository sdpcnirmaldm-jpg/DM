import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankPatientCRF, recalculatePatientCRF } from './clinicalMath';
import {
  applyExtractedReportToPatient,
  createDraftPatientFromReport,
  matchPatientFromReport,
} from './reportAutoSync';

function buildSamplePatient() {
  const p = createBlankPatientCRF(1);
  p.participantId = 'M08001';
  p.uhid = 'NH-2026-4102';
  p.patientName = 'Maheshbhai Desai';
  p.contactNumber = '9825112044';
  p.dob = '1979-03-18';
  p.hba1c1 = { date: '2026-08-14', value: 9.8, unit: '%' };
  return recalculatePatientCRF(p);
}

test('matchPatientFromReport matches by participantId, UHID, phone, or fuzzy name', () => {
  const cohort = [buildSamplePatient()];

  const byPid = matchPatientFromReport(cohort, { participantId: 'm08001' });
  assert.equal(byPid.confidence, 'exact');
  assert.equal(byPid.matchedPatient?.participantId, 'M08001');

  const byUhid = matchPatientFromReport(cohort, { uhid: 'NH20264102' });
  assert.equal(byUhid.confidence, 'exact');
  assert.equal(byUhid.matchedPatient?.uhid, 'NH-2026-4102');

  const byPhone = matchPatientFromReport(cohort, { contactNumber: '+91 98251-12044' });
  assert.equal(byPhone.confidence, 'high');
  assert.equal(byPhone.matchedPatient?.participantId, 'M08001');

  const byName = matchPatientFromReport(cohort, { patientName: 'Mr. Desai Maheshbhai' });
  assert.equal(byName.confidence, 'high');
  assert.equal(byName.matchedPatient?.participantId, 'M08001');

  const none = matchPatientFromReport(cohort, { patientName: 'Completely Unknown Person' });
  assert.equal(none.confidence, 'none');
  assert.equal(none.matchedPatient, null);
});

test('applyExtractedReportToPatient routes follow-up HbA1c, updates labs/HOMA, and recalculates Blue Index', () => {
  const patient = buildSamplePatient();

  const { updatedPatient, appliedChanges } = applyExtractedReportToPatient(
    patient,
    {
      patientName: 'Maheshbhai Desai',
      reportDate: '2026-11-15',
      fbg: 150,
      hba1c1: 7.2, // baseline already exists (9.8), so should auto-route to hba1c2!
      cPeptide: 2.0,
      serumCreatinine: 0.9,
      uacr: 18,
      lsmKpa: 6.4,
      capDbm: 225,
      medications: [{ drugName: 'Metformin', dose: '1000 mg', route: 'Oral', frequency: 'BD' }],
    },
    {
      id: 'att-test-1',
      name: 'mahesh-followup-lab.pdf',
      section: 'AI Auto-Sync Report',
      uploadedAt: '2026-11-15T10:00:00.000Z',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
    }
  );

  assert.equal(updatedPatient.hba1c1.value, 9.8);
  assert.equal(updatedPatient.hba1c2.value, 7.2);
  assert.equal(updatedPatient.homaB, 8.3);
  assert.equal(updatedPatient.homaIR, 2.61);
  assert.equal(updatedPatient.fibrosisInterpretation, 'F0-F1');
  assert.equal(updatedPatient.steatosisInterpretation, 'S0');
  assert.ok(updatedPatient.attachments.some((a) => a.name === 'mahesh-followup-lab.pdf'));
  assert.ok(appliedChanges.some((c) => c.fieldLabel === '2nd HbA1c (Follow-up)'));
  assert.ok(appliedChanges.some((c) => c.fieldLabel === 'C-Peptide'));
});

test('createDraftPatientFromReport builds pre-filled patient CRF for unmatched reports', () => {
  const cohort = [buildSamplePatient()];
  const draft = createDraftPatientFromReport(cohort, {
    patientName: 'Asha Patel',
    uhid: 'NH-2026-9999',
    gender: 'Female',
    fbg: 140,
    hba1c1: 8.4,
  });

  assert.equal(draft.patientName, 'Asha Patel');
  assert.equal(draft.uhid, 'NH-2026-9999');
  assert.equal(draft.gender, 'Female');
  assert.equal(draft.participantId, '');
  assert.equal(draft.hba1c1.value, 8.4);
  assert.equal(draft.dateOfRecruitment, '');
  assert.equal(draft.hba1c1.date, '');
});

test('createDraftPatientFromReport leaves gender, date, participantId, and med details blank when omitted', () => {
  const cohort = [buildSamplePatient()];
  const draft = createDraftPatientFromReport(cohort, {
    patientName: 'Minimal Report Patient',
    fbg: 132,
    medications: [{ drugName: 'Metformin', dose: '500 mg' }],
  });

  assert.equal(draft.gender, '');
  assert.equal(draft.participantId, '');
  assert.equal(draft.dateOfRecruitment, '');
  assert.equal(draft.fbg.date, '');
  assert.equal(draft.medicationVisits[0].drugs[0].route, '');
  assert.equal(draft.medicationVisits[0].drugs[0].frequency, '');
  assert.equal(draft.medicationVisits[0].drugs[0].status, '');
});

