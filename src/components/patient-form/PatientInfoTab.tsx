import React from 'react';
import type { AttachmentFile, Gender, PatientCRF } from '../../types/clinical';
import { getTodayIST, normalizeIsoDate } from '../../utils/clinicalMath';
import { SectionAttachmentBar } from './SectionAttachmentBar';

interface PatientInfoTabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onGenderOrDateChange: (gender: Gender, recruitmentDate: string) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
  onAIExtract: (base64Data: string, mimeType: string, sectionLabel: string) => void;
  aiBusy: boolean;
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const FAMILY_RELATIONS = ['Mother', 'Father', 'Grandmother', 'Grandfather', 'Brother', 'Sister'];

export const PatientInfoTab: React.FC<PatientInfoTabProps> = ({
  crf,
  onChange,
  onGenderOrDateChange,
  onAddAttachment,
  onRemoveAttachment,
  onAIExtract,
  aiBusy,
}) => {
  const toggleRelation = (rel: string) => {
    onChange((prev) => {
      const exists = prev.familyHistoryRelations.includes(rel);
      return {
        ...prev,
        familyHistoryRelations: exists
          ? prev.familyHistoryRelations.filter((r) => r !== rel)
          : [...prev.familyHistoryRelations, rel],
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Section A: Patient Demographics & Baseline Identification */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5">
        <h3 className="font-display text-base font-bold text-[#14201B] mb-4">
          A. Patient Demographics &amp; Baseline Identification
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              UHID / IP No.
            </label>
            <input
              type="text"
              value={crf.uhid}
              onChange={(e) => onChange((prev) => ({ ...prev, uhid: e.target.value }))}
              placeholder="Enter UHID"
              aria-label="Patient UHID"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Patient Name
            </label>
            <input
              type="text"
              value={crf.patientName}
              onChange={(e) => onChange((prev) => ({ ...prev, patientName: e.target.value }))}
              placeholder="Full name"
              aria-label="Patient Name"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Gender</label>
            <div className="flex items-center gap-2 pt-1">
              {(['Male', 'Female', 'Other'] as Gender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    onGenderOrDateChange(
                      crf.gender === g ? '' : g,
                      crf.dateOfRecruitment
                    )
                  }
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-medium transition-colors ${
                    crf.gender === g
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white text-[#14201B] border-[#DDE8E2] hover:bg-[#F6F9F7]'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={crf.dob}
              onChange={(e) => onChange((prev) => ({ ...prev, dob: e.target.value }))}
              aria-label="Date of Birth"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Age (years)</label>
            <input
              type="number"
              value={crf.age ?? ''}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  age: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              aria-label="Age"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono bg-[#F6F9F7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Contact Number (10 digits)
            </label>
            <input
              type="tel"
              maxLength={10}
              value={crf.contactNumber}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  contactNumber: e.target.value.replace(/\D/g, '').slice(0, 10),
                }))
              }
              placeholder="10-digit mobile number"
              aria-label="Contact Number"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Blood Group</label>
            <select
              value={crf.bloodGroup}
              onChange={(e) => onChange((prev) => ({ ...prev, bloodGroup: e.target.value }))}
              aria-label="Blood Group"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm bg-white"
            >
              <option value="">Select blood group</option>
              {BLOOD_GROUPS.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Date of Recruitment (IST)
            </label>
            <input
              type="date"
              value={crf.dateOfRecruitment}
              onChange={(e) => onGenderOrDateChange(crf.gender, e.target.value)}
              aria-label="Date of Recruitment"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Visit No.</label>
            <select
              value={crf.visitNo}
              onChange={(e) =>
                onChange((prev) => ({
                  ...prev,
                  visitNo: e.target.value as PatientCRF['visitNo'],
                }))
              }
              aria-label="Visit Number"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm bg-white"
            >
              <option value="">Select visit</option>
              <option value="1st">1st Visit</option>
              <option value="2nd">2nd Visit</option>
              <option value="3rd">3rd Visit</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Education</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(['<10th', '10th', '12th', 'Higher Education'] as const).map((ed) => (
                <button
                  key={ed}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      education: prev.education === ed ? '' : ed,
                    }))
                  }
                  className={`py-2 px-2 rounded-lg border text-xs font-medium transition-colors truncate ${
                    crf.education === ed
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white text-[#14201B] border-[#DDE8E2] hover:bg-[#F6F9F7]'
                  }`}
                >
                  {ed === 'Higher Education' ? 'Higher Ed.' : ed}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Occupation</label>
            <input
              type="text"
              list="occupation-suggestions"
              value={crf.occupation}
              onChange={(e) => onChange((prev) => ({ ...prev, occupation: e.target.value }))}
              placeholder="Enter occupation"
              aria-label="Occupation"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
            />
            <datalist id="occupation-suggestions">
              <option value="Business" />
              <option value="Job" />
              <option value="Retired" />
              <option value="Homemaker" />
              <option value="Agriculture" />
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Scheduled Follow-up Date
            </label>
            <input
              type="date"
              value={crf.followUpDate}
              onChange={(e) => onChange((prev) => ({ ...prev, followUpDate: e.target.value }))}
              aria-label="Scheduled Follow-up Date"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="sectionA"
          sectionLabel="Demographics & Baseline"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* Section B: Diabetes History & Clinical Profile */}
      <section className="bg-white border border-[#DDE8E2] rounded-2xl p-5">
        <h3 className="font-display text-base font-bold text-[#14201B] mb-4">
          B. Diabetes History &amp; Clinical Profile
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Month / Year of Diagnosis
            </label>
            <input
              type="month"
              value={crf.diagnosisMonthYear}
              onChange={(e) => {
                const nextDiag = e.target.value;
                onChange((prev) => ({
                  ...prev,
                  diagnosisMonthYear: nextDiag,
                  ...(nextDiag === ''
                    ? { ageAtDiagnosis: null, durationYears: null, durationMonths: null }
                    : {}),
                }));
              }}
              aria-label="Month and Year of Diagnosis"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Age at Diagnosis (years)
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={crf.ageAtDiagnosis ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                const nextAgeDiag = raw === '' ? null : Number(raw);
                onChange((prev) => {
                  if (nextAgeDiag === null || Number.isNaN(nextAgeDiag)) {
                    return {
                      ...prev,
                      ageAtDiagnosis: null,
                      diagnosisMonthYear: '',
                      durationYears: null,
                      durationMonths: null,
                    };
                  }
                  const normDob = normalizeIsoDate(prev.dob);
                  if (normDob && nextAgeDiag >= 0 && nextAgeDiag <= 120) {
                    const birthYear = parseInt(normDob.slice(0, 4), 10);
                    const birthMonth = normDob.slice(5, 7);
                    const diagYear = birthYear + Math.floor(nextAgeDiag);
                    return {
                      ...prev,
                      ageAtDiagnosis: Math.floor(nextAgeDiag),
                      diagnosisMonthYear: `${diagYear}-${birthMonth}`,
                    };
                  }
                  return {
                    ...prev,
                    ageAtDiagnosis: nextAgeDiag,
                    diagnosisMonthYear: '',
                    durationYears: null,
                    durationMonths: null,
                  };
                });
              }}
              aria-label="Age at Diagnosis"
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono bg-[#F6F9F7]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Duration of Diabetes (years)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min={0}
                max={100}
                value={
                  crf.durationYears !== null || crf.durationMonths !== null
                    ? Number(((crf.durationYears ?? 0) + (crf.durationMonths ?? 0) / 12).toFixed(1))
                    : ''
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  const nextDur = raw === '' ? null : Number(raw);
                  onChange((prev) => {
                    if (nextDur === null || Number.isNaN(nextDur) || nextDur < 0) {
                      return {
                        ...prev,
                        diagnosisMonthYear: '',
                        ageAtDiagnosis: null,
                        durationYears: null,
                        durationMonths: null,
                      };
                    }
                    const refDate = normalizeIsoDate(prev.dateOfRecruitment) || getTodayIST();
                    const refYear = parseInt(refDate.slice(0, 4), 10);
                    const refMonth = parseInt(refDate.slice(5, 7), 10);
                    const totalMonths = Math.max(0, Math.round(nextDur * 12));
                    const diagTotalMonths = Math.max(0, refYear * 12 + (refMonth - 1) - totalMonths);
                    const diagYear = Math.floor(diagTotalMonths / 12);
                    const diagMonth = (diagTotalMonths % 12) + 1;
                    return {
                      ...prev,
                      diagnosisMonthYear: `${diagYear}-${String(diagMonth).padStart(2, '0')}`,
                      durationYears: Math.floor(totalMonths / 12),
                      durationMonths: totalMonths % 12,
                    };
                  });
                }}
                placeholder="e.g. 5"
                aria-label="Duration of Diabetes in years"
                className="w-24 px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm font-mono bg-[#F6F9F7]"
              />
              <div className="flex-1 px-3 py-2 border border-[#DDE8E2] rounded-xl text-xs font-mono bg-[#F6F9F7] text-[#4B6157] truncate">
                {crf.durationYears !== null
                  ? `${crf.durationYears} yrs ${crf.durationMonths ?? 0} mos`
                  : 'Auto from DOB'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Family History of DM
            </label>
            <div className="flex items-center gap-2">
              {(['No', 'Yes'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    onChange((prev) => {
                      const nextVal = prev.familyHistoryDM === opt ? '' : opt;
                      return {
                        ...prev,
                        familyHistoryDM: nextVal,
                        familyHistoryRelations:
                          nextVal === 'Yes' ? prev.familyHistoryRelations : [],
                      };
                    })
                  }
                  className={`px-4 py-2 rounded-xl border text-xs font-medium ${
                    crf.familyHistoryDM === opt
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white border-[#DDE8E2] text-[#14201B]'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {crf.familyHistoryDM === 'Yes' && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {FAMILY_RELATIONS.map((rel) => {
                  const checked = crf.familyHistoryRelations.includes(rel);
                  return (
                    <label
                      key={rel}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer ${
                        checked
                          ? 'bg-emerald-50 border-[#047857] text-[#053B2B] font-medium'
                          : 'bg-white border-[#DDE8E2] text-[#4B6157]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleRelation(rel)}
                        className="accent-[#047857]"
                      />
                      <span>{rel}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Other Complications / Relevant History
            </label>
            <textarea
              rows={2}
              value={crf.otherRelevantHistory}
              onChange={(e) =>
                onChange((prev) => ({ ...prev, otherRelevantHistory: e.target.value }))
              }
              placeholder="Thyroid disorder, hypertension, neuropathy, etc."
              className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
            />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
              Hypoglycemia Severity (auto-updates Blue Index Domain J)
            </label>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  'No',
                  'Level 1 Asymptomatic',
                  'Level 1 Symptomatic',
                  'Level 2',
                  'Level 3',
                  'Recurrent Level 3 or LOC',
                ] as const
              ).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      hypoglycemiaSeverity: prev.hypoglycemiaSeverity === sev ? '' : sev,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    crf.hypoglycemiaSeverity === sev
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white text-[#14201B] border-[#DDE8E2] hover:bg-[#F6F9F7]'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div>
              <label className="block text-xs font-medium text-[#4B6157] mb-1">
                Hypoglycemia After Medication
              </label>
              <div className="flex gap-2">
                {(['No', 'Yes', 'Not Known'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        hypoglycemiaAfterMedication:
                          prev.hypoglycemiaAfterMedication === opt ? '' : opt,
                      }))
                    }
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium ${
                      crf.hypoglycemiaAfterMedication === opt
                        ? 'bg-[#047857] text-white border-[#047857]'
                        : 'bg-white border-[#DDE8E2] text-[#14201B]'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#4B6157] mb-1">
                Hypoglycemia / Clinical Description
              </label>
              <input
                type="text"
                value={crf.hypoglycemiaDescription}
                onChange={(e) =>
                  onChange((prev) => ({ ...prev, hypoglycemiaDescription: e.target.value }))
                }
                placeholder="Episode timing, glucose reading, or medication context"
                className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
              />
            </div>
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="sectionB"
          sectionLabel="Diabetes History"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>

      {/* Section C: Social & Lifestyle History */}
      <section className="scroll-mt-20 bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-5">
        <div>
          <h3 className="font-display text-base font-bold text-[#14201B]">
            C. Social &amp; Lifestyle History
          </h3>
          <p className="text-xs text-[#4B6157] mt-0.5">
            Selections directly synchronize Blue Index DHS Domains D (Diet), E (Exercise), F
            (Follow-up), G (Comorbidity), H (Habits) &amp; I (Infection Prevention).
          </p>
        </div>

        {/* Smoking */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#4B6157]">
            Smoking (auto-updates Domain H)
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { val: 'Never', score: 5 },
                { val: 'Ex-smoker >1yr', score: 4 },
                { val: 'Current', score: null },
              ] as const
            ).map((st) => (
              <button
                key={st.val}
                type="button"
                onClick={() =>
                  onChange((prev) => {
                    const nextSt = prev.smokingStatus === st.val ? '' : st.val;
                    return {
                      ...prev,
                      smokingStatus: nextSt,
                      smokingQuantity: nextSt === 'Current' ? prev.smokingQuantity : '',
                    };
                  })
                }
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 ${
                  crf.smokingStatus === st.val
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <span>{st.val}</span>
                {st.score !== null && (
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      crf.smokingStatus === st.val ? 'text-emerald-100' : 'text-[#4B6157]'
                    }`}
                  >
                    ({st.score})
                  </span>
                )}
              </button>
            ))}
          </div>
          {crf.smokingStatus === 'Current' && (
            <div className="flex flex-wrap items-center gap-2 pl-3 pt-1">
              <span className="text-[11px] font-semibold text-[#4B6157]">Frequency:</span>
              {(
                [
                  { qty: '<10/day', score: 3 },
                  { qty: '10-20/day', score: 2 },
                  { qty: '>20/day', score: 1 },
                  { qty: 'Substance abuse', score: 0 },
                ] as const
              ).map((item) => (
                <button
                  key={item.qty}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      smokingQuantity: prev.smokingQuantity === item.qty ? '' : item.qty,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                    crf.smokingQuantity === item.qty
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-[#F6F9F7] border-[#DDE8E2] text-[#14201B] hover:bg-[#EFF5F1]'
                  }`}
                >
                  <span>{item.qty}</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      crf.smokingQuantity === item.qty ? 'text-emerald-100' : 'text-[#4B6157]'
                    }`}
                  >
                    ({item.score})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Smokeless Tobacco */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-[#4B6157]">
            Smokeless Tobacco (auto-updates Domain H)
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { val: 'Never', score: 5 },
                { val: 'Tobacco-free >1yr', score: 4 },
                { val: 'Current', score: null },
              ] as const
            ).map((st) => (
              <button
                key={st.val}
                type="button"
                onClick={() =>
                  onChange((prev) => {
                    const nextSt = prev.tobaccoStatus === st.val ? '' : st.val;
                    return {
                      ...prev,
                      tobaccoStatus: nextSt,
                      tobaccoQuantity: nextSt === 'Current' ? prev.tobaccoQuantity : '',
                    };
                  })
                }
                className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-2 ${
                  crf.tobaccoStatus === st.val
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <span>{st.val}</span>
                {st.score !== null && (
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      crf.tobaccoStatus === st.val ? 'text-emerald-100' : 'text-[#4B6157]'
                    }`}
                  >
                    ({st.score})
                  </span>
                )}
              </button>
            ))}
          </div>
          {crf.tobaccoStatus === 'Current' && (
            <div className="flex flex-wrap items-center gap-2 pl-3 pt-1">
              <span className="text-[11px] font-semibold text-[#4B6157]">Sachets/day:</span>
              {(
                [
                  { qty: '<=5 sachet/day', label: '≤5 sachet/day', score: 3 },
                  { qty: '5-10 sachet/day', label: '5–10 sachet/day', score: 2 },
                  { qty: '>10 sachet/day', label: '>10 sachet/day', score: 1 },
                  { qty: 'Unwilling', label: 'Unwilling', score: 0 },
                ] as const
              ).map((item) => (
                <button
                  key={item.qty}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      tobaccoQuantity: prev.tobaccoQuantity === item.qty ? '' : item.qty,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 ${
                    crf.tobaccoQuantity === item.qty
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-[#F6F9F7] border-[#DDE8E2] text-[#14201B] hover:bg-[#EFF5F1]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      crf.tobaccoQuantity === item.qty ? 'text-emerald-100' : 'text-[#4B6157]'
                    }`}
                  >
                    ({item.score})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Alcohol */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Alcohol Intake (Domain H)
            </label>
            <div className="flex gap-2">
              {(
                [
                  { alc: 'No', score: 5 },
                  { alc: 'Occasionally', score: 3 },
                  { alc: 'Yes', score: 1 },
                ] as const
              ).map((item) => (
                <button
                  key={item.alc}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      alcoholIntake: prev.alcoholIntake === item.alc ? '' : item.alc,
                    }))
                  }
                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 ${
                    crf.alcoholIntake === item.alc
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                  }`}
                >
                  <span>{item.alc}</span>
                  <span
                    className={`font-mono text-[11px] font-bold ${
                      crf.alcoholIntake === item.alc ? 'text-emerald-100' : 'text-[#4B6157]'
                    }`}
                  >
                    ({item.score})
                  </span>
                </button>
              ))}
            </div>
          </div>
          {crf.alcoholIntake === 'Yes' && (
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#4B6157] mb-1">
                Alcohol Frequency / Quantity
              </label>
              <input
                type="text"
                value={crf.alcoholNotes}
                onChange={(e) => onChange((prev) => ({ ...prev, alcoholNotes: e.target.value }))}
                placeholder="Units per week / duration"
                aria-label="Alcohol Frequency or Quantity"
                className="w-full px-3 py-2 border border-[#DDE8E2] rounded-xl text-sm"
              />
            </div>
          )}
        </div>

        {/* Physical Activity (Domain E) */}
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
            Physical Activity Level (auto-fills Blue Index Domain E)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(
              [
                { val: '>=150 min/week', title: '≥150 min/week', sub: '5 · Fully adherent' },
                { val: '90-149 min/week', title: '90–149 min/week', sub: '4 · Mostly adherent' },
                { val: '30-89 min/week', title: '30–89 min/week', sub: '3 · Partially adherent' },
                { val: 'Minimal', title: 'Minimal', sub: '2 · Mostly non-adh.' },
                { val: 'Sedentary', title: 'Sedentary', sub: '1 · Totally non-adh.' },
                { val: 'Unwilling/Bedridden', title: 'Unwilling / bedridden', sub: '0 · Unwilling' },
              ] as const
            ).map((act) => (
              <button
                key={act.val}
                type="button"
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    physicalActivity: prev.physicalActivity === act.val ? '' : act.val,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left ${
                  crf.physicalActivity === act.val
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{act.title}</div>
                <div
                  className={`text-[11px] font-mono mt-1 ${
                    crf.physicalActivity === act.val ? 'text-emerald-100' : 'text-[#4B6157]'
                  }`}
                >
                  {act.sub}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Follow-up & Compliance (Domain F) */}
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
            Follow-up &amp; Compliance (auto-fills Blue Index Domain F)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { s: 5, title: '5 · Fully adherent', desc: 'Visits & Rx on schedule' },
              { s: 4, title: '4 · Mostly adherent', desc: 'Minor delay' },
              { s: 3, title: '3 · Partially adherent', desc: 'Missed doses' },
              { s: 2, title: '2 · Mostly non-adherent', desc: 'Frequent gaps' },
              { s: 1, title: '1 · Totally non-adherent', desc: 'Irregular care' },
              { s: 0, title: '0 · Defaulter', desc: 'Lost to care' },
            ].map((item) => (
              <button
                key={item.s}
                type="button"
                aria-label={`Follow-up score ${item.s}: ${item.title} ${item.desc}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    followUpRegularityScore:
                      prev.followUpRegularityScore === item.s ? null : item.s,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left ${
                  crf.followUpRegularityScore === item.s
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{item.title}</div>
                <div
                  className={`text-[11px] mt-1 leading-tight ${
                    crf.followUpRegularityScore === item.s ? 'text-emerald-100' : 'text-[#4B6157]'
                  }`}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Diet Adherence 0..5 (Domain D) */}
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
            Diet Adherence — MNT &amp; Carbohydrate Limits (auto-fills Blue Index Domain D)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { s: 5, title: '5 · Fully adherent', desc: 'Adherent to meal plan' },
              { s: 4, title: '4 · Mostly adherent', desc: 'Infrequent lapses' },
              { s: 3, title: '3 · Partially adherent', desc: 'Partial regimen' },
              { s: 2, title: '2 · Mostly non-adherent', desc: 'Frequent deviation' },
              { s: 1, title: '1 · Totally non-adherent', desc: 'No meal plan' },
              { s: 0, title: '0 · Unwilling / defiant', desc: 'Defiant to diet' },
            ].map((item) => (
              <button
                key={item.s}
                type="button"
                aria-label={`Diet adherence score ${item.s}: ${item.title} ${item.desc}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    dietAdherenceScore: prev.dietAdherenceScore === item.s ? null : item.s,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left ${
                  crf.dietAdherenceScore === item.s
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{item.title}</div>
                <div
                  className={`text-[11px] mt-1 leading-tight ${
                    crf.dietAdherenceScore === item.s ? 'text-emerald-100' : 'text-[#4B6157]'
                  }`}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Vaccination & Infection Prevention (Domain I) */}
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
            Vaccination &amp; Infection Prevention (auto-fills Blue Index Domain I)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { s: 5, title: '5 · Fully vaccinated', desc: 'Zero infection' },
              { s: 4, title: '4 · Partially vaccinated', desc: 'Zero infection' },
              { s: 3, title: '3 · Unvaccinated', desc: 'Zero infection' },
              { s: 2, title: '2 · Vaccinated', desc: '1 mild infection/yr' },
              { s: 1, title: '1 · Recurrent minor', desc: 'Recurrent non-severe' },
              { s: 0, title: '0 · Severe / Sepsis', desc: 'Recurrent severe' },
            ].map((item) => (
              <button
                key={item.s}
                type="button"
                aria-label={`Vaccination score ${item.s}: ${item.title} ${item.desc}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    vaccinationScore: prev.vaccinationScore === item.s ? null : item.s,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left ${
                  crf.vaccinationScore === item.s
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{item.title}</div>
                <div
                  className={`text-[11px] mt-1 leading-tight ${
                    crf.vaccinationScore === item.s ? 'text-emerald-100' : 'text-[#4B6157]'
                  }`}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* General Health & Comorbidity (Domain G) */}
        <div>
          <label className="block text-xs font-medium text-[#4B6157] mb-1.5">
            General Health &amp; Comorbidity Burden (auto-fills Blue Index Domain G)
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { s: 5, title: '5 · No comorbidities', desc: 'Normal BMI' },
              { s: 4, title: '4 · 1 mild stable', desc: 'Mild comorbidity' },
              { s: 3, title: '3 · 2 stable', desc: 'Stable comorbidities' },
              { s: 2, title: '2 · Multiple moderate', desc: 'Moderate burden' },
              { s: 1, title: '1 · 1 severe', desc: 'Severe comorbidity' },
              { s: 0, title: '0 · End-stage failure', desc: 'Non-DM organ failure' },
            ].map((item) => (
              <button
                key={item.s}
                type="button"
                aria-label={`Comorbidity score ${item.s}: ${item.title} ${item.desc}`}
                onClick={() =>
                  onChange((prev) => ({
                    ...prev,
                    comorbidityScore: prev.comorbidityScore === item.s ? null : item.s,
                  }))
                }
                className={`p-2.5 rounded-xl border text-left ${
                  crf.comorbidityScore === item.s
                    ? 'bg-[#047857] text-white border-[#047857]'
                    : 'bg-white border-[#DDE8E2] text-[#14201B] hover:bg-[#F6F9F7]'
                }`}
              >
                <div className="text-xs font-semibold leading-tight">{item.title}</div>
                <div
                  className={`text-[11px] mt-1 leading-tight ${
                    crf.comorbidityScore === item.s ? 'text-emerald-100' : 'text-[#4B6157]'
                  }`}
                >
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Extra Foot Ulcer & Amputation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[#EEF3F0]">
          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">Foot Ulcers</label>
            <div className="flex flex-wrap items-center gap-2">
              {(['No', 'Yes'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() =>
                    onChange((prev) => {
                      const nextU = prev.footUlcer === u ? '' : u;
                      return {
                        ...prev,
                        footUlcer: nextU,
                        footUlcerState: nextU === 'Yes' ? prev.footUlcerState : '',
                      };
                    })
                  }
                  className={`px-3.5 py-2 rounded-xl border text-xs font-medium ${
                    crf.footUlcer === u
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white border-[#DDE8E2] text-[#14201B]'
                  }`}
                >
                  {u}
                </button>
              ))}
              {crf.footUlcer === 'Yes' &&
                (['Active', 'Present in Past'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      onChange((prev) => ({
                        ...prev,
                        footUlcerState: prev.footUlcerState === st ? '' : st,
                      }))
                    }
                    className={`px-3 py-2 rounded-xl border text-xs font-medium ${
                      crf.footUlcerState === st
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 border-amber-200 text-amber-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4B6157] mb-1">
              Amputation of Foot
            </label>
            <div className="flex gap-2">
              {(['No', 'Yes'] as const).map((amp) => (
                <button
                  key={amp}
                  type="button"
                  onClick={() =>
                    onChange((prev) => ({
                      ...prev,
                      footAmputation: prev.footAmputation === amp ? '' : amp,
                    }))
                  }
                  className={`px-4 py-2 rounded-xl border text-xs font-medium ${
                    crf.footAmputation === amp
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-white border-[#DDE8E2] text-[#14201B]'
                  }`}
                >
                  {amp}
                </button>
              ))}
            </div>
          </div>
        </div>

        <SectionAttachmentBar
          sectionKey="sectionC"
          sectionLabel="Social & Lifestyle"
          attachments={crf.attachments}
          onAddAttachment={onAddAttachment}
          onRemoveAttachment={onRemoveAttachment}
          onAIExtract={onAIExtract}
          aiBusy={aiBusy}
        />
      </section>
    </div>
  );
};
