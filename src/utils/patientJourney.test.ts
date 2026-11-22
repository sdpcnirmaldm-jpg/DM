import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import { createBlankPatientCRF } from './clinicalMath';
import {
  buildBlueIndexDomainBars,
  buildDdsSubscaleBars,
  buildPatientClinicalProblems,
  buildPatientDrugHealthLinks,
  buildPatientGlycemicTimeline,
} from './patientJourney';

test('buildPatientGlycemicTimeline computes improvement delta and chronological events for M08001', () => {
  const mahesh = SEED_PATIENTS.find((p) => p.participantId === 'M08001');
  assert.ok(mahesh, 'Seed patient M08001 should exist');

  const summary = buildPatientGlycemicTimeline(mahesh);
  assert.equal(summary.baselineHba1c, 9.8);
  assert.equal(summary.latestHba1c, 7.4);
  assert.equal(summary.deltaHba1c, -2.4);
  assert.equal(summary.trendStatus, 'Improved');
  assert.equal(summary.trajectoryPoints.length, 2);
  assert.ok(summary.timelineEvents.some((e) => e.phase === 'Onset'));
  assert.ok(summary.timelineEvents.some((e) => e.phase === 'Glycemic Follow-up'));
});

test('buildPatientClinicalProblems identifies MASLD FibroScan and insulin resistance in SIRD F08001', () => {
  const nandini = SEED_PATIENTS.find((p) => p.participantId === 'F08001');
  assert.ok(nandini, 'Seed patient F08001 should exist');

  const problems = buildPatientClinicalProblems(nandini);
  const hepatic = problems.find((p) => p.id === 'prob-hepatic');
  const islet = problems.find((p) => p.id === 'prob-homa');
  const cardio = problems.find((p) => p.id === 'prob-cardio');

  assert.ok(hepatic, 'Hepatic problem should be flagged for LSM 10.4 / CAP 312');
  assert.equal(hepatic.severity, 'critical');
  assert.ok(islet, 'Islet insulin resistance should be detected');
  assert.ok(cardio, 'Cardiometabolic problem should be detected');
});

test('buildPatientDrugHealthLinks maps antidiabetic & concomitant drugs with linked patient outcomes', () => {
  const mahesh = SEED_PATIENTS.find((p) => p.participantId === 'M08001');
  assert.ok(mahesh);

  const drugs = buildPatientDrugHealthLinks(mahesh);
  assert.equal(drugs.length, 5); // 3 antidiabetic + 2 concomitant

  const dapa = drugs.find((d) => d.drugName.toLowerCase().includes('dapagliflozin'));
  assert.ok(dapa);
  assert.deepEqual(dapa.classLabels, ['SGLT2 Inhibitors']);
  assert.ok(dapa.patientHealthBenefit.includes('9.8% to 7.4%'));
  assert.ok(dapa.linkedMetrics.some((m) => m.label === 'eGFR'));

  const telmi = drugs.find((d) => d.drugName.toLowerCase().includes('telmisartan'));
  assert.ok(telmi);
  assert.equal(telmi.category, 'Concomitant');
  assert.deepEqual(telmi.classLabels, ['Antihypertensives']);
  assert.ok(telmi.linkedMetrics.some((m) => m.value.includes('126/78')));
});

test('buildBlueIndexDomainBars and buildDdsSubscaleBars handle complete and blank patients cleanly', () => {
  const mahesh = SEED_PATIENTS.find((p) => p.participantId === 'M08001');
  assert.ok(mahesh);

  const dhsBars = buildBlueIndexDomainBars(mahesh);
  assert.equal(dhsBars.length, 10);
  assert.ok(dhsBars.every((b) => b.pct >= 0 && b.pct <= 100));

  const ddsBars = buildDdsSubscaleBars(mahesh);
  assert.equal(ddsBars.length, 4);

  const blank = createBlankPatientCRF(1);
  const blankSummary = buildPatientGlycemicTimeline(blank);
  assert.equal(blankSummary.trajectoryPoints.length, 0);
  assert.equal(blankSummary.trendStatus, 'Pending');
  assert.equal(buildPatientDrugHealthLinks(blank).length, 0);
  assert.equal(buildPatientClinicalProblems(blank).length, 0);
});

test('baseline HbA1c below 7.0% projects flat maintenance rather than aiming upward to 7.0%', () => {
  const controlled = createBlankPatientCRF(1);
  controlled.patientName = 'Gunvantbhai S.';
  controlled.hba1c1 = { date: '2026-11-01', value: 6.1, unit: '%' };
  controlled.hba1c2 = { date: '', value: null, unit: '%' };

  const summary = buildPatientGlycemicTimeline(controlled);
  assert.equal(summary.baselineHba1c, 6.1);
  assert.equal(summary.trendStatus, 'Target Achieved (<7%)');
  assert.equal(summary.followUpProjection.alreadyControlled, true);
  assert.equal(summary.followUpProjection.projectedHba1c, 6.1);
  assert.ok(summary.followUpProjection.nodeHint.includes('Maintain'));

  const pendingEv = summary.timelineEvents.find((e) => e.id === 'ev-hba1c2-pending');
  assert.ok(pendingEv);
  assert.equal(pendingEv.tone, 'emerald');
  assert.ok(pendingEv.detail.includes('6.1%'));
  assert.ok(pendingEv.detail.includes('sustained control'));

  const elevated = createBlankPatientCRF(2);
  elevated.hba1c1 = { date: '2026-11-01', value: 8.2, unit: '%' };
  elevated.hba1c2 = { date: '', value: null, unit: '%' };
  const elevatedSummary = buildPatientGlycemicTimeline(elevated);
  assert.equal(elevatedSummary.followUpProjection.alreadyControlled, false);
  assert.equal(elevatedSummary.followUpProjection.projectedHba1c, 7.0);
  const elevatedPendingEv = elevatedSummary.timelineEvents.find((e) => e.id === 'ev-hba1c2-pending');
  assert.equal(elevatedPendingEv?.tone, 'amber');
});

