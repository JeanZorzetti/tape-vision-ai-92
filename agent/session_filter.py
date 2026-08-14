"""
Session filter — a configurable, togglable trading-window predicate (FR-007).

Off by default (crypto trades 24/7, no auction); on for session-based markets
(future WDO) with one or more allowed local-time windows. Uses only
`datetime.time` from the standard library — the requirement is "is now inside
one of these windows", nothing more, so no timezone/DSL machinery (research.md
§6). Windows are same-day (start <= end); an overnight window isn't needed by
any FR here.

Validate offline: python session_filter.py --selftest
"""

import datetime
import sys
from dataclasses import dataclass, field


@dataclass
class SessionFilterConfig:
    enabled: bool = False
    windows: list = field(default_factory=list)  # list of (datetime.time, datetime.time)


def is_allowed(config, timestamp):
    """`timestamp`: epoch seconds (a Trade Event's own timestamp field).

    True when filtering is off, or when `timestamp`'s local time-of-day falls
    inside any configured window (FR-007).
    """
    if not config.enabled:
        return True
    local_time = datetime.datetime.fromtimestamp(timestamp).time()
    return any(start <= local_time <= end for start, end in config.windows)


def _selftest():
    window = (datetime.time(9, 0), datetime.time(18, 0))
    cfg_on = SessionFilterConfig(enabled=True, windows=[window])
    cfg_off = SessionFilterConfig(enabled=False, windows=[window])

    in_window = datetime.datetime(2026, 8, 14, 12, 0).timestamp()
    out_window = datetime.datetime(2026, 8, 14, 22, 0).timestamp()

    assert is_allowed(cfg_on, in_window) is True
    assert is_allowed(cfg_on, out_window) is False
    assert is_allowed(cfg_off, out_window) is True  # disabled -> always allowed, any hour

    print("selftest OK — session filter respects enabled/disabled and window boundaries")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        _selftest()
    else:
        print(__doc__.strip())
