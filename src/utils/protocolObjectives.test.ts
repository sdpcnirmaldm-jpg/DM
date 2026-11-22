import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_PATIENTS } from '../data/seedPatients';
import {
  buildProtocolObjectivesReport,
  classifyProtocolAgeBand,
  PROTOCOL_AGE_BANDS,
} from './protocolObjectives';

test('classifyProtocolAgeBand maps adult ages strictly onto the 6 protocol strata', () => {
  assert.equal(classifyProtocolAgeBand(18), '18–25');
  assert.equal(classifyProtocolAgeBand(25), '18–25');
  assert.equal(classifyProtocolAgeBand(32), '26–35');
  assert.equal(classifyProtocolAgeBand(42), '36–45');
  assert.equal(classifyProtocolAgeBand(52), '46–55');
  assert.equal(classifyProtocolAgeBand(63), '56–65');
  assert.equal(classifyProtocolAgeBand(66), '66–75');
  assert.equal(classifyProtocolAgeBand(null), null);
});

test('buildProtocolObjectivesReport generates all 12 secondary objectives, predefined age bands, and correlations', () => {
  const report = buildProtocolObjectivesReport(SEED_PATIENTS);
  assert.equal(report.objectivesMatrix.length, 12);
  assert.equal(report.objectivesMatrix[0].number, 1);
  assert.equal(report.objectivesMatrix[11].number, 12);
  assert.ok(report.ageBands.length >= PROTOCOL_AGE_BANDS.length);
  const totalAgeCount = report.ageBands.reduce((sum, b) => sum + b.count, 0);
  assert.equal(totalAgeCount, SEED_PATIENTS.length);
  assert.ok(report.objectiveCorrelations.length >= 8);
});
