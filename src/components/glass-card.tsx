'use client';

import { cn } from '@/lib/utils';
import type { ReactNode, HTMLAttributes } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  strong?: boolean;
  hover?: boolean;
}

export function GlassCard({ children, className, strong, hover, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        strong ? 'glass-strong' : 'glass-card',
        hover && 'cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
