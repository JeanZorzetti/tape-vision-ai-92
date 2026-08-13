"""
MT5 tick feed — the free stand-in for ProfitDLL (see agent/tick_spike.py).

Same job as the spike: prove REAL WDO/WIN ticks reach us and print them. The only
difference is the price: R$ 0. MetaTrader 5 ships free with B3 real-time data from
most Brazilian brokers (Rico, Clear, XP, Genial, Modal), and its Python API exposes
times & trades plus the L2 book — everything the tape engine needs except one field.

What MT5 does NOT give: the aggressor broker id (ProfitDLL's buy_agent/sell_agent).
Trades print broker=- so the event shape stays stable if the ProfitDLL driver ever
comes back with a license. Aggression side is derived here instead (see aggression()).

Setup (once):
  1. Install MetaTrader 5 from your broker, log in, add the ticker to Market Watch.
  2. pip install MetaTrader5      (Windows only, 64-bit Python)
  3. Leave the terminal RUNNING — this attaches to it, it does not log in itself.

Config via env vars:
  TICKER   default "WDOU26"   (front-month mini dollar; check the live contract)
  POLL_MS  default 100

Run the real thing:      python mt5_feed.py
Validate logic offline:  python mt5_feed.py --selftest
"""

import os
import sys
import time

# MT5 constants, copied so --selftest runs without the package installed.
TICK_FLAG_BID = 0x02
TICK_FLAG_ASK = 0x04
TICK_FLAG_LAST = 0x08
TICK_FLAG_BUY = 0x20
TICK_FLAG_SELL = 0x40
BOOK_TYPE_SELL = 1
BOOK_TYPE_BUY = 2


def new_ticks(batch, last_msc, n_at_last):
    """Drop the ticks this poll re-delivered.

    copy_ticks_from() only resolves to the second, so every poll hands back the whole
    millisecond we stopped in. Skipping by timestamp alone would eat the other trades
    printed in that same millisecond — which on WDO is exactly where the aggression
    bursts live. So we also carry how many we already consumed at that timestamp.

    Returns (fresh_ticks, last_msc, n_at_last) — feed the last two back in next poll.
    """
    skip = n_at_last
    fresh = []
    for t in batch:
        msc = int(t["time_msc"])
        if msc < last_msc:
            continue
        if msc == last_msc and skip > 0:
            skip -= 1
            continue
        fresh.append(t)

    if not fresh:
        return [], last_msc, n_at_last

    newest = int(fresh[-1]["time_msc"])
    count = sum(1 for t in fresh if int(t["time_msc"]) == newest)
    if newest == last_msc:
        count += n_at_last
    return fresh, newest, count


def aggression(tick, bid, ask):
    """Which side crossed the spread: 'buy', 'sell' or '?'."""
    flags = int(tick["flags"])
    if flags & TICK_FLAG_BUY:
        return "buy"
    if flags & TICK_FLAG_SELL:
        return "sell"
    # ponytail: fallback tick rule, because not every broker populates BUY/SELL on B3.
    # At-or-above the ask is buyer-aggressed, at-or-below the bid seller-aggressed.
    # Mid-spread trades stay '?' instead of guessing. If '?' dominates a session log,
    # the spread is stale — widen the book poll before trusting the classification.
    last = float(tick["last"])
    if ask and last >= ask:
        return "buy"
    if bid and last <= bid:
        return "sell"
    return "?"


def _clock(msc):
    # Broker server time, not local — gmtime keeps it from being shifted twice.
    return time.strftime("%H:%M:%S", time.gmtime(msc // 1000)) + f".{msc % 1000:03d}"


def _selftest():
    """Prove the dedup and the aggression rule WITHOUT MetaTrader5 installed."""
    def T(msc, last, flags=TICK_FLAG_LAST, bid=0.0, ask=0.0):
        return {"time_msc": msc, "last": last, "bid": bid, "ask": ask, "flags": flags}

    # Poll 1: two trades share the newest millisecond — both must come through.
    batch = [T(1000, 5.0), T(1500, 5.1), T(1500, 5.2)]
    fresh, msc, n = new_ticks(batch, 1000, 0)
    assert [t["last"] for t in fresh] == [5.0, 5.1, 5.2], fresh
    assert (msc, n) == (1500, 2), (msc, n)

    # Poll 2: same batch redelivered, nothing new. Must emit nothing, state unchanged.
    fresh, msc, n = new_ticks(batch, msc, n)
    assert fresh == [] and (msc, n) == (1500, 2), (fresh, msc, n)

    # Poll 3: a third trade lands in that same millisecond, plus a later one.
    fresh, msc, n = new_ticks(batch + [T(1500, 5.3), T(2200, 5.4)], msc, n)
    assert [t["last"] for t in fresh] == [5.3, 5.4], fresh
    assert (msc, n) == (2200, 1), (msc, n)

    # Explicit flags win over prices.
    assert aggression(T(1, 5.0, TICK_FLAG_BUY), bid=9.0, ask=9.5) == "buy"
    assert aggression(T(1, 9.9, TICK_FLAG_SELL), bid=9.0, ask=9.5) == "sell"
    # No flags: fall back to where the trade printed relative to the spread.
    assert aggression(T(1, 9.5), bid=9.0, ask=9.5) == "buy"
    assert aggression(T(1, 9.0), bid=9.0, ask=9.5) == "sell"
    assert aggression(T(1, 9.2), bid=9.0, ask=9.5) == "?"
    assert aggression(T(1, 9.2), bid=0.0, ask=0.0) == "?"  # no book yet

    print("selftest OK — tick dedup and aggression rule are coherent")


def main():
    if "--selftest" in sys.argv:
        _selftest()
        return

    ticker = os.environ.get("TICKER", "WDOU26")
    poll = int(os.environ.get("POLL_MS", "100")) / 1000

    import MetaTrader5 as mt5  # Windows-only; imported here so --selftest runs anywhere

    if not mt5.initialize():
        sys.exit(f"MT5 initialize failed: {mt5.last_error()} — terminal running and logged in?")

    try:
        if mt5.symbol_info(ticker) is None:
            sys.exit(f"{ticker} unknown to this broker — check the contract month.")
        if not mt5.symbol_select(ticker, True):
            sys.exit(f"symbol_select({ticker}) failed: {mt5.last_error()}")
        has_book = mt5.market_book_add(ticker)
        if not has_book:
            print(f"market_book_add failed: {mt5.last_error()} — trades only, no L2", flush=True)

        seed = mt5.symbol_info_tick(ticker)
        if seed is None:
            sys.exit(f"no tick for {ticker} — market closed, or no data permission on this account.")

        last_msc, n_at_last = int(seed.time_msc), 0
        bid = ask = 0.0
        top = None
        print(f"attached. streaming {ticker} (Ctrl+C to stop)...", flush=True)

        while True:
            batch = mt5.copy_ticks_from(ticker, last_msc // 1000, 10_000, mt5.COPY_TICKS_ALL)
            if batch is not None and len(batch):
                fresh, last_msc, n_at_last = new_ticks(batch, last_msc, n_at_last)
                for t in fresh:
                    if t["bid"]:
                        bid = float(t["bid"])
                    if t["ask"]:
                        ask = float(t["ask"])
                    if int(t["flags"]) & TICK_FLAG_LAST:
                        print(
                            f"[TRADE] {ticker:<8} {_clock(int(t['time_msc']))} "
                            f"{float(t['last']):>10.2f} x {int(t['volume']):<5} "
                            f"aggr={aggression(t, bid, ask):<4} broker=-",
                            flush=True,
                        )

            if has_book:
                book = mt5.market_book_get(ticker) or ()
                best_bid = max((b for b in book if b.type == BOOK_TYPE_BUY),
                               key=lambda b: b.price, default=None)
                best_ask = min((b for b in book if b.type == BOOK_TYPE_SELL),
                               key=lambda b: b.price, default=None)
                if best_bid and best_ask:
                    now = (best_bid.price, best_bid.volume, best_ask.price, best_ask.volume)
                    if now != top:  # only print when the top of book actually moves
                        top = now
                        print(
                            f"[BOOK ] {ticker:<8} bid {now[0]:>10.2f} x {now[1]:<5} "
                            f"| ask {now[2]:>10.2f} x {now[3]}",
                            flush=True,
                        )

            time.sleep(poll)

    except KeyboardInterrupt:
        print("\nstopped.")
    finally:
        mt5.market_book_release(ticker)
        mt5.shutdown()


if __name__ == "__main__":
    main()
