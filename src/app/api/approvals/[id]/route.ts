/**
 * PATCH /api/approvals/[id]  — approve / reject / request more info
 * PRD FR-02 + FR-03 (notification cascade) + Audit Log
 *
 * Body: { action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO', comment?: string }
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden, badRequest, notFound, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { isFacilityAdminOrAbove } from '@/lib/rbac';

const schema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'REQUEST_INFO']),
  comment: z.string().max(1000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isFacilityAdminOrAbove(session.role)) return forbidden();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  const booking = await db.booking.findUnique({
    where: { id },
    include: { facility: true, user: true },
  });
  if (!booking) return notFound();
  if (booking.status !== 'PENDING' && booking.status !== 'NEEDS_INFO') {
    return NextResponse.json({ error: 'invalid_state', message: 'Permohonan sudah diproses.' }, { status: 400 });
  }

  const newStatus =
    parsed.data.action === 'APPROVE' ? 'APPROVED' :
    parsed.data.action === 'REJECT' ? 'REJECTED' :
    'NEEDS_INFO';

  // Final conflict re-check before approval (PRD FR-02 amaran automatik)
  if (parsed.data.action === 'APPROVE') {
    const { checkBookingConflict } = await import('@/lib/booking-conflict');
    const conflict = await checkBookingConflict({
      facilityId: booking.facilityId,
      eventDate: booking.eventDate,
      startTime: booking.startTime,
      endTime: booking.endTime,
      excludeBookingId: booking.id,
    });
    if (conflict.hasConflict) {
      return NextResponse.json({
        error: 'conflict',
        message: 'Tidak boleh meluluskan — terdapat pertindihan dengan tempahan lain yang diluluskan.',
        conflicts: conflict.conflictingBookings,
      }, { status: 409 });
    }
  }

  const [updated, _log] = await db.$transaction([
    db.booking.update({
      where: { id },
      data: {
        status: newStatus,
        rejectionReason: parsed.data.action === 'REJECT' ? (parsed.data.comment || 'Ditolak oleh pentadbir.') : null,
        adminNotes: parsed.data.comment ?? null,
      },
    }),
    db.approvalLog.create({
      data: {
        bookingId: booking.id,
        adminId: session.id,
        action: parsed.data.action,
        comment: parsed.data.comment,
        previousStatus: booking.status,
        newStatus,
      },
    }),
  ]);

  // Notification to applicant (FR-03)
  const title =
    newStatus === 'APPROVED' ? `Tempahan ${booking.bookingRef} Diluluskan` :
    newStatus === 'REJECTED' ? `Tempahan ${booking.bookingRef} Ditolak` :
    `Tempahan ${booking.bookingRef} — Maklumat Tambahan Diperlukan`;
  const content =
    newStatus === 'APPROVED' ? `Permohonan anda untuk ${booking.facility.name} telah DILULUSKAN.${parsed.data.comment ? ' Ulasan: ' + parsed.data.comment : ''}` :
    newStatus === 'REJECTED' ? `Permohonan anda untuk ${booking.facility.name} telah DITOLAK. Sebab: ${parsed.data.comment || 'Tidak dinyatakan'}` :
    `Pentadbir meminta maklumat tambahan: ${parsed.data.comment || 'Sila hubungi pentadbir.'}`;

  await db.notification.create({
    data: {
      userId: booking.userId,
      type: 'IN_APP',
      title,
      content,
      bookingId: booking.id,
    },
  });

  await recordAudit({
    userId: session.id,
    module: 'APPROVAL',
    action: `APPROVAL_${parsed.data.action}`,
    entity: 'Booking',
    entityId: booking.id,
    details: { bookingRef: booking.bookingRef, newStatus, comment: parsed.data.comment },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
    severity: parsed.data.action === 'REJECT' ? 'WARNING' : 'INFO',
  });

  return NextResponse.json({ data: updated });
}
