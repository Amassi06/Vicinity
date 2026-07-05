import type { ReactElement } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  CalendarDays,
  FileText,
  Home,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessageSquare,
  ShieldCheck,
  ShoppingBag,
  TriangleAlert,
  User,
  Vote,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useLang, useT } from '../i18n/I18nContext.js';
import { NeighboursSidebar } from '../components/NeighboursSidebar.js';
import { NotificationsBell } from '../components/NotificationsBell.js';
import { VicinityMark } from '../components/VicinityLogo.js';
import { Button } from '@/components/ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { cn } from '@/lib/utils.js';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground',
    isActive &&
      'bg-gradient-to-r from-primary/15 to-transparent font-medium text-foreground before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-primary',
  );

const navIconClass = ({ isActive }: { isActive: boolean }): string =>
  cn('size-4 shrink-0 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground');

/** Rendu uniquement pour les routes authentifiées (voir App.tsx : AuthLayout gère /login et /register séparément). */
export function AppShell(): ReactElement {
  const { user, logout } = useAuth();
  const t = useT();
  const [lang, setLang] = useLang();

  const navItems = [
    { to: '/', end: true, icon: Home, label: t('nav.home') },
    { to: '/quartiers', icon: MapPin, label: t('nav.quartiers') },
    { to: '/evenements', icon: CalendarDays, label: t('nav.events') },
    { to: '/annonces', icon: ShoppingBag, label: t('nav.listings') },
    { to: '/sondages', icon: Vote, label: t('nav.polls') },
    { to: '/messages', icon: MessageSquare, label: t('nav.messages') },
    { to: '/portefeuille', icon: Wallet, label: t('nav.wallet') },
    { to: '/documents', icon: FileText, label: t('nav.documents') },
    { to: '/incidents', icon: TriangleAlert, label: t('nav.incidents') },
    { to: '/mfa', icon: ShieldCheck, label: t('nav.mfa') },
    { to: '/compte', icon: User, label: t('nav.account') },
    { to: '/confidentialite', icon: Lock, label: t('nav.privacy') },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border/70 bg-card/30 backdrop-blur-md md:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-border/70 px-5">
          <VicinityMark size={32} />
          <span className="vicinity-wordmark text-lg font-bold tracking-tight">Vicinity</span>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              {({ isActive }) => (
                <>
                  <Icon className={navIconClass({ isActive })} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border/70 bg-background/70 px-5 backdrop-blur-md">
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight md:hidden">
            <VicinityMark size={26} />
            <span className="vicinity-wordmark">Vicinity</span>
          </span>
          <div className="hidden items-center gap-2 text-sm md:flex">
            {user ? (
              <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1 text-muted-foreground">
                <Mail className="size-3.5" />
                {user.email}
              </span>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <NotificationsBell />
            <Button variant="secondary" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
              {t('nav.logout')}
            </Button>
            <Select value={lang} onValueChange={(v) => setLang(v === 'en' ? 'en' : 'fr')}>
              <SelectTrigger aria-label="Language" className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">FR</SelectItem>
                <SelectItem value="en">EN</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>
        <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-border/70 bg-background/70 px-3 py-2 backdrop-blur-md md:hidden">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass} title={label}>
              {({ isActive }) => <Icon className={navIconClass({ isActive })} />}
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <div className="animate-rise">
            <Outlet />
          </div>
        </main>
      </div>

      <NeighboursSidebar />
    </div>
  );
}

export function RequireAuthGate(): ReactElement {
  const { ready, user } = useAuth();
  const t = useT();
  if (!ready) return <p className="p-8 text-muted-foreground">{t('common.loading')}</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
