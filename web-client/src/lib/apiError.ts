/**
 * Traduit les codes d'erreur bruts de l'API (`forbidden`, `insufficient_funds`, …)
 * en messages UI clairs via le dictionnaire i18n (`errors.<code>`). Tout code
 * inconnu retombe sur un message générique plutôt que d'afficher le code brut.
 */
const KNOWN_CODES = new Set([
  'forbidden',
  'invalid_input',
  'invalid_payload',
  'invalid_query',
  'insufficient_funds',
  'not_found',
  'invalid_state',
  'already_signed',
  'already_accepted',
  'cannot_accept_own_listing',
  'invalid_category',
  'invalid_neighbourhood',
  'slug_already_used',
  'mfa_required',
  'invalid_credentials',
  'email_already_registered',
  'invalid_totp',
  'user_not_found',
]);

export function apiErrorMessage(e: unknown, t: (key: string) => string): string {
  const code = e instanceof Error ? e.message : '';
  if (KNOWN_CODES.has(code)) return t(`errors.${code}`);
  return t('errors.unknown_error');
}
