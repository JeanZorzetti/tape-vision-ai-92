"""
Rolling size normalization — makes a threshold mean the same thing on WDO and BTC.

The problem this exists to kill: every volume threshold in Backend/config/trading.json
is an absolute count written for WDO contracts — volumeClusterSize 1000, minVolume 500,
aggressiveOrderThreshold 1000, minLiquidity 10000, unusualVolume 5000. A real BTCUSDT
print is 0.00023. Those numbers are off by six orders of magnitude, so anything tuned
against the Binance feed would teach us something false about WDO and look like a result
while doing it.

Fix: stop asking "is this trade bigger than 1000?" and start asking "is this trade bigger
than 95% of what just traded here?". A percentile carries across markets; a count does not.
Same question, and it survives the swap from crypto back to B3.

What this does NOT fix — do not let it fool you. Only the *scale* transfers. Microstructure
does not: crypto runs 24/7 with no auction and no circuit breaker, so session filters
(trading.json's allowedHours / noTradingZones) stay B3-specific and must be off for crypto,
not retuned. Calibrate the actual percentile cutoffs against B3 history, never against
Binance.

Validate offline:  python normalize.py --selftest
"""

import bisect
import sys
from collections import deque


class RollingSizes:
    """Recent trade sizes, answering 'how unusual is this one?' in market-neutral terms.

    min_samples is the real knob: a percentile over 8 trades is noise wearing a number's
    clothes. Until the window fills to min_samples, `ready` is False and the engine should
    hold rather than signal — the first minute after open is exactly when a half-empty
    window screams 'unusual' at perfectly ordinary flow.
    """

    def __init__(self, maxlen=1000, min_samples=100):
        if min_samples > maxlen:
            raise ValueError("min_samples cannot exceed maxlen")
        self._recent = deque(maxlen=maxlen)
        self._sorted = []
        self.min_samples = min_samples

    def add(self, size):
        # Read the about-to-be-evicted item BEFORE appending — a full deque drops it
        # silently on append, and the sorted mirror would drift out of sync forever.
        if len(self._recent) == self._recent.maxlen:
            oldest = self._recent[0]
            self._sorted.pop(bisect.bisect_left(self._sorted, oldest))
        self._recent.append(size)
        bisect.insort(self._sorted, size)

    @property
    def ready(self):
        return len(self._sorted) >= self.min_samples

    def rank(self, size):
        """0..1 — the fraction of recent trades this size is strictly larger than.

        Replaces every absolute volume threshold: `rank(size) >= 0.95` is the portable
        spelling of "aggressive order", on any instrument.
        """
        if not self._sorted:
            return 0.0
        return bisect.bisect_left(self._sorted, size) / len(self._sorted)

    def median(self):
        n = len(self._sorted)
        if not n:
            return 0.0
        mid = n // 2
        if n % 2:
            return self._sorted[mid]
        return (self._sorted[mid - 1] + self._sorted[mid]) / 2

    def ratio(self, size):
        """size / median — 'this print is 8x normal'. Reads better than a percentile in
        logs and alerts, and unlike rank() it keeps growing for true outliers instead of
        saturating at 1.0."""
        med = self.median()
        return size / med if med else 0.0


def _selftest():
    w = RollingSizes(maxlen=1000, min_samples=100)

    # Cold window: never claim significance from nothing.
    assert not w.ready and w.rank(999) == 0.0 and w.median() == 0.0 and w.ratio(5) == 0.0

    for i in range(1, 101):
        w.add(i)
    assert w.ready, "100 samples with min_samples=100 must be ready"
    assert w.median() == 50.5, w.median()
    assert w.rank(1) == 0.0            # nothing is smaller
    assert w.rank(101) == 1.0          # bigger than everything
    assert w.rank(51) == 0.50, w.rank(51)
    assert w.ratio(101) == 2.0, w.ratio(101)

    # The whole point: identical shape at a wildly different scale gives identical answers.
    tiny = RollingSizes(maxlen=1000, min_samples=100)
    for i in range(1, 101):
        tiny.add(i * 0.00001)          # BTC-sized prints
    assert tiny.rank(51 * 0.00001) == w.rank(51)
    assert abs(tiny.ratio(101 * 0.00001) - w.ratio(101)) < 1e-9

    # Eviction keeps the sorted mirror honest, including when the evicted value repeats.
    e = RollingSizes(maxlen=3, min_samples=1)
    for v in (1, 2, 3, 4):
        e.add(v)
    assert e._sorted == [2, 3, 4], e._sorted
    d = RollingSizes(maxlen=3, min_samples=1)
    for v in (5, 5, 5, 9):
        d.add(v)
    assert d._sorted == [5, 5, 9], d._sorted   # one 5 dropped, not all of them

    # Out-of-order arrival must not corrupt eviction (tape is not sorted by size).
    o = RollingSizes(maxlen=3, min_samples=1)
    for v in (9, 1, 5, 7):
        o.add(v)
    assert o._sorted == [1, 5, 7], o._sorted

    try:
        RollingSizes(maxlen=10, min_samples=50)
    except ValueError:
        pass
    else:
        raise AssertionError("min_samples > maxlen must raise")

    print("selftest OK — rolling percentile is scale-invariant and evicts correctly")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__.strip())
