/**
 * GET    /api/facilities          — list facilities (public)
 * POST   /api/facilities          — create (Super Admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden, badRequest, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { isSuperAdmin } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const includeInactive = url.searchParams.get('includeInactive') === 'true';

  const where: Record<string, unknown> = {};
  if (category) where.category = category;
  if (!includeInactive) where.status = { in: ['ACTIVE', 'MAINTENANCE'] };

  const facilities = await db.facility.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ data: facilities });
}

const createSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.enum(['COMPUTER_ROOM', 'LECTURE_HALL']),
  capacity: z.number().int().min(1).max(1000),
  location: z.string().max(200).optional(),
  equipment: z.string().max(500).optional(),
  operatingStart: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  operatingEnd: z.string().regex(/^\d{2}:\d{2}$/).default('22:00'),
  colorCode: z.string().default('#0ea5e9'),
});

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isSuperAdmin(session.role)) return forbidden();
  const ip = getClientIp(req);

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  const facility = await db.facility.create({ data: parsed.data });
  await recordAudit({
    userId: session.id,
    module: 'FACILITY',
    action: 'FACILITY_CREATE',
    entity: 'Facility',
    entityId: facility.id,
    details: { name: facility.name, category: facility.category },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: facility }, { status: 201 });
}
