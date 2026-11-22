import { eq, or, sql } from 'drizzle-orm';
import { assertSqlSocketAvailable, db } from './index.ts';
import { users } from './schema.ts';
import {
  extractErrorMessage,
  isSqlUnavailableError,
  warnSqlProxyOnce,
} from './connectionStatus.ts';
import {
  deleteFallbackInvestigator,
  getFallbackNormalLoginStatus,
  getFallbackUserByUid,
  getOrCreateFallbackUser,
  InvestigatorAccountRequiresGoogleError,
  listFallbackInvestigators,
  OWNER_EMAIL,
  updateFallbackInvestigatorStatus,
  upsertFallbackNormalLoginUser,
} from './localFallbackStore.ts';

export { OWNER_EMAIL, InvestigatorAccountRequiresGoogleError };

export async function getOrCreateUser(params: {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  requestedRole?: 'normal' | 'investigator';
}) {
  const { uid, email, displayName = '', photoUrl = '', requestedRole = 'investigator' } = params;
  const normalizedEmail = email.trim().toLowerCase();
  const isOwner = normalizedEmail === OWNER_EMAIL.toLowerCase();

  try {
    assertSqlSocketAvailable();
    const existing = await db
      .select()
      .from(users)
      .where(
        normalizedEmail
          ? or(eq(users.uid, uid), sql`lower(${users.email}) = ${normalizedEmail}`)
          : eq(users.uid, uid)
      )
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      const updated = await db
        .update(users)
        .set({
          uid,
          email: normalizedEmail || current.email,
          displayName: displayName.trim() || current.displayName,
          photoUrl: photoUrl || current.photoUrl,
          ...(isOwner ? { role: 'owner', status: 'approved' } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated[0];
    }

    const role = isOwner ? 'owner' : requestedRole === 'normal' ? 'normal' : 'researcher';
    const status = isOwner ? 'approved' : 'pending';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName.trim() || normalizedEmail.split('@')[0] || 'User',
        photoUrl,
        role,
        status,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    return inserted[0];
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('getOrCreateUser', extractErrorMessage(error));
      return getOrCreateFallbackUser(params);
    }
    console.error('Database error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize investigator profile.', { cause: error });
  }
}

export async function upsertNormalLoginUser(params: {
  uid: string;
  email: string;
  displayName: string;
}) {
  const { uid, email, displayName } = params;
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedEmail === OWNER_EMAIL.toLowerCase()) {
    throw new InvestigatorAccountRequiresGoogleError();
  }

  try {
    assertSqlSocketAvailable();
    const existing = await db
      .select()
      .from(users)
      .where(
        or(eq(users.uid, uid), sql`lower(${users.email}) = ${normalizedEmail}`)
      )
      .limit(1);

    if (existing.length > 0) {
      const current = existing[0];
      if (current.role === 'owner' || current.role === 'researcher') {
        throw new InvestigatorAccountRequiresGoogleError();
      }
      const updated = await db
        .update(users)
        .set({
          displayName: displayName.trim() || current.displayName,
          email: normalizedEmail,
          updatedAt: new Date(),
        })
        .where(eq(users.id, current.id))
        .returning();
      return updated[0];
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        displayName: displayName.trim(),
        photoUrl: '',
        role: 'normal',
        status: 'pending',
      })
      .returning();
    return inserted[0];
  } catch (error) {
    if (error instanceof InvestigatorAccountRequiresGoogleError) {
      throw error;
    }
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('upsertNormalLoginUser', extractErrorMessage(error));
      return upsertFallbackNormalLoginUser(params);
    }
    console.error('Database error in upsertNormalLoginUser:', error);
    throw new Error('Failed to record normal portal login.', { cause: error });
  }
}

export async function getNormalLoginUserStatus(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  if (normalizedEmail === OWNER_EMAIL.toLowerCase()) {
    throw new InvestigatorAccountRequiresGoogleError();
  }

  try {
    assertSqlSocketAvailable();
    const existing = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${normalizedEmail}`)
      .limit(1);
    const user = existing[0] ?? null;
    if (!user) return null;
    if (user.role === 'owner' || user.role === 'researcher') {
      throw new InvestigatorAccountRequiresGoogleError();
    }
    return user;
  } catch (error) {
    if (error instanceof InvestigatorAccountRequiresGoogleError) {
      throw error;
    }
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('getNormalLoginUserStatus', extractErrorMessage(error));
      return getFallbackNormalLoginStatus(normalizedEmail);
    }
    console.error('Database error in getNormalLoginUserStatus:', error);
    return null;
  }
}

export async function getUserByUid(uid: string) {
  try {
    assertSqlSocketAvailable();
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return existing[0] ?? null;
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('getUserByUid', extractErrorMessage(error));
      return getFallbackUserByUid(uid);
    }
    console.error('Database error in getUserByUid:', error);
    return null;
  }
}

export async function listInvestigators() {
  try {
    assertSqlSocketAvailable();
    return await db.select().from(users);
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('listInvestigators', extractErrorMessage(error));
      return listFallbackInvestigators();
    }
    console.error('Database error in listInvestigators:', error);
    throw new Error('Failed to retrieve investigator roster.', { cause: error });
  }
}

export async function updateInvestigatorStatus(uid: string, status: 'approved' | 'rejected' | 'pending') {
  try {
    assertSqlSocketAvailable();
    const result = await db
      .update(users)
      .set({ status, updatedAt: new Date() })
      .where(eq(users.uid, uid))
      .returning();
    return result[0] ?? null;
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('updateInvestigatorStatus', extractErrorMessage(error));
      return updateFallbackInvestigatorStatus(uid, status);
    }
    console.error('Database error in updateInvestigatorStatus:', error);
    throw new Error('Failed to update investigator approval status.', { cause: error });
  }
}

export async function deleteInvestigator(uid: string) {
  try {
    assertSqlSocketAvailable();
    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length === 0) return false;
    if (existing[0].role === 'owner') {
      throw new Error('Study owner account cannot be deleted.');
    }
    const deleted = await db.delete(users).where(eq(users.uid, uid)).returning();
    return deleted.length > 0;
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('deleteInvestigator', extractErrorMessage(error));
      return deleteFallbackInvestigator(uid);
    }
    console.error('Database error in deleteInvestigator:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to delete investigator.',
      { cause: error }
    );
  }
}
