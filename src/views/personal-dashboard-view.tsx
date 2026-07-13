'use client';

import { useMemo, useState } from 'react';
import { useT } from '@/hooks/use-t';
import { useApp } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isWithinInterval, addDays, isToday, isTomorrow } from 'date-fns';
import {
  PlusCircle, Calendar, Clock, MapPin, Users, CheckCircle2, XCircle,
  Clock3, Ban, Star, Bell, Trash2, ChevronRight, Inbox, Search,
  Sparkles, History, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ===== Types =====
interface Facility {
  id: string;
  name: string;
  category: string;
  colorCode: string;
  capacity: number;
  location: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  department: string | null;
  phone: string | null;
}

interface ApprovalLog {
  id: string;
  action: string;
  comment: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
  admin: { id: string; name: string; role: string };
}

interface Feedback {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface Booking {
  id: string;
  bookingRef: string;
  status: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  purpose: string;
  programName: string | null;
  participantCount: number;
  notes: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  createdAt: string;
  facility: Facility;
  user: User;
  approvalLogs?: ApprovalLog[];
  feedbacks?: Feedback[];
}

interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  bookingId: string | null;
  createdAt: string;
}

type TabKey = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';

const locale = (lang: 'bm' | 'en') => (lang === 'bm' ? 'ms-MY' : 'en-GB');

// ===== Main view =====
export function PersonalDashboardView() {
  const { t, lang } = useT();
  const setView = useApp((s) => s.setView);
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  // Feedback dialog
  const [feedbackTarget, setFeedbackTarget] = useState<Booking | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState('');

  // ===== Queries =====
  const { data: bookings, isLoading } = useQuery<Booking[]>({
    queryKey: ['my-bookings'],
    queryFn: async () => {
      const r = await fetch('/api/bookings?scope=me&pageSize=100', { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json();
      return j.data as Booking[];
    },
  });

  const { data: notifData } = useQuery<{ data: Notification[]; unreadCount: number }>({
    queryKey: ['my-notifications'],
    queryFn: async () => {
      const r = await fetch('/api/notifications?limit=10', { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
  });

  // Detail fetch (only when expanding) — gets approvalLogs + feedbacks
  const { data: detailBooking, isLoading: detailLoading } = useQuery<Booking | null>({
    queryKey: ['booking-detail', expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const r = await fetch(`/api/bookings/${expandedId}`, { credentials: 'include' });
      if (!r.ok) return null;
      const j = await r.json();
      return j.data as Booking;
    },
  });

  // ===== Mutations =====
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/bookings/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message ?? 'Gagal membatalkan tempahan.');
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(lang === 'bm' ? 'Tempahan berjaya dibatalkan.' : 'Booking cancelled successfully.');
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['my-notifications'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const feedbackMutation = useMutation({
    mutationFn: async (payload: { bookingId: string; rating: number; comment?: string }) => {
      const r = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.message ?? 'Gagal menghantar penilaian.');
      }
      return r.json();
    },
    onSuccess: () => {
      toast.success(lang === 'bm' ? 'Terima kasih atas penilaian anda!' : 'Thank you for your feedback!');
      setFeedbackTarget(null);
      setRating(0);
      setHoverRating(0);
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['booking-detail', expandedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ all: true }),
      });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  const markOneReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      if (!r.ok) throw new Error('failed');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-notifications'] }),
  });

  // ===== Derived data =====
  const stats = useMemo(() => {
    const list = bookings ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total: list.length,
      pending: list.filter((b) => b.status === 'PENDING' || b.status === 'NEEDS_INFO').length,
      approved: list.filter((b) => b.status === 'APPROVED').length,
      thisMonth: list.filter((b) => new Date(b.createdAt) >= monthStart).length,
    };
  }, [bookings]);

  // Upcoming: APPROVED, eventDate in next 7 days (including today)
  const upcoming = useMemo(() => {
    const list = bookings ?? [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const horizon = addDays(now, 7);
    horizon.setHours(23, 59, 59, 999);
    return list
      .filter((b) => b.status === 'APPROVED')
      .filter((b) => {
        const d = new Date(b.eventDate);
        return isWithinInterval(d, { start: now, end: horizon });
      })
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .slice(0, 4);
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = bookings ?? [];
    if (activeTab !== 'all') list = list.filter((b) => b.status === activeTab);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.bookingRef.toLowerCase().includes(s) ||
          b.purpose.toLowerCase().includes(s) ||
          (b.programName ?? '').toLowerCase().includes(s) ||
          b.facility.name.toLowerCase().includes(s),
      );
    }
    // newest eventDate first
    return [...list].sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());
  }, [bookings, activeTab, search]);

  const notifs = notifData?.data ?? [];
  const unreadCount = notifData?.unreadCount ?? 0;

  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* ============== Header ============== */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3" />
              <span>{t('nav_dashboard')}</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold gradient-text mb-1">
              {tr('Selamat Datang', 'Welcome')}
              {user?.name ? `, ${user.name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {tr('Lihat status & sejarah semua tempahan anda', 'View status & history of all your bookings')}
            </p>
          </div>
          <Button
            onClick={() => setView('book')}
            className="gradient-primary text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all gap-2 h-11 px-5"
          >
            <PlusCircle className="w-4 h-4" />
            {tr('Mohon Tempahan Baharu', 'New Booking')}
          </Button>
        </div>
      </GlassCard>

      {/* ============== Stats Grid ============== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label={t('stats_total_bookings')}
          value={stats.total}
          gradient="from-teal-500 to-emerald-500"
          loading={isLoading}
        />
        <StatCard
          icon={<Clock3 className="w-5 h-5" />}
          label={t('stats_pending')}
          value={stats.pending}
          gradient="from-amber-500 to-orange-500"
          loading={isLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5" />}
          label={t('stats_approved')}
          value={stats.approved}
          gradient="from-emerald-500 to-teal-500"
          loading={isLoading}
        />
        <StatCard
          icon={<Sparkles className="w-5 h-5" />}
          label={t('stats_this_month')}
          value={stats.thisMonth}
          gradient="from-rose-400 to-amber-500"
          loading={isLoading}
        />
      </div>

      {/* ============== Upcoming Section (Akan Datang) ============== */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full gradient-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
              {tr('Akan Datang', 'Upcoming')} · <span className="text-muted-foreground normal-case font-normal">{tr('7 hari akan datang', 'next 7 days')}</span>
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((b) => {
              const evDate = new Date(b.eventDate);
              const dayLabel = isToday(evDate)
                ? tr('Hari ini', 'Today')
                : isTomorrow(evDate)
                ? tr('Esok', 'Tomorrow')
                : formatDistanceToNow(evDate, { addSuffix: true, locale: undefined });
              return (
                <GlassCard
                  key={b.id}
                  className="p-4 ring-1 ring-teal-500/20 relative overflow-hidden cursor-pointer"
                  onClick={() => setExpandedId((id) => (id === b.id ? null : b.id))}
                >
                  <div className="absolute top-0 left-0 w-1 h-full" style={{ background: b.facility.colorCode }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: b.facility.colorCode }} />
                        <span className="text-sm font-semibold truncate">{b.facility.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{b.programName ?? b.purpose}</div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(evDate, 'd MMM yyyy', { locale: undefined })}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {b.startTime}–{b.endTime}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className="bg-teal-500/15 text-teal-700 border-teal-500/30 hover:bg-teal-500/20">
                        {dayLabel}
                      </Badge>
                      <StatusBadge status={b.status} className="!text-[10px] !px-2 !py-0.5" />
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </section>
      )}

      {/* ============== Notifications Panel ============== */}
      <GlassCard className="p-4">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Bell className="w-4 h-4 text-foreground/70" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold">{t('notifications')}</h3>
            {unreadCount > 0 && (
              <Badge variant="outline" className="text-[10px] border-rose-400/60 text-rose-600">
                {unreadCount} {tr('baru', 'new')}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1.5"
              disabled={markAllReadMutation.isPending}
              onClick={() => markAllReadMutation.mutate()}
            >
              <CheckCircle2 className="w-3 h-3" />
              {t('mark_all_read')}
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-72">
          {notifData ? (
            notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Inbox className="w-8 h-8 text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">{t('no_notifications')}</p>
              </div>
            ) : (
              <div className="space-y-1.5 pr-2">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => !n.isRead && markOneReadMutation.mutate(n.id)}
                    className={cn(
                      'w-full text-left p-2.5 rounded-lg border transition-all hover:bg-accent/50',
                      n.isRead ? 'bg-transparent border-border/40' : 'bg-teal-500/5 border-teal-500/20',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', n.isRead ? 'bg-transparent' : 'bg-teal-500')} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-foreground truncate">{n.title}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-2">{n.content}</div>
                        <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: undefined })}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-1.5 pr-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          )}
        </ScrollArea>
      </GlassCard>

      {/* ============== Bookings section with Tabs ============== */}
      <GlassCard className="p-4 lg:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full gradient-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
              {tr('Sejarah Tempahan', 'Booking History')}
            </h3>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('search')}
              className="pl-9 glass-input h-9 w-full lg:w-64 text-sm"
            />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
          <TabsList className="bg-muted/60 h-9 flex-wrap">
            <TabsTrigger value="all" className="text-xs">
              {tr('Semua', 'All')}
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[9px]">{stats.total}</Badge>
            </TabsTrigger>
            <TabsTrigger value="PENDING" className="text-xs">{t('status_PENDING')}</TabsTrigger>
            <TabsTrigger value="APPROVED" className="text-xs">{t('status_APPROVED')}</TabsTrigger>
            <TabsTrigger value="REJECTED" className="text-xs">{t('status_REJECTED')}</TabsTrigger>
            <TabsTrigger value="COMPLETED" className="text-xs">{t('status_COMPLETED')}</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-4 rounded-xl border border-border/40">
                    <div className="flex items-center gap-3">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState lang={lang} onBook={() => setView('book')} />
            ) : (
              <div className="space-y-3">
                <AnimatePresence initial={false}>
                  {filtered.map((b) => (
                    <BookingCard
                      key={b.id}
                      booking={b}
                      lang={lang}
                      expanded={expandedId === b.id}
                      detail={expandedId === b.id && detailBooking ? detailBooking : undefined}
                      detailLoading={expandedId === b.id && detailLoading}
                      onToggle={() => setExpandedId((id) => (id === b.id ? null : b.id))}
                      onCancel={() => setCancelTarget(b)}
                      onFeedback={() => {
                        setFeedbackTarget(b);
                        setRating(0);
                        setHoverRating(0);
                        setComment('');
                      }}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </GlassCard>

      {/* ============== Cancel Confirmation Dialog ============== */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-rose-500/15 flex items-center justify-center mb-2 mx-auto">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <DialogTitle className="text-center">{tr('Batalkan Tempahan', 'Cancel Booking')}</DialogTitle>
            <DialogDescription className="text-center">
              {tr(
                'Adakah anda pasti mahu membatalkan tempahan ini? Tindakan ini tidak boleh diundur.',
                'Are you sure you want to cancel this booking? This action cannot be undone.',
              )}
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{tr('Rujukan', 'Reference')}</span>
                <span className="font-mono font-semibold">{cancelTarget.bookingRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('form_facility')}</span>
                <span className="font-medium">{cancelTarget.facility.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('form_date')}</span>
                <span className="font-medium">
                  {format(new Date(cancelTarget.eventDate), 'd MMM yyyy', { locale: undefined })}
                </span>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)} disabled={cancelMutation.isPending}>
              {t('form_cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)}
              disabled={cancelMutation.isPending}
              className="gap-1.5"
            >
              {cancelMutation.isPending ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  {tr('Sahkan Batal', 'Confirm Cancel')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============== Feedback Dialog ============== */}
      <Dialog open={!!feedbackTarget} onOpenChange={(o) => !o && setFeedbackTarget(null)}>
        <DialogContent className="glass-strong">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-500/15 flex items-center justify-center mb-2 mx-auto">
              <Star className="w-6 h-6 text-amber-500" />
            </div>
            <DialogTitle className="text-center">{tr('Beri Penilaian', 'Give Feedback')}</DialogTitle>
            <DialogDescription className="text-center">
              {tr('Kongsi pengalaman anda menggunakan kemudahan ini.', 'Share your experience using this facility.')}
            </DialogDescription>
          </DialogHeader>
          {feedbackTarget && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('form_facility')}</span>
                <span className="font-medium">{feedbackTarget.facility.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('form_date')}</span>
                <span className="font-medium">
                  {format(new Date(feedbackTarget.eventDate), 'd MMM yyyy', { locale: undefined })}
                </span>
              </div>
            </div>
          )}

          {/* Star rating */}
          <div className="flex flex-col items-center gap-2 py-3">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (hoverRating || rating) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                    className="transition-transform hover:scale-110"
                    aria-label={`${star} star`}
                  >
                    <Star
                      className={cn(
                        'w-8 h-8 transition-colors',
                        active ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {rating === 0
                ? tr('Klik bintang untuk menilai', 'Click stars to rate')
                : rating === 1
                ? tr('Sangat Tidak Puas', 'Very Dissatisfied')
                : rating === 2
                ? tr('Tidak Puas', 'Dissatisfied')
                : rating === 3
                ? tr('Biasa', 'Neutral')
                : rating === 4
                ? tr('Puas', 'Satisfied')
                : tr('Sangat Puas', 'Very Satisfied')}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
              {tr('Ulasan (pilihan)', 'Comment (optional)')}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tr('Tulis pengalaman anda di sini...', 'Write your experience here...')}
              className="glass-input min-h-[80px] text-sm resize-none"
              maxLength={500}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFeedbackTarget(null)} disabled={feedbackMutation.isPending}>
              {t('form_cancel')}
            </Button>
            <Button
              onClick={() =>
                feedbackTarget &&
                feedbackMutation.mutate({
                  bookingId: feedbackTarget.id,
                  rating,
                  comment: comment.trim() || undefined,
                })
              }
              disabled={rating === 0 || feedbackMutation.isPending}
              className="gap-1.5 gradient-primary text-white"
            >
              {feedbackMutation.isPending ? (
                <>
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  {t('loading')}
                </>
              ) : (
                <>
                  <Star className="w-3.5 h-3.5" />
                  {tr('Hantar Penilaian', 'Submit Feedback')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// ===== Sub-components =====

function StatCard({
  icon,
  label,
  value,
  gradient,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  gradient: string;
  loading?: boolean;
}) {
  return (
    <GlassCard className="p-4 relative overflow-hidden">
      <div className={cn('absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-20 bg-gradient-to-br', gradient)} />
      <div className="relative z-10 flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <p className="text-2xl lg:text-3xl font-bold gradient-text">{value}</p>
          )}
        </div>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-white shadow-sm bg-gradient-to-br shrink-0', gradient)}>
          {icon}
        </div>
      </div>
    </GlassCard>
  );
}

function BookingCard({
  booking,
  lang,
  expanded,
  detail,
  detailLoading,
  onToggle,
  onCancel,
  onFeedback,
}: {
  booking: Booking;
  lang: 'bm' | 'en';
  expanded: boolean;
  detail?: Booking;
  detailLoading: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onFeedback: () => void;
}) {
  const { t } = useT();
  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);
  const evDate = new Date(booking.eventDate);
  const canCancel = booking.status === 'PENDING' || booking.status === 'NEEDS_INFO';
  const isCompleted = booking.status === 'COMPLETED';
  const hasFeedback = (detail?.feedbacks?.length ?? booking.feedbacks?.length ?? 0) > 0;
  const rejectionReason = detail?.rejectionReason ?? booking.rejectionReason;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.2 }}
    >
      <GlassCard className={cn('overflow-hidden transition-all', expanded && 'ring-1 ring-teal-500/30')}>
        {/* Card header — clickable */}
        <button
          onClick={onToggle}
          className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Facility color indicator */}
            <div
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ background: booking.facility.colorCode }}
            />

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                  {booking.bookingRef}
                </span>
                <StatusBadge status={booking.status} className="!text-[10px] !px-2 !py-0.5" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: booking.facility.colorCode }}
                />
                <span className="font-semibold text-sm truncate">{booking.facility.name}</span>
                {booking.facility.location && (
                  <span className="text-[10px] text-muted-foreground hidden sm:inline-flex items-center gap-0.5 truncate">
                    <MapPin className="w-2.5 h-2.5" />
                    {booking.facility.location}
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground/80 line-clamp-1 mb-2">{booking.purpose}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(evDate, 'd MMM yyyy', { locale: undefined })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {booking.startTime}–{booking.endTime}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {booking.participantCount} {tr('peserta', 'pax')}
                </span>
              </div>
            </div>

            {/* Actions column */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
            </div>
          </div>
        </button>

        {/* Expanded detail */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border/40"
            >
              <div className="p-4 space-y-4 bg-muted/10">
                {/* Meta grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <MetaItem label={t('form_program')} value={booking.programName ?? '—'} />
                  <MetaItem label={t('form_participants')} value={`${booking.participantCount}`} />
                  <MetaItem
                    label={t('form_date')}
                    value={format(evDate, 'd MMM yyyy', { locale: undefined })}
                  />
                  <MetaItem label={tr('Dihantar', 'Submitted')} value={formatDistanceToNow(new Date(booking.createdAt), { addSuffix: true, locale: undefined })} />
                </div>

                {booking.notes && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">{t('form_notes')}: </span>
                    <span>{booking.notes}</span>
                  </div>
                )}

                {/* Rejection reason — directly shown to applicant (PRD FR-03) */}
                {booking.status === 'REJECTED' && rejectionReason && (
                  <div className="rounded-lg border border-rose-400/30 bg-rose-500/8 p-3">
                    <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-300 text-xs font-semibold mb-1">
                      <XCircle className="w-3.5 h-3.5" />
                      {t('rejection_reason')}
                    </div>
                    <p className="text-xs text-foreground/80">{rejectionReason}</p>
                  </div>
                )}

                {/* NEEDS_INFO admin comment */}
                {booking.status === 'NEEDS_INFO' && (
                  <div className="rounded-lg border border-orange-400/30 bg-orange-500/8 p-3">
                    <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-300 text-xs font-semibold mb-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {tr('Permintaan Maklumat Tambahan', 'Additional Information Requested')}
                    </div>
                    <p className="text-xs text-foreground/80">{rejectionReason ?? booking.adminNotes ?? '—'}</p>
                  </div>
                )}

                {/* Existing feedback display */}
                {hasFeedback && (
                  <div className="rounded-lg border border-amber-400/30 bg-amber-500/8 p-3">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {tr('Penilaian Anda', 'Your Feedback')}
                    </div>
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            'w-3 h-3',
                            s <= (detail?.feedbacks?.[0]?.rating ?? booking.feedbacks?.[0]?.rating ?? 0)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/40',
                          )}
                        />
                      ))}
                    </div>
                    {(detail?.feedbacks?.[0]?.comment ?? booking.feedbacks?.[0]?.comment) && (
                      <p className="text-xs text-foreground/80 italic">
                        "{detail?.feedbacks?.[0]?.comment ?? booking.feedbacks?.[0]?.comment}"
                      </p>
                    )}
                  </div>
                )}

                {/* Approval history (from detail fetch) */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70 mb-2">
                    <History className="w-3.5 h-3.5" />
                    {tr('Sejarah Kelulusan', 'Approval History')}
                  </div>
                  {detailLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-full" />
                      <Skeleton className="h-8 w-full" />
                    </div>
                  ) : (detail?.approvalLogs?.length ?? 0) > 0 ? (
                    <ol className="relative border-l border-border/50 ml-2 space-y-2.5">
                      {detail!.approvalLogs!.map((log) => (
                        <li key={log.id} className="ml-3 pl-3 relative">
                          <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full border-2 border-background" style={{ background: actionColor(log.action) }} />
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold">{actionLabel(log.action, lang)}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground">{log.admin.name}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {format(new Date(log.createdAt), 'd MMM yyyy, HH:mm', { locale: undefined })}
                          </div>
                          {log.comment && (
                            <p className="text-xs text-foreground/80 mt-1 italic">"{log.comment}"</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground italic ml-2">
                      {tr('Tiada log kelulusan.', 'No approval logs.')}
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {canCancel && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onCancel}
                      className="h-8 text-xs gap-1.5 border-rose-400/40 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700"
                    >
                      <Ban className="w-3 h-3" />
                      {tr('Batalkan Tempahan', 'Cancel Booking')}
                    </Button>
                  )}
                  {isCompleted && !hasFeedback && (
                    <Button
                      size="sm"
                      onClick={onFeedback}
                      className="h-8 text-xs gap-1.5 gradient-primary text-white"
                    >
                      <Star className="w-3 h-3" />
                      {tr('Beri Penilaian', 'Give Feedback')}
                    </Button>
                  )}
                  {isCompleted && hasFeedback && (
                    <Badge variant="outline" className="text-xs gap-1 border-amber-400/50 text-amber-700">
                      <CheckCircle2 className="w-3 h-3" />
                      {tr('Telah Dinilai', 'Reviewed')}
                    </Badge>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </motion.div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</p>
      <p className="text-xs font-medium text-foreground truncate">{value}</p>
    </div>
  );
}

function EmptyState({ lang, onBook }: { lang: 'bm' | 'en'; onBook: () => void }) {
  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-500/10 to-amber-500/10 flex items-center justify-center mb-4">
        <Inbox className="w-10 h-10 text-muted-foreground/50" />
      </div>
      <h4 className="text-base font-semibold mb-1">{tr('Tiada Tempahan Dijumpai', 'No Bookings Found')}</h4>
      <p className="text-sm text-muted-foreground max-w-md mb-5">
        {tr(
          'Anda belum membuat sebarang tempahan. Mulakan dengan menempah kemudahan yang anda perlukan.',
          'You have not made any bookings yet. Start by booking a facility you need.',
        )}
      </p>
      <Button onClick={onBook} className="gap-2 gradient-primary text-white">
        <PlusCircle className="w-4 h-4" />
        {tr('Mohon Tempahan Baharu', 'New Booking')}
      </Button>
    </div>
  );
}

// ===== Helpers =====
function actionLabel(action: string, lang: 'bm' | 'en'): string {
  const map: Record<string, { bm: string; en: string }> = {
    APPROVE: { bm: 'Diluluskan', en: 'Approved' },
    REJECT: { bm: 'Ditolak', en: 'Rejected' },
    REQUEST_INFO: { bm: 'Minta Maklumat', en: 'Requested Info' },
    CANCEL: { bm: 'Dibatalkan', en: 'Cancelled' },
    COMPLETE: { bm: 'Selesai', en: 'Completed' },
  };
  return (map[action] ?? { bm: action, en: action })[lang];
}

function actionColor(action: string): string {
  const map: Record<string, string> = {
    APPROVE: '#10b981',
    REJECT: '#f43f5e',
    REQUEST_INFO: '#f59e0b',
    CANCEL: '#71717a',
    COMPLETE: '#14b8a6',
  };
  return map[action] ?? '#94a3b8';
}
