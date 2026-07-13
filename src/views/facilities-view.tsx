'use client';

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useApp } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  Building2,
  Users,
  PlusCircle,
  Pencil,
  Trash2,
  MapPin,
  Users2,
  Clock,
  Wrench,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

// ===================== Types =====================
type FacilityStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
type Category = 'COMPUTER_ROOM' | 'LECTURE_HALL';

interface Facility {
  id: string;
  name: string;
  category: Category;
  capacity: number;
  location?: string | null;
  equipment?: string | null;
  operatingStart?: string | null;
  operatingEnd?: string | null;
  colorCode: string;
  status: FacilityStatus;
  createdAt: string;
  updatedAt: string;
}

interface FacilityFormState {
  name: string;
  category: Category;
  capacity: string;
  location: string;
  equipment: string;
  operatingStart: string;
  operatingEnd: string;
  colorCode: string;
}

const DEFAULT_FORM: FacilityFormState = {
  name: '',
  category: 'COMPUTER_ROOM',
  capacity: '30',
  location: '',
  equipment: '',
  operatingStart: '08:00',
  operatingEnd: '22:00',
  colorCode: '#0d9488',
};

// ===================== Helpers =====================
const safeParseEquip = (raw?: string | null): string[] => {
  if (!raw) return [];
  // Try JSON array first
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string' && x.trim());
  } catch {
    // fallthrough — treat as comma-separated
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
};

const toFormState = (f: Facility): FacilityFormState => ({
  name: f.name ?? '',
  category: f.category ?? 'COMPUTER_ROOM',
  capacity: String(f.capacity ?? 0),
  location: f.location ?? '',
  equipment: safeParseEquip(f.equipment).join(', '),
  operatingStart: f.operatingStart ?? '08:00',
  operatingEnd: f.operatingEnd ?? '22:00',
  colorCode: f.colorCode ?? '#0d9488',
});

const categoryLabel = (cat: Category, lang: 'bm' | 'en') =>
  cat === 'COMPUTER_ROOM'
    ? lang === 'bm'
      ? 'Bilik Komputer'
      : 'Computer Room'
    : lang === 'bm'
      ? 'Dewan Kuliah'
      : 'Lecture Hall';

// ===================== Main View =====================
export function FacilitiesView() {
  const { t, lang } = useT();
  const setView = useApp((s) => s.setView);
  const { isSuperAdmin, user } = useCurrentUser();
  const queryClient = useQueryClient();

  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facility | null>(null);
  const [form, setForm] = useState<FacilityFormState>(DEFAULT_FORM);

  // Status confirm (cycle to INACTIVE)
  const [statusCycleTarget, setStatusCycleTarget] = useState<Facility | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Facility | null>(null);

  // ===================== Query =====================
  const { data: facilities, isLoading } = useQuery<Facility[]>({
    queryKey: ['facilities', 'admin'],
    queryFn: async () => {
      const r = await fetch('/api/facilities?includeInactive=true');
      if (!r.ok) throw new Error('fetch failed');
      const j = await r.json();
      return j.data as Facility[];
    },
  });

  // ===================== Stats =====================
  const stats = useMemo(() => {
    const list = facilities ?? [];
    return {
      total: list.length,
      active: list.filter((f) => f.status === 'ACTIVE').length,
      maintenance: list.filter((f) => f.status === 'MAINTENANCE').length,
      inactive: list.filter((f) => f.status === 'INACTIVE').length,
      capacity: list.reduce((sum, f) => sum + (f.capacity || 0), 0),
    };
  }, [facilities]);

  // ===================== Filtered list =====================
  const filtered = useMemo(() => {
    const list = facilities ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((f) => {
      if (categoryFilter !== 'ALL' && f.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (s) {
        const hay = [f.name, f.location ?? '', safeParseEquip(f.equipment).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [facilities, search, categoryFilter, statusFilter]);

  // ===================== Mutations =====================
  const createMutation = useMutation({
    mutationFn: async (data: FacilityFormState) => {
      const body = {
        name: data.name.trim(),
        category: data.category,
        capacity: parseInt(data.capacity, 10) || 0,
        location: data.location.trim() || undefined,
        equipment: data.equipment.trim() || undefined,
        operatingStart: data.operatingStart,
        operatingEnd: data.operatingEnd,
        colorCode: data.colorCode,
      };
      const r = await fetch('/api/facilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'create failed');
      return j.data as Facility;
    },
    onSuccess: () => {
      toast.success(tr('Kemudahan berjaya ditambah', 'Facility added successfully'));
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal menambah kemudahan', 'Failed to add facility')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FacilityFormState }) => {
      const body = {
        name: data.name.trim(),
        capacity: parseInt(data.capacity, 10) || 0,
        location: data.location.trim() || undefined,
        equipment: data.equipment.trim() || undefined,
        operatingStart: data.operatingStart,
        operatingEnd: data.operatingEnd,
        colorCode: data.colorCode,
      };
      const r = await fetch(`/api/facilities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'update failed');
      return j.data as Facility;
    },
    onSuccess: () => {
      toast.success(tr('Kemudahan berjaya dikemas kini', 'Facility updated successfully'));
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal mengemas kini', 'Failed to update')),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: FacilityStatus }) => {
      const r = await fetch(`/api/facilities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'status update failed');
      return j.data as Facility;
    },
    onSuccess: (_d, vars) => {
      const msg = vars.status === 'ACTIVE'
        ? tr('Status ditukar ke Aktif', 'Status changed to Active')
        : vars.status === 'MAINTENANCE'
          ? tr('Status ditukar ke Penyelenggaraan', 'Status changed to Maintenance')
          : tr('Kemudahan dinyahaktifkan', 'Facility deactivated');
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setStatusCycleTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal menukar status', 'Failed to change status')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/facilities/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'delete failed');
      return j.data as Facility;
    },
    onSuccess: () => {
      toast.success(tr('Kemudahan berjaya dipadam', 'Facility deleted successfully'));
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal memadam', 'Failed to delete')),
  });

  // ===================== Handlers =====================
  const openCreate = () => {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setDialogOpen(true);
  };

  const openEdit = (f: Facility) => {
    setEditTarget(f);
    setForm(toFormState(f));
    setDialogOpen(true);
  };

  const submitForm = () => {
    if (!form.name.trim()) {
      toast.error(tr('Nama kemudahan diperlukan', 'Facility name is required'));
      return;
    }
    const cap = parseInt(form.capacity, 10);
    if (!cap || cap < 1) {
      toast.error(tr('Kapasiti mesti sekurang-kurangnya 1', 'Capacity must be at least 1'));
      return;
    }
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const cycleStatus = (f: Facility) => {
    // ACTIVE → MAINTENANCE → INACTIVE → ACTIVE
    const next: FacilityStatus =
      f.status === 'ACTIVE' ? 'MAINTENANCE' : f.status === 'MAINTENANCE' ? 'INACTIVE' : 'ACTIVE';
    if (next === 'INACTIVE') {
      // require confirmation
      setStatusCycleTarget(f);
    } else {
      statusMutation.mutate({ id: f.id, status: next });
    }
  };

  // ===================== Render =====================
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Header */}
      <GlassCard className="p-5 lg:p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="hidden sm:grid place-items-center w-12 h-12 rounded-xl gradient-primary text-white shadow-lg shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold gradient-text leading-tight">
                {t('nav_facilities')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tr('Tambah, kemas kini dan urus kemudahan bilik komputer & dewan kuliah', 'Add, update and manage computer room & lecture hall facilities')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setView('dashboard')} className="glass-input">
              {tr('Kembali', 'Back')}
            </Button>
            {isSuperAdmin && (
              <Button
                onClick={openCreate}
                className="gradient-primary text-white shadow-md hover:shadow-lg transition-shadow"
                size="sm"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                {tr('Tambah Kemudahan', 'Add Facility')}
              </Button>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Access warning for non-super-admin */}
      {!isSuperAdmin && (
        <GlassCard className="p-4 border-amber-300/60 bg-amber-50/60">
          <div className="flex items-start gap-3 text-amber-800">
            <ShieldCheck className="w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-semibold">{tr('Akses Terhad', 'Restricted Access')}</p>
              <p className="text-amber-700/90">
                {tr('Hanya Pentadbir Sistem boleh mengubah kemudahan. Anda hanya boleh melihat.', 'Only System Admins can modify facilities. You can view only.')}
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatTile
          icon={<Building2 className="w-5 h-5" />}
          label={tr('Jumlah Kemudahan', 'Total Facilities')}
          value={stats.total}
          tone="teal"
          loading={isLoading}
        />
        <StatTile
          icon={<ShieldCheck className="w-5 h-5" />}
          label={t('status_ACTIVE')}
          value={stats.active}
          tone="emerald"
          loading={isLoading}
        />
        <StatTile
          icon={<Wrench className="w-5 h-5" />}
          label={t('status_MAINTENANCE')}
          value={stats.maintenance}
          tone="amber"
          loading={isLoading}
        />
        <StatTile
          icon={<Building2 className="w-5 h-5" />}
          label={tr('Tidak Aktif', 'Inactive')}
          value={stats.inactive}
          tone="zinc"
          loading={isLoading}
        />
        <StatTile
          icon={<Users2 className="w-5 h-5" />}
          label={tr('Jumlah Kapasiti', 'Total Capacity')}
          value={stats.capacity}
          tone="teal"
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <GlassCard className="p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5" />
              {t('search')}
            </Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr('Cari nama, lokasi, peralatan...', 'Search name, location, equipment...')}
              className="glass-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{tr('Kategori', 'Category')}</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full md:w-48 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('Semua Kategori', 'All Categories')}</SelectItem>
                <SelectItem value="COMPUTER_ROOM">{tr('Bilik Komputer', 'Computer Room')}</SelectItem>
                <SelectItem value="LECTURE_HALL">{tr('Dewan Kuliah', 'Lecture Hall')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{tr('Status', 'Status')}</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-44 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('Semua Status', 'All Status')}</SelectItem>
                <SelectItem value="ACTIVE">{t('status_ACTIVE')}</SelectItem>
                <SelectItem value="MAINTENANCE">{t('status_MAINTENANCE')}</SelectItem>
                <SelectItem value="INACTIVE">{tr('Tidak Aktif', 'Inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-teal-600" />
            {tr('Senarai Kemudahan', 'Facility List')}
          </h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} {tr('rekod', 'records')}
          </span>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t('no_data')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {tr('Tiada kemudahan padanan penapis.', 'No facilities match the filter.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-area-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 whitespace-nowrap min-w-[180px]">{t('name')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[120px]">{tr('Kategori', 'Category')}</TableHead>
                  <TableHead className="text-center whitespace-nowrap min-w-[90px]">{t('form_participants')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[160px]">{tr('Lokasi', 'Location')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[140px]">{tr('Waktu Operasi', 'Operating Hours')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[280px]">{tr('Peralatan', 'Equipment')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[100px]">{tr('Status', 'Status')}</TableHead>
                  <TableHead className="text-right pr-4 whitespace-nowrap min-w-[160px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((f) => {
                  const equip = safeParseEquip(f.equipment);
                  return (
                    <TableRow key={f.id} className="hover:bg-teal-50/40 dark:hover:bg-teal-900/10">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="inline-block w-3 h-3 rounded-full ring-2 ring-white shadow-sm shrink-0"
                            style={{ backgroundColor: f.colorCode || '#0d9488' }}
                            aria-hidden
                          />
                          <div>
                            <p className="font-medium text-sm leading-tight">{f.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5 lg:hidden">
                              {categoryLabel(f.category, lang)} · {f.capacity} pax
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-medium',
                            f.category === 'COMPUTER_ROOM'
                              ? 'bg-teal-50/70 text-teal-700 border-teal-300/60'
                              : 'bg-amber-50/70 text-amber-700 border-amber-300/60',
                          )}
                        >
                          {categoryLabel(f.category, lang)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center gap-1 text-sm font-medium">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          {f.capacity}
                        </span>
                      </TableCell>
                      <TableCell>
                        {f.location ? (
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="max-w-[180px] truncate">{f.location}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {f.operatingStart ?? '08:00'}–{f.operatingEnd ?? '22:00'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {equip.length === 0 ? (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {equip.map((e, i) => (
                              <span
                                key={`${f.id}-eq-${i}`}
                                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50/80 text-emerald-700 border border-emerald-200/60 whitespace-normal break-words"
                              >
                                {e}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={f.status} />
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => cycleStatus(f)}
                            disabled={!isSuperAdmin}
                            className="glass-input h-8 px-2 text-xs"
                            title={tr('Tukar Status', 'Change Status')}
                          >
                            <Wrench className="w-3.5 h-3.5 mr-1" />
                            <span className="hidden md:inline">{tr('Tukar Status', 'Change Status')}</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(f)}
                            disabled={!isSuperAdmin}
                            className="glass-input h-8 w-8 p-0"
                            title={t('edit')}
                            aria-label={t('edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(f)}
                            disabled={!isSuperAdmin}
                            className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 border-rose-200/60"
                            title={t('delete')}
                            aria-label={t('delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => setDialogOpen(o)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-area-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-600" />
              {editTarget
                ? tr('Kemas Kini Kemudahan', 'Edit Facility')
                : tr('Tambah Kemudahan Baharu', 'Add New Facility')}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? tr('Kemas kini maklumat kemudahan ini.', 'Update this facility information.')
                : tr('Isi butiran kemudahan baru.', 'Fill in the new facility details.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="f-name">{t('name')} *</Label>
              <Input
                id="f-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tr('cth. Bilik Komputer 1', 'e.g. Computer Room 1')}
                className="glass-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{tr('Kategori', 'Category')} *</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}
                  disabled={!!editTarget}
                >
                  <SelectTrigger className="w-full glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPUTER_ROOM">{tr('Bilik Komputer', 'Computer Room')}</SelectItem>
                    <SelectItem value="LECTURE_HALL">{tr('Dewan Kuliah', 'Lecture Hall')}</SelectItem>
                  </SelectContent>
                </Select>
                {editTarget && (
                  <p className="text-xs text-muted-foreground">
                    {tr('Kategori tidak boleh diubah selepas dibuat.', 'Category cannot be changed after creation.')}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-cap">{tr('Kapasiti', 'Capacity')} *</Label>
                <Input
                  id="f-cap"
                  type="number"
                  min={1}
                  max={1000}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="f-loc">{tr('Lokasi', 'Location')}</Label>
              <Input
                id="f-loc"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={tr('cth. Aras 2, Blok A', 'e.g. Level 2, Block A')}
                className="glass-input"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="f-equip">{tr('Peralatan', 'Equipment')}</Label>
              <Textarea
                id="f-equip"
                value={form.equipment}
                onChange={(e) => setForm({ ...form, equipment: e.target.value })}
                placeholder={tr('Pisahkan dengan koma: LCD Projector, Whiteboard, AC, WiFi', 'Separate with commas: LCD Projector, Whiteboard, AC, WiFi')}
                rows={2}
                className="glass-input resize-none"
              />
              {form.equipment.trim() && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {form.equipment
                    .split(/[,;]+/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((e, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50/80 text-emerald-700 border border-emerald-200/60"
                      >
                        {e}
                      </span>
                    ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="f-start">{tr('Waktu Mula', 'Start Time')}</Label>
                <Input
                  id="f-start"
                  type="time"
                  value={form.operatingStart}
                  onChange={(e) => setForm({ ...form, operatingStart: e.target.value })}
                  className="glass-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="f-end">{tr('Waktu Tamat', 'End Time')}</Label>
                <Input
                  id="f-end"
                  type="time"
                  value={form.operatingEnd}
                  onChange={(e) => setForm({ ...form, operatingEnd: e.target.value })}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="f-color">{tr('Warna Penanda', 'Color Marker')}</Label>
              <div className="flex items-center gap-3">
                <input
                  id="f-color"
                  type="color"
                  value={form.colorCode}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  className="w-12 h-10 rounded-md border border-border bg-transparent cursor-pointer p-1"
                  aria-label={tr('Pemilih warna', 'Color picker')}
                />
                <Input
                  value={form.colorCode}
                  onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                  className="glass-input w-32 font-mono text-sm"
                />
                <div
                  className="ml-2 inline-flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <span
                    className="inline-block w-4 h-4 rounded-full ring-2 ring-white shadow"
                    style={{ backgroundColor: form.colorCode }}
                    aria-hidden
                  />
                  {tr('Pratonton', 'Preview')}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="glass-input">
              {t('close')}
            </Button>
            <Button
              onClick={submitForm}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gradient-primary text-white"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <span className="mr-2 h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
              )}
              {editTarget ? t('save') : tr('Tambah', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Cycle (to INACTIVE) Confirmation */}
      <AlertDialog
        open={!!statusCycleTarget}
        onOpenChange={(o) => !o && setStatusCycleTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-600" />
              {tr('Nyahaktifkan Kemudahan', 'Deactivate Facility')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Adakah anda pasti mahu menetapkan "${statusCycleTarget?.name ?? ''}" ke status Tidak Aktif?`,
                `Are you sure you want to set "${statusCycleTarget?.name ?? ''}" to Inactive status?`,
              )}
              <span className="block mt-2 text-amber-700">
                {tr('Kemudahan tidak akan tersedia untuk tempahan baharu.', 'The facility will be unavailable for new bookings.')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusCycleTarget) {
                  statusMutation.mutate({ id: statusCycleTarget.id, status: 'INACTIVE' });
                }
              }}
              disabled={statusMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {statusMutation.isPending ? t('loading') : t('yes')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-rose-700">
              <Trash2 className="w-5 h-5" />
              {tr('Padam Kemudahan', 'Delete Facility')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Adakah anda pasti mahu memadam "${deleteTarget?.name ?? ''}"?`,
                `Are you sure you want to delete "${deleteTarget?.name ?? ''}"?`,
              )}
              <span className="block mt-2 text-rose-700">
                {tr(
                  'Tindakan ini akan menetapkan status kemudahan kepada Tidak Aktif (padam lembut).',
                  'This action sets the facility status to Inactive (soft delete).',
                )}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending ? t('loading') : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Footer info */}
      {user && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          {tr('Log masuk sebagai', 'Logged in as')}{' '}
          <span className="font-medium text-foreground/80">{user.name}</span>{' '}
          ·{' '}
          {user.role === 'SUPER_ADMIN'
            ? t('role_SUPER_ADMIN')
            : user.role === 'FACILITY_ADMIN'
              ? t('role_FACILITY_ADMIN')
              : t('role_USER')}
        </p>
      )}
    </motion.div>
  );
}

// ===================== Stat Tile =====================
function StatTile({
  icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'teal' | 'emerald' | 'amber' | 'zinc';
  loading?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    zinc: 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300',
  };
  return (
    <GlassCard className="p-4 flex items-center gap-3">
      <div className={cn('grid place-items-center w-10 h-10 rounded-xl shrink-0', toneClasses[tone])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] text-muted-foreground uppercase tracking-wide break-words leading-tight">{label}</p>
        {loading ? (
          <Skeleton className="h-6 w-12 mt-1" />
        ) : (
          <p className="text-xl font-bold leading-tight">{value.toLocaleString()}</p>
        )}
      </div>
    </GlassCard>
  );
}

export default FacilitiesView;
