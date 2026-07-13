'use client';

import { useApp } from '@/lib/store';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Sidebar } from '@/components/sidebar';
import { TopBar, Footer } from '@/components/topbar';
import { AuthModal } from '@/components/auth-modal';
import { AIChatAssistant } from '@/components/ai-chat-assistant';
import { GlassCard } from '@/components/glass-card';
import { Button } from '@/components/ui/button';
import { useT } from '@/hooks/use-t';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Lock, Sparkles } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy-load views to keep the initial bundle small
const PublicCalendarView = dynamic(() => import('@/views/public-calendar-view').then(m => m.PublicCalendarView), { ssr: false });
const BookingFormView = dynamic(() => import('@/views/booking-form-view').then(m => m.BookingFormView), { ssr: false });
const PersonalDashboardView = dynamic(() => import('@/views/personal-dashboard-view').then(m => m.PersonalDashboardView), { ssr: false });
const ApprovalsView = dynamic(() => import('@/views/approvals-view').then(m => m.ApprovalsView), { ssr: false });
const FacilitiesView = dynamic(() => import('@/views/facilities-view').then(m => m.FacilitiesView), { ssr: false });
const UsersView = dynamic(() => import('@/views/users-view').then(m => m.UsersView), { ssr: false });
const AnalyticsView = dynamic(() => import('@/views/analytics-view').then(m => m.AnalyticsView), { ssr: false });
const AuditView = dynamic(() => import('@/views/audit-view').then(m => m.AuditView), { ssr: false });
const CalendarView = dynamic(() => import('@/views/calendar-view').then(m => m.CalendarView), { ssr: false });

export default function Home() {
  const view = useApp((s) => s.view);
  const setAuthOpen = useApp((s) => s.setAuthOpen);
  const { user, isAuthenticated, loading, isAdmin, isSuperAdmin } = useCurrentUser();
  const { t, lang } = useT();

  // Access control: redirect protected views to login prompt
  const PROTECTED_VIEWS = ['dashboard', 'book', 'approvals', 'facilities', 'analytics', 'users', 'audit'];
  const ADMIN_VIEWS = ['approvals', 'analytics'];
  const SUPER_VIEWS = ['facilities', 'users', 'audit'];

  const isProtected = PROTECTED_VIEWS.includes(view);
  const needsAdmin = ADMIN_VIEWS.includes(view);
  const needsSuper = SUPER_VIEWS.includes(view);

  const accessDenied = isProtected && !loading && (
    !isAuthenticated ||
    (needsAdmin && !isAdmin) ||
    (needsSuper && !isSuperAdmin)
  );

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {accessDenied ? (
                <AccessDenied
                  title={t('sign_in')}
                  message={lang === 'bm'
                    ? 'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang mempunyai peranan yang sesuai.'
                    : 'You do not have permission to access this page. Please sign in with an appropriate role.'}
                  onAction={() => setAuthOpen(true)}
                  actionLabel={t('sign_in')}
                />
              ) : (
                <RenderView view={view} isAuthenticated={isAuthenticated} />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
      </div>

      <AuthModal />
      <AIChatAssistant />
    </div>
  );
}

function RenderView({ view, isAuthenticated }: { view: string; isAuthenticated: boolean }) {
  switch (view) {
    case 'public':
      return <PublicCalendarView />;
    case 'calendar':
      return <CalendarView />;
    case 'book':
      if (!isAuthenticated) return <SignInPrompt />;
      return <BookingFormView />;
    case 'dashboard':
      if (!isAuthenticated) return <SignInPrompt />;
      return <PersonalDashboardView />;
    case 'approvals':
      return <ApprovalsView />;
    case 'facilities':
      return <FacilitiesView />;
    case 'analytics':
      return <AnalyticsView />;
    case 'users':
      return <UsersView />;
    case 'audit':
      return <AuditView />;
    default:
      return <PublicCalendarView />;
  }
}

function SignInPrompt() {
  const setAuthOpen = useApp((s) => s.setAuthOpen);
  const { t, lang } = useT();
  return (
    <AccessDenied
      title={t('sign_in')}
      message={lang === 'bm' ? 'Sila log masuk untuk mengakses halaman ini.' : 'Please sign in to access this page.'}
      onAction={() => setAuthOpen(true)}
      actionLabel={t('sign_in')}
      icon={<Lock className="w-6 h-6" />}
    />
  );
}

function AccessDenied({
  title, message, onAction, actionLabel, icon,
}: {
  title: string; message: string; onAction: () => void; actionLabel: string; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <GlassCard strong className="p-8 max-w-md text-center">
        <div className="w-16 h-16 rounded-2xl gradient-accent flex items-center justify-center mx-auto mb-4 text-white">
          {icon ?? <ShieldAlert className="w-7 h-7" />}
        </div>
        <h3 className="text-lg font-bold gradient-text mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{message}</p>
        <Button onClick={onAction} className="gradient-primary text-white border-0 gap-2">
          <Sparkles className="w-4 h-4" />
          {actionLabel}
        </Button>
      </GlassCard>
    </div>
  );
}
