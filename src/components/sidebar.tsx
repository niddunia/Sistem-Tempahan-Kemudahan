'use client';

import { useApp, type ViewKey } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useT } from '@/hooks/use-t';
import { Logo } from '@/components/logo';
import { RoleBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';
import {
  CalendarDays, LayoutDashboard, PlusCircle, CheckSquare, Building2,
  BarChart3, Users, ScrollText, LogOut, X, ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface NavItem {
  key: ViewKey;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  requiresAuth?: boolean;
  roles?: Array<'USER' | 'FACILITY_ADMIN' | 'SUPER_ADMIN'>;
}

export function Sidebar() {
  const { lang } = useApp();
  const { t } = useT();
  const { user, signOut, isAuthenticated, isUser, isAdmin, isSuperAdmin } = useCurrentUser();
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const sidebarOpen = useApp((s) => s.sidebarOpen);
  const setSidebarOpen = useApp((s) => s.setSidebarOpen);

  const nav: NavItem[] = [
    { key: 'public', icon: CalendarDays, label: t('nav_public') },
    { key: 'calendar', icon: CalendarDays, label: t('nav_calendar') },
    { key: 'dashboard', icon: LayoutDashboard, label: t('nav_dashboard'), requiresAuth: true },
    { key: 'book', icon: PlusCircle, label: t('nav_book'), requiresAuth: true },
    { key: 'approvals', icon: CheckSquare, label: t('nav_approvals'), requiresAuth: true, roles: ['FACILITY_ADMIN', 'SUPER_ADMIN'] },
    { key: 'facilities', icon: Building2, label: t('nav_facilities'), requiresAuth: true, roles: ['SUPER_ADMIN'] },
    { key: 'analytics', icon: BarChart3, label: t('nav_analytics'), requiresAuth: true, roles: ['FACILITY_ADMIN', 'SUPER_ADMIN'] },
    { key: 'users', icon: Users, label: t('nav_users'), requiresAuth: true, roles: ['SUPER_ADMIN'] },
    { key: 'audit', icon: ScrollText, label: t('nav_audit'), requiresAuth: true, roles: ['SUPER_ADMIN'] },
  ];

  const canSee = (item: NavItem) => {
    if (!item.requiresAuth) return true;
    if (!isAuthenticated) return false;
    if (item.roles) {
      if (item.roles.includes('SUPER_ADMIN') && isSuperAdmin) return true;
      if (item.roles.includes('FACILITY_ADMIN') && isAdmin) return true;
      if (item.roles.includes('USER') && isUser) return true;
      return false;
    }
    return true;
  };

  const visibleNav = nav.filter(canSee);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          'fixed lg:sticky top-0 left-0 z-40 h-screen w-[260px] flex-shrink-0 glass-nav border-r border-border/40 flex flex-col transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Logo header */}
        <div className="px-5 py-5 flex items-center justify-between">
          <Logo />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-foreground/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User card */}
        {isAuthenticated && user ? (
          <div
            className="mx-3 mb-3 p-3 rounded-xl border border-border/40"
            style={{ background: 'rgba(255, 255, 255, 0.6)', borderRadius: '12px' }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <tbody>
                <tr>
                  <td style={{ width: '40px', verticalAlign: 'top', padding: 0 }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  </td>
                  <td style={{ verticalAlign: 'middle', padding: '0 0 0 10px', overflow: 'hidden' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: '1.25', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'oklch(0.18 0.02 165)' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: '10px', lineHeight: '1.25', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'oklch(0.5 0.02 165)' }}>
                      {user.department || user.email}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
              <RoleBadge role={user.role} />
            </div>
          </div>
        ) : (
          <div className="mx-3 mb-3 p-3 rounded-xl glass-input border border-border/40 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>{lang === 'bm' ? 'Mod Paparan Awam' : 'Public View Mode'}</span>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto scroll-area-thin">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left',
                  active
                    ? 'gradient-primary text-white shadow-lg shadow-teal-500/25'
                    : 'text-foreground/80 hover:bg-foreground/5 hover:text-foreground',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-border/40">
          {isAuthenticated ? (
            <Button
              onClick={() => signOut().then(() => window.location.reload())}
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-900/20"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span className="text-left leading-tight">{t('sign_out')}</span>
            </Button>
          ) : (
            <Button
              onClick={() => useApp.getState().setAuthOpen(true)}
              size="sm"
              className="w-full gradient-primary text-white border-0"
            >
              {t('sign_in')}
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
