<!--
Sync Impact Report
- Version change: (none, template) → 1.0.0
- Modified principles: n/a (initial ratification)
- Added sections: Core Principles (I–V), Technology & Integration Constraints,
  Development Workflow, Governance
- Removed sections: none
- Deferred/TODO items: RATIFICATION_DATE unknown (project predates this
  constitution) — see Governance footer.
-->
# Tape Vision AI Constitution

## Core Principles

### I. Pure Tape Reading (NON-NEGOTIABLE)
Trading decisions MUST derive only from order flow: time-and-sales, order book
depth, absorption, aggression, and hidden-liquidity analysis. Chart-based
technical indicators (moving averages, oscillators, chart patterns) MUST NOT
be introduced as a signal input. Any new analysis component must state which
order-flow primitives it consumes and be traceable back to raw tape/book data.

**Rationale**: This is the system's stated differentiator (Backend/docs/ARCHITECTURE.md,
Backend/docs/TRADING.md). Diluting it with indicator-based logic would change
the product, not extend it.

### II. Risk-First, Confidence-Gated Execution
No trade may be placed below the configured minimum signal confidence
(currently 90%). Every order path MUST pass through position sizing derived
from account risk-per-trade, the daily loss limit/circuit breaker, and
max-drawdown checks before submission. An emergency-stop path that halts
trading and flattens/holds positions safely MUST always be reachable and
MUST be exercised by tests.

**Rationale**: Backend/docs/TRADING.md and RiskManager design treat capital
preservation as paramount; confidence and risk gates are what make
high-frequency execution safe to run unattended.

### III. Real-Time Performance Budget (Sub-10ms)
The market-data → analysis → signal path MUST stay within the documented
sub-10ms processing budget. Changes that add synchronous work to this path
(new analysis steps, blocking I/O, unbounded allocations) MUST include a
latency measurement showing the budget still holds, or MUST move the work
off the hot path (async/queued).

**Rationale**: Tape reading is only valid in real time; a slow pipeline
silently degrades into stale-data trading, which the architecture docs treat
as a correctness issue, not just a performance one.

### IV. Security & Auditability by Default
Every request that can affect trading state MUST be authenticated (JWT) and
authorized via role-based permissions, with input validated at the boundary.
Every order, trade, cancel, and config change MUST be written to an
append-only audit trail sufficient to reconstruct decisions (per CVM/B3
retention expectations). Secrets (API keys, DB credentials, JWT secret) MUST
come from environment/secret storage, never committed or logged in plaintext.

**Rationale**: Backend/docs/SECURITY.md and the regulatory section of
Backend/docs/TRADING.md make this a compliance requirement, not a
best-effort one — this is a financial system operating on B3-regulated
instruments.

### V. Observable, Fail-Safe Operation
Components on the market-data or order-execution path MUST emit structured
logs (with correlation/session IDs), expose health checks, and recover
automatically from disconnects (reconnect with backoff, restore state) rather
than fail silently. When automatic recovery isn't possible, the system MUST
degrade to a safe state (stop trading) and raise an alert rather than
continue on uncertain data.

**Rationale**: The system runs unattended against live markets; silent
failure risks unbounded financial loss, so visibility and fail-safety are
treated as one requirement, not two.

## Technology & Integration Constraints

- Backend: Node.js + TypeScript (strict mode), Express for REST, Socket.IO
  for real-time streaming.
- Storage: MongoDB for persistent/trading/audit data, Redis for cache,
  session, and real-time metrics.
- Market data / execution: Nelogica is the primary broker integration;
  additional broker integrations must sit behind the same adapter interface
  rather than leaking broker-specific types into the trading engine.
- Frontend: React, communicating over REST + WebSocket only — no direct
  database or broker access from the client.
- New third-party dependencies must justify why an already-used piece of the
  stack (Node stdlib, existing MongoDB/Redis/Socket.IO usage) can't do the
  job before being added.

## Development Workflow

- TypeScript strict typing is required for trading-affecting code; ESLint
  and Prettier rules are enforced, not advisory.
- Trading logic (tape reading, order flow analysis, risk checks, signal
  generation) requires unit tests; changes to inter-service or broker
  communication require integration tests; changes on the hot path require a
  latency check (Principle III).
- Changes merge via pull request review; no direct pushes to main for
  trading-engine, risk, or security code.

## Governance

This constitution supersedes ad hoc practice for anything it covers. Amending
it requires: a PR updating this file, an explicit version bump per the rules
below, and a stated reason for the change.

- **MAJOR**: backward-incompatible principle removal/redefinition (e.g.
  relaxing the confidence gate or allowing chart-based signals).
- **MINOR**: new principle or materially expanded guidance.
- **PATCH**: wording clarifications with no behavioral change.

All PRs touching trading, risk, or security code should be checked against
the relevant principle(s) above before merge. Complexity that conflicts with
a principle must be justified in the PR description or the change should be
rejected.

TODO(RATIFICATION_DATE): project code predates this constitution; original
adoption date is unknown. Treat 2026-08-12 as the effective start date for
enforcement purposes.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-08-12
