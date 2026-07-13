/**
 * GET  /api/bookings              — list (with filters; role-aware)
 * POST /api/bookings              — create a new booking request
 *
 * PRD FR-01: Permohonan Tempahan
 * PRD FR-05: Kalendar keseluruhan tempahan
 * Security: bookingRef uniqueness, conflict check, audit log
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, badRequest, unauthenticated, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { checkBookingConflict } from '@/lib/booking-conflict';
import { generateBookingRef } from '@/lib/crypto';
import { isFacilityAdminOrAbove } from '@/lib/rbac';

const createSchema = z.object({
  facilityId: z.string().min(1),
  eventDate: z.string().min(1), // ISO date string
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  purpose: z.string().min(3).max(300),
  programName: z.string().max(200).optional().nullable(),
  participantCount: z.number().int().min(1).max(1000),
  equipmentNeeded: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  isDraft: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const facilityId = url.searchParams.get('facilityId');
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const scope = url.searchParams.get('scope'); // 'me' | 'all'
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)));

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (facilityId) where.facilityId = facilityId;

  // Date range filter
  if (from || to) {
    const range: Record<string, unknown> = {};
    if (from) range.gte = new Date(from);
    if (to) range.lt = new Date(to);
    where.eventDate = range;
  }

  // Scope filter
  // - Public calendar (FR-04): scope=public → only APPROVED bookings, no user info
  // - Personal dashboard: scope=me → user's own bookings (requires auth)
  // - Admin approvals: scope=all → all bookings (requires admin role)
  if (scope === 'public') {
    where.status = 'APPROVED';
  } else if (scope === 'me') {
    if (!session) return unauthenticated();
    where.userId = session.id;
  } else if (scope === 'all') {
    if (!session || !isFacilityAdminOrAbove(session.role)) return unauthenticated();
  } else if (session) {
    // default for logged-in users: their own
    where.userId = session.id;
  } else {
    // default for anonymous: public
    where.status = 'APPROVED';
  }

  const [total, bookings] = await Promise.all([
    db.booking.count({ where }),
    db.booking.findMany({
      where,
      include: {
        facility: { select: { id: true, name: true, category: true, colorCode: true, capacity: true, location: true } },
        user: scope === 'public'
          ? false
          : { select: { id: true, name: true, email: true, department: true, phone: true } },
      },
      orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: bookings,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const ip = getClientIp(req);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return badRequest('JSON tidak sah.');
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');
  }
  const data = parsed.data;

  // Validate facility
  const facility = await db.facility.findUnique({ where: { id: data.facilityId } });
  if (!facility) return badRequest('Kemudahan tidak wujud.');
  if (facility.status !== 'ACTIVE') return badRequest('Kemudahan tidak aktif (penyelenggaraan).');

  // Capacity check (FR-01)
  if (data.participantCount > facility.capacity) {
    return NextResponse.json(
      { error: 'capacity', message: `Bilangan peserta (${data.participantCount}) melebihi kapasiti (${facility.capacity}).` },
      { status: 400 },
    );
  }

  // Time logic check
  if (data.startTime >= data.endTime) return badRequest('Masa tamat mesti selepas masa mula.');
  if (data.startTime < facility.operatingStart || data.endTime > facility.operatingEnd) {
    return NextResponse.json(
      { error: 'operating_hours', message: `Waktu operasi: ${facility.operatingStart} - ${facility.operatingEnd}.` },
      { status: 400 },
    );
  }

  const eventDate = new Date(data.eventDate);
  eventDate.setHours(0, 0, 0, 0);

  // Conflict check (FR-01, FR-05)
  const conflict = await checkBookingConflict({
    facilityId: data.facilityId,
    eventDate,
    startTime: data.startTime,
    endTime: data.endTime,
  });
  if (conflict.hasConflict && !data.isDraft) {
    return NextResponse.json(
      {
        error: 'conflict',
        message: 'Slot masa bertindih dengan tempahan sedia ada.',
        conflicts: conflict.conflictingBookings,
      },
      { status: 409 },
    );
  }

  // Determine booking reference sequence
  const count = await db.booking.count();
  const bookingRef = generateBookingRef(count + 1);

  // Multi-level approval for large events (FR-02)
  const requiresMultiLevel =
    facility.category === 'LECTURE_HALL' && data.participantCount > 100;

  const booking = await db.booking.create({
    data: {
      bookingRef,
      userId: session.id,
      facilityId: data.facilityId,
      eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      purpose: data.purpose,
      programName: data.programName ?? null,
      participantCount: data.participantCount,
      equipmentNeeded: data.equipmentNeeded ?? null,
      notes: data.notes ?? null,
      status: data.isDraft ? 'PENDING' : 'PENDING', // drafts still stored as PENDING for simplicity
      requiresMultiLevel,
    },
    include: { facility: true },
  });

  // In-app notification to all facility admins (FR-03)
  const admins = await db.user.findMany({ where: { role: 'FACILITY_ADMIN', status: 'ACTIVE' } });
  await Promise.all(
    admins.map((a) =>
      db.notification.create({
        data: {
          userId: a.id,
          type: 'IN_APP',
          title: `Permohonan Baharu: ${bookingRef}`,
          content: `${session.name} memohon ${facility.name} pada ${eventDate.toLocaleDateString('ms-MY')} ${data.startTime}-${data.endTime}.`,
          bookingId: booking.id,
        },
      }),
    ),
  );

  // Notification to applicant
  await db.notification.create({
    data: {
      userId: session.id,
      type: 'IN_APP',
      title: `Permohonan Diterima: ${bookingRef}`,
      content: `Permohonan anda untuk ${facility.name} sedang menunggu kelulusan pentadbir.`,
      bookingId: booking.id,
    },
  });

  await recordAudit({
    userId: session.id,
    module: 'BOOKING',
    action: 'BOOKING_CREATE',
    entity: 'Booking',
    entityId: booking.id,
    details: { bookingRef, facility: facility.name, eventDate, startTime: data.startTime, endTime: data.endTime },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ data: booking }, { status: 201 });
}
