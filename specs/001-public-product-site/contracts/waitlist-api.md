# Contract: Waitlist API (inbound, public)

**Feature**: `001-public-product-site` | **Endpoint**: `POST /api/waitlist`
**Implemented by**: `Site/src/pages/api/waitlist.ts` (`export const prerender = false`)

The single dynamic surface of the public site. Unauthenticated by design (FR-001) — it accepts
only non-privileged lead data and mutates no trading state.

---

## Request

```http
POST /api/waitlist HTTP/1.1
Content-Type: application/json
```

```jsonc
{
  "name": "Maria Souza",              // required, 2–120 chars after trim
  "email": "maria@exemplo.com.br",    // required, ≤254 chars, RFC-shaped
  "consent": true,                    // required, must be literally true (FR-013)
  "empresa": "",                      // honeypot — MUST be empty (FR-016)
  "renderedAt": 1786000000000,        // ms epoch when the form was rendered
  "sourcePage": "/conceitos/absorcao", // path the form was submitted from
  "referrer": "https://www.google.com/", // optional, raw document.referrer
  "utm": {                            // optional, all fields optional
    "source": "perplexity",
    "medium": "ai",
    "campaign": "launch"
  }
}
```

`Content-Type: application/x-www-form-urlencoded` with the same field names MUST also be accepted,
so the form works without JavaScript (progressive enhancement — see R10). Unknown fields are
stripped, not rejected.

---

## Responses

### 200 — accepted

```json
{ "ok": true, "message": "Recebemos seu pedido de acesso antecipado." }
```

Returned in **three** cases, indistinguishable to the caller by design:
1. A new lead was persisted.
2. The email already exists as an active lead (idempotent re-submission — `crm_sync_status`
   is left untouched, no duplicate row).
3. The submission was classified as automated (honeypot filled, or submitted < 2s after render,
   or over the rate limit). **Nothing is written.** This is the silent rejection the spec's edge
   case requires — a bot MUST NOT learn it was detected.

### 422 — validation failed

```json
{
  "ok": false,
  "errors": {
    "email": "Informe um e-mail válido.",
    "consent": "É necessário aceitar a política de privacidade."
  }
}
```

Field-keyed messages in pt-BR, rendered next to the corresponding input via `aria-describedby`
and announced through an `aria-live="polite"` region (FR-015).

### 405 — method not allowed

Any method other than `POST`.

### 500 — persistence failure

```json
{ "ok": false, "message": "Não foi possível registrar agora. Tente novamente em instantes." }
```

Returned **only** when the database write itself fails. A roihub sync failure MUST NOT produce a
500 — the lead is already persisted at that point (see [roihub-crm.md](./roihub-crm.md)).

---

## Processing order (normative)

1. Method check → 405.
2. Parse body (JSON or form-encoded); strip unknown fields.
3. Bot heuristics: honeypot non-empty, or `now - renderedAt < 2000ms`, or IP-hash rate limit
   exceeded (5/hour) → **return 200 success, write nothing, log at `warn` with the reason**.
4. Zod validation → 422 on failure.
5. Normalize: lowercase/trim email, trim name, classify `referral_channel` (see
   [data-model.md §3](../data-model.md)), hash IP with the server salt, truncate `user_agent`.
6. Insert with `on conflict (lower(email)) where deleted_at is null do nothing`.
7. Return 200 to the visitor.
8. **After** responding, attempt the roihub sync and update `crm_sync_status`.

Steps 3 and 4 are in this order deliberately: a bot must not be able to use validation errors to
probe the schema.

---

## Non-functional requirements

- **Validation is server-side and authoritative** (Principle IV). Client-side validation exists
  only for UX and is never trusted.
- **Secrets** (`DATABASE_URL`, `ROIHUB_WEBHOOK_URL`, `ROIHUB_API_KEY`, `IP_HASH_SALT`) come from
  the environment. They MUST NOT appear in logs or in any response body.
- **Structured logging** (Principle V): one JSON log line per request with `requestId`, `outcome`
  (`created` | `duplicate` | `bot` | `invalid` | `error`), `referralChannel`, `sourcePage`, and
  duration. Never log the email address or raw IP.
- **No PII in error responses.**
- **CORS**: same-origin only; no `Access-Control-Allow-Origin` header is emitted.
- Response target: p95 < 800ms including the DB write (the CRM call is outside the response path).

---

## Test cases (these are the acceptance criteria)

| # | Input | Expected |
|---|---|---|
| 1 | Valid body, new email | 200 `ok:true`; exactly one row; `crm_sync_status` transitions from `pending` |
| 2 | Valid body, existing active email | 200 `ok:true`; still exactly one row |
| 3 | `empresa: "Acme"` | 200 `ok:true`; **zero** rows written |
| 4 | `renderedAt` = now (< 2s) | 200 `ok:true`; zero rows written |
| 5 | 6th submission from the same IP hash within an hour | 200 `ok:true`; zero rows written |
| 6 | `consent: false` | 422 with a `consent` error; zero rows |
| 7 | `email: "não-é-email"` | 422 with an `email` error; zero rows |
| 8 | `name: "a"` | 422 with a `name` error; zero rows |
| 9 | Form-encoded body, valid | 200 `ok:true`; one row (no-JS path works) |
| 10 | roihub unreachable | 200 `ok:true`; row exists with `crm_sync_status='failed'`, `crm_attempts=1` |
| 11 | DB unreachable | 500; response contains no stack trace or connection string |
| 12 | `GET /api/waitlist` | 405 |
