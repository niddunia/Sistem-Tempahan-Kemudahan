'use client';

import { useState, useEffect } from 'react';

/**
 * Returns true after the component has mounted on the client.
 * Use to avoid hydration mismatches for theme-dependent UI.
 */
export function useIsClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}
