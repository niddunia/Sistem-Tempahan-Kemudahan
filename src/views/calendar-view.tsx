'use client';

/**
 * Integrated Calendar View — Sistem e-Tempahan PLTT-JTM (FR-05)
 * Modes: Day / Week / Month with color-coded facilities (per facility.colorCode).
 * - Public scope (default) → only APPROVED bookings, no applicant info
 * - Admin scope (FACILITY_ADMIN+) → all statuses + applicant name/department
 *
 * Features:
 *   • Mode switcher (Day/Week/Month) + Today + Prev/Next
 *   • Search by program / facility / bookingRef (+ applicant name for admins)
 *   • Facility filter dropdown
 *   • Color-coded chips/blocks with click-to-open Popover (full details)
 *   • Automatic visual highlight for time-overlapping bookings (amber ring + warning)
 *   • Export PDF / Excel buttons → toast.info placeholder
 *   • Empty-cell click → toast.info ("Klik 'Mohon Tempahan' …")
 *   • Loading skeletons + per-day empty state
 */

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Search,
  LayoutGrid,
  CalendarDays,
  CalendarRange,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addDays,
  addMonths,
  isSameMonth,
  isToday as isTodayFn,
} from 'date-fns';

/* ---------- constants ---------- */

const DAY_START_HOUR = 8;
const DAY_END_HOUR = 22;
const CELL_HEIGHT_PER_MIN = 1.2; // 1 hour = 72px (per spec)
const TIMELINE_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * 60 * CELL_HEIGHT_PER_MIN; // 1008px
const GUTTER_HOURS = [8, 10, 12, 14, 16, 18, 20, 22];

type Mode = 'day' | 'week' | 'month';

interface CalendarBooking {
  id: string;
  bookingRef: string;
  facility: { id?: string; name: string; location: string; colorCode: string };
  eventDate: string;
  startTime: string;
  endTime: string;
  status: string;
  programName: string | null;
  user?: { id: string; name: string; email: string; department: string | null } | null;
}

/* ---------- helpers ---------- */

function parseTimeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Convert any CSS color to an rgba string with given alpha. Falls back to the original color if parsing fails. */
function toRgba(color: string, alpha: number): string {
  if (!color) return `rgba(20, 184, 166, ${alpha})`;
  const hex = color.trim().startsWith('#') ? color.trim().slice(1) : color.trim();
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    const expanded = hex.split('').map((c) => c + c).join('');
    const r = parseInt(expanded.slice(0, 2), 16);
    const g = parseInt(expanded.slice(2, 4), 16);
    const b = parseInt(expanded.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(hex)) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/* ============================================================
   CalendarView — main component
   ============================================================ */

export function CalendarView() {
  const { t, lang } = useT();
  const { isAuthenticated, isAdmin } = useCurrentUser();

  const [mode, setMode] = useState<Mode>('week');
  const [cursor, setCursor] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const locale = lang === 'bm' ? 'ms-MY' : 'en-GB';

  /* ----- date range based on mode ----- */
  const range = useMemo(() => {
    if (mode === 'day') {
      const start = new Date(cursor);
      start.setHours(0, 0, 0, 0);
      return { start, end: addDays(start, 1) };
    }
    if (mode === 'week') {
      const start = startOfWeek(cursor, { weekStartsOn: 1 });
      return { start, end: addDays(start, 7) };
    }
    // month — extend grid to full Monday-Sunday weeks
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = addDays(endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }), 1);
    return { start, end };
  }, [mode, cursor]);

  const from = range.start.toISOString();
  const to = range.end.toISOString();
  const scope = isAuthenticated && isAdmin ? 'all' : 'public';

  /* ----- queries ----- */
  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const r = await fetch('/api/facilities');
      const j = await r.json();
      return (j.data ?? []) as Array<{
        id: string;
        name: string;
        category: string;
        colorCode: string;
        location: string;
        capacity: number;
      }>;
    },
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['calendar-bookings', scope, from, to],
    queryFn: async () => {
      const url =
        `/api/bookings?scope=${scope}` +
        `&from=${encodeURIComponent(from)}` +
        `&to=${encodeURIComponent(to)}` +
        `&pageSize=300`;
      const r = await fetch(url);
      const j = await r.json();
      return (j.data ?? []) as CalendarBooking[];
    },
  });

  /* ----- group by day + detect overlap ----- */
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of bookings ?? []) {
      const key = new Date(b.eventDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [bookings]);

  // Visual-overlap detection: same facility, same day, time ranges intersect.
  const overlapIds = useMemo(() => {
    const ids = new Set<string>();
    for (const list of bookingsByDay.values()) {
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (a.facility.name !== b.facility.name) continue;
          if (a.startTime < b.endTime && b.startTime < a.endTime) {
            ids.add(a.id);
            ids.add(b.id);
          }
        }
      }
    }
    return ids;
  }, [bookingsByDay]);

  /* ----- search + facility filter ----- */
  const filteredByDay = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    const s = search.trim().toLowerCase();
    for (const [k, list] of bookingsByDay.entries()) {
      const filtered = list.filter((b) => {
        if (facilityFilter !== 'all' && b.facility.name !== facilityFilter) return false;
        if (!s) return true;
        const applicant = b.user?.name?.toLowerCase() ?? '';
        return (
          (b.programName?.toLowerCase().includes(s) ?? false) ||
          b.facility.name.toLowerCase().includes(s) ||
          b.bookingRef.toLowerCase().includes(s) ||
          applicant.includes(s)
        );
      });
      map.set(k, filtered);
    }
    return map;
  }, [bookingsByDay, facilityFilter, search]);

  /* ----- navigation ----- */
  const goPrev = () => {
    if (mode === 'day') setCursor((c) => addDays(c, -1));
    else if (mode === 'week') setCursor((c) => addDays(c, -7));
    else setCursor((c) => addMonths(c, -1));
  };
  const goNext = () => {
    if (mode === 'day') setCursor((c) => addDays(c, 1));
    else if (mode === 'week') setCursor((c) => addDays(c, 7));
    else setCursor((c) => addMonths(c, 1));
  };
  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  };

  const periodLabel = useMemo(() => {
    if (mode === 'day') {
      return cursor.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (mode === 'week') {
      const s = startOfWeek(cursor, { weekStartsOn: 1 });
      const e = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${s.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} — ${e.toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }
    return cursor.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  }, [mode, cursor, locale]);

  // Weekday header labels (Mon-Sun, localized)
  const weekdayLabels = useMemo(() => {
    const monday = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return d.toLocaleDateString(locale, { weekday: 'short' });
    });
  }, [locale]);

  /* ----- actions ----- */
  const handleExport = (_kind: 'pdf' | 'excel') => {
    toast.info(lang === 'bm' ? 'Eksport akan datang' : 'Export coming soon');
  };
  const handleEmptyClick = () => {
    toast.info(
      lang === 'bm'
        ? "Klik 'Mohon Tempahan' untuk membuat tempahan baharu"
        : "Click 'New Booking' to create a new booking",
    );
  };

  /* ----- render ----- */
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Hero */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
            <Calendar className="w-3 h-3" />
            <span>{lang === 'bm' ? 'Paparan Bersepadu' : 'Integrated View'} · FR-05</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold gradient-text mb-1">{t('nav_calendar')}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {lang === 'bm'
              ? 'Paparan kalendar bersepadu semua tempahan kemudahan PLTT — mod Hari / Minggu / Bulan dengan kod warna per kemudahan.'
              : 'Integrated calendar of all PLTT facility bookings — Day / Week / Month modes with color-coded facilities.'}
          </p>
          {/* Facility color legend */}
          <div className="flex flex-wrap gap-2 mt-4">
            {(facilitiesData ?? []).slice(0, 6).map((f) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full glass-input border border-border/40"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: f.colorCode }} />
                {f.name}
              </span>
            ))}
            {scope === 'all' && (
              <Badge variant="outline" className="text-[10px] glass-input border-amber-400/40 text-amber-700">
                {lang === 'bm' ? 'Skop Pentadbir' : 'Admin Scope'}
              </Badge>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Toolbar */}
      <GlassCard className="p-3 lg:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            {/* Mode switcher */}
            <div
              role="tablist"
              aria-label="Calendar mode"
              className="inline-flex p-1 rounded-lg glass-input border border-border/40 self-start"
            >
              <ModeButton active={mode === 'day'} onClick={() => setMode('day')} icon={CalendarDays} label={t('calendar_day')} />
              <ModeButton active={mode === 'week'} onClick={() => setMode('week')} icon={CalendarRange} label={t('calendar_week')} />
              <ModeButton active={mode === 'month'} onClick={() => setMode('month')} icon={LayoutGrid} label={t('calendar_month')} />
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button variant="outline" size="icon" onClick={goPrev} className="glass-input shrink-0" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-semibold min-w-[160px] text-center truncate">{periodLabel}</div>
              <Button variant="outline" size="icon" onClick={goNext} className="glass-input shrink-0" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} className="ml-1 glass-input text-xs shrink-0">
                {t('calendar_today')}
              </Button>
            </div>

            {/* Export buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} className="glass-input text-xs">
                <FileText className="w-3.5 h-3.5" />
                PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('excel')} className="glass-input text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Excel
              </Button>
            </div>
          </div>

          {/* Search + facility filter */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  lang === 'bm'
                    ? 'Cari nama program, kemudahan, rujukan…'
                    : 'Search program, facility, reference…'
                }
                className="pl-9 glass-input"
                aria-label={t('search')}
              />
            </div>
            <Select value={facilityFilter} onValueChange={setFacilityFilter}>
              <SelectTrigger className="glass-input md:w-64" aria-label={t('filter')}>
                <SelectValue placeholder={t('form_facility')} />
              </SelectTrigger>
              <SelectContent className="glass-strong">
                <SelectItem value="all">{lang === 'bm' ? 'Semua Kemudahan' : 'All Facilities'}</SelectItem>
                {(facilitiesData ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.name}>
                    <span className="inline-flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: f.colorCode }} />
                      {f.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Calendar body */}
      {isLoading ? (
        <CalendarSkeleton mode={mode} />
      ) : mode === 'month' ? (
        <MonthGrid
          cursor={cursor}
          locale={locale}
          weekdayLabels={weekdayLabels}
          filteredByDay={filteredByDay}
          overlapIds={overlapIds}
          onEmptyClick={handleEmptyClick}
          scope={scope}
          lang={lang}
        />
      ) : mode === 'week' ? (
        <WeekGrid
          cursor={cursor}
          locale={locale}
          filteredByDay={filteredByDay}
          overlapIds={overlapIds}
          onEmptyClick={handleEmptyClick}
          scope={scope}
          lang={lang}
        />
      ) : (
        <DayTimeline
          cursor={cursor}
          locale={locale}
          filteredByDay={filteredByDay}
          overlapIds={overlapIds}
          onEmptyClick={handleEmptyClick}
          scope={scope}
          lang={lang}
        />
      )}
    </motion.div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Calendar;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/60',
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

/* ---------- Month ---------- */

function MonthGrid({
  cursor,
  locale,
  weekdayLabels,
  filteredByDay,
  overlapIds,
  onEmptyClick,
  scope,
  lang,
}: {
  cursor: Date;
  locale: string;
  weekdayLabels: string[];
  filteredByDay: Map<string, CalendarBooking[]>;
  overlapIds: Set<string>;
  onEmptyClick: () => void;
  scope: string;
  lang: 'bm' | 'en';
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <GlassCard className="p-3 lg:p-4">
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekdayLabels.map((d) => (
          <div
            key={d}
            className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center py-1"
          >
            {d}
          </div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, cursor);
          const today = isTodayFn(day);
          const list = filteredByDay.get(day.toDateString()) ?? [];
          const visible = list.slice(0, 3);
          const overflow = list.length - visible.length;
          const isEmpty = list.length === 0;
          return (
            <div
              key={day.toISOString()}
              role={isEmpty ? 'button' : undefined}
              tabIndex={isEmpty ? 0 : undefined}
              onClick={() => isEmpty && onEmptyClick()}
              onKeyDown={(e) => {
                if (isEmpty && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onEmptyClick();
                }
              }}
              className={cn(
                'min-h-[110px] lg:min-h-[130px] p-1.5 rounded-lg border border-border/40 glass-input flex flex-col gap-1 transition-colors',
                !inMonth && 'opacity-40',
                today && 'ring-2 ring-teal-500/50',
                isEmpty && 'cursor-pointer hover:bg-accent/40',
              )}
            >
              <div className={cn('text-[11px] font-bold flex items-center justify-between', today && 'text-teal-600')}>
                <span>{day.getDate()}</span>
                {today && (
                  <span className="text-[9px] uppercase font-semibold text-teal-500">
                    {lang === 'bm' ? 'Hari ini' : 'Today'}
                  </span>
                )}
              </div>
              <div className="flex-1 space-y-1 overflow-hidden">
                {visible.map((b) => (
                  <BookingChip
                    key={b.id}
                    booking={b}
                    overlap={overlapIds.has(b.id)}
                    scope={scope}
                    locale={locale}
                  />
                ))}
                {overflow > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
                      >
                        +{overflow} {lang === 'bm' ? 'lagi' : 'more'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="glass-strong w-72 p-3" align="start">
                      <div className="text-xs font-semibold mb-2">
                        {day.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                      </div>
                      <div className="space-y-2 max-h-72 overflow-y-auto scroll-area-thin">
                        {list.map((b) => (
                          <BookingDetailContent
                            key={b.id}
                            booking={b}
                            overlap={overlapIds.has(b.id)}
                            scope={scope}
                            locale={locale}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
                {isEmpty && (
                  <div className="text-[10px] text-muted-foreground/60 italic text-center mt-1">
                    {lang === 'bm' ? 'Tiada' : 'Empty'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
}

/** Compact chip used inside Month cells. */
function BookingChip({
  booking,
  overlap,
  scope,
  locale,
}: {
  booking: CalendarBooking;
  overlap: boolean;
  scope: string;
  locale: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left p-1.5 rounded-md text-[10px] transition-all hover:scale-[1.02] focus:outline-none focus:ring-1 focus:ring-teal-500"
          style={{
            background: toRgba(booking.facility.colorCode, 0.12),
            borderLeft: `3px solid ${booking.facility.colorCode}`,
          }}
          aria-label={`Booking ${booking.bookingRef}`}
        >
          <div className="flex items-center gap-1 font-semibold text-foreground min-w-0">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span className="whitespace-nowrap shrink-0">{booking.startTime}</span>
            {overlap && <AlertTriangle className="w-2.5 h-2.5 text-amber-600 shrink-0 ml-auto" />}
          </div>
          <div className="text-foreground/80 font-medium mt-0.5 line-clamp-2 break-words min-w-0">
            {booking.programName ?? booking.facility.name}
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="glass-strong w-72 p-3" sideOffset={4}>
        <BookingDetailContent booking={booking} overlap={overlap} scope={scope} locale={locale} />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Week ---------- */

function WeekGrid({
  cursor,
  locale,
  filteredByDay,
  overlapIds,
  onEmptyClick,
  scope,
  lang,
}: {
  cursor: Date;
  locale: string;
  filteredByDay: Map<string, CalendarBooking[]>;
  overlapIds: Set<string>;
  onEmptyClick: () => void;
  scope: string;
  lang: 'bm' | 'en';
}) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <GlassCard className="p-3 lg:p-4">
      <div className="flex gap-2">
        {/* Time gutter (decorative orientation, 08:00-22:00 in 2h steps) */}
        <div
          className="w-12 shrink-0 flex flex-col justify-between pt-9 pb-2 text-right pr-1"
          aria-hidden="true"
        >
          {GUTTER_HOURS.map((h) => (
            <div key={h} className="text-[10px] font-mono text-muted-foreground">
              {h.toString().padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        <div className="flex-1 grid grid-cols-7 gap-1.5 min-w-0">
          {days.map((d) => {
            const today = isTodayFn(d);
            const list = filteredByDay.get(d.toDateString()) ?? [];
            return (
              <div
                key={d.toISOString()}
                className={cn(
                  'rounded-lg border border-border/40 glass-input flex flex-col min-h-[480px]',
                  today && 'ring-2 ring-teal-500/40 bg-teal-500/5',
                )}
              >
                <div className={cn('text-center py-2 border-b border-border/40', today && 'bg-teal-500/10 rounded-t-lg')}>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {d.toLocaleDateString(locale, { weekday: 'short' })}
                  </div>
                  <div className={cn('text-sm font-bold mt-0.5', today ? 'text-teal-700' : 'text-foreground')}>
                    {d.getDate()}
                  </div>
                </div>
                <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto scroll-area-thin max-h-[640px]">
                  {list.length === 0 ? (
                    <button
                      type="button"
                      onClick={onEmptyClick}
                      className="w-full text-[10px] text-muted-foreground/70 italic text-center py-6 hover:text-foreground transition-colors rounded-md hover:bg-accent/30"
                    >
                      {lang === 'bm' ? 'Tiada tempahan' : 'No bookings'}
                    </button>
                  ) : (
                    list.map((b) => (
                      <WeekBookingCard
                        key={b.id}
                        booking={b}
                        overlap={overlapIds.has(b.id)}
                        scope={scope}
                        locale={locale}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

/** Detailed chip used in Week columns. */
function WeekBookingCard({
  booking,
  overlap,
  scope,
  locale,
}: {
  booking: CalendarBooking;
  overlap: boolean;
  scope: string;
  locale: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full text-left p-2 rounded-md transition-all hover:scale-[1.02] focus:outline-none focus:ring-1 focus:ring-teal-500"
          style={{
            background: toRgba(booking.facility.colorCode, 0.1),
            borderLeft: `3px solid ${booking.facility.colorCode}`,
          }}
          aria-label={`Booking ${booking.bookingRef}`}
        >
          <div className="flex items-center justify-between gap-1 min-w-0">
            <span className="text-[10px] font-mono font-semibold text-foreground flex items-center gap-1 min-w-0 whitespace-nowrap shrink-0">
              <Clock className="w-2.5 h-2.5 shrink-0" />
              {booking.startTime}–{booking.endTime}
            </span>
            {overlap && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
          </div>
          <div className="text-[11px] font-semibold text-foreground mt-0.5 line-clamp-2 break-words min-w-0">
            {booking.programName ?? booking.facility.name}
          </div>
          <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground min-w-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: booking.facility.colorCode }} />
            <span className="break-words whitespace-normal min-w-0">{booking.facility.name}</span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="glass-strong w-72 p-3" sideOffset={4}>
        <BookingDetailContent booking={booking} overlap={overlap} scope={scope} locale={locale} />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Day ---------- */

function DayTimeline({
  cursor,
  locale,
  filteredByDay,
  overlapIds,
  onEmptyClick,
  scope,
  lang,
}: {
  cursor: Date;
  locale: string;
  filteredByDay: Map<string, CalendarBooking[]>;
  overlapIds: Set<string>;
  onEmptyClick: () => void;
  scope: string;
  lang: 'bm' | 'en';
}) {
  const list = useMemo(
    () =>
      [...(filteredByDay.get(cursor.toDateString()) ?? [])].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      ),
    [filteredByDay, cursor],
  );
  const today = isTodayFn(cursor);

  return (
    <GlassCard className="p-3 lg:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
        <div>
          <div className={cn('text-base font-bold', today && 'text-teal-700')}>
            {cursor.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {list.length} {lang === 'bm' ? 'tempahan' : 'bookings'}
            {today && ` · ${lang === 'bm' ? 'Hari ini' : 'Today'}`}
          </div>
        </div>
        <Badge variant="outline" className="glass-input text-[10px] self-start">
          <Clock className="w-3 h-3" />
          {lang === 'bm' ? 'Garis masa' : 'Timeline'} 08:00–22:00
        </Badge>
      </div>

      {/* Timeline */}
      <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
        {/* Hour markers (gutter labels + horizontal lines) */}
        {GUTTER_HOURS.slice(0, -1).map((h) => {
          const top = (h - DAY_START_HOUR) * 60 * CELL_HEIGHT_PER_MIN;
          return (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-center pointer-events-none"
              style={{ top: `${top}px` }}
            >
              <div className="w-12 text-right pr-2 text-[10px] font-mono text-muted-foreground">
                {h.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 border-t border-border/40" />
            </div>
          );
        })}
        {/* Bottom edge line (22:00) */}
        <div
          className="absolute left-0 right-0 flex items-center pointer-events-none"
          style={{ top: `${TIMELINE_HEIGHT}px` }}
        >
          <div className="w-12 text-right pr-2 text-[10px] font-mono text-muted-foreground">
            {DAY_END_HOUR.toString().padStart(2, '0')}:00
          </div>
          <div className="flex-1 border-t border-border/40" />
        </div>

        {/* Booking blocks layer */}
        <div className="absolute left-12 right-2 top-0 bottom-0">
          {list.length === 0 ? (
            <button
              type="button"
              onClick={onEmptyClick}
              className="absolute inset-0 w-full h-full rounded-lg border border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors"
            >
              {lang === 'bm' ? 'Tiada tempahan pada hari ini' : 'No bookings on this day'}
            </button>
          ) : (
            list.map((b) => {
              const startMin = parseTimeToMin(b.startTime);
              const endMin = parseTimeToMin(b.endTime);
              const top = Math.max(0, (startMin - DAY_START_HOUR * 60) * CELL_HEIGHT_PER_MIN);
              const height = Math.max(36, (endMin - startMin) * CELL_HEIGHT_PER_MIN);
              return (
                <DayBookingBlock
                  key={b.id}
                  booking={b}
                  top={top}
                  height={height}
                  overlap={overlapIds.has(b.id)}
                  scope={scope}
                  locale={locale}
                />
              );
            })
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/** Absolutely-positioned booking block used in Day timeline. */
function DayBookingBlock({
  booking,
  top,
  height,
  overlap,
  scope,
  locale,
}: {
  booking: CalendarBooking;
  top: number;
  height: number;
  overlap: boolean;
  scope: string;
  locale: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="absolute left-0 right-0 rounded-md p-2 text-left transition-all hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-sm overflow-hidden"
          style={{
            top: `${top}px`,
            height: `${height}px`,
            background: toRgba(booking.facility.colorCode, 0.18),
            borderLeft: `4px solid ${booking.facility.colorCode}`,
            ...(overlap ? { boxShadow: '0 0 0 1.5px rgba(245, 158, 11, 0.7) inset' } : {}),
          }}
          aria-label={`Booking ${booking.bookingRef}`}
        >
          <div className="flex items-start justify-between gap-1 min-w-0">
            <span className="text-[11px] font-mono font-semibold text-foreground whitespace-nowrap shrink-0">
              {booking.startTime}–{booking.endTime}
            </span>
            {overlap && <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />}
          </div>
          <div className="text-[12px] font-semibold text-foreground line-clamp-2 break-words min-w-0 mt-0.5">
            {booking.programName ?? booking.facility.name}
          </div>
          {height >= 56 && (
            <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 min-w-0">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="break-words whitespace-normal min-w-0">{booking.facility.name}</span>
            </div>
          )}
          {height >= 88 && (
            <div className="mt-1">
              <StatusBadge status={booking.status} className="!text-[9px] !py-0 !px-1.5" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="glass-strong w-72 p-3" sideOffset={6} align="start">
        <BookingDetailContent booking={booking} overlap={overlap} scope={scope} locale={locale} />
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Shared popover body ---------- */

function BookingDetailContent({
  booking,
  overlap,
  scope,
  locale,
}: {
  booking: CalendarBooking;
  overlap: boolean;
  scope: string;
  locale: string;
}) {
  const evDate = new Date(booking.eventDate);
  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: booking.facility.colorCode }} />
          <span className="text-xs font-bold text-foreground line-clamp-2">
            {booking.programName ?? booking.facility.name}
          </span>
        </div>
        <StatusBadge status={booking.status} className="!text-[9px] !py-0 !px-1.5 shrink-0" />
      </div>

      {overlap && (
        <div className="text-[10px] text-amber-700 bg-amber-100/60 border border-amber-300/50 rounded px-1.5 py-0.5 flex items-center gap-1">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>Bertindih / Overlapping time slot</span>
        </div>
      )}

      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{booking.facility.name} · {booking.facility.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3 h-3 shrink-0" />
          <span>
            {evDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 shrink-0" />
          <span className="font-mono">{booking.startTime} – {booking.endTime}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 shrink-0 text-center text-[9px] font-mono">#</span>
          <span className="font-mono text-[10px]">{booking.bookingRef}</span>
        </div>
      </div>

      {scope === 'all' && booking.user && (
        <div className="pt-2 mt-1 border-t border-border/40 space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <Users className="w-3 h-3 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">{booking.user.name}</span>
          </div>
          {booking.user.department && (
            <div className="text-[10px] text-muted-foreground pl-[18px]">{booking.user.department}</div>
          )}
        </div>
      )}

      {scope === 'public' && (
        <div className="pt-2 mt-1 border-t border-border/40 text-[10px] text-muted-foreground italic">
          Maklumat pemohon dirahsiakan · Applicant info hidden
        </div>
      )}
    </div>
  );
}

/* ---------- Skeleton ---------- */

function CalendarSkeleton({ mode }: { mode: Mode }) {
  if (mode === 'day') {
    return (
      <GlassCard className="p-4">
        <Skeleton className="h-6 w-56 mb-4" />
        <div className="relative" style={{ height: TIMELINE_HEIGHT }}>
          {GUTTER_HOURS.slice(0, -1).map((h) => {
            const top = (h - DAY_START_HOUR) * 60 * CELL_HEIGHT_PER_MIN;
            return (
              <div
                key={h}
                className="absolute left-0 right-0 flex items-center pointer-events-none"
                style={{ top: `${top}px` }}
              >
                <div className="w-12 pr-2">
                  <Skeleton className="h-3 w-10 ml-auto" />
                </div>
                <div className="flex-1 border-t border-border/40" />
              </div>
            );
          })}
          <div className="absolute left-12 right-2 top-4 w-2/3">
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <div className="absolute left-12 right-2 top-32 w-1/2">
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
          <div className="absolute left-12 right-2 top-72 w-3/4">
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      </GlassCard>
    );
  }

  if (mode === 'week') {
    return (
      <GlassCard className="p-4">
        <div className="flex gap-2">
          <Skeleton className="w-12 shrink-0 h-[480px]" />
          <div className="flex-1 grid grid-cols-7 gap-1.5">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-10 rounded-t-lg" />
                <Skeleton className="h-16 rounded-md" />
                <Skeleton className="h-12 rounded-md" />
                <Skeleton className="h-20 rounded-md" />
                <Skeleton className="h-14 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    );
  }

  // month
  return (
    <GlassCard className="p-4">
      <div className="grid grid-cols-7 gap-1 mb-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-5" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }, (_, i) => (
          <Skeleton key={i} className="min-h-[110px] lg:min-h-[130px] rounded-lg" />
        ))}
      </div>
    </GlassCard>
  );
}
