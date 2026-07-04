import type { ReactElement } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import { FileText, KeyRound, LogOut, Mail, MapPin, Plug, ShieldCheck, ShoppingBag, Tags, TriangleAlert, Wallet } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';

const navLinkClass = ({ isActive }: { isActive: boolean }): string =>
  cn(
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
    isActive && 'bg-accent font-medium text-accent-foreground',
  );

/** Rendu uniquement pour les routes authentifiées (voir App.tsx : AuthLayout gère /login et /register séparément). */
export function AdminShell(): ReactElement {
  const { user, logout } = useAuth();

  const navItems = [
    { to: '/', end: true, icon: MapPin, label: 'Quartiers', show: true },
    { to: '/dsl', icon: KeyRound, label: 'DSL', show: user?.role === 'ADMIN' || user?.role === 'MODERATOR' },
    { to: '/wallet', icon: Wallet, label: 'Crédit points', show: user?.role === 'ADMIN' },
    { to: '/documents', icon: FileText, label: 'Documents', show: true },
    { to: '/categories', icon: Tags, label: 'Catégories', show: user?.role === 'ADMIN' },
    { to: '/annonces', icon: ShoppingBag, label: 'Annonces', show: user?.role === 'ADMIN' },
    { to: '/incident-categories', icon: TriangleAlert, label: 'Catég. incidents', show: user?.role === 'ADMIN' },
    { to: '/plugins', icon: Plug, label: 'Plugins', show: true },
    { to: '/sso', icon: ShieldCheck, label: 'SSO bureau', show: true },
    { to: '/mfa', icon: ShieldCheck, label: 'MFA', show: true },
  ].filter((item) => item.show);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          <span className="brand-mark flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white">
            V
          </span>
          <span className="text-base font-semibold tracking-tight">Vicinity Admin</span>
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
            Vicinity Admin
          </span>
          <div className="hidden items-center gap-1.5 text-sm text-muted-foreground md:flex">
            {user ? (
              <>
                <Mail className="size-3.5" />
                {user.email}
              </>
            ) : null}
          </div>
          <Button variant="secondary" size="sm" className="ml-auto" onClick={() => void logout()}>
            <LogOut className="size-4" />
            Déconnexion
          </Button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2 md:hidden">
          {navItems.map(({ to, end, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={end} className={navLinkClass} title={label}>
              <Icon className="size-4 shrink-0" />
            </NavLink>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function RequireAuthGate(): ReactElement {
  const { ready, user } = useAuth();
  if (!ready) return <p className="p-8 text-muted-foreground">Chargement…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
