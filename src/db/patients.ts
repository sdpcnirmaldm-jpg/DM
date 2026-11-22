import { desc, eq } from 'drizzle-orm';
import { assertSqlSocketAvailable, db } from './index.ts';
import { patients, studySettings } from './schema.ts';
import type { PatientCRF } from '../types/clinical.ts';
import {
  extractErrorMessage,
  isSqlUnavailableError,
  warnSqlProxyOnce,
} from './connectionStatus.ts';
import {
  createFallbackPatientRecord,
  deleteFallbackPatientRecord,
  getFallbackSheetSyncConfig,
  listFallbackPatients,
  saveFallbackSheetSyncConfig,
  updateFallbackPatientRecord,
} from './localFallbackStore.ts';

export async function listPatients() {
  try {
    assertSqlSocketAvailable();
    const rows = await db.select().from(patients).orderBy(desc(patients.updatedAt));
    return rows.map((row) => ({
      ...(row.crfData as PatientCRF),
      id: row.id,
      createdByUid: row.createdByUid,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    }));
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('listPatients', extractErrorMessage(error));
      return listFallbackPatients();
    }
    console.error('Database error in listPatients:', error);
    throw new Error('Failed to fetch patient records.', { cause: error });
  }
}

export async function createPatientRecord(crf: PatientCRF, createdByUid: string) {
  try {
    assertSqlSocketAvailable();
    const dbParticipantKey =
      crf.participantId.trim() ||
      crf.uhid.trim() ||
      `PT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const inserted = await db
      .insert(patients)
      .values({
        participantId: dbParticipantKey,
        uhid: crf.uhid,
        patientName: crf.patientName,
        gender: crf.gender,
        dob: crf.dob,
        age: crf.age,
        contactNumber: crf.contactNumber,
        bloodGroup: crf.bloodGroup,
        dateOfRecruitment: crf.dateOfRecruitment,
        visitNo: crf.visitNo,
        education: crf.education,
        occupation: crf.occupation,
        followUpDate: crf.followUpDate,
        clusterType: crf.clusterType,
        statusColor: crf.statusColor,
        crfData: crf,
        createdByUid,
      })
      .returning();

    const row = inserted[0];
    return {
      ...(row.crfData as PatientCRF),
      id: row.id,
      createdByUid: row.createdByUid,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    };
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('createPatientRecord', extractErrorMessage(error));
      return createFallbackPatientRecord(crf, createdByUid);
    }
    console.error('Database error in createPatientRecord:', error);
    throw new Error('Failed to save patient record.', { cause: error });
  }
}

export async function updatePatientRecord(id: number, crf: PatientCRF) {
  try {
    assertSqlSocketAvailable();
    const dbParticipantKey =
      crf.participantId.trim() ||
      crf.uhid.trim() ||
      `PT-${id}-${Date.now()}`;
    const updated = await db
      .update(patients)
      .set({
        participantId: dbParticipantKey,
        uhid: crf.uhid,
        patientName: crf.patientName,
        gender: crf.gender,
        dob: crf.dob,
        age: crf.age,
        contactNumber: crf.contactNumber,
        bloodGroup: crf.bloodGroup,
        dateOfRecruitment: crf.dateOfRecruitment,
        visitNo: crf.visitNo,
        education: crf.education,
        occupation: crf.occupation,
        followUpDate: crf.followUpDate,
        clusterType: crf.clusterType,
        statusColor: crf.statusColor,
        crfData: crf,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, id))
      .returning();

    const row = updated[0];
    if (!row) return null;
    return {
      ...(row.crfData as PatientCRF),
      id: row.id,
      createdByUid: row.createdByUid,
      createdAt: row.createdAt?.toISOString(),
      updatedAt: row.updatedAt?.toISOString(),
    };
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('updatePatientRecord', extractErrorMessage(error));
      return updateFallbackPatientRecord(id, crf);
    }
    console.error('Database error in updatePatientRecord:', error);
    throw new Error('Failed to update patient record.', { cause: error });
  }
}

export async function deletePatientRecord(id: number) {
  try {
    assertSqlSocketAvailable();
    const deleted = await db.delete(patients).where(eq(patients.id, id)).returning();
    return deleted.length > 0;
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('deletePatientRecord', extractErrorMessage(error));
      return deleteFallbackPatientRecord(id);
    }
    console.error('Database error in deletePatientRecord:', error);
    throw new Error('Failed to delete patient record.', { cause: error });
  }
}

export async function getSheetSyncConfig(ownerUid: string) {
  try {
    assertSqlSocketAvailable();
    const rows = await db
      .select()
      .from(studySettings)
      .where(eq(studySettings.ownerUid, ownerUid))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('getSheetSyncConfig', extractErrorMessage(error));
      return getFallbackSheetSyncConfig(ownerUid);
    }
    console.error('Database error in getSheetSyncConfig:', error);
    throw new Error('Failed to fetch Google Sheet sync settings.', { cause: error });
  }
}

export async function saveSheetSyncConfig(params: {
  ownerUid: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheetName: string;
}) {
  try {
    assertSqlSocketAvailable();
    const saved = await db
      .insert(studySettings)
      .values({
        ownerUid: params.ownerUid,
        spreadsheetId: params.spreadsheetId,
        spreadsheetUrl: params.spreadsheetUrl,
        sheetName: params.sheetName,
      })
      .onConflictDoUpdate({
        target: studySettings.ownerUid,
        set: {
          spreadsheetId: params.spreadsheetId,
          spreadsheetUrl: params.spreadsheetUrl,
          sheetName: params.sheetName,
          updatedAt: new Date(),
        },
      })
      .returning();
    return saved[0];
  } catch (error) {
    if (isSqlUnavailableError(error)) {
      warnSqlProxyOnce('saveSheetSyncConfig', extractErrorMessage(error));
      return saveFallbackSheetSyncConfig(params);
    }
    console.error('Database error in saveSheetSyncConfig:', error);
    throw new Error('Failed to save Google Sheet sync settings.', { cause: error });
  }
}
