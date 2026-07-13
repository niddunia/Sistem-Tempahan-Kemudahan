/**
 * GET   /api/notifications   — list user's notifications
 * PATCH /api/notifications   — mark one or all as read
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, badRequest } from '@/lib/api-auth';

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();

  const url = new URL(req.url);
  const onlyUnread = url.searchParams.get('unread') === 'true';
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '50', 10));

  const notifs = await db.notification.findMany({
    where: {
      userId: session.id,
      ...(onlyUnread ? { isRead: false } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const unreadCount = await db.notification.count({
    where: { userId: session.id, isRead: false },
  });

  return NextResponse.json({ data: notifs, unreadCount });
}

const patchSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
});

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  let body: unknown;
  try { body = await req.json(); } catch { return badRequest('JSON tidak sah.'); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Data tidak sah.');

  if (parsed.data.all) {
    await db.notification.updateMany({
      where: { userId: session.id, isRead: false },
      data: { isRead: true },
    });
  } else if (parsed.data.id) {
    await db.notification.updateMany({
      where: { id: parsed.data.id, userId: session.id },
      data: { isRead: true },
    });
  }
  return NextResponse.json({ ok: true });
}
