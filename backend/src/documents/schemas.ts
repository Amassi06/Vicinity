import { z } from 'zod';

const MAX_COORDINATE = 20000;

export const SignatureZoneInputSchema = z.object({
  page: z.number().int().min(1),
  x: z.number().min(0).max(MAX_COORDINATE),
  y: z.number().min(0).max(MAX_COORDINATE),
  width: z.number().positive().max(MAX_COORDINATE),
  height: z.number().positive().max(MAX_COORDINATE),
  required: z.boolean().default(true),
});

export const SetZonesSchema = z.object({
  zones: z.array(SignatureZoneInputSchema).min(1).max(50),
  participants: z.array(z.string().uuid()).max(20).optional(),
});

export const SignZoneSchema = z.object({
  token: z.string().regex(/^\d{6}$/, 'totp must be 6 digits'),
});

export type SetZonesInput = z.infer<typeof SetZonesSchema>;
export type SignZoneInput = z.infer<typeof SignZoneSchema>;
export type SignatureZoneInput = z.infer<typeof SignatureZoneInputSchema>;
