import fs from 'node:fs';
import path from 'node:path';
import { SEED_INVESTIGATORS, SEED_PATIENTS } from '../data/seedPatients.ts';
import type { InvestigatorUser, PatientCRF } from '../types/clinical.ts';

export const OWNER_EMAIL = 'bhumitdangodara1@gmail.com';

export class InvestigatorAccountRequiresGoogleError extends Error {
  statusCode = 403;
  constructor(
    message = 'This email is registered as an Investigator account. Please use Investigator Login with Google Sign-In.'
  ) {
    super(message);
    this.name = 'InvestigatorAccountRequiresGoogleError';
  }
}

export interface StoredUserRecord extends InvestigatorUser {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPatientRecord extends PatientCRF {
  id: number;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredSheetConfig {
  id: number;
  ownerUid: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
  updatedAt: string;
}

interface LocalFallbackDatabase {
  nextUserId: number;
  nextPatientId: number;
  nextSettingId: number;
  users: StoredUserRecord[];
  patients: StoredPatientRecord[];
  sheetSettings: StoredSheetConfig[];
}

const DEFAULT_STORE_PATH = path.resolve(process.cwd(), '.data', 'study-portal-db.json');

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isOwnerEmail(email: string): boolean {
  return normalizeEmail(email) === OWNER_EMAIL.toLowerCase();
}

function createInitialDatabase(): LocalFallbackDatabase {
  const now = new Date().toISOString();
  const users: StoredUserRecord[] = SEED_INVESTIGATORS.map((inv, idx) => ({
    ...inv,
    id: inv.id ?? idx + 1,
    email: normalizeEmail(inv.email),
    role: isOwnerEmail(inv.email) ? 'owner' : inv.role,
    status: isOwnerEmail(inv.email) ? 'approved' : inv.status,
    createdAt: inv.createdAt || now,
    updatedAt: now,
  }));

  const patients: StoredPatientRecord[] = SEED_PATIENTS.map((p, idx) => ({
    ...p,
    id: p.id ?? idx + 1,
    createdByUid: p.createdByUid || 'seed-owner-bhumit',
    createdAt: p.createdAt || now,
    updatedAt: p.updatedAt || p.verifiedAt || now,
  }));

  return {
    nextUserId: users.reduce((max, u) => Math.max(max, u.id), 0) + 1,
    nextPatientId: patients.reduce((max, p) => Math.max(max, p.id), 0) + 1,
    nextSettingId: 1,
    users,
    patients,
    sheetSettings: [],
  };
}

function ensureOwnerPresent(data: LocalFallbackDatabase): LocalFallbackDatabase {
  const ownerIdx = data.users.findIndex((u) => isOwnerEmail(u.email));
  const now = new Date().toISOString();
  if (ownerIdx >= 0) {
    data.users[ownerIdx] = {
      ...data.users[ownerIdx],
      email: OWNER_EMAIL,
      role: 'owner',
      status: 'approved',
    };
    return data;
  }
  const ownerSeed = SEED_INVESTIGATORS.find((u) => isOwnerEmail(u.email));
  const id = data.nextUserId++;
  data.users.unshift({
    id,
    uid: ownerSeed?.uid || 'seed-owner-bhumit',
    email: OWNER_EMAIL,
    displayName: ownerSeed?.displayName || 'Bhumit Dangodara',
    photoUrl: ownerSeed?.photoUrl || '',
    role: 'owner',
    status: 'approved',
    createdAt: now,
    updatedAt: now,
  });
  return data;
}

function readDatabase(storePath = DEFAULT_STORE_PATH): LocalFallbackDatabase {
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, 'utf8');
      if (raw.trim()) {
        const parsed = JSON.parse(raw) as Partial<LocalFallbackDatabase>;
        if (Array.isArray(parsed.users) && Array.isArray(parsed.patients)) {
          const dbData: LocalFallbackDatabase = {
            nextUserId:
              typeof parsed.nextUserId === 'number'
                ? parsed.nextUserId
                : parsed.users.reduce((m, u) => Math.max(m, u.id ?? 0), 0) + 1,
            nextPatientId:
              typeof parsed.nextPatientId === 'number'
                ? parsed.nextPatientId
                : parsed.patients.reduce((m, p) => Math.max(m, p.id ?? 0), 0) + 1,
            nextSettingId:
              typeof parsed.nextSettingId === 'number' ? parsed.nextSettingId : 1,
            users: parsed.users,
            patients: parsed.patients,
            sheetSettings: Array.isArray(parsed.sheetSettings) ? parsed.sheetSettings : [],
          };
          return ensureOwnerPresent(dbData);
        }
      }
    }
  } catch (err) {
    console.warn('Reinitializing fallback store after read error:', err);
  }

  const seeded = ensureOwnerPresent(createInitialDatabase());
  writeDatabase(seeded, storePath);
  return seeded;
}

function writeDatabase(data: LocalFallbackDatabase, storePath = DEFAULT_STORE_PATH): void {
  const dir = path.dirname(storePath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tempPath, storePath);
}

export function getOrCreateFallbackUser(
  params: {
    uid: string;
    email: string;
    displayName?: string;
    photoUrl?: string;
    requestedRole?: 'normal' | 'investigator';
  },
  storePath = DEFAULT_STORE_PATH
): StoredUserRecord {
  const data = readDatabase(storePath);
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(params.email);
  const owner = isOwnerEmail(normalizedEmail);

  const existingIdx = data.users.findIndex(
    (u) => u.uid === params.uid || (normalizedEmail && normalizeEmail(u.email) === normalizedEmail)
  );

  if (existingIdx >= 0) {
    const existing = data.users[existingIdx];
    const updated: StoredUserRecord = {
      ...existing,
      uid: params.uid,
      email: normalizedEmail || existing.email,
      displayName: params.displayName?.trim() || existing.displayName,
      photoUrl: params.photoUrl || existing.photoUrl,
      role: owner ? 'owner' : existing.role,
      status: owner ? 'approved' : existing.status,
      lastLoginAt: now,
      updatedAt: now,
    };
    data.users[existingIdx] = updated;
    writeDatabase(data, storePath);
    return updated;
  }

  const role: InvestigatorUser['role'] = owner
    ? 'owner'
    : params.requestedRole === 'normal'
    ? 'normal'
    : 'researcher';
  const status: InvestigatorUser['status'] = owner ? 'approved' : 'pending';

  const created: StoredUserRecord = {
    id: data.nextUserId++,
    uid: params.uid,
    email: normalizedEmail,
    displayName: params.displayName?.trim() || normalizedEmail.split('@')[0] || 'User',
    photoUrl: params.photoUrl || '',
    role,
    status,
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  };
  data.users.push(created);
  writeDatabase(data, storePath);
  return created;
}

export function upsertFallbackNormalLoginUser(
  params: {
    uid: string;
    email: string;
    displayName: string;
  },
  storePath = DEFAULT_STORE_PATH
): StoredUserRecord {
  const data = readDatabase(storePath);
  const now = new Date().toISOString();
  const normalizedEmail = normalizeEmail(params.email);
  const trimmedName = params.displayName.trim();

  if (isOwnerEmail(normalizedEmail)) {
    throw new InvestigatorAccountRequiresGoogleError();
  }

  const existingIdx = data.users.findIndex(
    (u) => normalizeEmail(u.email) === normalizedEmail || u.uid === params.uid
  );

  if (existingIdx >= 0) {
    const current = data.users[existingIdx];
    if (current.role === 'owner' || current.role === 'researcher') {
      throw new InvestigatorAccountRequiresGoogleError();
    }
    const updated: StoredUserRecord = {
      ...current,
      email: normalizedEmail,
      displayName: trimmedName || current.displayName,
      lastLoginAt: now,
      updatedAt: now,
    };
    data.users[existingIdx] = updated;
    writeDatabase(data, storePath);
    return updated;
  }

  const created: StoredUserRecord = {
    id: data.nextUserId++,
    uid: params.uid,
    email: normalizedEmail,
    displayName: trimmedName || normalizedEmail.split('@')[0] || 'User',
    photoUrl: '',
    role: 'normal',
    status: 'pending',
    createdAt: now,
    lastLoginAt: now,
    updatedAt: now,
  };
  data.users.push(created);
  writeDatabase(data, storePath);
  return created;
}

export function getFallbackNormalLoginStatus(
  email: string,
  storePath = DEFAULT_STORE_PATH
): StoredUserRecord | null {
  const data = readDatabase(storePath);
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const user = data.users.find((u) => normalizeEmail(u.email) === normalizedEmail) ?? null;
  if (!user) return null;
  if (user.role === 'owner' || user.role === 'researcher') {
    throw new InvestigatorAccountRequiresGoogleError();
  }
  return user;
}

export function getFallbackUserByUid(
  uid: string,
  storePath = DEFAULT_STORE_PATH
): StoredUserRecord | null {
  const data = readDatabase(storePath);
  return data.users.find((u) => u.uid === uid) ?? null;
}

export function listFallbackInvestigators(storePath = DEFAULT_STORE_PATH): StoredUserRecord[] {
  const data = readDatabase(storePath);
  return data.users;
}

export function updateFallbackInvestigatorStatus(
  uid: string,
  status: 'approved' | 'rejected' | 'pending',
  storePath = DEFAULT_STORE_PATH
): StoredUserRecord | null {
  const data = readDatabase(storePath);
  const idx = data.users.findIndex((u) => u.uid === uid);
  if (idx < 0) return null;
  if (data.users[idx].role === 'owner') {
    return data.users[idx];
  }
  const updated: StoredUserRecord = {
    ...data.users[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  data.users[idx] = updated;
  writeDatabase(data, storePath);
  return updated;
}

export function deleteFallbackInvestigator(
  uid: string,
  storePath = DEFAULT_STORE_PATH
): boolean {
  const data = readDatabase(storePath);
  const target = data.users.find((u) => u.uid === uid);
  if (!target) return false;
  if (target.role === 'owner') {
    throw new Error('Study owner account cannot be deleted.');
  }
  const nextUsers = data.users.filter((u) => u.uid !== uid);
  if (nextUsers.length === data.users.length) return false;
  data.users = nextUsers;
  writeDatabase(data, storePath);
  return true;
}

export function listFallbackPatients(storePath = DEFAULT_STORE_PATH): StoredPatientRecord[] {
  const data = readDatabase(storePath);
  return [...data.patients].sort((a, b) =>
    (b.updatedAt || '').localeCompare(a.updatedAt || '')
  );
}

export function createFallbackPatientRecord(
  crf: PatientCRF,
  createdByUid: string,
  storePath = DEFAULT_STORE_PATH
): StoredPatientRecord {
  const data = readDatabase(storePath);
  const now = new Date().toISOString();
  const id = data.nextPatientId++;
  const created: StoredPatientRecord = {
    ...crf,
    id,
    createdByUid: createdByUid || crf.createdByUid || '',
    createdAt: crf.createdAt || now,
    updatedAt: now,
  };
  data.patients.unshift(created);
  writeDatabase(data, storePath);
  return created;
}

export function updateFallbackPatientRecord(
  id: number,
  crf: PatientCRF,
  storePath = DEFAULT_STORE_PATH
): StoredPatientRecord | null {
  const data = readDatabase(storePath);
  const idx = data.patients.findIndex((p) => p.id === id);
  if (idx < 0) return null;
  const existing = data.patients[idx];
  const updated: StoredPatientRecord = {
    ...crf,
    id,
    createdByUid: existing.createdByUid || crf.createdByUid || '',
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  data.patients[idx] = updated;
  writeDatabase(data, storePath);
  return updated;
}

export function deleteFallbackPatientRecord(
  id: number,
  storePath = DEFAULT_STORE_PATH
): boolean {
  const data = readDatabase(storePath);
  const next = data.patients.filter((p) => p.id !== id);
  if (next.length === data.patients.length) return false;
  data.patients = next;
  writeDatabase(data, storePath);
  return true;
}

export function getFallbackSheetSyncConfig(
  ownerUid: string,
  storePath = DEFAULT_STORE_PATH
): StoredSheetConfig | null {
  const data = readDatabase(storePath);
  return data.sheetSettings.find((s) => s.ownerUid === ownerUid) ?? null;
}

export function saveFallbackSheetSyncConfig(
  params: {
    ownerUid: string;
    spreadsheetId: string;
    spreadsheetUrl: string;
    sheetName: string;
  },
  storePath = DEFAULT_STORE_PATH
): StoredSheetConfig {
  const data = readDatabase(storePath);
  const now = new Date().toISOString();
  const idx = data.sheetSettings.findIndex((s) => s.ownerUid === params.ownerUid);
  if (idx >= 0) {
    const updated: StoredSheetConfig = {
      ...data.sheetSettings[idx],
      spreadsheetId: params.spreadsheetId,
      spreadsheetUrl: params.spreadsheetUrl,
      sheetName: params.sheetName,
      updatedAt: now,
    };
    data.sheetSettings[idx] = updated;
    writeDatabase(data, storePath);
    return updated;
  }
  const created: StoredSheetConfig = {
    id: data.nextSettingId++,
    ownerUid: params.ownerUid,
    spreadsheetId: params.spreadsheetId,
    spreadsheetUrl: params.spreadsheetUrl,
    sheetName: params.sheetName,
    updatedAt: now,
  };
  data.sheetSettings.push(created);
  writeDatabase(data, storePath);
  return created;
}
