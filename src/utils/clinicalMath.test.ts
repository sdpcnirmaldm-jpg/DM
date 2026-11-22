import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAgeFromDOB,
  calculateBMI,
  calculateCkDEpi2021,
  calculateDDS17,
  calculateDiagnosisMetrics,
  calculateHOMA,
  calculateMicrovascularScore,
  calculateWHR,
  computeBlueIndex,
  createBlankPatientCRF,
  deriveEgfrTier,
  deriveUacrTier,
  evaluateMissingDataAndStatus,
  generateParticipantId,
  getNextSequenceForCohort,
  normalizeClusterType,
  recalculatePatientCRF,
  resolveAgeAndDiagnosisFromDOB,
  scoreDomainA_HbA1c,
  scoreDomainB_BP,
  scoreDomainC_Lipids,
  suggestPhenotypeCluster,
  toHba1cPercent,
} from './clinicalMath';

test('generateParticipantId formats Male January #1 as M01001 and advances sequence', () => {
  assert.equal(generateParticipantId('Male', '2026-01-15', 1), 'M01001');
  assert.equal(generateParticipantId('Female', '2026-07-04', 12), 'F07012');
  assert.equal(generateParticipantId('Other', '2026-11-14', 3), 'O11003');
  assert.equal(getNextSequenceForCohort(['M01001', 'M01002', 'F01001'], 'Male', '2026-01-20'), 3);
});

test('calculateAgeFromDOB and calculateDiagnosisMetrics compute exact years and duration', () => {
  assert.equal(calculateAgeFromDOB('1980-05-10', '2026-11-14'), 46);
  assert.equal(calculateAgeFromDOB('1980-12-20', '2026-11-14'), 45);
  const diag = calculateDiagnosisMetrics('1980-05-10', '2020-07', '2026-11-14');
  assert.equal(diag.ageAtDiagnosis, 40);
  assert.equal(diag.durationYears, 6);
  assert.equal(diag.durationMonths, 4);
});

test('resolveAgeAndDiagnosisFromDOB derives age, diagnosis date, age at diagnosis, and duration from DOB reference', () => {
  // 1. DOB + diagnosisMonthYear (year-only) does not subtract 1 when birthMonth > January
  const fromYearOnly = resolveAgeAndDiagnosisFromDOB({
    dob: '1969-05-02',
    age: 50, // stale value overridden by DOB
    diagnosisMonthYear: '2019',
    ageAtDiagnosis: null,
    durationYears: null,
    durationMonths: null,
    referenceDate: '2026-11-19',
  });
  assert.equal(fromYearOnly.age, 57);
  assert.equal(fromYearOnly.ageAtDiagnosis, 50);
  assert.equal(fromYearOnly.durationYears, 7);
  assert.equal(fromYearOnly.durationMonths, 6);
  assert.equal(fromYearOnly.durationDecimalYears, 7.5);

  // 2. DOB + Age at Diagnosis derives diagnosisMonthYear and Duration
  const fromAgeAtDiag = resolveAgeAndDiagnosisFromDOB({
    dob: '1979-03-18',
    age: null,
    diagnosisMonthYear: '',
    ageAtDiagnosis: 39,
    durationYears: null,
    durationMonths: null,
    referenceDate: '2026-08-14',
  });
  assert.equal(fromAgeAtDiag.age, 47);
  assert.equal(fromAgeAtDiag.diagnosisMonthYear, '2018-03');
  assert.equal(fromAgeAtDiag.ageAtDiagnosis, 39);
  assert.equal(fromAgeAtDiag.durationYears, 8);
  assert.equal(fromAgeAtDiag.durationMonths, 5);
  assert.equal(fromAgeAtDiag.durationDecimalYears, 8.4);

  // 3. DOB + Duration derives diagnosisMonthYear and Age at Diagnosis
  const fromDuration = resolveAgeAndDiagnosisFromDOB({
    dob: '1980-05-10',
    age: null,
    diagnosisMonthYear: '',
    ageAtDiagnosis: null,
    durationYears: 6,
    durationMonths: 6,
    referenceDate: '2026-11-19',
  });
  assert.equal(fromDuration.age, 46);
  assert.equal(fromDuration.diagnosisMonthYear, '2020-05');
  assert.equal(fromDuration.ageAtDiagnosis, 40);
  assert.equal(fromDuration.durationYears, 6);
  assert.equal(fromDuration.durationMonths, 6);
  assert.equal(fromDuration.durationDecimalYears, 6.5);
});

test('BMI, WHR, CKD-EPI 2021 eGFR, and HOMA formulas compute accurately', () => {
  assert.equal(calculateBMI(75, 170), 26.0);
  assert.equal(calculateWHR(96, 100), 0.96);

  // CKD-EPI 2021: 50yo Male, Creatinine 1.0 mg/dL -> ~92 mL/min/1.73m2
  const egfrMale = calculateCkDEpi2021(1.0, 50, 'Male');
  assert.ok(egfrMale !== null && egfrMale >= 88 && egfrMale <= 96);

  // HOMA-IR & HOMA-B via fasting insulin (FBG=126, Insulin=15)
  const homaIns = calculateHOMA({
    fbgMgDl: 126,
    insulinValue: 15,
    insulinUnit: 'µIU/mL',
    cPeptideValue: null,
    cPeptideUnit: 'ng/mL',
    method: 'insulin',
  });
  assert.equal(homaIns.homaIR, 4.67);
  assert.equal(homaIns.homaB, 85.7);

  // HOMA-B (Matthews Linear Approximation) & HOMA-IR (CP) (Calibrated Oxford/Asian Cohort)
  // FBG = 150 mg/dL, C-peptide = 2.0 ng/mL
  // HOMA-B = (360 * 2.0) / (150 - 63) = 720 / 87 = 8.3
  // HOMA-IR (CP) = (150 * 2.0) / 115 = 300 / 115 = 2.61
  const homaCp = calculateHOMA({
    fbgMgDl: 150,
    insulinValue: null,
    insulinUnit: 'µIU/mL',
    cPeptideValue: 2.0,
    cPeptideUnit: 'ng/mL',
    method: 'c-peptide',
  });
  assert.equal(homaCp.homaB, 8.3);
  assert.equal(homaCp.homaIR, 2.61);

  // pmol/L conversion check: 662 pmol/L == 2.0 ng/mL
  const homaCpPmol = calculateHOMA({
    fbgMgDl: 150,
    insulinValue: null,
    insulinUnit: 'µIU/mL',
    cPeptideValue: 662,
    cPeptideUnit: 'pmol/L',
    method: 'c-peptide',
  });
  assert.equal(homaCpPmol.homaB, 8.3);
  assert.equal(homaCpPmol.homaIR, 2.61);
});

test('Blue Index Maximal Severity Principle matches clinical reference manual examples', () => {
  // Case 1 from manual: eGFR Tier 0, UACR Tier 0, Eye PDR Tier 4 -> Score M = 4
  assert.equal(calculateMicrovascularScore(0, 0, 4), 4);
  // Case 2: eGFR Tier 3, UACR Tier 3, Eye Tier 2 -> Score M = 3
  assert.equal(calculateMicrovascularScore(3, 3, 2), 3);
  // Case 3: All Tier 0 -> Score M = 0
  assert.equal(calculateMicrovascularScore(0, 0, 0), 0);

  assert.equal(scoreDomainA_HbA1c(6.8, 7.0), 5);
  assert.equal(scoreDomainA_HbA1c(7.4, 7.0), 4);
  assert.equal(scoreDomainA_HbA1c(11.5, 7.0), 0);

  const bi = computeBlueIndex(
    { A: 5, B: 5, C: 5, D: 5, E: 5, F: 5, G: 5, H: 5, I: 5, J: 5 },
    1,
    1,
    0
  );
  assert.equal(bi.dhsTotal, 50);
  assert.equal(bi.dhsCategory, 'Excellent Status');
  assert.equal(bi.ksTotal, 2);
});

test('Laboratory-driven DHS and KS microvascular tiers recalculate live without stale values', () => {
  // Unit conversion & tier helpers
  assert.equal(toHba1cPercent(53, 'mmol/mol'), 7.0);
  assert.equal(deriveEgfrTier(95), 0);
  assert.equal(deriveEgfrTier(45), 3);
  assert.equal(deriveEgfrTier(12), 5);
  assert.equal(deriveUacrTier(18, 95), 0);
  assert.equal(deriveUacrTier(120, 75), 2);
  assert.equal(deriveUacrTier(350, 75), 3); // >=300 with preserved eGFR
  assert.equal(deriveUacrTier(350, 45), 4); // >300 with active decline (eGFR < 60)
  assert.equal(deriveUacrTier(2500, 45), 5); // Nephrotic range proteinuria

  // BP & Lipids scoring per PDF criteria
  assert.equal(scoreDomainB_BP(124, 78, false), 5);
  assert.equal(scoreDomainB_BP(124, 78, true), 4);
  assert.equal(scoreDomainB_BP(175, 92, true), 0);
  assert.equal(scoreDomainC_Lipids({ tc: 180, tg: 130, ldl: 90, nonHdl: 120, onStatin: false }), 5);
  assert.equal(scoreDomainC_Lipids({ tc: 180, tg: 130, ldl: 90, nonHdl: 120, onStatin: true }), 4);
  assert.equal(scoreDomainC_Lipids({ tc: 210, tg: 550, ldl: 110, nonHdl: 150, onStatin: true }), 0);

  // Full CRF reactive recalculation from initial high-risk labs -> updated normal labs
  let crf = createBlankPatientCRF(1);
  crf.dob = '1970-01-01';
  crf.gender = 'Male';
  crf.hba1c1 = { date: '2026-11-14', value: 78, unit: 'mmol/mol' }; // ~9.29% -> 2.1-4.0% off -> Domain A = 1
  crf.serumCreatinine = { date: '2026-11-14', value: 2.2, unit: 'mg/dL' }; // eGFR ~33 (Tier 3)
  crf.uacr = { date: '2026-11-14', value: 380, unit: 'mg/g' }; // >300 with eGFR <60 -> Tier 4
  crf.totalCholesterol = { date: '2026-11-14', value: 230, unit: 'mg/dL' };
  crf.hdl = { date: '2026-11-14', value: 40, unit: 'mg/dL' }; // Non-HDL 190
  crf.ldl = { date: '2026-11-14', value: 145, unit: 'mg/dL' }; // All 3 above -> Domain C = 1
  crf.triglycerides = { date: '2026-11-14', value: 180, unit: 'mg/dL' };
  crf = recalculatePatientCRF(crf);

  assert.equal(crf.dhsDomains.A, 1);
  assert.equal(crf.dhsDomains.C, 1);
  assert.equal(crf.ksMicroEgfrTier, 3);
  assert.equal(crf.ksMicroUacrTier, 4);
  assert.equal(crf.ksMicrovascular, 4);
  assert.equal(crf.microalbuminStatus, 'Macroalbuminuria');

  // Now update labs to improved values (verify stale Tier 3 / Tier 4 do NOT stick!)
  crf.hba1c2 = { date: '2026-11-14', value: 6.7, unit: '%' };
  crf.serumCreatinine = { date: '2026-11-14', value: 0.85, unit: 'mg/dL' }; // eGFR >= 90 -> Tier 0
  crf.uacr = { date: '2026-11-14', value: 14, unit: 'mg/g' }; // <30 -> Tier 0
  crf.totalCholesterol = { date: '2026-11-14', value: 170, unit: 'mg/dL' };
  crf.hdl = { date: '2026-11-14', value: 48, unit: 'mg/dL' }; // Non-HDL 122
  crf.ldl = { date: '2026-11-14', value: 85, unit: 'mg/dL' };
  crf.onStatin = true;
  crf = recalculatePatientCRF(crf);

  assert.equal(crf.dhsDomains.A, 5);
  assert.equal(crf.dhsDomains.C, 4);
  assert.equal(crf.ksMicroEgfrTier, 0);
  assert.equal(crf.ksMicroUacrTier, 0);
  assert.equal(crf.ksMicrovascular, 0);
  assert.equal(crf.microalbuminStatus, 'Normoalbuminuria');

  // Verify explicit manual domain override is preserved when recalculate runs
  crf.dhsDomainOverrides = { A: true };
  crf.dhsDomains.A = 2;
  crf = recalculatePatientCRF(crf);
  assert.equal(crf.dhsDomains.A, 2);
});

test('DDS-17 scoring calculates total, mean, 4 subscales, and category', () => {
  const items = Array(17).fill(3); // Moderate/High boundary: mean 3.0 -> High Distress
  const dds = calculateDDS17(items);
  assert.equal(dds.ddsTotal, 51);
  assert.equal(dds.ddsMean, 3);
  assert.equal(dds.ddsEmotionalBurden, 3);
  assert.equal(dds.ddsPhysicianDistress, 3);
  assert.equal(dds.ddsRegimenDistress, 3);
  assert.equal(dds.ddsInterpersonalDistress, 3);
  assert.equal(dds.ddsCategory, 'High Distress');
});

test('evaluateMissingDataAndStatus classifies Green, Yellow, Orange, Red accurately', () => {
  const crf = createBlankPatientCRF(1);
  crf.patientName = 'Rajesh Patel';
  crf.uhid = 'NH-1001';
  crf.dob = '1978-04-12';
  crf.contactNumber = '9876543210';
  crf.bloodGroup = 'B+';
  crf.diagnosisMonthYear = '2019-06';
  crf.familyHistoryDM = 'Yes';
  crf.smokingStatus = 'Never';
  crf.physicalActivity = '>=150 min/week';
  crf.dietAdherenceScore = 5;
  crf.ksMacrovascular = 0;
  crf.ksMicroRetinopathyTier = 0;
  crf.ksFootNeuropathy = 0;
  crf.ddsItems = Array(17).fill(1);
  crf.heightValue = 172;
  crf.weightValue = 74;
  crf.waistValue = 92;
  crf.hipValue = 98;
  crf.sbp = 124;
  crf.dbp = 78;
  crf.fbg.value = 118;
  crf.ppbg.value = 162;
  crf.hba1c1.value = 7.1;
  crf.totalCholesterol.value = 180;
  crf.triglycerides.value = 130;
  crf.hdl.value = 46;
  crf.ldl.value = 95;
  crf.hemoglobin.value = 13.8;
  crf.serumCreatinine.value = 0.9;
  crf.uacr.value = 18;
  crf.ast.value = 24;
  crf.alt.value = 26;
  crf.medicationVisits[0].drugs[0].drugName = 'Metformin';

  // Verify blank patient routes DDS-17 and KS missing items to dedicated tabs
  const blankMissing = evaluateMissingDataAndStatus(createBlankPatientCRF(1)).missingFields;
  assert.equal(blankMissing.find((m) => m.key === 'ddsItems')?.tab, 'dds17');
  assert.equal(blankMissing.find((m) => m.key === 'ksMacrovascular')?.tab, 'komplications');
  assert.equal(blankMissing.find((m) => m.key === 'ksMicroRetinopathyTier')?.tab, 'komplications');
  assert.equal(blankMissing.find((m) => m.key === 'ksFootNeuropathy')?.tab, 'komplications');

  // Missing 2nd HbA1c, C-peptide, FibroScan -> Orange
  let res = evaluateMissingDataAndStatus(recalculatePatientCRF(crf));
  assert.equal(res.statusColor, 'orange');

  // Fill C-peptide & FibroScan, leave 2nd HbA1c empty -> Yellow
  crf.cPeptide.value = 1.9;
  crf.lsmKpa = 6.1;
  crf.capDbm = 230;
  res = evaluateMissingDataAndStatus(recalculatePatientCRF(crf));
  assert.equal(res.statusColor, 'yellow');

  // Fill 2nd HbA1c -> Green
  crf.hba1c2.value = 6.7;
  res = evaluateMissingDataAndStatus(recalculatePatientCRF(crf));
  assert.equal(res.statusColor, 'green');
});

test('Cluster classification and normalization restrict phenotypes strictly to SIDD, SIRD, CIRDD, MARD', () => {
  const valid = new Set(['SIDD', 'SIRD', 'CIRDD', 'MARD']);
  assert.equal(normalizeClusterType('MOD', 'CIRDD'), 'CIRDD');
  assert.equal(normalizeClusterType('IROD', 'SIDD'), 'SIDD');
  assert.equal(normalizeClusterType('CIRDD', 'MARD'), 'CIRDD');

  const base = createBlankPatientCRF(1);
  base.dob = '1975-01-01';

  // High HbA1c + low HOMA-B + high HOMA-IR -> CIRDD
  const cirddCrf = { ...base, hba1c1: { date: '', value: 9.8, unit: '%' as const }, homaB: 32, homaIR: 3.4 };
  assert.equal(suggestPhenotypeCluster(cirddCrf), 'CIRDD');

  // High HbA1c + low HOMA-B + normal HOMA-IR -> SIDD
  const siddCrf = { ...base, hba1c1: { date: '', value: 9.5, unit: '%' as const }, homaB: 35, homaIR: 1.8 };
  assert.equal(suggestPhenotypeCluster(siddCrf), 'SIDD');

  // High HOMA-IR + preserved HOMA-B -> SIRD
  const sirdCrf = { ...base, hba1c1: { date: '', value: 7.5, unit: '%' as const }, homaB: 110, homaIR: 4.1 };
  assert.equal(suggestPhenotypeCluster(sirdCrf), 'SIRD');

  // Older onset, moderate labs -> MARD
  const mardCrf = { ...base, dob: '1958-01-01', hba1c1: { date: '', value: 6.8, unit: '%' as const }, homaB: 90, homaIR: 1.9 };
  const mardRes = suggestPhenotypeCluster(mardCrf);
  assert.equal(mardRes, 'MARD');
  assert.ok(valid.has(mardRes));
});

test('createBlankPatientCRF and recalculatePatientCRF preserve blank unentered fields', () => {
  const blank = createBlankPatientCRF(1);
  assert.equal(blank.gender, '');
  assert.equal(blank.visitNo, '');
  assert.equal(blank.dateOfRecruitment, '');
  assert.equal(blank.participantId, '');
  assert.equal(blank.clusterType, '');
  assert.equal(blank.suggestedCluster, '');
  assert.equal(blank.microalbuminStatus, '');
  assert.equal(blank.hba1c1.date, '');
  assert.equal(blank.medicationVisits[0].visitDate, '');
  assert.equal(blank.medicationVisits[0].drugs[0].route, '');
  assert.equal(blank.medicationVisits[0].drugs[0].frequency, '');
  assert.equal(blank.medicationVisits[0].drugs[0].status, '');
  assert.equal(calculateCkDEpi2021(1.0, 50, ''), null);

  const partial = recalculatePatientCRF({
    ...blank,
    patientName: 'Blank Audit Case',
  });
  assert.equal(partial.gender, '');
  assert.equal(partial.visitNo, '');
  assert.equal(partial.dateOfRecruitment, '');
  assert.equal(partial.participantId, '');
  assert.equal(partial.clusterType, '');
  assert.equal(partial.suggestedCluster, '');
  assert.equal(partial.microalbuminStatus, '');
  assert.equal(partial.egfr, null);
});

