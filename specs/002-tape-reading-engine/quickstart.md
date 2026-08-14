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

1. `python agent/engine.py` (defaults to `SYMBOL=btcusdt`, `MIN_SAMPLES=500`,
   session filtering off).
2. Watch stdout. During the first ~500 trades (cold start; `MIN_SAMPLES` raised
   from `normalize.RollingSizes`' own 100-sample default after a T007 live
   finding — BTCUSDT's size distribution is right-skewed enough that 100
   samples misjudged the tail), confirm **no** output appears at all — the
   engine only ever prints a `signal` line or a `[GAP]` notice, nothing per
   ordinary trade/book event.
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
     the 500th trade — `MIN_SAMPLES`, see "Validate User Story 1" above).
   - No unreasonable signal flood (sanity-check: signal count should be a small
     fraction of total trade count — a live diagnostic during T007 measured
     ~6% at `MIN_SAMPLES=500` over 3000 real BTCUSDT trades).

## Validate User Story 3 — session filtering

1. Run with filtering forced on and a narrow window that excludes "now" (local
   time, `HH:MM-HH:MM`, comma-separated for more than one window):
   `SESSION_FILTER=on SESSION_WINDOWS="00:00-00:01" python agent/engine.py`.
2. Confirm no signals are emitted even when a qualifying trade occurs.
3. Re-run with `SESSION_WINDOWS` set to a window that includes "now" (or drop
   `SESSION_FILTER` to leave filtering off, its default): confirm qualifying
   trades do produce signals.

## Out of scope for this quickstart

- Anything involving `tick_spike.py` (ProfitDLL) — still gated on the paid license
  (handoff §5); not exercised by this feature.
- Any order placement — there is no code path to exercise, by design (FR-006).
