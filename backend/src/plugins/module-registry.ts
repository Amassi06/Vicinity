import type { Router } from 'express';
import type { VicinityPlugin } from './bootstrap.js';

/**
 * Un module métier Vicinity = un plugin (id, description, bootstrap? optionnel)
 * qui expose en plus son propre routeur Express. Un nouveau module se déclare
 * en appelant registerModule() en bas de son fichier de routes ; http/app.ts
 * n'a besoin que d'un import à effet de bord pour le déclencher (voir app.ts).
 */
export interface VicinityModule extends VicinityPlugin {
  readonly router: Router;
}

const modules: VicinityModule[] = [];

export function registerModule(mod: VicinityModule): void {
  modules.push(mod);
}

export function listModules(): readonly VicinityModule[] {
  return modules;
}
