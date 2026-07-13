/**
 * PATCH /api/users/[id]  — update user (Super Admin only; users can update own profile)
 * DELETE /api/users/[id] — soft delete (set status INACTIVE)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden, badRequest, notFound, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { isSuperAdmin } from '@/lib/rbac';
import { hashPassword } from '@/lib/crypto';

const patchSchema = z.object({
  name: z.string().min(3).max(80).optional(),
  role: z.enum(['USER', 'FACILITY_ADMIN', 'SUPER_ADMIN']).optional(),
  department: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  staffId: z.string().max(40).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).optional(),
  password: z.string().min(8).max(64).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  const { id } = await ctx.params;
  const ip = getClientIp(req);

  const isSelf = session.id === id;
  const isAdmin = isSuperAdmin(session.role);
  if (!isSelf && !isAdmin) return forbidden();

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return notFound();

  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  // Self-update: cannot change role/status
  if (isSelf && !isAdmin) {
    delete (parsed.data as { role?: string }).role;
    delete (parsed.data as { status?: string }).status;
  }

  const update: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    update.passwordHash = await hashPassword(parsed.data.password);
    delete update.password;
  }

  const updated = await db.user.update({
    where: { id },
    data: update,
    select: { id: true, email: true, name: true, role: true, department: true, status: true },
  });

  await recordAudit({
    userId: session.id,
    module: 'USER_MGMT',
    action: 'USER_UPDATE',
    entity: 'User',
    entityId: id,
    details: { fields: Object.keys(update) },
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

  const target = await db.user.findUnique({ where: { id } });
  if (!target) return notFound();
  if (target.id === session.id) return badRequest('Tidak boleh memadam akaun sendiri.');

  const updated = await db.user.update({ where: { id }, data: { status: 'INACTIVE' } });
  await recordAudit({
    userId: session.id,
    module: 'USER_MGMT',
    action: 'USER_DEACTIVATE',
    entity: 'User',
    entityId: id,
    details: { email: target.email },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
    severity: 'WARNING',
  });
  return NextResponse.json({ data: updated });
}
