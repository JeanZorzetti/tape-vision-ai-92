<!--
Sync Impact Report
- Version change: 1.0.0 → 2.0.0 (MAJOR)
- Trigger: product pivot recorded in handoff.md §4 (2026-08-14) — local Windows
  agent, signal-only, tape-reading engine moves out of the cloud into a Python
  agent. v1.0.0 (2026-08-12) was written for the cloud auto-execution
  architecture and had become inaccurate on three counts.
- Modified principles:
  - II. Risk-First, Confidence-Gated Execution → II. Signal-Only, No Order Path
    (NON-NEGOTIABLE) — redefined: the old confidence/risk gates presupposed an
    order path the product no longer has. The gate is now absolute (no order
    is ever submitted), which is strictly stronger, not weaker.
  - III. Real-Time Performance Budget (Sub-10ms) → III. Keep Pace With the Live
    Feed — redefined: the 10ms figure was a capital-safety requirement for
    unattended auto-execution. With a human reading each signal, the real
    requirement is no backlog / no stale data, which is testable; 10ms was not
    being measured by anything.
- Unchanged principles: I (Pure Tape Reading), IV (Security & Auditability),
  V (Observable, Fail-Safe Operation)
- Modified sections: Technology & Integration Constraints (local Python agent
  added as a first-class target; cloud backend scope narrowed), Development
  Workflow (test expectations stated per target)
- Added sections: none
- Removed sections: none
- Deferred/TODO items: RATIFICATION_DATE still unknown (project predates the
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

### II. Signal-Only, No Order Path (NON-NEGOTIABLE)
The system MUST NOT place, modify, or cancel any order, under any condition.
It emits signals; a human decides and sends every order themselves. No code
path from a generated signal to a broker order API may exist — not disabled,
not feature-flagged, not behind a config value. Any proposal to add automated
execution is a constitutional amendment, not a feature.

Every emitted signal MUST carry the evidence it was derived from (contributing
trade/book events and the rule that fired), so a person can judge it before
acting.

**Rationale**: Two reasons, and both must hold. Product: the owner's decision
(handoff.md §4) is that the client sends the order, which keeps the system
clear of CVM rules governing automated order routing (to be confirmed with
counsel before any marketing copy claims this). Safety: an absolute "no orders"
rule is enforceable by inspection, whereas the previous confidence-and-risk
gate was only as good as the gate's own correctness. This replaces v1.0.0's
90%-confidence/position-sizing/circuit-breaker gate — not by relaxing it, but
by removing the thing it was guarding.

### III. Keep Pace With the Live Feed
The market-data → analysis → signal path MUST process events as fast as they
arrive, with no unbounded backlog and no signal derived from stale state. When
the feed gaps, disconnects, or falls behind, the system MUST detect it and
suspend signal emission rather than emit against outdated data. Changes that
add synchronous work to this path MUST demonstrate the path still keeps up
with a live feed, or move the work off it.

**Rationale**: Replaces v1.0.0's sub-10ms budget. That figure was a
capital-safety requirement for unattended auto-execution — with a human
reading each signal, tens of milliseconds are invisible and the real failure
mode is different: silently drifting behind the feed, or signalling on stale
data after a disconnect. That failure is observable and testable; the 10ms
number was measured by nothing and enforced by nobody.

### IV. Security & Auditability by Default
Every request that can affect system state MUST be authenticated (JWT) and
authorized via role-based permissions, with input validated at the boundary.
Every signal emitted and every config change MUST be written to an append-only
audit trail sufficient to reconstruct decisions (per CVM/B3 retention
expectations). Secrets (API keys, DB credentials, JWT secret) MUST come from
environment/secret storage, never committed or logged in plaintext.

**Rationale**: Backend/docs/SECURITY.md and the regulatory section of
Backend/docs/TRADING.md make this a compliance requirement, not a
best-effort one — this is a financial system operating on B3-regulated
instruments. Note that the audit trail's subject changed with Principle II:
there are no orders or trades to record, so the signal itself is the
auditable artifact.

### V. Observable, Fail-Safe Operation
Components on the market-data path MUST emit structured logs (with
correlation/session IDs), expose health checks, and recover automatically from
disconnects (reconnect with backoff, restore state) rather than fail silently.
When automatic recovery isn't possible, the system MUST degrade to a safe
state (stop emitting signals) and raise an alert rather than continue on
uncertain data.

**Rationale**: The agent runs for long unattended sessions against live
markets. The dangerous failure here is not a crash — a crash is loud. It is
the quiet one: a filter that never fires, or a feed that stopped delivering,
read by the user as "no signals today" instead of "my system is broken."

## Technology & Integration Constraints

The system has two deployment targets with different rules. Code written for
one MUST NOT assume the other's stack.

**Local agent (Windows, Python)** — owns the tape-reading engine and all
market-data handling:
- Python, standard-library-first. A third-party dependency must justify why
  the stdlib and already-installed packages can't do the job.
- Market data is consumed on the client's own machine, next to their broker
  license. The cloud never touches the feed.
- Feed adapters (ProfitDLL, Binance, and any future source) MUST expose the
  same event shape, so the engine's detection logic is swappable without
  rewriting it.

**Cloud backend (Node.js + TypeScript, strict mode)** — narrowed by the pivot
to auth, billing, and signal history; Express for REST, Socket.IO for
real-time streaming. It no longer hosts the trading engine. PostgreSQL is the
system of record.

**Frontend (React)** communicates over REST + WebSocket only — no direct
database, broker, or feed access from the client.

## Development Workflow

- Trading logic (tape reading, order flow analysis, signal generation)
  requires automated tests, on both targets. In the Python agent the
  established form is a `--selftest` entry point using plain `assert`
  statements, runnable offline with no network and no framework; in the
  TypeScript backend it is the existing test suite. Either satisfies this
  requirement — a module with non-trivial logic and no runnable check does not.
- TypeScript strict typing is required for backend code; ESLint and Prettier
  rules are enforced, not advisory.
- Changes to inter-service or feed-adapter communication require integration
  tests. Changes on the market-data path require evidence it still keeps pace
  with a live feed (Principle III).
- Changes merge via pull request review. **Pushing to `main` deploys to
  production** — no direct pushes to `main` for engine, security, or
  auth/billing code.

## Governance

This constitution supersedes ad hoc practice for anything it covers. Amending
it requires: a PR updating this file, an explicit version bump per the rules
below, and a stated reason for the change.

- **MAJOR**: backward-incompatible principle removal/redefinition (e.g.
  allowing chart-based signals, or introducing an automated order path).
- **MINOR**: new principle or materially expanded guidance.
- **PATCH**: wording clarifications with no behavioral change.

All PRs touching the engine, security, or auth/billing code should be checked
against the relevant principle(s) above before merge. Complexity that
conflicts with a principle must be justified in the PR description or the
change should be rejected. A plan or spec MUST NOT reinterpret a principle to
fit itself — if a principle no longer matches reality, amend it here first.

TODO(RATIFICATION_DATE): project code predates this constitution; original
adoption date is unknown. Treat 2026-08-12 as the effective start date for
enforcement purposes.

**Version**: 2.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2026-08-14
