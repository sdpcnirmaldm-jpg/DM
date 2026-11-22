import React from 'react';
import type { DHSDomains } from '../../types/clinical';

export const NAVY_TH =
  'bg-[#15345B] text-white font-semibold text-left px-2 py-1.5 border border-[#15345B] text-[11px] leading-tight';

export const CELL_TD =
  'border border-[#94A3B8] px-2 py-1.5 text-[11.5px] leading-snug text-[#0F172A] align-middle';

export const LABEL_TD =
  'border border-[#94A3B8] px-2 py-1.5 text-[11.5px] leading-snug font-medium text-[#0F172A] bg-[#F8FAFC] align-middle';

export const CrfPageSheet: React.FC<{
  pageNumber: number;
  isLast?: boolean;
  children: React.ReactNode;
}> = ({ pageNumber, isLast = false, children }) => (
  <div
    data-testid={`crf-page-${pageNumber}`}
    className={`crf-page bg-white border border-[#CBD5E1] shadow-sm px-5 py-6 sm:px-7 sm:py-7 text-[#0F172A] ${
      !isLast ? 'crf-page-break' : ''
    }`}
  >
    <div className="min-w-[680px] space-y-3.5">{children}</div>
  </div>
);

export const CrfSectionHeading: React.FC<{
  children: React.ReactNode;
  rightText?: string;
}> = ({ children, rightText }) => (
  <div className="flex flex-wrap items-baseline justify-between gap-2 pt-1">
    <h2 className="text-[12.5px] font-bold uppercase tracking-wide text-[#15345B]">
      {children}
    </h2>
    {rightText ? (
      <span className="text-[11px] font-semibold text-[#15345B]">{rightText}</span>
    ) : null}
  </div>
);

export const CrfCheckBox: React.FC<{
  checked: boolean;
  label: string;
}> = ({ checked, label }) => (
  <span className="inline-flex items-center gap-1 mr-2.5 whitespace-nowrap">
    <span
      className={`inline-flex items-center justify-center w-3.5 h-3.5 border text-[10px] leading-none font-bold ${
        checked
          ? 'border-[#15345B] bg-[#15345B] text-white'
          : 'border-[#475569] bg-white text-transparent'
      }`}
      aria-hidden="true"
    >
      {checked ? '✓' : '·'}
    </span>
    <span className={checked ? 'font-semibold text-[#0F172A]' : 'text-[#334155]'}>
      {label}
    </span>
  </span>
);

export const FillBlank: React.FC<{
  value: string | number | null | undefined;
  suffix?: string;
  placeholderLine?: string;
}> = ({ value, suffix, placeholderLine = '________________' }) => {
  const hasVal = value !== null && value !== undefined && String(value).trim() !== '';
  return hasVal ? (
    <span className="font-mono font-semibold text-[#0F172A] underline decoration-[#94A3B8] decoration-dotted underline-offset-2">
      {value}
      {suffix ? ` ${suffix}` : ''}
    </span>
  ) : (
    <span className="font-mono text-[#94A3B8] select-none">
      {placeholderLine}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
};

export const RETINOPATHY_ROWS = [
  { score: 0, finding: 'Normal fundus (No diabetic retinopathy detected)' },
  { score: 1, finding: 'No visual complaints, screening incomplete' },
  { score: 2, finding: 'Mild-to-moderate NPDR' },
  { score: 3, finding: 'Severe NPDR without Macular Edema' },
  { score: 4, finding: 'Proliferative Diabetic Retinopathy (PDR) or CSME' },
  { score: 5, finding: 'Advanced diabetic eye disease / Vitreous hemorrhage / Blindness' },
];

export const NEPHROPATHY_ROWS = [
  { score: 0, category: 'eGFR ≥90 (Optimally screened) & UACR <30 mg/g' },
  { score: 1, category: 'eGFR >60 / UACR <30 (Incompletely screened)' },
  { score: 2, category: 'eGFR 60–89 (Mild decline) or UACR 30–299 mg/g (Microalbuminuria)' },
  { score: 3, category: 'eGFR 30–59 (CKD Stage G3) or UACR ≥300 mg/g (Macroalbuminuria)' },
  { score: 4, category: 'eGFR 15–29 (CKD Stage G4) or UACR >300 with active decline' },
  { score: 5, category: 'eGFR <15 / RRT / Dialysis (ESRD) or Nephrotic range proteinuria' },
];

export const BLUE_INDEX_RUBRIC: Array<{
  key: keyof DHSDomains;
  domain: string;
  criteria: string;
}> = [
  {
    key: 'A',
    domain: '(A) Average Blood Sugar (HbA1c)',
    criteria:
      '5=At/below target (≤7.0%); 4=0.1–0.5% above; 3=0.6–1.0% above; 2=1.1–2.0% above; 1=2.1–4.0% off; 0=>4.0% off (>11.0%)',
  },
  {
    key: 'B',
    domain: '(B) Blood Pressure (130/80 mmHg)',
    criteria:
      '5=Normotensive without meds; 4=At target with anti-HTN meds; 3=SBP 0–10 / DBP 0–5 above; 2=11–20 / 6–10 above; 1=21–40 / 11–20 above; 0=SBP >40 or DBP >20 above',
  },
  {
    key: 'C',
    domain: '(C) Lipids: TC, LDL, non-HDL',
    criteria:
      '5=No dyslipidemia without meds; 4=All 3 at target with statin; 3=1/3 above; 2=2/3 above; 1=All 3 above; 0=TG >500, LDL >190, or non-HDL >220',
  },
  {
    key: 'D',
    domain: '(D) Diet Adherence',
    criteria:
      '5=Fully adherent to meal plan; 4=Mostly adherent (infrequent lapses); 3=Partially adherent; 2=Mostly non-adherent; 1=Totally non-adherent; 0=Unwilling / defiant',
  },
  {
    key: 'E',
    domain: '(E) Exercise / Activity',
    criteria:
      '5=Fully adherent (≥150 min/wk); 4=Mostly (90–149 min/wk); 3=Partially (30–89 min/wk); 2=Mostly non-adherent (minimal); 1=Sedentary; 0=Unwilling / bedridden',
  },
  {
    key: 'F',
    domain: '(F) Follow-up & Compliance',
    criteria:
      '5=Fully adherent to visits & Rx; 4=Mostly adherent (minor delay); 3=Partially adherent (missed doses); 2=Mostly non-adherent; 1=Totally non-adherent; 0=Defaulter / lost to care',
  },
  {
    key: 'G',
    domain: '(G) General Health & Comorbidity',
    criteria:
      '5=No comorbidities (normal BMI); 4=1 mild stable; 3=2 stable; 2=Multiple moderate; 1=1 severe; 0=End-stage non-DM failure',
  },
  {
    key: 'H',
    domain: '(H) Habits (Tobacco, Bidi, Alcohol)',
    criteria:
      '5=Never smoker, no tobacco/alcohol; 4=Ex-smoker / tobacco-free >1 yr; 3=Light (<10 cigs/d; ≤5 sachets); 2=Moderate (10–20 cigs; 5–10 sachets); 1=Heavy (>20 cigs; >10 sachets); 0=Substance abuse / unwilling',
  },
  {
    key: 'I',
    domain: '(I) Infection Prevention',
    criteria:
      '5=Fully vaccinated, zero infection; 4=Partially vaccinated, zero inf; 3=Unvaccinated, zero inf; 2=Vaccinated, 1 mild inf/yr; 1=Recurrent non-severe inf; 0=Recurrent severe / sepsis',
  },
  {
    key: 'J',
    domain: '(J) Jeopardy (Hypoglycemia / ADR)',
    criteria:
      '5=No hypoglycemia, zero ADR; 4=Level 1 asymptomatic (<70 mg/dL); 3=Level 1 symptomatic (managed); 2=Level 2 (<54 mg/dL), no LOC; 1=Level 3 (severe, no LOC); 0=Recurrent Level 3 or LOC',
  },
];

export const DDS17_PDF_QUESTIONS = [
  '1. I feel that diabetes takes too much of my mental and physical energy every day.',
  '2. I feel that my doctor does not know enough about diabetes and its treatment.',
  '3. I feel angry, afraid, or depressed when I think about living with diabetes.',
  '4. I feel that my doctor does not explain clearly enough how I should manage my diabetes.',
  '5. I feel that I do not check my blood sugar often enough.',
  '6. I feel that I often fail to follow my diabetes routine properly.',
  '7. I feel that my friends or family do not support me enough in managing my diabetes.',
  '8. I feel that diabetes controls my life.',
  '9. I feel that my doctor does not take my concerns seriously enough.',
  '10. I feel that I cannot see a doctor regularly enough for my diabetes.',
  '11. I feel that I am not following a healthy meal plan properly.',
  '12. I feel that my family or friends do not understand how difficult it is to live with diabetes.',
  '13. I feel that diabetes takes too much of my time, mental energy, and physical energy.',
  '14. I feel stressed or overwhelmed by the responsibilities of living with diabetes.',
  '15. I feel that I do not have clear goals for taking care of my diabetes.',
  '16. I feel that I am not following my diabetes treatment properly.',
  '17. I feel that I do not get enough support from my family and friends to manage my diabetes.',
];
