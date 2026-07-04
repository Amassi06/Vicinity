import { logger } from '../logger/index.js';
import { archivePastEvents } from './service.js';

const ARCHIVE_INTERVAL_MS = 10 * 60 * 1000; // toutes les 10 minutes

let timer: NodeJS.Timeout | null = null;

/**
 * Planificateur léger : archive périodiquement les événements terminés depuis
 * plus d'une heure. Démarré au bootstrap du serveur (pas pendant les tests).
 */
export function startEventArchiver(): void {
  if (timer) return;
  const tick = (): void => {
    void archivePastEvents()
      .then((count) => {
        if (count > 0) logger.info({ count }, 'events archived');
      })
      .catch((err: unknown) => logger.error({ err }, 'event archiver failed'));
  };
  tick();
  timer = setInterval(tick, ARCHIVE_INTERVAL_MS);
  timer.unref();
}

export function stopEventArchiver(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
