# Feature Specification: Tape Reading Engine (Agent-Side)

**Feature Branch**: `002-tape-reading-engine`

**Created**: 2026-08-14

**Status**: Draft

**Input**: User description: "Construir o motor de tape reading (TapeReader + OrderFlowAnalyzer) dentro de agent/, consumindo os feeds já existentes (binance_feed.py) e a primitiva de normalização (normalize.py) para gerar sinais de trading. Contexto do handoff.md seção 4-6: agente local, só sinal (sem execução automática), motor sai da nuvem e vai para o agente. Validar contra Binance por enquanto (mecânica certa, mercado errado); thresholds do agressor via percentil móvel (RollingSizes de normalize.py), não contagem absoluta. Filtros de sessão (allowedHours, noTradingZones) devem existir mas ficar desligáveis (off para cripto, on para WDO futuro). Esta é a spec 002 do projeto."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-time signal from live order flow (Priority: P1)

A trader runs the local agent while their market feed is connected. As trades and
book updates arrive, the engine watches order flow (trade aggression, size relative
to recent activity, book imbalance) and surfaces a signal the moment it recognizes a
pattern worth the trader's attention — so the trader can decide, in the moment,
whether to act.

**Why this priority**: This is the entire point of the product (handoff §4: "só
sinal"). Without this, there is no engine, just two data feeds sitting idle.

**Independent Test**: Start the engine against a live feed with enough history
already buffered; feed in a trade sized above the current 95th percentile of recent
trade sizes; confirm a signal is emitted with the triggering trade's details attached.

**Acceptance Scenarios**:

1. **Given** the engine's rolling size window has enough samples to be statistically
   meaningful, **When** a trade arrives whose size ranks at or above the configured
   percentile cutoff (default: 95th) of recent trades and has a clear aggressor
   side, **Then** the engine emits one signal carrying instrument, suggested
   direction, a strength value, and a timestamp.
2. **Given** the rolling size window has not yet collected enough samples (cold
   start), **When** any trade arrives, **Then** no signal is emitted, regardless of
   that trade's size.
3. **Given** a signal was just emitted, **When** the next several ordinary-sized
   trades arrive, **Then** no further signals are emitted until order flow again
   meets the criteria.

---

### User Story 2 - Validate the engine without paying for market data (Priority: P2)

The project cannot yet afford the paid B3 data license (handoff §5). Before that
money is spent, the operator needs to know the engine's logic actually works —
correct aggressor classification, sane signal cadence, no crashes — using a feed
that costs nothing.

**Why this priority**: This is what unblocks all further work on the engine today;
everything about B3/WDO is gated on money the project doesn't have yet, but the
mechanics can be proven now.

**Independent Test**: Run the engine against the Binance feed for an extended
session (hours, unattended); afterward, read the signal log and confirm behavior
was sane (no crash, no signal flood, nothing during cold start) without needing any
B3 data or license.

**Acceptance Scenarios**:

1. **Given** the engine is running against the Binance feed, **When** the session
   ends, **Then** a log exists showing every signal emitted, each traceable to the
   specific trade/book event and rule that triggered it.
2. **Given** the same engine logic, **When** the input feed is swapped for a
   different market's feed that emits the same event shape, **Then** the engine
   requires no change to its signal-detection logic to keep working.

---

### User Story 3 - Session filtering that fits the instrument (Priority: P3)

Crypto trades 24/7 with no auction and no circuit breaker; B3/WDO has a defined
trading session and blackout windows around open/close. The trader needs signal
generation to respect the current instrument's session rules — or explicitly ignore
them when the instrument has none.

**Why this priority**: Lower priority than P1/P2 because it doesn't block validating
the engine on Binance (session filtering can stay off there), but it must exist
before the engine is ever pointed at WDO, or every open/close will misfire signals.

**Independent Test**: Configure a trading window and enable session filtering;
confirm a qualifying trade outside that window produces no signal. Disable session
filtering; confirm a qualifying trade at any hour does produce a signal.

**Acceptance Scenarios**:

1. **Given** session filtering is enabled with a defined trading window, **When** a
   trade that would otherwise qualify occurs outside that window, **Then** no signal
   is emitted.
2. **Given** session filtering is disabled, **When** a qualifying trade occurs at any
   hour, **Then** a signal is emitted exactly as it would be with filtering enabled
   and in-window.

---

### Edge Cases

- What happens when the feed disconnects mid-session? The engine MUST NOT keep
  emitting signals based on stale data; it must recognize the gap and suspend
  signal emission until fresh data resumes.
- What happens during the cold-start window, before the rolling size measure has
  enough samples? No signal may be emitted — a half-filled window reading "unusual"
  is a false positive, not a real one (this is exactly the failure mode
  `normalize.py`'s `ready` flag exists to prevent).
- What happens when a trade event carries a missing or zero size? The engine must
  not crash and must not let a degenerate value corrupt the rolling measure.
- What happens during a burst of many trades in a very short time? Signals must
  reflect current market state, not a backlog processed after the fact — the engine
  must keep pace with the live feed rather than fall progressively behind it.
- What happens when the feed cannot report a reliable aggressor side (a future,
  noisier data source)? The engine must not silently guess and label it as fact —
  see Assumptions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The engine MUST classify each incoming trade by aggressor side
  (buy/sell) using the side reported by the feed.
- **FR-002**: The engine MUST judge how unusual a trade's size is using a rolling,
  market-neutral measure (percentile-based) rather than an absolute count, so the
  same logic produces meaningful results on instruments of wildly different scale
  (e.g., WDO contracts vs. BTC fractional units).
- **FR-003**: The engine MUST withhold all signals until its rolling size measure has
  collected enough samples to be statistically meaningful (cold-start guard).
- **FR-004**: The engine MUST factor order-book imbalance (bid side vs. ask side)
  into signal detection as an input alongside trade aggression, not as a
  replacement for it.
- **FR-005**: The engine MUST emit a signal (not an order) containing at minimum:
  instrument, suggested direction, a strength value, and a timestamp. The strength
  value MUST be defined by an explicit, documented formula over its inputs
  (percentile rank and book imbalance) and MUST NOT be presented as a calibrated
  probability of the trade being profitable — no such calibration is possible
  without outcome data the project does not have.
- **FR-005a**: The percentile cutoff that qualifies a trade as aggressive MUST be
  configurable, defaulting to the 95th percentile.
- **FR-006**: The engine MUST NOT place, modify, or cancel any order under any
  condition — it is signal-only, per the product decision that a human always
  sends the order (handoff §4).
- **FR-007**: Session-based filtering (allowed trading hours, no-trading zones)
  MUST be configurable and independently togglable per market — off by default for
  24/7 markets (crypto), on for session-based markets (B3/WDO).
- **FR-008**: The engine's signal-detection logic MUST be independent of which feed
  supplies the data, so the Binance feed used today can be swapped for the future
  B3 feed without rewriting the detection logic itself.
- **FR-009**: The engine MUST log every signal it emits, together with enough
  detail (contributing trade/book event, aggressor side, rolling-percentile rank)
  for a person to understand after the fact why that specific signal fired.
- **FR-010**: When the feed stops delivering data (disconnect or unexplained gap),
  the engine MUST detect the gap and suspend signal emission until data resumes,
  rather than act on stale state.

### Key Entities

- **Trade Event**: A single executed trade — instrument, price, size, aggressor
  side, and timestamp.
- **Book Update**: A change to the best bid/ask (price and size on each side) for
  an instrument at a point in time.
- **Rolling Size Window**: The recent history of trade sizes for an instrument,
  used to answer "how unusual is this trade?" in percentile terms rather than an
  absolute count. Not itself exposed to the trader — an internal input to signals.
- **Signal**: The engine's output — instrument, suggested direction (buy/sell),
  strength, timestamp, and the trade/book event(s) that triggered it.
- **Session Filter Config**: Per-market rules describing whether session filtering
  is active, and if so, the allowed trading window(s) and blackout zones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The engine runs continuously against the live Binance feed for a full
  multi-hour session without crashing or losing its connection unrecoverably.
- **SC-002**: Zero signals are emitted during the cold-start window before the
  rolling size measure has enough samples — verifiable by inspecting the signal log
  against the configured minimum sample count.
- **SC-003**: For any signal in the log, a reviewer can identify which trade/book
  event and which rule triggered it without reading the engine's source code.
- **SC-004**: Swapping the input feed (crypto today, B3/WDO in the future) requires
  changing only the feed adapter — zero changes to the signal-detection logic.
- **SC-005**: With session filtering off, signals occur at any hour; with it on and
  a trading window configured, zero signals occur outside that window.

## Assumptions

- The engine consumes the existing `agent/binance_feed.py` (or a future adapter
  emitting the same trade/book event shape) and `agent/normalize.py`'s
  `RollingSizes` — this feature does not re-implement feed connectivity or the
  rolling-percentile primitive, both already exist and are validated.
- The default percentile cutoff (95th, per FR-005a) is a starting point, not a
  calibrated value — per handoff §5, real calibration can only happen against B3/WDO
  history, which isn't available yet. It comes from the one live measurement the
  project does have: over 400 BTCUSDT trades, a p95 cutoff fired 3 times while the
  old absolute threshold fired 0.
- Likewise, the strength value (FR-005) is an ordering heuristic — useful for "this
  signal is stronger than that one" — not a probability. Nothing in this feature can
  validate it against trade outcomes, because the system never places a trade.
- The engine currently trusts the feed's reported aggressor side as ground truth.
  Binance reports this directly and reliably; per handoff §5's still-open trap, a
  future, noisier feed (ProfitDLL) may not be as clean — that adaptation is out of
  scope for this feature and will be handled when that feed exists.
- No order execution, position tracking, or risk/stop-loss logic is in scope — the
  product decision is signal-only (handoff §4); a human always places the trade.
- One instrument at a time is sufficient for this feature; a multi-symbol/portfolio
  view is not required.
- The engine runs on the same local Windows machine as the rest of the agent (per
  handoff §4's local-agent product decision) — no cloud deployment target for this
  feature.
- Signal delivery to the trader reuses the same modality the existing feed scripts
  already use (a readable, timestamped log/console stream) — a richer delivery
  surface (desktop notification, UI panel) is potential future work, not required
  here.
- Order-book imbalance (FR-004) uses the best bid/ask currently exposed by the feed
  (top of book); deeper book levels are not required for this feature.
