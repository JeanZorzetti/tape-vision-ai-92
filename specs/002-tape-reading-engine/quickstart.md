# Quickstart: Tape Reading Engine (Agent-Side)

## Prerequisites

- The Microsoft Store Python interpreter (handoff §7):
  `C:\Users\jeanz\AppData\Local\Microsoft\WindowsApps\python.exe` — the project
  `python`/`py` on PATH may point elsewhere and won't work.
- `websockets` installed for that interpreter (already required by `binance_feed.py`;
  only needed for the live-feed path, not for `--selftest`).

## Validate offline (no network), per module

Each module in `agent/` is self-contained and self-checking — no framework, no
fixtures:

```
python agent/normalize.py --selftest
python agent/binance_feed.py --selftest
python agent/tape_reader.py --selftest
python agent/order_flow_analyzer.py --selftest
python agent/session_filter.py --selftest
python agent/engine.py --selftest
```

Expected: each prints `selftest OK — ...` and exits 0. This is the "one runnable
check" for each module's non-trivial logic (percentile ranking, aggression
classification, imbalance math, window matching, wiring) — no live feed required.

## Validate User Story 1 — real-time signal on live data

1. `python agent/engine.py` (defaults to `SYMBOL=btcusdt`, session filtering off).
2. Watch stdout. During the first ~100 trades (cold start, matching
   `normalize.RollingSizes`' `min_samples`), confirm **no** `signal` lines appear —
   only whatever trade/book activity logging the engine prints at a lower level.
3. Once warmed up, confirm a `signal` JSON line appears when a trade's size ranks
   at or above the 95th percentile with a clear aggressor side — and that the
   `trigger` field in that line names the actual trade that caused it (SC-003).
4. Stop with Ctrl+C; confirm no exception on shutdown.

## Validate User Story 2 — sane behavior over an unattended session

1. Run `python agent/engine.py` for several hours, redirecting stdout to a file:
   `python agent/engine.py > session.log`.
2. Afterward, inspect `session.log`:
   - No crash / traceback.
   - No signal before the cold-start warm-up completed (grep timestamps against
     the 100th trade).
   - No unreasonable signal flood (sanity-check: signal count should be a small
     fraction of total trade count).

## Validate User Story 3 — session filtering

1. Run with filtering forced on and a narrow window that excludes "now":
   `SESSION_FILTER=on python agent/engine.py` (exact env var name is an
   implementation detail of `session_filter.py`, finalized in `tasks.md`).
2. Confirm no signals are emitted even when a qualifying trade occurs.
3. Re-run with the window set to include "now" (or filtering off): confirm
   qualifying trades do produce signals.

## Out of scope for this quickstart

- Anything involving `tick_spike.py` (ProfitDLL) — still gated on the paid license
  (handoff §5); not exercised by this feature.
- Any order placement — there is no code path to exercise, by design (FR-006).
