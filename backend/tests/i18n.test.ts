import { resolveLocale, translate } from '../src/i18n/index.js';

describe('i18n', () => {
  test('resolveLocale picks fr for French Accept-Language headers', () => {
    expect(resolveLocale('fr-FR,fr;q=0.9')).toBe('fr');
    expect(resolveLocale('fr')).toBe('fr');
  });

  test('resolveLocale defaults to en otherwise', () => {
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
    expect(resolveLocale(null)).toBe('en');
  });

  test('translate returns the localized message for a known error code', () => {
    expect(translate('not_found', 'fr')).toBe('Ressource introuvable.');
    expect(translate('not_found', 'en')).toBe('Resource not found.');
  });

  test('translate falls back to the code itself when unknown', () => {
    expect(translate('some_unknown_code', 'fr')).toBe('some_unknown_code');
  });
});
