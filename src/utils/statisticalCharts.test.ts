import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import { runStudyStatisticalBattery } from './statistics';
import {
  buildPieSegments,
  buildRadarProfile,
  buildScatterPlotModel,
  buildStudyOverviewKpis,
} from './statisticalCharts';

test('buildPieSegments produces exact cluster percentages summing to 100% on non-empty cohort', () => {
  const segments = buildPieSegments(SEED_PATIENTS);
  assert.equal(segments.length, 4);
  const totalCount = segments.reduce((sum, s) => sum + s.count, 0);
  assert.equal(totalCount, SEED_PATIENTS.length);
  const totalArc = segments.reduce((sum, s) => sum + s.arcLength, 0);
  const expectedCirc = segments[0].circumference;
  assert.ok(Math.abs(totalArc - expectedCirc) < 0.01);
});

test('buildPieSegments handles empty patient cohort safely without NaN', () => {
  const segments = buildPieSegments([]);
  assert.equal(segments.length, 4);
  for (const s of segments) {
    assert.equal(s.count, 0);
    assert.equal(s.pct, 0);
    assert.equal(Number.isNaN(s.popX), false);
  }
});

test('buildScatterPlotModel computes paired coordinates and regression coefficients', () => {
  const model = buildScatterPlotModel(SEED_PATIENTS, 'age-hba1c');
  assert.equal(model.points.length, SEED_PATIENTS.length);
  assert.ok(model.slope !== null && Number.isFinite(model.slope));
  assert.ok(model.intercept !== null && Number.isFinite(model.intercept));
  assert.ok(model.xDomain[1] > model.xDomain[0]);
  assert.ok(model.yDomain[1] > model.yDomain[0]);
});

test('buildRadarProfile builds 6 normalized axes and 4 cluster series', () => {
  const battery = runStudyStatisticalBattery(SEED_PATIENTS);
  const radar = buildRadarProfile(battery.continuousTests);
  assert.equal(radar.axes.length, 6);
  assert.equal(radar.series.length, 4);
  for (const s of radar.series) {
    assert.equal(s.normalizedValues.length, 6);
    assert.equal(s.polygonPoints.split(' ').length, 6);
  }
});

test('buildStudyOverviewKpis summarizes cohort count, mean HbA1c, and dominant cluster', () => {
  const battery = runStudyStatisticalBattery(SEED_PATIENTS);
  const pie = buildPieSegments(SEED_PATIENTS);
  const kpis = buildStudyOverviewKpis(
    SEED_PATIENTS,
    battery.continuousTests,
    battery.categoricalTests,
    pie
  );
  assert.equal(kpis.totalPatients, SEED_PATIENTS.length);
  assert.ok(kpis.meanHba1c.endsWith('%'));
  assert.ok(kpis.dominantCluster !== null);
});

test('buildPieSegments and buildScatterPlotModel preserve unassigned clusters without defaulting to MARD', async () => {
  const { createBlankPatientCRF } = await import('./clinicalMath');
  const blank = createBlankPatientCRF(1);
  blank.patientName = 'Partial Only';
  blank.age = 52;
  blank.hba1c1 = { date: '', value: 8.1, unit: '%' };

  const pie = buildPieSegments([blank]);
  assert.equal(pie.reduce((sum, s) => sum + s.count, 0), 0);

  const scatter = buildScatterPlotModel([blank], 'age-hba1c');
  assert.equal(scatter.points.length, 1);
  assert.equal(scatter.points[0].cluster, 'Unassigned');
  assert.equal(scatter.points[0].participantId, '');
});

