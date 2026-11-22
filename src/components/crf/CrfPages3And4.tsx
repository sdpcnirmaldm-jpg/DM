import React from 'react';
import type { ClusterType, PatientCRF } from '../../types/clinical';
import { deriveNephropathyTier, formatCrfQueriesSummary } from '../../utils/crfFormHelpers';
import {
  BLUE_INDEX_RUBRIC,
  CELL_TD,
  CrfCheckBox,
  CrfPageSheet,
  CrfSectionHeading,
  DDS17_PDF_QUESTIONS,
  FillBlank,
  LABEL_TD,
  NAVY_TH,
  NEPHROPATHY_ROWS,
  RETINOPATHY_ROWS,
} from './CrfFormPrimitives';

interface CrfPages3And4Props {
  patient: PatientCRF;
  blankMode: boolean;
  inlineEditing: boolean;
  draftCluster: ClusterType | '';
  onDraftClusterChange: (cluster: ClusterType | '') => void;
}

const ALL_CLUSTERS: ClusterType[] = ['SIDD', 'SIRD', 'CIRDD', 'MARD'];

export const CrfPages3And4: React.FC<CrfPages3And4Props> = ({
  patient,
  blankMode,
  inlineEditing,
  draftCluster,
  onDraftClusterChange,
}) => {
  const nephropathyTier = blankMode ? null : deriveNephropathyTier(patient);
  const retinopathyTier = blankMode ? null : patient.ksMicroRetinopathyTier;
  const queries = blankMode
    ? { isComplete: false, summaryText: '' }
    : formatCrfQueriesSummary(patient);

  const neuroAbnormalByScore = !blankMode && (patient.ksFootNeuropathy ?? 0) >= 1;
  const macroPresentByScore = !blankMode && (patient.ksMacrovascular ?? 0) >= 1;

  const monofilamentAbnormal =
    !blankMode &&
    (patient.neuroMonofilament === 'Abnormal' ||
      (!patient.neuroMonofilament && neuroAbnormalByScore));
  const monofilamentNormal =
    !blankMode &&
    (patient.neuroMonofilament === 'Normal' ||
      (!patient.neuroMonofilament && patient.ksFootNeuropathy === 0));

  const vibrationAbnormal = !blankMode && patient.neuroVibration === 'Abnormal';
  const vibrationNormal =
    !blankMode &&
    (patient.neuroVibration === 'Normal' ||
      (!patient.neuroVibration && patient.ksFootNeuropathy === 0));

  const abiAbnormal = !blankMode && patient.neuroAbi === 'Abnormal';
  const abiNormal =
    !blankMode &&
    (patient.neuroAbi === 'Normal' || (!patient.neuroAbi && patient.ksFootNeuropathy === 0));

  const cadPresent =
    !blankMode &&
    (patient.macroCad === 'Present' || (!patient.macroCad && macroPresentByScore));
  const cadAbsent =
    !blankMode &&
    (patient.macroCad === 'Absent' ||
      (!patient.macroCad && patient.ksMacrovascular === 0));

  const strokePresent = !blankMode && patient.macroStroke === 'Present';
  const strokeAbsent =
    !blankMode &&
    (patient.macroStroke === 'Absent' ||
      (!patient.macroStroke && patient.ksMacrovascular === 0));

  const padPresent = !blankMode && patient.macroPad === 'Present';
  const padAbsent =
    !blankMode &&
    (patient.macroPad === 'Absent' ||
      (!patient.macroPad && patient.ksMacrovascular === 0));

  const otherVascPresent = !blankMode && patient.macroOther === 'Present';
  const otherVascAbsent =
    !blankMode &&
    (patient.macroOther === 'Absent' ||
      (!patient.macroOther && patient.ksMacrovascular === 0));

  return (
    <div className="space-y-6">
      {/* =================================================================== */}
      {/* PAGE 3: SECTIONS 11 & 12                                            */}
      {/* =================================================================== */}
      <CrfPageSheet pageNumber={3}>
        {/* 11. KNOWN SEVERITY (KS) */}
        <CrfSectionHeading
          rightText={`KS score: ${
            !blankMode && patient.ksTotal !== null ? `${patient.ksTotal} / 15` : '_________'
          }`}
        >
          11. KNOWN SEVERITY (KS) - MICROVASCULAR &amp; MACROVASCULAR COMPLICATIONS
        </CrfSectionHeading>

        {/* Top Side-by-Side Table: 10.1 Retinopathy + 10.2 Nephropathy */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[7%] text-center`}>Score</th>
              <th className={`${NAVY_TH} w-[33%]`}>10.1 Diabetic Retinopathy Finding</th>
              <th className={`${NAVY_TH} w-[9%] text-center`}>Status</th>
              <th className={`${NAVY_TH} w-[7%] text-center`}>Score</th>
              <th className={`${NAVY_TH} w-[35%]`}>10.2 Diabetic Nephropathy / Category</th>
              <th className={`${NAVY_TH} w-[9%] text-center`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {RETINOPATHY_ROWS.map((retRow, idx) => {
              const nephRow = NEPHROPATHY_ROWS[idx];
              const retChecked = retinopathyTier === retRow.score;
              const nephChecked = nephropathyTier === nephRow.score;
              return (
                <tr key={retRow.score}>
                  <td className={`${CELL_TD} text-center font-mono font-semibold`}>
                    {retRow.score}
                  </td>
                  <td className={CELL_TD}>{retRow.finding}</td>
                  <td className={`${CELL_TD} text-center`}>
                    <CrfCheckBox checked={retChecked} label="" />
                  </td>
                  <td className={`${CELL_TD} text-center font-mono font-semibold`}>
                    {nephRow.score}
                  </td>
                  <td className={CELL_TD}>{nephRow.category}</td>
                  <td className={`${CELL_TD} text-center`}>
                    <CrfCheckBox checked={nephChecked} label="" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Bottom Side-by-Side Table: 10.3 Neuropathy / Foot Exam + 10.4 Macrovascular */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[21%]`}>10.3 Neuropathy / Foot Exam</th>
              <th className={`${NAVY_TH} w-[28%]`}>Status / Finding</th>
              <th className={`${NAVY_TH} w-[23%]`}>10.4 Macrovascular Complication</th>
              <th className={`${NAVY_TH} w-[28%]`}>Details / Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={LABEL_TD}>10-g monofilament</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={monofilamentNormal} label="Normal" />
                <CrfCheckBox checked={monofilamentAbnormal} label="Abnormal" />
              </td>
              <td className={LABEL_TD}>CAD / Angina / Prev MI</td>
              <td className={CELL_TD}>
                <div>
                  <CrfCheckBox checked={cadPresent} label="Present" />
                  <CrfCheckBox checked={cadAbsent} label="Absent" />
                </div>
                <div className="mt-0.5 text-[10.5px]">
                  Status:{' '}
                  <FillBlank
                    value={blankMode ? '' : patient.macroCadDetails}
                    placeholderLine="________________"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Vibration (128-Hz)</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={vibrationNormal} label="Normal" />
                <CrfCheckBox checked={vibrationAbnormal} label="Abnormal" />
              </td>
              <td className={LABEL_TD}>Stroke / TIA</td>
              <td className={CELL_TD}>
                <div>
                  <CrfCheckBox checked={strokePresent} label="Present" />
                  <CrfCheckBox checked={strokeAbsent} label="Absent" />
                </div>
                <div className="mt-0.5 text-[10.5px]">
                  Date/details:{' '}
                  <FillBlank
                    value={blankMode ? '' : patient.macroStrokeDetails}
                    placeholderLine="___________"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>ABI</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={abiNormal} label="Normal" />
                <CrfCheckBox checked={abiAbnormal} label="Abnormal" />
              </td>
              <td className={LABEL_TD}>Peripheral Arterial (PAD)</td>
              <td className={CELL_TD}>
                <div>
                  <CrfCheckBox checked={padPresent} label="Present" />
                  <CrfCheckBox checked={padAbsent} label="Absent" />
                </div>
                <div className="mt-0.5 text-[10.5px]">
                  Details:{' '}
                  <FillBlank
                    value={blankMode ? '' : patient.macroPadDetails}
                    placeholderLine="_______________"
                  />
                </div>
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Foot ulcer</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={!blankMode && patient.footUlcer === 'Yes'} label="Present" />
                <CrfCheckBox checked={!blankMode && patient.footUlcer === 'No'} label="Absent" />
              </td>
              <td className={LABEL_TD}>Other Vascular</td>
              <td className={CELL_TD}>
                <CrfCheckBox checked={otherVascPresent} label="Present" />
                <CrfCheckBox checked={otherVascAbsent} label="Absent" />
              </td>
            </tr>
            <tr>
              <td className={LABEL_TD}>Amputations</td>
              <td className={CELL_TD}>
                <CrfCheckBox
                  checked={!blankMode && patient.footAmputation === 'Yes'}
                  label="Present"
                />
                <CrfCheckBox
                  checked={!blankMode && patient.footAmputation === 'No'}
                  label="Absent"
                />
              </td>
              <td className={LABEL_TD}>KS Component Summary</td>
              <td className={`${CELL_TD} font-mono text-[10.5px]`}>
                {!blankMode
                  ? `C=${patient.ksMacrovascular ?? '—'} · M=${patient.ksMicrovascular ?? '—'} · F=${patient.ksFootNeuropathy ?? '—'}`
                  : 'C=___ · M=___ · F=___'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 12. STRUCTURE OF THE BLUE INDEX ASSESSMENT (DHS & KS SCORE) */}
        <CrfSectionHeading
          rightText={`Blue Index Ratio: ${
            !blankMode ? patient.blueIndexRatio || '—' : '________'
          }`}
        >
          12. STRUCTURE OF THE BLUE INDEX ASSESSMENT (DHS &amp; KS SCORE):
        </CrfSectionHeading>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[25%]`}>Domain</th>
              <th className={`${NAVY_TH} w-[64%]`}>Scoring Criteria (0–5 Points per Domain)</th>
              <th className={`${NAVY_TH} w-[11%] text-center`}>Score</th>
            </tr>
          </thead>
          <tbody>
            {BLUE_INDEX_RUBRIC.map((row) => {
              const scoreVal = blankMode ? null : patient.dhsDomains[row.key];
              return (
                <tr key={row.key}>
                  <td className={LABEL_TD}>{row.domain}</td>
                  <td className={`${CELL_TD} text-[10.5px]`}>{row.criteria}</td>
                  <td className={`${CELL_TD} text-center font-mono font-semibold`}>
                    {scoreVal !== null ? `${scoreVal} / 5` : '___ / 5'}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className={`${LABEL_TD} font-bold`}>TOTAL DHS SCORE (A to J)</td>
              <td className={CELL_TD}>
                <span className="font-medium mr-2">Categorization:</span>
                <CrfCheckBox
                  checked={!blankMode && patient.dhsCategory === 'Excellent Status'}
                  label="Excellent DHS (>45)"
                />
                <CrfCheckBox
                  checked={!blankMode && patient.dhsCategory === 'Moderate Status'}
                  label="Moderate DHS (35–45)"
                />
                <CrfCheckBox
                  checked={!blankMode && patient.dhsCategory === 'Undesirable Status'}
                  label="Undesirable / Poor DHS (<35)"
                />
              </td>
              <td className={`${CELL_TD} text-center font-mono font-bold text-[#15345B]`}>
                {!blankMode && patient.dhsTotal !== null ? `${patient.dhsTotal} / 50` : '____ / 50'}
              </td>
            </tr>
          </tbody>
        </table>
      </CrfPageSheet>

      {/* =================================================================== */}
      {/* PAGE 4: SECTIONS 13 TO 15 + DDS-17 MATRIX                           */}
      {/* =================================================================== */}
      <CrfPageSheet pageNumber={4} isLast>
        {/* 13. DDS-17 - DIABETES DISTRESS SCALE SUMMARY */}
        <CrfSectionHeading>13. DDS-17 - DIABETES DISTRESS SCALE:</CrfSectionHeading>
        <div className="border border-[#94A3B8] bg-[#F8FAFC] px-3 py-2 text-[11.5px] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            DDS-17 Total Item Score:{' '}
            <FillBlank
              value={!blankMode ? patient.ddsTotal : null}
              placeholderLine="_____"
            />{' '}
            / 102
          </span>
          <span className="text-[#94A3B8]">|</span>
          <span>
            DDS-17 Mean Score:{' '}
            <FillBlank
              value={!blankMode ? patient.ddsMean : null}
              placeholderLine="_____"
            />{' '}
            / 6
          </span>
          <span className="text-[#94A3B8]">|</span>
          <span className="inline-flex flex-wrap items-center">
            <span className="mr-2 font-medium">Interpretation:</span>
            <CrfCheckBox
              checked={!blankMode && patient.ddsCategory === 'Little or No Distress'}
              label="<2.0 (Little/None)"
            />
            <CrfCheckBox
              checked={!blankMode && patient.ddsCategory === 'Moderate Distress'}
              label="2.0–2.9 (Moderate)"
            />
            <CrfCheckBox
              checked={!blankMode && patient.ddsCategory === 'High Distress'}
              label="≥3.0 (High)"
            />
          </span>
        </div>

        {/* 14. FINAL PHENOTYPIC SUBCLASSIFICATION & STUDY OUTPUTS */}
        <CrfSectionHeading>
          14. FINAL PHENOTYPIC SUBCLASSIFICATION &amp; STUDY OUTPUTS
        </CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${CELL_TD} py-2`}>
                <div className="text-[11.5px] font-semibold mb-1.5 text-[#15345B]">
                  Phenotypic Subclassification
                </div>
                {inlineEditing && !blankMode ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="crf-inline-cluster" className="text-xs font-medium">
                      Assigned Cluster:
                    </label>
                    <select
                      id="crf-inline-cluster"
                      value={draftCluster}
                      onChange={(e) => onDraftClusterChange(e.target.value as ClusterType | '')}
                      className="px-2.5 py-1 border border-[#047857] rounded text-xs font-mono font-bold"
                    >
                      <option value="">— Unassigned —</option>
                      {ALL_CLUSTERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      {ALL_CLUSTERS.map((cluster) => (
                        <CrfCheckBox
                          key={cluster}
                          checked={!blankMode && patient.clusterType === cluster}
                          label={cluster}
                        />
                      ))}
                    </div>
                    {!blankMode && (
                      <span className="font-mono text-[10.5px] text-[#475569]">
                        Model Suggested: <strong>{patient.suggestedCluster || '—'}</strong>
                      </span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 15. INVESTIGATOR / DATA COLLECTOR VERIFICATION */}
        <CrfSectionHeading>15. INVESTIGATOR / DATA COLLECTOR VERIFICATION</CrfSectionHeading>
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${CELL_TD} w-[50%]`}>
                Date:{' '}
                <FillBlank
                  value={
                    !blankMode
                      ? (patient.verifiedAt ? patient.verifiedAt.slice(0, 10) : patient.dateOfRecruitment)
                      : ''
                  }
                  placeholderLine="____ / ____ / ________"
                />
              </td>
              <td className={`${CELL_TD} w-[50%]`}>
                CRF Complete Status:{' '}
                <CrfCheckBox checked={!blankMode && queries.isComplete} label="Yes" />
              </td>
            </tr>
            <tr>
              <td className={CELL_TD}>
                Name of Investigator / Data Collector:{' '}
                <FillBlank
                  value={!blankMode ? patient.investigatorName || '' : ''}
                  placeholderLine="________________________"
                />
              </td>
              <td className={CELL_TD}>
                Signature:{' '}
                <FillBlank
                  value={
                    !blankMode && patient.investigatorEmail
                      ? patient.investigatorEmail
                      : ''
                  }
                  placeholderLine="________________________________"
                />
              </td>
            </tr>
            <tr>
              <td className={`${CELL_TD} align-top`} colSpan={2}>
                <div className="font-medium text-[#15345B]">Queries / Missing Data:</div>
                <div className="mt-1 min-h-[28px] text-[11px] text-[#334155]">
                  {blankMode ? '' : queries.summaryText}
                </div>
              </td>
            </tr>
            <tr>
              <td className={CELL_TD} colSpan={2}>
                2nd visit date:{' '}
                <FillBlank
                  value={
                    !blankMode ? patient.followUpDate || patient.hba1c2.date || '' : ''
                  }
                  placeholderLine="____ / ____ / ________"
                />
              </td>
            </tr>
          </tbody>
        </table>

        {/* DDS-17 FULL 17-ITEM MATRIX TABLE */}
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={`${NAVY_TH} w-[48%]`}>Questions</th>
              <th className={`${NAVY_TH} w-[8.6%] text-center`}>
                Not a Problem (1)
              </th>
              <th className={`${NAVY_TH} w-[8.6%] text-center`}>
                Slight Problem (2)
              </th>
              <th className={`${NAVY_TH} w-[8.6%] text-center`}>
                Moderate Problem (3)
              </th>
              <th className={`${NAVY_TH} w-[8.8%] text-center`}>
                Somewhat Serious (4)
              </th>
              <th className={`${NAVY_TH} w-[8.6%] text-center`}>
                Serious Problem (5)
              </th>
              <th className={`${NAVY_TH} w-[8.8%] text-center`}>
                Very Serious Problem (6)
              </th>
            </tr>
          </thead>
          <tbody>
            {DDS17_PDF_QUESTIONS.map((question, qIdx) => {
              const selectedScore = blankMode ? null : patient.ddsItems[qIdx];
              return (
                <tr key={qIdx} className={qIdx % 2 === 1 ? 'bg-[#F8FAFC]' : 'bg-white'}>
                  <td className={`${CELL_TD} text-[11px]`}>{question}</td>
                  {[1, 2, 3, 4, 5, 6].map((scoreOpt) => {
                    const isSelected = selectedScore === scoreOpt;
                    return (
                      <td
                        key={scoreOpt}
                        className={`${CELL_TD} text-center font-mono text-[11px] ${
                          isSelected ? 'bg-[#DBEAFE] font-bold text-[#15345B]' : ''
                        }`}
                      >
                        {scoreOpt}[{isSelected ? '✓' : ' '}]
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </CrfPageSheet>
    </div>
  );
};
