---
description: "Task list for the Tape Reading Engine (Agent-Side) feature"
---

# Tasks: Tape Reading Engine (Agent-Side)

**Input**: Design documents from `specs/002-tape-reading-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: No separate test framework is used anywhere in `agent/` today — every
module validates itself via a `--selftest` entry point with plain `assert`
statements (see `normalize.py`, `binance_feed.py`). This feature follows the same
convention instead of introducing `tests/contract/` or `tests/integration/`
directories: each implementation task below includes building out that module's
`--selftest`, and quickstart.md's per-story sections are the manual/live
validation layer on top of it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm the starting point is green before touching anything.

- [X] T001 Run `python agent/normalize.py --selftest` and `python agent/binance_feed.py --selftest`; confirm both pass before making any change (baseline for T002)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The one shared hand-off point every user story depends on — turning
the feed's already-parsed events into something `engine.py` can consume in-process,
plus the engine's skeleton loop (gap detection, signal log). No story-specific
detection logic yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Modify `agent/binance_feed.py`: extract the parsed trade/book dict one level earlier into an internal async generator (or optional callback) that the existing `_stream()` print loop consumes by default; keep `python agent/binance_feed.py`'s observable output unchanged (research.md §1-2). **Add** a `--selftest` case driving the new generator with fabricated WebSocket messages — the existing selftest only covers `aggression()`/`fmt_trade()`/`fmt_book()` and would pass unchanged even if this task broke `_stream()` entirely
- [X] T003 Create `agent/engine.py` skeleton: async main loop that drives `binance_feed`'s event generator from T002, a feed-gap watchdog using `time.monotonic()` that suspends processing when no event arrives within a timeout (research.md §3, FR-010), and a JSON-lines signal writer stub (research.md §4) — no signal-detection logic yet; `--selftest` exercises the watchdog and writer against fabricated events, no network required

**Checkpoint**: Foundation ready — `engine.py` can run against the live feed and log nothing (no detection wired in yet), and detects a feed gap correctly.

---

## Phase 3: User Story 1 - Real-time signal from live order flow (Priority: P1) 🎯 MVP

**Goal**: While connected to a live feed, the engine recognizes an unusual, clearly-directional trade and emits one signal carrying instrument, direction, confidence, and timestamp.

**Independent Test**: Feed the engine a trade sized above the current rolling 95th percentile with a clear aggressor side (after warm-up); confirm exactly one signal is emitted, with the triggering trade attached.

### Implementation for User Story 1

- [X] T004 [P] [US1] Create `agent/tape_reader.py`: per-instrument `normalize.RollingSizes` management plus trade aggression classification (generalizes `binance_feed.aggression()`), exposing "is the window ready" and "this trade's percentile rank" (FR-001, FR-002, FR-003; data-model.md Trade Event / Rolling Size Window); guard against a missing/zero/negative trade size so a degenerate value neither crashes the engine nor enters the rolling window and skews every later percentile (spec.md Edge Cases); `--selftest` covers cold-start (`ready is False` → no rank claimed), a known percentile case, and the zero/missing-size guard
- [X] T005 [P] [US1] Create `agent/order_flow_analyzer.py`: pure function combining a percentile rank, a top-of-book imbalance ratio (`bid_size / (bid_size + ask_size)`, research.md §5), and the cold-start flag into a `Signal` or `None` (FR-004, FR-005, FR-005a). Fires when `rank >= cutoff` (configurable, default 0.95); `strength = (aggressor_rank + directional_imbalance) / 2` per data-model.md Signal — flat mean, no tuned weights, and named `strength` not `confidence` because nothing here calibrates it against outcomes. `--selftest` covers the cold-start guard (FR-003 — no signal when not ready), the cutoff boundary, and the imbalance math with known inputs
- [X] T006 [US1] Wire `tape_reader` (T004) and `order_flow_analyzer` (T005) into `agent/engine.py`'s main loop (depends on T003, T004, T005): every trade updates the rolling window and may produce a signal; every book update refreshes the current imbalance; a produced `Signal` is written via the JSON-lines writer from T003 — no code path from `Signal` to any order submission exists anywhere in this loop (FR-006)
- [X] T007 [US1] Manually validate against the live Binance feed per quickstart.md's "Validate User Story 1" section: confirm silence during cold start, confirm a signal's `trigger` field names the real triggering trade. **Live finding**: `min_samples=100` (normalize.py's own default) was too thin for BTCUSDT's right-skewed size distribution — a 90s run fired on ~100% of trades post-warm-up. Raised to `min_samples=500` in `engine.py` (env var `MIN_SAMPLES`, not touching `normalize.py`'s own default or the p95 `cutoff`); a 3000-trade live diagnostic confirmed the rate stabilizes at ~6%.

**Checkpoint**: User Story 1 fully functional and testable independently — the engine detects and logs signals on live data.

---

## Phase 4: User Story 2 - Validate the engine without paying for market data (Priority: P2)

**Goal**: An unattended multi-hour run against Binance produces a reviewable log with no crash, no premature signals, and proves the detection logic doesn't secretly depend on Binance specifics.

**Independent Test**: Run `agent/engine.py` for hours, unattended; inspect the resulting log.

### Implementation for User Story 2

- [ ] T008 [US2] Manually run `python agent/engine.py > session.log` for a multi-hour unattended session per quickstart.md's "Validate User Story 2" section; confirm no crash, no signal before warm-up completed, and signal count stays a small fraction of trade count (SC-001, SC-002)
- [X] T009 [P] [US2] Add a "feed independence" case to `order_flow_analyzer.py`'s (or `engine.py`'s) `--selftest`: feed it fabricated trade/book events shaped like a *non*-Binance source and confirm signal detection behaves identically, mechanically proving FR-008/SC-004 rather than relying on code inspection

**Checkpoint**: User Stories 1 AND 2 both work independently — the engine is proven safe to run unattended and its detection logic is proven feed-agnostic.

---

## Phase 5: User Story 3 - Session filtering that fits the instrument (Priority: P3)

**Goal**: Signal emission respects a configurable, togglable trading-window filter — off by default (crypto), on with a defined window (future WDO).

**Independent Test**: Enable filtering with a narrow window that excludes "now"; confirm a qualifying trade produces no signal. Disable filtering; confirm the same trade does produce one.

### Implementation for User Story 3

- [X] T010 [P] [US3] Create `agent/session_filter.py`: `SessionFilterConfig` (`enabled: bool`, `windows: list[(datetime.time, datetime.time)]`) plus an `is_allowed(config, timestamp) -> bool` predicate (FR-007; data-model.md Session Filter Config); `--selftest` covers enabled+in-window, enabled+out-of-window, and disabled cases
- [X] T011 [US3] Wire `session_filter` (T010) into `agent/engine.py`'s main loop (depends on T006, T010): check `is_allowed()` before writing any signal; default `enabled=False`
- [X] T012 [US3] Manually validate per quickstart.md's "Validate User Story 3" section: filtering on with a narrow window suppresses signals, filtering off (or in-window) does not. **Live finding**: two live 120s runs against real BTCUSDT, same conditions — `SESSION_FILTER=on SESSION_WINDOWS="00:00-00:01"` (excludes "now") produced 0 signals; default (filtering off) produced 114 signals over the same duration. No crash, no GAP in either run.

**Checkpoint**: All three user stories independently functional — the engine detects signals, has been proven stable unattended, and respects session rules when a market needs them.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Run the full `--selftest` suite across `agent/` (`normalize.py`, `binance_feed.py`, `tape_reader.py`, `order_flow_analyzer.py`, `session_filter.py`, `engine.py`) and confirm every module passes
- [X] T014 Reconcile `quickstart.md`'s placeholder env var name (`SESSION_FILTER`) with whatever `session_filter.py` actually ended up using (T010/T011), and update `agent/binance_feed.py`'s module docstring's "same event shape as the other feeds" claim if the T002 change altered it. `SESSION_FILTER`/`SESSION_WINDOWS` matched the placeholder as-is; `binance_feed.py`'s claim is about the printed stdout shape, unchanged by T002, so it needed no edit. Also updated quickstart.md's cold-start trade count (100 → 500) and its wrong claim about per-trade logging, both stale after the T007 `MIN_SAMPLES` fix.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational only
- **User Story 2 (Phase 4)**: Depends on Foundational + User Story 1 (T008/T009 need signals to already be produced by T006)
- **User Story 3 (Phase 5)**: Depends on Foundational + User Story 1 (T011 wires into the loop T006 built); independent of User Story 2
- **Polish (Phase 6)**: Depends on all three user stories being complete

### Within Each User Story

- Model/analysis modules (`tape_reader.py`, `order_flow_analyzer.py`, `session_filter.py`) before their wiring task into `engine.py`
- Wiring task before that story's manual validation task

### Parallel Opportunities

- T004 and T005 (independent new files, no import dependency between them — `order_flow_analyzer.py` takes a rank as a plain argument rather than importing `tape_reader.py`)
- T009 alongside T008 (a `--selftest` addition vs. a manual live run — different activities, no shared file being edited at the same moment)
- T010 could start as soon as Foundational is done, in parallel with all of Phase 3/4, since `session_filter.py` has no dependency on `tape_reader.py` or `order_flow_analyzer.py`
- T013 alongside T014 (running selftests vs. editing docs)

---

## Parallel Example: User Story 1

```bash
# T004 and T005 together — independent files:
Task: "Create agent/tape_reader.py per T004"
Task: "Create agent/order_flow_analyzer.py per T005"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (User Story 1)
2. Stop and validate against the live Binance feed (T007)
3. This alone is a working, demonstrable engine — it just doesn't yet prove
   unattended stability (US2) or respect trading sessions (US3)

### Incremental Delivery

1. Setup + Foundational → engine skeleton runs, logs nothing yet
2. + User Story 1 → engine detects and logs real signals (MVP)
3. + User Story 2 → proven stable unattended, proven feed-agnostic
4. + User Story 3 → respects session rules, ready to be pointed at WDO later
5. + Polish → full selftest suite green, docs match reality
