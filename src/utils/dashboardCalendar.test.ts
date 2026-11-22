import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardSideQueue,
  buildMonthCalendarCells,
  doesPatientMatchDate,
  formatLocalIsoDate,
  getInitialDashboardCalendarState,
  summarizePendingFields,
} from './dashboardCalendar';

test('formatLocalIsoDate preserves local year, month, and day without UTC shift', () => {
  const localLateNight = new Date(2026, 10, 17, 23, 45, 0); // Nov 17, 2026 23:45 local
  assert.equal(formatLocalIsoDate(localLateNight), '2026-11-17');

  const localEarlyMorning = new Date(2026, 0, 5, 0, 15, 0); // Jan 5, 2026 00:15 local
  assert.equal(formatLocalIsoDate(localEarlyMorning), '2026-01-05');
});

test('getInitialDashboardCalendarState defaults to current month, year, and todayIso', () => {
  const sampleNow = new Date(2026, 10, 17, 1, 52, 0); // Nov 17, 2026
  const state = getInitialDashboardCalendarState(sampleNow);

  assert.equal(state.calYear, 2026);
  assert.equal(state.calMonth, 10);
  assert.equal(state.todayIso, '2026-11-17');
  assert.equal(state.selectedDate, '2026-11-17');
});

test('buildMonthCalendarCells produces exact day count and weekday padding for Nov 2026', () => {
  const cells = buildMonthCalendarCells(2026, 10); // Nov 1, 2026 is Sunday (0)
  assert.equal(cells.length, 30);
  assert.deepEqual(cells[0], { day: 1, iso: '2026-11-01' });
  assert.deepEqual(cells[16], { day: 17, iso: '2026-11-17' });
  assert.deepEqual(cells[29], { day: 30, iso: '2026-11-30' });
});

test('doesPatientMatchDate matches either recruitment date or follow-up date', () => {
  const patient = {
    dateOfRecruitment: '2026-08-14',
    followUpDate: '2026-11-18',
  };
  assert.equal(doesPatientMatchDate(patient, '2026-08-14'), true);
  assert.equal(doesPatientMatchDate(patient, '2026-11-18'), true);
  assert.equal(doesPatientMatchDate(patient, '2026-11-17'), false);
});

test('buildDashboardSideQueue shows all pending patients when filterRegistryByDate is false even if today has 0 patients', () => {
  const items = [
    {
      patient: { dateOfRecruitment: '2026-08-14', followUpDate: '2026-11-18', statusColor: 'green' },
      missingFields: [],
    },
    {
      patient: { dateOfRecruitment: '2026-08-20', followUpDate: '2026-11-22', statusColor: 'orange' },
      missingFields: [
        { key: 'hba1c2', label: '2nd HbA1c (%) Follow-up' },
        { key: 'fibroScan', label: 'FibroScan Report (LSM kPa / CAP)' },
      ],
    },
    {
      patient: { dateOfRecruitment: '2026-11-02', followUpDate: '2026-11-28', statusColor: 'red' },
      missingFields: [
        { key: 'hba1c2', label: '2nd HbA1c (%) Follow-up' },
        { key: 'betaCell', label: 'Beta-Cell Report (C-Peptide / Fasting Insulin)' },
        { key: 'fibroScan', label: 'FibroScan Report (LSM kPa / CAP)' },
      ],
    },
  ];

  // Default Patient mode on Today (2026-11-17) with no match returns empty
  const todayList = buildDashboardSideQueue({
    items,
    sideMode: 'patient',
    selectedDate: '2026-11-17',
    filterRegistryByDate: false,
  });
  assert.equal(todayList.length, 0);

  // Pending mode when no explicit date filter is active shows ALL pending patients sorted by most pending first
  const pendingList = buildDashboardSideQueue({
    items,
    sideMode: 'pending',
    selectedDate: '2026-11-17',
    filterRegistryByDate: false,
  });
  assert.equal(pendingList.length, 2);
  assert.equal(pendingList[0].missingFields.length, 3);
  assert.equal(pendingList[1].missingFields.length, 2);

  // Explicit date filter restricts pending list to that selected date
  const datePendingList = buildDashboardSideQueue({
    items,
    sideMode: 'pending',
    selectedDate: '2026-11-22',
    filterRegistryByDate: true,
  });
  assert.equal(datePendingList.length, 1);
  assert.equal(datePendingList[0].patient.followUpDate, '2026-11-22');
});

test('summarizePendingFields shortens labels and formats overflow count cleanly', () => {
  assert.equal(summarizePendingFields([]), '');
  assert.equal(
    summarizePendingFields([
      { label: '2nd HbA1c (%) Follow-up' },
      { label: 'FibroScan Report (LSM kPa / CAP)' },
      { label: 'Beta-Cell Report (C-Peptide / Fasting Insulin)' },
    ]),
    '2nd HbA1c, FibroScan +1'
  );
});

