import type { PollPlugin } from './poll-plugin.js';
import { minThreeOptionsPollPlugin } from './polls/min-three-options.js';
import { quorumPollPlugin } from './polls/quorum.js';
import { standardPollPlugin } from './polls/standard.js';

export const pollPlugins: PollPlugin[] = [
  standardPollPlugin,
  minThreeOptionsPollPlugin,
  quorumPollPlugin,
];

const pollPluginById = new Map(pollPlugins.map((p) => [p.id, p]));

export function getPollPlugin(id: string | undefined | null): PollPlugin {
  if (!id || id === 'standard') return standardPollPlugin;
  const found = pollPluginById.get(id);
  if (!found) throw new Error('unknown_poll_plugin');
  return found;
}

export function listPollPluginDescriptors(): Array<{
  id: string;
  name: string;
  description: string;
}> {
  return pollPlugins.map(({ id, name, description }) => ({ id, name, description }));
}
