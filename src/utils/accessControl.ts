import type { InvestigatorUser, PatientCRF } from '../types/clinical';
import type { NavSection } from '../components/Sidebar';

export interface LoginParticipantSummary {
  user: InvestigatorUser;
  roleLabel:
    | 'Principal Investigator'
    | 'Approved Investigator'
    | 'Normal Participant'
    | 'Pending Normal User'
    | 'Pending Investigator';
  patientCount: number;
  lastActivityAt: string | null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isInvestigatorRole(
  user: Pick<InvestigatorUser, 'role' | 'status'> | null | undefined
): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.role === 'researcher' && user.status === 'approved';
}

export function isNormalUserRole(
  user: Pick<InvestigatorUser, 'role'> | null | undefined
): boolean {
  return Boolean(user && user.role === 'normal');
}

export function canUserEnterPortal(
  user: Pick<InvestigatorUser, 'role' | 'status'> | null | undefined
): boolean {
  if (!user) return false;
  if (user.role === 'owner') return true;
  return user.status === 'approved';
}

export function canAccessNavSection(
  nav: NavSection,
  user: Pick<InvestigatorUser, 'role' | 'status'> | null | undefined
): boolean {
  if (!user) return false;
  if (nav === 'team') {
    return isInvestigatorRole(user);
  }
  return true;
}

export function patientBelongsToUser(
  patient: Pick<PatientCRF, 'createdByUid' | 'investigatorEmail'>,
  user: Pick<InvestigatorUser, 'uid' | 'email'> | null | undefined
): boolean {
  if (!user) return false;
  if (patient.createdByUid && user.uid && patient.createdByUid === user.uid) {
    return true;
  }
  const userEmail = normalizeEmail(user.email || '');
  const patientEmail = normalizeEmail(patient.investigatorEmail || '');
  return Boolean(userEmail && patientEmail && userEmail === patientEmail);
}

/**
 * Normal Login users only see & analyze their own submitted patient records.
 * Approved Investigators and Principal Investigators (Owner) have full access
 * to every logged-in participant's patient records and cohort-wide analysis.
 */
export function filterPatientsForUser(
  patients: PatientCRF[],
  user: InvestigatorUser | null | undefined
): PatientCRF[] {
  if (!user) return [];
  if (isInvestigatorRole(user)) {
    return patients;
  }
  return patients.filter((patient) => patientBelongsToUser(patient, user));
}

export function validateNormalLoginInput(params: {
  displayName: string;
  email: string;
}): string | null {
  const name = params.displayName.trim();
  const email = params.email.trim();
  if (name.length < 2) {
    return 'Please enter your full name (at least 2 characters).';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Please enter a valid email address.';
  }
  return null;
}

export function buildNormalLoginUid(email: string): string {
  const cleaned = normalizeEmail(email).replace(/[^a-z0-9]/g, '-');
  return `normal-${cleaned || 'user'}`;
}

export function upsertLoginParticipant(
  list: InvestigatorUser[],
  incoming: InvestigatorUser
): InvestigatorUser[] {
  const incomingEmail = normalizeEmail(incoming.email);
  const existingIdx = list.findIndex(
    (u) => u.uid === incoming.uid || (incomingEmail && normalizeEmail(u.email) === incomingEmail)
  );
  if (existingIdx >= 0) {
    const existing = list[existingIdx];
    const preservedRole =
      existing.role === 'owner' || existing.role === 'researcher'
        ? existing.role
        : incoming.role;
    const next = [...list];
    next[existingIdx] = {
      ...existing,
      displayName: incoming.displayName || existing.displayName,
      photoUrl: incoming.photoUrl || existing.photoUrl,
      role: preservedRole,
      status: incoming.status || existing.status,
      lastLoginAt: incoming.lastLoginAt || new Date().toISOString(),
    };
    return next;
  }
  return [
    ...list,
    {
      ...incoming,
      email: normalizeEmail(incoming.email),
      lastLoginAt: incoming.lastLoginAt || new Date().toISOString(),
    },
  ];
}

export function canApproveTargetUser(
  actingRole: InvestigatorUser['role'] | undefined,
  target: Pick<InvestigatorUser, 'role'>
): boolean {
  if (!actingRole) return false;
  if (target.role === 'owner') return false;
  return target.role === 'normal' || actingRole === 'owner';
}

export function getPendingApprovalRequests(
  roster: InvestigatorUser[],
  actingUser: Pick<InvestigatorUser, 'role' | 'status'> | null | undefined
): InvestigatorUser[] {
  if (!isInvestigatorRole(actingUser)) return [];
  return roster.filter(
    (u) => u.status === 'pending' && canApproveTargetUser(actingUser?.role, u)
  );
}

export function detectNewPendingRequests(
  previousPendingUids: ReadonlySet<string> | null,
  currentPending: InvestigatorUser[]
): InvestigatorUser[] {
  if (!previousPendingUids) return [];
  return currentPending.filter((u) => !previousPendingUids.has(u.uid));
}

/**
 * Resolves a User Login attempt against the persisted login roster.
 * Brand-new Normal Login accounts always start as `pending` and require
 * investigator permission before entering the portal.
 * Investigator / Owner emails cannot bypass Google OAuth via passwordless login.
 */
export function resolveNormalLoginAttempt(
  roster: InvestigatorUser[],
  params: { displayName: string; email: string }
): {
  user: InvestigatorUser;
  updatedRoster: InvestigatorUser[];
  canEnter: boolean;
  requiresGoogleSignIn?: boolean;
} {
  const normalizedEmail = normalizeEmail(params.email);
  const trimmedName = params.displayName.trim();
  const nowIso = new Date().toISOString();

  const existing = roster.find(
    (u) => normalizeEmail(u.email) === normalizedEmail || u.uid === buildNormalLoginUid(normalizedEmail)
  );

  if (existing) {
    if (existing.role === 'owner' || existing.role === 'researcher') {
      return {
        user: existing,
        updatedRoster: roster,
        canEnter: false,
        requiresGoogleSignIn: true,
      };
    }

    const updatedUser: InvestigatorUser = {
      ...existing,
      displayName: trimmedName || existing.displayName,
      lastLoginAt: nowIso,
    };
    const updatedRoster = roster.map((u) =>
      u.uid === existing.uid ? updatedUser : u
    );
    return {
      user: updatedUser,
      updatedRoster,
      canEnter: canUserEnterPortal(updatedUser),
    };
  }

  const newUser: InvestigatorUser = {
    uid: buildNormalLoginUid(normalizedEmail),
    email: normalizedEmail,
    displayName: trimmedName,
    photoUrl: '',
    role: 'normal',
    status: 'pending',
    createdAt: nowIso,
    lastLoginAt: nowIso,
  };

  return {
    user: newUser,
    updatedRoster: [...roster, newUser],
    canEnter: false,
  };
}

export function summarizeLoginParticipants(
  users: InvestigatorUser[],
  patients: PatientCRF[]
): LoginParticipantSummary[] {
  const rank = (u: InvestigatorUser): number => {
    if (u.role === 'owner') return 0;
    if (u.role === 'normal' && u.status === 'pending') return 1;
    if (u.role === 'researcher' && u.status === 'pending') return 2;
    if (u.role === 'researcher' && u.status === 'approved') return 3;
    if (u.role === 'normal' && u.status === 'approved') return 4;
    return 5;
  };

  return [...users]
    .sort((a, b) => rank(a) - rank(b))
    .map((user) => {
      const ownedPatients = patients.filter((p) => patientBelongsToUser(p, user));
      const latestPatientUpdate = ownedPatients
        .map((p) => p.updatedAt || p.verifiedAt || p.createdAt || '')
        .filter(Boolean)
        .sort()
        .pop();

      const roleLabel: LoginParticipantSummary['roleLabel'] =
        user.role === 'owner'
          ? 'Principal Investigator'
          : user.role === 'normal'
          ? user.status === 'approved'
            ? 'Normal Participant'
            : 'Pending Normal User'
          : user.status === 'approved'
          ? 'Approved Investigator'
          : 'Pending Investigator';

      return {
        user,
        roleLabel,
        patientCount: ownedPatients.length,
        lastActivityAt: latestPatientUpdate || user.lastLoginAt || user.createdAt || null,
      };
    });
}
