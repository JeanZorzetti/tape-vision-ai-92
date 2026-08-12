// Zod body schema + normalization for POST /api/waitlist (contracts/waitlist-api.md).
// Accepts both JSON and form-encoded bodies — unknown fields are stripped (default
// z.object behavior), never rejected.
import { z } from 'zod';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const toBool = (v: unknown) => v === true || v === 'true' || v === 'on' || v === '1';

const rawLeadSchema = z.object({
  name: z.coerce
    .string()
    .trim()
    .min(2, 'Informe seu nome completo.')
    .max(120, 'Informe um nome válido.'),
  email: z.coerce
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'Informe um e-mail válido.')
    .regex(EMAIL_RE, 'Informe um e-mail válido.'),
  consent: z.preprocess(toBool, z.boolean()).refine((v) => v === true, {
    message: 'É necessário aceitar a política de privacidade.',
  }),
  empresa: z.preprocess((v) => v ?? '', z.coerce.string()),
  renderedAt: z.preprocess((v) => (v === undefined || v === null || v === '' ? 0 : v), z.coerce.number()),
  sourcePage: z.preprocess((v) => v ?? '/', z.coerce.string()),
  referrer: z.preprocess((v) => v || null, z.coerce.string().nullable()),
  utmSource: z.preprocess((v) => v || null, z.coerce.string().nullable()),
  utmMedium: z.preprocess((v) => v || null, z.coerce.string().nullable()),
  utmCampaign: z.preprocess((v) => v || null, z.coerce.string().nullable()),
});

export type NormalizedLead = z.infer<typeof rawLeadSchema>;

export type LeadFieldErrors = Partial<Record<'name' | 'email' | 'consent', string>>;

export type ParseLeadResult =
  | { success: true; data: NormalizedLead }
  | { success: false; errors: LeadFieldErrors };

interface Utm {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
}

/** Flattens a JSON body's nested `utm: {...}` object into the flat form-field shape. */
function flattenUtm(input: Record<string, unknown>): Record<string, unknown> {
  const utm = input.utm as Utm | undefined;
  if (!utm || typeof utm !== 'object') return input;
  const rest = { ...input };
  delete rest.utm;
  return {
    ...rest,
    utmSource: input.utmSource ?? utm.source,
    utmMedium: input.utmMedium ?? utm.medium,
    utmCampaign: input.utmCampaign ?? utm.campaign,
  };
}

export function parseLeadInput(input: Record<string, unknown>): ParseLeadResult {
  const result = rawLeadSchema.safeParse(flattenUtm(input));
  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: LeadFieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'name' || field === 'email' || field === 'consent') {
      errors[field] = issue.message;
    }
  }
  return { success: false, errors };
}
