import { useEffect, useState, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { FileText, MapPin, MessageSquare, Users, Wallet } from 'lucide-react';
import { apiFetch } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useNotifications } from '../context/NotificationsContext.js';
import { useRealtime } from '../context/RealtimeContext.js';
import { useT } from '../i18n/I18nContext.js';
import { useNeighbours } from '../hooks/useNeighbours.js';
import { VicinityLogo } from '../components/VicinityLogo.js';

export function HomePage(): ReactElement {
  const { user } = useAuth();
  const { counts } = useNotifications();
  const { online } = useRealtime();
  const { neighbours } = useNeighbours();
  const t = useT();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    void apiFetch<{ balance: number }>('/me/wallet')
      .then((wallet) => setBalance(wallet.balance))
      .catch(() => setBalance(null));
  }, []);

  // Voisins réellement en ligne = habitants du quartier présents dans le registre temps réel.
  const neighboursOnline = neighbours.filter((neighbour) => online.has(neighbour.id)).length;

  const stats: Array<{
    to: string;
    icon: typeof Wallet;
    label: string;
    value: string;
    accent: string;
  }> = [
    {
      to: '/portefeuille',
      icon: Wallet,
      label: t('nav.wallet'),
      value: balance === null ? '—' : `${balance}`,
      accent: 'text-primary',
    },
    {
      to: '/messages',
      icon: MessageSquare,
      label: t('notifications.messages'),
      value: `${counts.messages}`,
      accent: counts.messages > 0 ? 'text-amber-400' : 'text-muted-foreground',
    },
    {
      to: '/documents',
      icon: FileText,
      label: t('notifications.documents'),
      value: `${counts.documents}`,
      accent: counts.documents > 0 ? 'text-amber-400' : 'text-muted-foreground',
    },
    {
      to: '/messages',
      icon: Users,
      label: t('home.neighboursOnline'),
      value: `${neighboursOnline}`,
      accent: neighboursOnline > 0 ? 'text-emerald-400' : 'text-muted-foreground',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="vicinity-hero-glow relative flex flex-col items-center overflow-hidden rounded-2xl border border-border bg-card/40 px-6 py-14 text-center">
        <VicinityLogo size={104} />
        <p className="mt-5 max-w-xl text-balance text-muted-foreground">{t('home.subtitle')}</p>
        {user?.neighbourhoodName ? (
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm">
            <MapPin className="size-4 text-primary" />
            <span className="text-muted-foreground">{t('home.activeNeighbourhood')}</span>
            <strong className="text-foreground">{user.neighbourhoodName}</strong>
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">{t('home.noNeighbourhood')}</p>
        )}
      </section>

      {/* Tableau de bord : infos utiles en un coup d'œil */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">{t('home.overview')}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(({ to, icon: Icon, label, value, accent }) => (
            <Link
              key={label}
              to={to}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/50"
            >
              <span className="inline-flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                <Icon className="size-4.5" />
              </span>
              <div>
                <div className={'text-2xl font-semibold tabular-nums ' + accent}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
