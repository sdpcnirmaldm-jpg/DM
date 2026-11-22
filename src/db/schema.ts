import { relations } from 'drizzle-orm';
import { integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default(''),
  photoUrl: text('photo_url').notNull().default(''),
  role: text('role').notNull().default('researcher'), // 'owner' | 'researcher'
  status: text('status').notNull().default('pending'), // 'approved' | 'pending' | 'rejected'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  participantId: text('participant_id').notNull().unique(),
  uhid: text('uhid').notNull().default(''),
  patientName: text('patient_name').notNull().default(''),
  gender: text('gender').notNull().default(''),
  dob: text('dob').notNull().default(''),
  age: integer('age'),
  contactNumber: text('contact_number').notNull().default(''),
  bloodGroup: text('blood_group').notNull().default(''),
  dateOfRecruitment: text('date_of_recruitment').notNull().default(''),
  visitNo: text('visit_no').notNull().default(''),
  education: text('education').notNull().default(''),
  occupation: text('occupation').notNull().default(''),
  followUpDate: text('follow_up_date').notNull().default(''),
  clusterType: text('cluster_type').notNull().default(''),
  statusColor: text('status_color').notNull().default('red'), // 'green' | 'yellow' | 'orange' | 'red'
  crfData: jsonb('crf_data').notNull(),
  createdByUid: text('created_by_uid').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const studySettings = pgTable('study_settings', {
  id: serial('id').primaryKey(),
  ownerUid: text('owner_uid').notNull().unique(),
  spreadsheetId: text('spreadsheet_id').notNull().default(''),
  spreadsheetUrl: text('spreadsheet_url').notNull().default(''),
  sheetName: text('sheet_name').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  patients: many(patients),
}));

export const patientsRelations = relations(patients, ({ one }) => ({
  author: one(users, {
    fields: [patients.createdByUid],
    references: [users.uid],
  }),
}));
