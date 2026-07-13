/**
 * POST /api/feedback  — post-use rating & comment (PRD enhancement §8)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, badRequest, forbidden, notFound, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';

const schema = z.object({
  bookingId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const ip = getClientIp(req);

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  const booking = await db.booking.findUnique({ where: { id: parsed.data.bookingId } });
  if (!booking) return notFound();
  if (booking.userId !== session.id) return forbidden();

  const existing = await db.feedback.findUnique({ where: { bookingId: parsed.data.bookingId } });
  if (existing) return badRequest('Anda telah memberi maklum balas untuk tempahan ini.');

  const feedback = await db.feedback.create({
    data: {
      bookingId: parsed.data.bookingId,
      userId: session.id,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
    },
  });

  await recordAudit({
    userId: session.id,
    module: 'BOOKING',
    action: 'FEEDBACK_SUBMIT',
    entity: 'Booking',
    entityId: booking.id,
    details: { rating: parsed.data.rating },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: feedback }, { status: 201 });
}
