import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankPatientCRF } from './clinicalMath';
import {
  buildPatientDocumentGroups,
  createClinicalPdfDataUrl,
  createClinicalSvgImageDataUrl,
  decodeBase64ToBytes,
  decodeTextDataUrl,
  detectDocumentKind,
  enrichAttachment,
  formatDocumentSize,
  formatSectionLabel,
} from './patientDocuments';

test('formatSectionLabel translates known CRF section keys and falls back cleanly', () => {
  assert.equal(formatSectionLabel('labGlycemic'), 'Glycemic Profile (HbA1c / Glucose)');
  assert.equal(formatSectionLabel('medications'), 'Medications & Prescription');
  assert.equal(formatSectionLabel('sectionD'), 'Komplications Score (KS)');
  assert.equal(formatSectionLabel('custom_lipid-panel'), 'Custom Lipid Panel');
});

test('detectDocumentKind classifies PDF, images, text, and other types accurately', () => {
  assert.equal(detectDocumentKind('application/pdf', 'lab.bin'), 'pdf');
  assert.equal(detectDocumentKind('application/octet-stream', 'Report.PDF'), 'pdf');
  assert.equal(detectDocumentKind('image/png', 'scan.png'), 'image');
  assert.equal(detectDocumentKind('', 'fundus.jpeg'), 'image');
  assert.equal(detectDocumentKind('text/csv', 'labs.csv'), 'text');
  assert.equal(detectDocumentKind('application/zip', 'archive.zip'), 'other');
});

test('createClinicalPdfDataUrl generates a valid %PDF-1.4 payload and enriches accurately', () => {
  const pdfUrl = createClinicalPdfDataUrl('Desai Clinic Lab Report', [
    'Patient: Maheshbhai Desai',
    'UHID: NH-2026-4102',
    'HbA1c 1st: 9.8%',
  ]);
  assert.ok(pdfUrl.startsWith('data:application/pdf;base64,'));
  const raw = new TextDecoder().decode(
    decodeBase64ToBytes(pdfUrl.split(',')[1])
  );
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.ok(raw.includes('%%EOF'));
  assert.ok(raw.includes('Maheshbhai Desai'));

  const enriched = enrichAttachment({
    id: 'att-1',
    name: 'Baseline_Lab_Panel.pdf',
    section: 'labGlycemic',
    dataUrl: pdfUrl,
    uploadedAt: '2026-11-18T10:00:00.000Z',
  });
  assert.equal(enriched.kind, 'pdf');
  assert.equal(enriched.hasPayload, true);
  assert.ok((enriched.sizeBytes ?? 0) > 200);
  assert.ok(enriched.sizeLabel.endsWith('B') || enriched.sizeLabel.endsWith('KB'));
});

test('createClinicalSvgImageDataUrl and decodeTextDataUrl work cleanly', () => {
  const imgUrl = createClinicalSvgImageDataUrl({
    title: 'FibroScan Summary',
    subtitle: 'UHID NH-2026-4102',
    metrics: [{ label: 'LSM', value: '6.2 kPa' }],
  });
  const enriched = enrichAttachment({
    id: 'att-img',
    name: 'FibroScan_Chart.svg',
    section: 'labFibroScan',
    dataUrl: imgUrl,
    uploadedAt: '2026-11-18T10:05:00.000Z',
  });
  assert.equal(enriched.kind, 'image');
  assert.equal(enriched.hasPayload, true);

  const textUrl = 'data:text/plain;base64,' + Buffer.from('FBG: 186 mg/dL').toString('base64');
  assert.equal(decodeTextDataUrl(textUrl), 'FBG: 186 mg/dL');
  assert.equal(formatDocumentSize(null), 'Metadata only');
  assert.equal(formatDocumentSize(2048), '2.0 KB');
});

test('buildPatientDocumentGroups includes every patient and filters by search, roster, and kind', () => {
  const p1 = createBlankPatientCRF(1);
  p1.patientName = 'Maheshbhai Desai';
  p1.uhid = 'NH-2026-4102';
  p1.attachments = [
    {
      id: 'd1',
      name: 'HbA1c_Baseline.pdf',
      section: 'labGlycemic',
      dataUrl: createClinicalPdfDataUrl('Baseline', ['HbA1c 9.8%']),
      uploadedAt: '2026-11-15T09:00:00.000Z',
    },
    {
      id: 'd2',
      name: 'Prescription_Scan.png',
      section: 'medications',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      uploadedAt: '2026-11-16T11:30:00.000Z',
    },
  ];

  const p2 = createBlankPatientCRF(2);
  p2.patientName = 'Nandiniben Joshi';
  p2.uhid = 'NH-2026-4119';
  p2.attachments = [];

  const allGroups = buildPatientDocumentGroups([p1, p2]);
  assert.equal(allGroups.length, 2);
  assert.equal(allGroups[0].totalCount, 2);
  assert.equal(allGroups[0].pdfCount, 1);
  assert.equal(allGroups[0].imageCount, 1);
  assert.equal(allGroups[1].totalCount, 0);

  const withDocsOnly = buildPatientDocumentGroups([p1, p2], { rosterFilter: 'with-docs' });
  assert.equal(withDocsOnly.length, 1);
  assert.equal(withDocsOnly[0].patient.patientName, 'Maheshbhai Desai');

  const pdfOnly = buildPatientDocumentGroups([p1, p2], { kindFilter: 'pdf' });
  assert.equal(pdfOnly.length, 1);
  assert.equal(pdfOnly[0].documents.length, 1);
  assert.equal(pdfOnly[0].documents[0].attachment.name, 'HbA1c_Baseline.pdf');

  const searchByFile = buildPatientDocumentGroups([p1, p2], { search: 'Prescription' });
  assert.equal(searchByFile.length, 1);
  assert.equal(searchByFile[0].documents.length, 1);
  assert.equal(searchByFile[0].documents[0].attachment.id, 'd2');

  const searchByUhid = buildPatientDocumentGroups([p1, p2], { search: '4119' });
  assert.equal(searchByUhid.length, 1);
  assert.equal(searchByUhid[0].patient.patientName, 'Nandiniben Joshi');
});
