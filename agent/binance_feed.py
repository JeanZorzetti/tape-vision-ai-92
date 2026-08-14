"""
Binance tick feed — validates the tape engine's mechanics while B3 data stays
paywalled (see agent/tick_spike.py for ProfitDLL, agent/mt5_feed.py for why MT5
does not carry WDO/WIN — no Brazilian B3 broker exposes them there; MT5 there is
a forex/CFD product). Binance needs no account, no key, no cost: a public
WebSocket stream of every trade and the best bid/ask, live.

Wrong market (crypto, not B3), right mechanics: real trade prints with real
aggressor side, real book imbalance. Same event shape as the other two feeds —
swap the adapter when the DLL Feed license gets paid, keep the engine.

What's genuinely different from B3, so don't over-fit to it:
  - Binance's own `m` field marks the aggressor directly (server-side truth, no
    tick-rule guessing needed) — B3 feeds won't all be this clean.
  - Crypto trades 24/7, no auction open/close, no circuit breakers.
  - No broker/player id here either, same as MT5. broker=- for schema parity.

Config via env vars:
  SYMBOL   default "btcusdt"  (lowercase, Binance convention)

Run the real thing:      python binance_feed.py
Validate logic offline:  python binance_feed.py --selftest
"""

import asyncio
import json
import os
import sys
import time


def aggression(trade):
    """Binance marks 'm': True when the BUYER is the market maker (SELLER
    was aggressor). This is exchange-reported truth, not a tick-rule guess."""
    return "sell" if trade["m"] else "buy"


def fmt_trade(symbol, trade):
    ts = time.strftime("%H:%M:%S", time.gmtime(trade["T"] / 1000)) + f".{trade['T'] % 1000:03d}"
    return (
        f"[TRADE] {symbol.upper():<8} {ts} "
        f"{float(trade['p']):>12.2f} x {float(trade['q']):<10} "
        f"aggr={aggression(trade):<4} broker=-"
    )


def fmt_book(symbol, book, prev):
    now = (book["b"], book["B"], book["a"], book["A"])
    if now == prev:
        return None, prev  # only print when the top of book actually moves
    line = (
        f"[BOOK ] {symbol.upper():<8} bid {float(book['b']):>12.2f} x {book['B']:<10} "
        f"| ask {float(book['a']):>12.2f} x {book['A']}"
    )
    return line, now


def _selftest():
    """Prove the formatting/aggression logic WITHOUT a network connection."""
    buy = {"T": 1_723_000_000_123, "p": "65000.50", "q": "0.01200", "m": False}
    sell = {"T": 1_723_000_000_500, "p": "65001.00", "q": "0.00300", "m": True}
    assert aggression(buy) == "buy"
    assert aggression(sell) == "sell"

    line = fmt_trade("btcusdt", buy)
    assert "aggr=buy " in line and "broker=-" in line and "BTCUSDT" in line, line

    book1 = {"b": "65000.00", "B": "1.5", "a": "65000.50", "A": "2.0"}
    line, state = fmt_book("btcusdt", book1, prev=None)
    assert line is not None and state == ("65000.00", "1.5", "65000.50", "2.0")

    # Same top of book again: must suppress the duplicate print.
    line2, state2 = fmt_book("btcusdt", book1, prev=state)
    assert line2 is None and state2 == state

    print("selftest OK — trade formatting and book-dedup are coherent")


async def _stream(symbol):
    import websockets  # imported here so --selftest runs without the dependency

    url = f"wss://stream.binance.com:9443/stream?streams={symbol}@trade/{symbol}@bookTicker"
    prev_top = None
    print(f"connecting to {url} ...", flush=True)
    async with websockets.connect(url, ping_interval=20) as ws:
        print(f"connected. streaming {symbol.upper()} (Ctrl+C to stop)...", flush=True)
        async for raw in ws:
            msg = json.loads(raw)["data"]
            if "T" in msg:  # trade event
                print(fmt_trade(symbol, msg), flush=True)
            else:  # bookTicker event
                line, prev_top = fmt_book(symbol, msg, prev_top)
                if line:
                    print(line, flush=True)


def main():
    if "--selftest" in sys.argv:
        _selftest()
        return

    symbol = os.environ.get("SYMBOL", "btcusdt").lower()
    try:
        asyncio.run(_stream(symbol))
    except KeyboardInterrupt:
        print("\nstopped.")


if __name__ == "__main__":
    main()
