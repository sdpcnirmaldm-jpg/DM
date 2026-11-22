export interface InitialDashboardCalendarState {
  calYear: number;
  calMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  todayIso: string;
  selectedDate: string;
}

export interface CalendarGridCell {
  day: number | null;
  iso: string | null;
}

/** Formats a Date object as YYYY-MM-DD using local calendar components (avoids UTC day shift). */
export function formatLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Computes initial calendar month, year, and selected date from the current local clock
 * so opening the portal always highlights today's real date and current month.
 */
export function getInitialDashboardCalendarState(
  now: Date = new Date()
): InitialDashboardCalendarState {
  const todayIso = formatLocalIsoDate(now);
  return {
    calYear: now.getFullYear(),
    calMonth: now.getMonth(),
    todayIso,
    selectedDate: todayIso,
  };
}

/** Generates Sunday-first calendar grid cells for the given year and 0-indexed month. */
export function buildMonthCalendarCells(year: number, month: number): CalendarGridCell[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarGridCell[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, iso: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, iso });
  }
  return cells;
}

export function doesPatientMatchDate(
  patient: { dateOfRecruitment?: string; followUpDate?: string },
  isoDate: string
): boolean {
  return patient.dateOfRecruitment === isoDate || patient.followUpDate === isoDate;
}

export type DashboardSideMode = 'patient' | 'followup' | 'pending';

export interface SideQueuePatientLike {
  patient: {
    dateOfRecruitment?: string;
    followUpDate?: string;
    statusColor: string;
  };
  missingFields: Array<{ key: string; label: string }>;
}

/**
 * Computes the right-hand side queue list for the Dashboard.
 * When `filterRegistryByDate` is false (e.g. default Today view where the user hasn't explicitly
 * clicked a calendar date to filter), switching to `pending` or `followup` shows all pending
 * or upcoming follow-up records across the cohort instead of an empty "0 collected today" state.
 */
export function buildDashboardSideQueue<T extends SideQueuePatientLike>(params: {
  items: T[];
  sideMode: DashboardSideMode;
  selectedDate: string | null;
  filterRegistryByDate: boolean;
}): T[] {
  const { items, sideMode, selectedDate, filterRegistryByDate } = params;

  if (sideMode === 'pending') {
    const scope =
      filterRegistryByDate && selectedDate
        ? items.filter(({ patient }) => doesPatientMatchDate(patient, selectedDate))
        : items;
    return [...scope]
      .filter((e) => e.patient.statusColor !== 'green' || e.missingFields.length > 0)
      .sort((a, b) => {
        if (b.missingFields.length !== a.missingFields.length) {
          return b.missingFields.length - a.missingFields.length;
        }
        return (a.patient.followUpDate || '9999-99-99').localeCompare(
          b.patient.followUpDate || '9999-99-99'
        );
      });
  }

  if (sideMode === 'followup') {
    const scope =
      filterRegistryByDate && selectedDate
        ? items.filter(({ patient }) => doesPatientMatchDate(patient, selectedDate))
        : items;
    return [...scope]
      .filter((e) => Boolean(e.patient.followUpDate))
      .sort((a, b) =>
        (a.patient.followUpDate || '').localeCompare(b.patient.followUpDate || '')
      );
  }

  return selectedDate
    ? items.filter(({ patient }) => doesPatientMatchDate(patient, selectedDate))
    : items;
}

function shortenMissingLabel(label: string): string {
  if (/^2nd HbA1c/i.test(label)) return '2nd HbA1c';
  if (/^Beta-Cell Report/i.test(label)) return 'Beta-Cell';
  if (/^FibroScan Report/i.test(label)) return 'FibroScan';
  if (/^1st HbA1c/i.test(label)) return '1st HbA1c';
  if (/^Fasting Blood Glucose/i.test(label)) return 'FBG';
  if (/^Postprandial Blood Glucose/i.test(label)) return 'PPBG';
  if (/^DDS-17/i.test(label)) return 'DDS-17';
  if (/^Antidiabetic Medication/i.test(label)) return 'Medications';
  if (/^Blood Pressure/i.test(label)) return 'BP';
  if (/^Serum Creatinine/i.test(label)) return 'Creatinine';
  if (/^Urinary Albumin/i.test(label)) return 'UACR';
  if (/^AST \/ ALT/i.test(label)) return 'AST/ALT';
  if (/^Waist Circumference/i.test(label)) return 'Waist';
  if (/^Hip Circumference/i.test(label)) return 'Hip';
  if (/^Contact Number/i.test(label)) return 'Contact';
  if (/^Total Cholesterol/i.test(label)) return 'Total Chol';
  if (/^HDL Cholesterol/i.test(label)) return 'HDL';
  if (/^LDL Cholesterol/i.test(label)) return 'LDL';
  return label.replace(/\s*\([^)]*\)/g, '').trim();
}

export function summarizePendingFields(
  missingFields: Array<{ label: string }>,
  maxItems = 2
): string {
  if (missingFields.length === 0) return '';
  const shown = missingFields
    .slice(0, maxItems)
    .map((m) => shortenMissingLabel(m.label));
  const extra = missingFields.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra}` : shown.join(', ');
}

