// POST /api/waitlist (contracts/waitlist-api.md) — the site's only dynamic surface.
// Unauthenticated by design (FR-001); accepts only non-privileged lead data.
import type { APIRoute } from 'astro';
import { randomUUID } from 'node:crypto';
import { parseLeadInput } from '../../lib/lead';
import { checkBot, hashIp } from '../../lib/bot';
import { classifyReferralChannel } from '../../lib/channel';
import { insertLead } from '../../lib/db';
import { syncLeadToRoihub } from '../../lib/roihub';
import { CONSENT_VERSION } from '../../lib/site';

export const prerender = false;

const SUCCESS_BODY = { ok: true, message: 'Recebemos seu pedido de acesso antecipado.' };
const GENERIC_ERROR_BODY = {
  ok: false,
  message: 'Não foi possível registrar agora. Tente novamente em instantes.',
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** One JSON log line per request. Never logs the email address, raw IP, or secrets. */
function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify(entry));
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as Record<string, unknown>;
  }
  // application/x-www-form-urlencoded — no-JS progressive-enhancement path (FR-007).
  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

function getClientIp(request: Request, clientAddress: string | undefined): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return clientAddress || forwarded?.split(',')[0]?.trim() || 'unknown';
}

/** JS fetch calls send `Accept: application/json`; a native <form> POST doesn't. */
function wantsJson(request: Request): boolean {
  return (request.headers.get('accept') ?? '').includes('application/json');
}

/**
 * No-JS path (FR-007, R10): redirect back to the source page with the outcome in the
 * query string instead of navigating the browser to a raw JSON body (Post/Redirect/Get).
 */
function redirectWithStatus(sourcePage: string | undefined, status: string): Response {
  const target = sourcePage && sourcePage.startsWith('/') ? sourcePage : '/acesso';
  return new Response(null, {
    status: 303,
    headers: { Location: `${target}?waitlist=${status}` },
  });
}

const methodNotAllowed: APIRoute = () => jsonResponse({ ok: false }, 405);
export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const DELETE = methodNotAllowed;
export const PATCH = methodNotAllowed;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const requestId = randomUUID();
  const start = Date.now();
  let sourcePage: string | undefined;

  try {
    const raw = await readBody(request);
    sourcePage = typeof raw.sourcePage === 'string' ? raw.sourcePage : undefined;

    const empresa = typeof raw.empresa === 'string' ? raw.empresa : '';
    const renderedAt = Number(raw.renderedAt ?? 0);
    const ipHash = hashIp(getClientIp(request, clientAddress));

    // Bot heuristics run before validation — a bot must not be able to use
    // validation errors to probe the schema (contract, normative processing order).
    const botCheck = await checkBot({ empresa, renderedAt, ipHash });
    if (botCheck.isBot) {
      log({
        requestId,
        outcome: 'bot',
        reason: botCheck.reason,
        sourcePage,
        durationMs: Date.now() - start,
        level: 'warn',
      });
      return wantsJson(request) ? jsonResponse(SUCCESS_BODY, 200) : redirectWithStatus(sourcePage, 'success');
    }

    const parsed = parseLeadInput(raw);
    if (!parsed.success) {
      log({ requestId, outcome: 'invalid', sourcePage, durationMs: Date.now() - start });
      return wantsJson(request)
        ? jsonResponse({ ok: false, errors: parsed.errors }, 422)
        : redirectWithStatus(sourcePage, 'invalid');
    }

    const data = parsed.data;
    const referralChannel = classifyReferralChannel({
      referrer: data.referrer,
      utmSource: data.utmSource,
    });

    const lead = await insertLead({
      email: data.email,
      name: data.name,
      sourcePage: data.sourcePage,
      referralChannel,
      referrer: data.referrer,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      consentAt: new Date(),
      consentVersion: CONSENT_VERSION,
      ipHash,
      userAgent: (request.headers.get('user-agent') ?? '').slice(0, 400),
    });

    log({
      requestId,
      outcome: lead ? 'created' : 'duplicate',
      referralChannel,
      sourcePage,
      durationMs: Date.now() - start,
    });

    const response = wantsJson(request)
      ? jsonResponse(SUCCESS_BODY, 200)
      : redirectWithStatus(sourcePage, 'success');

    // Fire-and-persist: the response is already built before the CRM call starts, and
    // the lead row is already committed, so a CRM outage costs a sync, never a lead
    // (contract invariant 1-2, Principle V). Vercel's Node runtime drains pending
    // promises before freezing the function, so this completes even though it isn't
    // awaited here.
    if (lead) {
      void syncLeadToRoihub(lead).catch(() => {});
    }

    return response;
  } catch {
    log({ requestId, outcome: 'error', sourcePage, durationMs: Date.now() - start, level: 'error' });
    // A DB failure is a genuine 500 even on the no-JS path — the contract reserves
    // 500 for persistence failures only, so it must never be masked as a redirect.
    return jsonResponse(GENERIC_ERROR_BODY, 500);
  }
};
