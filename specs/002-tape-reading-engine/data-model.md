# Phase 1 Data Model: Tape Reading Engine (Agent-Side)

Entities as introduced in `spec.md`'s Key Entities section, with concrete field
shapes decided during planning. No database — these are in-memory objects (plain
dicts or small dataclasses) passed between modules within one process, plus the
`Signal` entity's on-disk shape (it's the one thing this feature persists, as a log).

## Trade Event

Produced by a feed adapter (`binance_feed.py` today); consumed by `tape_reader.py`.

| Field | Type | Notes |
|---|---|---|
| `instrument` | str | e.g. `"BTCUSDT"` |
| `price` | float | |
| `size` | float | Fed into `normalize.RollingSizes` — see FR-002 |
| `side` | `"buy"` \| `"sell"` | Aggressor side, from `binance_feed.aggression()` (FR-001) |
| `timestamp` | float (epoch seconds) | From the feed's own trade time, not receive time |

## Book Update

Produced by a feed adapter; consumed by `order_flow_analyzer.py`.

| Field | Type | Notes |
|---|---|---|
| `instrument` | str | |
| `bid_price` | float | |
| `bid_size` | float | |
| `ask_price` | float | |
| `ask_size` | float | Top-of-book only — see research.md §5 |
| `timestamp` | float (epoch seconds) | |

## Rolling Size Window

This is `normalize.RollingSizes`, reused as-is (no new fields) — one instance per
instrument, fed every `Trade Event.size`. Exposes `.ready`, `.rank(size)`,
`.median()`, `.ratio(size)` (see `agent/normalize.py`). Internal to `tape_reader.py`;
never serialized or exposed outside the engine.

## Session Filter Config

Held by `session_filter.py`; supplied to the engine at startup (env var or a small
constant per market — no config file format is specified by this feature).

| Field | Type | Notes |
|---|---|---|
| `enabled` | bool | Off by default (crypto); on for session-based markets (FR-007) |
| `windows` | list of `(datetime.time, datetime.time)` | Allowed trading windows, local time |

## Signal

The engine's output (FR-005). This is the one entity this feature persists — as a
JSON Lines log, one object per line (research.md §4).

| Field | Type | Notes |
|---|---|---|
| `instrument` | str | |
| `direction` | `"buy"` \| `"sell"` | The suggested side — never submitted as an order (FR-006) |
| `strength` | float (0..1) | `(aggressor_rank + directional_imbalance) / 2`, where `directional_imbalance` is the book imbalance oriented toward `direction` (i.e. `bid_ratio` for a buy, `1 - bid_ratio` for a sell). Deliberately a flat mean of two 0..1 inputs — no tuned weights, because there is no outcome data to tune against (FR-005) |
| `timestamp` | float (epoch seconds) | |
| `trigger` | object | `{"aggressor_rank": float, "book_imbalance": float, "cutoff": float, "trade": Trade Event}` — enough for a reviewer to reconstruct why this signal fired, including which cutoff was in force (SC-003) |

**Validation / state rules** (from Functional Requirements and edge cases):

- No `Signal` may be produced while the relevant instrument's Rolling Size Window
  has `ready == False` (FR-003, cold-start edge case).
- No `Signal` may be produced while the feed is gapped (FR-010, disconnect edge
  case — see research.md §3).
- No `Signal` may be produced outside an allowed window when `SessionFilterConfig.enabled`
  is `True` (FR-007).
- A `Signal` is never turned into an order, cancel, or modification by this feature
  (FR-006) — there is no code path from `Signal` to any order API.
