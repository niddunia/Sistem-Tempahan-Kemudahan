'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { useT } from '@/hooks/use-t';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Building2,
  CheckCircle2,
  XCircle,
  Clock3,
  Sparkles,
  FileText,
  Download,
  Loader2,
  Activity,
  Gauge,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { TranslationKey } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// ===================== Types =====================
interface AnalyticsData {
  total: number;
  byStatus: Record<string, number>;
  byFacility: { name: string; category: string; count: number }[];
  byDay: Record<string, number>;
  byHour: Record<string, number>;
  utilizationRate: number;
  facilitiesCount: number;
  activeFacilitiesCount: number;
}

// ===================== Constants =====================
// 5 status colors matching the status badges (teal/emerald/amber/rose/zinc)
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', // amber
  APPROVED: '#10b981', // emerald
  REJECTED: '#f43f5e', // rose
  CANCELLED: '#71717a', // zinc
  COMPLETED: '#14b8a6', // teal
  NEEDS_INFO: '#fb923c', // orange
};

const FACILITY_PALETTE = ['#14b8a6', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.9)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255,255,255,0.5)',
  borderRadius: '8px',
  fontSize: '12px',
} as const;

// ===================== Helpers =====================
const shortDate = (iso: string, lang: 'bm' | 'en') => {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', {
    day: '2-digit',
    month: 'short',
  });
};

// ===================== Main View =====================
export function AnalyticsView() {
  const { t, lang } = useT();
  const { user } = useCurrentUser();
  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);

  const [days, setDays] = useState(30);

  // ---- AI summary local state ----
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ---- Fetch analytics ----
  const { data, isLoading, isError } = useQuery<AnalyticsData>({
    queryKey: ['analytics', days],
    queryFn: async () => {
      const r = await fetch(`/api/analytics?days=${days}`, { credentials: 'include' });
      if (!r.ok) throw new Error('failed');
      const j = await r.json();
      return j.data as AnalyticsData;
    },
    enabled: !!user,
  });

  // ---- Chart data transforms ----
  const trendData = useMemo(() => {
    if (!data?.byDay) return [];
    return Object.entries(data.byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const statusData = useMemo(() => {
    if (!data?.byStatus) return [];
    return Object.entries(data.byStatus).map(([name, value]) => ({ name, value }));
  }, [data]);

  const facilityData = useMemo(() => {
    if (!data?.byFacility) return [];
    return data.byFacility.slice(0, 5);
  }, [data]);

  const hourData = useMemo(() => {
    if (!data?.byHour) return [];
    const result: { hour: string; count: number }[] = [];
    for (let h = 8; h <= 22; h++) {
      const key = String(h).padStart(2, '0');
      result.push({ hour: key, count: data.byHour[key] ?? 0 });
    }
    return result;
  }, [data]);

  // ---- AI summary fetch (manual, with 30s timeout fallback) ----
  const generateAI = useCallback(async () => {
    setAiLoading(true);
    setAiError(false);
    setAiSummary(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const timeout = setTimeout(() => ctrl.abort(), 30_000);
    try {
      const r = await fetch('/api/ai/report-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
        signal: ctrl.signal,
      });
      if (!r.ok) throw new Error('ai_unavailable');
      const j = await r.json();
      const summary: string = j?.data?.summary ?? '';
      if (!summary.trim()) throw new Error('empty');
      setAiSummary(summary);
    } catch {
      setAiError(true);
    } finally {
      clearTimeout(timeout);
      setAiLoading(false);
      abortRef.current = null;
    }
  }, []);

  // ---- Stat tile defs ----
  const statTiles = useMemo(() => {
    if (!data) return [];
    return [
      {
        key: 'total',
        label: t('stats_total_bookings'),
        value: data.total,
        icon: BarChart3,
        gradient: 'from-teal-400 to-teal-600',
        glow: 'bg-teal-500/15',
      },
      {
        key: 'pending',
        label: t('stats_pending'),
        value: data.byStatus.PENDING ?? 0,
        icon: Clock3,
        gradient: 'from-amber-400 to-orange-500',
        glow: 'bg-amber-500/15',
      },
      {
        key: 'approved',
        label: t('stats_approved'),
        value: (data.byStatus.APPROVED ?? 0) + (data.byStatus.COMPLETED ?? 0),
        icon: CheckCircle2,
        gradient: 'from-emerald-400 to-teal-500',
        glow: 'bg-emerald-500/15',
      },
      {
        key: 'rejected',
        label: t('stats_rejected'),
        value: (data.byStatus.REJECTED ?? 0) + (data.byStatus.CANCELLED ?? 0),
        icon: XCircle,
        gradient: 'from-rose-400 to-rose-600',
        glow: 'bg-rose-500/15',
      },
      {
        key: 'utilization',
        label: t('stats_utilization'),
        value: `${data.utilizationRate}%`,
        icon: Gauge,
        gradient: 'from-teal-500 to-emerald-500',
        glow: 'bg-teal-500/15',
      },
    ];
  }, [data, t]);

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
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-wider mb-2">
              <Activity className="w-3 h-3" />
              <span>{t('nav_analytics')}</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold gradient-text">
              {tr('Dashboard Analitik & Laporan', 'Analytics Dashboard & Reports')}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              {tr(
                'Pantau prestasi penggunaan kemudahan & jana laporan naratif AI automatik.',
                'Monitor facility usage performance & generate automatic AI narrative reports.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Time range selector */}
            <div className="inline-flex rounded-lg glass p-1 gap-1">
              {[7, 30, 90].map((d) => (
                <Button
                  key={d}
                  size="sm"
                  variant="ghost"
                  onClick={() => setDays(d)}
                  className={cn(
                    'h-8 px-3 text-xs font-semibold rounded-md',
                    days === d &&
                      'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-sm hover:opacity-90',
                  )}
                >
                  {d} {tr('hari', 'days')}
                </Button>
              ))}
            </div>

            {/* Export buttons (visual only) */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info(tr('Eksport akan datang', 'Export coming soon'))}
              className="h-8"
            >
              <FileText className="w-3.5 h-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.info(tr('Eksport akan datang', 'Export coming soon'))}
              className="h-8"
            >
              <Download className="w-3.5 h-3.5" />
              Excel
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ===== Stats Row ===== */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
        {isLoading || !data
          ? Array.from({ length: 5 }).map((_, i) => (
              <GlassCard key={i} className="p-5">
                <Skeleton className="h-11 w-11 rounded-xl mb-3" />
                <Skeleton className="h-7 w-20 mb-2" />
                <Skeleton className="h-3 w-24" />
              </GlassCard>
            ))
          : statTiles.map((tile) => {
              const Icon = tile.icon;
              return (
                <GlassCard key={tile.key} className="p-5 relative overflow-hidden hover:shadow-lg transition-shadow">
                  <div className={cn('absolute -right-4 -top-4 w-20 h-20 rounded-full blur-2xl', tile.glow)} />
                  <div className="relative z-10">
                    <div
                      className={cn(
                        'w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg mb-3',
                        tile.gradient,
                      )}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-2xl lg:text-3xl font-bold tracking-tight">{tile.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{tile.label}</div>
                  </div>
                </GlassCard>
              );
            })}
      </div>

      {/* ===== Error state ===== */}
      {isError && (
        <Alert className="border-rose-300/60 bg-rose-50/70 text-rose-800">
          <XCircle className="w-4 h-4" />
          <AlertDescription>
            {tr('Gagal memuatkan data analitik. Sila muat semula halaman.', 'Failed to load analytics data. Please refresh the page.')}
          </AlertDescription>
        </Alert>
      )}

      {/* ===== Charts Grid ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
        {/* 1. Bookings Trend — AreaChart */}
        <GlassCard className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100/70 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {tr('Trend Tempahan', 'Bookings Trend')}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {tr(`${days} hari lepas`, `Last ${days} days`)}
                </p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : trendData.length === 0 ? (
            <ChartEmpty tr={tr} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => shortDate(v, lang)}
                  tick={{ fontSize: 11, fill: 'currentColor' }}
                  stroke="rgba(0,0,0,0.15)"
                  minTickGap={20}
                />
                <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} stroke="rgba(0,0,0,0.15)" allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(v) => new Date(v).toLocaleDateString(lang === 'bm' ? 'ms-MY' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                />
                <Area type="monotone" dataKey="count" name={tr('Tempahan', 'Bookings')} stroke="#14b8a6" strokeWidth={2.5} fill="url(#colorBookings)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* 2. Status Distribution — PieChart */}
        <GlassCard className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100/70 flex items-center justify-center">
                <Activity className="w-4 h-4 text-emerald-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {tr('Agihan Status', 'Status Distribution')}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {tr('Mengikut status semasa', 'By current status')}
                </p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : statusData.length === 0 ? (
            <ChartEmpty tr={tr} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                >
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={STATUS_COLORS[entry.name] ?? '#71717a'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Legend
                  verticalAlign="bottom"
                  height={40}
                  iconType="circle"
                  formatter={(value: string) => t(`status_${value}` as TranslationKey)}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* 3. Top Facilities — horizontal BarChart */}
        <GlassCard className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100/70 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-amber-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {tr('Kemudahan Teratas', 'Top Facilities')}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {tr('5 kemudahan paling tinggi', 'Top 5 most booked')}
                </p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : facilityData.length === 0 ? (
            <ChartEmpty tr={tr} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={facilityData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'currentColor' }} stroke="rgba(0,0,0,0.15)" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'currentColor' }}
                  stroke="rgba(0,0,0,0.15)"
                  width={140}
                  tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 21) + '…' : v)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(20,184,166,0.08)' }}
                  formatter={(v: number, _name, props) => [
                    v,
                    props?.payload?.category ?? tr('Bilangan', 'Count'),
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={22}>
                  {facilityData.map((_, idx) => (
                    <Cell key={idx} fill={FACILITY_PALETTE[idx % FACILITY_PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>

        {/* 4. Peak Hours — BarChart */}
        <GlassCard className="p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-teal-100/70 flex items-center justify-center">
                <Clock className="w-4 h-4 text-teal-700" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">
                  {t('stats_peak_hours')}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  {tr('Mengikut jam mula (08–22)', 'By start hour (08–22)')}
                </p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : hourData.length === 0 || hourData.every((h) => h.count === 0) ? (
            <ChartEmpty tr={tr} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'currentColor' }} stroke="rgba(0,0,0,0.15)" interval={0} />
                <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} stroke="rgba(0,0,0,0.15)" allowDecimals={false} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  cursor={{ fill: 'rgba(20,184,166,0.08)' }}
                  labelFormatter={(v) => `${v}:00`}
                />
                <Bar dataKey="count" name={tr('Tempahan', 'Bookings')} fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      {/* ===== AI Narrative Report ===== */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full bg-gradient-to-br from-teal-500/15 to-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold gradient-text">
                    {tr('Ringkasan Laporan AI', 'AI Report Summary')}
                  </h3>
                  <Badge className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white border-transparent text-[10px] font-semibold">
                    <Sparkles className="w-2.5 h-2.5 mr-1" />
                    {t('powered_by_ai')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tr(
                    'Jana naratif automatik 30 hari terkini menggunakan GLM 5.2.',
                    'Generate an automatic narrative of the last 30 days using GLM 5.2.',
                  )}
                </p>
              </div>
            </div>

            <Button
              onClick={generateAI}
              disabled={aiLoading}
              className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:opacity-90 h-10 shadow-md shadow-teal-500/20"
            >
              {aiLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {tr('Menjana...', 'Generating...')}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {tr('Jana Ringkasan AI', 'Generate AI Summary')}
                </>
              )}
            </Button>
          </div>

          {/* Body */}
          <div className="min-h-[180px]">
            {/* Loading */}
            {aiLoading && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="relative">
                  <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
                  <Sparkles className="w-4 h-4 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
                </div>
                <p className="mt-4 text-sm font-medium text-teal-700">
                  {tr('AI sedang menganalisis data...', 'AI is analyzing the data...')}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {tr(
                    'Proses ini mengambil masa 5–15 saat. Sila tunggu.',
                    'This process takes 5–15 seconds. Please wait.',
                  )}
                </p>
                <div className="mt-4 flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {!aiLoading && aiError && (
              <Alert className="border-amber-300/70 bg-amber-50/80 text-amber-800">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {tr(
                    'Perkhidmatan AI tidak tersedia buat sementara. Sila cuba lagi.',
                    'AI service is temporarily unavailable. Please try again.',
                  )}
                </AlertDescription>
              </Alert>
            )}

            {/* Success */}
            {!aiLoading && !aiError && aiSummary && (
              <div className="rounded-xl border border-teal-200/60 bg-gradient-to-br from-teal-50/60 to-emerald-50/40 p-4 lg:p-5">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-teal-200/40">
                  <FileText className="w-4 h-4 text-teal-700" />
                  <span className="text-xs font-semibold text-teal-800 uppercase tracking-wider">
                    {tr('Laporan Dijana', 'Generated Report')}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date().toLocaleString(lang === 'bm' ? 'ms-MY' : 'en-GB', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                    {aiSummary}
                  </p>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!aiLoading && !aiError && !aiSummary && (
              <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-teal-200/50 bg-teal-50/20">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-100 to-emerald-100 flex items-center justify-center mb-3">
                  <Sparkles className="w-6 h-6 text-teal-600" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {tr('Ringkasan AI belum dijana', 'AI summary not yet generated')}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  {tr(
                    'Klik butang "Jana Ringkasan AI" untuk mendapatkan analisis naratif automatik berdasarkan data 30 hari terkini.',
                    'Click "Generate AI Summary" to get an automatic narrative analysis based on the last 30 days of data.',
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ===================== Sub-components =====================
function ChartEmpty({ tr }: { tr: (bm: string, en: string) => string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
        <Ban className="w-5 h-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{tr('Tiada data', 'No data')}</p>
    </div>
  );
}
