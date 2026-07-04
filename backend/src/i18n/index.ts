import type { NextFunction, Request, Response } from 'express';
import en from './dictionaries/en.json';
import fr from './dictionaries/fr.json';

export type Locale = 'en' | 'fr';

const dictionaries: Record<Locale, Record<string, string>> = { en, fr };

export function resolveLocale(acceptLanguage?: string | null): Locale {
  if (acceptLanguage?.toLowerCase().startsWith('fr')) return 'fr';
  return 'en';
}

export function translate(code: string, locale: Locale): string {
  return dictionaries[locale][code] ?? dictionaries.en[code] ?? code;
}

/**
 * Ajoute automatiquement un champ `message` traduit à côté du champ `error`
 * (code) déjà renvoyé par toutes les routes existantes, sans devoir toucher
 * à chaque fichier de routes individuellement.
 */
export function i18nMiddleware(req: Request, res: Response, next: NextFunction): void {
  const locale = resolveLocale(req.headers['accept-language']);
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
      const withMessage = body as { error: string; message?: string };
      if (!withMessage.message) {
        withMessage.message = translate(withMessage.error, locale);
      }
    }
    return originalJson(body);
  }) as Response['json'];
  next();
}
