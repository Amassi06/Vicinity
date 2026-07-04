import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

/** Layout minimal pour les pages publiques (login/register) — pas de sidebar tant qu'on n'est pas connecté. */
export function AuthLayout(): ReactElement {
  const { user } = useAuth();

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-border bg-background px-5">
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <span className="brand-mark flex size-6 items-center justify-center rounded-md text-xs font-bold text-white">
            V
          </span>
          Vicinity Admin
        </span>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
