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
import { Button } from '@/components/ui/button.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';
import { cn } from '@/lib/utils.js';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
    isActive && 'bg-accent font-medium text-accent-foreground',
  );

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
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          <span className="brand-mark flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white">
            V
          </span>
          <span className="text-base font-semibold tracking-tight">Vicinity</span>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass}>
              <Icon className="size-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-border bg-background px-5">
          <span className="flex items-center gap-2 text-base font-semibold tracking-tight md:hidden">
            <span className="brand-mark flex size-6 items-center justify-center rounded-md text-xs font-bold text-white">
              V
            </span>
            Vicinity
          </span>
          <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
            {user ? (
              <>
                <Mail className="size-3.5" />
                {user.email}
              </>
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
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2 md:hidden">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass} title={label}>
              <Icon className="size-4 shrink-0" />
            </NavLink>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
          <Outlet />
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
