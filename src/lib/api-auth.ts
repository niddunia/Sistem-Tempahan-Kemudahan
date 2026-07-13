/**
 * Helper for NextAuth session retrieval in API routes.
 */
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { Role } from '@/lib/rbac';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
    department: session.user.department,
  };
}

export function unauthenticated() {
  return NextResponse.json({ error: 'unauthenticated', message: 'Sila log masuk.' }, { status: 401 });
}

export function forbidden(message = 'Akses ditolak. Kebenaran tidak mencukupi.') {
  return NextResponse.json({ error: 'forbidden', message }, { status: 403 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: 'bad_request', message }, { status: 400 });
}

export function notFound(message = 'Rekod tidak dijumpai.') {
  return NextResponse.json({ error: 'not_found', message }, { status: 404 });
}

export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') || 'unknown';
}
