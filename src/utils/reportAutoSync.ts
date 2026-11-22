import type { AttachmentFile, Gender, MedicationRow, PatientCRF } from '../types/clinical';
import {
  createBlankPatientCRF,
  recalculatePatientCRF,
} from './clinicalMath';

export interface ExtractedReportMedication {
  drugName?: string;
  dose?: string;
  route?: string;
  frequency?: string;
}

export interface ExtractedReportPayload {
  patientName?: string | null;
  uhid?: string | null;
  participantId?: string | null;
  gender?: string | null;
  dob?: string | null;
  contactNumber?: string | null;
  reportDate?: string | null;
  documentType?: string | null;
  sbp?: number | null;
  dbp?: number | null;
  pulse?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  fbg?: number | null;
  ppbg?: number | null;
  rbs?: number | null;
  hba1c1?: number | null;
  hba1c2?: number | null;
  totalCholesterol?: number | null;
  triglycerides?: number | null;
  hdl?: number | null;
  ldl?: number | null;
  hemoglobin?: number | null;
  pcv?: number | null;
  mcv?: number | null;
  mch?: number | null;
  mchc?: number | null;
  platelets?: number | null;
  totalCount?: number | null;
  serumCreatinine?: number | null;
  uacr?: number | null;
  ast?: number | null;
  alt?: number | null;
  cPeptide?: number | null;
  fastingInsulin?: number | null;
  lsmKpa?: number | null;
  capDbm?: number | null;
  iqr?: number | null;
  iqrMedianPct?: number | null;
  validMeasurements?: number | null;
  successRatePct?: number | null;
  medications?: ExtractedReportMedication[];
  summary?: string | null;
}

export type MatchConfidence = 'exact' | 'high' | 'possible' | 'none';

export interface PatientMatchResult {
  matchedPatient: PatientCRF | null;
  confidence: MatchConfidence;
  matchReason: string;
}

export interface ReportFieldChange {
  fieldLabel: string;
  section: string;
  previousValue: string;
  newValue: string;
}

function normalizeIdToken(val?: string | null): string {
  return (val || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeNameTokens(name?: string | null): string[] {
  const honorifics = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'shri', 'smt', 'bhai', 'ben']);
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !honorifics.has(t));
}

function normalizePhoneDigits(phone?: string | null): string {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Matches an extracted clinical report against existing enrolled study participants
 * using Participant ID, UHID, Contact Number, and Patient Name token similarity.
 */
export function matchPatientFromReport(
  patients: PatientCRF[],
  extracted: ExtractedReportPayload
): PatientMatchResult {
  if (patients.length === 0) {
    return { matchedPatient: null, confidence: 'none', matchReason: 'No patients enrolled yet' };
  }

  const extPid = normalizeIdToken(extracted.participantId);
  const extUhid = normalizeIdToken(extracted.uhid);
  const extPhone = normalizePhoneDigits(extracted.contactNumber);
  const extDob = (extracted.dob || '').trim();
  const extTokens = normalizeNameTokens(extracted.patientName);

  // 1. Exact Participant ID match
  if (extPid) {
    const byPid = patients.find((p) => normalizeIdToken(p.participantId) === extPid);
    if (byPid) {
      return {
        matchedPatient: byPid,
        confidence: 'exact',
        matchReason: `Matched Participant ID ${byPid.participantId}`,
      };
    }
  }

  // 2. Exact UHID match
  if (extUhid) {
    const byUhid = patients.find((p) => normalizeIdToken(p.uhid) === extUhid);
    if (byUhid) {
      return {
        matchedPatient: byUhid,
        confidence: 'exact',
        matchReason: `Matched UHID ${byUhid.uhid}`,
      };
    }
  }

  // 3. Phone number match
  if (extPhone.length === 10) {
    const byPhone = patients.find((p) => normalizePhoneDigits(p.contactNumber) === extPhone);
    if (byPhone) {
      return {
        matchedPatient: byPhone,
        confidence: 'high',
        matchReason: `Matched contact number ending in ${extPhone.slice(-4)}`,
      };
    }
  }

  // 4. Name similarity + optional DOB boost
  if (extTokens.length > 0) {
    let bestPatient: PatientCRF | null = null;
    let bestScore = 0;
    let bestOverlap = 0;

    for (const p of patients) {
      const pTokens = normalizeNameTokens(p.patientName);
      if (pTokens.length === 0) continue;

      let overlap = 0;
      for (const t of extTokens) {
        if (
          pTokens.some(
            (pt) =>
              pt === t ||
              (pt.length >= 4 && t.length >= 4 && (pt.startsWith(t) || t.startsWith(pt)))
          )
        ) {
          overlap += 1;
        }
      }
      if (overlap === 0) continue;

      const unionSize = new Set([...pTokens, ...extTokens]).size;
      let score = overlap / unionSize;
      if (extDob && p.dob === extDob) score += 0.35;

      if (score > bestScore) {
        bestScore = score;
        bestOverlap = overlap;
        bestPatient = p;
      }
    }

    if (bestPatient && (bestScore >= 0.85 || (bestOverlap >= 2 && bestScore >= 0.6))) {
      return {
        matchedPatient: bestPatient,
        confidence: 'high',
        matchReason: `Matched patient name "${bestPatient.patientName}"`,
      };
    }
    if (bestPatient && bestScore >= 0.45) {
      return {
        matchedPatient: bestPatient,
        confidence: 'possible',
        matchReason: `Possible name match "${bestPatient.patientName}"`,
      };
    }
  }

  return {
    matchedPatient: null,
    confidence: 'none',
    matchReason: 'No matching enrolled participant found for this report',
  };
}

function isValidNumber(v: unknown): v is number {
  return typeof v === 'number' && !Number.isNaN(v) && Number.isFinite(v);
}

function formatPrev(v: number | string | null | undefined, suffix = ''): string {
  if (v === null || v === undefined || v === '') return 'Empty';
  return `${v}${suffix}`;
}

/**
 * Merges extracted report values into an existing patient CRF, attaches the uploaded
 * document, smartly assigns baseline vs follow-up HbA1c, and runs full clinical recalculation
 * (BMI, eGFR, HOMA-B, HOMA-IR (CP), Blue Index DHS/KS, Status color).
 */
export function applyExtractedReportToPatient(
  patient: PatientCRF,
  extracted: ExtractedReportPayload,
  attachment?: AttachmentFile
): { updatedPatient: PatientCRF; appliedChanges: ReportFieldChange[] } {
  const validReportDate =
    extracted.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.reportDate)
      ? extracted.reportDate
      : '';

  const next: PatientCRF = {
    ...patient,
    dhsDomains: { ...patient.dhsDomains },
    dhsDomainOverrides: { ...(patient.dhsDomainOverrides ?? {}) },
    medicationVisits: (patient.medicationVisits || []).map((mv) => ({
      ...mv,
      drugs: mv.drugs.map((d) => ({ ...d })),
    })),
    attachments: [...(patient.attachments || [])],
  };

  const changes: ReportFieldChange[] = [];

  const updateLab = (
    key:
      | 'fbg'
      | 'ppbg'
      | 'rbs'
      | 'hba1c1'
      | 'hba1c2'
      | 'totalCholesterol'
      | 'triglycerides'
      | 'hdl'
      | 'ldl'
      | 'hemoglobin'
      | 'pcv'
      | 'mcv'
      | 'mch'
      | 'mchc'
      | 'platelets'
      | 'totalCount'
      | 'serumCreatinine'
      | 'uacr'
      | 'ast'
      | 'alt'
      | 'cPeptide'
      | 'fastingInsulin',
    label: string,
    section: string,
    val: number | null | undefined,
    defaultUnit: string
  ) => {
    if (!isValidNumber(val)) return;
    const prevMetric = next[key];
    const prevVal = prevMetric?.value ?? null;
    if (prevVal === val) return;
    changes.push({
      fieldLabel: label,
      section,
      previousValue: formatPrev(prevVal, prevMetric?.unit ? ` ${prevMetric.unit}` : ''),
      newValue: `${val} ${prevMetric?.unit || defaultUnit}`,
    });
    next[key] = {
      ...(prevMetric || { date: '', unit: defaultUnit }),
      date: validReportDate || prevMetric?.date || '',
      value: val,
      unit: prevMetric?.unit || defaultUnit,
    } as never;
  };

  // Vitals & Anthropometry
  if (isValidNumber(extracted.sbp) && next.sbp !== extracted.sbp) {
    changes.push({
      fieldLabel: 'Systolic BP',
      section: 'Vitals',
      previousValue: formatPrev(next.sbp, ' mmHg'),
      newValue: `${extracted.sbp} mmHg`,
    });
    next.sbp = extracted.sbp;
  }
  if (isValidNumber(extracted.dbp) && next.dbp !== extracted.dbp) {
    changes.push({
      fieldLabel: 'Diastolic BP',
      section: 'Vitals',
      previousValue: formatPrev(next.dbp, ' mmHg'),
      newValue: `${extracted.dbp} mmHg`,
    });
    next.dbp = extracted.dbp;
  }
  if (isValidNumber(extracted.pulse) && next.pulse !== extracted.pulse) {
    changes.push({
      fieldLabel: 'Pulse Rate',
      section: 'Vitals',
      previousValue: formatPrev(next.pulse, ' bpm'),
      newValue: `${extracted.pulse} bpm`,
    });
    next.pulse = extracted.pulse;
  }
  if (isValidNumber(extracted.heightCm) && next.heightValue !== extracted.heightCm) {
    changes.push({
      fieldLabel: 'Height',
      section: 'Anthropometry',
      previousValue: formatPrev(next.heightValue, ' cm'),
      newValue: `${extracted.heightCm} cm`,
    });
    next.heightValue = extracted.heightCm;
    next.heightUnit = 'cm';
  }
  if (isValidNumber(extracted.weightKg) && next.weightValue !== extracted.weightKg) {
    changes.push({
      fieldLabel: 'Weight',
      section: 'Anthropometry',
      previousValue: formatPrev(next.weightValue, ' kg'),
      newValue: `${extracted.weightKg} kg`,
    });
    next.weightValue = extracted.weightKg;
    next.weightUnit = 'kg';
  }
  if (isValidNumber(extracted.waistCm) && next.waistValue !== extracted.waistCm) {
    changes.push({
      fieldLabel: 'Waist Circumference',
      section: 'Anthropometry',
      previousValue: formatPrev(next.waistValue, ' cm'),
      newValue: `${extracted.waistCm} cm`,
    });
    next.waistValue = extracted.waistCm;
    next.waistUnit = 'cm';
  }
  if (isValidNumber(extracted.hipCm) && next.hipValue !== extracted.hipCm) {
    changes.push({
      fieldLabel: 'Hip Circumference',
      section: 'Anthropometry',
      previousValue: formatPrev(next.hipValue, ' cm'),
      newValue: `${extracted.hipCm} cm`,
    });
    next.hipValue = extracted.hipCm;
    next.hipUnit = 'cm';
  }

  // Glycemic Profile (smartly route single extracted HbA1c to 2nd HbA1c when baseline exists)
  updateLab('fbg', 'Fasting Blood Glucose', 'Glycemic Profile', extracted.fbg, 'mg/dL');
  updateLab('ppbg', 'Postprandial Glucose', 'Glycemic Profile', extracted.ppbg, 'mg/dL');
  updateLab('rbs', 'Random Blood Sugar', 'Glycemic Profile', extracted.rbs, 'mg/dL');

  if (isValidNumber(extracted.hba1c1) && isValidNumber(extracted.hba1c2)) {
    updateLab('hba1c1', '1st HbA1c (Baseline)', 'Glycemic Profile', extracted.hba1c1, '%');
    updateLab('hba1c2', '2nd HbA1c (Follow-up)', 'Glycemic Profile', extracted.hba1c2, '%');
  } else if (isValidNumber(extracted.hba1c2)) {
    updateLab('hba1c2', '2nd HbA1c (Follow-up)', 'Glycemic Profile', extracted.hba1c2, '%');
  } else if (isValidNumber(extracted.hba1c1)) {
    if (next.hba1c1.value !== null && next.hba1c1.value !== extracted.hba1c1) {
      updateLab('hba1c2', '2nd HbA1c (Follow-up)', 'Glycemic Profile', extracted.hba1c1, '%');
    } else {
      updateLab('hba1c1', '1st HbA1c (Baseline)', 'Glycemic Profile', extracted.hba1c1, '%');
    }
  }

  // Lipids
  updateLab('totalCholesterol', 'Total Cholesterol', 'Lipid Profile', extracted.totalCholesterol, 'mg/dL');
  updateLab('triglycerides', 'Triglycerides', 'Lipid Profile', extracted.triglycerides, 'mg/dL');
  updateLab('hdl', 'HDL Cholesterol', 'Lipid Profile', extracted.hdl, 'mg/dL');
  updateLab('ldl', 'LDL Cholesterol', 'Lipid Profile', extracted.ldl, 'mg/dL');

  // Haematology
  updateLab('hemoglobin', 'Hemoglobin', 'Haematology', extracted.hemoglobin, 'g/dL');
  updateLab('pcv', 'PCV', 'Haematology', extracted.pcv, '%');
  updateLab('mcv', 'MCV', 'Haematology', extracted.mcv, 'fL');
  updateLab('mch', 'MCH', 'Haematology', extracted.mch, 'pg');
  updateLab('mchc', 'MCHC', 'Haematology', extracted.mchc, 'g/dL');
  updateLab('platelets', 'Platelets', 'Haematology', extracted.platelets, '10^3/µL');
  updateLab('totalCount', 'Total Count (WBC)', 'Haematology', extracted.totalCount, 'cells/mm³');

  // Renal & Hepatic
  updateLab('serumCreatinine', 'Serum Creatinine', 'Hepatic & Renal', extracted.serumCreatinine, 'mg/dL');
  updateLab('uacr', 'UACR', 'Hepatic & Renal', extracted.uacr, 'mg/g');
  updateLab('ast', 'AST (SGOT)', 'Hepatic & Renal', extracted.ast, 'U/L');
  updateLab('alt', 'ALT (SGPT)', 'Hepatic & Renal', extracted.alt, 'U/L');

  // Beta-Cell Function
  updateLab('cPeptide', 'C-Peptide', 'Beta-Cell Function', extracted.cPeptide, 'ng/mL');
  updateLab('fastingInsulin', 'Fasting Insulin', 'Beta-Cell Function', extracted.fastingInsulin, 'µIU/mL');
  if (isValidNumber(extracted.cPeptide)) {
    next.homaMethod = 'c-peptide';
  }

  // FibroScan
  if (isValidNumber(extracted.lsmKpa) && next.lsmKpa !== extracted.lsmKpa) {
    changes.push({
      fieldLabel: 'FibroScan LSM',
      section: 'FibroScan',
      previousValue: formatPrev(next.lsmKpa, ' kPa'),
      newValue: `${extracted.lsmKpa} kPa`,
    });
    next.lsmKpa = extracted.lsmKpa;
    next.fibroScanDate = next.fibroScanDate || validReportDate;
  }
  if (isValidNumber(extracted.capDbm) && next.capDbm !== extracted.capDbm) {
    changes.push({
      fieldLabel: 'FibroScan CAP',
      section: 'FibroScan',
      previousValue: formatPrev(next.capDbm, ' dB/m'),
      newValue: `${extracted.capDbm} dB/m`,
    });
    next.capDbm = extracted.capDbm;
    next.fibroScanDate = next.fibroScanDate || validReportDate;
  }
  if (isValidNumber(extracted.iqr)) next.iqr = extracted.iqr;
  if (isValidNumber(extracted.iqrMedianPct)) next.iqrMedianPct = extracted.iqrMedianPct;
  if (isValidNumber(extracted.validMeasurements)) next.validMeasurements = extracted.validMeasurements;
  if (isValidNumber(extracted.successRatePct)) next.successRatePct = extracted.successRatePct;

  // Medications (append newly extracted drugs not already listed)
  if (Array.isArray(extracted.medications) && extracted.medications.length > 0) {
    if (next.medicationVisits.length === 0) {
      next.medicationVisits.push({
        id: `mv-${Date.now()}`,
        visitDate: validReportDate,
        hba1cAtVisit: '',
        drugs: [],
      });
    }
    const existingNames = new Set(
      next.medicationVisits[0].drugs.map((d) => d.drugName.trim().toLowerCase()).filter(Boolean)
    );
    const addedDrugs: MedicationRow[] = [];
    for (const med of extracted.medications) {
      const name = (med.drugName || '').trim();
      if (!name || existingNames.has(name.toLowerCase())) continue;
      existingNames.add(name.toLowerCase());
      addedDrugs.push({
        id: `ai-med-${Date.now()}-${addedDrugs.length}`,
        drugName: name,
        dose: (med.dose || '').trim(),
        route: (med.route || '').trim(),
        frequency: (med.frequency || '').trim(),
        status: '',
      });
    }
    if (addedDrugs.length > 0) {
      const cleanExisting = next.medicationVisits[0].drugs.filter((d) => d.drugName.trim() !== '');
      next.medicationVisits[0].drugs = [...cleanExisting, ...addedDrugs];
      changes.push({
        fieldLabel: 'Medications Added',
        section: 'Medication',
        previousValue: `${cleanExisting.length} drugs`,
        newValue: addedDrugs.map((d) => `${d.drugName} ${d.dose}`.trim()).join(', '),
      });
    }
  }

  // Attach uploaded report file so it's archived on the CRF
  if (attachment) {
    const alreadyAttached = next.attachments.some(
      (a) => a.name === attachment.name && a.section === attachment.section
    );
    if (!alreadyAttached) {
      next.attachments.push(attachment);
      changes.push({
        fieldLabel: 'Clinical Attachment',
        section: attachment.section,
        previousValue: `${patient.attachments?.length || 0} files`,
        newValue: `Attached "${attachment.name}"`,
      });
    }
  }

  const recalculated = recalculatePatientCRF(next);
  return {
    updatedPatient: recalculated,
    appliedChanges: changes,
  };
}

/**
 * Builds a pre-filled blank CRF for an unmatched report so the investigator
 * can enroll the new participant in one click without re-typing.
 */
export function createDraftPatientFromReport(
  _existingPatients: PatientCRF[],
  extracted: ExtractedReportPayload,
  attachment?: AttachmentFile
): PatientCRF {
  const genderRaw = (extracted.gender || '').trim().toLowerCase();
  const gender: Gender =
    genderRaw.startsWith('f')
      ? 'Female'
      : genderRaw.startsWith('o')
      ? 'Other'
      : genderRaw.startsWith('m')
      ? 'Male'
      : '';
  const validReportDate =
    extracted.reportDate && /^\d{4}-\d{2}-\d{2}$/.test(extracted.reportDate)
      ? extracted.reportDate
      : '';
  const blank = createBlankPatientCRF(1);
  blank.gender = gender;
  blank.dateOfRecruitment = validReportDate;
  blank.participantId = '';
  blank.patientName = (extracted.patientName || '').trim();
  blank.uhid = (extracted.uhid || '').trim();
  if (extracted.dob && /^\d{4}-\d{2}-\d{2}$/.test(extracted.dob)) blank.dob = extracted.dob;
  if (extracted.contactNumber) blank.contactNumber = extracted.contactNumber.trim();

  const { updatedPatient } = applyExtractedReportToPatient(blank, extracted, attachment);
  return updatedPatient;
}
