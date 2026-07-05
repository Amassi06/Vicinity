/** Valeur `datetime-local` correspondant à maintenant, pour bloquer les dates passées. */
export function nowAsDatetimeLocalValue(): string {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return now.toISOString().slice(0, 16);
}
