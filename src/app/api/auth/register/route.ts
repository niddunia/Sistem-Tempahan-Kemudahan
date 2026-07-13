/**
 * POST /api/auth/register
 * Self-registration for new users (default role: USER).
 * Hardened with rate limiting + input validation per PRD §10 security requirements.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import { rateLimit } from '@/lib/rate-limit';
import { recordAudit } from '@/lib/audit';
import { getClientIp } from '@/lib/api-auth';

const schema = z.object({
  name: z.string().min(3).max(80),
  email: z.string().email().max(120),
  password: z.string().min(8).max(64),
  department: z.string().max(120).optional(),
  phone: z.string().max(30).optional(),
  staffId: z.string().max(40).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Brute-force mitigation: 5 registrations per hour per IP
  const rl = rateLimit(`register:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited', message: 'Terlalu banyak percubaan. Cuba lagi nanti.' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_request', message: 'JSON tidak sah.' }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation', message: parsed.error.issues[0]?.message ?? 'Data tidak sah.' },
      { status: 400 },
    );
  }
  const { name, email, password, department, phone, staffId } = parsed.data;
  const emailLc = email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email: emailLc } });
  if (existing) {
    return NextResponse.json(
      { error: 'exists', message: 'E-mel telah didaftarkan.' },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      name,
      email: emailLc,
      passwordHash,
      department,
      phone,
      staffId,
      role: 'USER',
      status: 'ACTIVE',
    },
  });

  await recordAudit({
    userId: user.id,
    module: 'AUTH',
    action: 'USER_REGISTER',
    details: { email: emailLc, department },
    ipAddress: ip,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });

  return NextResponse.json({ ok: true, id: user.id }, { status: 201 });
}
