import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useLang } from '../i18n/I18nContext.js';
import { VicinityMark } from '../components/VicinityLogo.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.js';

/** Layout minimal pour les pages publiques (login/register) — pas de sidebar ni de menu applicatif tant qu'on n'est pas connecté. */
export function AuthLayout(): ReactElement {
  const { user } = useAuth();
  const [lang, setLang] = useLang();

  if (user) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b border-border/70 bg-background/60 px-5 backdrop-blur-md">
        <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <VicinityMark size={28} />
          <span className="vicinity-wordmark text-lg font-bold">Vicinity</span>
        </span>
        <Select value={lang} onValueChange={(v) => setLang(v === 'en' ? 'en' : 'fr')}>
          <SelectTrigger aria-label="Language" className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fr">FR</SelectItem>
            <SelectItem value="en">EN</SelectItem>
          </SelectContent>
        </Select>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="animate-rise w-full max-w-md">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
