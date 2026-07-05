import type { ReactElement } from 'react';
import { cn } from '@/lib/utils.js';

export function Skeleton({ className }: { className?: string }): ReactElement {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />;
}

/** Squelette de liste : n lignes fantômes le temps du chargement. */
export function ListSkeleton({ rows = 3 }: { rows?: number }): ReactElement {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-16" />
      ))}
    </div>
  );
}
