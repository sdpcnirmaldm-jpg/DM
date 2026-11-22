import React from 'react';
import type { LabMetric, PatientCRF } from '../../types/clinical';
import {
  buildMedicationTableRows,
  mapDietModificationCategory,
  mapFollowUpCategory,
  mapHypoglycemiaCategory,
  mapPhysicalActivityCategory,
  mapSmokingPdfFlags,
  mapVaccinationCategory,
} from '../../utils/crfFormHelpers';
import {
  CELL_TD,
  CrfCheckBox,
  CrfPageSheet,
  CrfSectionHeading,
  FillBlank,
  LABEL_TD,
  NAVY_TH,
} from './CrfFormPrimitives';

interface CrfPages1And2Props {
  patient: PatientCRF;
  blankMode: boolean;
  inlineEditing: boolean;
  draftNotes: string;
  onDraftNotesChange: (val: string) => void;
}

const fmtMetricVal = (m: LabMetric | undefined, blank: boolean) => {
  if (blank || !m || m.value === null || m.value === undefined) return '';
  return String(m.value);
};

const fmtMetricDate = (m: LabMetric | undefined, blank: boolean) => {
  if (blank || !m || m.value === null || m.value === undefined || !m.date) return '';
  return m.date;
};

export const CrfPages1And2: React.FC<CrfPages1And2Props> = ({
  patient,
  blankMode,
  inlineEditing,
  draftNotes,
  onDraftNotesChange,
}) => {
  const val = <T,>(v: T): T | '' => (blankMode ? '' : v);
  const hypoCat = blankMode ? '' : mapHypoglycemiaCategory(patient.hypoglycemiaSeverity);
  const activityCat = blankMode ? '' : mapPhysicalActivityCategory(patient.physicalActivity);
  const dietCat = blankMode ? '' : mapDietModificationCategory(patient.dietAdherenceScore);
  const followCat = blankMode ? '' : mapFollowUpCategory(patient.followUpRegularityScore);
  const vaccCat = blankMode ? '' : mapVaccinationCategory(patient.vaccinationScore);
  const smokeFlags = blankMode
    ? { isNo: false, isExSmoker: false, isYes: false, qtyBand: '' as const }
    : mapSmokingPdfFlags(patient);

  const medRows = blankMode
    ? Array.from({ length: 9 }, (_, i) => ({
        srNo: i + 1,
        drugName: '',
        dose: '',
        route: '',
        frequency: '',
        startDuration: '',
        status: '' as const,
      }))
    : buildMedicationTableRows(patient, 9);

  const bpDisplay =
    !blankMode && patient.sbp !== null && patient.dbp !== null
      ? `${patient.sbp} / ${patient.dbp}`
      : '';

  const hrValue = !blankMode ? (patient.hr ?? patient.pulse) : null;

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* PAGE 1: SECTIONS 1 TO 5                                             */}
      {/* =================================================================== */}
      <CrfPageSheet pageNumber={1}>
        {/* Institutional Centered Header (Strictly zero prohibited locality wording) */}
        <div className="flex flex-col items-center text-center border-b-2 border-[#15345B] pb-3">
          <div className="flex items-center justify-center gap-3">
            <img
              src="/assets/aistudio/Screenshot_20261114-122005-display-0.png_b2588ec0.png"
              alt="Desai Diabetes & Endocrine Clinic"
              referrerPolicy="no-referrer"
              className="h-10 w-auto object-contain"
            />
            <div>
              <h1 className="text-[15px] font-bold tracking-wide text-[#15345B] uppercase">
                SHREE DHANVANTARY PHARMACY COLLEGE, SURAT
              </h1>
              <p className="text-[11px] font-semibold text-[#334155] uppercase">
                DESAI DIABETES &amp; ENDOCRINE CLINIC · NIRMAL HOSPITAL, SURAT
              </p>
            </div>
          </div>
          <div className="mt-1.5 text-[14px] font-bold tracking-wider text-[#15345B] uppercase">
            CASE REPORT FORM (CRF)
          </div>
          <div className="mt-1 text-[10.5px] font-mono text-[#475569]">
            Ethics ID: SDPC-IEC/DHR2026/05 · T2DM Phenotypic Classification Study
          </div>
        </div>

        {/* 1. PATIENT DEMOGRAPHICS & BASELINE IDENTIFICATION */}
        <CrfSectionHeading>1. PATIENT DEMOGRAPHICS &amp; BASELINE IDENTIFICATION:</CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${LABEL_TD} w-[18%]`}>Patient Name:</td>
              <td className={`${CELL_TD} w-[32%] font-semibold`}>
                {val(patient.patientName)}
              </td>
              <td className={`${LABEL_TD} w-[18%]`}>UHID / IP No.:</td>
              <td className={`${CELL_TD} w-[32%] font-mono`}>{val(patient.uhid)}</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Gender:</td>
              <td className={CELL_TD} colSpan={3}>
                <CrfCheckBox checked={!blankMode && patient.gender === 'Male'} label="Male" />
                <CrfCheckBox checked={!blankMode && patient.gender === 'Female'} label="Female" />
                <CrfCheckBox checked={!blankMode && patient.gender === 'Other'} label="Other" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Age:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.age} suffix="years" placeholderLine="_________" />
              </td>
              <td className={LABEL_TD}>Date of Birth:</td>
              <td className={CELL_TD}>
                <FillBlank value={val(patient.dob)} placeholderLine="____ / ____ / ________" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Visit No.:</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={!blankMode && patient.visitNo === '1st'} label="1st" />
                <CrfCheckBox checked={!blankMode && patient.visitNo === '2nd'} label="2nd" />
                <CrfCheckBox checked={!blankMode && patient.visitNo === '3rd'} label="3rd" />
              </td>
              <td className={LABEL_TD}>Education:</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={!blankMode && patient.education === '<10th'} label="<10th" />
                <CrfCheckBox checked={!blankMode && patient.education === '10th'} label="10th" />
                <CrfCheckBox checked={!blankMode && patient.education === '12th'} label="12th" />
                <CrfCheckBox
                  checked={!blankMode && patient.education === 'Higher Education'}
                  label="Higher Ed."
                />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Contact Number:</td>
              <td className={`${CELL_TD} font-mono`}>{val(patient.contactNumber)}</td>
              <td className={LABEL_TD}>Blood Group:</td>
              <td className={`${CELL_TD} font-mono`}>{val(patient.bloodGroup)}</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Date of Recruitment:</td>
              <td className={CELL_TD}>
                <FillBlank
                  value={val(patient.dateOfRecruitment)}
                  placeholderLine="____ / ____ / ________"
                />
              </td>
              <td className={LABEL_TD}>Occupation:</td>
              <td className={CELL_TD}>{val(patient.occupation)}</td>
            </tr>
          </tbody>
        </table>

        {/* 2. DIABETES HISTORY & CLINICAL PROFILE */}
        <CrfSectionHeading>2. DIABETES HISTORY &amp; CLINICAL PROFILE:</CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${LABEL_TD} w-[18%]`}>Month/Year of Diagnosis:</td>
              <td className={`${CELL_TD} w-[32%] font-mono`}>
                {val(patient.diagnosisMonthYear)}
              </td>
              <td className={`${LABEL_TD} w-[18%]`}>Family History of DM:</td>
              <td className={`${CELL_TD} w-[32%]`}>
                <div>
                  <CrfCheckBox
                    checked={!blankMode && patient.familyHistoryDM === 'Yes'}
                    label="Yes"
                  />
                  <CrfCheckBox
                    checked={!blankMode && patient.familyHistoryDM === 'No'}
                    label="No"
                  />
                </div>
                <div className="mt-1 text-[11px] text-[#334155]">
                  Relations:{' '}
                  <FillBlank
                    value={
                      !blankMode && patient.familyHistoryRelations.length > 0
                        ? patient.familyHistoryRelations.join(', ')
                        : ''
                    }
                    placeholderLine="____________________________"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Duration of Diabetes:</td>
              <td className={CELL_TD}>
                <FillBlank
                  value={
                    !blankMode && patient.durationYears !== null
                      ? `${patient.durationYears}${
                          patient.durationMonths ? `y ${patient.durationMonths}m` : ''
                        }`
                      : null
                  }
                  suffix="years"
                  placeholderLine="_________"
                />
              </td>
              <td className={LABEL_TD}>Age at Diagnosis:</td>
              <td className={CELL_TD}>
                <FillBlank
                  value={blankMode ? null : patient.ageAtDiagnosis}
                  suffix="years"
                  placeholderLine="_________"
                />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Other Relevant History:</td>
              <td className={CELL_TD}>
                {inlineEditing && !blankMode ? (
                  <input
                    type="text"
                    value={draftNotes}
                    onChange={(e) => onDraftNotesChange(e.target.value)}
                    aria-label="Other Relevant History"
                    className="w-full px-2 py-1 border border-[#047857] rounded text-xs"
                  />
                ) : (
                  <span>{val(patient.otherRelevantHistory)}</span>
                )}
              </td>
              <td className={LABEL_TD}>Hypoglycemia:</td>
              <td className={CELL_TD}>
                <div>
                  <CrfCheckBox checked={hypoCat === 'NO'} label="NO" />
                  <CrfCheckBox checked={hypoCat === 'Mild'} label="Mild" />
                  <CrfCheckBox checked={hypoCat === 'Moderate'} label="Moderate" />
                  <CrfCheckBox checked={hypoCat === 'High'} label="High" />
                </div>
                <div className="mt-1 text-[11px]">
                  Complications:{' '}
                  <FillBlank
                    value={val(patient.complicationsText)}
                    placeholderLine="____________________"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 3. SOCIAL & LIFESTYLE HISTORY */}
        <CrfSectionHeading>3. SOCIAL &amp; LIFESTYLE HISTORY:</CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${LABEL_TD} w-[18%]`}>Smoking / Tobacco:</td>
              <td className={`${CELL_TD} w-[34%]`}>
                <div>
                  <CrfCheckBox checked={smokeFlags.isNo} label="No" />
                  <CrfCheckBox checked={smokeFlags.isExSmoker} label="Ex-smoker>1yr" />
                </div>
                <div className="mt-1">
                  <CrfCheckBox checked={smokeFlags.isYes} label="Yes-Quantity/d:" />
                  <CrfCheckBox checked={smokeFlags.qtyBand === '<10'} label="<10" />
                  <CrfCheckBox checked={smokeFlags.qtyBand === '10-20'} label="10-20" />
                  <CrfCheckBox checked={smokeFlags.qtyBand === '>20'} label=">20" />
                </div>
              </td>
              <td className={`${LABEL_TD} w-[18%]`}>Alcohol:</td>
              <td className={`${CELL_TD} w-[30%]`}>
                <CrfCheckBox checked={!blankMode && patient.alcoholIntake === 'No'} label="No" />
                <CrfCheckBox checked={!blankMode && patient.alcoholIntake === 'Yes'} label="Yes" />
                <CrfCheckBox
                  checked={!blankMode && patient.alcoholIntake === 'Occasionally'}
                  label="Occasional"
                />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Physical Activity:</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={activityCat === 'Sedentary'} label="Sedentary" />
                <CrfCheckBox checked={activityCat === 'Light'} label="Light" />
                <CrfCheckBox checked={activityCat === 'Mod-High'} label="Mod-High" />
              </td>
              <td className={LABEL_TD}>Diet Modification:</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={dietCat === 'Good'} label="Good" />
                <CrfCheckBox checked={dietCat === 'Moderate'} label="Moderate" />
                <CrfCheckBox
                  checked={dietCat === 'Poor'}
                  label={`Poor (${
                    dietCat === 'Poor' && patient.dietAdherenceScore !== null
                      ? `${patient.dietAdherenceScore}/5`
                      : '___'
                  })`}
                />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Clinic Follow-up:</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={followCat === 'Regular'} label="Regular" />
                <CrfCheckBox checked={followCat === 'Irregular'} label="Irregular" />
              </td>
              <td className={LABEL_TD}>Vaccination / Infection:</td>
              <td className={CELL_TD}>
                <div>
                  <CrfCheckBox checked={vaccCat === 'All'} label="All" />
                  <CrfCheckBox checked={vaccCat === 'partially'} label="partially" />
                  <CrfCheckBox checked={vaccCat === 'No'} label="No" />
                </div>
                <div className="mt-1">
                  Infection:{' '}
                  <CrfCheckBox
                    checked={!blankMode && patient.infectionPresent === 'Yes'}
                    label="Yes"
                  />
                  <CrfCheckBox
                    checked={!blankMode && patient.infectionPresent === 'No'}
                    label="No"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* 4. ANTHROPOMETRIC MEASUREMENTS & VITAL SIGNS */}
        <CrfSectionHeading>4. ANTHROPOMETRIC MEASUREMENTS &amp; VITAL SIGNS</CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[15%]`}>Parameter</th>
              <th className={`${NAVY_TH} w-[18%]`}>Value</th>
              <th className={`${NAVY_TH} w-[17%]`}>Normal Ref.</th>
              <th className={`${NAVY_TH} w-[16%]`}>Parameter</th>
              <th className={`${NAVY_TH} w-[16%]`}>Value</th>
              <th className={`${NAVY_TH} w-[18%]`}>Normal Ref.</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL_TD}>Height</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.heightCm} suffix="cm" placeholderLine="__________" />
              </td>
              <td className={CELL_TD}>—</td>
              <td className={LABEL_TD}>Weight</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.weightKg} suffix="kg" placeholderLine="________" />
              </td>
              <td className={CELL_TD}>—</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>BMI</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.bmi} suffix="kg/m²" placeholderLine="_________" />
              </td>
              <td className={CELL_TD}>18.5 – 24.9 kg/m²</td>
              <td className={LABEL_TD}>Waist Circumf.</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.waistCm} suffix="cm" placeholderLine="________" />
              </td>
              <td className={CELL_TD}>M &lt;102; F &lt;88 cm</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Hip Circumf.</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.hipCm} suffix="cm" placeholderLine="__________" />
              </td>
              <td className={CELL_TD}>—</td>
              <td className={LABEL_TD}>Waist-Hip Ratio</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.waistHipRatio} placeholderLine="________" />
              </td>
              <td className={CELL_TD}>M &lt;0.90; F &lt;0.85</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>BP</td>
              <td className={CELL_TD}>
                <FillBlank value={bpDisplay} suffix="mmHg" placeholderLine="_________" />
              </td>
              <td className={CELL_TD}>&lt; 120/80 mmHg</td>
              <td className={LABEL_TD}>Pulse</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.pulse} suffix="bpm" placeholderLine="________" />
              </td>
              <td className={CELL_TD}>60 – 100 bpm</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>HR</td>
              <td className={CELL_TD}>
                <FillBlank value={hrValue} suffix="bpm" placeholderLine="_________" />
              </td>
              <td className={CELL_TD}>60 – 100 bpm</td>
              <td className={LABEL_TD}>On Anti-HTN Meds</td>
              <td className={CELL_TD} colSpan={2}>
                <CrfCheckBox checked={!blankMode && patient.onAntiHtnMeds} label="Yes" />
                <CrfCheckBox checked={!blankMode && !patient.onAntiHtnMeds && (patient.sbp !== null || patient.dbp !== null)} label="No" />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 5. GLYCEMIC & LIPID PROFILE */}
        <CrfSectionHeading>5. GLYCEMIC &amp; LIPID PROFILE:</CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[34%]`}>Parameter</th>
              <th className={`${NAVY_TH} w-[18%]`}>Date</th>
              <th className={`${NAVY_TH} w-[14%]`}>Value</th>
              <th className={`${NAVY_TH} w-[12%]`}>Unit</th>
              <th className={`${NAVY_TH} w-[22%]`}>Normal Reference</th>
            </tr>
          </thead>
          <tbody>
            {[
              { label: 'Fasting Blood Glucose (FBS)', m: patient.fbg, unit: patient.fbg.unit || 'mg/dL', ref: '74 – 106 mg/dL' },
              { label: 'Postprandial Blood Glucose (PPSB)', m: patient.ppbg, unit: patient.ppbg.unit || 'mg/dL', ref: '< 140 mg/dL' },
              { label: 'Random Blood Sugar (RBS)', m: patient.rbs, unit: patient.rbs.unit || 'mg/dL', ref: '< 200 mg/dL' },
              { label: '1.HbA1c', m: patient.hba1c1, unit: patient.hba1c1.unit || '%', ref: '< 5.6%' },
              { label: '2.HbA1c', m: patient.hba1c2, unit: patient.hba1c2.unit || '%', ref: '< 5.6%' },
              { label: 'Total Cholesterol', m: patient.totalCholesterol, unit: patient.totalCholesterol.unit || 'mg/dL', ref: '< 200 mg/dL' },
              { label: 'Triglycerides', m: patient.triglycerides, unit: patient.triglycerides.unit || 'mg/dL', ref: 'M: 40–160; F: 35–135' },
              { label: 'HDL Cholesterol', m: patient.hdl, unit: patient.hdl.unit || 'mg/dL', ref: 'M > 45; F > 55 mg/dL' },
              { label: 'LDL Cholesterol', m: patient.ldl, unit: patient.ldl.unit || 'mg/dL', ref: '< 129 mg/dL' },
            ].map((row) => (
              <tr key={row.label}>
                <td className={LABEL_TD}>{row.label}</td>
                <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(row.m, blankMode)}</td>
                <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                  {fmtMetricVal(row.m, blankMode)}
                </td>
                <td className={CELL_TD}>{row.unit}</td>
                <td className={CELL_TD}>{row.ref}</td>
              </tr>
            ))}
            <tr>
              <td className={LABEL_TD}>LDL/HDL Ratio</td>
              <td className={CELL_TD} />
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {!blankMode && patient.ldlHdlRatio !== null ? patient.ldlHdlRatio : ''}
              </td>
              <td className={CELL_TD}>Ratio</td>
              <td className={CELL_TD}>2.5–3.5</td>
            </tr>
          </tbody>
        </table>
      </CrfPageSheet>

      {/* =================================================================== */}
      {/* PAGE 2: SECTIONS 6 TO 10                                            */}
      {/* =================================================================== */}
      <CrfPageSheet pageNumber={2}>
        {/* 6. HAEMATOLOGY */}
        <CrfSectionHeading>6. HAEMATOLOGY</CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${LABEL_TD} w-[16%]`}>Hemoglobin</td>
              <td className={`${CELL_TD} w-[34%]`}>
                <FillBlank value={fmtMetricVal(patient.hemoglobin, blankMode)} placeholderLine="___________" />{' '}
                g/dl (13-16 g/dl)
              </td>
              <td className={`${LABEL_TD} w-[16%]`}>Pcv</td>
              <td className={`${CELL_TD} w-[34%]`}>
                <FillBlank value={fmtMetricVal(patient.pcv, blankMode)} placeholderLine="______________" />{' '}
                % (37-47)
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>MCH</td>
              <td className={CELL_TD}>
                <FillBlank value={fmtMetricVal(patient.mch, blankMode)} placeholderLine="___________" />{' '}
                pg (27.1-32.5pg)
              </td>
              <td className={LABEL_TD}>Platelet</td>
              <td className={CELL_TD}>
                <FillBlank value={fmtMetricVal(patient.platelets, blankMode)} placeholderLine="___________" />{' '}
                10^3/micL (140-440)
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>MCHC</td>
              <td className={CELL_TD}>
                <FillBlank value={fmtMetricVal(patient.mchc, blankMode)} placeholderLine="___________" />{' '}
                gm/dl (32-36gm/dl)
              </td>
              <td className={LABEL_TD}>Total Count (TC)</td>
              <td className={CELL_TD}>
                <FillBlank value={fmtMetricVal(patient.totalCount, blankMode)} placeholderLine="___________" />{' '}
                cells/mm³ (3.2–9.8x10³)
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Mcv</td>
              <td className={CELL_TD} colSpan={3}>
                <FillBlank value={fmtMetricVal(patient.mcv, blankMode)} suffix="fL (80–100 fL)" placeholderLine="___________" />
              </td>
            </tr>
          </tbody>
        </table>

        {/* 7. HEPATIC AND RENAL PARAMETERS */}
        <CrfSectionHeading>7. HEPATIC AND RENAL PARAMETERS:</CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[34%]`}>Parameter</th>
              <th className={`${NAVY_TH} w-[18%]`}>Date</th>
              <th className={`${NAVY_TH} w-[14%]`}>Value</th>
              <th className={`${NAVY_TH} w-[14%]`}>Unit</th>
              <th className={`${NAVY_TH} w-[20%]`}>Normal Reference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL_TD}>Serum Creatinine</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.serumCreatinine, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.serumCreatinine, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.serumCreatinine.unit || 'mg/dL'}</td>
              <td className={CELL_TD}>0.6–1.3 mg/dL (8.8-26.5)</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>eGFR</td>
              <td className={`${CELL_TD} font-mono`}>{!blankMode && patient.egfr !== null ? 'Auto' : ''}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {!blankMode && patient.egfr !== null ? patient.egfr : ''}
              </td>
              <td className={CELL_TD}>mL/min/1.73 m²</td>
              <td className={CELL_TD}>&gt; 90 mL/min/1.73 m²</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Urine glucose</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.urineGlucose, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.urineGlucose, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.urineGlucose.unit || 'mg/dL'}</td>
              <td className={CELL_TD}>Negative</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Epithelial Cells</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.epithelialCells, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.epithelialCells, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.epithelialCells.unit || '/HPF'}</td>
              <td className={CELL_TD}>0–5 /HPF</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Urinary Albumin / UACR</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.uacr, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.uacr, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.uacr.unit || 'mg/g'}</td>
              <td className={CELL_TD}>&lt; 30 mg/g</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Liver Function - AST (SGOT)</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.ast, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.ast, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.ast.unit || 'U/L'}</td>
              <td className={CELL_TD}>0 – 35 U/L</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Liver Function - ALT (SGPT)</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.alt, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.alt, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.alt.unit || 'U/L'}</td>
              <td className={CELL_TD}>4 – 36 U/L</td>
            </tr>
          </tbody>
        </table>

        {/* 8. ANTIDIABETIC MEDICATION HISTORY */}
        <CrfSectionHeading
          rightText={
            !blankMode && patient.medicationVisits[0]?.hba1cAtVisit
              ? `Visit HbA1c: ${patient.medicationVisits[0].hba1cAtVisit}%`
              : undefined
          }
        >
          8. ANTIDIABETIC MEDICATION HISTORY:
        </CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[6%] text-center`}>Sr.</th>
              <th className={`${NAVY_TH} w-[29%]`}>Drug Name (Generic)</th>
              <th className={`${NAVY_TH} w-[12%]`}>Dose</th>
              <th className={`${NAVY_TH} w-[10%]`}>Route</th>
              <th className={`${NAVY_TH} w-[10%]`}>Freq.</th>
              <th className={`${NAVY_TH} w-[15%]`}>Start / Duration</th>
              <th className={`${NAVY_TH} w-[18%]`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {medRows.map((row) => (
              <tr key={row.srNo}>
                <td className={`${CELL_TD} text-center font-mono`}>{row.srNo}</td>
                <td className={`${CELL_TD} font-medium`}>{row.drugName}</td>
                <td className={`${CELL_TD} font-mono`}>{row.dose}</td>
                <td className={CELL_TD}>{row.route}</td>
                <td className={`${CELL_TD} font-mono`}>{row.frequency}</td>
                <td className={`${CELL_TD} font-mono text-[11px]`}>{row.startDuration}</td>
                <td className={CELL_TD}>
                  <CrfCheckBox checked={row.status === 'Current'} label="Current" />
                  <CrfCheckBox checked={row.status === 'Disc.'} label="Disc." />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 9. β-CELL FUNCTION & INSULIN RESISTANCE */}
        <CrfSectionHeading>9. β-CELL FUNCTION &amp; INSULIN RESISTANCE</CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[36%]`}>Parameter</th>
              <th className={`${NAVY_TH} w-[24%]`}>Date / Time</th>
              <th className={`${NAVY_TH} w-[20%]`}>Value</th>
              <th className={`${NAVY_TH} w-[20%]`}>Unit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL_TD}>Stimulated C-peptide</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.cPeptide, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.cPeptide, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.cPeptide.unit || 'ng/mL'}</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Fasting insulin</td>
              <td className={`${CELL_TD} font-mono`}>{fmtMetricDate(patient.fastingInsulin, blankMode)}</td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {fmtMetricVal(patient.fastingInsulin, blankMode)}
              </td>
              <td className={CELL_TD}>{patient.fastingInsulin.unit || 'µIU/mL'}</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>HOMA-B</td>
              <td className={`${CELL_TD} text-[#475569]`}>
                {!blankMode && (patient.homaB !== null || patient.homaIR !== null)
                  ? `Source: ${patient.homaMethod}`
                  : ''}
              </td>
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {!blankMode && patient.homaB !== null ? patient.homaB : ''}
              </td>
              <td className={CELL_TD}>Calculated (%)</td>
            </tr>
            <tr>
              <td className={LABEL_TD}>HOMA-IR</td>
              <td className={CELL_TD} />
              <td className={`${CELL_TD} font-mono font-semibold text-right`}>
                {!blankMode && patient.homaIR !== null ? patient.homaIR : ''}
              </td>
              <td className={CELL_TD}>Calculated</td>
            </tr>
          </tbody>
        </table>

        {/* 10. FIBRO SCAN */}
        <CrfSectionHeading>
          10. FIBRO SCAN:{' '}
          <span className="font-normal normal-case text-[#334155]">
            {val(patient.fibroScanNotes) || '__________________________'}
          </span>
        </CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${LABEL_TD} w-[22%]`}>Date of Fibro Scan:</td>
              <td className={`${CELL_TD} w-[28%]`}>
                <FillBlank value={val(patient.fibroScanDate)} placeholderLine="____ / ____ / ________" />
              </td>
              <td className={`${LABEL_TD} w-[22%]`}>Fasting Duration:</td>
              <td className={`${CELL_TD} w-[28%]`}>
                <FillBlank value={blankMode ? null : patient.fastingDurationHours} suffix="hrs" placeholderLine="________" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>LSM (Liver Stiffness):</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.lsmKpa} suffix="kPa" placeholderLine="________" />
              </td>
              <td className={LABEL_TD}>CAP:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.capDbm} suffix="dB/m" placeholderLine="________" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>IQR:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.iqr} placeholderLine="________" />
              </td>
              <td className={LABEL_TD}>IQR / Median:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.iqrMedianPct} suffix="%" placeholderLine="________" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Valid Measurements:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.validMeasurements} placeholderLine="________" />
              </td>
              <td className={LABEL_TD}>Success Rate:</td>
              <td className={CELL_TD}>
                <FillBlank value={blankMode ? null : patient.successRatePct} suffix="%" placeholderLine="________" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Fibrosis Interpretation:</td>
              <td className={`${CELL_TD} font-semibold`}>{val(patient.fibrosisInterpretation)}</td>
              <td className={LABEL_TD}>Steatosis Interpretation:</td>
              <td className={`${CELL_TD} font-semibold`}>{val(patient.steatosisInterpretation)}</td>
            </tr>
          </tbody>
        </table>
      </CrfPageSheet>
    </div>
  );
};
