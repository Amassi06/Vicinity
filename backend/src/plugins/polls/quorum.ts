import type { PollPlugin } from '../poll-plugin.js';

/** Affiche si un quorum de 30 % des voix sur le 1er choix est atteint (démo métier). */
export const quorumPollPlugin: PollPlugin = {
  id: 'quorum',
  name: 'Quorum démo',
  description: 'Indique si le premier choix dépasse 30 % des suffrages exprimés.',
  enrichResults(ctx) {
    const first = ctx.tallies[0] ?? 0;
    const ratio = ctx.totalVotes === 0 ? 0 : first / ctx.totalVotes;
    return {
      quorumMet: ratio >= 0.3,
      quorumRatio: Math.round(ratio * 1000) / 10,
      quorumThresholdPercent: 30,
    };
  },
};
