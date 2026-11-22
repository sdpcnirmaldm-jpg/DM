import type { AttachmentFile, PatientCRF } from '../types/clinical';
import { evaluateMissingDataAndStatus } from './clinicalMath';
import { getPatientKey } from './statisticalCharts';

export interface ParsedAttachmentPayload {
  participantId: string;
  patientName: string;
  id: string;
  name: string;
  section: string;
  uploadedAt: string;
  mimeType: string;
  base64Data: string;
}

export interface AttachmentManifestItem {
  participantId: string;
  patientName: string;
  uhid: string;
  id: string;
  name: string;
  section: string;
  uploadedAt: string;
  mimeType: string;
  hasData: boolean;
}

export function parseDataUrl(
  dataUrl?: string,
  fileName?: string
): { mimeType: string; base64Data: string } | null {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    return {
      mimeType: match[1] || inferMimeType(fileName),
      base64Data: match[2],
    };
  }
  return null;
}

export function inferMimeType(fileName?: string): string {
  const lower = (fileName || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.txt')) return 'text/plain';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'image/jpeg';
}

export function stripPatientForAI(patient: PatientCRF): Record<string, unknown> {
  const { missingFields: missing } = evaluateMissingDataAndStatus(patient);
  return {
    participantId: patient.participantId,
    uhid: patient.uhid,
    patientName: patient.patientName,
    gender: patient.gender,
    dob: patient.dob,
    age: patient.age,
    contactNumber: patient.contactNumber,
    bloodGroup: patient.bloodGroup,
    dateOfRecruitment: patient.dateOfRecruitment,
    visitNo: patient.visitNo,
    education: patient.education,
    occupation: patient.occupation,
    followUpDate: patient.followUpDate,
    diagnosisMonthYear: patient.diagnosisMonthYear,
    ageAtDiagnosis: patient.ageAtDiagnosis,
    durationYears: patient.durationYears,
    durationMonths: patient.durationMonths,
    familyHistoryDM: patient.familyHistoryDM,
    familyHistoryRelations: patient.familyHistoryRelations,
    otherRelevantHistory: patient.otherRelevantHistory,
    hypoglycemiaSeverity: patient.hypoglycemiaSeverity,
    hypoglycemiaAfterMedication: patient.hypoglycemiaAfterMedication,
    hypoglycemiaDescription: patient.hypoglycemiaDescription,
    complicationsText: patient.complicationsText,
    smokingStatus: patient.smokingStatus,
    smokingQuantity: patient.smokingQuantity,
    tobaccoStatus: patient.tobaccoStatus,
    tobaccoQuantity: patient.tobaccoQuantity,
    alcoholIntake: patient.alcoholIntake,
    alcoholNotes: patient.alcoholNotes,
    physicalActivity: patient.physicalActivity,
    dietAdherenceScore: patient.dietAdherenceScore,
    followUpRegularityScore: patient.followUpRegularityScore,
    vaccinationScore: patient.vaccinationScore,
    comorbidityScore: patient.comorbidityScore,
    infectionPresent: patient.infectionPresent,
    footUlcer: patient.footUlcer,
    footUlcerState: patient.footUlcerState,
    footAmputation: patient.footAmputation,
    heightCm: patient.heightCm,
    weightKg: patient.weightKg,
    bmi: patient.bmi,
    waistCm: patient.waistCm,
    hipCm: patient.hipCm,
    waistHipRatio: patient.waistHipRatio,
    sbp: patient.sbp,
    dbp: patient.dbp,
    onAntiHtnMeds: patient.onAntiHtnMeds,
    pulse: patient.pulse,
    fbg: patient.fbg,
    ppbg: patient.ppbg,
    rbs: patient.rbs,
    hba1c1: patient.hba1c1,
    hba1c2: patient.hba1c2,
    hba1cTarget: patient.hba1cTarget,
    totalCholesterol: patient.totalCholesterol,
    triglycerides: patient.triglycerides,
    hdl: patient.hdl,
    ldl: patient.ldl,
    nonHdl: patient.nonHdl,
    ldlHdlRatio: patient.ldlHdlRatio,
    onStatin: patient.onStatin,
    hemoglobin: patient.hemoglobin,
    mcv: patient.mcv,
    mch: patient.mch,
    mchc: patient.mchc,
    platelets: patient.platelets,
    totalCount: patient.totalCount,
    serumCreatinine: patient.serumCreatinine,
    egfr: patient.egfr,
    urineGlucose: patient.urineGlucose,
    epithelialCells: patient.epithelialCells,
    uacr: patient.uacr,
    microalbuminStatus: patient.microalbuminStatus,
    ast: patient.ast,
    alt: patient.alt,
    medicationVisits: patient.medicationVisits,
    otherMedications: patient.otherMedications,
    cPeptide: patient.cPeptide,
    fastingInsulin: patient.fastingInsulin,
    homaMethod: patient.homaMethod,
    homaB: patient.homaB,
    homaIR: patient.homaIR,
    fibroScanNotes: patient.fibroScanNotes,
    fibroScanDate: patient.fibroScanDate,
    fastingDurationHours: patient.fastingDurationHours,
    lsmKpa: patient.lsmKpa,
    capDbm: patient.capDbm,
    iqr: patient.iqr,
    iqrMedianPct: patient.iqrMedianPct,
    validMeasurements: patient.validMeasurements,
    successRatePct: patient.successRatePct,
    fibrosisInterpretation: patient.fibrosisInterpretation,
    steatosisInterpretation: patient.steatosisInterpretation,
    ksMacrovascular: patient.ksMacrovascular,
    ksMicroEgfrTier: patient.ksMicroEgfrTier,
    ksMicroUacrTier: patient.ksMicroUacrTier,
    ksMicroRetinopathyTier: patient.ksMicroRetinopathyTier,
    ksMicrovascular: patient.ksMicrovascular,
    ksFootNeuropathy: patient.ksFootNeuropathy,
    ksTotal: patient.ksTotal,
    dhsDomains: patient.dhsDomains,
    dhsTotal: patient.dhsTotal,
    dhsCategory: patient.dhsCategory,
    blueIndexRatio: patient.blueIndexRatio,
    ddsTotal: patient.ddsTotal,
    ddsMean: patient.ddsMean,
    ddsEmotionalBurden: patient.ddsEmotionalBurden,
    ddsPhysicianDistress: patient.ddsPhysicianDistress,
    ddsRegimenDistress: patient.ddsRegimenDistress,
    ddsInterpersonalDistress: patient.ddsInterpersonalDistress,
    ddsCategory: patient.ddsCategory,
    suggestedCluster: patient.suggestedCluster,
    clusterType: patient.clusterType,
    investigatorName: patient.investigatorName,
    verifiedAt: patient.verifiedAt,
    statusColor: patient.statusColor,
    pendingFields: missing.map((m) => m.label),
    attachments: (patient.attachments || []).map((a) => ({
      id: a.id,
      name: a.name,
      section: a.section,
      uploadedAt: a.uploadedAt,
      mimeType: parseDataUrl(a.dataUrl, a.name)?.mimeType || inferMimeType(a.name),
      hasData: Boolean(parseDataUrl(a.dataUrl, a.name)),
    })),
  };
}

export function buildAttachmentManifest(patients: PatientCRF[]): AttachmentManifestItem[] {
  const manifest: AttachmentManifestItem[] = [];
  for (const p of patients) {
    for (const att of p.attachments || []) {
      const parsed = parseDataUrl(att.dataUrl, att.name);
      manifest.push({
        participantId: p.participantId,
        patientName: p.patientName,
        uhid: p.uhid,
        id: att.id,
        name: att.name,
        section: att.section,
        uploadedAt: att.uploadedAt,
        mimeType: parsed?.mimeType || inferMimeType(att.name),
        hasData: Boolean(parsed),
      });
    }
  }
  return manifest;
}

export function collectPatientAttachments(
  patients: PatientCRF[],
  targetKey?: string,
  maxFiles = 12,
  maxTotalBytes = 14 * 1024 * 1024
): ParsedAttachmentPayload[] {
  const sourcePatients = targetKey
    ? patients.filter((p) => getPatientKey(p) === targetKey || p.participantId === targetKey)
    : patients;

  const collected: ParsedAttachmentPayload[] = [];
  let runningBytes = 0;

  for (const p of sourcePatients) {
    for (const att of p.attachments || []) {
      if (collected.length >= maxFiles) return collected;
      const parsed = parseDataUrl(att.dataUrl, att.name);
      if (!parsed) continue;
      // Only include multimodal MIME types supported by Gemini inlineData
      const supported =
        parsed.mimeType.startsWith('image/') ||
        parsed.mimeType === 'application/pdf' ||
        parsed.mimeType.startsWith('text/');
      if (!supported) continue;

      const approxBytes = Math.ceil((parsed.base64Data.length * 3) / 4);
      if (runningBytes + approxBytes > maxTotalBytes) continue;

      runningBytes += approxBytes;
      collected.push({
        participantId: p.participantId,
        patientName: p.patientName,
        id: att.id,
        name: att.name,
        section: att.section,
        uploadedAt: att.uploadedAt,
        mimeType: parsed.mimeType,
        base64Data: parsed.base64Data,
      });
    }
  }
  return collected;
}

export function findAttachmentPayload(
  patients: PatientCRF[],
  participantId: string,
  attachmentId?: string,
  fileName?: string
): ParsedAttachmentPayload | null {
  const queryPid = participantId.trim().toLowerCase();
  const patient = patients.find(
    (p) =>
      p.participantId.toLowerCase() === queryPid ||
      p.uhid.toLowerCase() === queryPid ||
      p.patientName.toLowerCase().includes(queryPid)
  );
  if (!patient || !patient.attachments?.length) return null;

  let match: AttachmentFile | undefined;
  if (attachmentId) {
    match = patient.attachments.find((a) => a.id === attachmentId);
  }
  if (!match && fileName) {
    const qName = fileName.trim().toLowerCase();
    match = patient.attachments.find(
      (a) =>
        a.name.toLowerCase().includes(qName) ||
        a.section.toLowerCase().includes(qName)
    );
  }
  if (!match) {
    match = patient.attachments.find((a) => Boolean(parseDataUrl(a.dataUrl, a.name))) || patient.attachments[0];
  }
  if (!match) return null;

  const parsed = parseDataUrl(match.dataUrl, match.name);
  if (!parsed) return null;

  return {
    participantId: patient.participantId,
    patientName: patient.patientName,
    id: match.id,
    name: match.name,
    section: match.section,
    uploadedAt: match.uploadedAt,
    mimeType: parsed.mimeType,
    base64Data: parsed.base64Data,
  };
}

export function buildCompactCohortVoiceDirectory(patients: PatientCRF[]): string {
  const clusterCounts = patients.reduce<Record<string, number>>((acc, p) => {
    const label = p.clusterType || 'Unassigned';
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const totalAttachments = patients.reduce((acc, p) => acc + (p.attachments?.length || 0), 0);

  const lines = patients.map((p) => {
    const missing = evaluateMissingDataAndStatus(p).missingFields.map((m) => m.label);
    const meds = [
      ...(p.medicationVisits || []).flatMap((v) =>
        v.drugs.map((d) => `${d.drugName} ${d.dose} ${d.frequency}`.trim())
      ),
      ...(p.otherMedications || []).map((d) => `${d.drugName} ${d.dose} ${d.frequency}`.trim()),
    ]
      .filter(Boolean)
      .slice(0, 8);
    const files = (p.attachments || []).map((a) => `${a.name} [${a.section}]`);

    return [
      `${p.uhid || 'No UHID'} | ${p.patientName || 'Unnamed'} | ${p.gender || 'Unspecified'}, ${p.age ?? '?'}y | Cluster: ${p.clusterType || 'Unassigned'} | Status: ${p.statusColor}`,
      `  Vitals/Anthro: BMI ${p.bmi ?? 'N/A'}, WHR ${p.waistHipRatio ?? 'N/A'}, BP ${p.sbp ?? '?'}/${p.dbp ?? '?'}`,
      `  Labs: HbA1c1 ${p.hba1c1.value ?? 'N/A'}%, HbA1c2 ${p.hba1c2.value ?? 'Pending'}%, FBG ${p.fbg.value ?? 'N/A'}, PPBG ${p.ppbg.value ?? 'N/A'}, Cr ${p.serumCreatinine.value ?? 'N/A'}, eGFR ${p.egfr ?? 'N/A'}, UACR ${p.uacr.value ?? 'N/A'}, TG ${p.triglycerides.value ?? 'N/A'}, HDL ${p.hdl.value ?? 'N/A'}, LDL ${p.ldl.value ?? 'N/A'}, AST/ALT ${p.ast.value ?? 'N/A'}/${p.alt.value ?? 'N/A'}`,
      `  Beta-Cell & FibroScan: C-Pep ${p.cPeptide.value ?? 'N/A'}, HOMA-B ${p.homaB ?? 'N/A'}, HOMA-IR ${p.homaIR ?? 'N/A'}, LSM ${p.lsmKpa ?? 'N/A'} kPa (${p.fibrosisInterpretation || 'N/A'}), CAP ${p.capDbm ?? 'N/A'} dB/m (${p.steatosisInterpretation || 'N/A'})`,
      `  Indices: Blue Index DHS ${p.dhsTotal ?? 'N/A'}/50 (${p.dhsCategory || 'N/A'}) : KS ${p.ksTotal ?? 'N/A'}/15 | DDS-17 Mean ${p.ddsMean ?? 'N/A'} (${p.ddsCategory || 'N/A'})`,
      `  Meds: ${meds.length ? meds.join('; ') : 'None recorded'} | Follow-up: ${p.followUpDate || 'Unscheduled'}`,
      `  Pending: ${missing.length ? missing.join(', ') : 'None'} | Attached Files: ${files.length ? files.join(', ') : 'None'}`,
    ].join('\n');
  });

  return [
    `FULL AUTHORIZED STUDY DATASET (${patients.length} patients, ${totalAttachments} attached files). Cluster counts: ${JSON.stringify(clusterCounts)}.`,
    `You have full permission from the investigator to access and discuss all patient records and attached patient files below. Use get_patient_record for complete domain-by-domain details or read_patient_attachment to inspect the actual contents of any patient's attached PDF/image file.`,
    '',
    ...lines,
  ].join('\n');
}
