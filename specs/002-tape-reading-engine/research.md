# Phase 0 Research: Tape Reading Engine (Agent-Side)

No `NEEDS CLARIFICATION` markers remained in the Technical Context — every decision
below had enough grounding in existing code (`agent/normalize.py`,
`agent/binance_feed.py`) or the handoff to resolve directly. Documented here for the
same reason the spec documents its assumptions: so the next reader doesn't re-litigate
a decision that was already made deliberately.

## 1. How does the engine receive events from the feed?

**Decision**: In-process, direct function call/async generator. `engine.py` imports
`binance_feed` and drives its stream loop directly, receiving parsed trade/book
dicts as Python objects.

**Rationale**: Everything runs in one asyncio event loop on one local machine —
there is no process boundary to cross. `binance_feed.py`'s `_stream()` already
parses each WebSocket message into a dict (`json.loads(raw)["data"]`) before
formatting it for print; that parsed dict is the natural hand-off point.

**Alternatives considered**:
- *Parse the printed stdout lines from a separate `binance_feed.py` process* —
  rejected: turns a structured dict back into a string and then re-parses it,
  strictly worse than importing the module, and fragile if the print format ever
  changes.
- *A queue/IPC layer (multiprocessing.Queue, a local socket)* — rejected: no
  multi-process requirement exists yet (single instrument, single trader,
  single machine); would be infrastructure for a scaling problem this feature
  doesn't have.

## 2. How does `binance_feed.py` change to support this, without breaking its
   existing standalone use?

**Decision**: Extract the already-parsed trade/book dict one level earlier and let
the caller optionally supply a handler, defaulting to the existing print behavior
so `python binance_feed.py` on its own keeps working unchanged.

**Rationale**: Smallest diff that satisfies FR-008/SC-004 ("swapping the feed
requires no change to detection logic") without touching the parts of
`binance_feed.py` that are already validated (`aggression()`, `fmt_trade()`,
`fmt_book()`, the `--selftest`).

**Alternatives considered**:
- *Rewrite `binance_feed.py` as a class-based feed abstraction shared with
  `tick_spike.py`/`mt5_feed.py`* — rejected: those two feeds aren't in scope for
  this feature (one is license-gated, one is a dead end per handoff §5), and
  building a shared abstraction for three feeds when only one is actually usable
  today is exactly the speculative flexibility ponytail's ladder says to skip.

## 3. How does the engine detect a feed gap (spec edge case, FR-010)?

**Decision**: Track wall-clock time of the last received event (`time.monotonic()`);
if no event arrives within a configurable timeout, treat the feed as gapped and
suspend signal emission until a new event arrives.

**Rationale**: Catches both hard disconnects (the `websockets` library already
raises on those) and the quieter case of "still connected, but the exchange stopped
sending" — e.g. the WebSocket ping/pong stays alive but no trade prints. A
monotonic-clock watchdog catches both without needing feed-specific disconnect
hooks, so it stays valid when the feed is swapped later.

**Alternatives considered**:
- *Rely solely on `websockets`' own reconnect/exception behavior* — rejected: does
  not cover a silently-idle-but-connected stream, which is a real and distinct
  failure mode from a dropped socket.

## 4. Signal log format

**Decision**: One JSON object per line (JSON Lines) written to stdout, containing
the fields from the `Signal` entity (see `data-model.md`).

**Rationale**: Same amount of code as a hand-formatted string (stdlib `json.dumps`
call), but stays machine-parseable if anything downstream ever wants to read the
log — directly satisfies SC-003 ("a reviewer can identify why a signal fired
without reading source") better than a free-form string would, for no extra cost.

**Alternatives considered**:
- *Human-formatted string, matching `fmt_trade`/`fmt_book`'s style* — viable and
  almost as cheap, but loses parseability for a difference of a few characters;
  JSON Lines wins on the "two stdlib options, same size, pick the one correct on
  edge cases" rule.

## 5. Book imbalance formula

**Decision**: `bid_size / (bid_size + ask_size)` from the top-of-book fields
`binance_feed.py` already receives (`B`/`A` from the `bookTicker` stream).

**Rationale**: Spec Assumptions explicitly scope this feature to top-of-book, not
full L2 depth. The ratio is the simplest measure that answers "which side is
heavier right now," and it's already dimensionless (0..1), which composes cleanly
with the rolling-percentile rank from `normalize.py` into a single confidence value.

**Alternatives considered**:
- *Depth-weighted imbalance across multiple book levels* — rejected per spec scope;
  `binance_feed.py` doesn't subscribe to depth-of-book today and adding that stream
  is not required by any FR in this feature.

## 6. Session filter representation

**Decision**: A small config object — `enabled: bool` plus a list of
`(start: datetime.time, end: datetime.time)` windows in local time — using only
`datetime` from the standard library.

**Rationale**: FR-007 needs "on/off per market" plus a window check; `datetime.time`
comparison is sufficient and needs no new dependency (no `pytz`/`zoneinfo`
complexity — single-machine, single-timezone use per the spec's scope).

**Alternatives considered**:
- *Cron-like expression or a rules DSL* — rejected: no requirement calls for more
  than "is now inside one of these windows," and a DSL would be solving a
  configurability problem nobody asked for.
