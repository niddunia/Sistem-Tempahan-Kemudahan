'use client';

import { useSession, signOut } from 'next-auth/react';
import type { Role } from '@/lib/rbac';

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string;
}

/**
 * Reactive client-side current-user hook backed by NextAuth session.
 * The session is provided by `<SessionProvider>` in the app shell.
 * No fallback fetch needed since SessionProvider hydrates from cookie.
 */
export function useCurrentUser() {
  const { data: session, status } = useSession();
  const loading = status === 'loading';
  const user: CurrentUser | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role as Role,
        department: session.user.department,
      }
    : null;

  return {
    user,
    loading,
    isAuthenticated: !!user,
    isUser: user?.role === 'USER',
    isFacilityAdmin: user?.role === 'FACILITY_ADMIN',
    isSuperAdmin: user?.role === 'SUPER_ADMIN',
    isAdmin: user?.role === 'FACILITY_ADMIN' || user?.role === 'SUPER_ADMIN',
    signOut: () => signOut({ callbackUrl: '/', redirect: false }),
  };
}
