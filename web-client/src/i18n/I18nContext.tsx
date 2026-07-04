import {
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import fr from './dictionaries/fr.json';
import en from './dictionaries/en.json';

export type Lang = 'fr' | 'en';

const dictionaries: Record<Lang, Record<string, string>> = { fr, en };

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const Ctx = createContext<I18nContextValue | null>(null);

function initialLang(): Lang {
  const stored = localStorage.getItem('vicinity_lang');
  return stored === 'en' ? 'en' : 'fr';
}

export function I18nProvider({ children }: { children: ReactNode }): ReactElement {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((next: Lang) => {
    localStorage.setItem('vicinity_lang', next);
    setLangState(next);
  }, []);

  const t = useCallback(
    (key: string): string => dictionaries[lang][key] ?? dictionaries.fr[key] ?? key,
    [lang],
  );

  const value = useMemo((): I18nContextValue => ({ lang, setLang, t }), [lang, setLang, t]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useT(): (key: string) => string {
  const v = useContext(Ctx);
  if (!v) throw new Error('useT hors I18nProvider');
  return v.t;
}

export function useLang(): [Lang, (lang: Lang) => void] {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLang hors I18nProvider');
  return [v.lang, v.setLang];
}
