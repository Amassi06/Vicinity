import type { z } from 'zod';
import { PollModel } from '../db/mongo/models/poll.model.js';
import { VoteModel } from '../db/mongo/models/vote.model.js';
import { getPollPlugin } from '../plugins/registry.js';
import { PollCreateSchema, PollVoteSchema } from './schemas.js';

export type PollCreateInput = z.infer<typeof PollCreateSchema>;

export function parsePollCreate(raw: unknown): PollCreateInput {
  const parsed = PollCreateSchema.safeParse(raw);
  if (!parsed.success) {
    throw Object.assign(new Error('invalid_body'), {
      cause: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

function isExpired(poll: { closesAt: Date | null; status: string }): boolean {
  if (!poll.closesAt) return false;
  return poll.status === 'open' && new Date(poll.closesAt).getTime() < Date.now();
}

export async function createPoll(ownerId: string, raw: unknown) {
  const input = parsePollCreate(raw);
  const plugin = getPollPlugin(input.pluginId);
  plugin.validateCreate?.(input);

  return PollModel.create({
    neighbourhoodId: input.neighbourhoodId,
    createdBy: ownerId,
    title: input.title,
    options: input.options,
    pluginId: input.pluginId,
    closesAt: input.closesAt ?? null,
    status: 'open',
  });
}

type PollSavable = {
  closesAt: Date | null;
  status: string;
  save: () => Promise<unknown>;
};

async function expireOpenPollIfNeeded(poll: PollSavable): Promise<void> {
  if (isExpired(poll) && poll.status === 'open') {
    poll.status = 'closed';
    await poll.save();
  }
}

export async function listPolls(neighbourhoodId: string) {
  const polls = await PollModel.find({ neighbourhoodId }).sort({ createdAt: -1 }).limit(50).exec();

  await Promise.all(polls.map((p) => expireOpenPollIfNeeded(p)));

  return PollModel.find({ neighbourhoodId }).sort({ createdAt: -1 }).limit(50).exec();
}

export async function getPoll(pollId: string) {
  const poll = await PollModel.findById(pollId).exec();
  if (!poll) return null;

  await expireOpenPollIfNeeded(poll);

  const talliesRaw = await VoteModel.aggregate<{ _id: number; count: number }>([
    { $match: { pollId } },
    { $group: { _id: '$choiceIndex', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  const tallies: Record<number, number> = {};
  for (const row of talliesRaw) tallies[row._id] = row.count;

  const totalVotes = talliesRaw.reduce((acc, r) => acc + r.count, 0);
  const plugin = getPollPlugin(poll.pluginId);
  const pluginResults =
    plugin.enrichResults?.({
      pollId,
      options: poll.options,
      tallies,
      totalVotes,
    }) ?? {};

  return {
    poll,
    tallies,
    totalVotes,
    plugin: { id: plugin.id, name: plugin.name },
    pluginResults,
  };
}

export async function castVote(userId: string, pollId: string, raw: unknown) {
  const poll = await PollModel.findById(pollId);
  if (!poll) return null;

  if (isExpired(poll)) await expireOpenPollIfNeeded(poll);
  if (poll.status !== 'open') throw new Error('poll_closed');

  const parsed = PollVoteSchema.safeParse(raw);
  if (!parsed.success) throw new Error('invalid_body');
  const choiceIndex = parsed.data.choiceIndex;
  if (choiceIndex >= poll.options.length) throw new Error('invalid_choice');

  try {
    return await VoteModel.create({
      pollId,
      userId,
      choiceIndex,
    });
  } catch (err) {
    if (err instanceof Error && /E11000/.test(err.message)) {
      throw new Error('already_voted');
    }
    throw err;
  }
}
