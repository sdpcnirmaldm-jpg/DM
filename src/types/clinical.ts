export type Gender = 'Male' | 'Female' | 'Other' | '';
export type ClusterType = 'SIDD' | 'SIRD' | 'CIRDD' | 'MARD';
export type StatusColor = 'green' | 'yellow' | 'orange' | 'red';

export interface LabMetric {
  date: string;
  value: number | null;
  unit: string;
  method?: string;
}

export interface AttachmentFile {
  id: string;
  name: string;
  section: string;
  dataUrl?: string;
  uploadedAt: string;
}

export interface MedicationRow {
  id: string;
  drugName: string;
  dose: string;
  route: string;
  frequency: string;
  startDuration?: string;
  status?: 'Current' | 'Disc.' | '';
}

export interface MedicationVisitBlock {
  id: string;
  visitDate: string;
  hba1cAtVisit: string;
  drugs: MedicationRow[];
}

export interface DHSDomains {
  A: number | null; // Average Blood Sugar (HbA1c)
  B: number | null; // Blood Pressure
  C: number | null; // Lipids
  D: number | null; // Diet Adherence
  E: number | null; // Exercise / Activity
  F: number | null; // Follow-up & Compliance
  G: number | null; // General Health & Comorbidity
  H: number | null; // Habits (Tobacco, Smoking, Alcohol)
  I: number | null; // Infection Prevention / Vaccination
  J: number | null; // Jeopardy (Hypoglycemia / ADR)
}

export interface PatientCRF {
  id?: number;
  // 1. Demographics & Baseline
  participantId: string;
  uhid: string;
  patientName: string;
  gender: Gender;
  dob: string;
  age: number | null;
  contactNumber: string;
  bloodGroup: string;
  dateOfRecruitment: string;
  visitNo: '1st' | '2nd' | '3rd' | '';
  education: '<10th' | '10th' | '12th' | 'Higher Education' | '';
  occupation: string;
  followUpDate: string;

  // 2. Diabetes History & Clinical Profile
  diagnosisMonthYear: string; // YYYY-MM or MM/YYYY
  ageAtDiagnosis: number | null;
  durationYears: number | null;
  durationMonths: number | null;
  familyHistoryDM: 'Yes' | 'No' | '';
  familyHistoryRelations: string[];
  otherRelevantHistory: string;
  hypoglycemiaSeverity:
    | 'No'
    | 'Level 1 Asymptomatic'
    | 'Level 1 Symptomatic'
    | 'Level 2'
    | 'Level 3'
    | 'Recurrent Level 3 or LOC'
    | '';
  hypoglycemiaAfterMedication: 'No' | 'Yes' | 'Not Known' | '';
  hypoglycemiaDescription: string;
  complicationsText: string;

  // 3. Social & Lifestyle History
  smokingStatus: 'Never' | 'Ex-smoker >1yr' | 'Current' | '';
  smokingQuantity: '<10/day' | '10-20/day' | '>20/day' | 'Substance abuse' | '';
  tobaccoStatus: 'Never' | 'Tobacco-free >1yr' | 'Current' | '';
  tobaccoQuantity: '<=5 sachet/day' | '5-10 sachet/day' | '>10 sachet/day' | 'Unwilling' | '';
  alcoholIntake: 'No' | 'Occasionally' | 'Yes' | '';
  alcoholNotes: string;
  physicalActivity:
    | '>=150 min/week'
    | '90-149 min/week'
    | '30-89 min/week'
    | 'Minimal'
    | 'Sedentary'
    | 'Unwilling/Bedridden'
    | '';
  dietAdherenceScore: number | null; // 0..5
  followUpRegularityScore: number | null; // 0..5
  vaccinationScore: number | null; // 0..5
  comorbidityScore: number | null; // 0..5
  infectionPresent: 'Yes' | 'No' | '';
  footUlcer: 'No' | 'Yes' | '';
  footUlcerState: 'Active' | 'Present in Past' | '';
  footAmputation: 'Yes' | 'No' | '';

  // 4. Anthropometric Measurements & Vitals
  heightValue: number | null;
  heightUnit: 'cm' | 'inch' | 'feet';
  heightCm: number | null;
  weightValue: number | null;
  weightUnit: 'kg' | 'lbs';
  weightKg: number | null;
  bmi: number | null;
  bmiManualOverride: boolean;
  waistValue: number | null;
  waistUnit: 'cm' | 'inch';
  waistCm: number | null;
  hipValue: number | null;
  hipUnit: 'cm' | 'inch';
  hipCm: number | null;
  waistHipRatio: number | null;
  whrManualOverride: boolean;
  sbp: number | null;
  dbp: number | null;
  onAntiHtnMeds: boolean;
  pulse: number | null;
  hr?: number | null;

  // 5. Glycemic & Lipid Profile
  fbg: LabMetric;
  ppbg: LabMetric;
  rbs: LabMetric;
  hba1c1: LabMetric;
  hba1c2: LabMetric;
  hba1cTarget: number;
  totalCholesterol: LabMetric;
  triglycerides: LabMetric;
  hdl: LabMetric;
  ldl: LabMetric;
  nonHdl: number | null;
  ldlHdlRatio: number | null;
  onStatin: boolean;

  // 6. Haematology
  hemoglobin: LabMetric;
  pcv?: LabMetric;
  mcv: LabMetric;
  mch: LabMetric;
  mchc: LabMetric;
  platelets: LabMetric;
  totalCount: LabMetric;

  // 7. Hepatic & Renal Parameters
  serumCreatinine: LabMetric;
  egfr: number | null;
  egfrManualOverride: boolean;
  urineGlucose: LabMetric;
  epithelialCells: LabMetric;
  uacr: LabMetric;
  microalbuminStatus: 'Normoalbuminuria' | 'Microalbuminuria' | 'Macroalbuminuria' | '';
  microalbuminManualOverride?: boolean;
  ast: LabMetric;
  alt: LabMetric;

  // 8. Medication History
  medicationVisits: MedicationVisitBlock[];
  otherMedications: MedicationRow[];

  // 9. Beta-Cell Function & Insulin Resistance
  cPeptide: LabMetric;
  fastingInsulin: LabMetric;
  homaMethod: 'c-peptide' | 'insulin';
  homaB: number | null;
  homaIR: number | null;
  homaManualOverride: boolean;

  // 10. FibroScan
  fibroScanNotes: string;
  fibroScanDate: string;
  fastingDurationHours: number | null;
  lsmKpa: number | null;
  capDbm: number | null;
  iqr: number | null;
  iqrMedianPct: number | null;
  validMeasurements: number | null;
  successRatePct: number | null;
  fibrosisInterpretation: 'F0-F1' | 'F2' | 'F3' | 'F4' | '';
  steatosisInterpretation: 'S0' | 'S1' | 'S2' | 'S3' | '';

  // 11. Known Severity (KS)
  ksMacrovascular: number | null; // 0..5
  ksMicroEgfrTier: number | null; // 0..5
  ksMicroEgfrManualOverride?: boolean;
  ksMicroUacrTier: number | null; // 0..5
  ksMicroUacrManualOverride?: boolean;
  ksMicroRetinopathyTier: number | null; // 0..5
  ksMicrovascular: number | null; // max(eGFR, UACR, Retinopathy)
  ksFootNeuropathy: number | null; // 0..5
  ksTotal: number | null; // 0..15
  neuroMonofilament?: 'Normal' | 'Abnormal' | '';
  neuroVibration?: 'Normal' | 'Abnormal' | '';
  neuroAbi?: 'Normal' | 'Abnormal' | '';
  macroCad?: 'Present' | 'Absent' | '';
  macroCadDetails?: string;
  macroStroke?: 'Present' | 'Absent' | '';
  macroStrokeDetails?: string;
  macroPad?: 'Present' | 'Absent' | '';
  macroPadDetails?: string;
  macroOther?: 'Present' | 'Absent' | '';
  macroOtherDetails?: string;

  // 12. Blue Index / DHS
  dhsDomains: DHSDomains;
  dhsDomainOverrides?: Partial<Record<keyof DHSDomains, boolean>>;
  dhsTotal: number | null; // 0..50
  dhsCategory: 'Excellent Status' | 'Moderate Status' | 'Undesirable Status' | '';
  blueIndexRatio: string; // e.g., "2.80 (42:15)" or "42 : 0"

  // 13. DDS-17
  ddsItems: (number | null)[]; // length 17, 1..6
  ddsTotal: number | null;
  ddsMean: number | null;
  ddsEmotionalBurden: number | null;
  ddsPhysicianDistress: number | null;
  ddsRegimenDistress: number | null;
  ddsInterpersonalDistress: number | null;
  ddsCategory: 'Little or No Distress' | 'Moderate Distress' | 'High Distress' | '';

  // 14 & 15. Phenotype & Verification
  suggestedCluster: ClusterType | '';
  clusterType: ClusterType | '';
  investigatorName: string;
  investigatorEmail: string;
  verifiedAt: string;

  // Attachments per section
  attachments: AttachmentFile[];

  // Computed status color
  statusColor: StatusColor;
  createdByUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MissingFieldItem {
  key: string;
  label: string;
  tab: 'info' | 'dds17' | 'komplications' | 'vitals' | 'labs' | 'medications';
  section: string;
  priority: 'critical' | 'followup' | 'report';
}

export interface InvestigatorUser {
  id?: number;
  uid: string;
  email: string;
  displayName: string;
  photoUrl: string;
  role: 'owner' | 'researcher' | 'normal';
  status: 'approved' | 'pending' | 'rejected';
  lastLoginAt?: string;
  createdAt?: string;
}
