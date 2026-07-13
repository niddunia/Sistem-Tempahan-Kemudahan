/**
 * GET /api/audit  — audit log list (Super Admin only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser, unauthenticated, forbidden } from '@/lib/api-auth';
import { isSuperAdmin } from '@/lib/rbac';

export async function GET(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return unauthenticated();
  if (!isSuperAdmin(session.role)) return forbidden();

  const url = new URL(req.url);
  const moduleFilter = url.searchParams.get('module');
  const severity = url.searchParams.get('severity');
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') ?? '50', 10)));

  const where: Record<string, unknown> = {};
  if (moduleFilter) where.module = moduleFilter;
  if (severity) where.severity = severity;

  const [total, logs] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    data: logs,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
