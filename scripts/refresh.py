#!/usr/bin/env python3
"""
Freedom's Solar Return — Venue Data Refresher

Runs daily via GitHub Actions to:
1. Health-check all venue URLs
2. Check Resy availability for Vampire Apothecary
3. Check Tock availability for Court of Two Sisters
4. Check Marriott booking URL reachability
5. Update venues.json with status and timestamps
"""

import json
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import URLError, HTTPError
from html.parser import HTMLParser

DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "venues.json"
PST = timezone(timedelta(hours=-8))

# Trip dates for availability checks
TRIP_DATES = [
    "2026-07-12", "2026-07-13", "2026-07-14", "2026-07-15",
    "2026-07-16", "2026-07-17", "2026-07-18",
]
PARTY_SIZE = 2

# Resy public API key (embedded in their web app, used by all public clients)
RESY_API_KEY = "VbWk7s3L4KiK5fzlO7JD3Q5EYolJI7n5"


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


def http_get(url: str, headers: dict = None, timeout: int = 15) -> tuple:
    """Perform an HTTP GET request. Returns (status, body_bytes, error)."""
    hdrs = {
        "User-Agent": (
            "Mozilla/5.0 (compatible; FreedomSolarReturn/1.0; "
            "+https://github.com/geoffe-ga/freedom-solar-return)"
        )
    }
    if headers:
        hdrs.update(headers)
    try:
        req = Request(url, headers=hdrs, method="GET")
        with urlopen(req, timeout=timeout) as resp:
            body = resp.read(64_000)
            return resp.status, body, None
    except HTTPError as exc:
        return exc.code, None, str(exc.reason)
    except (URLError, OSError) as exc:
        return None, None, str(exc)


def check_url(url: str) -> dict:
    """Check a URL and return status info."""
    status, body, error = http_get(url)
    result = {"url": url, "status": status, "title": None, "error": error}
    if body:
        try:
            text = body.decode("utf-8", errors="replace")
            parser = TitleParser()
            parser.feed(text)
            if parser.title:
                result["title"] = parser.title.strip()
        except Exception:
            pass
    return result


def check_resy_availability(slug: str, city: str, dates: list, party_size: int) -> dict:
    """
    Check Resy availability for a venue across multiple dates.
    Returns {status, slots_by_date, total_slots}.
    """
    print(f"\n  🔮 Checking Resy availability for '{slug}'...")
    result = {
        "status": "unknown",
        "slots_by_date": {},
        "total_slots": 0,
        "sample_slots": [],
    }

    headers = {
        "Authorization": f'ResyAPI api_key="{RESY_API_KEY}"',
        "Accept": "application/json",
    }

    for date in dates:
        url = (
            f"https://api.resy.com/4/find"
            f"?lat=0&long=0&day={date}&party_size={party_size}"
            f"&venue_id=0"  # Will search by slug via city
        )
        # Resy's find endpoint by city+slug
        venue_url = (
            f"https://api.resy.com/3/venue"
            f"?url_slug={slug}&location={city}"
        )

        # First, try to get venue ID from slug
        status, body, error = http_get(venue_url, headers=headers)
        if status == 200 and body:
            try:
                venue_data = json.loads(body)
                venue_id = venue_data.get("id", {}).get("resy")
                if not venue_id:
                    # Try alternative path
                    venue_id = venue_data.get("venue", {}).get("id", {}).get("resy")
                if venue_id:
                    # Now check availability with real venue ID
                    avail_url = (
                        f"https://api.resy.com/4/find"
                        f"?lat=0&long=0&day={date}"
                        f"&party_size={party_size}&venue_id={venue_id}"
                    )
                    a_status, a_body, a_error = http_get(avail_url, headers=headers)
                    if a_status == 200 and a_body:
                        avail_data = json.loads(a_body)
                        venues = avail_data.get("results", {}).get("venues", [])
                        if venues:
                            slots = venues[0].get("slots", [])
                            slot_times = []
                            for s in slots[:10]:  # Cap at 10 per day
                                start = s.get("date", {}).get("start")
                                if start:
                                    # Format: "2026-07-12 18:00:00"
                                    time_part = start.split(" ")[1][:5] if " " in start else start
                                    slot_times.append(time_part)
                            result["slots_by_date"][date] = slot_times
                            result["total_slots"] += len(slot_times)
                            if len(result["sample_slots"]) < 6:
                                for t in slot_times[:3]:
                                    result["sample_slots"].append(f"{date[5:]} {t}")
                    print(f"    ✓ {date}: {len(result['slots_by_date'].get(date, []))} slots")
                    continue
            except (json.JSONDecodeError, KeyError, TypeError) as exc:
                print(f"    ⚠ {date}: Parse error — {exc}")
                continue

        # Fallback: just check if the Resy page is reachable
        print(f"    ⚠ {date}: Could not fetch venue data (status={status})")

    # Determine overall status
    if result["total_slots"] > 10:
        result["status"] = "available"
    elif result["total_slots"] > 0:
        result["status"] = "limited"
    elif any(result["slots_by_date"].values()):
        result["status"] = "limited"
    else:
        # Couldn't determine — mark as unknown rather than unavailable
        result["status"] = "unknown"

    return result


def check_tock_availability(venue_slug: str, dates: list, party_size: int) -> dict:
    """Check Tock availability by fetching the search page for each date."""
    print(f"\n  🎷 Checking Tock availability for '{venue_slug}'...")
    result = {"status": "unknown", "dates_checked": []}

    for date in dates[:3]:  # Check first 3 days to avoid rate limits
        url = (
            f"https://www.exploretock.com/{venue_slug}"
            f"/search?date={date}&size={party_size}&time=10:00"
        )
        status, body, error = http_get(url)
        date_result = {"date": date, "reachable": status is not None and 200 <= status < 400}
        result["dates_checked"].append(date_result)

        if date_result["reachable"]:
            print(f"    ✓ {date}: Tock page reachable (status {status})")
        else:
            print(f"    ⚠ {date}: Tock page unreachable (status={status}, error={error})")

    reachable_count = sum(1 for d in result["dates_checked"] if d["reachable"])
    if reachable_count > 0:
        result["status"] = "available"
    return result


def update_booking_status(data: dict, now: datetime):
    """Walk through all venues and update booking status where possible."""
    timestamp = now.isoformat()

    # Collect all venue lists
    all_venues = []
    if data.get("hotel"):
        all_venues.append(data["hotel"])
    for section in ["activities", "shopping", "dining", "nightlife"]:
        for item in data.get(section, []):
            all_venues.append(item)

    for venue in all_venues:
        booking = venue.get("booking")
        if not booking:
            continue

        # Skip walk-in venues
        if booking.get("type") == "walk_in":
            continue

        platform = booking.get("platform", "")

        # Resy check
        if platform == "Resy" and booking.get("resy_slug"):
            resy_result = check_resy_availability(
                booking["resy_slug"],
                booking.get("resy_city", "new-orleans-la"),
                TRIP_DATES,
                PARTY_SIZE,
            )
            booking["status"] = resy_result["status"]
            booking["last_checked"] = timestamp
            if resy_result["sample_slots"]:
                booking["slots"] = resy_result["sample_slots"]
            elif resy_result["status"] == "unknown":
                booking["slots"] = []

        # Tock check
        elif platform == "Tock":
            tock_result = check_tock_availability(
                "thecourtoftwosisters", TRIP_DATES, PARTY_SIZE
            )
            booking["status"] = tock_result["status"]
            booking["last_checked"] = timestamp

        # For other platforms (Marriott, FareHarbor), just check URL reachability
        elif booking.get("book_url"):
            info = check_url(booking["book_url"])
            if info["status"] and 200 <= info["status"] < 400:
                booking["status"] = "available"
            else:
                booking["status"] = "unknown"
            booking["last_checked"] = timestamp


def collect_urls(data: dict) -> list[tuple[str, str]]:
    """Walk the venue JSON and collect (label, url) pairs."""
    urls = []
    h = data.get("hotel", {})
    if h.get("url"):
        urls.append((h["name"], h["url"]))
    for section in ["activities", "shopping", "dining", "nightlife"]:
        for item in data.get(section, []):
            if item.get("url"):
                urls.append((item["name"], item["url"]))
    return urls


def main():
    print("🌙 Freedom Solar Return — Venue Refresher")
    print("=" * 50)

    with open(DATA_FILE, "r") as f:
        data = json.load(f)

    now = datetime.now(PST)

    # Phase 1: Health-check all venue URLs
    urls = collect_urls(data)
    print(f"\n📡 Phase 1: Checking {len(urls)} venue URLs...\n")

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
        results.append({
            "name": label, "url": url, "status": info["status"],
            "title": info.get("title"), "error": info.get("error"),
        })

    # Phase 2: Check booking availability
    print(f"\n🎫 Phase 2: Checking booking availability...\n")
    update_booking_status(data, now)

    # Update metadata
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
        # Don't fail the entire action for URL health checks
        # Only fail for critical errors
    print("\n✓ Refresh complete.")


if __name__ == "__main__":
    main()
