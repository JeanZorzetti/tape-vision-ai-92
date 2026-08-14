"""
Combines a trade's percentile rank with top-of-book imbalance into a Signal, or
None (FR-004, FR-005, FR-005a).

Pure function: no state, no I/O, no knowledge of the feed adapter. Everything it
needs is passed in, which is what keeps signal detection itself feed-agnostic
(FR-008/SC-004) — this module never sees a raw feed message, only the normalized
Trade Event / rank / book sizes data-model.md defines.

Validate offline: python order_flow_analyzer.py --selftest
"""

import sys

# FR-005a — the one live measurement this project has (handoff.md §5): over 400
# BTCUSDT trades, a p95 cutoff fired 3 times while the old absolute threshold
# fired 0. Not calibrated; real calibration needs B3/WDO history, which doesn't
# exist yet.
DEFAULT_CUTOFF = 0.95


def analyze(trade, ready, aggressor_rank, bid_size, ask_size, cutoff=DEFAULT_CUTOFF):
    """Returns a Signal dict (data-model.md), or None if this trade doesn't qualify.

    `trade` is a Trade Event — must carry `instrument`, `side`, `timestamp`.
    `ready`/`aggressor_rank` come from `tape_reader.TapeReader.observe()`.
    `bid_size`/`ask_size` are the current top-of-book sizes (Book Update).
    No signal is produced while `ready` is False (FR-003 cold-start guard) or
    while `aggressor_rank` is below `cutoff`.
    """
    if not ready or aggressor_rank is None or aggressor_rank < cutoff:
        return None

    direction = trade["side"]
    book_total = bid_size + ask_size
    bid_ratio = bid_size / book_total if book_total else 0.0
    directional_imbalance = bid_ratio if direction == "buy" else 1.0 - bid_ratio
    # Flat mean, no tuned weights — named `strength` not `confidence` because
    # nothing here calibrates it against outcomes (data-model.md Signal).
    strength = (aggressor_rank + directional_imbalance) / 2

    return {
        "instrument": trade["instrument"],
        "direction": direction,
        "strength": strength,
        "timestamp": trade["timestamp"],
        "trigger": {
            "aggressor_rank": aggressor_rank,
            "book_imbalance": bid_ratio,
            "cutoff": cutoff,
            "trade": trade,
        },
    }


def _selftest():
    trade_buy = {"instrument": "BTCUSDT", "side": "buy", "timestamp": 1000.0}

    # Cold-start guard (FR-003): not ready -> no signal, regardless of rank.
    assert analyze(trade_buy, ready=False, aggressor_rank=0.99, bid_size=10, ask_size=1) is None

    # Cutoff boundary: at-or-above fires, just below does not.
    assert analyze(trade_buy, ready=True, aggressor_rank=0.95, bid_size=1, ask_size=1, cutoff=0.95) is not None
    assert analyze(trade_buy, ready=True, aggressor_rank=0.9499, bid_size=1, ask_size=1, cutoff=0.95) is None

    # Known imbalance math, buy side: bid_ratio = 8/(8+2) = 0.8.
    sig = analyze(trade_buy, ready=True, aggressor_rank=1.0, bid_size=8, ask_size=2, cutoff=0.95)
    assert sig["direction"] == "buy"
    assert abs(sig["trigger"]["book_imbalance"] - 0.8) < 1e-9, sig
    assert abs(sig["strength"] - (1.0 + 0.8) / 2) < 1e-9, sig
    assert sig["trigger"]["cutoff"] == 0.95 and sig["trigger"]["trade"] == trade_buy

    # Sell side: directional_imbalance is 1 - bid_ratio, not bid_ratio itself.
    trade_sell = {"instrument": "BTCUSDT", "side": "sell", "timestamp": 1001.0}
    sig_sell = analyze(trade_sell, ready=True, aggressor_rank=1.0, bid_size=8, ask_size=2, cutoff=0.95)
    assert abs(sig_sell["strength"] - (1.0 + 0.2) / 2) < 1e-9, sig_sell

    # Empty book on both sides must not raise ZeroDivisionError.
    sig_empty = analyze(trade_buy, ready=True, aggressor_rank=1.0, bid_size=0, ask_size=0, cutoff=0.95)
    assert sig_empty["trigger"]["book_imbalance"] == 0.0

    print("selftest OK — cold-start guard, cutoff boundary, and imbalance math all hold")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__.strip())
