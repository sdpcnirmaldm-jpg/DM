import React from 'react';
import type { AttachmentFile, PatientCRF } from '../../types/clinical';
import { SectionAttachmentBar } from './SectionAttachmentBar';

interface Dds17TabProps {
  crf: PatientCRF;
  onChange: (updater: (prev: PatientCRF) => PatientCRF) => void;
  onAddAttachment: (file: AttachmentFile) => void;
  onRemoveAttachment: (id: string) => void;
}

const DDS17_QUESTIONS = [
  '1. Feeling that diabetes is taking up too much of my mental and physical energy every day.',
  '2. Feeling that my doctor does not know enough about diabetes and diabetes care.',
  '3. Feeling angry, scared, and/or depressed when I think about living with diabetes.',
  '4. Feeling that my doctor does not give me clear enough directions on how to manage my diabetes.',
  '5. Feeling that I am not testing my blood sugars frequently enough.',
  '6. Feeling that I am often failing with my diabetes routine.',
  '7. Feeling that friends or family are not supportive enough of self-care efforts.',
  '8. Feeling that diabetes controls my life.',
  '9. Feeling that my doctor does not take my concerns seriously enough.',
  '10. Not feeling confident in my day-to-day ability to manage diabetes.',
  '11. Feeling that I will end up with serious long-term complications, no matter what I do.',
  '12. Feeling that I am not sticking closely enough to a good meal plan.',
  '13. Feeling that friends or family do not appreciate how difficult living with diabetes can be.',
  '14. Feeling overwhelmed by the demands of living with diabetes.',
  '15. Feeling that I do not have a doctor who I can see regularly enough about my diabetes.',
  '16. Not feeling motivated to keep up my diabetes self-management.',
  '17. Feeling that friends or family do not give me the emotional support that I would like.',
];

export const Dds17Tab: React.FC<Dds17TabProps> = ({
  crf,
  onChange,
  onAddAttachment,
  onRemoveAttachment,
}) => {
  return (
    <section
      id="section-dds17"
      className="bg-white border border-[#DDE8E2] rounded-2xl p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold text-[#14201B]">
            DDS-17 (Diabetes Distress Scale)
          </h3>
          <p className="text-xs text-[#4B6157]">
            Rate each item from 1 (Not a problem) to 6 (A very serious problem).
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange((prev) => ({ ...prev, ddsItems: Array(17).fill(1) }))}
          className="px-3 py-1.5 rounded-lg border border-[#DDE8E2] bg-[#F6F9F7] hover:bg-[#EFF5F1] text-xs font-medium text-[#14201B]"
        >
          Set All to 1 (No Distress)
        </button>
      </div>

      <div className="divide-y divide-[#EEF3F0] border border-[#DDE8E2] rounded-xl overflow-hidden">
        {DDS17_QUESTIONS.map((q, idx) => (
          <div
            key={idx}
            className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white"
          >
            <span className="text-xs sm:text-sm text-[#14201B]">{q}</span>
            <div className="flex items-center gap-1 shrink-0">
              {[1, 2, 3, 4, 5, 6].map((score) => (
                <button
                  key={score}
                  type="button"
                  onClick={() =>
                    onChange((prev) => {
                      const next = [...prev.ddsItems];
                      next[idx] = prev.ddsItems[idx] === score ? null : score;
                      return { ...prev, ddsItems: next };
                    })
                  }
                  className={`w-8 h-8 rounded-lg border text-xs font-mono font-semibold transition-colors ${
                    crf.ddsItems[idx] === score
                      ? 'bg-[#047857] text-white border-[#047857]'
                      : 'bg-[#F6F9F7] border-[#DDE8E2] text-[#4B6157] hover:bg-[#EFF5F1]'
                  }`}
                >
                  {score}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 bg-[#F6F9F7] border border-[#DDE8E2] rounded-xl p-3 text-center">
        <div>
          <div className="text-[11px] text-[#4B6157]">Total / 102</div>
          <div className="font-mono text-sm font-bold text-[#14201B]">
            {crf.ddsTotal ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#4B6157]">Mean / 6</div>
          <div className="font-mono text-sm font-bold text-[#047857]">
            {crf.ddsMean ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#4B6157]">Emotional Burden</div>
          <div className="font-mono text-sm font-bold text-[#14201B]">
            {crf.ddsEmotionalBurden ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#4B6157]">Physician Distress</div>
          <div className="font-mono text-sm font-bold text-[#14201B]">
            {crf.ddsPhysicianDistress ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#4B6157]">Regimen Distress</div>
          <div className="font-mono text-sm font-bold text-[#14201B]">
            {crf.ddsRegimenDistress ?? '—'}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#4B6157]">Interpersonal</div>
          <div className="font-mono text-sm font-bold text-[#14201B]">
            {crf.ddsInterpersonalDistress ?? '—'}
          </div>
        </div>
      </div>

      {crf.ddsCategory && (
        <div className="text-xs font-semibold text-[#053B2B]">
          DDS-17 Category: {crf.ddsCategory}
        </div>
      )}

      <SectionAttachmentBar
        sectionKey="sectionF"
        sectionLabel="DDS-17 Scale"
        attachments={crf.attachments}
        onAddAttachment={onAddAttachment}
        onRemoveAttachment={onRemoveAttachment}
      />
    </section>
  );
};
