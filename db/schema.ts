import { mysqlTable, varchar, text, int, boolean, mysqlEnum, index, uniqueIndex } from 'drizzle-orm/mysql-core';

const id = () => varchar('id', { length: 36 }).primaryKey();
const instant = (name: string) => varchar(name, { length: 24 });

export const users = mysqlTable('hadir_users', {
  id: id(), username: varchar('username', { length: 80 }).notNull(),
  name: varchar('name', { length: 120 }).notNull(), passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  createdAt: instant('created_at').notNull(),
}, t => [uniqueIndex('hadir_users_username_uq').on(t.username)]);

export const sessions = mysqlTable('hadir_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  userId: varchar('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: instant('expires_at').notNull(), createdAt: instant('created_at').notNull(),
}, t => [index('hadir_sessions_user_idx').on(t.userId), index('hadir_sessions_expiry_idx').on(t.expiresAt)]);

export const loginAttempts = mysqlTable('hadir_login_attempts', {
  key: varchar('attempt_key', { length: 64 }).primaryKey(),
  failures: int('failures').notNull(), windowStart: instant('window_start').notNull(),
});

export const workspaces = mysqlTable('hadir_workspaces', {
  ownerId: varchar('owner_id', { length: 36 }).primaryKey().references(() => users.id),
  name: varchar('name', { length: 80 }).notNull().default('My workspace'),
  createdAt: instant('created_at').notNull(),
});

export const schedules = mysqlTable('hadir_schedules', {
  id: varchar('id', { length: 80 }).primaryKey(),
  ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  name: varchar('name', { length: 80 }).notNull(), startTime: varchar('start_time', { length: 5 }).notNull(),
  endTime: varchar('end_time', { length: 5 }).notNull(), breakMinutes: int('break_minutes').notNull().default(60),
  graceMinutes: int('grace_minutes').notNull().default(10), weekdays: varchar('weekdays', { length: 13 }).notNull().default('1,2,3,4,5'),
}, t => [index('hadir_schedules_owner_idx').on(t.ownerId)]);

export const employees = mysqlTable('hadir_employees', {
  id: id(), ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  code: varchar('code', { length: 30 }).notNull(), name: varchar('name', { length: 120 }).notNull(),
  department: varchar('department', { length: 80 }).notNull(),
  scheduleId: varchar('schedule_id', { length: 80 }).notNull().references(() => schedules.id),
  deviceUserId: varchar('device_user_id', { length: 60 }), active: boolean('active').notNull().default(true),
  isSample: boolean('is_sample').notNull().default(false), startDate: varchar('start_date', { length: 10 }).notNull(),
  endDate: varchar('end_date', { length: 10 }), createdAt: instant('created_at').notNull(),
}, t => [uniqueIndex('hadir_employees_code_uq').on(t.ownerId, t.code), index('hadir_employees_owner_idx').on(t.ownerId)]);

export const devices = mysqlTable('hadir_devices', {
  id: id(), ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  name: varchar('name', { length: 80 }).notNull(), brand: varchar('brand', { length: 60 }).notNull(),
  model: varchar('model', { length: 80 }).notNull(), serialNumber: varchar('serial_number', { length: 100 }),
  method: varchar('method', { length: 30 }).notNull().default('Not selected'), createdAt: instant('created_at').notNull(),
}, t => [index('hadir_devices_owner_idx').on(t.ownerId)]);

export const punches = mysqlTable('hadir_punches', {
  id: id(), ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  employeeId: varchar('employee_id', { length: 36 }).notNull().references(() => employees.id),
  timestamp: instant('timestamp').notNull(), kind: mysqlEnum('kind', ['IN', 'OUT']).notNull(),
  source: mysqlEnum('source', ['manual', 'csv', 'sample', 'kiosk', 'face']).notNull(),
  deviceId: varchar('device_id', { length: 36 }).references(() => devices.id),
  note: varchar('note', { length: 240 }).notNull().default(''), dedupeKey: varchar('dedupe_key', { length: 150 }).notNull(),
  createdAt: instant('created_at').notNull(),
}, t => [uniqueIndex('hadir_punches_dedupe_uq').on(t.ownerId, t.dedupeKey), index('hadir_punches_owner_time_idx').on(t.ownerId, t.timestamp)]);

export const employeePins = mysqlTable('hadir_employee_pins', {
  employeeId: varchar('employee_id', { length: 36 }).primaryKey().references(() => employees.id, { onDelete: 'cascade' }),
  ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  pinHash: varchar('pin_hash', { length: 255 }).notNull(), updatedAt: instant('updated_at').notNull(),
}, t => [index('hadir_employee_pins_owner_idx').on(t.ownerId)]);

export const kioskSessions = mysqlTable('hadir_kiosk_sessions', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  expiresAt: instant('expires_at').notNull(), createdAt: instant('created_at').notNull(),
}, t => [index('hadir_kiosk_sessions_owner_idx').on(t.ownerId), index('hadir_kiosk_sessions_expiry_idx').on(t.expiresAt)]);

export const kioskAttempts = mysqlTable('hadir_kiosk_attempts', {
  key: varchar('attempt_key', { length: 64 }).primaryKey(),
  failures: int('failures').notNull(), windowStart: instant('window_start').notNull(),
});

export const employeeFaces = mysqlTable('hadir_employee_faces', {
  employeeId: varchar('employee_id', { length: 36 }).primaryKey().references(() => employees.id, { onDelete: 'cascade' }),
  ownerId: varchar('owner_id', { length: 36 }).notNull().references(() => workspaces.ownerId),
  template: text('template').notNull(), model: varchar('model', { length: 60 }).notNull(), updatedAt: instant('updated_at').notNull(),
}, t => [index('hadir_employee_faces_owner_idx').on(t.ownerId)]);

export const faceChallenges = mysqlTable('hadir_face_challenges', {
  tokenHash: varchar('token_hash', { length: 64 }).primaryKey(),
  kioskTokenHash: varchar('kiosk_token_hash', { length: 64 }).notNull().references(() => kioskSessions.tokenHash, { onDelete: 'cascade' }),
  ownerId: varchar('owner_id', { length: 36 }).notNull(),
  employeeId: varchar('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  expiresAt: instant('expires_at').notNull(),
}, t => [index('hadir_face_challenges_kiosk_idx').on(t.kioskTokenHash), index('hadir_face_challenges_expiry_idx').on(t.expiresAt)]);
