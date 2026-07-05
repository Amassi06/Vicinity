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
  // Dessin manuscrit (data URL PNG produit par le canvas).
  signatureImage: z.string().startsWith('data:image/png;base64,').max(700_000),
  // TOTP optionnel : exigé côté service seulement si le compte a activé le MFA.
  mfaToken: z.string().regex(/^\d{6}$/).optional(),
});

export type SetZonesInput = z.infer<typeof SetZonesSchema>;
export type SignZoneBody = z.infer<typeof SignZoneSchema>;
export type SignatureZoneInput = z.infer<typeof SignatureZoneInputSchema>;
