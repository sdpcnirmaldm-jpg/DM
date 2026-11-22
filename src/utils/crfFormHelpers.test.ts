import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankPatientCRF, recalculatePatientCRF } from './clinicalMath';
import {
  buildMedicationTableRows,
  deriveNephropathyTier,
  formatCrfQueriesSummary,
  mapDietModificationCategory,
  mapFollowUpCategory,
  mapHypoglycemiaCategory,
  mapPhysicalActivityCategory,
  mapSmokingPdfFlags,
  mapVaccinationCategory,
} from './crfFormHelpers';

test('mapHypoglycemiaCategory maps CRF severity levels onto PDF NO/Mild/Moderate/High checkboxes', () => {
  assert.equal(mapHypoglycemiaCategory('No'), 'NO');
  assert.equal(mapHypoglycemiaCategory('Level 1 Asymptomatic'), 'Mild');
  assert.equal(mapHypoglycemiaCategory('Level 1 Symptomatic'), 'Mild');
  assert.equal(mapHypoglycemiaCategory('Level 2'), 'Moderate');
  assert.equal(mapHypoglycemiaCategory('Level 3'), 'High');
  assert.equal(mapHypoglycemiaCategory('Recurrent Level 3 or LOC'), 'High');
  assert.equal(mapHypoglycemiaCategory(''), '');
});

test('lifestyle mappers translate numeric scores and statuses into PDF checkbox labels', () => {
  assert.equal(mapPhysicalActivityCategory('Sedentary'), 'Sedentary');
  assert.equal(mapPhysicalActivityCategory('30-89 min/week'), 'Light');
  assert.equal(mapPhysicalActivityCategory('>=150 min/week'), 'Mod-High');

  assert.equal(mapDietModificationCategory(5), 'Good');
  assert.equal(mapDietModificationCategory(3), 'Moderate');
  assert.equal(mapDietModificationCategory(1), 'Poor');

  assert.equal(mapFollowUpCategory(4), 'Regular');
  assert.equal(mapFollowUpCategory(2), 'Irregular');

  assert.equal(mapVaccinationCategory(5), 'All');
  assert.equal(mapVaccinationCategory(3), 'partially');
  assert.equal(mapVaccinationCategory(1), 'No');
});

test('mapSmokingPdfFlags resolves ex-smoker and current smoker quantity tiers', () => {
  const base = createBlankPatientCRF(1);
  base.smokingStatus = 'Current';
  base.smokingQuantity = '10-20/day';
  assert.deepEqual(mapSmokingPdfFlags(base), {
    isNo: false,
    isExSmoker: false,
    isYes: true,
    qtyBand: '10-20',
  });

  base.smokingStatus = 'Ex-smoker >1yr';
  assert.deepEqual(mapSmokingPdfFlags(base), {
    isNo: false,
    isExSmoker: true,
    isYes: false,
    qtyBand: '',
  });
});

test('buildMedicationTableRows combines antidiabetic & concomitant drugs and pads to 9 rows', () => {
  const crf = createBlankPatientCRF(1);
  crf.medicationVisits[0].visitDate = '2026-02-01';
  crf.medicationVisits[0].drugs = [
    { id: 'd1', drugName: 'Metformin', dose: '500mg', route: 'Oral', frequency: 'BD' },
  ];
  crf.otherMedications = [
    {
      id: 'o1',
      drugName: 'Rosuvastatin',
      dose: '10mg',
      route: 'Oral',
      frequency: 'HS',
      startDuration: '6 months',
      status: 'Current',
    },
  ];

  const rows = buildMedicationTableRows(crf, 9);
  assert.equal(rows.length, 9);
  assert.equal(rows[0].srNo, 1);
  assert.equal(rows[0].drugName, 'Metformin');
  assert.equal(rows[0].startDuration, '2026-02-01');
  assert.equal(rows[0].status, '');
  assert.equal(rows[1].drugName, 'Rosuvastatin');
  assert.equal(rows[1].startDuration, '6 months');
  assert.equal(rows[1].status, 'Current');
  assert.equal(rows[8].srNo, 9);
  assert.equal(rows[8].drugName, '');
  assert.equal(rows[8].status, '');
});

test('deriveNephropathyTier picks max of eGFR tier and UACR tier and formatCrfQueriesSummary lists missing items', () => {
  const crf = recalculatePatientCRF(createBlankPatientCRF(1));
  crf.ksMicroEgfrTier = 1;
  crf.ksMicroUacrTier = 3;
  assert.equal(deriveNephropathyTier(crf), 3);

  const summary = formatCrfQueriesSummary(crf);
  assert.equal(summary.isComplete, false);
  assert.ok(summary.summaryText.includes('Patient Name'));
});
