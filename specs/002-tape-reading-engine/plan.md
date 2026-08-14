# Implementation Plan: Tape Reading Engine (Agent-Side)

**Branch**: `002-tape-reading-engine` | **Date**: 2026-08-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-tape-reading-engine/spec.md`

## Summary

Build the tape-reading engine (`TapeReader` + `OrderFlowAnalyzer`) as new modules
inside `agent/`, wired to the existing `binance_feed.py` (trade/book stream) and
`normalize.py` (`RollingSizes`, already validated). The engine classifies trade
aggression, ranks trade size against a rolling percentile, factors in top-of-book
imbalance, applies a togglable session filter, and emits a signal — never an order.
Everything runs in-process on the trader's own machine; nothing moves to the cloud.

## Technical Context

**Language/Version**: Python 3.13, via the Microsoft Store interpreter
(`C:\Users\jeanz\AppData\Local\Microsoft\WindowsApps\python.exe` — the only working
interpreter on the owner's machine per handoff §7; `C:\Python313`'s stdlib is broken).

**Primary Dependencies**: Standard library only for the engine itself (`asyncio`,
`collections`, `bisect`, `json`, `datetime`) — matches `normalize.py`. `websockets`
(already a dependency of `binance_feed.py`, imported lazily) for the live feed path.
No new third-party dependency is added.

**Storage**: N/A. The engine is stateless between runs; signals are written to an
append-only local log (stdout / redirected file), not a database. This matches the
post-pivot architecture (handoff §4): the engine lives on the agent, not the cloud
backend, so it never touches Postgres/Mongo.

**Testing**: Same convention as the rest of `agent/` — a `--selftest` entry point per
module using plain `assert` statements, runnable without network access or external
services (no pytest, no fixtures — nothing in `agent/` uses a test framework today).

**Target Platform**: The trader's local Windows machine (handoff §4's local-agent
product decision). Not deployed to any server.

**Project Type**: Single-project CLI-style Python scripts inside `agent/` — no web
service, no new project structure.

**Performance Goals**: Keep pace with a live retail WebSocket feed in real time
(process each trade/book event before the next arrives; no unbounded backlog). No
formal sub-10ms figure is claimed for this feature — see Constitution Check, Principle
III.

**Constraints**: No new third-party dependencies (ladder: stdlib + already-used
`websockets` cover everything needed). No order placement of any kind (FR-006).
Windows-only target, matching the product decision.

**Scale/Scope**: One instrument, one trader, one running engine process at a time.
Roughly four new modules plus a small, additive change to `binance_feed.py`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Checked against constitution **v2.0.0** (amended 2026-08-14 to reflect the
local-agent/signal-only pivot from handoff §4). The v1.0.0 text was written for the
cloud auto-execution architecture and conflicted with this feature on two principles;
rather than reinterpret them in this plan, the constitution itself was amended first.

- **Principle I (Pure Tape Reading)** — **PASS**. The engine's only inputs are trade
  aggression, rolling trade-size percentile, and book imbalance — order-flow
  primitives, no chart indicators.
- **Principle II (Signal-Only, No Order Path)** — **PASS**. FR-006 forbids any order
  placement, and the design has no broker API surface at all — not disabled, not
  flagged, absent. FR-009's `trigger` field satisfies the principle's requirement
  that every signal carry the evidence it came from.
- **Principle III (Keep Pace With the Live Feed)** — **PASS**. FR-010 plus the
  feed-gap watchdog (research.md §3) suspend signal emission on a gap rather than
  signal against stale state; the spec's burst edge case covers backlog.
- **Principle IV (Security & Auditability)** — **PASS**. No HTTP endpoint, no
  secrets in this feature (the public Binance feed needs no key). The JSON-lines
  signal log is the auditable artifact the amended principle names.
- **Principle V (Observable, Fail-Safe Operation)** — **PASS**. Gap detection
  degrades to "stop emitting signals" rather than failing silently — the quiet
  failure mode the principle exists to prevent.
- **Technology Constraints** — **PASS**. The amended section names the local Python
  agent as a first-class target, stdlib-first; this feature adds no new dependency.
- **Development Workflow** — **PASS**. The amended section accepts `--selftest`
  assert-based checks as satisfying the automated-test requirement for the Python
  agent; every new module here carries one.

No violations requiring justification in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-tape-reading-engine/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

No `contracts/` directory: this feature has no external interface yet (no HTTP API,
no other process consumes the engine's output today — see spec Assumptions). The
signal schema is documented in `data-model.md` instead of a separate contracts folder.

### Source Code (repository root)

```text
agent/
├── binance_feed.py          # existing — small additive change: expose parsed
│                             #   trade/book events to an in-process consumer,
│                             #   not just stdout (see research.md)
├── normalize.py              # existing, unchanged — RollingSizes is reused as-is
├── tape_reader.py             # NEW — aggression classification + rolling-percentile
│                             #   "is this trade unusual" check, per instrument
├── order_flow_analyzer.py     # NEW — combines tape_reader output with top-of-book
│                             #   imbalance into a Signal
├── session_filter.py         # NEW — SessionFilterConfig + "is this timestamp
│                             #   inside an allowed trading window" predicate
├── engine.py                  # NEW — wires feed -> tape_reader -> order_flow_analyzer
│                             #   -> session_filter -> signal log; the actual
│                             #   `python engine.py` entrypoint (the "motor")
├── tick_spike.py              # existing, untouched (ProfitDLL, still gated on license)
└── mt5_feed.py                 # existing, untouched (dead end per handoff §5)
```

**Structure Decision**: Flat modules directly in `agent/`, matching the existing
four scripts — no `src/` nesting, no package `__init__.py`, no framework. Each new
module keeps the established pattern: a docstring explaining the *why*, a
`--selftest` guarded by `if __name__ == "__main__"`, and lazy imports for anything
not needed by the selftest path.

## Complexity Tracking

*No entries — no constitution violations require justification (see Constitution
Check above).*
