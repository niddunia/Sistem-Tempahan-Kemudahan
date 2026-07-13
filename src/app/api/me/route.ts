/**
 * GET /api/me  — current authenticated user (lightweight session check)
 */
import { NextResponse } from 'next/server';
import { getSessionUser, unauthenticated } from '@/lib/api-auth';

export async function GET() {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  return NextResponse.json({ data: session });
}
