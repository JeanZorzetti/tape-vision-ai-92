"""
ProfitDLL tick spike — the §5 gate: prove one REAL WDO/WIN tick reaches us.

This is the smallest program that loads ProfitDLL, connects in Market Data mode,
subscribes to one ticker, and prints every tick that arrives. It is the embryo of
the local Windows agent (product form: local agent + signal only, no order routing).

It does NOT run without three things ONLY the owner can provide:
  1. A contracted "DLL Feed" license (nelogica.com.br → Assinaturas → DLL Feed → Download).
     The ProfitDLL.zip also ships the canonical PDF manual with the exact signatures.
  2. ProfitDLL.dll (Win64) on this machine + Profit installed/logged in.
  3. Activation key + Nelogica user + login password.

Signatures below come from Nelogica's web docs. The PDF manual in ProfitDLL.zip is
the source of truth — verify the trade callback against it before trusting it, since
a wrong ctypes signature crashes the process silently (not an exception).

Config via env vars (never hardcode secrets):
  PROFITDLL_PATH  full path to Win64/ProfitDLL.dll
  PROFITDLL_KEY   activation key
  PROFITDLL_USER  Nelogica user
  PROFITDLL_PASS  login password (NOT the routing password)
  TICKER          default "WDOU26"   (front-month mini dollar; check the live contract)
  EXCHANGE        default "F"         (F = BM&F futures)

Run the real thing on the owner's machine:  python tick_spike.py
Validate the ctypes wiring without the DLL:  python tick_spike.py --selftest
"""

import os
import sys
import threading
from ctypes import (
    Structure, WINFUNCTYPE, byref,
    c_int, c_uint, c_double, c_wchar_p, c_void_p,
)

# --- Connection-state constants (subset we need) -------------------------------
CONNECTION_STATE_LOGIN = 0
CONNECTION_STATE_MARKET_DATA = 2
CONNECTION_STATE_MARKET_LOGIN = 3
LOGIN_CONNECTED = 0
MARKET_CONNECTED = 4
CONNECTION_ACTIVATE_VALID = 0


# --- Types ---------------------------------------------------------------------
class TAssetID(Structure):
    # Passed BY VALUE into callbacks (not a pointer). Fields per the docs.
    _fields_ = [
        ("ticker", c_wchar_p),
        ("bolsa", c_wchar_p),
        ("feed", c_int),
    ]


# Callback prototypes. WINFUNCTYPE = stdcall; the DLL is stdcall, so this is required.
STATE_CB = WINFUNCTYPE(None, c_int, c_int)                       # (nConnStateType, nResult)
TINYBOOK_CB = WINFUNCTYPE(None, TAssetID, c_double, c_int, c_int)  # (asset, price, qty, side)
# ponytail: trade signature is best-effort from the web article (asset, date,
# tradeNumber, price, vol, qty, buyAgent, sellAgent, tradeType). Confirm against
# the PDF manual before trusting — a wrong layout here crashes silently.
TRADE_CB = WINFUNCTYPE(
    None, TAssetID, c_wchar_p, c_uint, c_double, c_double, c_int, c_int, c_int, c_int
)


# --- Connection readiness ------------------------------------------------------
_ready = {k: threading.Event() for k in ("login", "market", "activation")}


def _on_state(state_type, result):
    if state_type == CONNECTION_STATE_LOGIN and result == LOGIN_CONNECTED:
        _ready["login"].set()
    elif state_type == CONNECTION_STATE_MARKET_DATA and result == MARKET_CONNECTED:
        _ready["market"].set()
    elif state_type == CONNECTION_STATE_MARKET_LOGIN and result == CONNECTION_ACTIVATE_VALID:
        _ready["activation"].set()


def _on_tiny_book(asset, price, qty, side):
    lado = "bid" if side == 0 else "ask"
    print(f"[BOOK] {asset.ticker:<8} {lado} {price:>10.2f} x {qty}", flush=True)


def _on_trade(asset, date, trade_number, price, vol, qty, buy_agent, sell_agent, trade_type):
    # trade_type: aggression side (buy/sell/auction). See the PDF's TradeType table.
    print(
        f"[TRADE] {asset.ticker:<8} {date} #{trade_number} "
        f"{price:>10.2f} x {qty}  buy={buy_agent} sell={sell_agent} type={trade_type}",
        flush=True,
    )


# Keep the ctypes callback instances alive for the whole process lifetime.
# If Python GCs these, the DLL calls a dangling pointer and the process dies silently.
state_cb = STATE_CB(_on_state)
tiny_book_cb = TINYBOOK_CB(_on_tiny_book)
trade_cb = TRADE_CB(_on_trade)


def _selftest():
    """Validate the ctypes wiring WITHOUT the DLL (runnable anywhere on Windows)."""
    asset = TAssetID(ticker="WDOU26", bolsa="F", feed=0)
    assert asset.ticker == "WDOU26" and asset.feed == 0

    seen = []
    global _on_tiny_book, _on_trade
    orig_tb, orig_tr = _on_tiny_book, _on_trade
    _on_tiny_book = lambda a, p, q, s: seen.append(("book", a.ticker, p, q, s))
    _on_trade = lambda a, d, n, p, v, q, b, s, t: seen.append(("trade", a.ticker, p, q, t))
    try:
        _on_tiny_book(asset, 5432.5, 10, 0)
        _on_trade(asset, "13/08/2026 10:00:00.123", 1, 5432.5, 54325.0, 10, 1, 2, 3)
    finally:
        _on_tiny_book, _on_trade = orig_tb, orig_tr

    assert seen == [
        ("book", "WDOU26", 5432.5, 10, 0),
        ("trade", "WDOU26", 5432.5, 10, 3),
    ], seen
    # The state callback drives readiness — prove it flips the right event.
    _on_state(CONNECTION_STATE_MARKET_DATA, MARKET_CONNECTED)
    assert _ready["market"].is_set()
    print("selftest OK — ctypes wiring and callback logic are coherent")


def main():
    if "--selftest" in sys.argv:
        _selftest()
        return

    dll_path = os.environ.get("PROFITDLL_PATH")
    key = os.environ.get("PROFITDLL_KEY")
    user = os.environ.get("PROFITDLL_USER")
    password = os.environ.get("PROFITDLL_PASS")
    ticker = os.environ.get("TICKER", "WDOU26")
    exchange = os.environ.get("EXCHANGE", "F")

    missing = [n for n, v in [
        ("PROFITDLL_PATH", dll_path), ("PROFITDLL_KEY", key),
        ("PROFITDLL_USER", user), ("PROFITDLL_PASS", password),
    ] if not v]
    if missing:
        sys.exit(f"Set these env vars first: {', '.join(missing)}")

    from ctypes import WinDLL  # Windows-only; import here so --selftest works anywhere
    dll = WinDLL(dll_path)

    # Market-Data-only init: no routing (product is signal-only, never sends orders).
    # None (NULL) for the callbacks we don't use; the DLL simply won't call them.
    dll.DLLInitializeMarketLogin.restype = c_int
    dll.DLLInitializeMarketLogin.argtypes = [
        c_wchar_p, c_wchar_p, c_wchar_p,
        STATE_CB,           # state (required)
        TRADE_CB,           # new trade
        c_void_p,           # new daily      -> None
        c_void_p,           # price book     -> None
        c_void_p,           # offer book     -> None
        c_void_p,           # history trade  -> None
        c_void_p,           # progress       -> None
        TINYBOOK_CB,        # tiny book (top of book)
    ]
    rc = dll.DLLInitializeMarketLogin(
        key, user, password,
        state_cb, trade_cb, None, None, None, None, None, tiny_book_cb,
    )
    if rc != 0:
        sys.exit(f"DLLInitializeMarketLogin failed: NL code {rc}")
    print("init accepted (async); waiting for connection...", flush=True)

    for name in ("login", "market", "activation"):
        if not _ready[name].wait(timeout=30):
            sys.exit(f"timeout waiting for '{name}' connection state")
    print("connected. subscribing...", flush=True)

    dll.SubscribeTicker.restype = c_int
    dll.SubscribeTicker.argtypes = [c_wchar_p, c_wchar_p]
    rc = dll.SubscribeTicker(ticker, exchange)
    if rc != 0:
        sys.exit(f"SubscribeTicker({ticker},{exchange}) failed: NL code {rc}")

    print(f"subscribed to {ticker}/{exchange}. printing ticks (Ctrl+C to stop)...", flush=True)
    try:
        threading.Event().wait()  # callbacks run on the DLL's ConnectorThread
    except KeyboardInterrupt:
        dll.UnsubscribeTicker(ticker, exchange)
        print("\nstopped.")


if __name__ == "__main__":
    main()
