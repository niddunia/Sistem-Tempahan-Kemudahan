/**
 * GET /api/analytics  — dashboard stats (Facility Admin & Super Admin)
 * PRD enhancement: Dashboard Analitik & Laporan Automatik
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
  const days = parseInt(url.searchParams.get('days') ?? '30', 10);
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const [total, byStatusRaw, byFacilityRaw, byDayRaw, byHourRaw] = await Promise.all([
    db.booking.count({ where: { createdAt: { gte: since } } }),
    db.booking.groupBy({
      by: ['status'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.booking.groupBy({
      by: ['facilityId'],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
    db.booking.findMany({
      where: { createdAt: { gte: since } },
      select: { eventDate: true, status: true },
    }),
    db.booking.findMany({
      where: { createdAt: { gte: since }, status: { in: ['APPROVED', 'COMPLETED'] } },
      select: { startTime: true, facility: { select: { name: true } } },
    }),
  ]);

  const facilities = await db.facility.findMany();
  const facMap = new Map(facilities.map((f) => [f.id, f]));

  const byStatus = byStatusRaw.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = s._count._all;
    return acc;
  }, {});

  const byFacility = byFacilityRaw
    .map((f) => ({
      name: facMap.get(f.facilityId)?.name ?? 'Unknown',
      category: facMap.get(f.facilityId)?.category ?? 'Unknown',
      count: f._count._all,
    }))
    .sort((a, b) => b.count - a.count);

  // Group by day (yyyy-mm-dd)
  const byDay: Record<string, number> = {};
  for (const b of byDayRaw) {
    const key = b.eventDate.toISOString().slice(0, 10);
    byDay[key] = (byDay[key] ?? 0) + 1;
  }

  // Group by start-hour
  const byHour: Record<string, number> = {};
  for (const b of byHourRaw) {
    const h = b.startTime.slice(0, 2);
    byHour[h] = (byHour[h] ?? 0) + 1;
  }

  const utilizationRate = total === 0 ? 0 : Math.round(((byStatus.APPROVED ?? 0) + (byStatus.COMPLETED ?? 0)) / total * 100);

  return NextResponse.json({
    data: {
      total,
      byStatus,
      byFacility,
      byDay,
      byHour,
      utilizationRate,
      facilitiesCount: facilities.length,
      activeFacilitiesCount: facilities.filter((f) => f.status === 'ACTIVE').length,
    },
  });
}
