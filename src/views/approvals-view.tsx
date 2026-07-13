'use client';

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useApp } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  MapPin,
  Users,
  Calendar,
  Search,
  User,
  Building2,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Inbox,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ===================== Types =====================
interface Facility {
  id: string;
  name: string;
  category: string;
  colorCode: string;
  capacity: number;
  location?: string | null;
}

interface Applicant {
  id: string;
  name: string;
  email: string;
  department?: string | null;
  phone?: string | null;
}

interface Booking {
  id: string;
  bookingRef: string;
  status: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  programName?: string | null;
  participantCount: number;
  notes?: string | null;
  equipmentNeeded?: string | null;
  requiresMultiLevel: boolean;
  createdAt: string;
  facility: Facility;
  user: Applicant;
}

interface ConflictBooking {
  id: string;
  bookingRef: string;
  startTime: string;
  endTime: string;
  status: string;
  programName: string | null;
}

interface ConflictResult {
  hasConflict: boolean;
  conflictingBookings: ConflictBooking[];
}

type ActionKind = 'APPROVE' | 'REJECT' | 'REQUEST_INFO';

// ===================== Helpers =====================
const safeParseEquip = (raw?: string | null): string[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
    if (typeof v === 'string') return [v];
  } catch {
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const fmtDate = (iso: string, lang: 'bm' | 'en') =>
  new Date(iso).toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const fmtDateTime = (iso: string, lang: 'bm' | 'en') =>
  new Date(iso).toLocaleString(lang === 'bm' ? 'ms-MY' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const isSameDay = (iso: string, ref: Date) => {
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
};

// ===================== Main View =====================
export function ApprovalsView() {
  const { t, lang } = useT();
  useApp(); // ensure store ready / language reactive
  const { user } = useCurrentUser();
  const qc = useQueryClient();

  const [tab, setTab] = useState<'PENDING' | 'NEEDS_INFO'>('PENDING');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<ActionKind | null>(null);
  const [comment, setComment] = useState('');

  // ---- Fetch pending / needs-info approvals ----
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['approvals', tab],
    queryFn: async () => {
      const r = await fetch(`/api/approvals?status=${tab}`, { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json();
      return j.data as Booking[];
    },
    enabled: !!user,
  });

  // ---- Filter list (search by bookingRef / applicant / facility) ----
  const filtered = useMemo(() => {
    if (!bookings) return [];
    const s = search.trim().toLowerCase();
    if (!s) return bookings;
    return bookings.filter((b) =>
      b.bookingRef.toLowerCase().includes(s) ||
      b.user.name.toLowerCase().includes(s) ||
      b.facility.name.toLowerCase().includes(s),
    );
  }, [bookings, search]);

  // ---- Stats ----
  const stats = useMemo(() => {
    const pending = bookings?.filter((b) => b.status === 'PENDING') ?? [];
    const today = new Date();
    const todayPending = pending.filter((b) => isSameDay(b.eventDate, today)).length;
    const multiLevel = pending.filter((b) => b.requiresMultiLevel).length;
    return {
      totalPending: pending.length || (tab === 'PENDING' ? bookings?.length ?? 0 : 0),
      todayPending,
      multiLevel,
    };
  }, [bookings, tab]);

  // ---- Selected booking object (derived; falls back to first in list) ----
  const selected = useMemo(
    () => filtered.find((b) => b.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  // Track the effective selected id for downstream keys/queries
  const effectiveSelectedId = selected?.id ?? null;

  // ---- Conflict check for selected booking ----
  const { data: conflict, isLoading: conflictLoading } = useQuery<ConflictResult>({
    queryKey: ['conflict-check', effectiveSelectedId],
    queryFn: async () => {
      if (!selected) return { hasConflict: false, conflictingBookings: [] };
      const r = await fetch('/api/bookings/check-conflict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          facilityId: selected.facility.id,
          eventDate: selected.eventDate,
          startTime: selected.startTime,
          endTime: selected.endTime,
          excludeBookingId: selected.id,
        }),
      });
      if (!r.ok) throw new Error('conflict-check failed');
      const j = await r.json();
      return j.data as ConflictResult;
    },
    enabled: !!selected,
  });

  // ---- Action mutation ----
  const actionMut = useMutation({
    mutationFn: async (vars: { id: string; action: ActionKind; comment: string }) => {
      const r = await fetch(`/api/approvals/${vars.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: vars.action, comment: vars.comment || undefined }),
      });
      if (r.status === 409) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message ?? (lang === 'bm' ? 'Pertindihan dikesan.' : 'Conflict detected.'));
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message ?? (lang === 'bm' ? 'Tindakan gagal.' : 'Action failed.'));
      }
      return r.json();
    },
    onSuccess: (_data, vars) => {
      const msg =
        vars.action === 'APPROVE'
          ? lang === 'bm' ? 'Permohonan diluluskan.' : 'Booking approved.'
          : vars.action === 'REJECT'
          ? lang === 'bm' ? 'Permohonan ditolak.' : 'Booking rejected.'
          : lang === 'bm' ? 'Permintaan maklumat dihantar.' : 'Info request sent.';
      toast.success(msg);
      // refresh both lists & related caches
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['conflict-check'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      // auto-select next pending item (clear current selection so the
      // derived `selected` falls back to the next item in the refreshed list)
      setSelectedId((prev) => (prev === vars.id ? null : prev));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error';
      toast.error(msg);
    },
    onSettled: () => {
      setDialogAction(null);
      setComment('');
    },
  });

  // ---- Open dialog with action ----
  const openAction = (a: ActionKind) => {
    setComment('');
    setDialogAction(a);
  };

  // ---- Submit dialog ----
  const submitAction = () => {
    if (!selected || !dialogAction) return;
    if ((dialogAction === 'REJECT' || dialogAction === 'REQUEST_INFO') && !comment.trim()) {
      toast.error(lang === 'bm' ? 'Sila isi ruangan ulasan.' : 'Please fill in the comment.');
      return;
    }
    actionMut.mutate({ id: selected.id, action: dialogAction, comment: comment.trim() });
  };

  // ---- Capacity check ----
  const overCapacity = selected ? selected.participantCount > selected.facility.capacity : false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* ===== Header / Stats ===== */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
            <ShieldAlert className="w-3 h-3" />
            <span>{t('nav_approvals')}</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold gradient-text mb-3">
            {lang === 'bm' ? 'Papan Pemuka Kelulusan' : 'Approval Dashboard'}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile
              icon={<Clock className="w-4 h-4" />}
              label={t('stats_pending')}
              value={stats.totalPending}
              tone="amber"
            />
            <StatTile
              icon={<Calendar className="w-4 h-4" />}
              label={lang === 'bm' ? 'Hari Ini' : "Today's Pending"}
              value={stats.todayPending}
              tone="teal"
            />
            <StatTile
              icon={<ShieldAlert className="w-4 h-4" />}
              label={lang === 'bm' ? 'Kelulusan Berperingkat' : 'Multi-level'}
              value={stats.multiLevel}
              tone="rose"
            />
            <StatTile
              icon={<Inbox className="w-4 h-4" />}
              label={lang === 'bm' ? 'Perlu Maklumat' : 'Needs Info'}
              value={bookings?.filter((b) => b.status === 'NEEDS_INFO').length ?? 0}
              tone="orange"
            />
          </div>
        </div>
      </GlassCard>

      {/* ===== Search + Tabs ===== */}
      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'PENDING' | 'NEEDS_INFO')}>
            <TabsList className="glass-input">
              <TabsTrigger value="PENDING" className="text-xs">
                {t('status_PENDING')}
              </TabsTrigger>
              <TabsTrigger value="NEEDS_INFO" className="text-xs">
                {t('status_NEEDS_INFO')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t('search')} — ${t('form_facility')} / ${t('name')} / ${lang === 'bm' ? 'No. Rujukan' : 'Ref No.'}`}
              className="pl-9 glass-input w-full"
            />
          </div>
          <div className="text-xs text-muted-foreground whitespace-nowrap">
            {t('showing')} <span className="font-semibold text-foreground">{filtered.length}</span> {t('of')} <span className="font-semibold text-foreground">{bookings?.length ?? 0}</span> {t('records')}
          </div>
        </div>
      </GlassCard>

      {/* ===== Two-column layout ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ---- Left: list ---- */}
        <div className="lg:col-span-5 xl:col-span-4">
          <GlassCard className="p-3 h-full">
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-border/40">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                {tab === 'PENDING' ? t('status_PENDING') : t('status_NEEDS_INFO')}
              </h3>
              <span className="text-[10px] text-muted-foreground">{filtered.length}</span>
            </div>
            <div className="max-h-[640px] overflow-y-auto scroll-area-thin space-y-2 pr-1">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full rounded-xl" />
                ))
              ) : filtered.length === 0 ? (
                <EmptyState lang={lang} />
              ) : (
                filtered.map((b) => (
                  <ApprovalListItem
                    key={b.id}
                    booking={b}
                    selected={selected?.id === b.id}
                    onSelect={() => setSelectedId(b.id)}
                  />
                ))
              )}
            </div>
          </GlassCard>
        </div>

        {/* ---- Right: detail ---- */}
        <div className="lg:col-span-7 xl:col-span-8">
          {isLoading ? (
            <GlassCard className="p-6">
              <Skeleton className="h-8 w-1/3 mb-4" />
              <div className="space-y-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            </GlassCard>
          ) : !selected ? (
            <GlassCard className="p-10">
              <EmptyState lang={lang} large />
            </GlassCard>
          ) : (
            <DetailPanel
              booking={selected}
              conflict={conflict}
              conflictLoading={conflictLoading}
              overCapacity={overCapacity}
              onAction={openAction}
              pending={actionMut.isPending}
              lang={lang}
              t={t}
            />
          )}
        </div>
      </div>

      {/* ===== Action Dialog ===== */}
      <Dialog
        open={!!dialogAction}
        onOpenChange={(o) => {
          if (!o) {
            setDialogAction(null);
            setComment('');
          }
        }}
      >
        <DialogContent className="glass-strong">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {dialogAction === 'APPROVE' && (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              )}
              {dialogAction === 'REJECT' && <XCircle className="w-5 h-5 text-rose-600" />}
              {dialogAction === 'REQUEST_INFO' && (
                <MessageSquare className="w-5 h-5 text-amber-600" />
              )}
              {dialogAction === 'APPROVE'
                ? t('approve')
                : dialogAction === 'REJECT'
                ? t('reject')
                : t('request_info')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {dialogAction === 'APPROVE' && (
              <Alert className="border-emerald-300/60 bg-emerald-50/70 text-emerald-800">
                <CheckCircle2 className="w-4 h-4" />
                <AlertDescription>
                  {lang === 'bm'
                    ? 'Anda akan meluluskan permohonan ini. Notifikasi akan dihantar kepada pemohon.'
                    : 'You are about to approve this booking. The applicant will be notified.'}
                </AlertDescription>
              </Alert>
            )}
            {dialogAction === 'REJECT' && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {lang === 'bm'
                    ? 'Permohonan akan ditolak. Sebab penolakan diperlukan.'
                    : 'This booking will be rejected. A reason is required.'}
                </AlertDescription>
              </Alert>
            )}
            {dialogAction === 'REQUEST_INFO' && (
              <Alert className="border-amber-300/60 bg-amber-50/70 text-amber-800">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>
                  {lang === 'bm'
                    ? 'Pemohon perlu memberikan maklumat tambahan sebelum kelulusan.'
                    : 'The applicant must provide additional information before approval.'}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="admin-comment" className="text-xs font-semibold">
                {dialogAction === 'REJECT' ? t('rejection_reason') : t('admin_comment')}
                {(dialogAction === 'REJECT' || dialogAction === 'REQUEST_INFO') && (
                  <span className="text-rose-500 ml-0.5">*</span>
                )}
              </Label>
              <Textarea
                id="admin-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                placeholder={
                  dialogAction === 'REJECT'
                    ? lang === 'bm'
                      ? 'Nyatakan sebab penolakan...'
                      : 'State the reason for rejection...'
                    : dialogAction === 'REQUEST_INFO'
                    ? lang === 'bm'
                      ? 'Nyatakan maklumat tambahan yang diperlukan...'
                      : 'Specify the additional info needed...'
                    : lang === 'bm'
                    ? 'Catatan tambahan (pilihan)...'
                    : 'Additional note (optional)...'
                }
                className="glass-input resize-none"
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{comment.length}/1000</p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogAction(null);
                setComment('');
              }}
              disabled={actionMut.isPending}
            >
              {t('close')}
            </Button>
            <Button
              onClick={submitAction}
              disabled={
                actionMut.isPending ||
                ((dialogAction === 'REJECT' || dialogAction === 'REQUEST_INFO') && !comment.trim())
              }
              className={cn(
                dialogAction === 'APPROVE' && 'bg-emerald-600 hover:bg-emerald-700 text-white',
                dialogAction === 'REJECT' && 'bg-rose-600 hover:bg-rose-700 text-white',
                dialogAction === 'REQUEST_INFO' && 'bg-amber-600 hover:bg-amber-700 text-white',
              )}
            >
              {actionMut.isPending ? t('loading') : t('send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ===================== Sub-components =====================

function StatTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'amber' | 'teal' | 'rose' | 'orange';
}) {
  const tones: Record<string, string> = {
    amber: 'text-amber-700 bg-amber-100/60 border-amber-300/50',
    teal: 'text-teal-700 bg-teal-100/60 border-teal-300/50',
    rose: 'text-rose-700 bg-rose-100/60 border-rose-300/50',
    orange: 'text-orange-700 bg-orange-100/60 border-orange-300/50',
  };
  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-3', tones[tone])}>
      <div className="w-9 h-9 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-wide opacity-80 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function ApprovalListItem({
  booking,
  selected,
  onSelect,
}: {
  booking: Booking;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t, lang } = useT();
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all duration-200 group',
        selected
          ? 'border-teal-500/60 bg-teal-500/10 shadow-sm ring-1 ring-teal-500/30'
          : 'border-border/40 bg-white/40 dark:bg-white/5 hover:border-teal-400/40 hover:bg-teal-500/5',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-teal-700 dark:text-teal-400">
              {booking.bookingRef}
            </span>
            {booking.requiresMultiLevel && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-rose-300/60 bg-rose-100/70 text-rose-700">
                <ShieldAlert className="w-2.5 h-2.5" />
                {lang === 'bm' ? 'Multi-level' : 'Multi-level'}
              </span>
            )}
          </div>
          <div className="font-semibold text-sm truncate mt-0.5">{booking.user.name}</div>
        </div>
        <StatusBadge status={booking.status} className="shrink-0 !text-[10px] !px-2 !py-0.5" />
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: booking.facility.colorCode }}
        />
        <span className="text-xs text-foreground/80 truncate flex-1">{booking.facility.name}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          {fmtDate(booking.eventDate, lang)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {booking.startTime}–{booking.endTime}
        </span>
        <span className="inline-flex items-center gap-1">
          <Users className="w-3 h-3" />
          {booking.participantCount}
        </span>
      </div>

      {booking.programName && (
        <div className="mt-1.5 text-[11px] text-foreground/70 truncate">
          <span className="opacity-70">{t('form_program')}:</span> {booking.programName}
        </div>
      )}
    </button>
  );
}

function DetailPanel({
  booking,
  conflict,
  conflictLoading,
  overCapacity,
  onAction,
  pending,
  lang,
  t,
}: {
  booking: Booking;
  conflict: ConflictResult | undefined;
  conflictLoading: boolean;
  overCapacity: boolean;
  onAction: (a: ActionKind) => void;
  pending: boolean;
  lang: 'bm' | 'en';
  t: (k: never) => string;
}) {
  const equipment = safeParseEquip(booking.equipmentNeeded);
  const locale = lang === 'bm' ? 'ms-MY' : 'en-GB';

  return (
    <motion.div
      key={booking.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-4"
    >
      {/* ---- Header ---- */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                {booking.bookingRef}
              </span>
              <StatusBadge status={booking.status} />
              {booking.requiresMultiLevel && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-rose-300/60 bg-rose-100/70 text-rose-700">
                  <ShieldAlert className="w-3 h-3" />
                  {lang === 'bm' ? 'Perlukan Kelulusan Tambahan' : 'Additional Approval Required'}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold gradient-text">{booking.facility.name}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(booking.eventDate, lang)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {booking.startTime} – {booking.endTime}
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {booking.facility.location || '—'}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ---- Warnings ---- */}
      {(overCapacity || conflict?.hasConflict) && (
        <div className="space-y-2">
          {overCapacity && (
            <Alert className="border-amber-300/70 bg-amber-50/80 text-amber-900">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <span className="font-semibold">
                  {lang === 'bm' ? 'Amaran Kapasiti: ' : 'Capacity Warning: '}
                </span>
                {lang === 'bm'
                  ? `${booking.participantCount} peserta melebihi kapasiti ${booking.facility.capacity} (${booking.facility.name}).`
                  : `${booking.participantCount} participants exceed capacity of ${booking.facility.capacity} (${booking.facility.name}).`}
              </AlertDescription>
            </Alert>
          )}
          {conflictLoading ? (
            <Alert className="border-border/40">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                {lang === 'bm' ? 'Menyemak pertindihan...' : 'Checking for conflicts...'}
              </AlertDescription>
            </Alert>
          ) : conflict?.hasConflict ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">
                  {lang === 'bm'
                    ? 'Amaran: Pertindihan Tempahan Dikesan!'
                    : 'Warning: Booking Conflict Detected!'}
                </div>
                <div className="text-xs space-y-1">
                  {conflict.conflictingBookings.map((c) => (
                    <div key={c.id} className="flex items-center gap-2">
                      <span className="font-mono">{c.bookingRef}</span>
                      <span>·</span>
                      <span>
                        {c.startTime}–{c.endTime}
                      </span>
                      <span>·</span>
                      <StatusBadge status={c.status} className="!text-[9px] !px-1.5 !py-0" />
                      {c.programName && <span className="truncate opacity-80">— {c.programName}</span>}
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}

      {/* ---- Two-column body ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Applicant info */}
        <GlassCard className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5" />
            {lang === 'bm' ? 'Maklumat Pemohon' : 'Applicant Information'}
          </h4>
          <div className="space-y-2.5 text-sm">
            <DetailRow icon={<User className="w-3.5 h-3.5" />} label={t('name' as never)} value={booking.user.name} />
            <DetailRow
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              label={t('email' as never)}
              value={booking.user.email}
            />
            <DetailRow
              icon={<Building2 className="w-3.5 h-3.5" />}
              label={t('department' as never)}
              value={booking.user.department || '—'}
            />
            <DetailRow
              icon={<User className="w-3.5 h-3.5" />}
              label={t('phone' as never)}
              value={booking.user.phone || '—'}
            />
          </div>
        </GlassCard>

        {/* Facility info */}
        <GlassCard className="p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" />
            {lang === 'bm' ? 'Maklumat Kemudahan' : 'Facility Information'}
          </h4>
          <div className="space-y-2.5 text-sm">
            <DetailRow
              icon={<MapPin className="w-3.5 h-3.5" />}
              label={t('form_facility' as never)}
              value={booking.facility.name}
              accent={booking.facility.colorCode}
            />
            <DetailRow
              icon={<MapPin className="w-3.5 h-3.5" />}
              label={lang === 'bm' ? 'Lokasi' : 'Location'}
              value={booking.facility.location || '—'}
            />
            <DetailRow
              icon={<Users className="w-3.5 h-3.5" />}
              label={lang === 'bm' ? 'Kapasiti' : 'Capacity'}
              value={`${booking.facility.capacity} ${lang === 'bm' ? 'orang' : 'pax'}`}
              warn={overCapacity}
            />
            <DetailRow
              icon={<Building2 className="w-3.5 h-3.5" />}
              label={lang === 'bm' ? 'Kategori' : 'Category'}
              value={
                booking.facility.category === 'COMPUTER_ROOM'
                  ? lang === 'bm'
                    ? 'Bilik Komputer'
                    : 'Computer Room'
                  : lang === 'bm'
                  ? 'Dewan Kuliah'
                  : 'Lecture Hall'
              }
            />
          </div>
        </GlassCard>
      </div>

      {/* ---- Booking details ---- */}
      <GlassCard className="p-5">
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5" />
          {lang === 'bm' ? 'Butiran Permohonan' : 'Booking Details'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('form_date' as never)}
            </Label>
            <div className="text-sm font-medium">
              {new Date(booking.eventDate).toLocaleDateString(locale, {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {lang === 'bm' ? 'Masa' : 'Time'}
            </Label>
            <div className="text-sm font-medium">
              {booking.startTime} – {booking.endTime}
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('form_participants' as never)}
            </Label>
            <div className="text-sm font-medium flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-teal-600" />
              {booking.participantCount}
              <span className="text-xs text-muted-foreground">
                / {booking.facility.capacity} {lang === 'bm' ? 'kapasiti' : 'capacity'}
              </span>
              {overCapacity && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300/60">
                  {lang === 'bm' ? 'Melebihi' : 'Over'}
                </span>
              )}
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('form_program' as never)}
            </Label>
            <div className="text-sm font-medium">{booking.programName || '—'}</div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t('form_purpose' as never)}
            </Label>
            <p className="text-sm mt-1 p-3 rounded-lg bg-white/50 dark:bg-white/5 border border-border/40">
              {booking.purpose}
            </p>
          </div>
          {equipment.length > 0 && (
            <div className="md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('form_equipment' as never)}
              </Label>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {equipment.map((eq, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-1 rounded-full bg-teal-100/70 text-teal-800 border border-teal-300/50"
                  >
                    {eq}
                  </span>
                ))}
              </div>
            </div>
          )}
          {booking.notes && (
            <div className="md:col-span-2">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {t('form_notes' as never)}
              </Label>
              <p className="text-sm mt-1 p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/50">
                {booking.notes}
              </p>
            </div>
          )}
          <div className="md:col-span-2 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
            {lang === 'bm' ? 'Dihantar pada' : 'Submitted at'}: {fmtDateTime(booking.createdAt, lang)}
          </div>
        </div>
      </GlassCard>

      {/* ---- Action buttons ---- */}
      <GlassCard className="p-4 sticky bottom-4 z-10">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => onAction('APPROVE')}
            disabled={pending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {t('approve' as never)}
          </Button>
          <Button
            onClick={() => onAction('REQUEST_INFO')}
            disabled={pending}
            variant="outline"
            className="flex-1 border-amber-400/50 text-amber-700 hover:bg-amber-50"
          >
            <MessageSquare className="w-4 h-4 mr-1.5" />
            {t('request_info' as never)}
          </Button>
          <Button
            onClick={() => onAction('REJECT')}
            disabled={pending}
            variant="outline"
            className="flex-1 border-rose-400/50 text-rose-700 hover:bg-rose-50"
          >
            <XCircle className="w-4 h-4 mr-1.5" />
            {t('reject' as never)}
          </Button>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  accent,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-md bg-white/50 dark:bg-white/5 flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={cn(
            'text-sm font-medium truncate',
            warn && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {accent && <span className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle" style={{ background: accent }} />}
          {value}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ lang, large }: { lang: 'bm' | 'en'; large?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', large ? 'py-16' : 'py-10')}>
      <div className="w-16 h-16 rounded-full bg-teal-500/10 flex items-center justify-center mb-3">
        <Inbox className="w-8 h-8 text-teal-600" />
      </div>
      <h4 className="font-semibold text-sm mb-1">
        {lang === 'bm' ? 'Tiada permohonan menunggu' : 'No pending approvals'}
      </h4>
      <p className="text-xs text-muted-foreground max-w-xs">
        {lang === 'bm'
          ? 'Semua permohonan telah diproses. Kerja bagus!'
          : 'All requests have been processed. Great job!'}
      </p>
    </div>
  );
}
