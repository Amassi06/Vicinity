import { logger } from '../logger/index.js';

export interface VicinityPlugin {
  readonly id: string;
  readonly description: string;
  /** Hook synchrone exécuté au démarrage HTTP (pour enregistrer cron, mocks, etc.). */
  bootstrap?: () => void;
}

/** Registre interne simple pour futures extensions métier Vicinity. */
export const builtinPlugins: VicinityPlugin[] = [
  {
    id: 'hello',
    description: 'Trace le chargement des plugins au boot.',
    bootstrap: () => {
      logger.info({ plugin: 'hello' }, 'vicinity builtin plugin bootstrap');
    },
  },
];

export function bootstrapPlugins(
  plugins: readonly VicinityPlugin[] = builtinPlugins,
): void {
  for (const p of plugins) {
    p.bootstrap?.();
  }
}
