/**
 * GET   /api/users   — list users (Super Admin only)
 * POST  /api/users   — create user (Super Admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden, badRequest, getClientIp } from '@/lib/api-auth';
import { recordAudit } from '@/lib/audit';
import { isSuperAdmin } from '@/lib/rbac';
import { hashPassword } from '@/lib/crypto';

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isSuperAdmin(session.role)) return forbidden();

  const url = new URL(req.url);
  const role = url.searchParams.get('role');
  const q = url.searchParams.get('q');

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { department: { contains: q } },
      { staffId: { contains: q } },
    ];
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true, email: true, name: true, role: true, department: true, phone: true, staffId: true, status: true,
      lastLoginAt: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: users });
}

const createSchema = z.object({
  name: z.string().min(3).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(64),
  role: z.enum(['USER', 'FACILITY_ADMIN', 'SUPER_ADMIN']),
  department: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  staffId: z.string().max(40).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'INACTIVE']).default('ACTIVE'),
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

  const existing = await db.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: 'exists', message: 'E-mel telah didaftarkan.' }, { status: 409 });

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await db.user.create({
    data: { ...parsed.data, email: parsed.data.email.toLowerCase(), passwordHash },
    select: { id: true, email: true, name: true, role: true, department: true, status: true },
  });
  await recordAudit({
    userId: session.id,
    module: 'USER_MGMT',
    action: 'USER_CREATE',
    entity: 'User',
    entityId: user.id,
    details: { email: user.email, role: user.role },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  return NextResponse.json({ data: user }, { status: 201 });
}
