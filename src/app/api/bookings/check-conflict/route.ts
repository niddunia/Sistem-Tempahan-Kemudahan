/**
 * POST /api/bookings/check-conflict
 * Real-time conflict check (FR-01) — called on the booking form before submission.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkBookingConflict } from '@/lib/booking-conflict';
import { db } from '@/lib/db';

const schema = z.object({
  facilityId: z.string(),
  eventDate: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  excludeBookingId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const eventDate = new Date(parsed.data.eventDate);
  eventDate.setHours(0, 0, 0, 0);

  const result = await checkBookingConflict({
    facilityId: parsed.data.facilityId,
    eventDate,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    excludeBookingId: parsed.data.excludeBookingId,
  });

  // Suggest nearby available slots when conflict (FR enhancement: Smart alternative slots)
  let alternatives: Array<{ startTime: string; endTime: string; facilityId: string; facilityName: string }> = [];
  if (result.hasConflict) {
    const facility = await db.facility.findUnique({ where: { id: parsed.data.facilityId } });
    if (facility) {
      // Try shifting by 30/60/90 minutes
      const durations = ['30', '60', '90'];
      const startHour = parseInt(parsed.data.startTime.slice(0, 2), 10);
      const startMin = parseInt(parsed.data.startTime.slice(3, 5), 10);
      const endHour = parseInt(parsed.data.endTime.slice(0, 2), 10);
      const endMin = parseInt(parsed.data.endTime.slice(3, 5), 10);
      const durMin = (endHour - startHour) * 60 + (endMin - startMin);
      for (const shift of durations) {
        const shiftMin = parseInt(shift, 10);
        for (const dir of [1, -1] as const) {
          const newStart = startHour * 60 + startMin + dir * shiftMin;
          const newEnd = newStart + durMin;
          const sH = Math.floor(newStart / 60).toString().padStart(2, '0');
          const sM = (newStart % 60).toString().padStart(2, '0');
          const eH = Math.floor(newEnd / 60).toString().padStart(2, '0');
          const eM = (newEnd % 60).toString().padStart(2, '0');
          const s = `${sH}:${sM}`;
          const e = `${eH}:${eM}`;
          if (s >= facility.operatingStart && e <= facility.operatingEnd && s < e) {
            const c = await checkBookingConflict({
              facilityId: parsed.data.facilityId,
              eventDate,
              startTime: s,
              endTime: e,
              excludeBookingId: parsed.data.excludeBookingId,
            });
            if (!c.hasConflict) {
              alternatives.push({ startTime: s, endTime: e, facilityId: facility.id, facilityName: facility.name });
            }
          }
        }
      }
    }
  }

  return NextResponse.json({ data: { ...result, alternatives: alternatives.slice(0, 4) } });
}
