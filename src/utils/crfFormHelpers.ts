import type { MedicationRow, PatientCRF } from '../types/clinical';
import { evaluateMissingDataAndStatus } from './clinicalMath';

export interface PaddedMedicationRow {
  srNo: number;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  startDuration: string;
  status: 'Current' | 'Disc.' | '';
}

export type HypoPdfCategory = 'NO' | 'Mild' | 'Moderate' | 'High' | '';

export function mapHypoglycemiaCategory(
  severity: PatientCRF['hypoglycemiaSeverity']
): HypoPdfCategory {
  if (!severity) return '';
  if (severity === 'No') return 'NO';
  if (severity === 'Level 1 Asymptomatic' || severity === 'Level 1 Symptomatic') {
    return 'Mild';
  }
  if (severity === 'Level 2') return 'Moderate';
  return 'High';
}

export function mapPhysicalActivityCategory(
  activity: PatientCRF['physicalActivity']
): 'Sedentary' | 'Light' | 'Mod-High' | '' {
  if (!activity) return '';
  if (activity === 'Sedentary' || activity === 'Unwilling/Bedridden') return 'Sedentary';
  if (activity === 'Minimal' || activity === '30-89 min/week') return 'Light';
  return 'Mod-High';
}

export function mapDietModificationCategory(
  score: number | null
): 'Good' | 'Moderate' | 'Poor' | '' {
  if (score === null) return '';
  if (score >= 4) return 'Good';
  if (score >= 2) return 'Moderate';
  return 'Poor';
}

export function mapFollowUpCategory(score: number | null): 'Regular' | 'Irregular' | '' {
  if (score === null) return '';
  return score >= 4 ? 'Regular' : 'Irregular';
}

export function mapVaccinationCategory(score: number | null): 'All' | 'partially' | 'No' | '' {
  if (score === null) return '';
  if (score >= 5) return 'All';
  if (score >= 3) return 'partially';
  return 'No';
}

export function mapSmokingPdfFlags(patient: PatientCRF): {
  isNo: boolean;
  isExSmoker: boolean;
  isYes: boolean;
  qtyBand: '<10' | '10-20' | '>20' | '';
} {
  if (patient.smokingStatus === 'Never') {
    return { isNo: true, isExSmoker: false, isYes: false, qtyBand: '' };
  }
  if (patient.smokingStatus === 'Ex-smoker >1yr') {
    return { isNo: false, isExSmoker: true, isYes: false, qtyBand: '' };
  }
  if (patient.smokingStatus === 'Current') {
    const qtyBand =
      patient.smokingQuantity === '<10/day'
        ? '<10'
        : patient.smokingQuantity === '10-20/day'
          ? '10-20'
          : patient.smokingQuantity === '>20/day'
            ? '>20'
            : '';
    return { isNo: false, isExSmoker: false, isYes: true, qtyBand };
  }
  return { isNo: false, isExSmoker: false, isYes: false, qtyBand: '' };
}

export function buildMedicationTableRows(
  patient: PatientCRF,
  totalRows = 9
): PaddedMedicationRow[] {
  const combined: Array<{ row: MedicationRow; visitDate?: string }> = [];
  for (const visit of patient.medicationVisits) {
    for (const drug of visit.drugs) {
      if (drug.drugName.trim()) {
        combined.push({ row: drug, visitDate: visit.visitDate });
      }
    }
  }
  for (const med of patient.otherMedications) {
    if (med.drugName.trim()) {
      combined.push({ row: med });
    }
  }

  const out: PaddedMedicationRow[] = [];
  for (let i = 0; i < totalRows; i++) {
    const entry = combined[i];
    if (entry) {
      out.push({
        srNo: i + 1,
        drugName: entry.row.drugName,
        dose: entry.row.dose,
        route: entry.row.route,
        frequency: entry.row.frequency,
        startDuration: entry.row.startDuration || entry.visitDate || '',
        status: entry.row.status || '',
      });
    } else {
      out.push({
        srNo: i + 1,
        drugName: '',
        dose: '',
        route: '',
        frequency: '',
        startDuration: '',
        status: '',
      });
    }
  }
  return out;
}

export function deriveNephropathyTier(patient: PatientCRF): number | null {
  const vals = [patient.ksMicroEgfrTier, patient.ksMicroUacrTier].filter(
    (v): v is number => v !== null && v !== undefined
  );
  if (vals.length === 0) return null;
  return Math.max(...vals);
}

export function formatCrfQueriesSummary(patient: PatientCRF): {
  isComplete: boolean;
  summaryText: string;
} {
  const { missingFields, statusColor } = evaluateMissingDataAndStatus(patient);
  if (missingFields.length === 0) {
    return {
      isComplete: true,
      summaryText: 'No missing critical or baseline fields.',
    };
  }
  return {
    isComplete: statusColor === 'green',
    summaryText: missingFields.map((m) => m.label).join('; '),
  };
}
