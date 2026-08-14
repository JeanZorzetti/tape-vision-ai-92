"""
Per-instrument aggression + rolling percentile ranking (FR-001, FR-002, FR-003).

Consumes the feed-agnostic Trade Event shape from data-model.md (instrument, size,
side, ...) — never touches feed-specific fields like Binance's raw `m`, so a future
non-Binance feed needs no change here (FR-008). `side` is trusted as reported by the
feed adapter (binance_feed.aggression() today); this module only reads it.

Validate offline: python tape_reader.py --selftest
"""

import sys

from normalize import RollingSizes


def aggressor_side(trade):
    """FR-001: aggressor side as reported by the feed — trust it, don't re-derive it."""
    return trade["side"]


class TapeReader:
    """Owns one RollingSizes per instrument; answers 'how unusual is this trade
    relative to recent history?' without it (this trade hasn't happened yet as
    far as the rank is concerned) skewing its own answer."""

    def __init__(self, maxlen=1000, min_samples=100):
        self._maxlen = maxlen
        self._min_samples = min_samples
        self._windows = {}

    def _window(self, instrument):
        window = self._windows.get(instrument)
        if window is None:
            window = RollingSizes(maxlen=self._maxlen, min_samples=self._min_samples)
            self._windows[instrument] = window
        return window

    def observe(self, trade):
        """Feed one Trade Event in. Returns `(ready, rank)`:
        - `ready`: whether the instrument's window had enough history *before*
          this trade to make a rank meaningful (FR-003 cold-start guard).
        - `rank`: this trade's percentile rank against that prior history, or
          `None` when not ready or the size is unusable.

        A missing/zero/negative size is never added to the window — a degenerate
        value must not crash the engine or skew every later percentile (spec.md
        Edge Cases) — and is reported as unranked rather than raising, since a
        bad tick from a live feed must not take the engine down.
        """
        window = self._window(trade["instrument"])
        size = trade.get("size")
        if size is None or size <= 0:
            return window.ready, None
        ready = window.ready
        rank = window.rank(size) if ready else None
        window.add(size)
        return ready, rank


def _selftest():
    assert aggressor_side({"side": "buy"}) == "buy"
    assert aggressor_side({"side": "sell"}) == "sell"

    tr = TapeReader(maxlen=1000, min_samples=100)

    # Cold start: below min_samples, no rank ever claimed.
    ready, rank = tr.observe({"instrument": "BTCUSDT", "size": 500, "side": "buy"})
    assert ready is False and rank is None, (ready, rank)

    for i in range(2, 101):  # 99 more -> 100 samples total (500, 2..100)
        tr.observe({"instrument": "BTCUSDT", "size": i, "side": "sell"})

    # Warmed up now; a known trade against that history gives a real rank.
    ready, rank = tr.observe({"instrument": "BTCUSDT", "size": 50, "side": "buy"})
    assert ready is True and 0.0 < rank < 1.0, (ready, rank)

    # A second instrument starts its own cold window — no cross-contamination.
    ready2, rank2 = tr.observe({"instrument": "ETHUSDT", "size": 10, "side": "buy"})
    assert ready2 is False and rank2 is None, (ready2, rank2)

    # Zero/negative/missing size: no crash, no rank, and never enters the window.
    before = len(tr._window("BTCUSDT")._sorted)
    for bad_size in (0, -5, None):
        ready3, rank3 = tr.observe({"instrument": "BTCUSDT", "size": bad_size, "side": "buy"})
        assert rank3 is None, (bad_size, rank3)
    after = len(tr._window("BTCUSDT")._sorted)
    assert after == before, (before, after)

    print("selftest OK — cold-start guard, percentile rank, and bad-size guard all hold")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__.strip())
