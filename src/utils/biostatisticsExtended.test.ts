import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import {
  buildCorrelationHeatmap,
  computeDescriptiveProfile,
  computeOlsRegression,
  computeStudyRegressions,
} from './biostatisticsExtended';

test('Descriptive profile groups cohort metrics into all 4 protocol data types', () => {
  const profile = computeDescriptiveProfile(SEED_PATIENTS);

  assert.equal(profile.cohortSize, SEED_PATIENTS.length);
  assert.ok(profile.continuousVariables.length >= 10, 'Has continuous variables');
  assert.ok(profile.discreteVariables.length >= 5, 'Has discrete variables');
  assert.ok(profile.ordinalVariables.length >= 5, 'Has ordinal variables');
  assert.ok(profile.nominalVariables.length >= 4, 'Has nominal variables');

  const ageRow = profile.continuousVariables.find((r) => r.variable === 'Age');
  assert.ok(ageRow && ageRow.n === SEED_PATIENTS.length);
  assert.ok(ageRow.ciLower <= ageRow.mean && ageRow.mean <= ageRow.ciUpper);
  assert.ok(ageRow.min <= ageRow.median && ageRow.median <= ageRow.max);

  const clusterRow = profile.nominalVariables.find((r) => r.variable === 'T2DM Phenotypic Cluster');
  assert.ok(clusterRow);
  const sumCounts = clusterRow.levels.reduce((s, l) => s + l.count, 0);
  assert.equal(sumCounts, SEED_PATIENTS.length);
});

test('OLS linear regression recovers exact slope, intercept, R^2, and low p-value on synthetic linear data', () => {
  // Exact linear relationship y = 2.5 * x + 3 with minor jitter so SSE > 0
  const synthetic = [
    { participantId: 'P1', patientName: 'A', cluster: 'SIDD' as const, x: 1, y: 5.4 },
    { participantId: 'P2', patientName: 'B', cluster: 'SIDD' as const, x: 2, y: 8.1 },
    { participantId: 'P3', patientName: 'C', cluster: 'SIRD' as const, x: 3, y: 10.4 },
    { participantId: 'P4', patientName: 'D', cluster: 'CIRDD' as const, x: 4, y: 13.1 },
    { participantId: 'P5', patientName: 'E', cluster: 'MARD' as const, x: 5, y: 15.5 },
    { participantId: 'P6', patientName: 'F', cluster: 'MARD' as const, x: 6, y: 18.0 },
  ];

  const res = computeOlsRegression('test', 'Test Predictor', 'u', synthetic);
  assert.equal(res.n, 6);
  assert.ok(res.slope !== null && Math.abs(res.slope - 2.5) < 0.15);
  assert.ok(res.intercept !== null && Math.abs(res.intercept - 3.0) < 0.4);
  assert.ok(res.rSquared !== null && res.rSquared > 0.99);
  assert.ok(res.pValue !== null && res.pValue < 0.001);
  assert.ok(res.ciLower !== null && res.ciUpper !== null && res.ciLower < res.slope && res.slope < res.ciUpper);
});

test('Study regressions compute models for HbA1c, Blue Index DHS, and FibroScan LSM', () => {
  const suites = computeStudyRegressions(SEED_PATIENTS);
  assert.equal(suites.length, 3);
  assert.deepEqual(
    suites.map((s) => s.outcomeKey),
    ['hba1c', 'dhs', 'lsm']
  );

  for (const suite of suites) {
    assert.ok(suite.models.length >= 6);
    const valid = suite.models.filter((m) => m.rSquared !== null);
    assert.ok(valid.length > 0, `Suite ${suite.outcomeKey} has valid OLS fits`);
  }
});

test('Correlation matrix heatmap is symmetric with unit diagonal', () => {
  const heatmap = buildCorrelationHeatmap(SEED_PATIENTS);
  const k = heatmap.variables.length;
  assert.equal(k, 8);
  assert.equal(heatmap.matrix.length, k);

  for (let i = 0; i < k; i++) {
    assert.equal(heatmap.matrix[i][i].r, 1);
    for (let j = 0; j < k; j++) {
      assert.equal(heatmap.matrix[i][j].r, heatmap.matrix[j][i].r);
      assert.equal(heatmap.matrix[i][j].p, heatmap.matrix[j][i].p);
    }
  }
});
