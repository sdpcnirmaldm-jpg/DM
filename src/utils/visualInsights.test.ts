import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import { computeStudyRegressions } from './biostatisticsExtended';
import { computeDrugUtilizationEvaluation } from './drugUtilization';
import { runStudyStatisticalBattery } from './statistics';
import {
  buildVisualStudyInsights,
  describeCorrelationPlain,
  describePValuePlain,
  describeRegressionPlain,
} from './visualInsights';

test('buildVisualStudyInsights builds 4 cluster cards summing to 100% and 4 plain takeaways', () => {
  const battery = runStudyStatisticalBattery(SEED_PATIENTS);
  const due = computeDrugUtilizationEvaluation(SEED_PATIENTS);
  const regressions = computeStudyRegressions(SEED_PATIENTS);

  const insights = buildVisualStudyInsights(SEED_PATIENTS, battery.continuousTests, due, regressions);

  assert.equal(insights.clusterCards.length, 4);
  const totalCount = insights.clusterCards.reduce((s, c) => s + c.count, 0);
  assert.equal(totalCount, SEED_PATIENTS.length);

  const sidd = insights.clusterCards.find((c) => c.code === 'SIDD');
  assert.ok(sidd && sidd.meanHba1c !== null && sidd.meanHba1c > 9);

  assert.equal(insights.takeaways.length, 4);
  assert.ok(insights.takeaways[0].explanation.includes('SIDD'));
  assert.ok(insights.headlineSummary.includes(`${SEED_PATIENTS.length} patients`));
});

test('plain-English statistical helpers translate p-values, correlations, and regression fits cleanly', () => {
  assert.equal(describePValuePlain(0.012).label, 'Clear Difference');
  assert.equal(describePValuePlain(0.012).isSignificant, true);
  assert.equal(describePValuePlain(0.45).label, 'Similar Across Groups');

  const corr = describeCorrelationPlain(-0.9, 0.01);
  assert.equal(corr.strengthLabel, 'Strong Link');
  assert.equal(corr.directionLabel, 'Opposite Direction ↑↓');
  assert.equal(corr.isSignificant, true);

  const regText = describeRegressionPlain('Baseline HbA1c (%)', 'HOMA-B', -0.28, 0.85, 0.008);
  assert.ok(regText.includes('85%'));
  assert.ok(regText.includes('lower'));
});
