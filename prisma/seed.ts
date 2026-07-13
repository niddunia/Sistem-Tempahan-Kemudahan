/**
 * Seed script for Sistem e-Tempahan PLTT-JTM
 * Populates dummy data per PRD requirements.
 * Run: bun run db:seed  (or: bun prisma/seed.ts)
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/crypto';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Sistem e-Tempahan PLTT-JTM...');

  // ── USERS ────────────────────────────────────────────────────────────────
  const pw = await hashPassword('Password123!');
  const users = [
    {
      email: 'admin@pltt.gov.my',
      name: 'Ahmad Faizal bin Rahman',
      role: 'SUPER_ADMIN',
      department: 'Unit ICT PLTT',
      phone: '+6012-345 6789',
      staffId: 'PLTT-001',
    },
    {
      email: 'fadmin@pltt.gov.my',
      name: 'Siti Nurhaliza binti Hassan',
      role: 'FACILITY_ADMIN',
      department: 'Unit Pentadbiran Kemudahan',
      phone: '+6012-456 7890',
      staffId: 'PLTT-002',
    },
    {
      email: 'fadmin2@pltt.gov.my',
      name: 'Mohd Hafiz bin Ibrahim',
      role: 'FACILITY_ADMIN',
      department: 'Unit Pentadbiran Kemudahan',
      phone: '+6013-111 2222',
      staffId: 'PLTT-003',
    },
    {
      email: 'user1@pltt.gov.my',
      name: 'Noraini binti Yusof',
      role: 'USER',
      department: 'Jabatan Latihan Kemahiran',
      phone: '+6012-567 8901',
      staffId: 'PLTT-101',
    },
    {
      email: 'user2@pltt.gov.my',
      name: 'Tan Chee Keong',
      role: 'USER',
      department: 'Jabatan Elektrik & Elektronik',
      phone: '+6012-678 9012',
      staffId: 'PLTT-102',
    },
    {
      email: 'user3@pltt.gov.my',
      name: 'Priya a/p Kumaran',
      role: 'USER',
      department: 'Jabatan Mekanikal',
      phone: '+6012-789 0123',
      staffId: 'PLTT-103',
    },
    {
      email: 'user4@pltt.gov.my',
      name: 'Wong Li Ling',
      role: 'USER',
      department: 'Jabatan Pengurusan',
      phone: '+6012-890 1234',
      staffId: 'PLTT-104',
    },
    {
      email: 'user5@pltt.gov.my',
      name: 'Rahman bin Abdullah',
      role: 'USER',
      department: 'Jabatan Informatik',
      phone: '+6013-234 5678',
      staffId: 'PLTT-105',
    },
  ];

  const createdUsers = [];
  for (const u of users) {
    const user = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        department: u.department,
        phone: u.phone,
        staffId: u.staffId,
        passwordHash: pw,
        status: 'ACTIVE',
      },
    });
    createdUsers.push(user);
  }
  console.log(`  ✓ ${createdUsers.length} users seeded`);

  // ── FACILITIES ───────────────────────────────────────────────────────────
  const facilities = [
    {
      name: 'Bilik Komputer 1',
      category: 'COMPUTER_ROOM',
      capacity: 30,
      location: 'Aras 1, Blok A',
      equipment: 'Projektor, 30 PC, Whiteboard, AC',
      colorCode: '#0ea5e9',
    },
    {
      name: 'Bilik Komputer 2',
      category: 'COMPUTER_ROOM',
      capacity: 25,
      location: 'Aras 1, Blok A',
      equipment: 'Projektor, 25 PC, Whiteboard, AC',
      colorCode: '#14b8a6',
    },
    {
      name: 'Bilik Komputer 3',
      category: 'COMPUTER_ROOM',
      capacity: 40,
      location: 'Aras 2, Blok A',
      equipment: 'Projektor, 40 PC, Smart Board, AC',
      colorCode: '#f59e0b',
    },
    {
      name: 'Dewan Kuliah Utama',
      category: 'LECTURE_HALL',
      capacity: 200,
      location: 'Aras G, Blok Pentadbiran',
      equipment: 'Projektor Besar, Audio System, Mikrofon, Panggung, AC',
      colorCode: '#ef4444',
    },
    {
      name: 'Dewan Kuliah 2',
      category: 'LECTURE_HALL',
      capacity: 120,
      location: 'Aras 1, Blok Pentadbiran',
      equipment: 'Projektor, Audio System, Mikrofon, AC',
      colorCode: '#a855f7',
    },
    {
      name: 'Bilik Komputer 4 (Makmal R&D)',
      category: 'COMPUTER_ROOM',
      capacity: 20,
      location: 'Aras 3, Blok B',
      equipment: '20 PC Workstation, RISC-V Boards, 3D Printer',
      colorCode: '#ec4899',
      status: 'MAINTENANCE',
    },
  ];

  const createdFacilities = [];
  for (const f of facilities) {
    const fac = await db.facility.create({ data: f });
    createdFacilities.push(fac);
  }
  console.log(`  ✓ ${createdFacilities.length} facilities seeded`);

  // ── BOOKINGS ─────────────────────────────────────────────────────────────
  const today = new Date();
  const fmt = (d: Date) => d.toISOString();

  // helper to add days
  const addDays = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  type BookingSeed = {
    userIdx: number;
    facIdx: number;
    dateOffset: number;
    start: string;
    end: string;
    purpose: string;
    programName: string;
    participants: number;
    status: string;
    equipment?: string;
  };

  const bookingSeeds: BookingSeed[] = [
    // Past — completed
    { userIdx: 3, facIdx: 0, dateOffset: -10, start: '09:00', end: '12:00', purpose: 'Kelas Latihan AWS Cloud Practitioner', programName: 'AWS Cloud Practitioner Bootcamp', participants: 28, status: 'COMPLETED' },
    { userIdx: 4, facIdx: 3, dateOffset: -7, start: '14:00', end: '17:00', purpose: 'Mesyuarat Agung Tahunan PLTT', programName: 'Majlis AGM PLTT 2026', participants: 180, status: 'COMPLETED' },
    { userIdx: 5, facIdx: 1, dateOffset: -5, start: '08:30', end: '11:30', purpose: 'Sesi Latihan PLC Programming', programName: 'Industrial Automation Course', participants: 22, status: 'COMPLETED' },
    { userIdx: 6, facIdx: 4, dateOffset: -3, start: '13:00', end: '15:00', purpose: 'Taklimat Keselamatan ICT', programName: 'Cybersecurity Briefing', participants: 100, status: 'COMPLETED' },
    { userIdx: 3, facIdx: 2, dateOffset: -2, start: '09:00', end: '13:00', purpose: 'Workshop Machine Learning', programName: 'AI/ML Workshop', participants: 38, status: 'COMPLETED' },

    // Today
    { userIdx: 4, facIdx: 0, dateOffset: 0, start: '09:00', end: '12:00', purpose: 'Kelas Pengaturcaraan Python', programName: 'Python Programming Class', participants: 28, status: 'APPROVED' },
    { userIdx: 5, facIdx: 3, dateOffset: 0, start: '14:00', end: '17:00', purpose: 'Kulium Umum: AI for Industry 4.0', programName: 'Public Lecture Series', participants: 150, status: 'APPROVED' },

    // Tomorrow
    { userIdx: 6, facIdx: 2, dateOffset: 1, start: '08:30', end: '12:30', purpose: 'Ujian Sertifikasi CompTIA A+', programName: 'CompTIA Certification Exam', participants: 35, status: 'APPROVED' },
    { userIdx: 7, facIdx: 1, dateOffset: 1, start: '13:00', end: '16:00', purpose: 'Latihan Pengendalian IoT Edge', programName: 'IoT Edge Training', participants: 20, status: 'PENDING' },

    // +2 to +5 days
    { userIdx: 3, facIdx: 4, dateOffset: 2, start: '09:00', end: '11:00', purpose: 'Briefing Latihan Industri', programName: 'Industrial Training Briefing', participants: 90, status: 'PENDING' },
    { userIdx: 4, facIdx: 3, dateOffset: 3, start: '10:00', end: '13:00', purpose: 'Mesyuarat Penyelarasan JTM', programName: 'JTM Coordination Meeting', participants: 120, status: 'PENDING' },
    { userIdx: 5, facIdx: 0, dateOffset: 4, start: '14:00', end: '17:00', purpose: 'Workshop Figma UI/UX', programName: 'UI/UX Design Workshop', participants: 25, status: 'APPROVED' },
    { userIdx: 6, facIdx: 2, dateOffset: 5, start: '08:00', end: '12:00', purpose: 'Demo Hari Terbuka PLTT', programName: 'PLTT Open Day Demo', participants: 40, status: 'PENDING' },
    { userIdx: 7, facIdx: 1, dateOffset: 5, start: '14:00', end: '16:00', purpose: 'Latihan DevOps CI/CD', programName: 'DevOps Training', participants: 20, status: 'PENDING' },

    // +7 to +14 days
    { userIdx: 3, facIdx: 3, dateOffset: 7, start: '09:00', end: '17:00', purpose: 'Konvokesyen PLTT 2026', programName: 'PLTT Convocation Ceremony', participants: 200, status: 'PENDING', requiresMultiLevel: true },
    { userIdx: 4, facIdx: 4, dateOffset: 8, start: '10:00', end: '12:00', purpose: 'Kursus Pengurusan Projek', programName: 'Project Management Course', participants: 80, status: 'APPROVED' },
    { userIdx: 5, facIdx: 0, dateOffset: 10, start: '13:00', end: '16:00', purpose: 'Latihan Kubernetes', programName: 'Kubernetes Workshop', participants: 28, status: 'APPROVED' },
    { userIdx: 6, facIdx: 2, dateOffset: 12, start: '09:00', end: '13:00', purpose: 'Hackathon Inovasi PLTT', programName: 'PLTT Innovation Hackathon', participants: 40, status: 'PENDING' },
    { userIdx: 7, facIdx: 3, dateOffset: 14, start: '14:00', end: '17:00', purpose: 'Ceramah Kerjaya Teknologi', programName: 'Tech Career Talk', participants: 180, status: 'PENDING' },

    // Past rejected
    { userIdx: 3, facIdx: 1, dateOffset: -1, start: '14:00', end: '17:00', purpose: 'Latihan Tambahan (ditolak - konflik)', programName: 'Extra Training Session', participants: 25, status: 'REJECTED' },
    { userIdx: 4, facIdx: 0, dateOffset: -4, start: '09:00', end: '12:00', purpose: 'Latihan Networking (ditolak - kapasiti)', programName: 'Networking Workshop', participants: 35, status: 'REJECTED' },

    // Cancelled
    { userIdx: 5, facIdx: 4, dateOffset: 6, start: '10:00', end: '12:00', purpose: 'Taklimat ditangguhkan', programName: 'Postponed Briefing', participants: 60, status: 'CANCELLED' },
  ];

  let seq = 1;
  for (const b of bookingSeeds) {
    const user = createdUsers[b.userIdx];
    const fac = createdFacilities[b.facIdx];
    const date = addDays(b.dateOffset);
    const ref = `TEMP-2026-${String(seq).padStart(4, '0')}`;
    seq++;

    const booking = await db.booking.create({
      data: {
        bookingRef: ref,
        userId: user.id,
        facilityId: fac.id,
        eventDate: date,
        startTime: b.start,
        endTime: b.end,
        purpose: b.purpose,
        programName: b.programName,
        participantCount: b.participants,
        equipmentNeeded: b.equipment ?? null,
        status: b.status,
        requiresMultiLevel: b.requiresMultiLevel ?? false,
        rejectionReason: b.status === 'REJECTED' ? 'Bertindih dengan program rasmi PLTT. Sila pilih tarikh/masa alternatif.' : null,
      },
    });

    // Create approval log for non-pending bookings
    if (b.status !== 'PENDING') {
      const admin = createdUsers[1]; // Siti - facility admin
      await db.approvalLog.create({
        data: {
          bookingId: booking.id,
          adminId: admin.id,
          action: b.status === 'APPROVED' ? 'APPROVE' : b.status === 'REJECTED' ? 'REJECT' : b.status === 'COMPLETED' ? 'APPROVE' : 'CANCEL',
          comment: b.status === 'REJECTED' ? 'Bertindih dengan program rasmi' : b.status === 'APPROVED' || b.status === 'COMPLETED' ? 'Diluluskan - sila pastikan kehadiran tepat pada masa.' : 'Dibatalkan oleh pemohon',
          previousStatus: 'PENDING',
          newStatus: b.status,
          createdAt: new Date(date.getTime() - (b.dateOffset >= 0 ? 86400000 : 0)),
        },
      });
    }

    // Create notification to user
    const title =
      b.status === 'APPROVED' || b.status === 'COMPLETED'
        ? `Tempahan ${ref} Diluluskan`
        : b.status === 'REJECTED'
          ? `Tempahan ${ref} Ditolak`
          : b.status === 'CANCELLED'
            ? `Tempahan ${ref} Dibatalkan`
            : `Tempahan ${ref} Diterima`;
    const content =
      b.status === 'APPROVED' || b.status === 'COMPLETED'
        ? `Permohonan tempahan anda untuk ${fac.name} pada ${date.toLocaleDateString('ms-MY')} (${b.start}-${b.end}) telah DILULUSKAN.`
        : b.status === 'REJECTED'
          ? `Permohonan tempahan anda untuk ${fac.name} telah DITOLAK. Sebab: ${booking.rejectionReason}`
          : b.status === 'CANCELLED'
            ? `Tempahan anda ${ref} telah dibatalkan.`
            : `Permohonan tempahan anda ${ref} telah diterima dan sedang menunggu kelulusan pentadbir.`;
    await db.notification.create({
      data: {
        userId: user.id,
        type: 'IN_APP',
        title,
        content,
        isRead: b.dateOffset < -2, // older ones are read
        bookingId: booking.id,
      },
    });
  }
  console.log(`  ✓ ${bookingSeeds.length} bookings seeded`);

  // ── FEEDBACK for completed bookings ──────────────────────────────────────
  const completedBookings = await db.booking.findMany({ where: { status: 'COMPLETED' } });
  for (const b of completedBookings) {
    const ratings = [5, 4, 5, 4, 5];
    const idx = completedBookings.indexOf(b);
    await db.feedback.create({
      data: {
        bookingId: b.id,
        userId: b.userId,
        rating: ratings[idx % ratings.length],
        comment: idx % 2 === 0 ? 'Kemudahan sangat selesa dan lengkap.' : 'Peralatan dalam keadaan baik.',
      },
    });
  }
  console.log(`  ✓ ${completedBookings.length} feedback entries seeded`);

  // ── AUDIT LOG ────────────────────────────────────────────────────────────
  const sampleAuditActions = [
    { userId: createdUsers[0].id, module: 'SYSTEM', action: 'SYSTEM_INITIALIZE', severity: 'INFO' },
    { userId: createdUsers[0].id, module: 'USER_MGMT', action: 'BULK_USER_CREATE', details: { count: 8 }, severity: 'INFO' },
    { userId: createdUsers[1].id, module: 'APPROVAL', action: 'APPROVAL_APPROVED', severity: 'INFO' },
    { userId: createdUsers[3].id, module: 'BOOKING', action: 'BOOKING_CREATE', severity: 'INFO' },
    { userId: createdUsers[4].id, module: 'BOOKING', action: 'BOOKING_CREATE', severity: 'INFO' },
    { userId: createdUsers[1].id, module: 'APPROVAL', action: 'APPROVAL_REJECTED', severity: 'WARNING' },
    { userId: createdUsers[0].id, module: 'FACILITY', action: 'FACILITY_MAINTENANCE_MODE', severity: 'WARNING', details: { facility: 'Bilik Komputer 4' } },
  ];
  for (let i = 0; i < sampleAuditActions.length; i++) {
    const a = sampleAuditActions[i];
    await db.auditLog.create({
      data: {
        ...a,
        details: a.details ? JSON.stringify(a.details) : null,
        ipAddress: '192.168.1.' + (10 + i),
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(Date.now() - i * 3600000),
      },
    });
  }
  console.log(`  ✓ ${sampleAuditActions.length} audit log entries seeded`);

  console.log('✅ Seed complete!');
  console.log('   Default login: admin@pltt.gov.my / Password123!');
  console.log('                  fadmin@pltt.gov.my / Password123!');
  console.log('                  user1@pltt.gov.my / Password123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
