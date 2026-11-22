import type {
  ClusterType,
  DHSDomains,
  Gender,
  MissingFieldItem,
  PatientCRF,
  StatusColor,
} from '../types/clinical.ts';

/** Returns today's date in Asia/Kolkata (IST) formatted as YYYY-MM-DD */
export function getTodayIST(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Generates Participant ID: [GenderInitial][RecruitmentMonthMM][3-digit Sequence]
 * Example: Male in January (01), 1st patient => M01001
 */
export function generateParticipantId(
  gender: Gender,
  recruitmentDate: string,
  sequenceNumber: number
): string {
  if (!gender) return '';
  const prefix = gender === 'Female' ? 'F' : gender === 'Other' ? 'O' : 'M';
  let month = '01';
  if (/^\d{4}-\d{2}-\d{2}$/.test(recruitmentDate)) {
    month = recruitmentDate.slice(5, 7);
  } else {
    const todayIst = getTodayIST();
    month = todayIst.slice(5, 7);
  }
  const seq = String(Math.max(1, Math.floor(sequenceNumber))).padStart(3, '0');
  return `${prefix}${month}${seq}`;
}

/** Computes next sequence number from existing patients in the same gender/month or overall */
export function getNextSequenceForCohort(
  existingIds: string[],
  gender: Gender,
  recruitmentDate: string
): number {
  if (!gender) return 1;
  const prefix = gender === 'Female' ? 'F' : gender === 'Other' ? 'O' : 'M';
  const month = /^\d{4}-\d{2}-\d{2}$/.test(recruitmentDate)
    ? recruitmentDate.slice(5, 7)
    : getTodayIST().slice(5, 7);
  const pattern = new RegExp(`^${prefix}${month}(\\d{3,})$`);
  let maxSeq = 0;
  for (const id of existingIds) {
    const match = pattern.exec(id.trim().toUpperCase());
    if (match) {
      const val = parseInt(match[1], 10);
      if (val > maxSeq) maxSeq = val;
    }
  }
  return maxSeq + 1;
}

/** Normalizes YYYY-MM-DD, DD/MM/YYYY, or DD-MM-YYYY DOB strings into YYYY-MM-DD */
export function normalizeIsoDate(value: string): string {
  const trimmed = (value || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

/** Calculates exact age in completed years from DOB against a reference date */
export function calculateAgeFromDOB(
  dob: string,
  referenceDate: string = getTodayIST()
): number | null {
  const normalizedDob = normalizeIsoDate(dob);
  const normalizedRef = normalizeIsoDate(referenceDate) || getTodayIST();
  if (!normalizedDob) return null;
  const birth = new Date(`${normalizedDob}T00:00:00Z`);
  const ref = new Date(`${normalizedRef}T00:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(ref.getTime())) return null;
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const mDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (mDiff < 0 || (mDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/** Parses YYYY-MM, YYYY-MM-DD, MM/YYYY, DD/MM/YYYY, or YYYY into { year, month, day?, hasMonth } */
export function parseDiagnosisMonthYear(
  value: string
): { year: number; month: number; day?: number; hasMonth: boolean } | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  const fullIso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (fullIso) {
    const year = parseInt(fullIso[1], 10);
    const month = parseInt(fullIso[2], 10);
    const day = parseInt(fullIso[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day, hasMonth: true };
    }
  }
  const isoMatch = /^(\d{4})-(\d{1,2})$/.exec(trimmed);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    if (month >= 1 && month <= 12) return { year, month, hasMonth: true };
  }
  const dmySlash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);
  if (dmySlash) {
    const day = parseInt(dmySlash[1], 10);
    const month = parseInt(dmySlash[2], 10);
    const year = parseInt(dmySlash[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { year, month, day, hasMonth: true };
    }
  }
  const slashMatch = /^(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const year = parseInt(slashMatch[2], 10);
    if (month >= 1 && month <= 12) return { year, month, hasMonth: true };
  }
  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) {
    return { year: parseInt(yearOnly[1], 10), month: 1, hasMonth: false };
  }
  return null;
}

/** Calculates Age at Diagnosis and Duration of Diabetes (years & months) using DOB as reference */
export function calculateDiagnosisMetrics(
  dob: string,
  diagnosisMonthYear: string,
  referenceDate: string = getTodayIST()
): {
  ageAtDiagnosis: number | null;
  durationYears: number | null;
  durationMonths: number | null;
} {
  const parsed = parseDiagnosisMonthYear(diagnosisMonthYear);
  if (!parsed) {
    return { ageAtDiagnosis: null, durationYears: null, durationMonths: null };
  }

  const normalizedDob = normalizeIsoDate(dob);
  const normalizedRef = normalizeIsoDate(referenceDate) || getTodayIST();
  const refYear = parseInt(normalizedRef.slice(0, 4), 10);
  const refMonth = parseInt(normalizedRef.slice(5, 7), 10);

  let birthYear: number | null = null;
  let birthMonth: number | null = null;
  let birthDay: number | null = null;
  if (normalizedDob) {
    birthYear = parseInt(normalizedDob.slice(0, 4), 10);
    birthMonth = parseInt(normalizedDob.slice(5, 7), 10);
    birthDay = parseInt(normalizedDob.slice(8, 10), 10);
  }

  const effectiveDiagMonth = parsed.hasMonth ? parsed.month : (birthMonth ?? refMonth);
  const totalMonthsDiff = (refYear - parsed.year) * 12 + (refMonth - effectiveDiagMonth);
  const safeTotalMonths = Math.max(0, totalMonthsDiff);
  const durationYears = Math.floor(safeTotalMonths / 12);
  const durationMonths = safeTotalMonths % 12;

  let ageAtDiagnosis: number | null = null;
  if (birthYear !== null && birthMonth !== null && birthDay !== null) {
    let diagAge = parsed.year - birthYear;
    if (parsed.hasMonth) {
      if (
        parsed.month < birthMonth ||
        (parsed.month === birthMonth && parsed.day !== undefined && parsed.day < birthDay)
      ) {
        diagAge -= 1;
      }
    }
    if (diagAge >= 0 && diagAge <= 120) {
      ageAtDiagnosis = diagAge;
    }
  }

  return { ageAtDiagnosis, durationYears, durationMonths };
}

export interface ResolvedAgeAndDiagnosis {
  age: number | null;
  diagnosisMonthYear: string;
  ageAtDiagnosis: number | null;
  durationYears: number | null;
  durationMonths: number | null;
  durationDecimalYears: number | null;
}

/**
 * Derives Age, Date/Year of DM Diagnosis, Age at DM Diagnosis, and Duration of Diabetes
 * consistently using Date of Birth (dob) as the primary reference whenever available.
 */
export function resolveAgeAndDiagnosisFromDOB(params: {
  dob: string;
  age: number | null;
  diagnosisMonthYear: string;
  ageAtDiagnosis: number | null;
  durationYears: number | null;
  durationMonths: number | null;
  referenceDate?: string;
}): ResolvedAgeAndDiagnosis {
  const normalizedDob = normalizeIsoDate(params.dob);
  const normalizedRef = normalizeIsoDate(params.referenceDate || '') || getTodayIST();
  const refYear = parseInt(normalizedRef.slice(0, 4), 10);
  const refMonth = parseInt(normalizedRef.slice(5, 7), 10);

  const dobAge = normalizedDob ? calculateAgeFromDOB(normalizedDob, normalizedRef) : null;
  const age = dobAge ?? params.age;

  let diagnosisMonthYear = (params.diagnosisMonthYear || '').trim();
  let ageAtDiagnosis = params.ageAtDiagnosis;
  let durationYears = params.durationYears;
  let durationMonths = params.durationMonths;

  const birthYear = normalizedDob ? parseInt(normalizedDob.slice(0, 4), 10) : null;
  const birthMonth = normalizedDob ? parseInt(normalizedDob.slice(5, 7), 10) : null;

  const parsedDiag = parseDiagnosisMonthYear(diagnosisMonthYear);
  if (parsedDiag) {
    const metrics = calculateDiagnosisMetrics(normalizedDob, diagnosisMonthYear, normalizedRef);
    durationYears = metrics.durationYears;
    durationMonths = metrics.durationMonths;
    if (metrics.ageAtDiagnosis !== null) {
      ageAtDiagnosis = metrics.ageAtDiagnosis;
    } else if (age !== null && durationYears !== null) {
      ageAtDiagnosis = Math.max(0, age - durationYears);
    }
  } else if (
    birthYear !== null &&
    birthMonth !== null &&
    ageAtDiagnosis !== null &&
    !Number.isNaN(ageAtDiagnosis) &&
    ageAtDiagnosis >= 0 &&
    ageAtDiagnosis <= 120
  ) {
    // Derive Date/Year of DM Diagnosis and Duration directly from Birthdate + Age at DM Diagnosis
    const safeAgeDiag = age !== null ? Math.min(Math.floor(ageAtDiagnosis), age) : Math.floor(ageAtDiagnosis);
    const diagYear = birthYear + safeAgeDiag;
    const diagMonth = birthMonth;
    diagnosisMonthYear = `${diagYear}-${String(diagMonth).padStart(2, '0')}`;
    ageAtDiagnosis = safeAgeDiag;
    const totalMonthsDiff = Math.max(0, (refYear - diagYear) * 12 + (refMonth - diagMonth));
    durationYears = Math.floor(totalMonthsDiff / 12);
    durationMonths = totalMonthsDiff % 12;
  } else if (
    (durationYears !== null && !Number.isNaN(durationYears)) ||
    (durationMonths !== null && !Number.isNaN(durationMonths))
  ) {
    // Derive Date/Year of DM Diagnosis and Age at Diagnosis from reference date & Duration, anchored to Birthdate
    const totalDurMonths = Math.max(
      0,
      Math.round((durationYears ?? 0) * 12 + (durationMonths ?? 0))
    );
    const refTotalMonths = refYear * 12 + (refMonth - 1);
    const diagTotalMonths = Math.max(0, refTotalMonths - totalDurMonths);
    const diagYear = Math.floor(diagTotalMonths / 12);
    const diagMonth = (diagTotalMonths % 12) + 1;
    diagnosisMonthYear = `${diagYear}-${String(diagMonth).padStart(2, '0')}`;
    durationYears = Math.floor(totalDurMonths / 12);
    durationMonths = totalDurMonths % 12;

    if (normalizedDob) {
      const metrics = calculateDiagnosisMetrics(normalizedDob, diagnosisMonthYear, normalizedRef);
      if (metrics.ageAtDiagnosis !== null) {
        ageAtDiagnosis = metrics.ageAtDiagnosis;
      }
    } else if (age !== null) {
      ageAtDiagnosis = Math.max(0, age - durationYears);
    }
  } else if (
    age !== null &&
    ageAtDiagnosis !== null &&
    !Number.isNaN(ageAtDiagnosis) &&
    ageAtDiagnosis >= 0 &&
    ageAtDiagnosis <= age
  ) {
    // No DOB or diagnosis date, but Age + Age at Diagnosis exist
    const diffYears = Math.max(0, age - Math.floor(ageAtDiagnosis));
    durationYears = diffYears;
    durationMonths = 0;
    const diagYear = refYear - diffYears;
    diagnosisMonthYear = `${diagYear}-${String(refMonth).padStart(2, '0')}`;
  }

  const durationDecimalYears =
    durationYears !== null || durationMonths !== null
      ? Number(((durationYears ?? 0) + (durationMonths ?? 0) / 12).toFixed(1))
      : null;

  return {
    age,
    diagnosisMonthYear,
    ageAtDiagnosis,
    durationYears,
    durationMonths,
    durationDecimalYears,
  };
}

/** Converts height to cm */
export function convertHeightToCm(
  value: number | null,
  unit: 'cm' | 'inch' | 'feet'
): number | null {
  if (value === null || Number.isNaN(value) || value <= 0) return null;
  if (unit === 'cm') return Number(value.toFixed(1));
  if (unit === 'inch') return Number((value * 2.54).toFixed(1));
  // feet (e.g., 5.5 ft -> 167.6 cm)
  return Number((value * 30.48).toFixed(1));
}

/** Converts weight to kg */
export function convertWeightToKg(
  value: number | null,
  unit: 'kg' | 'lbs'
): number | null {
  if (value === null || Number.isNaN(value) || value <= 0) return null;
  if (unit === 'kg') return Number(value.toFixed(1));
  return Number((value * 0.45359237).toFixed(1));
}

/** Converts circumference to cm */
export function convertCircumferenceToCm(
  value: number | null,
  unit: 'cm' | 'inch'
): number | null {
  if (value === null || Number.isNaN(value) || value <= 0) return null;
  if (unit === 'cm') return Number(value.toFixed(1));
  return Number((value * 2.54).toFixed(1));
}

/** Calculates BMI in kg/m² */
export function calculateBMI(
  weightKg: number | null,
  heightCm: number | null
): number | null {
  if (!weightKg || !heightCm || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Number((weightKg / (meters * meters)).toFixed(1));
}

/** Calculates Waist-Hip Ratio */
export function calculateWHR(
  waistCm: number | null,
  hipCm: number | null
): number | null {
  if (!waistCm || !hipCm || hipCm <= 0) return null;
  return Number((waistCm / hipCm).toFixed(2));
}

/** Converts glucose value to mg/dL */
export function toGlucoseMgDl(value: number | null, unit: string): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (unit === 'mmol/L') return Number((value * 18.0182).toFixed(1));
  return value;
}

/** Converts lipid value to mg/dL (cholesterol vs triglycerides) */
export function toLipidMgDl(
  value: number | null,
  unit: string,
  kind: 'chol' | 'tg'
): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (unit === 'mmol/L') {
    return Number((value * (kind === 'tg' ? 88.57 : 38.67)).toFixed(1));
  }
  return value;
}

/** Converts Creatinine to mg/dL */
export function toCreatinineMgDl(value: number | null, unit: string): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (unit === 'µmol/L' || unit === 'umol/L') {
    return Number((value / 88.4).toFixed(2));
  }
  return value;
}

/** Converts HbA1c from IFCC mmol/mol to NGSP % if needed */
export function toHba1cPercent(value: number | null, unit: string = '%'): number | null {
  if (value === null || Number.isNaN(value)) return null;
  if (unit === 'mmol/mol') {
    return Number((value / 10.929 + 2.15).toFixed(2));
  }
  return value;
}

/**
 * CKD-EPI 2021 Race-Free eGFR (mL/min/1.73m²)
 * Reference: Inker et al., NEJM 2021
 */
export function calculateCkDEpi2021(
  creatinineMgDl: number | null,
  age: number | null,
  gender: Gender
): number | null {
  if (!creatinineMgDl || creatinineMgDl <= 0 || !age || age <= 0 || !gender) return null;
  const isFemale = gender === 'Female';
  const kappa = isFemale ? 0.7 : 0.9;
  const alpha = isFemale ? -0.241 : -0.302;
  const sexFactor = isFemale ? 1.012 : 1.0;

  const ratio = creatinineMgDl / kappa;
  const minTerm = Math.pow(Math.min(ratio, 1), alpha);
  const maxTerm = Math.pow(Math.max(ratio, 1), -1.2);
  const ageTerm = Math.pow(0.9938, age);

  return Math.round(142 * minTerm * maxTerm * ageTerm * sexFactor);
}

/**
 * Calculates HOMA-B (%) and HOMA-IR
 * - C-Peptide method (User-specified clinical formulas):
 *     HOMA-B (Matthews Linear Approximation) = (360 * C-pep [ng/mL]) / (FPG [mg/dL] - 63)
 *     HOMA-IR (CP) (Calibrated Oxford / Asian Cohort Formula) = (FPG [mg/dL] * C-peptide [ng/mL]) / 115
 * - Fasting Insulin method (Matthews et al., 1985):
 *     HOMA-IR = (FPG_mgdl * Insulin_uIU_mL) / 405
 *     HOMA-B  = (360 * Insulin_uIU_mL) / (FPG_mgdl - 63)
 */
export function calculateHOMA(params: {
  fbgMgDl: number | null;
  insulinValue: number | null;
  insulinUnit: string;
  cPeptideValue: number | null;
  cPeptideUnit: string;
  method: 'c-peptide' | 'insulin';
}): { homaB: number | null; homaIR: number | null } {
  const { fbgMgDl, insulinValue, insulinUnit, cPeptideValue, cPeptideUnit, method } = params;
  if (!fbgMgDl || fbgMgDl <= 0) return { homaB: null, homaIR: null };

  const hasInsulin = insulinValue !== null && insulinValue > 0;
  const hasCPeptide = cPeptideValue !== null && cPeptideValue > 0;

  if (method === 'insulin' ? hasInsulin : !hasCPeptide && hasInsulin) {
    const insUIU = insulinUnit === 'pmol/L' ? (insulinValue as number) / 6.945 : (insulinValue as number);
    const homaIR = Number(((fbgMgDl * insUIU) / 405).toFixed(2));
    const homaB =
      fbgMgDl > 63 ? Number(((360 * insUIU) / (fbgMgDl - 63)).toFixed(1)) : null;
    return { homaB, homaIR };
  }

  if (hasCPeptide) {
    // Normalize C-peptide to ng/mL (1 ng/mL = 0.331 nmol/L = 331 pmol/L)
    let cPepNgMl = cPeptideValue as number;
    if (cPeptideUnit === 'nmol/L') cPepNgMl = cPepNgMl / 0.331;
    else if (cPeptideUnit === 'pmol/L') cPepNgMl = cPepNgMl / 331;

    const homaIR = Number(((fbgMgDl * cPepNgMl) / 115).toFixed(2));
    const homaB =
      fbgMgDl > 63 ? Number(((360 * cPepNgMl) / (fbgMgDl - 63)).toFixed(1)) : null;
    return { homaB, homaIR };
  }

  return { homaB: null, homaIR: null };
}

/** Auto-suggests FibroScan Fibrosis (F0-F4) from LSM kPa */
export function interpretFibrosisFromKpa(kpa: number | null): 'F0-F1' | 'F2' | 'F3' | 'F4' | '' {
  if (kpa === null || Number.isNaN(kpa)) return '';
  if (kpa < 7.0) return 'F0-F1';
  if (kpa < 9.5) return 'F2';
  if (kpa < 12.5) return 'F3';
  return 'F4';
}

/** Auto-suggests FibroScan Steatosis (S0-S3) from CAP dB/m */
export function interpretSteatosisFromCap(cap: number | null): 'S0' | 'S1' | 'S2' | 'S3' | '' {
  if (cap === null || Number.isNaN(cap)) return '';
  if (cap < 238) return 'S0';
  if (cap < 260) return 'S1';
  if (cap < 290) return 'S2';
  return 'S3';
}

/** Blue Index Domain A: HbA1c score (0-5) */
export function scoreDomainA_HbA1c(hba1c: number | null, target = 7.0): number | null {
  if (hba1c === null || Number.isNaN(hba1c)) return null;
  const diff = hba1c - target;
  if (diff <= 0) return 5;
  if (diff <= 0.5) return 4;
  if (diff <= 1.0) return 3;
  if (diff <= 2.0) return 2;
  if (diff <= 4.0) return 1;
  return 0;
}

/** Blue Index Domain B: BP score (0-5), target 130/80 mmHg */
export function scoreDomainB_BP(
  sbp: number | null,
  dbp: number | null,
  onAntiHtnMeds: boolean
): number | null {
  if (sbp === null || dbp === null) return null;
  const sDiff = sbp - 130;
  const dDiff = dbp - 80;
  if (sDiff <= 0 && dDiff <= 0) return onAntiHtnMeds ? 4 : 5;
  if (sDiff > 40 || dDiff > 20) return 0;
  if (sDiff > 20 || dDiff > 10) return 1;
  if (sDiff > 10 || dDiff > 5) return 2;
  return 3;
}

/** Blue Index Domain C: Lipids score (0-5) */
export function scoreDomainC_Lipids(params: {
  tc: number | null;
  tg: number | null;
  ldl: number | null;
  nonHdl: number | null;
  onStatin: boolean;
}): number | null {
  const { tc, tg, ldl, nonHdl, onStatin } = params;
  if (tc === null && tg === null && ldl === null && nonHdl === null) return null;

  if ((tg !== null && tg > 500) || (ldl !== null && ldl > 190) || (nonHdl !== null && nonHdl > 220)) {
    return 0;
  }
  if (tc === null && ldl === null && nonHdl === null && tg !== null) {
    if (tg >= 150) return 3;
    return onStatin ? 4 : 5;
  }

  let aboveCount = 0;
  if (tc !== null && tc >= 200) aboveCount += 1;
  if (ldl !== null && ldl >= 100) aboveCount += 1;
  if (nonHdl !== null && nonHdl >= 130) aboveCount += 1;

  if (aboveCount === 0) return onStatin ? 4 : 5;
  if (aboveCount === 1) return 3;
  if (aboveCount === 2) return 2;
  return 1;
}

/** Blue Index Domain E: Physical Activity (0-5) */
export function scoreDomainE_Activity(activity: PatientCRF['physicalActivity']): number | null {
  switch (activity) {
    case '>=150 min/week':
      return 5;
    case '90-149 min/week':
      return 4;
    case '30-89 min/week':
      return 3;
    case 'Minimal':
      return 2;
    case 'Sedentary':
      return 1;
    case 'Unwilling/Bedridden':
      return 0;
    default:
      return null;
  }
}

/** Blue Index Domain H: Habits (0-5) */
export function scoreDomainH_Habits(params: {
  smokingStatus: PatientCRF['smokingStatus'];
  smokingQuantity: PatientCRF['smokingQuantity'];
  tobaccoStatus: PatientCRF['tobaccoStatus'];
  tobaccoQuantity: PatientCRF['tobaccoQuantity'];
  alcoholIntake: PatientCRF['alcoholIntake'];
}): number | null {
  const { smokingStatus, smokingQuantity, tobaccoStatus, tobaccoQuantity, alcoholIntake } = params;
  if (!smokingStatus && !tobaccoStatus && !alcoholIntake) return null;

  const scores: number[] = [];
  if (smokingStatus === 'Never') scores.push(5);
  else if (smokingStatus === 'Ex-smoker >1yr') scores.push(4);
  else if (smokingStatus === 'Current') {
    if (smokingQuantity === '<10/day') scores.push(3);
    else if (smokingQuantity === '10-20/day') scores.push(2);
    else if (smokingQuantity === '>20/day') scores.push(1);
    else if (smokingQuantity === 'Substance abuse') scores.push(0);
    else scores.push(2);
  }

  if (tobaccoStatus === 'Never') scores.push(5);
  else if (tobaccoStatus === 'Tobacco-free >1yr') scores.push(4);
  else if (tobaccoStatus === 'Current') {
    if (tobaccoQuantity === '<=5 sachet/day') scores.push(3);
    else if (tobaccoQuantity === '5-10 sachet/day') scores.push(2);
    else if (tobaccoQuantity === '>10 sachet/day') scores.push(1);
    else if (tobaccoQuantity === 'Unwilling') scores.push(0);
    else scores.push(2);
  }

  if (alcoholIntake === 'No') scores.push(5);
  else if (alcoholIntake === 'Occasionally') scores.push(3);
  else if (alcoholIntake === 'Yes') scores.push(1);

  if (scores.length === 0) return null;
  return Math.min(...scores);
}

/** Blue Index Domain J: Jeopardy / Hypoglycemia (0-5) */
export function scoreDomainJ_Hypoglycemia(
  severity: PatientCRF['hypoglycemiaSeverity']
): number | null {
  switch (severity) {
    case 'No':
      return 5;
    case 'Level 1 Asymptomatic':
      return 4;
    case 'Level 1 Symptomatic':
      return 3;
    case 'Level 2':
      return 2;
    case 'Level 3':
      return 1;
    case 'Recurrent Level 3 or LOC':
      return 0;
    default:
      return null;
  }
}

/** Derive eGFR Microvascular Tier (0-5) from eGFR value */
export function deriveEgfrTier(egfr: number | null): number | null {
  if (egfr === null || Number.isNaN(egfr)) return null;
  if (egfr >= 90) return 0;
  if (egfr >= 60) return 2;
  if (egfr >= 30) return 3;
  if (egfr >= 15) return 4;
  return 5;
}

/**
 * Derive UACR Microvascular Tier (0-5) from UACR mg/g and eGFR decline:
 * - Tier 0: < 30 mg/g (Normoalbuminuria)
 * - Tier 2: 30 – 299 mg/g (Microalbuminuria)
 * - Tier 3: >= 300 mg/g (Macroalbuminuria)
 * - Tier 4: > 300 mg/g with declining GFR (eGFR < 60 mL/min/1.73m²)
 * - Tier 5: Nephrotic range proteinuria (UACR >= 2200 mg/g)
 */
export function deriveUacrTier(uacr: number | null, egfr: number | null = null): number | null {
  if (uacr === null || Number.isNaN(uacr)) return null;
  if (uacr >= 2200) return 5;
  if (uacr > 300 && egfr !== null && !Number.isNaN(egfr) && egfr < 60) return 4;
  if (uacr >= 300) return 3;
  if (uacr >= 30) return 2;
  return 0;
}

/**
 * Official Maximal Severity Principle for Microvascular Score (M)
 * Score M = max(Score_eGFR, Score_UACR, Score_Eye)
 */
export function calculateMicrovascularScore(
  egfrTier: number | null,
  uacrTier: number | null,
  eyeTier: number | null
): number | null {
  const vals = [egfrTier, uacrTier, eyeTier].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.max(...vals);
}

/** Computes DHS Total (0-50), DHS Category, KS Total (0-15), and BI Ratio */
export function computeBlueIndex(
  domains: DHSDomains,
  ksMacro: number | null,
  ksMicro: number | null,
  ksFoot: number | null
): {
  dhsTotal: number | null;
  dhsCategory: PatientCRF['dhsCategory'];
  ksTotal: number | null;
  blueIndexRatio: string;
} {
  const vals = Object.values(domains).filter((v): v is number => v !== null);
  const dhsTotal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;

  let dhsCategory: PatientCRF['dhsCategory'] = '';
  if (dhsTotal !== null) {
    if (dhsTotal > 45) dhsCategory = 'Excellent Status';
    else if (dhsTotal >= 35) dhsCategory = 'Moderate Status';
    else dhsCategory = 'Undesirable Status';
  }

  const ksParts = [ksMacro, ksMicro, ksFoot].filter((v): v is number => v !== null);
  const ksTotal = ksParts.length > 0 ? ksParts.reduce((a, b) => a + b, 0) : null;

  let blueIndexRatio = '—';
  if (dhsTotal !== null && ksTotal !== null) {
    blueIndexRatio = ksTotal === 0 ? `${dhsTotal} : 0` : `${(dhsTotal / ksTotal).toFixed(2)} (${dhsTotal}:${ksTotal})`;
  } else if (dhsTotal !== null) {
    blueIndexRatio = `${dhsTotal} / —`;
  }

  return { dhsTotal, dhsCategory, ksTotal, blueIndexRatio };
}

/**
 * DDS-17 Standardized Scoring (Polonsky et al., Diabetes Care 2005)
 * Emotional Burden: items 1, 3, 8, 11, 14 (indices 0, 2, 7, 10, 13)
 * Physician-Related Distress: items 2, 4, 9, 15 (indices 1, 3, 8, 14)
 * Regimen-Related Distress: items 5, 6, 10, 12, 16 (indices 4, 5, 9, 11, 15)
 * Interpersonal Distress: items 7, 13, 17 (indices 6, 12, 16)
 */
export function calculateDDS17(items: (number | null)[]): {
  ddsTotal: number | null;
  ddsMean: number | null;
  ddsEmotionalBurden: number | null;
  ddsPhysicianDistress: number | null;
  ddsRegimenDistress: number | null;
  ddsInterpersonalDistress: number | null;
  ddsCategory: PatientCRF['ddsCategory'];
} {
  const meanOf = (indices: number[]): number | null => {
    const vals = indices.map((i) => items[i]).filter((v): v is number => v !== null && v >= 1 && v <= 6);
    if (vals.length === 0) return null;
    return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
  };

  const validAll = items.filter((v): v is number => v !== null && v >= 1 && v <= 6);
  const ddsTotal = validAll.length > 0 ? validAll.reduce((a, b) => a + b, 0) : null;
  const ddsMean = validAll.length > 0 ? Number((ddsTotal! / validAll.length).toFixed(2)) : null;

  let ddsCategory: PatientCRF['ddsCategory'] = '';
  if (ddsMean !== null) {
    if (ddsMean < 2.0) ddsCategory = 'Little or No Distress';
    else if (ddsMean < 3.0) ddsCategory = 'Moderate Distress';
    else ddsCategory = 'High Distress';
  }

  return {
    ddsTotal,
    ddsMean,
    ddsEmotionalBurden: meanOf([0, 2, 7, 10, 13]),
    ddsPhysicianDistress: meanOf([1, 3, 8, 14]),
    ddsRegimenDistress: meanOf([4, 5, 9, 11, 15]),
    ddsInterpersonalDistress: meanOf([6, 12, 16]),
    ddsCategory,
  };
}

/**
 * Rule-based Indian T2DM Phenotypic Cluster Suggestion (4 clusters: SIDD, SIRD, CIRDD, MARD)
 * - CIRDD: Combined Insulin-Resistant & Deficient Diabetes (elevated HOMA-IR / adiposity AND low HOMA-B / C-peptide / severe hyperglycemia)
 * - SIDD:  Severe Insulin-Deficient Diabetes (high HbA1c >= 8.5% or low beta-cell function HOMA-B < 55 / low C-peptide)
 * - SIRD:  Severe Insulin-Resistant Diabetes (high HOMA-IR >= 3.0 or elevated BMI >= 27.5 with preserved beta-cell function)
 * - MARD:  Mild Age-Related Diabetes (older age at diagnosis >= 55 or modest metabolic derangement)
 */
export function normalizeClusterType(
  raw: string | null | undefined,
  fallback: ClusterType | '' = ''
): ClusterType | '' {
  if (raw === 'SIDD' || raw === 'SIRD' || raw === 'CIRDD' || raw === 'MARD') {
    return raw;
  }
  if (raw === 'MOD' || raw === 'IROD') {
    return fallback;
  }
  return '';
}

export function suggestPhenotypeCluster(crf: PatientCRF): ClusterType | '' {
  const hba1c =
    toHba1cPercent(crf.hba1c1.value, crf.hba1c1.unit) ??
    toHba1cPercent(crf.hba1c2.value, crf.hba1c2.unit);
  const bmi = crf.bmi;
  const homaIR = crf.homaIR;
  const homaB = crf.homaB;
  const cPep = crf.cPeptide.value;
  const ageDiag = crf.ageAtDiagnosis ?? crf.age;

  const hasMetabolicEvidence =
    hba1c !== null ||
    homaIR !== null ||
    homaB !== null ||
    cPep !== null ||
    bmi !== null;

  if (!hasMetabolicEvidence && (ageDiag === null || ageDiag < 55)) {
    return '';
  }

  const isInsulinResistant =
    (homaIR !== null && homaIR >= 3.0) || (bmi !== null && bmi >= 27.5 && (ageDiag === null || ageDiag < 60));
  const homaBLowThreshold = crf.homaMethod === 'c-peptide' ? 8 : 55;
  const isInsulinDeficient =
    (hba1c !== null && hba1c >= 8.5) ||
    (homaB !== null && homaB < homaBLowThreshold) ||
    (cPep !== null && cPep < 1.1);

  if (isInsulinResistant && isInsulinDeficient) {
    return 'CIRDD';
  }
  if (homaIR !== null && homaIR >= 3.2 && (bmi === null || bmi >= 25)) {
    return 'SIRD';
  }
  if (isInsulinDeficient) {
    return 'SIDD';
  }
  if (isInsulinResistant) {
    return 'SIRD';
  }
  if (ageDiag !== null && ageDiag >= 55) {
    return 'MARD';
  }
  return hasMetabolicEvidence ? 'MARD' : '';
}

/**
 * Evaluates missing fields across Tabs 1-4 and computes Green/Yellow/Orange/Red status:
 * - Green: All core + follow-up data entered
 * - Yellow: Only 2nd HbA1c pending
 * - Orange: Only 2nd HbA1c, FibroScan, or Beta-cell report pending
 * - Red: Multiple data pending apart from 2nd HbA1c, FibroScan, Beta-cell report
 */
export function evaluateMissingDataAndStatus(crf: PatientCRF): {
  missingFields: MissingFieldItem[];
  statusColor: StatusColor;
  statusLabel: string;
} {
  const missing: MissingFieldItem[] = [];

  const check = (
    condition: boolean,
    key: string,
    label: string,
    tab: MissingFieldItem['tab'],
    section: string,
    priority: MissingFieldItem['priority']
  ) => {
    if (condition) missing.push({ key, label, tab, section, priority });
  };

  // Core Info
  check(!crf.patientName.trim(), 'patientName', 'Patient Name', 'info', 'Demographics', 'critical');
  check(!crf.uhid.trim(), 'uhid', 'UHID / IP No.', 'info', 'Demographics', 'critical');
  check(!crf.dob.trim() && crf.age === null, 'dob', 'Date of Birth / Age', 'info', 'Demographics', 'critical');
  check(!crf.contactNumber.trim(), 'contactNumber', 'Contact Number (10-digit)', 'info', 'Demographics', 'critical');
  check(!crf.bloodGroup, 'bloodGroup', 'Blood Group', 'info', 'Demographics', 'critical');
  check(!crf.diagnosisMonthYear.trim(), 'diagnosisMonthYear', 'Month/Year of Diagnosis', 'info', 'Diabetes History', 'critical');
  check(!crf.familyHistoryDM, 'familyHistoryDM', 'Family History of DM', 'info', 'Diabetes History', 'critical');
  check(!crf.smokingStatus, 'smokingStatus', 'Smoking Status', 'info', 'Social & Lifestyle', 'critical');
  check(!crf.physicalActivity, 'physicalActivity', 'Physical Activity Level', 'info', 'Social & Lifestyle', 'critical');
  check(crf.dietAdherenceScore === null, 'dietAdherenceScore', 'Diet Adherence Score', 'info', 'Social & Lifestyle', 'critical');
  check(crf.ksMacrovascular === null, 'ksMacrovascular', 'Macrovascular KS Score', 'komplications', 'Known Severity (KS)', 'critical');
  check(crf.ksMicroRetinopathyTier === null, 'ksMicroRetinopathyTier', 'Fundoscopy / Retinopathy Tier', 'komplications', 'Known Severity (KS)', 'critical');
  check(crf.ksFootNeuropathy === null, 'ksFootNeuropathy', 'Diabetic Foot & Neuropathy KS Score', 'komplications', 'Known Severity (KS)', 'critical');
  check(crf.ddsItems.some((v) => v === null), 'ddsItems', 'DDS-17 Questionnaire (17 items)', 'dds17', 'DDS-17 Scale', 'critical');

  // Vitals
  check(crf.heightValue === null, 'heightValue', 'Height', 'vitals', 'Anthropometry', 'critical');
  check(crf.weightValue === null, 'weightValue', 'Weight', 'vitals', 'Anthropometry', 'critical');
  check(crf.waistValue === null, 'waistValue', 'Waist Circumference', 'vitals', 'Anthropometry', 'critical');
  check(crf.hipValue === null, 'hipValue', 'Hip Circumference', 'vitals', 'Anthropometry', 'critical');
  check(crf.sbp === null || crf.dbp === null, 'bp', 'Blood Pressure (SBP/DBP)', 'vitals', 'Vitals', 'critical');

  // Labs
  check(crf.fbg.value === null, 'fbg', 'Fasting Blood Glucose (FBG)', 'labs', 'Glycemic Profile', 'critical');
  check(crf.ppbg.value === null, 'ppbg', 'Postprandial Blood Glucose (PPBG)', 'labs', 'Glycemic Profile', 'critical');
  check(crf.hba1c1.value === null, 'hba1c1', '1st HbA1c (%)', 'labs', 'Glycemic Profile', 'critical');
  check(crf.totalCholesterol.value === null, 'totalCholesterol', 'Total Cholesterol', 'labs', 'Lipid Profile', 'critical');
  check(crf.triglycerides.value === null, 'triglycerides', 'Triglycerides', 'labs', 'Lipid Profile', 'critical');
  check(crf.hdl.value === null, 'hdl', 'HDL Cholesterol', 'labs', 'Lipid Profile', 'critical');
  check(crf.ldl.value === null, 'ldl', 'LDL Cholesterol', 'labs', 'Lipid Profile', 'critical');
  check(crf.hemoglobin.value === null, 'hemoglobin', 'Hemoglobin (g/dL)', 'labs', 'Haematology', 'critical');
  check(crf.serumCreatinine.value === null, 'serumCreatinine', 'Serum Creatinine', 'labs', 'Hepatic & Renal', 'critical');
  check(crf.uacr.value === null, 'uacr', 'Urinary Albumin / UACR', 'labs', 'Hepatic & Renal', 'critical');
  check(crf.ast.value === null || crf.alt.value === null, 'lft', 'AST / ALT Liver Function', 'labs', 'Hepatic & Renal', 'critical');

  // Special deferred / follow-up reports (Yellow / Orange rules)
  check(crf.hba1c2.value === null, 'hba1c2', '2nd HbA1c (%) Follow-up', 'labs', 'Glycemic Profile', 'followup');
  check(crf.cPeptide.value === null && crf.fastingInsulin.value === null, 'betaCell', 'Beta-Cell Report (C-Peptide / Fasting Insulin)', 'labs', 'Beta-Cell Function', 'report');
  check(crf.lsmKpa === null || crf.capDbm === null, 'fibroScan', 'FibroScan Report (LSM kPa / CAP)', 'labs', 'FibroScan', 'report');

  // Medications
  const hasAnyMed = crf.medicationVisits.some((v) => v.drugs.some((d) => d.drugName.trim() !== ''));
  check(!hasAnyMed, 'medications', 'Antidiabetic Medication History', 'medications', 'Medications', 'critical');

  const hasCriticalMissing = missing.some((m) => m.priority === 'critical');
  const hasReportMissing = missing.some((m) => m.priority === 'report');
  const hasHba1c2Missing = missing.some((m) => m.key === 'hba1c2');

  let statusColor: StatusColor = 'green';
  let statusLabel = 'Complete';

  if (hasCriticalMissing) {
    statusColor = 'red';
    statusLabel = `${missing.length} Pending`;
  } else if (hasReportMissing) {
    statusColor = 'orange';
    statusLabel = hasHba1c2Missing ? '2nd HbA1c & Reports Pending' : 'Reports Pending';
  } else if (hasHba1c2Missing) {
    statusColor = 'yellow';
    statusLabel = '2nd HbA1c Pending';
  }

  return { missingFields: missing, statusColor, statusLabel };
}

/** Recalculates all derived metrics on a PatientCRF cleanly */
export function recalculatePatientCRF(input: PatientCRF): PatientCRF {
  const crf: PatientCRF = {
    ...input,
    dhsDomains: { ...input.dhsDomains },
    dhsDomainOverrides: { ...(input.dhsDomainOverrides ?? {}) },
    ddsItems: [...input.ddsItems],
  };

  // Age, Diagnosis Date/Year, Age at Diagnosis & Duration — all referenced to Date of Birth
  const resolvedAgeDiag = resolveAgeAndDiagnosisFromDOB({
    dob: crf.dob,
    age: crf.age,
    diagnosisMonthYear: crf.diagnosisMonthYear,
    ageAtDiagnosis: crf.ageAtDiagnosis,
    durationYears: crf.durationYears,
    durationMonths: crf.durationMonths,
    referenceDate: crf.dateOfRecruitment || undefined,
  });
  if (resolvedAgeDiag.age !== null) crf.age = resolvedAgeDiag.age;
  if (resolvedAgeDiag.diagnosisMonthYear) {
    crf.diagnosisMonthYear = resolvedAgeDiag.diagnosisMonthYear;
  }
  if (resolvedAgeDiag.ageAtDiagnosis !== null) {
    crf.ageAtDiagnosis = resolvedAgeDiag.ageAtDiagnosis;
  }
  if (resolvedAgeDiag.durationYears !== null) {
    crf.durationYears = resolvedAgeDiag.durationYears;
  }
  if (resolvedAgeDiag.durationMonths !== null) {
    crf.durationMonths = resolvedAgeDiag.durationMonths;
  }

  // Anthropometry conversions & BMI/WHR
  crf.heightCm = convertHeightToCm(crf.heightValue, crf.heightUnit);
  crf.weightKg = convertWeightToKg(crf.weightValue, crf.weightUnit);
  if (!crf.bmiManualOverride) {
    crf.bmi = calculateBMI(crf.weightKg, crf.heightCm);
  }
  crf.waistCm = convertCircumferenceToCm(crf.waistValue, crf.waistUnit);
  crf.hipCm = convertCircumferenceToCm(crf.hipValue, crf.hipUnit);
  if (!crf.whrManualOverride) {
    crf.waistHipRatio = calculateWHR(crf.waistCm, crf.hipCm);
  }

  // Lipids derived
  const tcMg = toLipidMgDl(crf.totalCholesterol.value, crf.totalCholesterol.unit, 'chol');
  const tgMg = toLipidMgDl(crf.triglycerides.value, crf.triglycerides.unit, 'tg');
  const hdlMg = toLipidMgDl(crf.hdl.value, crf.hdl.unit, 'chol');
  const ldlMg = toLipidMgDl(crf.ldl.value, crf.ldl.unit, 'chol');
  crf.nonHdl = tcMg !== null && hdlMg !== null ? Number((tcMg - hdlMg).toFixed(1)) : null;
  crf.ldlHdlRatio = ldlMg !== null && hdlMg !== null && hdlMg > 0 ? Number((ldlMg / hdlMg).toFixed(2)) : null;

  // eGFR (CKD-EPI 2021)
  const creatMg = toCreatinineMgDl(crf.serumCreatinine.value, crf.serumCreatinine.unit);
  if (!crf.egfrManualOverride) {
    crf.egfr = calculateCkDEpi2021(creatMg, crf.age, crf.gender);
  }

  // HOMA-B & HOMA-IR
  const fbgMg = toGlucoseMgDl(crf.fbg.value, crf.fbg.unit);
  if (!crf.homaManualOverride) {
    const homa = calculateHOMA({
      fbgMgDl: fbgMg,
      insulinValue: crf.fastingInsulin.value,
      insulinUnit: crf.fastingInsulin.unit,
      cPeptideValue: crf.cPeptide.value,
      cPeptideUnit: crf.cPeptide.unit,
      method: crf.homaMethod,
    });
    crf.homaB = homa.homaB;
    crf.homaIR = homa.homaIR;
  }

  // FibroScan interpretation auto-fill if blank
  if (!crf.fibrosisInterpretation && crf.lsmKpa !== null) {
    crf.fibrosisInterpretation = interpretFibrosisFromKpa(crf.lsmKpa);
  }
  if (!crf.steatosisInterpretation && crf.capDbm !== null) {
    crf.steatosisInterpretation = interpretSteatosisFromCap(crf.capDbm);
  }

  // UACR microalbumin status (auto-updates live from lab UACR unless manually overridden)
  if (!crf.microalbuminManualOverride) {
    if (crf.uacr.value !== null) {
      if (crf.uacr.value < 30) crf.microalbuminStatus = 'Normoalbuminuria';
      else if (crf.uacr.value < 300) crf.microalbuminStatus = 'Microalbuminuria';
      else crf.microalbuminStatus = 'Macroalbuminuria';
    } else {
      crf.microalbuminStatus = '';
    }
  }

  // Known Severity (KS) Microvascular Max-Severity Rule (live-syncs from lab eGFR & UACR unless manually overridden)
  const autoEgfrTier = deriveEgfrTier(crf.egfr);
  if (!crf.ksMicroEgfrManualOverride) {
    if (autoEgfrTier !== null) {
      crf.ksMicroEgfrTier = autoEgfrTier;
    } else if (crf.serumCreatinine.value === null && !crf.egfrManualOverride) {
      crf.ksMicroEgfrTier = null;
    }
  }
  const autoUacrTier = deriveUacrTier(crf.uacr.value, crf.egfr);
  if (!crf.ksMicroUacrManualOverride) {
    crf.ksMicroUacrTier = autoUacrTier;
  }
  crf.ksMicrovascular = calculateMicrovascularScore(
    crf.ksMicroEgfrTier,
    crf.ksMicroUacrTier,
    crf.ksMicroRetinopathyTier
  );

  // Blue Index DHS auto-fill from laboratory, vitals & clinical inputs (unless explicitly overridden per domain)
  const overrides = crf.dhsDomainOverrides ?? {};

  const hba1c2Pct = toHba1cPercent(crf.hba1c2.value, crf.hba1c2.unit);
  const hba1c1Pct = toHba1cPercent(crf.hba1c1.value, crf.hba1c1.unit);
  const activeHba1c = hba1c2Pct ?? hba1c1Pct;
  if (!overrides.A) {
    crf.dhsDomains.A = scoreDomainA_HbA1c(activeHba1c, crf.hba1cTarget || 7.0);
  }

  if (!overrides.B) {
    crf.dhsDomains.B = scoreDomainB_BP(crf.sbp, crf.dbp, crf.onAntiHtnMeds);
  }

  if (!overrides.C) {
    crf.dhsDomains.C = scoreDomainC_Lipids({
      tc: tcMg,
      tg: tgMg,
      ldl: ldlMg,
      nonHdl: crf.nonHdl,
      onStatin: crf.onStatin,
    });
  }

  if (!overrides.D) {
    crf.dhsDomains.D = crf.dietAdherenceScore;
  }
  if (!overrides.E) {
    crf.dhsDomains.E = scoreDomainE_Activity(crf.physicalActivity);
  }
  if (!overrides.F) {
    crf.dhsDomains.F = crf.followUpRegularityScore;
  }
  if (!overrides.G) {
    crf.dhsDomains.G = crf.comorbidityScore;
  }

  if (!overrides.H) {
    crf.dhsDomains.H = scoreDomainH_Habits({
      smokingStatus: crf.smokingStatus,
      smokingQuantity: crf.smokingQuantity,
      tobaccoStatus: crf.tobaccoStatus,
      tobaccoQuantity: crf.tobaccoQuantity,
      alcoholIntake: crf.alcoholIntake,
    });
  }
  if (!overrides.I) {
    crf.dhsDomains.I = crf.vaccinationScore;
  }
  if (!overrides.J) {
    crf.dhsDomains.J = scoreDomainJ_Hypoglycemia(crf.hypoglycemiaSeverity);
  }

  const bi = computeBlueIndex(
    crf.dhsDomains,
    crf.ksMacrovascular,
    crf.ksMicrovascular,
    crf.ksFootNeuropathy
  );
  crf.ksTotal = bi.ksTotal;
  crf.dhsTotal = bi.dhsTotal;
  crf.dhsCategory = bi.dhsCategory;
  crf.blueIndexRatio = bi.blueIndexRatio;

  // DDS-17
  const dds = calculateDDS17(crf.ddsItems);
  crf.ddsTotal = dds.ddsTotal;
  crf.ddsMean = dds.ddsMean;
  crf.ddsEmotionalBurden = dds.ddsEmotionalBurden;
  crf.ddsPhysicianDistress = dds.ddsPhysicianDistress;
  crf.ddsRegimenDistress = dds.ddsRegimenDistress;
  crf.ddsInterpersonalDistress = dds.ddsInterpersonalDistress;
  crf.ddsCategory = dds.ddsCategory;

  // Cluster & Missing Data Status
  crf.suggestedCluster = suggestPhenotypeCluster(crf);
  crf.clusterType = normalizeClusterType(crf.clusterType, crf.suggestedCluster);

  const { statusColor } = evaluateMissingDataAndStatus(crf);
  crf.statusColor = statusColor;

  return crf;
}

export function createBlankPatientCRF(_sequenceNumber = 1): PatientCRF {
  const base: PatientCRF = {
    participantId: '',
    uhid: '',
    patientName: '',
    gender: '',
    dob: '',
    age: null,
    contactNumber: '',
    bloodGroup: '',
    dateOfRecruitment: '',
    visitNo: '',
    education: '',
    occupation: '',
    followUpDate: '',

    diagnosisMonthYear: '',
    ageAtDiagnosis: null,
    durationYears: null,
    durationMonths: null,
    familyHistoryDM: '',
    familyHistoryRelations: [],
    otherRelevantHistory: '',
    hypoglycemiaSeverity: '',
    hypoglycemiaAfterMedication: '',
    hypoglycemiaDescription: '',
    complicationsText: '',

    smokingStatus: '',
    smokingQuantity: '',
    tobaccoStatus: '',
    tobaccoQuantity: '',
    alcoholIntake: '',
    alcoholNotes: '',
    physicalActivity: '',
    dietAdherenceScore: null,
    followUpRegularityScore: null,
    vaccinationScore: null,
    comorbidityScore: null,
    infectionPresent: '',
    footUlcer: '',
    footUlcerState: '',
    footAmputation: '',

    heightValue: null,
    heightUnit: 'cm',
    heightCm: null,
    weightValue: null,
    weightUnit: 'kg',
    weightKg: null,
    bmi: null,
    bmiManualOverride: false,
    waistValue: null,
    waistUnit: 'cm',
    waistCm: null,
    hipValue: null,
    hipUnit: 'cm',
    hipCm: null,
    waistHipRatio: null,
    whrManualOverride: false,
    sbp: null,
    dbp: null,
    onAntiHtnMeds: false,
    pulse: null,

    fbg: { date: '', value: null, unit: 'mg/dL' },
    ppbg: { date: '', value: null, unit: 'mg/dL' },
    rbs: { date: '', value: null, unit: 'mg/dL' },
    hba1c1: { date: '', value: null, unit: '%' },
    hba1c2: { date: '', value: null, unit: '%' },
    hba1cTarget: 7.0,
    totalCholesterol: { date: '', value: null, unit: 'mg/dL' },
    triglycerides: { date: '', value: null, unit: 'mg/dL' },
    hdl: { date: '', value: null, unit: 'mg/dL' },
    ldl: { date: '', value: null, unit: 'mg/dL' },
    nonHdl: null,
    ldlHdlRatio: null,
    onStatin: false,

    hemoglobin: { date: '', value: null, unit: 'g/dL' },
    pcv: { date: '', value: null, unit: '%' },
    mcv: { date: '', value: null, unit: 'fL' },
    mch: { date: '', value: null, unit: 'pg' },
    mchc: { date: '', value: null, unit: 'g/dL' },
    platelets: { date: '', value: null, unit: '10^3/µL' },
    totalCount: { date: '', value: null, unit: 'cells/mm³' },

    serumCreatinine: { date: '', value: null, unit: 'mg/dL' },
    egfr: null,
    egfrManualOverride: false,
    urineGlucose: { date: '', value: null, unit: 'mg/dL' },
    epithelialCells: { date: '', value: null, unit: '/HPF' },
    uacr: { date: '', value: null, unit: 'mg/g' },
    microalbuminStatus: '',
    microalbuminManualOverride: false,
    ast: { date: '', value: null, unit: 'U/L' },
    alt: { date: '', value: null, unit: 'U/L' },

    medicationVisits: [
      {
        id: 'visit-1',
        visitDate: '',
        hba1cAtVisit: '',
        drugs: [
          { id: 'drug-1', drugName: '', dose: '', route: '', frequency: '', startDuration: '', status: '' },
        ],
      },
    ],
    otherMedications: [],

    cPeptide: { date: '', value: null, unit: 'ng/mL', method: 'ECLIA' },
    fastingInsulin: { date: '', value: null, unit: 'µIU/mL', method: 'CLIA' },
    homaMethod: 'c-peptide',
    homaB: null,
    homaIR: null,
    homaManualOverride: false,

    fibroScanNotes: '',
    fibroScanDate: '',
    fastingDurationHours: null,
    lsmKpa: null,
    capDbm: null,
    iqr: null,
    iqrMedianPct: null,
    validMeasurements: null,
    successRatePct: null,
    fibrosisInterpretation: '',
    steatosisInterpretation: '',

    ksMacrovascular: null,
    ksMicroEgfrTier: null,
    ksMicroEgfrManualOverride: false,
    ksMicroUacrTier: null,
    ksMicroUacrManualOverride: false,
    ksMicroRetinopathyTier: null,
    ksMicrovascular: null,
    ksFootNeuropathy: null,
    ksTotal: null,

    dhsDomains: { A: null, B: null, C: null, D: null, E: null, F: null, G: null, H: null, I: null, J: null },
    dhsDomainOverrides: {},
    dhsTotal: null,
    dhsCategory: '',
    blueIndexRatio: '—',

    ddsItems: Array(17).fill(null),
    ddsTotal: null,
    ddsMean: null,
    ddsEmotionalBurden: null,
    ddsPhysicianDistress: null,
    ddsRegimenDistress: null,
    ddsInterpersonalDistress: null,
    ddsCategory: '',

    suggestedCluster: '',
    clusterType: '',
    investigatorName: '',
    investigatorEmail: '',
    verifiedAt: '',
    attachments: [],
    statusColor: 'red',
  };
  return base;
}
