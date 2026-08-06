-- ============================================================
-- Sistem e-Tempahan PLTT-JTM — Supabase Database Setup
-- ============================================================
-- Arahan Penggunaan:
-- 1. Pergi ke: https://supabase.com/dashboard/project/znoxwjnyxmttpqvwaike/sql/new
-- 2. Copy semua SQL di bawah
-- 3. Paste di Supabase SQL Editor
-- 4. Klik "Run" (atau tekan Ctrl+Enter)
-- 5. Tunggu sehingga "Success. No rows returned" muncul
-- ============================================================

-- ============================================================
-- BAHAGIAN 1: DROP TABLES (jika ulang)
-- ============================================================
DROP TABLE IF EXISTS "VerificationToken" CASCADE;
DROP TABLE IF EXISTS "Account" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Feedback" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "Notification" CASCADE;
DROP TABLE IF EXISTS "ApprovalLog" CASCADE;
DROP TABLE IF EXISTS "Booking" CASCADE;
DROP TABLE IF EXISTS "Facility" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- ============================================================
-- BAHAGIAN 2: CREATE TABLES
-- ============================================================

-- ── USER ────────────────────────────────────────────────────
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "department" TEXT,
  "phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'USER',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "staffId" TEXT,
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "lastLoginAt" TIMESTAMP(3),
  "lastLoginIp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── FACILITY ────────────────────────────────────────────────
CREATE TABLE "Facility" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "location" TEXT,
  "equipment" TEXT,
  "operatingStart" TEXT NOT NULL DEFAULT '08:00',
  "operatingEnd" TEXT NOT NULL DEFAULT '22:00',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "colorCode" TEXT NOT NULL DEFAULT '#0ea5e9',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── BOOKING ─────────────────────────────────────────────────
CREATE TABLE "Booking" (
  "id" TEXT PRIMARY KEY,
  "bookingRef" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "programName" TEXT,
  "participantCount" INTEGER NOT NULL,
  "equipmentNeeded" TEXT,
  "supportDocUrl" TEXT,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "adminNotes" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "recurringParentId" TEXT,
  "requiresMultiLevel" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "Booking_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE
);

-- ── APPROVAL LOG ────────────────────────────────────────────
CREATE TABLE "ApprovalLog" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "comment" TEXT,
  "previousStatus" TEXT,
  "newStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,
  CONSTRAINT "ApprovalLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── NOTIFICATION ────────────────────────────────────────────
CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "bookingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "module" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "details" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'INFO',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL
);

-- ── FEEDBACK ────────────────────────────────────────────────
CREATE TABLE "Feedback" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,
  CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── SESSION (NextAuth) ──────────────────────────────────────
CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "sessionToken" TEXT UNIQUE NOT NULL,
  "userId" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ── ACCOUNT (NextAuth OAuth) ────────────────────────────────
CREATE TABLE "Account" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "refresh_token" TEXT,
  "access_token" TEXT,
  "expires_at" INTEGER,
  "token_type" TEXT,
  "scope" TEXT,
  "id_token" TEXT,
  "session_state" TEXT
);

-- ── VERIFICATION TOKEN (NextAuth) ───────────────────────────
CREATE TABLE "VerificationToken" (
  "identifier" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

-- ============================================================
-- BAHAGIAN 3: CREATE INDEXES
-- ============================================================
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");
CREATE INDEX "Booking_facilityId_idx" ON "Booking"("facilityId");
CREATE INDEX "ApprovalLog_bookingId_idx" ON "ApprovalLog"("bookingId");
CREATE INDEX "ApprovalLog_adminId_idx" ON "ApprovalLog"("adminId");
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "Feedback_bookingId_idx" ON "Feedback"("bookingId");
CREATE INDEX "Feedback_userId_idx" ON "Feedback"("userId");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- ============================================================
-- BAHAGIAN 4: INSERT USERS (8 pengguna)
-- Password untuk semua: Password123!
-- ============================================================
INSERT INTO "User" ("id", "email", "name", "passwordHash", "department", "phone", "role", "status", "staffId", "createdAt", "updatedAt") VALUES
('user-001', 'admin@pltt.gov.my', 'Ahmad Faizal bin Rahman', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Unit ICT PLTT', '+6012-345 6789', 'SUPER_ADMIN', 'ACTIVE', 'PLTT-001', NOW(), NOW()),
('user-002', 'fadmin@pltt.gov.my', 'Siti Nurhaliza binti Hassan', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Unit Pentadbiran Kemudahan', '+6012-456 7890', 'FACILITY_ADMIN', 'ACTIVE', 'PLTT-002', NOW(), NOW()),
('user-003', 'fadmin2@pltt.gov.my', 'Mohd Hafiz bin Ibrahim', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Unit Pentadbiran Kemudahan', '+6013-111 2222', 'FACILITY_ADMIN', 'ACTIVE', 'PLTT-003', NOW(), NOW()),
('user-004', 'user1@pltt.gov.my', 'Noraini binti Yusof', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Jabatan Latihan Kemahiran', '+6012-567 8901', 'USER', 'ACTIVE', 'PLTT-101', NOW(), NOW()),
('user-005', 'user2@pltt.gov.my', 'Tan Chee Keong', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Jabatan Elektrik & Elektronik', '+6012-678 9012', 'USER', 'ACTIVE', 'PLTT-102', NOW(), NOW()),
('user-006', 'user3@pltt.gov.my', 'Priya a/p Kumaran', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Jabatan Mekanikal', '+6012-789 0123', 'USER', 'ACTIVE', 'PLTT-103', NOW(), NOW()),
('user-007', 'user4@pltt.gov.my', 'Wong Li Ling', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Jabatan Pengurusan', '+6012-890 1234', 'USER', 'ACTIVE', 'PLTT-104', NOW(), NOW()),
('user-008', 'user5@pltt.gov.my', 'Rahman bin Abdullah', '4afadf2ecea677fe73399a1c1cdfe670:e7df4182bfe28baf35d174417eff837811ed222ab90ecf12c8bea11c55f7e205eb042c79beb2fc5f6bc6f1156169f284f96120c7839383de23950aae9c255cb6', 'Jabatan Informatik', '+6013-234 5678', 'USER', 'ACTIVE', 'PLTT-105', NOW(), NOW());

-- ============================================================
-- BAHAGIAN 5: INSERT FACILITIES (6 kemudahan)
-- ============================================================
INSERT INTO "Facility" ("id", "name", "category", "capacity", "location", "equipment", "operatingStart", "operatingEnd", "status", "colorCode", "createdAt", "updatedAt") VALUES
('fac-001', 'Bilik Komputer 1', 'COMPUTER_ROOM', 30, 'Aras 1, Blok A', 'Projektor, 30 PC, Whiteboard, AC', '08:00', '22:00', 'ACTIVE', '#0ea5e9', NOW(), NOW()),
('fac-002', 'Bilik Komputer 2', 'COMPUTER_ROOM', 25, 'Aras 1, Blok A', 'Projektor, 25 PC, Whiteboard, AC', '08:00', '22:00', 'ACTIVE', '#14b8a6', NOW(), NOW()),
('fac-003', 'Bilik Komputer 3', 'COMPUTER_ROOM', 40, 'Aras 2, Blok A', 'Projektor, 40 PC, Smart Board, AC', '08:00', '22:00', 'ACTIVE', '#f59e0b', NOW(), NOW()),
('fac-004', 'Dewan Kuliah Utama', 'LECTURE_HALL', 200, 'Aras G, Blok Pentadbiran', 'Projektor Besar, Audio System, Mikrofon, Panggung, AC', '08:00', '22:00', 'ACTIVE', '#ef4444', NOW(), NOW()),
('fac-005', 'Dewan Kuliah 2', 'LECTURE_HALL', 120, 'Aras 1, Blok Pentadbiran', 'Projektor, Audio System, Mikrofon, AC', '08:00', '22:00', 'ACTIVE', '#a855f7', NOW(), NOW()),
('fac-006', 'Bilik Komputer 4 (Makmal R&D)', 'COMPUTER_ROOM', 20, 'Aras 3, Blok B', '20 PC Workstation, RISC-V Boards, 3D Printer', '08:00', '22:00', 'MAINTENANCE', '#ec4899', NOW(), NOW());

-- ============================================================
-- BAHAGIAN 6: INSERT BOOKINGS (22 tempahan)
-- Tarikh relatif ke tarikh hari ini (CURRENT_DATE)
-- ============================================================
INSERT INTO "Booking" ("id", "bookingRef", "userId", "facilityId", "eventDate", "startTime", "endTime", "purpose", "programName", "participantCount", "status", "rejectionReason", "requiresMultiLevel", "createdAt", "updatedAt") VALUES
-- Past — completed (5)
('book-001', 'TEMP-2026-0001', 'user-004', 'fac-001', CURRENT_DATE - 10, '09:00', '12:00', 'Kelas Latihan AWS Cloud Practitioner', 'AWS Cloud Practitioner Bootcamp', 28, 'COMPLETED', NULL, false, NOW(), NOW()),
('book-002', 'TEMP-2026-0002', 'user-005', 'fac-004', CURRENT_DATE - 7, '14:00', '17:00', 'Mesyuarat Agung Tahunan PLTT', 'Majlis AGM PLTT 2026', 180, 'COMPLETED', NULL, false, NOW(), NOW()),
('book-003', 'TEMP-2026-0003', 'user-006', 'fac-002', CURRENT_DATE - 5, '08:30', '11:30', 'Sesi Latihan PLC Programming', 'Industrial Automation Course', 22, 'COMPLETED', NULL, false, NOW(), NOW()),
('book-004', 'TEMP-2026-0004', 'user-007', 'fac-005', CURRENT_DATE - 3, '13:00', '15:00', 'Taklimat Keselamatan ICT', 'Cybersecurity Briefing', 100, 'COMPLETED', NULL, false, NOW(), NOW()),
('book-005', 'TEMP-2026-0005', 'user-004', 'fac-003', CURRENT_DATE - 2, '09:00', '13:00', 'Workshop Machine Learning', 'AI/ML Workshop', 38, 'COMPLETED', NULL, false, NOW(), NOW()),

-- Today (2)
('book-006', 'TEMP-2026-0006', 'user-005', 'fac-001', CURRENT_DATE, '09:00', '12:00', 'Kelas Pengaturcaraan Python', 'Python Programming Class', 28, 'APPROVED', NULL, false, NOW(), NOW()),
('book-007', 'TEMP-2026-0007', 'user-006', 'fac-004', CURRENT_DATE, '14:00', '17:00', 'Kuliah Umum: AI for Industry 4.0', 'Public Lecture Series', 150, 'APPROVED', NULL, false, NOW(), NOW()),

-- Tomorrow (2)
('book-008', 'TEMP-2026-0008', 'user-007', 'fac-003', CURRENT_DATE + 1, '08:30', '12:30', 'Ujian Sertifikasi CompTIA A+', 'CompTIA Certification Exam', 35, 'APPROVED', NULL, false, NOW(), NOW()),
('book-009', 'TEMP-2026-0009', 'user-008', 'fac-002', CURRENT_DATE + 1, '13:00', '16:00', 'Latihan Pengendalian IoT Edge', 'IoT Edge Training', 20, 'PENDING', NULL, false, NOW(), NOW()),

-- +2 to +5 days (6)
('book-010', 'TEMP-2026-0010', 'user-004', 'fac-005', CURRENT_DATE + 2, '09:00', '11:00', 'Briefing Latihan Industri', 'Industrial Training Briefing', 90, 'PENDING', NULL, false, NOW(), NOW()),
('book-011', 'TEMP-2026-0011', 'user-005', 'fac-004', CURRENT_DATE + 3, '10:00', '13:00', 'Mesyuarat Penyelarasan JTM', 'JTM Coordination Meeting', 120, 'PENDING', NULL, false, NOW(), NOW()),
('book-012', 'TEMP-2026-0012', 'user-006', 'fac-001', CURRENT_DATE + 4, '14:00', '17:00', 'Workshop Figma UI/UX', 'UI/UX Design Workshop', 25, 'APPROVED', NULL, false, NOW(), NOW()),
('book-013', 'TEMP-2026-0013', 'user-007', 'fac-003', CURRENT_DATE + 5, '08:00', '12:00', 'Demo Hari Terbuka PLTT', 'PLTT Open Day Demo', 40, 'PENDING', NULL, false, NOW(), NOW()),
('book-014', 'TEMP-2026-0014', 'user-008', 'fac-002', CURRENT_DATE + 5, '14:00', '16:00', 'Latihan DevOps CI/CD', 'DevOps Training', 20, 'PENDING', NULL, false, NOW(), NOW()),

-- +7 to +14 days (5)
('book-015', 'TEMP-2026-0015', 'user-004', 'fac-004', CURRENT_DATE + 7, '09:00', '17:00', 'Konvokesyen PLTT 2026', 'PLTT Convocation Ceremony', 200, 'PENDING', NULL, true, NOW(), NOW()),
('book-016', 'TEMP-2026-0016', 'user-005', 'fac-005', CURRENT_DATE + 8, '10:00', '12:00', 'Kursus Pengurusan Projek', 'Project Management Course', 80, 'APPROVED', NULL, false, NOW(), NOW()),
('book-017', 'TEMP-2026-0017', 'user-006', 'fac-001', CURRENT_DATE + 10, '13:00', '16:00', 'Latihan Kubernetes', 'Kubernetes Workshop', 28, 'APPROVED', NULL, false, NOW(), NOW()),
('book-018', 'TEMP-2026-0018', 'user-007', 'fac-003', CURRENT_DATE + 12, '09:00', '13:00', 'Hackathon Inovasi PLTT', 'PLTT Innovation Hackathon', 40, 'PENDING', NULL, false, NOW(), NOW()),
('book-019', 'TEMP-2026-0019', 'user-008', 'fac-004', CURRENT_DATE + 14, '14:00', '17:00', 'Ceramah Kerjaya Teknologi', 'Tech Career Talk', 180, 'PENDING', NULL, false, NOW(), NOW()),

-- Past rejected (2)
('book-020', 'TEMP-2026-0020', 'user-004', 'fac-002', CURRENT_DATE - 1, '14:00', '17:00', 'Latihan Tambahan (ditolak - konflik)', 'Extra Training Session', 25, 'REJECTED', 'Bertindih dengan program rasmi PLTT. Sila pilih tarikh/masa alternatif.', false, NOW(), NOW()),
('book-021', 'TEMP-2026-0021', 'user-005', 'fac-001', CURRENT_DATE - 4, '09:00', '12:00', 'Latihan Networking (ditolak - kapasiti)', 'Networking Workshop', 35, 'REJECTED', 'Bertindih dengan program rasmi PLTT. Sila pilih tarikh/masa alternatif.', false, NOW(), NOW()),

-- Cancelled (1)
('book-022', 'TEMP-2026-0022', 'user-006', 'fac-005', CURRENT_DATE + 6, '10:00', '12:00', 'Taklimat ditangguhkan', 'Postponed Briefing', 60, 'CANCELLED', NULL, false, NOW(), NOW());

-- ============================================================
-- BAHAGIAN 7: INSERT APPROVAL LOGS (17 log kelulusan)
-- ============================================================
INSERT INTO "ApprovalLog" ("id", "bookingId", "adminId", "action", "comment", "previousStatus", "newStatus", "createdAt") VALUES
('alog-001', 'book-001', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'COMPLETED', NOW() - INTERVAL '10 days'),
('alog-002', 'book-002', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'COMPLETED', NOW() - INTERVAL '7 days'),
('alog-003', 'book-003', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'COMPLETED', NOW() - INTERVAL '5 days'),
('alog-004', 'book-004', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'COMPLETED', NOW() - INTERVAL '3 days'),
('alog-005', 'book-005', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'COMPLETED', NOW() - INTERVAL '2 days'),
('alog-006', 'book-006', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW() - INTERVAL '1 day'),
('alog-007', 'book-007', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW() - INTERVAL '1 day'),
('alog-008', 'book-008', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW() - INTERVAL '1 day'),
('alog-009', 'book-012', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW()),
('alog-010', 'book-016', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW()),
('alog-011', 'book-017', 'user-002', 'APPROVE', 'Diluluskan - sila pastikan kehadiran tepat pada masa.', 'PENDING', 'APPROVED', NOW()),
('alog-012', 'book-020', 'user-002', 'REJECT', 'Bertindih dengan program rasmi', 'PENDING', 'REJECTED', NOW() - INTERVAL '1 day'),
('alog-013', 'book-021', 'user-002', 'REJECT', 'Bertindih dengan program rasmi', 'PENDING', 'REJECTED', NOW() - INTERVAL '4 days'),
('alog-014', 'book-022', 'user-002', 'CANCEL', 'Dibatalkan oleh pemohon', 'PENDING', 'CANCELLED', NOW());

-- ============================================================
-- BAHAGIAN 8: INSERT NOTIFICATIONS (22 notifikasi)
-- ============================================================
INSERT INTO "Notification" ("id", "userId", "type", "title", "content", "isRead", "bookingId", "createdAt") VALUES
-- Completed bookings (notifications are read for old ones)
('notif-001', 'user-004', 'IN_APP', 'Tempahan TEMP-2026-0001 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 1 telah DILULUSKAN.', true, 'book-001', NOW() - INTERVAL '10 days'),
('notif-002', 'user-005', 'IN_APP', 'Tempahan TEMP-2026-0002 Diluluskan', 'Permohonan tempahan anda untuk Dewan Kuliah Utama telah DILULUSKAN.', true, 'book-002', NOW() - INTERVAL '7 days'),
('notif-003', 'user-006', 'IN_APP', 'Tempahan TEMP-2026-0003 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 2 telah DILULUSKAN.', true, 'book-003', NOW() - INTERVAL '5 days'),
('notif-004', 'user-007', 'IN_APP', 'Tempahan TEMP-2026-0004 Diluluskan', 'Permohonan tempahan anda untuk Dewan Kuliah 2 telah DILULUSKAN.', false, 'book-004', NOW() - INTERVAL '3 days'),
('notif-005', 'user-004', 'IN_APP', 'Tempahan TEMP-2026-0005 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 3 telah DILULUSKAN.', false, 'book-005', NOW() - INTERVAL '2 days'),
-- Today
('notif-006', 'user-005', 'IN_APP', 'Tempahan TEMP-2026-0006 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 1 telah DILULUSKAN.', false, 'book-006', NOW() - INTERVAL '1 day'),
('notif-007', 'user-006', 'IN_APP', 'Tempahan TEMP-2026-0007 Diluluskan', 'Permohonan tempahan anda untuk Dewan Kuliah Utama telah DILULUSKAN.', false, 'book-007', NOW() - INTERVAL '1 day'),
-- Tomorrow
('notif-008', 'user-007', 'IN_APP', 'Tempahan TEMP-2026-0008 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 3 telah DILULUSKAN.', false, 'book-008', NOW() - INTERVAL '1 day'),
('notif-009', 'user-008', 'IN_APP', 'Tempahan TEMP-2026-0009 Diterima', 'Permohonan tempahan anda TEMP-2026-0009 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-009', NOW()),
-- +2 to +5 days
('notif-010', 'user-004', 'IN_APP', 'Tempahan TEMP-2026-0010 Diterima', 'Permohonan tempahan anda TEMP-2026-0010 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-010', NOW()),
('notif-011', 'user-005', 'IN_APP', 'Tempahan TEMP-2026-0011 Diterima', 'Permohonan tempahan anda TEMP-2026-0011 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-011', NOW()),
('notif-012', 'user-006', 'IN_APP', 'Tempahan TEMP-2026-0012 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 1 telah DILULUSKAN.', false, 'book-012', NOW()),
('notif-013', 'user-007', 'IN_APP', 'Tempahan TEMP-2026-0013 Diterima', 'Permohonan tempahan anda TEMP-2026-0013 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-013', NOW()),
('notif-014', 'user-008', 'IN_APP', 'Tempahan TEMP-2026-0014 Diterima', 'Permohonan tempahan anda TEMP-2026-0014 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-014', NOW()),
-- +7 to +14 days
('notif-015', 'user-004', 'IN_APP', 'Tempahan TEMP-2026-0015 Diterima', 'Permohonan tempahan anda TEMP-2026-0015 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-015', NOW()),
('notif-016', 'user-005', 'IN_APP', 'Tempahan TEMP-2026-0016 Diluluskan', 'Permohonan tempahan anda untuk Dewan Kuliah 2 telah DILULUSKAN.', false, 'book-016', NOW()),
('notif-017', 'user-006', 'IN_APP', 'Tempahan TEMP-2026-0017 Diluluskan', 'Permohonan tempahan anda untuk Bilik Komputer 1 telah DILULUSKAN.', false, 'book-017', NOW()),
('notif-018', 'user-007', 'IN_APP', 'Tempahan TEMP-2026-0018 Diterima', 'Permohonan tempahan anda TEMP-2026-0018 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-018', NOW()),
('notif-019', 'user-008', 'IN_APP', 'Tempahan TEMP-2026-0019 Diterima', 'Permohonan tempahan anda TEMP-2026-0019 telah diterima dan sedang menunggu kelulusan pentadbir.', false, 'book-019', NOW()),
-- Rejected
('notif-020', 'user-004', 'IN_APP', 'Tempahan TEMP-2026-0020 Ditolak', 'Permohonan tempahan anda untuk Bilik Komputer 2 telah DITOLAK. Sebab: Bertindih dengan program rasmi PLTT. Sila pilih tarikh/masa alternatif.', false, 'book-020', NOW() - INTERVAL '1 day'),
('notif-021', 'user-005', 'IN_APP', 'Tempahan TEMP-2026-0021 Ditolak', 'Permohonan tempahan anda untuk Bilik Komputer 1 telah DITOLAK. Sebab: Bertindih dengan program rasmi PLTT. Sila pilih tarikh/masa alternatif.', false, 'book-021', NOW() - INTERVAL '4 days'),
-- Cancelled
('notif-022', 'user-006', 'IN_APP', 'Tempahan TEMP-2026-0022 Dibatalkan', 'Tempahan anda TEMP-2026-0022 telah dibatalkan.', false, 'book-022', NOW());

-- ============================================================
-- BAHAGIAN 9: INSERT FEEDBACK (5 maklum balas)
-- ============================================================
INSERT INTO "Feedback" ("id", "bookingId", "userId", "rating", "comment", "createdAt") VALUES
('fb-001', 'book-001', 'user-004', 5, 'Kemudahan sangat selesa dan lengkap.', NOW() - INTERVAL '10 days'),
('fb-002', 'book-002', 'user-005', 4, 'Peralatan dalam keadaan baik.', NOW() - INTERVAL '7 days'),
('fb-003', 'book-003', 'user-006', 5, 'Kemudahan sangat selesa dan lengkap.', NOW() - INTERVAL '5 days'),
('fb-004', 'book-004', 'user-007', 4, 'Peralatan dalam keadaan baik.', NOW() - INTERVAL '3 days'),
('fb-005', 'book-005', 'user-004', 5, 'Kemudahan sangat selesa dan lengkap.', NOW() - INTERVAL '2 days');

-- ============================================================
-- BAHAGIAN 10: INSERT AUDIT LOGS (7 log audit)
-- ============================================================
INSERT INTO "AuditLog" ("id", "userId", "module", "action", "entity", "entityId", "ipAddress", "userAgent", "details", "severity", "createdAt") VALUES
('alog-sys-001', 'user-001', 'SYSTEM', 'SYSTEM_INITIALIZE', NULL, NULL, '192.168.1.10', 'Mozilla/5.0', '{"version":"1.0"}', 'INFO', NOW() - INTERVAL '6 hours'),
('alog-sys-002', 'user-001', 'USER_MGMT', 'BULK_USER_CREATE', 'User', NULL, '192.168.1.10', 'Mozilla/5.0', '{"count":8}', 'INFO', NOW() - INTERVAL '5 hours'),
('alog-sys-003', 'user-002', 'APPROVAL', 'APPROVAL_APPROVED', 'Booking', NULL, '192.168.1.11', 'Mozilla/5.0', NULL, 'INFO', NOW() - INTERVAL '4 hours'),
('alog-sys-004', 'user-004', 'BOOKING', 'BOOKING_CREATE', 'Booking', NULL, '192.168.1.12', 'Mozilla/5.0', NULL, 'INFO', NOW() - INTERVAL '3 hours'),
('alog-sys-005', 'user-005', 'BOOKING', 'BOOKING_CREATE', 'Booking', NULL, '192.168.1.13', 'Mozilla/5.0', NULL, 'INFO', NOW() - INTERVAL '2 hours'),
('alog-sys-006', 'user-002', 'APPROVAL', 'APPROVAL_REJECTED', 'Booking', NULL, '192.168.1.11', 'Mozilla/5.0', NULL, 'WARNING', NOW() - INTERVAL '1 hour'),
('alog-sys-007', 'user-001', 'FACILITY', 'FACILITY_MAINTENANCE_MODE', 'Facility', NULL, '192.168.1.10', 'Mozilla/5.0', '{"facility":"Bilik Komputer 4"}', 'WARNING', NOW());

-- ============================================================
-- SELESAI! 
-- ============================================================
-- Sahkan data telah dimasukkan:
-- SELECT COUNT(*) FROM "User";        -- Patut: 8
-- SELECT COUNT(*) FROM "Facility";    -- Patut: 6
-- SELECT COUNT(*) FROM "Booking";     -- Patut: 22
-- SELECT COUNT(*) FROM "ApprovalLog"; -- Patut: 14
-- SELECT COUNT(*) FROM "Notification";-- Patut: 22
-- SELECT COUNT(*) FROM "Feedback";    -- Patut: 5
-- SELECT COUNT(*) FROM "AuditLog";    -- Patut: 7
