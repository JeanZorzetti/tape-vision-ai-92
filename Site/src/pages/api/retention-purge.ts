// Daily Vercel Cron target (research R12, FR-013): hard-deletes leads past the
// 24-month retention or soft-deleted >30 days ago, and retries `failed` CRM syncs
// with `crm_attempts < 5` in the same pass — one scheduled endpoint, not two.
import type { APIRoute } from 'astro';
import { purgeExpiredLeads, findFailedLeadsToRetry } from '../../lib/db';
import { syncLeadToRoihub } from '../../lib/roihub';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Vercel signs Cron requests with this header; unset locally, so the quickstart's
  // manual curl keeps working without auth.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const purged = await purgeExpiredLeads();

  const retryCandidates = await findFailedLeadsToRetry();
  await Promise.allSettled(retryCandidates.map((lead) => syncLeadToRoihub(lead)));

  return new Response(
    JSON.stringify({
      ok: true,
      purgedRetention: purged.retention,
      purgedSoftDeleted: purged.softDeleted,
      retried: retryCandidates.length,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
