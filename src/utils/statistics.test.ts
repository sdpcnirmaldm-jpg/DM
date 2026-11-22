import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeCategoricalAcrossGroups,
  analyzeContinuousAcrossGroups,
  analyzeCorrelation,
} from './statistics';

test('One-way ANOVA and Kruskal-Wallis detect significant difference across separated groups', () => {
  const res = analyzeContinuousAcrossGroups('HbA1c (%)', {
    SIDD: [10.2, 10.8, 11.1, 10.5],
    SIRD: [7.8, 8.1, 7.9, 8.0],
    CIRDD: [7.4, 7.2, 7.6, 7.3],
    MARD: [6.7, 6.9, 6.6, 6.8],
  });

  assert.ok(res.anovaF !== null && res.anovaF > 100);
  assert.ok(res.anovaP !== null && res.anovaP < 0.001);
  assert.ok(res.kruskalH !== null && res.kruskalH > 12);
  assert.ok(res.kruskalP !== null && res.kruskalP < 0.01);
});

test('Chi-square contingency test computes exact chi2 and df', () => {
  const res = analyzeCategoricalAcrossGroups(
    'Gender',
    ['SIDD', 'SIRD'],
    ['Male', 'Female'],
    {
      SIDD: { Male: 18, Female: 2 },
      SIRD: { Male: 4, Female: 16 },
    }
  );
  assert.equal(res.df, 1);
  assert.ok(res.chiSquare !== null && Math.abs(res.chiSquare - 19.798) < 0.05);
  assert.ok(res.pValue !== null && res.pValue < 0.001);
});

test('Pearson and Spearman correlation compute perfect positive linear correlation', () => {
  const res = analyzeCorrelation('Age vs HbA1c', [
    [30, 6.0],
    [40, 7.0],
    [50, 8.0],
    [60, 9.0],
    [70, 10.0],
  ]);
  assert.equal(res.pearsonR, 1);
  assert.equal(res.spearmanRho, 1);
  assert.ok(res.pearsonP !== null && res.pearsonP < 0.001);
});
