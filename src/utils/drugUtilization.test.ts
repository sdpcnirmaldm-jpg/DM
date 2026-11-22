import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import {
  classifyAntidiabeticDrug,
  classifyRegimenComplexity,
  computeDrugUtilizationEvaluation,
} from './drugUtilization';

test('classifyAntidiabeticDrug classifies single agents, FDCs, and insulins accurately', () => {
  const met = classifyAntidiabeticDrug('Metformin');
  assert.deepEqual(met.classes, ['Biguanides']);
  assert.equal(met.isFdc, false);
  assert.equal(met.isInsulin, false);

  const fdc = classifyAntidiabeticDrug('Dapagliflozin + Metformin');
  assert.equal(fdc.isFdc, true);
  assert.ok(fdc.classes.includes('SGLT2 Inhibitors'));
  assert.ok(fdc.classes.includes('Biguanides'));

  const ins = classifyAntidiabeticDrug('Insulin Glargine');
  assert.deepEqual(ins.classes, ['Insulin Therapy']);
  assert.equal(ins.isInsulin, true);
});

test('classifyRegimenComplexity identifies Monotherapy, Dual, Triple+, and Insulin-Containing', () => {
  const mahesh = SEED_PATIENTS.find((p) => p.participantId === 'M08001')!;
  const nandini = SEED_PATIENTS.find((p) => p.participantId === 'F08001')!;
  const suresh = SEED_PATIENTS.find((p) => p.participantId === 'M11001')!;
  const harish = SEED_PATIENTS.find((p) => p.participantId === 'M08003')!;

  assert.equal(classifyRegimenComplexity(mahesh), 'Triple+ Therapy');
  assert.equal(classifyRegimenComplexity(nandini), 'Dual Therapy');
  assert.equal(classifyRegimenComplexity(suresh), 'Insulin-Containing');
  assert.equal(classifyRegimenComplexity(harish), 'Monotherapy');
});

test('computeDrugUtilizationEvaluation produces WHO prescribing indicators, class matrix, and HbA1c outcomes', () => {
  const report = computeDrugUtilizationEvaluation(SEED_PATIENTS);
  assert.equal(report.indicators.totalPatients, SEED_PATIENTS.length);
  assert.ok(report.indicators.totalActiveAntidiabeticPrescriptions >= 12);
  assert.ok(report.indicators.meanAntidiabeticsPerPatient >= 2);
  assert.ok(report.indicators.insulinUtilizationPct > 0);
  assert.ok(report.classMatrix.length >= 4);
  const biguanides = report.classMatrix.find((c) => c.drugClass === 'Biguanides');
  assert.ok(biguanides && biguanides.totalPatients === SEED_PATIENTS.length);
  assert.ok(report.topDrugs.some((d) => d.drugName === 'Metformin'));
  assert.equal(report.complexityRows.length, 5);
});
