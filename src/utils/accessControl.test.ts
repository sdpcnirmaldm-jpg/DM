import test from 'node:test';
import assert from 'node:assert/strict';
import { SEED_INVESTIGATORS, SEED_PATIENTS } from '../data/seedPatients';
import type { InvestigatorUser } from '../types/clinical';
import {
  buildNormalLoginUid,
  canAccessNavSection,
  canApproveTargetUser,
  canUserEnterPortal,
  detectNewPendingRequests,
  filterPatientsForUser,
  getPendingApprovalRequests,
  isInvestigatorRole,
  isNormalUserRole,
  resolveNormalLoginAttempt,
  summarizeLoginParticipants,
  upsertLoginParticipant,
  validateNormalLoginInput,
} from './accessControl';

const NORMAL_USER: InvestigatorUser = {
  uid: buildNormalLoginUid('asha.patel@clinic.org'),
  email: 'asha.patel@clinic.org',
  displayName: 'Dr. Asha Patel',
  photoUrl: '',
  role: 'normal',
  status: 'approved',
};

test('isInvestigatorRole grants full access to owner and approved researchers, denies normal users', () => {
  const owner = SEED_INVESTIGATORS[0];
  const approvedResearcher = SEED_INVESTIGATORS[1];
  const rejectedResearcher = SEED_INVESTIGATORS[5];

  assert.equal(isInvestigatorRole(owner), true);
  assert.equal(isInvestigatorRole(approvedResearcher), true);
  assert.equal(isInvestigatorRole(rejectedResearcher), false);
  assert.equal(isInvestigatorRole(NORMAL_USER), false);
  assert.equal(isNormalUserRole(NORMAL_USER), true);
  assert.equal(isNormalUserRole(owner), false);
});

test('filterPatientsForUser returns full cohort to investigators and isolates normal users to their own records', () => {
  const owner = SEED_INVESTIGATORS[0];
  const approvedResearcher = SEED_INVESTIGATORS[1];

  const customPatient = {
    ...SEED_PATIENTS[0],
    participantId: 'F11099',
    patientName: 'Meera Solanki',
    investigatorName: NORMAL_USER.displayName,
    investigatorEmail: NORMAL_USER.email,
    createdByUid: NORMAL_USER.uid,
  };
  const combinedCohort = [...SEED_PATIENTS, customPatient];

  assert.equal(filterPatientsForUser(combinedCohort, owner).length, combinedCohort.length);
  assert.equal(
    filterPatientsForUser(combinedCohort, approvedResearcher).length,
    combinedCohort.length
  );

  const normalScoped = filterPatientsForUser(combinedCohort, NORMAL_USER);
  assert.equal(normalScoped.length, 1);
  assert.equal(normalScoped[0].participantId, 'F11099');

  const brandNewNormal: InvestigatorUser = {
    ...NORMAL_USER,
    uid: 'normal-new-user',
    email: 'fresh.user@example.com',
  };
  assert.equal(filterPatientsForUser(combinedCohort, brandNewNormal).length, 0);
});

test('canAccessNavSection allows normal users all clinical modules while restricting team oversight to investigators', () => {
  const owner = SEED_INVESTIGATORS[0];

  assert.equal(canAccessNavSection('dashboard', NORMAL_USER), true);
  assert.equal(canAccessNavSection('new-patient', NORMAL_USER), true);
  assert.equal(canAccessNavSection('data', NORMAL_USER), true);
  assert.equal(canAccessNavSection('crf', NORMAL_USER), true);
  assert.equal(canAccessNavSection('patient-profile', NORMAL_USER), true);
  assert.equal(canAccessNavSection('patient-documents', NORMAL_USER), true);
  assert.equal(canAccessNavSection('statistics', NORMAL_USER), true);
  assert.equal(canAccessNavSection('ai', NORMAL_USER), true);
  assert.equal(canAccessNavSection('team', NORMAL_USER), false);

  assert.equal(canAccessNavSection('team', owner), true);
});

test('resolveNormalLoginAttempt requires investigator approval for new normal logins and blocks investigator email spoofing', () => {
  // Investigator/owner email cannot bypass Google Sign-In via User Login form
  const spoofOwnerAttempt = resolveNormalLoginAttempt(SEED_INVESTIGATORS, {
    displayName: 'Impersonator',
    email: SEED_INVESTIGATORS[0].email,
  });
  assert.equal(spoofOwnerAttempt.canEnter, false);
  assert.equal(spoofOwnerAttempt.requiresGoogleSignIn, true);

  const firstAttempt = resolveNormalLoginAttempt(SEED_INVESTIGATORS, {
    displayName: 'Dr. Neha Shah',
    email: 'neha.shah@clinic.org',
  });

  assert.equal(firstAttempt.user.role, 'normal');
  assert.equal(firstAttempt.user.status, 'pending');
  assert.equal(firstAttempt.canEnter, false);
  assert.equal(canUserEnterPortal(firstAttempt.user), false);

  // Investigator approves user
  const approvedRoster = firstAttempt.updatedRoster.map((u) =>
    u.uid === firstAttempt.user.uid ? { ...u, status: 'approved' as const } : u
  );

  const secondAttempt = resolveNormalLoginAttempt(approvedRoster, {
    displayName: 'Dr. Neha Shah',
    email: 'neha.shah@clinic.org',
  });
  assert.equal(secondAttempt.user.status, 'approved');
  assert.equal(secondAttempt.canEnter, true);
  assert.equal(canUserEnterPortal(secondAttempt.user), true);

  // Revoked user cannot enter
  const revokedRoster = approvedRoster.map((u) =>
    u.uid === firstAttempt.user.uid ? { ...u, status: 'rejected' as const } : u
  );
  const thirdAttempt = resolveNormalLoginAttempt(revokedRoster, {
    displayName: 'Dr. Neha Shah',
    email: 'neha.shah@clinic.org',
  });
  assert.equal(thirdAttempt.canEnter, false);
});

test('getPendingApprovalRequests surfaces actionable pending requests per investigator role', () => {
  const owner = SEED_INVESTIGATORS[0];
  const approvedResearcher = SEED_INVESTIGATORS[1];

  const pendingNormal: InvestigatorUser = {
    uid: 'normal-pending-1',
    email: 'pending.user@clinic.org',
    displayName: 'Pending User',
    photoUrl: '',
    role: 'normal',
    status: 'pending',
  };
  const pendingResearcher: InvestigatorUser = {
    uid: 'res-pending-1',
    email: 'pending.doc@clinic.org',
    displayName: 'Pending Doc',
    photoUrl: '',
    role: 'researcher',
    status: 'pending',
  };

  const roster = [...SEED_INVESTIGATORS, pendingNormal, pendingResearcher];

  const ownerRequests = getPendingApprovalRequests(roster, owner);
  assert.equal(ownerRequests.length, 2);

  const researcherRequests = getPendingApprovalRequests(roster, approvedResearcher);
  assert.equal(researcherRequests.length, 1);
  assert.equal(researcherRequests[0].uid, 'normal-pending-1');

  assert.equal(getPendingApprovalRequests(roster, NORMAL_USER).length, 0);
  assert.equal(canApproveTargetUser('owner', pendingResearcher), true);
  assert.equal(canApproveTargetUser('researcher', pendingResearcher), false);
  assert.equal(canApproveTargetUser('researcher', pendingNormal), true);
});

test('upsertLoginParticipant and summarizeLoginParticipants track normal logins and patient counts cleanly', () => {
  const updatedTeam = upsertLoginParticipant(SEED_INVESTIGATORS, NORMAL_USER);
  assert.equal(updatedTeam.length, SEED_INVESTIGATORS.length + 1);

  // Attempting to upsert owner email as normal preserves owner role
  const preservedTeam = upsertLoginParticipant(updatedTeam, {
    ...NORMAL_USER,
    uid: 'temp-attempt',
    email: SEED_INVESTIGATORS[0].email,
  });
  const ownerEntry = preservedTeam.find((u) => u.email === SEED_INVESTIGATORS[0].email);
  assert.equal(ownerEntry?.role, 'owner');

  const customPatient = {
    ...SEED_PATIENTS[0],
    participantId: 'M11088',
    investigatorName: NORMAL_USER.displayName,
    investigatorEmail: NORMAL_USER.email,
    createdByUid: NORMAL_USER.uid,
  };
  const summaries = summarizeLoginParticipants(updatedTeam, [...SEED_PATIENTS, customPatient]);
  const normalSummary = summaries.find((s) => s.user.email === NORMAL_USER.email);
  assert.equal(normalSummary?.roleLabel, 'Normal Participant');
  assert.equal(normalSummary?.patientCount, 1);
});

test('validateNormalLoginInput rejects blank names or invalid emails', () => {
  assert.ok(validateNormalLoginInput({ displayName: 'A', email: 'a@b.com' }));
  assert.ok(validateNormalLoginInput({ displayName: 'Asha Patel', email: 'not-an-email' }));
  assert.equal(
    validateNormalLoginInput({ displayName: 'Dr. Asha Patel', email: 'asha@clinic.org' }),
    null
  );
});

test('detectNewPendingRequests ignores initial baseline and returns only newly arrived pending UIDs', () => {
  const req1: InvestigatorUser = {
    uid: 'normal-one',
    email: 'one@clinic.org',
    displayName: 'User One',
    photoUrl: '',
    role: 'normal',
    status: 'pending',
  };
  const req2: InvestigatorUser = {
    uid: 'normal-two',
    email: 'two@clinic.org',
    displayName: 'User Two',
    photoUrl: '',
    role: 'normal',
    status: 'pending',
  };

  assert.deepEqual(detectNewPendingRequests(null, [req1]), []);
  assert.deepEqual(detectNewPendingRequests(new Set(['normal-one']), [req1]), []);
  assert.deepEqual(detectNewPendingRequests(new Set(['normal-one']), [req1, req2]), [req2]);
});
