import type { PollPlugin } from '../poll-plugin.js';

/** Exige au moins 3 options (ex. abstention / blanc / oui). */
export const minThreeOptionsPollPlugin: PollPlugin = {
  id: 'min-three-options',
  name: 'Minimum 3 options',
  description: 'Le sondage doit proposer au moins trois choix.',
  validateCreate(input) {
    if (input.options.length < 3) {
      throw new Error('plugin_min_three_options');
    }
  },
};
