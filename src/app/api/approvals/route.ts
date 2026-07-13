/**
 * GET /api/approvals  — pending approvals list (Facility Admin & Super Admin)
 * PRD FR-02: Kelulusan Tempahan oleh Pentadbir
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden } from '@/lib/api-auth';
import { isFacilityAdminOrAbove } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isFacilityAdminOrAbove(session.role)) return forbidden();

  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'PENDING';

  const bookings = await db.booking.findMany({
    where: { status },
    include: {
      facility: { select: { id: true, name: true, category: true, colorCode: true, capacity: true, location: true } },
      user: { select: { id: true, name: true, email: true, department: true, phone: true } },
    },
    orderBy: [{ eventDate: 'asc' }, { startTime: 'asc' }],
  });

  return NextResponse.json({ data: bookings });
}
