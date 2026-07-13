'use client';

import { useState, useMemo } from 'react';
import { useT } from '@/hooks/use-t';
import { useApp } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { GlassCard } from '@/components/glass-card';
import { StatusBadge, RoleBadge } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Search,
  Mail,
  Phone,
  BadgeCheck,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

// ===================== Types =====================
type Role = 'USER' | 'FACILITY_ADMIN' | 'SUPER_ADMIN';
type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'INACTIVE';

interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  phone?: string | null;
  staffId?: string | null;
  status: UserStatus;
  lastLoginAt?: string | null;
  createdAt: string;
}

interface UserFormState {
  name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  phone: string;
  staffId: string;
  status: UserStatus;
}

const DEFAULT_FORM: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
  department: '',
  phone: '',
  staffId: '',
  status: 'ACTIVE',
};

const toFormState = (u: User): UserFormState => ({
  name: u.name ?? '',
  email: u.email ?? '',
  password: '',
  role: u.role ?? 'USER',
  department: u.department ?? '',
  phone: u.phone ?? '',
  staffId: u.staffId ?? '',
  status: u.status ?? 'ACTIVE',
});

const initials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const avatarColor = (name: string): string => {
  const palette = [
    'bg-teal-500/80 text-white',
    'bg-emerald-500/80 text-white',
    'bg-amber-500/80 text-white',
    'bg-rose-500/80 text-white',
    'bg-fuchsia-500/80 text-white',
    'bg-lime-500/80 text-white',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

// ===================== Main View =====================
export function UsersView() {
  const { t, lang } = useT();
  const setView = useApp((s) => s.setView);
  const { isSuperAdmin, user: currentUser } = useCurrentUser();
  const queryClient = useQueryClient();

  const tr = (bm: string, en: string) => (lang === 'bm' ? bm : en);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [showPassword, setShowPassword] = useState(false);

  // Suspend confirmation
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  // ===================== Query =====================
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users', 'admin'],
    queryFn: async () => {
      const r = await fetch('/api/users');
      if (!r.ok) throw new Error('fetch failed');
      const j = await r.json();
      return j.data as User[];
    },
    enabled: isSuperAdmin,
  });

  // ===================== Stats =====================
  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      users: list.filter((u) => u.role === 'USER').length,
      facilityAdmins: list.filter((u) => u.role === 'FACILITY_ADMIN').length,
      superAdmins: list.filter((u) => u.role === 'SUPER_ADMIN').length,
      active: list.filter((u) => u.status === 'ACTIVE').length,
      suspended: list.filter((u) => u.status === 'SUSPENDED').length,
    };
  }, [users]);

  // ===================== Filtered list =====================
  const filtered = useMemo(() => {
    const list = users ?? [];
    const s = search.trim().toLowerCase();
    return list.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && u.status !== statusFilter) return false;
      if (s) {
        const hay = [u.name, u.email, u.department ?? '', u.staffId ?? ''].join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, statusFilter]);

  // ===================== Mutations =====================
  const createMutation = useMutation({
    mutationFn: async (data: UserFormState) => {
      const body = {
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
        role: data.role,
        department: data.department.trim() || undefined,
        phone: data.phone.trim() || undefined,
        staffId: data.staffId.trim() || undefined,
        status: data.status,
      };
      const r = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? (j?.error === 'exists' ? tr('E-mel telah wujud', 'Email already exists') : 'create failed'));
      return j.data as User;
    },
    onSuccess: () => {
      toast.success(tr('Pengguna berjaya ditambah', 'User added successfully'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal menambah pengguna', 'Failed to add user')),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserFormState }) => {
      const body: Record<string, unknown> = {
        name: data.name.trim(),
        role: data.role,
        department: data.department.trim() || undefined,
        phone: data.phone.trim() || undefined,
        staffId: data.staffId.trim() || undefined,
        status: data.status,
      };
      if (data.password.trim()) body.password = data.password;
      const r = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'update failed');
      return j.data as User;
    },
    onSuccess: () => {
      toast.success(tr('Pengguna berjaya dikemas kini', 'User updated successfully'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal mengemas kini', 'Failed to update')),
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: UserStatus }) => {
      const r = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'status update failed');
      return j.data as User;
    },
    onSuccess: (_d, vars) => {
      const msg = vars.status === 'SUSPENDED'
        ? tr('Pengguna telah digantung', 'User has been suspended')
        : tr('Pengguna diaktifkan semula', 'User reactivated');
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuspendTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal menukar status', 'Failed to change status')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message ?? 'delete failed');
      return j.data as User;
    },
    onSuccess: () => {
      toast.success(tr('Pengguna berjaya dipadam', 'User deleted successfully'));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message || tr('Gagal memadam', 'Failed to delete')),
  });

  // ===================== Handlers =====================
  const openCreate = () => {
    setEditTarget(null);
    setForm(DEFAULT_FORM);
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm(toFormState(u));
    setShowPassword(false);
    setDialogOpen(true);
  };

  const submitForm = () => {
    if (!form.name.trim() || form.name.trim().length < 3) {
      toast.error(tr('Nama mesti sekurang-kurangnya 3 aksara', 'Name must be at least 3 characters'));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error(tr('E-mel tidak sah', 'Invalid email'));
      return;
    }
    if (!editTarget && form.password.length < 8) {
      toast.error(tr('Kata laluan mesti sekurang-kurangnya 8 aksara', 'Password must be at least 8 characters'));
      return;
    }
    if (editTarget && form.password && form.password.length < 8) {
      toast.error(tr('Kata laluan baru mesti sekurang-kurangnya 8 aksara', 'New password must be at least 8 characters'));
      return;
    }
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const toggleSuspend = (u: User) => {
    if (u.status === 'SUSPENDED') {
      // Reactivate directly
      suspendMutation.mutate({ id: u.id, status: 'ACTIVE' });
    } else {
      // Confirm suspend
      setSuspendTarget(u);
    }
  };

  // ===================== Render =====================
  if (!isSuperAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <GlassCard className="p-10 text-center">
          <ShieldCheck className="w-14 h-14 mx-auto text-amber-500/70 mb-4" />
          <h2 className="text-xl font-semibold">{tr('Akses Ditolak', 'Access Denied')}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {tr('Hanya Pentadbir Sistem boleh mengakses halaman ini.', 'Only System Admins can access this page.')}
          </p>
          <Button variant="outline" onClick={() => setView('dashboard')} className="mt-4 glass-input">
            {tr('Kembali ke Papan Pemuka', 'Back to Dashboard')}
          </Button>
        </GlassCard>
      </motion.div>
    );
  }

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
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="hidden sm:grid place-items-center w-12 h-12 rounded-xl gradient-primary text-white shadow-lg shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold gradient-text leading-tight">
                {t('nav_users')}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {tr('Urus akaun, peranan dan kebenaran akses pengguna', 'Manage user accounts, roles and access permissions')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setView('dashboard')} className="glass-input">
              {tr('Kembali', 'Back')}
            </Button>
            <Button
              onClick={openCreate}
              className="gradient-primary text-white shadow-md hover:shadow-lg transition-shadow"
              size="sm"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {tr('Tambah Pengguna', 'Add User')}
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatTile
          icon={<Users className="w-5 h-5" />}
          label={tr('Jumlah Pengguna', 'Total Users')}
          value={stats.total}
          tone="teal"
          loading={isLoading}
        />
        <StatTile
          icon={<BadgeCheck className="w-5 h-5" />}
          label={t('role_USER')}
          value={stats.users}
          tone="teal"
          loading={isLoading}
        />
        <StatTile
          icon={<ShieldCheck className="w-5 h-5" />}
          label={t('role_FACILITY_ADMIN')}
          value={stats.facilityAdmins}
          tone="emerald"
          loading={isLoading}
        />
        <StatTile
          icon={<Lock className="w-5 h-5" />}
          label={t('role_SUPER_ADMIN')}
          value={stats.superAdmins}
          tone="rose"
          loading={isLoading}
        />
        <StatTile
          icon={<CheckCircle2 className="w-5 h-5" />}
          label={t('status_ACTIVE')}
          value={stats.active}
          tone="emerald"
          loading={isLoading}
        />
        <StatTile
          icon={<Ban className="w-5 h-5" />}
          label={t('status_SUSPENDED')}
          value={stats.suspended}
          tone="amber"
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
              placeholder={tr('Cari nama, e-mel, jabatan, no. pekerja...', 'Search name, email, department, staff ID...')}
              className="glass-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{tr('Peranan', 'Role')}</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full md:w-48 glass-input">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{tr('Semua Peranan', 'All Roles')}</SelectItem>
                <SelectItem value="USER">{t('role_USER')}</SelectItem>
                <SelectItem value="FACILITY_ADMIN">{t('role_FACILITY_ADMIN')}</SelectItem>
                <SelectItem value="SUPER_ADMIN">{t('role_SUPER_ADMIN')}</SelectItem>
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
                <SelectItem value="SUSPENDED">{t('status_SUSPENDED')}</SelectItem>
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
            <Users className="w-4 h-4 text-teal-600" />
            {tr('Senarai Pengguna', 'User List')}
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
            <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">{t('no_data')}</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {tr('Tiada pengguna padanan penapis.', 'No users match the filter.')}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto scroll-area-thin">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="pl-4 whitespace-nowrap min-w-[220px]">{t('name')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[140px]">{tr('Peranan', 'Role')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[140px]">{t('department')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[110px]">{t('staffId')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[140px]">{tr('Telefon', 'Phone')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[130px]">{tr('Akhir Log Masuk', 'Last Login')}</TableHead>
                  <TableHead className="whitespace-nowrap min-w-[100px]">{tr('Status', 'Status')}</TableHead>
                  <TableHead className="text-right pr-4 whitespace-nowrap min-w-[180px]">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <TableRow key={u.id} className="hover:bg-teal-50/40 dark:hover:bg-teal-900/10">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'grid place-items-center w-9 h-9 rounded-full font-semibold text-xs shrink-0 ring-2 ring-white/60',
                              avatarColor(u.name || u.email),
                            )}
                            aria-hidden
                          >
                            {initials(u.name || u.email)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm leading-tight break-words">
                              {u.name}
                              {isSelf && (
                                <span className="inline-flex items-center text-[9px] px-1 py-px rounded bg-teal-100 text-teal-700 border border-teal-200 ml-1 align-middle">
                                  {tr('Anda', 'You')}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span className="truncate min-w-0">{u.email}</span>
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} className="whitespace-nowrap" />
                      </TableCell>
                      <TableCell>
                        {u.department ? (
                          <span className="text-sm text-foreground/80">{u.department}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.staffId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground">
                            <BadgeCheck className="w-3.5 h-3.5 text-teal-500" />
                            {u.staffId}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.phone ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            <span className="break-words">{u.phone}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.lastLoginAt ? (
                          <span className="text-xs text-muted-foreground" title={u.lastLoginAt}>
                            {formatDistanceToNow(new Date(u.lastLoginAt), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">
                            {tr('Belum log masuk', 'Never logged in')}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleSuspend(u)}
                            disabled={isSelf}
                            className={cn(
                              'glass-input h-8 px-2 text-xs shrink-0 whitespace-nowrap',
                              u.status === 'SUSPENDED'
                                ? 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border-emerald-200/60'
                                : 'text-amber-700 hover:bg-amber-50 hover:text-amber-800 border-amber-200/60',
                            )}
                            title={u.status === 'SUSPENDED' ? tr('Aktifkan', 'Activate') : tr('Gantung', 'Suspend')}
                          >
                            {u.status === 'SUSPENDED' ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden md:inline">{tr('Aktif', 'Activate')}</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                <span className="hidden md:inline">{tr('Gantung', 'Suspend')}</span>
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(u)}
                            className="glass-input h-8 w-8 p-0"
                            title={t('edit')}
                            aria-label={t('edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(u)}
                            disabled={isSelf}
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
              <UserPlus className="w-5 h-5 text-teal-600" />
              {editTarget
                ? tr('Kemas Kini Pengguna', 'Edit User')
                : tr('Tambah Pengguna Baharu', 'Add New User')}
            </DialogTitle>
            <DialogDescription>
              {editTarget
                ? tr('Kemas kini maklumat pengguna ini.', 'Update this user information.')
                : tr('Isi butiran pengguna baru.', 'Fill in the new user details.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="u-name">{t('name')} *</Label>
              <Input
                id="u-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={tr('Nama Penuh', 'Full Name')}
                className="glass-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="u-email">{t('email')} *</Label>
                <Input
                  id="u-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="user@pltt.gov.my"
                  className="glass-input"
                  disabled={!!editTarget}
                />
                {editTarget && (
                  <p className="text-xs text-muted-foreground">
                    {tr('E-mel tidak boleh diubah.', 'Email cannot be changed.')}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-staff">{t('staffId')}</Label>
                <Input
                  id="u-staff"
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                  placeholder={tr('cth. JTM-2024-001', 'e.g. JTM-2024-001')}
                  className="glass-input"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="u-pass" className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                {t('password')}
                {editTarget && (
                  <span className="text-xs text-muted-foreground font-normal">
                    ({tr('kosongkan jika tidak diubah', 'leave blank to keep')})
                  </span>
                )}
                {!editTarget && <span className="text-rose-600">*</span>}
              </Label>
              <div className="relative">
                <Input
                  id="u-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editTarget ? '••••••••' : tr('Minimum 8 aksara', 'Minimum 8 characters')}
                  className="glass-input pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? tr('Sembunyikan kata laluan', 'Hide password') : tr('Tunjukkan kata laluan', 'Show password')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {editTarget && form.password && (
                <p className="text-xs text-amber-700">
                  {tr('Kata laluan baharu akan ditetapkan.', 'A new password will be set.')}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{tr('Peranan', 'Role')} *</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as Role })}
                >
                  <SelectTrigger className="w-full glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">{t('role_USER')}</SelectItem>
                    <SelectItem value="FACILITY_ADMIN">{t('role_FACILITY_ADMIN')}</SelectItem>
                    <SelectItem value="SUPER_ADMIN">{t('role_SUPER_ADMIN')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{tr('Status', 'Status')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as UserStatus })}
                >
                  <SelectTrigger className="w-full glass-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">{t('status_ACTIVE')}</SelectItem>
                    <SelectItem value="SUSPENDED">{t('status_SUSPENDED')}</SelectItem>
                    <SelectItem value="INACTIVE">{tr('Tidak Aktif', 'Inactive')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="u-dept">{t('department')}</Label>
                <Input
                  id="u-dept"
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder={tr('cth. Unit Latihan', 'e.g. Training Unit')}
                  className="glass-input"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="u-phone">{t('phone')}</Label>
                <Input
                  id="u-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="03-12345678"
                  className="glass-input"
                />
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

      {/* Suspend Confirmation */}
      <AlertDialog
        open={!!suspendTarget}
        onOpenChange={(o) => !o && setSuspendTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <Ban className="w-5 h-5" />
              {tr('Gantung Pengguna', 'Suspend User')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Adakah anda pasti mahu menggantung akaun "${suspendTarget?.name ?? ''}"?`,
                `Are you sure you want to suspend the account "${suspendTarget?.name ?? ''}"?`,
              )}
              <span className="block mt-2 text-amber-700">
                {tr('Pengguna tidak akan boleh log masuk sehingga diaktifkan semula.', 'The user will be unable to sign in until reactivated.')}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('no')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (suspendTarget) {
                  suspendMutation.mutate({ id: suspendTarget.id, status: 'SUSPENDED' });
                }
              }}
              disabled={suspendMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {suspendMutation.isPending ? t('loading') : tr('Gantung', 'Suspend')}
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
              {tr('Padam Pengguna', 'Delete User')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tr(
                `Adakah anda pasti mahu memadam akaun "${deleteTarget?.name ?? ''}"?`,
                `Are you sure you want to delete the account "${deleteTarget?.name ?? ''}"?`,
              )}
              <span className="block mt-2 text-rose-700">
                {tr(
                  'Tindakan ini akan menetapkan status pengguna kepada Tidak Aktif (padam lembut).',
                  'This action sets the user status to Inactive (soft delete).',
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
      {currentUser && (
        <p className="text-xs text-muted-foreground text-center pt-2">
          {tr('Log masuk sebagai', 'Logged in as')}{' '}
          <span className="font-medium text-foreground/80">{currentUser.name}</span>{' '}
          ·{' '}
          {currentUser.role === 'SUPER_ADMIN'
            ? t('role_SUPER_ADMIN')
            : currentUser.role === 'FACILITY_ADMIN'
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
  tone: 'teal' | 'emerald' | 'amber' | 'rose' | 'zinc';
  loading?: boolean;
}) {
  const toneClasses: Record<string, string> = {
    teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
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

export default UsersView;
