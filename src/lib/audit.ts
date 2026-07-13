/**
 * Audit log helper — every privileged action is recorded per PRD §10 (Auditability)
 * and PRD §11 (Log Audit entity).
 */
import { db } from '@/lib/db';

export interface AuditEntry {
  userId?: string | null;
  module: 'AUTH' | 'BOOKING' | 'APPROVAL' | 'FACILITY' | 'USER_MGMT' | 'SYSTEM' | 'AI';
  action: string;
  entity?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        module: entry.module,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        details: entry.details ? JSON.stringify(entry.details) : null,
        severity: entry.severity ?? 'INFO',
      },
    });
  } catch (err) {
    // Audit failures must not break the user flow, but should be logged
    console.error('[AUDIT LOG ERROR]', err);
  }
}
