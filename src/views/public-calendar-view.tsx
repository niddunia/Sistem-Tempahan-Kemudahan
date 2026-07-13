'use client';

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarDays, MapPin, Users, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface PublicBooking {
  id: string;
  bookingRef: string;
  facility: { name: string; location: string; colorCode: string };
  eventDate: string;
  startTime: string;
  endTime: string;
  status: string;
  programName: string | null;
}

const DAY_MS = 86400000;

export function PublicCalendarView() {
  const { t, lang } = useT();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [facilityFilter, setFacilityFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const weekStart = useMemo(() => {
    const d = new Date(cursor);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    return d;
  }, [cursor]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const from = weekStart.toISOString();
  const to = new Date(weekStart.getTime() + 7 * DAY_MS).toISOString();

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities'],
    queryFn: async () => {
      const r = await fetch('/api/facilities');
      const j = await r.json();
      return j.data as Array<{ id: string; name: string; category: string; colorCode: string; location: string; capacity: number }>;
    },
  });

  const { data: bookings, isLoading } = useQuery({
    queryKey: ['public-bookings', from, to],
    queryFn: async () => {
      const r = await fetch(`/api/bookings?scope=public&from=${from}&to=${to}&pageSize=200`);
      const j = await r.json();
      return j.data as PublicBooking[];
    },
  });

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, PublicBooking[]>();
    for (const b of bookings ?? []) {
      const key = new Date(b.eventDate).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    }
    for (const list of map.values()) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [bookings]);

  const filtered = (list: PublicBooking[]) => list.filter((b) => {
    if (facilityFilter !== 'all' && b.facility.name !== facilityFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return b.programName?.toLowerCase().includes(s) || b.facility.name.toLowerCase().includes(s) || b.bookingRef.toLowerCase().includes(s);
    }
    return true;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
            <CalendarDays className="w-3 h-3" />
            <span>{t('appOrg')}</span>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold gradient-text mb-1">{t('public_title')}</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">{t('public_subtitle')}</p>
          <div className="flex flex-wrap gap-2 mt-4">
            {(facilitiesData ?? []).slice(0, 6).map((f) => (
              <span key={f.id} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-full glass-input border border-border/40">
                <span className="w-2 h-2 rounded-full" style={{ background: f.colorCode }} />
                {f.name}
              </span>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard className="p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getTime() - 7 * DAY_MS))} className="glass-input">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm font-semibold min-w-[180px] text-center">
              {weekStart.toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' — '}
              {new Date(weekStart.getTime() + 6 * DAY_MS).toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
            <Button variant="outline" size="icon" onClick={() => setCursor(new Date(cursor.getTime() + 7 * DAY_MS))} className="glass-input">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCursor(d); }} className="ml-2 glass-input text-xs">
              {t('calendar_today')}
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('search')} className="pl-9 glass-input w-full lg:w-64" />
          </div>
          <Select value={facilityFilter} onValueChange={setFacilityFilter}>
            <SelectTrigger className="glass-input w-full lg:w-56"><SelectValue placeholder={t('form_facility')} /></SelectTrigger>
            <SelectContent className="glass-strong">
              <SelectItem value="all">{lang === 'bm' ? 'Semua Kemudahan' : 'All Facilities'}</SelectItem>
              {(facilitiesData ?? []).map((f) => <SelectItem key={f.id} value={f.name}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const list = filtered(bookingsByDay.get(day.toDateString()) ?? []);
          const isToday = day.toDateString() === today.toDateString();
          return (
            <GlassCard key={day.toISOString()} className={cn('p-3 min-h-[180px] flex flex-col', isToday && 'ring-2 ring-teal-500/40')}>
              <div className={cn('text-xs font-bold uppercase tracking-wide pb-2 mb-2 border-b border-border/40 flex items-center justify-between', isToday && 'text-teal-600')}>
                <span>{day.toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', { weekday: 'short' })}</span>
                <span className="text-foreground/70">{day.getDate()}</span>
              </div>
              <div className="flex-1 space-y-1.5 overflow-y-auto scroll-area-thin max-h-[280px]">
                {isLoading ? (
                  <div className="text-[10px] text-muted-foreground text-center py-3">{t('loading')}</div>
                ) : list.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground text-center py-3 italic">{lang === 'bm' ? 'Tiada tempahan' : 'No bookings'}</div>
                ) : (
                  list.map((b) => <BookingChip key={b.id} booking={b} />)
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>
    </motion.div>
  );
}

function BookingChip({ booking }: { booking: PublicBooking }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="w-full text-left p-2 rounded-lg text-[10px] transition-all hover:scale-[1.02]"
      style={{ background: `${booking.facility.colorCode}1a`, borderLeft: `3px solid ${booking.facility.colorCode}` }}
    >
      <div className="flex items-center gap-1 font-semibold text-foreground">
        <Clock className="w-2.5 h-2.5" />
        <span>{booking.startTime} – {booking.endTime}</span>
      </div>
      <div className="text-foreground/80 font-medium mt-0.5 line-clamp-2">{booking.programName ?? booking.facility.name}</div>
      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
        <MapPin className="w-2.5 h-2.5" />
        <span className="truncate">{booking.facility.name}</span>
      </div>
      {expanded && (
        <div className="mt-1.5 pt-1.5 border-t border-border/40 space-y-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="w-2.5 h-2.5" />
            <span>{booking.bookingRef}</span>
          </div>
          <StatusBadge status={booking.status} className="!py-0 !text-[9px]" />
        </div>
      )}
    </button>
  );
}
