'use client';

import { useApp } from '@/lib/store';
import { useT } from '@/hooks/use-t';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Bell, Menu, Globe, Sun, Moon, LogIn } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { useIsClient } from '@/hooks/use-is-client';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export function TopBar() {
  const { lang, setLang, setAuthOpen, setSidebarOpen, view } = useApp();
  const { t } = useT();
  const { user, isAuthenticated } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();
  const qc = useQueryClient();

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const r = await fetch('/api/notifications?limit=20');
      const j = await r.json();
      return j as { data: Array<{ id: string; title: string; content: string; isRead: boolean; createdAt: string; bookingId?: string }>; unreadCount: number };
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markOneRead = useMutation({
    mutationFn: async (id: string) => fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const viewTitles: Record<string, string> = {
    public: t('public_title'),
    calendar: t('nav_calendar'),
    dashboard: t('nav_dashboard'),
    book: t('nav_book'),
    approvals: t('nav_approvals'),
    facilities: t('nav_facilities'),
    analytics: t('nav_analytics'),
    users: t('nav_users'),
    audit: t('nav_audit'),
    settings: t('nav_settings'),
  };

  return (
    <header className="sticky top-0 z-20 glass-nav border-b border-border/40 px-4 lg:px-6 py-3 flex items-center gap-3">
      <button
        onClick={() => setSidebarOpen(true)}
        className="lg:hidden p-2 rounded-lg hover:bg-foreground/10"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base lg:text-lg font-bold truncate">{viewTitles[view] ?? 'e-Tempahan'}</h1>
        <p className="hidden sm:block text-[11px] text-muted-foreground truncate">{t('appOrg')}</p>
      </div>

      {/* Lang toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLang(lang === 'bm' ? 'en' : 'bm')}
        className="gap-1.5 glass-input text-xs"
      >
        <Globe className="w-4 h-4" />
        <span className="font-semibold">{lang === 'bm' ? 'BM' : 'EN'}</span>
      </Button>

      {/* Theme toggle */}
      {mounted && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="glass-input"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      )}

      {/* Notifications */}
      {isAuthenticated && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="glass-input relative">
              <Bell className="w-4 h-4" />
              {notifData?.unreadCount && notifData.unreadCount > 0 ? (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {notifData.unreadCount > 9 ? '9+' : notifData.unreadCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 glass-strong border-border/40">
            <div className="px-3 py-2.5 border-b border-border/40 flex items-center justify-between">
              <span className="text-sm font-semibold">{t('notifications')}</span>
              {notifData?.unreadCount ? (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-[10px] text-teal-600 hover:underline font-semibold"
                >
                  {t('mark_all_read')}
                </button>
              ) : null}
            </div>
            <ScrollArea className="max-h-[360px] scroll-area-thin">
              {notifData?.data?.length ? (
                <div className="divide-y divide-border/30">
                  {notifData.data.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        markOneRead.mutate(n.id);
                        useApp.getState().setView('dashboard');
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2.5 hover:bg-foreground/5 transition block',
                        !n.isRead && 'bg-teal-50/40 dark:bg-teal-900/10',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {!n.isRead && <span className="w-2 h-2 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold truncate">{n.title}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{n.content}</div>
                          <div className="text-[10px] text-muted-foreground/70 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground">{t('no_notifications')}</div>
              )}
            </ScrollArea>
          </PopoverContent>
        </Popover>
      )}

      {/* Sign-in CTA */}
      {!isAuthenticated && (
        <Button
          size="sm"
          onClick={() => setAuthOpen(true)}
          className="gradient-primary text-white border-0 gap-1.5"
        >
          <LogIn className="w-4 h-4" />
          <span className="hidden sm:inline">{t('sign_in')}</span>
        </Button>
      )}
    </header>
  );
}

export function Footer() {
  const { t } = useT();
  return (
    <footer className="mt-auto px-4 lg:px-6 py-3 glass-nav border-t border-border/40">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-700 dark:text-amber-400">{t('footer_classification')}</span>
        </div>
        <div className="flex items-center gap-3">
          <span>{t('footer_version')}</span>
          <span>·</span>
          <span>{t('footer_copyright')}</span>
        </div>
      </div>
    </footer>
  );
}
