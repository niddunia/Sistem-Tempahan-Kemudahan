/**
 * PATCH  /api/facilities/[id]   — update (Super Admin)
 * DELETE /api/facilities/[id]   — soft delete (set INACTIVE)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden, badRequest, notFound, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { isSuperAdmin } from '@/lib/rbac';

const patchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  capacity: z.number().int().min(1).max(1000).optional(),
  location: z.string().max(200).optional(),
  equipment: z.string().max(500).optional(),
  operatingStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  operatingEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  colorCode: z.string().optional(),
  status: z.enum(['ACTIVE', 'MAINTENANCE', 'INACTIVE']).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isSuperAdmin(session.role)) return forbidden();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  const existing = await db.facility.findUnique({ where: { id } });
  if (!existing) return notFound();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  const updated = await db.facility.update({ where: { id }, data: parsed.data });
  await recordAudit({
    userId: session.id,
    module: 'FACILITY',
    action: 'FACILITY_UPDATE',
    entity: 'Facility',
    entityId: id,
    details: { fields: Object.keys(parsed.data) },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isSuperAdmin(session.role)) return forbidden();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  const existing = await db.facility.findUnique({ where: { id } });
  if (!existing) return notFound();

  // Soft delete: mark as INACTIVE (PRD: extensible design, never physically delete)
  const updated = await db.facility.update({ where: { id }, data: { status: 'INACTIVE' } });
  await recordAudit({
    userId: session.id,
    module: 'FACILITY',
    action: 'FACILITY_DEACTIVATE',
    entity: 'Facility',
    entityId: id,
    details: { name: existing.name },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: updated });
}
