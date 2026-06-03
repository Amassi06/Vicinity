import type { PollPlugin } from '../poll-plugin.js';

export const standardPollPlugin: PollPlugin = {
  id: 'standard',
  name: 'Vote simple',
  description: 'Scrutin à choix unique, décompte brut des voix.',
  enrichResults(ctx) {
    const percentages: Record<string, number> = {};
    for (let i = 0; i < ctx.options.length; i += 1) {
      const count = ctx.tallies[i] ?? 0;
      percentages[ctx.options[i] ?? String(i)] =
        ctx.totalVotes === 0 ? 0 : Math.round((count / ctx.totalVotes) * 1000) / 10;
    }
    return { percentages };
  },
};
