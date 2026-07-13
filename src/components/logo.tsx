'use client';

import { Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="relative">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Building2 className="w-5 h-5 text-white" strokeWidth={2.2} />
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 ring-2 ring-white dark:ring-zinc-900" />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold gradient-text">e-Tempahan</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">PLTT · JTM</span>
        </div>
      )}
    </div>
  );
}
