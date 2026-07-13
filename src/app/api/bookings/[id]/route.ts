/**
 * GET    /api/bookings/[id]   — get a single booking
 * PATCH  /api/bookings/[id]   — update (applicant can edit while PENDING; admin can update status note)
 * DELETE /api/bookings/[id]   — cancel (soft cancel; sets status=CANCELLED)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, notFound, badRequest, forbidden, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { checkBookingConflict } from '@/lib/booking-conflict';
import { isFacilityAdminOrAbove } from '@/lib/rbac';

const updateSchema = z.object({
  facilityId: z.string().optional(),
  eventDate: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  purpose: z.string().min(3).max(300).optional(),
  programName: z.string().max(200).optional().nullable(),
  participantCount: z.number().int().min(1).max(1000).optional(),
  equipmentNeeded: z.string().max(500).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  const { id } = await ctx.params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      facility: true,
      user: { select: { id: true, name: true, email: true, department: true, phone: true } },
      approvalLogs: {
        include: { admin: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      },
      feedbacks: true,
    },
  });
  if (!booking) return notFound();

  // Privacy: public viewer can only see APPROVED; non-owner/non-admin can't see full details
  if (!session) {
    if (booking.status !== 'APPROVED') return notFound();
    return NextResponse.json({
      data: {
        id: booking.id,
        bookingRef: booking.bookingRef,
        facility: { name: booking.facility.name, location: booking.facility.location, colorCode: booking.facility.colorCode },
        eventDate: booking.eventDate,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
        programName: booking.programName,
      },
    });
  }
  if (booking.userId !== session.id && !isFacilityAdminOrAbove(session.role)) {
    return forbidden();
  }
  return NextResponse.json({ data: booking });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return notFound();

  // Only the owner (while PENDING) or admin can edit
  const isOwner = booking.userId === session.id;
  const isAdmin = isFacilityAdminOrAbove(session.role);
  if (!isOwner && !isAdmin) return forbidden();
  if (isOwner && booking.status !== 'PENDING' && booking.status !== 'NEEDS_INFO') {
    return NextResponse.json({ error: 'immutable', message: 'Tempahan tidak boleh diubah selepas diluluskan.' }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');
  const data = parsed.data;

  const update: Record<string, unknown> = {};
  if (data.facilityId) {
    const fac = await db.facility.findUnique({ where: { id: data.facilityId } });
    if (!fac) return badRequest('Kemudahan tidak wujud.');
    update.facilityId = data.facilityId;
  }
  if (data.eventDate) {
    const d = new Date(data.eventDate); d.setHours(0, 0, 0, 0);
    update.eventDate = d;
  }
  if (data.startTime) update.startTime = data.startTime;
  if (data.endTime) update.endTime = data.endTime;
  if (data.purpose) update.purpose = data.purpose;
  if (data.programName !== undefined) update.programName = data.programName;
  if (data.participantCount) update.participantCount = data.participantCount;
  if (data.equipmentNeeded !== undefined) update.equipmentNeeded = data.equipmentNeeded;
  if (data.notes !== undefined) update.notes = data.notes;

  // Re-check conflict if date/time/facility changed
  if (data.facilityId || data.eventDate || data.startTime || data.endTime) {
    const conflict = await checkBookingConflict({
      facilityId: (update.facilityId as string) ?? booking.facilityId,
      eventDate: (update.eventDate as Date) ?? booking.eventDate,
      startTime: (update.startTime as string) ?? booking.startTime,
      endTime: (update.endTime as string) ?? booking.endTime,
      excludeBookingId: booking.id,
    });
    if (conflict.hasConflict) {
      return NextResponse.json({ error: 'conflict', message: 'Slot bertindih dengan tempahan lain.', conflicts: conflict.conflictingBookings }, { status: 409 });
    }
  }

  const updated = await db.booking.update({ where: { id }, data: update, include: { facility: true } });
  await recordAudit({
    userId: session.id,
    module: 'BOOKING',
    action: 'BOOKING_UPDATE',
    entity: 'Booking',
    entityId: booking.id,
    details: { bookingRef: booking.bookingRef, fields: Object.keys(update) },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  const booking = await db.booking.findUnique({ where: { id } });
  if (!booking) return notFound();
  const isOwner = booking.userId === session.id;
  const isAdmin = isFacilityAdminOrAbove(session.role);
  if (!isOwner && !isAdmin) return forbidden();
  if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
    return NextResponse.json({ error: 'invalid_state', message: 'Tidak boleh dibatalkan.' }, { status: 400 });
  }

  const updated = await db.booking.update({ where: { id }, data: { status: 'CANCELLED' } });
  await recordAudit({
    userId: session.id,
    module: 'BOOKING',
    action: 'BOOKING_CANCEL',
    entity: 'Booking',
    entityId: booking.id,
    details: { bookingRef: booking.bookingRef },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: updated });
}
