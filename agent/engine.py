"""
Tape reading engine — the "motor" from handoff.md §6. Drives binance_feed.events()
in-process, watches for a feed gap, classifies each trade via tape_reader.py and
order_flow_analyzer.py, and emits qualifying signals as JSON Lines (never an
order — see .specify/memory/constitution.md Principle II; there is no code path
from a Signal to any order API anywhere in this module).

The Binance-specific translation from raw feed dict to the feed-agnostic Trade
Event / book sizes (data-model.md) happens right here at the boundary, in `run()`
— tape_reader.py and order_flow_analyzer.py never see a raw Binance field, which
is what keeps FR-008/SC-004 (swap the feed, keep the detection logic) true.

Config via env vars:
  SYMBOL           default "btcusdt"  (lowercase, Binance convention, same as binance_feed.py)
  CUTOFF           default "0.95"     (FR-005a — percentile cutoff that qualifies a signal)
  MIN_SAMPLES      default "500"      (T007 live finding, see below)
  SESSION_FILTER   default "off"      ("on" to enable; FR-007 — off by default, crypto is 24/7)
  SESSION_WINDOWS  default ""         ("HH:MM-HH:MM,HH:MM-HH:MM", local time; used when enabled)

Run the real thing:      python engine.py
Validate logic offline:  python engine.py --selftest
"""

import asyncio
import datetime
import io
import json
import os
import sys
import time

DEFAULT_GAP_TIMEOUT = 10.0  # seconds; FR-010 — this long with no event means "gapped", not "quiet"

# T007 live validation against real BTCUSDT found min_samples=100 (normalize.py's own
# default) too thin: BTCUSDT trade sizes are extremely right-skewed (median ~0.00009,
# p95 ~0.079 — ~900x spread, mostly bot dust), so whichever 100 trades happen to fill
# a fresh window can badly misjudge the true tail — one live run fired on ~100% of
# trades right after warm-up. A 500-trade diagnostic settled to a much saner ~6.5%.
# Not a code bug — the percentile math is correct — the warm-up sample was just too
# small for how skewed this market's size distribution is.
DEFAULT_MIN_SAMPLES = 500


class GapWatchdog:
    """Tracks time since the last feed event; `gapped` goes True once `timeout`
    elapses without a `mark()` call.

    Catches both a hard disconnect and the quieter case of a connection that
    stays open while the exchange stops sending (research.md §3) — only
    `mark()` resets the clock, so idle time alone trips it.
    """

    def __init__(self, timeout=DEFAULT_GAP_TIMEOUT, clock=time.monotonic):
        self.timeout = timeout
        self._clock = clock
        self._last = clock()

    def mark(self):
        self._last = self._clock()

    @property
    def gapped(self):
        return (self._clock() - self._last) > self.timeout


def write_signal(signal, out=sys.stdout):
    """Append one Signal as a JSON Lines record (research.md §4)."""
    out.write(json.dumps(signal) + "\n")
    out.flush()


def _trade_event(symbol, msg, aggression):
    return {
        "instrument": symbol.upper(),
        "price": float(msg["p"]),
        "size": float(msg["q"]),
        "side": aggression(msg),
        "timestamp": msg["T"] / 1000,
    }


def _parse_windows(spec):
    """"HH:MM-HH:MM,HH:MM-HH:MM" -> [(datetime.time, datetime.time), ...]."""
    windows = []
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        start_s, end_s = part.split("-")
        windows.append((
            datetime.datetime.strptime(start_s.strip(), "%H:%M").time(),
            datetime.datetime.strptime(end_s.strip(), "%H:%M").time(),
        ))
    return windows


async def run(symbol, gap_timeout=DEFAULT_GAP_TIMEOUT, source=None, cutoff=None,
               min_samples=None, session_config=None, out=sys.stdout):
    """Main loop: drive binance_feed.events(), suspend on gap, classify each
    trade, write any qualifying signal, and return the final watchdog when the
    feed ends (only happens with a finite `source`, e.g. tests — the live feed
    runs until interrupted).

    The pending `events().__anext__()` task is watched with `asyncio.wait(timeout=)`
    rather than `asyncio.wait_for` — wait_for cancels the awaited coroutine on
    timeout, which would tear down the async generator mid-suspend; `asyncio.wait`
    leaves it pending so the same task can be re-awaited once data resumes. Since
    a signal can only ever be produced right after a fresh `watchdog.mark()`, no
    signal is ever produced while the feed is gapped (FR-010).
    """
    from binance_feed import events, aggression
    from tape_reader import TapeReader
    from order_flow_analyzer import analyze, DEFAULT_CUTOFF
    from session_filter import SessionFilterConfig, is_allowed

    cutoff = DEFAULT_CUTOFF if cutoff is None else cutoff
    min_samples = DEFAULT_MIN_SAMPLES if min_samples is None else min_samples
    session_config = session_config if session_config is not None else SessionFilterConfig()
    reader = TapeReader(min_samples=min_samples)
    bid_size = ask_size = 0.0

    watchdog = GapWatchdog(timeout=gap_timeout)
    stream = events(symbol, source=source)
    next_task = asyncio.ensure_future(stream.__anext__())
    gap_announced = False
    try:
        while True:
            done, _ = await asyncio.wait({next_task}, timeout=gap_timeout)
            if not done:
                if not gap_announced:
                    print(f"[GAP] no event for {gap_timeout:.0f}s — suspending signal emission", flush=True)
                    gap_announced = True
                continue  # keep waiting on the same pending next_task, generator untouched
            try:
                msg = next_task.result()
            except StopAsyncIteration:
                return watchdog
            watchdog.mark()
            gap_announced = False

            if "T" in msg:  # trade event
                trade = _trade_event(symbol, msg, aggression)
                ready, rank = reader.observe(trade)
                signal = analyze(trade, ready, rank, bid_size, ask_size, cutoff=cutoff)
                if signal is not None and is_allowed(session_config, trade["timestamp"]):
                    write_signal(signal, out=out)
            else:  # bookTicker event — remember top-of-book sizes for the next trade
                bid_size = float(msg["B"])
                ask_size = float(msg["A"])

            next_task = asyncio.ensure_future(stream.__anext__())
    finally:
        next_task.cancel()


def _selftest_watchdog():
    now = [0.0]
    wd = GapWatchdog(timeout=5.0, clock=lambda: now[0])
    assert not wd.gapped
    now[0] = 4.0
    assert not wd.gapped
    now[0] = 5.1
    assert wd.gapped
    wd.mark()
    assert not wd.gapped
    print("selftest OK — watchdog flags a gap only after timeout with no mark()")


def _selftest_writer():
    buf = io.StringIO()
    write_signal({"instrument": "BTCUSDT", "direction": "buy", "strength": 0.9}, out=buf)
    write_signal({"instrument": "BTCUSDT", "direction": "sell", "strength": 0.8}, out=buf)
    lines = buf.getvalue().splitlines()
    assert len(lines) == 2, lines
    assert json.loads(lines[0])["direction"] == "buy"
    assert json.loads(lines[1])["direction"] == "sell"
    print("selftest OK — signals are written as one JSON object per line")


def _fake_source(delay=0):
    async def gen():
        msgs = [
            {"T": 1, "p": "100", "q": "1", "m": False},
            {"b": "99", "B": "1", "a": "101", "A": "1"},
        ]
        for m in msgs:
            if delay:
                await asyncio.sleep(delay)
            yield json.dumps({"data": m})
    return gen()


def _selftest_run():
    watchdog = asyncio.run(run("btcusdt", gap_timeout=0.05, source=_fake_source(), min_samples=100))
    assert not watchdog.gapped, "watchdog should be fresh right after the last event"

    import contextlib
    captured = io.StringIO()
    with contextlib.redirect_stdout(captured):
        asyncio.run(run("btcusdt", gap_timeout=0.05, source=_fake_source(delay=0.15), min_samples=100))
    assert "[GAP]" in captured.getvalue(), captured.getvalue()

    print("selftest OK — run() drains a fabricated feed and detects a mid-stream gap")


def _selftest_signal_wiring():
    async def fake_source():
        for i in range(1, 101):  # warm up: 100 ordinary trades (min_samples=100 below)
            yield json.dumps({"data": {"T": i, "p": "100", "q": str(i), "m": False}})
        yield json.dumps({"data": {"b": "100", "B": "8", "a": "101", "A": "2"}})  # bid-heavy book
        yield json.dumps({"data": {"T": 200, "p": "100", "q": "1000", "m": False}})  # trade bigger than all history

    buf = io.StringIO()
    asyncio.run(run("btcusdt", gap_timeout=5.0, source=fake_source(), min_samples=100, out=buf))

    lines = buf.getvalue().splitlines()
    assert len(lines) == 1, lines  # only the one qualifying trade produced a signal
    signal = json.loads(lines[0])
    assert signal["instrument"] == "BTCUSDT" and signal["direction"] == "buy", signal
    assert signal["trigger"]["aggressor_rank"] == 1.0, signal
    assert abs(signal["trigger"]["book_imbalance"] - 0.8) < 1e-9, signal
    assert abs(signal["strength"] - 0.9) < 1e-9, signal  # (1.0 + 0.8) / 2

    print("selftest OK — engine wires tape_reader + order_flow_analyzer end to end into one JSON signal")


def _selftest_feed_independence():
    """FR-008/SC-004: detection must not depend on which feed supplied the data.
    Drives the same underlying trades through two differently-shaped raw sources
    — Binance's (T/p/q/m) and a fabricated unrelated exchange's (ts_ms/px/qty/side)
    — via two independent adapters into the same generic Trade Event shape, and
    confirms tape_reader + order_flow_analyzer produce byte-identical signals.
    """
    from binance_feed import aggression
    from tape_reader import TapeReader
    from order_flow_analyzer import analyze

    raw_binance, raw_other = [], []
    for i in range(1, 120):  # ordinary warm-up trades, varied but unremarkable sizes
        size = float(i % 7 + 1)
        raw_binance.append({"T": i, "p": "100", "q": str(size), "m": False})
        raw_other.append({"ts_ms": i, "px": "100", "qty": size, "side": "buy"})
    raw_binance.append({"T": 200, "p": "100", "q": "1000", "m": False})  # qualifying trade
    raw_other.append({"ts_ms": 200, "px": "100", "qty": 1000.0, "side": "buy"})

    def binance_to_trade(msg):
        return {
            "instrument": "BTCUSDT", "price": float(msg["p"]), "size": float(msg["q"]),
            "side": aggression(msg), "timestamp": msg["T"] / 1000,
        }

    def other_exchange_to_trade(msg):
        """Deliberately differently-shaped adapter — proves detection logic only
        cares about the resulting generic Trade Event, never the raw source."""
        return {
            "instrument": "BTCUSDT", "price": float(msg["px"]), "size": float(msg["qty"]),
            "side": msg["side"], "timestamp": msg["ts_ms"] / 1000,
        }

    def signals_for(raw_msgs, to_trade):
        reader = TapeReader(min_samples=100)
        out_signals = []
        for msg in raw_msgs:
            trade = to_trade(msg)
            ready, rank = reader.observe(trade)
            sig = analyze(trade, ready, rank, bid_size=8, ask_size=2)
            if sig is not None:
                out_signals.append(sig)
        return out_signals

    signals_binance = signals_for(raw_binance, binance_to_trade)
    signals_other = signals_for(raw_other, other_exchange_to_trade)

    assert signals_binance, "the qualifying trade should have produced a signal"
    assert signals_binance == signals_other, (signals_binance, signals_other)

    print("selftest OK — detection logic gives identical signals from two differently-shaped feeds (FR-008)")


def _selftest_session_filter_wiring():
    from session_filter import SessionFilterConfig

    now = time.time()
    now_local = datetime.datetime.fromtimestamp(now)
    in_start = (now_local - datetime.timedelta(minutes=5)).time()
    in_end = (now_local + datetime.timedelta(minutes=5)).time()
    excluded = now_local + datetime.timedelta(hours=6)  # far enough away not to wrap into `in`
    excl_start = (excluded - datetime.timedelta(minutes=5)).time()
    excl_end = (excluded + datetime.timedelta(minutes=5)).time()

    def fake_source():
        async def gen():
            for i in range(1, 101):  # warm up: min_samples=100 below
                yield json.dumps({"data": {"T": int(now * 1000) - (101 - i) * 1000, "p": "100", "q": "1", "m": False}})
            yield json.dumps({"data": {"T": int(now * 1000), "p": "100", "q": "1000", "m": False}})
        return gen()

    # Enabled, window excludes "now": the qualifying trade must not produce a signal.
    buf = io.StringIO()
    asyncio.run(run("btcusdt", gap_timeout=5.0, source=fake_source(), min_samples=100, out=buf,
                     session_config=SessionFilterConfig(enabled=True, windows=[(excl_start, excl_end)])))
    assert buf.getvalue() == "", buf.getvalue()

    # Enabled, window includes "now": the same trade now produces a signal.
    buf = io.StringIO()
    asyncio.run(run("btcusdt", gap_timeout=5.0, source=fake_source(), min_samples=100, out=buf,
                     session_config=SessionFilterConfig(enabled=True, windows=[(in_start, in_end)])))
    assert len(buf.getvalue().splitlines()) == 1, buf.getvalue()

    # Disabled: signal fires regardless of window.
    buf = io.StringIO()
    asyncio.run(run("btcusdt", gap_timeout=5.0, source=fake_source(), min_samples=100, out=buf,
                     session_config=SessionFilterConfig(enabled=False, windows=[(excl_start, excl_end)])))
    assert len(buf.getvalue().splitlines()) == 1, buf.getvalue()

    print("selftest OK — engine suppresses signals outside an enabled session window and respects disabled=always-allowed")


def main():
    if "--selftest" in sys.argv:
        _selftest_watchdog()
        _selftest_writer()
        _selftest_run()
        _selftest_signal_wiring()
        _selftest_feed_independence()
        _selftest_session_filter_wiring()
        return

    from session_filter import SessionFilterConfig

    symbol = os.environ.get("SYMBOL", "btcusdt").lower()
    cutoff = float(os.environ.get("CUTOFF", "0.95"))
    min_samples = int(os.environ.get("MIN_SAMPLES", str(DEFAULT_MIN_SAMPLES)))
    session_config = SessionFilterConfig(
        enabled=os.environ.get("SESSION_FILTER", "off").lower() in ("on", "1", "true"),
        windows=_parse_windows(os.environ.get("SESSION_WINDOWS", "")),
    )
    try:
        asyncio.run(run(symbol, cutoff=cutoff, min_samples=min_samples, session_config=session_config))
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
