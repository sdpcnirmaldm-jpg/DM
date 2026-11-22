import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
} from './localFallbackStore';

function createTempDbPath(): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 't2dm-fallback-test-'));
  return { dir, filePath: path.join(dir, 'db.json') };
}

test('fallback store seeds principal investigator owner and preserves approval across Google sign-in', () => {
  const { dir, filePath } = createTempDbPath();
  try {
    const initialList = listFallbackInvestigators(filePath);
    const owner = initialList.find((u) => u.email === OWNER_EMAIL);
    assert.ok(owner);
    assert.equal(owner.role, 'owner');
    assert.equal(owner.status, 'approved');

    // When owner signs in with Firebase Google UID, uid updates seamlessly while staying owner + approved
    const syncedOwner = getOrCreateFallbackUser(
      {
        uid: 'firebase-owner-uid-123',
        email: OWNER_EMAIL,
        displayName: 'Dr. Bhumit Dangodara',
        requestedRole: 'investigator',
      },
      filePath
    );
    assert.equal(syncedOwner.uid, 'firebase-owner-uid-123');
    assert.equal(syncedOwner.role, 'owner');
    assert.equal(syncedOwner.status, 'approved');

    const reloaded = getFallbackUserByUid('firebase-owner-uid-123', filePath);
    assert.equal(reloaded?.email, OWNER_EMAIL);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('new normal and investigator logins start pending, persist for investigator, and unify by email', () => {
  const { dir, filePath } = createTempDbPath();
  try {
    // 1. Brand-new normal user registers via User Login form
    const pendingNormal = upsertFallbackNormalLoginUser(
      {
        uid: 'normal-fresh-loginer-example-com',
        email: 'fresh.loginer@example.com',
        displayName: 'Fresh Loginer',
      },
      filePath
    );
    assert.equal(pendingNormal.role, 'normal');
    assert.equal(pendingNormal.status, 'pending');

    // 2. Brand-new investigator signs in via Google
    const pendingInvestigator = getOrCreateFallbackUser(
      {
        uid: 'google-inv-999',
        email: 'new.doctor@clinic.org',
        displayName: 'Dr. New Doctor',
        requestedRole: 'investigator',
      },
      filePath
    );
    assert.equal(pendingInvestigator.role, 'researcher');
    assert.equal(pendingInvestigator.status, 'pending');

    // 3. Principal investigator fetches list and sees BOTH pending requests
    const roster = listFallbackInvestigators(filePath);
    const pendingRows = roster.filter((u) => u.status === 'pending');
    assert.equal(pendingRows.length, 2);
    assert.ok(pendingRows.some((u) => u.email === 'fresh.loginer@example.com'));
    assert.ok(pendingRows.some((u) => u.email === 'new.doctor@clinic.org'));

    // 4. Normal user polling status shows pending, then becomes approved once investigator approves
    assert.equal(getFallbackNormalLoginStatus('fresh.loginer@example.com', filePath)?.status, 'pending');
    const approved = updateFallbackInvestigatorStatus(pendingNormal.uid, 'approved', filePath);
    assert.equal(approved?.status, 'approved');
    assert.equal(getFallbackNormalLoginStatus('fresh.loginer@example.com', filePath)?.status, 'approved');

    // 5. Same normal user signing in with Google later keeps approved status and unifies uid cleanly
    const googleUnified = getOrCreateFallbackUser(
      {
        uid: 'firebase-fresh-uid',
        email: 'fresh.loginer@example.com',
        displayName: 'Fresh Loginer',
        requestedRole: 'normal',
      },
      filePath
    );
    assert.equal(googleUnified.uid, 'firebase-fresh-uid');
    assert.equal(googleUnified.status, 'approved');
    assert.equal(
      listFallbackInvestigators(filePath).filter((u) => u.email === 'fresh.loginer@example.com').length,
      1
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('passwordless normal login blocks investigator and owner emails and owner cannot be deleted', () => {
  const { dir, filePath } = createTempDbPath();
  try {
    assert.throws(
      () =>
        upsertFallbackNormalLoginUser(
          {
            uid: 'normal-spoof-owner',
            email: OWNER_EMAIL,
            displayName: 'Spoof Attempt',
          },
          filePath
        ),
      InvestigatorAccountRequiresGoogleError
    );

    assert.throws(
      () =>
        upsertFallbackNormalLoginUser(
          {
            uid: 'normal-spoof-researcher',
            email: 'desaihetvi2004@gmail.com',
            displayName: 'Spoof Researcher',
          },
          filePath
        ),
      InvestigatorAccountRequiresGoogleError
    );

    assert.throws(
      () => deleteFallbackInvestigator('seed-owner-bhumit', filePath),
      /Study owner account cannot be deleted/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
