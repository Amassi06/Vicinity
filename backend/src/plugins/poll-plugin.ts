import type { PollCreateInput } from '../polls/service.js';

export interface PollTallyContext {
  pollId: string;
  options: string[];
  tallies: Record<number, number>;
  totalVotes: number;
}

export interface PollPlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  validateCreate?(input: PollCreateInput): void;
  enrichResults?(ctx: PollTallyContext): Record<string, unknown>;
}
