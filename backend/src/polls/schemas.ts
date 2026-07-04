import { z } from 'zod';

export const PollPluginIdSchema = z.enum(['standard', 'min-three-options', 'quorum']);

export const PollCreateSchema = z.object({
  neighbourhoodId: z.string().uuid(),
  title: z.string().min(1).max(500),
  options: z.array(z.string().min(1).max(200)).min(2).max(16),
  // Date/heure de fin obligatoire, dans le futur.
  closesAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
    message: 'closesAt_must_be_future',
  }),
  pluginId: PollPluginIdSchema.default('standard'),
});

export const PollVoteSchema = z.object({
  choiceIndex: z.number().int().min(0),
});
