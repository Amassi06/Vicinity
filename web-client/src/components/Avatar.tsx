import type { ReactElement } from 'react';
import { cn } from '@/lib/utils.js';

/** Paires de dégradés lisibles sur fond sombre, choisies de façon déterministe. */
const GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-rose-500 to-pink-500',
  'from-fuchsia-500 to-purple-500',
  'from-blue-500 to-indigo-500',
  'from-lime-500 to-emerald-500',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function pickGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length]!;
}

/** Avatar à initiales, couleur déterministe par identifiant, avec pastille de présence optionnelle. */
export function Avatar({
  name,
  seed,
  size = 32,
  online,
}: {
  name: string;
  seed?: string;
  size?: number;
  online?: boolean;
}): ReactElement {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={cn(
          'flex size-full items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white',
          pickGradient(seed ?? name),
        )}
        style={{ fontSize: Math.round(size * 0.4) }}
        aria-hidden
      >
        {initials(name)}
      </span>
      {online !== undefined ? (
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-card',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/50',
          )}
          style={{ width: Math.max(8, size * 0.3), height: Math.max(8, size * 0.3) }}
          title={online ? 'en ligne' : 'hors ligne'}
        />
      ) : null}
    </span>
  );
}
