'use client';

import { cn } from '@/lib/utils';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/hooks/use-t';
import { CheckCircle2, XCircle, Clock, AlertCircle, CalendarCheck, Ban, HelpCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { key: TranslationKey; icon: typeof CheckCircle2; cls: string; dot: string }> = {
  PENDING:     { key: 'status_PENDING',     icon: Clock,           cls: 'text-amber-700 bg-amber-100/70 border-amber-300/60', dot: 'bg-amber-500' },
  APPROVED:    { key: 'status_APPROVED',    icon: CheckCircle2,    cls: 'text-emerald-700 bg-emerald-100/70 border-emerald-300/60', dot: 'bg-emerald-500' },
  REJECTED:    { key: 'status_REJECTED',    icon: XCircle,         cls: 'text-rose-700 bg-rose-100/70 border-rose-300/60', dot: 'bg-rose-500' },
  CANCELLED:   { key: 'status_CANCELLED',   icon: Ban,             cls: 'text-zinc-600 bg-zinc-100/70 border-zinc-300/60', dot: 'bg-zinc-400' },
  COMPLETED:   { key: 'status_COMPLETED',   icon: CalendarCheck,   cls: 'text-teal-700 bg-teal-100/70 border-teal-300/60', dot: 'bg-teal-500' },
  NEEDS_INFO:  { key: 'status_NEEDS_INFO',  icon: HelpCircle,      cls: 'text-orange-700 bg-orange-100/70 border-orange-300/60', dot: 'bg-orange-500' },
  ACTIVE:      { key: 'status_ACTIVE',      icon: CheckCircle2,    cls: 'text-emerald-700 bg-emerald-100/70 border-emerald-300/60', dot: 'bg-emerald-500' },
  MAINTENANCE: { key: 'status_MAINTENANCE', icon: AlertCircle,     cls: 'text-amber-700 bg-amber-100/70 border-amber-300/60', dot: 'bg-amber-500' },
  SUSPENDED:   { key: 'status_SUSPENDED',   icon: Ban,             cls: 'text-rose-700 bg-rose-100/70 border-rose-300/60', dot: 'bg-rose-500' },
  INACTIVE:    { key: 'status_CANCELLED',   icon: Ban,             cls: 'text-zinc-600 bg-zinc-100/70 border-zinc-300/60', dot: 'bg-zinc-400' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const { t } = useT();
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border', cfg.cls, className)}>
      <Icon className="w-3 h-3" />
      {t(cfg.key)}
    </span>
  );
}

export function RoleBadge({ role, className }: { role: string; className?: string }) {
  const { t } = useT();
  const key = `role_${role}` as TranslationKey;
  const cfg: Record<string, string> = {
    USER: 'text-teal-700 bg-teal-100/70 border-teal-300/60',
    FACILITY_ADMIN: 'text-violet-700 bg-violet-100/70 border-violet-300/60',
    SUPER_ADMIN: 'text-rose-700 bg-rose-100/70 border-rose-300/60',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border', cfg[role] ?? cfg.USER, className)}>
      {t(key)}
    </span>
  );
}

export function StatusDot({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return <span className={cn('inline-block w-2 h-2 rounded-full', cfg.dot, className)} />;
}
