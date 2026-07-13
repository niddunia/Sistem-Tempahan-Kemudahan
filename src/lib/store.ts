'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '@/lib/i18n';

export type ViewKey =
  | 'public'        // Public calendar (no login)
  | 'login'         // Login modal (overlay)
  | 'dashboard'     // Personal dashboard (USER)
  | 'book'          // Booking form
  | 'calendar'      // Full calendar view
  | 'approvals'     // Admin approvals (FACILITY_ADMIN+)
  | 'facilities'    // Facility management (SUPER_ADMIN)
  | 'analytics'     // Analytics dashboard
  | 'users'         // User management (SUPER_ADMIN)
  | 'audit'         // Audit log (SUPER_ADMIN)
  | 'settings';     // Settings/profile

interface AppState {
  lang: Lang;
  view: ViewKey;
  authOpen: boolean;       // login modal open
  bookingPrefill: Record<string, unknown> | null; // prefill from AI parse
  sidebarOpen: boolean;
  setLang: (l: Lang) => void;
  setView: (v: ViewKey) => void;
  setAuthOpen: (o: boolean) => void;
  setBookingPrefill: (p: Record<string, unknown> | null) => void;
  setSidebarOpen: (o: boolean) => void;
}

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      lang: 'bm',
      view: 'public',
      authOpen: false,
      bookingPrefill: null,
      sidebarOpen: false,
      setLang: (l) => set({ lang: l }),
      setView: (v) => set({ view: v, sidebarOpen: false }),
      setAuthOpen: (o) => set({ authOpen: o }),
      setBookingPrefill: (p) => set({ bookingPrefill: p }),
      setSidebarOpen: (o) => set({ sidebarOpen: o }),
    }),
    { name: 'pltt-etempahan-prefs', partialize: (s) => ({ lang: s.lang }) },
  ),
);
