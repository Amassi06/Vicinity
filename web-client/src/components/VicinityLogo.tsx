import type { ReactElement } from 'react';

/**
 * Logo Vicinity : un glyphe « quartier » (deux maisons voisines dont les toits
 * forment un V) dans une tuile au dégradé de marque, accompagné du wordmark.
 */
export function VicinityLogo({ size = 96 }: { size?: number }): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <VicinityMark size={size} />
      <div>
        <span className="vicinity-wordmark text-4xl font-bold tracking-tight sm:text-5xl">
          Vicinity
        </span>
      </div>
    </div>
  );
}

/** La tuile-logo seule (réutilisable, ex. en-tête). */
export function VicinityMark({ size = 96 }: { size?: number }): ReactElement {
  const gid = 'vicinity-grad';
  const glow = 'vicinity-glow';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      role="img"
      aria-label="Vicinity"
      className="drop-shadow-[0_10px_30px_rgba(99,102,241,0.45)]"
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="55%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#a855f7" />
        </linearGradient>
        <radialGradient id={glow} cx="50%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* tuile arrondie au dégradé de marque */}
      <rect x="4" y="4" width="88" height="88" rx="24" fill={`url(#${gid})`} />
      <rect x="4" y="4" width="88" height="88" rx="24" fill={`url(#${glow})`} />
      <rect
        x="4.75"
        y="4.75"
        width="86.5"
        height="86.5"
        rx="23.25"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="1.5"
      />

      {/* deux maisons voisines : les toits dessinent un V (Vicinity) */}
      <g
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* toits : chevrons formant un V central */}
        <path d="M20 46 L34 30 L48 46" />
        <path d="M48 46 L62 30 L76 46" opacity="0.9" />
      </g>

      {/* corps des maisons */}
      <g fill="#ffffff">
        <path d="M25 46 h18 v20 a2 2 0 0 1 -2 2 h-14 a2 2 0 0 1 -2 -2 z" opacity="0.96" />
        <path d="M53 46 h18 v20 a2 2 0 0 1 -2 2 h-14 a2 2 0 0 1 -2 -2 z" opacity="0.9" />
      </g>
      {/* portes (découpe dégradé) */}
      <rect x="31" y="55" width="6" height="13" rx="2" fill={`url(#${gid})`} />
      <rect x="59" y="55" width="6" height="13" rx="2" fill={`url(#${gid})`} />

      {/* point « voisin » / rassemblement */}
      <circle cx="72" cy="24" r="5" fill="#ffffff" opacity="0.95" />
    </svg>
  );
}
