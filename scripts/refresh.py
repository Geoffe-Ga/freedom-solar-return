#!/usr/bin/env python3
"""
Freedom's Solar Return — Venue Data Refresher

Runs daily via GitHub Actions to check venue URLs for availability
and update the last_updated timestamp. Captures HTTP status codes,
redirect info, and page titles as a health check for each venue link.
"""

import json
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "venues.json"
PST = timezone(timedelta(hours=-8))


class TitleParser(HTMLParser):
    """Extracts the <title> tag from an HTML page."""

    def __init__(self):
        super().__init__()
        self._in_title = False
        self.title = ""

    def handle_starttag(self, tag, attrs):
        if tag.lower() == "title":
            self._in_title = True

    def handle_endtag(self, tag):
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def check_url(url: str, timeout: int = 15) -> dict:
    """Check a URL and return status info."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; FreedomSolarReturn/1.0; "
            "+https://github.com/geoffe-ga/freedom-solar-return)"
        )
    }
    result = {"url": url, "status": None, "title": None, "error": None}
    try:
        req = Request(url, headers=headers, method="GET")
        with urlopen(req, timeout=timeout) as resp:
            result["status"] = resp.status
            content_type = resp.headers.get("Content-Type", "")
            if "text/html" in content_type:
                body = resp.read(32_000).decode("utf-8", errors="replace")
                parser = TitleParser()
                parser.feed(body)
                if parser.title:
                    result["title"] = parser.title.strip()
    except HTTPError as exc:
        result["status"] = exc.code
        result["error"] = str(exc.reason)
    except (URLError, OSError) as exc:
        result["error"] = str(exc)
    return result


def collect_urls(data: dict) -> list[tuple[str, str]]:
    """Walk the venue JSON and collect (label, url) pairs."""
    urls = []

    # Hotel
    h = data.get("hotel", {})
    if h.get("url"):
        urls.append((h["name"], h["url"]))

    # Activities
    for item in data.get("activities", []):
        if item.get("url"):
            urls.append((item["name"], item["url"]))

    # Shopping
    for item in data.get("shopping", []):
        if item.get("url"):
            urls.append((item["name"], item["url"]))

    # Dining
    for item in data.get("dining", []):
        if item.get("url"):
            urls.append((item["name"], item["url"]))

    # Nightlife
    for item in data.get("nightlife", []):
        if item.get("url"):
            urls.append((item["name"], item["url"]))

    return urls


def main():
    print("🌙 Freedom Solar Return — Venue Refresher")
    print("=" * 50)

    with open(DATA_FILE, "r") as f:
        data = json.load(f)

    urls = collect_urls(data)
    print(f"\nChecking {len(urls)} venue URLs...\n")

    all_ok = True
    results = []

    for label, url in urls:
        info = check_url(url)
        status_icon = "✓" if info["status"] and 200 <= info["status"] < 400 else "✗"
        if status_icon == "✗":
            all_ok = False

        status_str = str(info["status"]) if info["status"] else "FAIL"
        print(f"  {status_icon} [{status_str}] {label}")
        if info.get("error"):
            print(f"           ⚠ {info['error']}")
        if info.get("title"):
            print(f"           → {info['title'][:80]}")

        results.append({
            "name": label,
            "url": url,
            "status": info["status"],
            "title": info.get("title"),
            "error": info.get("error"),
        })

    # Update timestamp
    now = datetime.now(PST)
    data["meta"]["last_updated"] = now.isoformat()
    data["meta"]["health_check"] = {
        "run_at": now.isoformat(),
        "all_ok": all_ok,
        "results": results,
    }

    with open(DATA_FILE, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\n{'=' * 50}")
    print(f"Updated {DATA_FILE.name} at {now.strftime('%Y-%m-%d %I:%M %p PST')}")

    if not all_ok:
        print("\n⚠ Some URLs returned errors — review above for details.")
        sys.exit(1)
    else:
        print("\n✓ All venue URLs are reachable.")


if __name__ == "__main__":
    main()
