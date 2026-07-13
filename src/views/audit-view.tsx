'use client';

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ShieldAlert,
  Activity,
  AlertTriangle,
  AlertCircle,
  Info,
  User,
  Globe,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Cpu,
  ScrollText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ===================== Types =====================
interface AuditLogUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuditLog {
  id: string;
  userId: string | null;
  module: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  createdAt: string;
  user: AuditLogUser | null;
}

interface AuditResponse {
  data: AuditLog[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ===================== Constants =====================
const MODULE_COLORS: Record<string, string> = {
  AUTH: 'text-teal-700 bg-teal-100/70 border-teal-300/60',
  BOOKING: 'text-emerald-700 bg-emerald-100/70 border-emerald-300/60',
  APPROVAL: 'text-violet-700 bg-violet-100/70 border-violet-300/60',
  FACILITY: 'text-amber-700 bg-amber-100/70 border-amber-300/60',
  USER_MGMT: 'text-rose-700 bg-rose-100/70 border-rose-300/60',
  SYSTEM: 'text-zinc-600 bg-zinc-100/70 border-zinc-300/60',
  AI: 'text-pink-700 bg-pink-100/70 border-pink-300/60',
};

const SEVERITY_CONFIG: Record<
  string,
  { cls: string; icon: typeof Info; label: { bm: string; en: string } }
> = {
  INFO: {
    cls: 'text-teal-700 bg-teal-100/70 border-teal-300/60',
    icon: Info,
    label: { bm: 'Maklumat', en: 'Info' },
  },
  WARNING: {
    cls: 'text-amber-700 bg-amber-100/70 border-amber-300/60',
    icon: AlertTriangle,
    label: { bm: 'Amaran', en: 'Warning' },
  },
  CRITICAL: {
    cls: 'text-rose-700 bg-rose-100/70 border-rose-300/60',
    icon: AlertCircle,
    label: { bm: 'Kritikal', en: 'Critical' },
  },
};

const MODULES = ['AUTH', 'BOOKING', 'APPROVAL', 'FACILITY', 'USER_MGMT', 'SYSTEM', 'AI'] as const;
const SEVERITIES = ['INFO', 'WARNING', 'CRITICAL'] as const;

// ===================== Helpers =====================
const fmtTimestamp = (iso: string, lang: 'bm' | 'en') => {
  try {
    const d = new Date(iso);
    return format(d, lang === 'bm' ? 'dd MMM yyyy, HH:mm:ss' : 'dd MMM yyyy, HH:mm:ss');
  } catch {
    return iso;
  }
};

const fmtRelative = (iso: string, lang: 'bm' | 'en') => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return lang === 'bm' ? 'baru saja' : 'just now';
  if (mins < 60) return lang === 'bm' ? `${mins} minit lalu` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'bm' ? `${hrs} jam lalu` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === 'bm' ? `${days} hari lalu` : `${days}d ago`;
};

const parseDetails = (raw: string | null): string | null => {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
};

const maskIp = (ip: string | null): string => {
  if (!ip) return '—';
  // Show first two octets for IPv4, mask the rest (PDPA-friendly preview)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const parts = ip.split('.');
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  return ip;
};

// ===================== Main View =====================
export function AuditView() {
  const { t, lang } = useT();
  const { user } = useCurrentUser();
  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);

  const [page, setPage] = useState(1);
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const pageSize = 50;

  // ---- Main audit log fetch ----
  const { data, isLoading, isError } = useQuery<AuditResponse>({
    queryKey: ['audit', page, pageSize, moduleFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (moduleFilter !== 'all') params.set('module', moduleFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const r = await fetch(`/api/audit?${params.toString()}`, { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      return (await r.json()) as AuditResponse;
    },
    enabled: !!user,
  });

  // ---- Severity count fetches (parallel, small) ----
  const useSeverityCount = (sev: string) =>
    useQuery<number>({
      queryKey: ['audit-count', sev, moduleFilter],
      queryFn: async () => {
        const params = new URLSearchParams({ page: '1', pageSize: '1', severity: sev });
        if (moduleFilter !== 'all') params.set('module', moduleFilter);
        const r = await fetch(`/api/audit?${params.toString()}`, { credentials: 'include' });
        if (!r.ok) throw new Error('failed');
        const j = (await r.json()) as AuditResponse;
        return j.pagination.total;
      },
      enabled: !!user,
    });

  const { data: infoCount } = useSeverityCount('INFO');
  const { data: warnCount } = useSeverityCount('WARNING');
  const { data: critCount } = useSeverityCount('CRITICAL');

  // ---- Client-side search filter (action / user name/email) ----
  const filteredLogs = useMemo(() => {
    if (!data?.data) return [];
    const s = search.trim().toLowerCase();
    if (!s) return data.data;
    return data.data.filter(
      (l) =>
        l.action.toLowerCase().includes(s) ||
        (l.user?.name ?? '').toLowerCase().includes(s) ||
        (l.user?.email ?? '').toLowerCase().includes(s) ||
        (l.entity ?? '').toLowerCase().includes(s) ||
        (l.entityId ?? '').toLowerCase().includes(s),
    );
  }, [data, search]);

  const pagination = data?.pagination;
  const totalPages = pagination?.totalPages ?? 1;
  const currentPage = pagination?.page ?? 1;
  const totalRecords = pagination?.total ?? 0;

  const statTiles = useMemo(
    () => [
      {
        key: 'total',
        label: tr('Jumlah Log', 'Total Logs'),
        value: totalRecords,
        icon: ScrollText,
        gradient: 'from-teal-400 to-teal-600',
        glow: 'bg-teal-500/15',
      },
      {
        key: 'info',
        label: tr('Maklumat', 'Info'),
        value: infoCount ?? 0,
        icon: Info,
        gradient: 'from-teal-400 to-emerald-500',
        glow: 'bg-teal-500/15',
      },
      {
        key: 'warning',
        label: tr('Amaran', 'Warning'),
        value: warnCount ?? 0,
        icon: AlertTriangle,
        gradient: 'from-amber-400 to-orange-500',
        glow: 'bg-amber-500/15',
      },
      {
        key: 'critical',
        label: tr('Kritikal', 'Critical'),
        value: critCount ?? 0,
        icon: AlertCircle,
        gradient: 'from-rose-400 to-rose-600',
        glow: 'bg-rose-500/15',
      },
    ],
    [totalRecords, infoCount, warnCount, critCount, tr],
  );

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const resetFilters = () => {
    setModuleFilter('all');
    setSeverityFilter('all');
    setSearch('');
    setPage(1);
  };

  // ===================== Render =====================
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4 lg:space-y-6"
    >
      {/* ===== Header ===== */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-rose-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3 h-3" />
            <span>{t('nav_audit')}</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold gradient-text">
            {tr('Log Audit Sistem', 'System Audit Log')}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            {tr(
              'Jejak semua aktiviti sistem — pengesahan, tempahan, kelulusan & perubahan pentadbir.',
              'Track all system activity — authentication, bookings, approvals & admin changes.',
            )}
          </p>
        </div>
      </GlassCard>

      {/* ===== Stats Row ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statTiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <GlassCard key={tile.key} className="p-5 relative overflow-hidden">
              <div className={cn('absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl', tile.glow)} />
              <div className="relative z-10 flex items-center gap-3">
                <div
                  className={cn(
                    'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0',
                    tile.gradient,
                  )}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-2xl lg:text-3xl font-bold tracking-tight">{tile.value}</div>
                  <div className="text-xs text-muted-foreground truncate">{tile.label}</div>
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* ===== Filters + Table ===== */}
      <GlassCard className="p-4 lg:p-5">
        {/* Filter bar */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm font-semibold shrink-0">
            <Cpu className="w-4 h-4 text-teal-600" />
            {tr('Tapis Log', 'Filter Logs')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 flex-1">
            {/* Module select */}
            <Select value={moduleFilter} onValueChange={(v) => { setModuleFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-full lg:w-[180px] text-xs">
                <SelectValue placeholder={tr('Modul', 'Module')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('Semua Modul', 'All Modules')}</SelectItem>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity select */}
            <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(1); }}>
              <SelectTrigger className="h-9 w-full lg:w-[160px] text-xs">
                <SelectValue placeholder={tr('Keterukan', 'Severity')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tr('Semua Keterukan', 'All Severities')}</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tr('Cari tindakan / pengguna / entiti...', 'Search action / user / entity...')}
                className="h-9 pl-9 text-xs"
              />
            </div>

            {(moduleFilter !== 'all' || severityFilter !== 'all' || search) && (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 text-xs shrink-0">
                {tr('Reset', 'Reset')}
              </Button>
            )}
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>
            {isLoading
              ? t('loading')
              : tr(
                  `${filteredLogs.length} rekod dipaparkan daripada ${totalRecords} jumlah`,
                  `${filteredLogs.length} records shown of ${totalRecords} total`,
                )}
          </span>
          <span className="hidden sm:inline">
            {tr('Halaman', 'Page')} {currentPage} / {Math.max(totalPages, 1)}
          </span>
        </div>

        {/* Error state */}
        {isError && (
          <Alert className="border-rose-300/60 bg-rose-50/70 text-rose-800 mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              {tr(
                'Anda tidak mempunyai kebenaran atau log tidak dapat dimuatkan.',
                'You do not have permission or logs could not be loaded.',
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Table header (desktop only) */}
        <div className="hidden lg:grid grid-cols-[150px_180px_120px_1fr_140px_110px_40px] gap-3 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border/60">
          <div>{tr('Waktu', 'Timestamp')}</div>
          <div>{tr('Pengguna', 'User')}</div>
          <div>{tr('Modul', 'Module')}</div>
          <div>{tr('Tindakan', 'Action')}</div>
          <div>{tr('Entiti', 'Entity')}</div>
          <div>IP</div>
          <div></div>
        </div>

        {/* List */}
        <div className="mt-2 space-y-1.5">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-3 py-3 rounded-lg border border-border/40">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            : filteredLogs.length === 0
            ? <EmptyState tr={tr} />
            : filteredLogs.map((log) => (
              <AuditRow
                key={log.id}
                log={log}
                lang={lang}
                expanded={expandedId === log.id}
                onToggle={() => toggleExpand(log.id)}
                tr={tr}
              />
            ))}
        </div>

        {/* Pagination */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8"
            >
              <ChevronLeft className="w-4 h-4" />
              {tr('Sebelum', 'Prev')}
            </Button>

            <span className="text-xs text-muted-foreground">
              {tr('Halaman', 'Page')} <span className="font-semibold text-foreground">{currentPage}</span> {tr('daripada', 'of')} <span className="font-semibold text-foreground">{Math.max(totalPages, 1)}</span>
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8"
            >
              {tr('Seterus', 'Next')}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

// ===================== Audit Row =====================
function AuditRow({
  log,
  lang,
  expanded,
  onToggle,
  tr,
}: {
  log: AuditLog;
  lang: 'bm' | 'en';
  expanded: boolean;
  onToggle: () => void;
  tr: (bm: string, en: string) => string;
}) {
  const sevCfg = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.INFO;
  const SevIcon = sevCfg.icon;
  const moduleCls = MODULE_COLORS[log.module] ?? 'text-zinc-600 bg-zinc-100/70 border-zinc-300/60';
  const prettyDetails = useMemo(() => parseDetails(log.details), [log.details]);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all',
        expanded
          ? 'border-teal-300/60 bg-teal-50/30 shadow-sm'
          : 'border-border/40 hover:border-teal-200/60 hover:bg-muted/30',
      )}
    >
      {/* Clickable row */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full text-left px-3 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 rounded-lg"
      >
        {/* Desktop grid layout */}
        <div className="hidden lg:grid grid-cols-[150px_180px_120px_1fr_140px_110px_40px] gap-3 items-center">
          {/* Timestamp */}
          <div className="min-w-0">
            <div className="text-xs font-mono text-foreground truncate">{fmtTimestamp(log.createdAt, lang)}</div>
            <div className="text-[10px] text-muted-foreground">{fmtRelative(log.createdAt, lang)}</div>
          </div>

          {/* User */}
          <div className="min-w-0 flex items-center gap-1.5">
            {log.user ? (
              <>
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shrink-0">
                  <User className="w-3 h-3 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{log.user.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{log.user.email}</div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center shrink-0">
                  <Cpu className="w-3 h-3 text-zinc-500" />
                </div>
                <span className="text-xs text-muted-foreground italic">{tr('Sistem', 'System')}</span>
              </div>
            )}
          </div>

          {/* Module badge */}
          <div>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border', moduleCls)}>
              {log.module}
            </span>
          </div>

          {/* Action + severity */}
          <div className="min-w-0 flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0', sevCfg.cls)}>
              <SevIcon className="w-2.5 h-2.5" />
            </span>
            <span className="text-xs font-medium truncate font-mono">{log.action}</span>
          </div>

          {/* Entity */}
          <div className="min-w-0 text-xs">
            {log.entity ? (
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-muted-foreground truncate">{log.entity}</span>
                {log.entityId && (
                  <span className="font-mono text-[10px] text-muted-foreground/70 truncate">#{log.entityId.slice(0, 8)}</span>
                )}
              </div>
            ) : (
              <span className="text-muted-foreground/50">—</span>
            )}
          </div>

          {/* IP */}
          <div className="text-[11px] font-mono text-muted-foreground truncate">{maskIp(log.ipAddress)}</div>

          {/* Chevron */}
          <div className="flex justify-end">
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Mobile stacked layout */}
        <div className="lg:hidden space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border', moduleCls)}>
                {log.module}
              </span>
              <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border', sevCfg.cls)}>
                <SevIcon className="w-2.5 h-2.5" />
                {log.severity}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              {fmtRelative(log.createdAt, lang)}
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div className="text-xs font-mono font-medium break-all">{log.action}</div>

          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              {log.user ? (
                <>
                  <User className="w-3 h-3 shrink-0" />
                  <span className="truncate">{log.user.name}</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3 h-3 shrink-0" />
                  <span className="italic">{tr('Sistem', 'System')}</span>
                </>
              )}
            </div>
            <span className="font-mono">{maskIp(log.ipAddress)}</span>
          </div>

          <div className="text-[10px] text-muted-foreground font-mono">
            {fmtTimestamp(log.createdAt, lang)}
          </div>
        </div>
      </button>

      {/* Expanded details */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-border/40 mt-1 space-y-3">
              {/* Meta grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
                <DetailField
                  icon={User}
                  label={tr('Pengguna', 'User')}
                  value={
                    log.user
                      ? `${log.user.name}\n${log.user.email}\n${log.user.role}`
                      : tr('Sistem (tiada pengguna)', 'System (no user)')
                  }
                />
                <DetailField
                  icon={Activity}
                  label={tr('Tindakan', 'Action')}
                  value={log.action}
                  mono
                />
                <DetailField
                  icon={FileText}
                  label={tr('Entiti', 'Entity')}
                  value={
                    log.entity
                      ? `${log.entity}${log.entityId ? ` #${log.entityId}` : ''}`
                      : '—'
                  }
                  mono
                />
                <DetailField
                  icon={Globe}
                  label={tr('Alamat IP', 'IP Address')}
                  value={log.ipAddress ?? '—'}
                  mono
                />
              </div>

              {/* User agent */}
              {log.userAgent && (
                <div className="rounded-lg bg-muted/40 border border-border/40 p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    <Globe className="w-3 h-3" />
                    {tr('User Agent', 'User Agent')}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground break-all">{log.userAgent}</p>
                </div>
              )}

              {/* Pretty-printed details */}
              {prettyDetails && (
                <div className="rounded-lg bg-zinc-900/95 border border-zinc-700/50 p-3 overflow-x-auto">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-teal-300 font-semibold mb-2">
                    <FileText className="w-3 h-3" />
                    {tr('Butiran (JSON)', 'Details (JSON)')}
                  </div>
                  <pre className="text-[11px] font-mono text-zinc-100 whitespace-pre-wrap break-all leading-relaxed">
                    {prettyDetails}
                  </pre>
                </div>
              )}

              {!prettyDetails && !log.userAgent && (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  {tr('Tiada butiran tambahan.', 'No additional details.')}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===================== Detail Field =====================
function DetailField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: typeof User;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <p className={cn('text-xs text-foreground whitespace-pre-wrap break-all', mono && 'font-mono')}>
        {value}
      </p>
    </div>
  );
}

// ===================== Empty State =====================
function EmptyState({ tr }: { tr: (bm: string, en: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center mb-3">
        <ScrollText className="w-7 h-7 text-teal-600" />
      </div>
      <p className="text-sm font-medium text-foreground">
        {tr('Tiada log audit dijumpai', 'No audit logs found')}
      </p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
        {tr(
          'Cuba ubah penapis atau gelintar untuk mencari log yang dikehendaki.',
          'Try adjusting filters or search to find the logs you need.',
        )}
      </p>
    </div>
  );
}
