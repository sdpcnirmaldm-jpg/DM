import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankPatientCRF, recalculatePatientCRF } from './clinicalMath';
import {
  buildAttachmentManifest,
  buildCompactCohortVoiceDirectory,
  collectPatientAttachments,
  findAttachmentPayload,
  parseDataUrl,
  stripPatientForAI,
} from './aiContext';

function makeSamplePatient() {
  const blank = createBlankPatientCRF(1);
  blank.participantId = 'M08001';
  blank.uhid = 'NH-2026-4102';
  blank.patientName = 'Maheshbhai Desai';
  blank.gender = 'Male';
  blank.dob = '1979-03-14';
  blank.hba1c1.value = 9.8;
  blank.attachments = [
    {
      id: 'att-1',
      name: 'HbA1c_Lipid_Report.pdf',
      section: 'glycemic-lipids',
      dataUrl: 'data:application/pdf;base64,JVBERi0xLjQK',
      uploadedAt: '2026-08-14T10:00:00.000Z',
    },
    {
      id: 'att-2',
      name: 'Prescription_Scan.png',
      section: 'medications',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      uploadedAt: '2026-08-14T10:05:00.000Z',
    },
  ];
  return recalculatePatientCRF(blank);
}

test('parseDataUrl parses valid base64 data URLs and rejects invalid values', () => {
  const pdf = parseDataUrl('data:application/pdf;base64,JVBERi0xLjQK', 'report.pdf');
  assert.deepEqual(pdf, { mimeType: 'application/pdf', base64Data: 'JVBERi0xLjQK' });
  assert.equal(parseDataUrl(undefined, 'empty.pdf'), null);
  assert.equal(parseDataUrl('not-a-data-url', 'bad.txt'), null);
});

test('stripPatientForAI retains clinical fields and metadata without raw base64 blobs', () => {
  const patient = makeSamplePatient();
  const stripped = stripPatientForAI(patient);
  assert.equal(stripped.participantId, 'M08001');
  assert.equal(stripped.patientName, 'Maheshbhai Desai');
  const attachments = stripped.attachments as Array<Record<string, unknown>>;
  assert.equal(attachments.length, 2);
  assert.equal(attachments[0].name, 'HbA1c_Lipid_Report.pdf');
  assert.equal(attachments[0].mimeType, 'application/pdf');
  assert.equal(attachments[0].hasData, true);
  assert.equal('dataUrl' in attachments[0], false);
});

test('collectPatientAttachments and findAttachmentPayload extract multimodal patient files', () => {
  const patient = makeSamplePatient();
  const collected = collectPatientAttachments([patient]);
  assert.equal(collected.length, 2);
  assert.equal(collected[0].mimeType, 'application/pdf');
  assert.equal(collected[1].mimeType, 'image/png');

  const manifest = buildAttachmentManifest([patient]);
  assert.equal(manifest.length, 2);
  assert.equal(manifest[0].uhid, 'NH-2026-4102');

  const foundByName = findAttachmentPayload([patient], 'Maheshbhai', undefined, 'Prescription');
  assert.ok(foundByName);
  assert.equal(foundByName.name, 'Prescription_Scan.png');
  assert.equal(foundByName.base64Data, 'iVBORw0KGgo=');
});

test('buildCompactCohortVoiceDirectory summarizes all patient records and attachment filenames', () => {
  const patient = makeSamplePatient();
  const directory = buildCompactCohortVoiceDirectory([patient]);
  assert.match(directory, /NH-2026-4102 \| Maheshbhai Desai/);
  assert.match(directory, /HbA1c_Lipid_Report\.pdf \[glycemic-lipids\]/);
  assert.match(directory, /Prescription_Scan\.png \[medications\]/);
});
