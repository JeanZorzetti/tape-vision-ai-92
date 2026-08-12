# Contract: roihub CRM lead sync (outbound)

**Feature**: `001-public-product-site` | **Implemented by**: `Site/src/lib/roihub.ts`
**Satisfies**: FR-014

roihub's API is not documented in this repository, so this contract is defined **from our side**
as a generic authenticated JSON webhook. It is deliberately an adapter shape: if roihub expects
different field names or a different auth scheme, only this one file changes. Credentials and the
endpoint URL are configuration, explicitly out of scope for the spec.

---

## Configuration (environment only)

| Variable | Required | Notes |
|---|---|---|
| `ROIHUB_WEBHOOK_URL` | yes | full https URL of the lead-intake endpoint |
| `ROIHUB_API_KEY` | yes | sent as `Authorization: Bearer <key>` |
| `ROIHUB_TIMEOUT_MS` | no | default `3000` |

If `ROIHUB_WEBHOOK_URL` is unset (local development), the sync is skipped and the lead is left
`crm_sync_status = 'pending'` — never `failed`. An unconfigured integration is not an error.

---

## Request

```http
POST {ROIHUB_WEBHOOK_URL}
Authorization: Bearer {ROIHUB_API_KEY}
Content-Type: application/json
Idempotency-Key: {lead.id}
```

```json
{
  "source": "tapevision-site",
  "externalId": "b3f1c2a4-...",
  "name": "Maria Souza",
  "email": "maria@exemplo.com.br",
  "product": "tape-vision-ai",
  "interest": "early-access",
  "sourcePage": "/conceitos/absorcao",
  "referralChannel": "ai",
  "utm": { "source": "perplexity", "medium": "ai", "campaign": "launch" },
  "consentAt": "2026-08-12T14:03:22.481Z",
  "consentVersion": "2026-08-12",
  "createdAt": "2026-08-12T14:03:22.481Z"
}
```

`externalId` is the `waitlist_lead.id`, also sent as `Idempotency-Key`, so a retry after an
ambiguous timeout cannot create a duplicate contact on roihub's side.

---

## Response handling

| roihub response | Our action |
|---|---|
| `2xx` | `crm_sync_status='synced'`, `crm_synced_at=now()` |
| `409` (already exists) | treated as success — `synced` |
| `4xx` (other) | `failed`, record status + truncated body in `crm_last_error`. **Not retried** — a client error will not fix itself |
| `5xx`, timeout, network error | `failed`, retried by the cron job |
| any | `crm_attempts` incremented |

Retry policy: the daily cron (`/api/retention-purge`) picks up rows with
`crm_sync_status='failed'` and `crm_attempts < 5` and re-attempts them. After 5 attempts the row
is left `failed` for manual inspection — retrying indefinitely would hide a broken contract
rather than surface it.

---

## Invariants (non-negotiable)

1. **The sync never blocks the visitor's response.** It runs after the 200 is returned.
2. **A CRM failure never loses a lead.** The row is committed to PostgreSQL first; the CRM is a
   downstream consumer, not the system of record (Principle V — degrade safely, stay visible).
3. **Credentials never appear in logs or in `crm_last_error`.** The error body is truncated to
   500 chars and scrubbed of any `Authorization` echo.
4. **Only consented leads are sent.** A row cannot exist without `consent_given = true`, so this
   holds by construction (FR-013).
5. Soft-deleted leads (`deleted_at` set) are never synced or retried.

---

## Test cases

| # | Scenario | Expected |
|---|---|---|
| 1 | roihub returns 200 | `synced`, `crm_synced_at` set, `crm_attempts=1` |
| 2 | roihub returns 409 | `synced` (idempotent duplicate is success) |
| 3 | roihub returns 400 | `failed`, error recorded, **not** picked up by the retry scan |
| 4 | roihub returns 503 | `failed`, picked up by the next cron run |
| 5 | Request exceeds `ROIHUB_TIMEOUT_MS` | `failed`; the visitor still received 200 well before |
| 6 | `ROIHUB_WEBHOOK_URL` unset | no HTTP call, status stays `pending`, no error logged |
| 7 | Row already at `crm_attempts=5` | skipped by the retry scan |
| 8 | Error body contains the API key | key is absent from `crm_last_error` and from logs |
