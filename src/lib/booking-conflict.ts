/**
 * Helper to check time-slot conflicts for a booking.
 * PRD FR-01: "Semakan konflik masa automatik (real-time)"
 * PRD FR-02: visual warning on overlap
 */
import { db } from '@/lib/db';

export interface ConflictCheckInput {
  facilityId: string;
  eventDate: Date; // start of day
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  excludeBookingId?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflictingBookings: Array<{
    id: string;
    bookingRef: string;
    startTime: string;
    endTime: string;
    status: string;
    programName: string | null;
  }>;
}

/**
 * Bookings conflict if same facility + same date + overlapping time windows,
 * and neither is CANCELLED or REJECTED.
 */
export async function checkBookingConflict(input: ConflictCheckInput): Promise<ConflictResult> {
  const start = input.startTime;
  const end = input.endTime;
  const dateStart = new Date(input.eventDate);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(dateStart);
  dateEnd.setDate(dateStart.getDate() + 1);

  const conflicting = await db.booking.findMany({
    where: {
      facilityId: input.facilityId,
      eventDate: { gte: dateStart, lt: dateEnd },
      status: { in: ['PENDING', 'APPROVED', 'COMPLETED', 'NEEDS_INFO'] },
      ...(input.excludeBookingId ? { NOT: { id: input.excludeBookingId } } : {}),
    },
    select: {
      id: true,
      bookingRef: true,
      startTime: true,
      endTime: true,
      status: true,
      programName: true,
    },
  });

  // Time overlap check (HH:mm 24h)
  const overlaps = conflicting.filter((b) => {
    return start < b.endTime && end > b.startTime;
  });

  return {
    hasConflict: overlaps.length > 0,
    conflictingBookings: overlaps,
  };
}
