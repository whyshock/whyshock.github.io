"""
Garmin Connect Data Sync Script.
Fetches wellness and activity data using python-garminconnect,
outputs JSON files that the SPA can load as static data.

Usage:
  python scripts/sync_garmin.py

Requires env vars:
  GARMIN_EMAIL - your Garmin Connect email
  GARMIN_PASSWORD - your Garmin Connect password

Outputs:
  public/data/garmin-data.json - combined data file loaded by the SPA
"""

import os
import sys
import json
from datetime import date, timedelta, datetime

try:
    from garminconnect import Garmin
except ImportError:
    print("ERROR: garminconnect not installed. Run: pip install garminconnect")
    sys.exit(1)


def main():
    email = os.environ.get("GARMIN_EMAIL")
    password = os.environ.get("GARMIN_PASSWORD")

    if not email or not password:
        print("ERROR: GARMIN_EMAIL and GARMIN_PASSWORD env vars required")
        sys.exit(1)

    print(f"🔐 Logging in as {email}...")

    # Login
    client = Garmin(email, password)

    # Try to resume saved session
    session_dir = os.path.join(os.path.dirname(__file__), ".garmin_session")
    try:
        if os.path.exists(session_dir):
            client.login(session_dir)
            print("✅ Resumed existing session")
        else:
            client.login()
            client.garth.dump(session_dir)
            print("✅ Fresh login successful")
    except Exception:
        # Fresh login on session failure
        client.login()
        client.garth.dump(session_dir)
        print("✅ Fresh login successful (session was stale)")

    # Fetch data for the last 14 days
    days = 14
    today = date.today()
    print(f"📊 Fetching {days} days of data...")

    # ── Daily Summaries ──────────────────────────────────────────────────────
    daily_summaries = []
    for i in range(days):
        d = today - timedelta(days=i)
        date_str = d.isoformat()
        try:
            stats = client.get_stats(date_str)
            summary = {
                "date": date_str,
                "steps": stats.get("totalSteps", 0) or 0,
                "restingHeartRate": stats.get("restingHeartRate"),
                "stressLevel": stats.get("averageStressLevel"),
                "bodyBattery": stats.get("bodyBatteryHighestValue"),
                "respirationRate": stats.get("averageRespirationValue"),
            }

            # Sleep data
            try:
                sleep = client.get_sleep_data(date_str)
                if sleep and "dailySleepDTO" in sleep:
                    dto = sleep["dailySleepDTO"]
                    secs = dto.get("sleepTimeSeconds")
                    if secs:
                        summary["sleepDuration"] = secs // 60

                    deep = dto.get("deepSleepSeconds", 0) or 0
                    light = dto.get("lightSleepSeconds", 0) or 0
                    rem = dto.get("remSleepSeconds", 0) or 0
                    awake = dto.get("awakeSleepSeconds", 0) or 0
                    if deep or light or rem or awake:
                        summary["sleepStages"] = {
                            "deep": deep // 60,
                            "light": light // 60,
                            "rem": rem // 60,
                            "awake": awake // 60,
                        }
            except Exception:
                pass

            daily_summaries.append(summary)
            print(f"  ✓ {date_str}: {summary['steps']} steps, HR {summary.get('restingHeartRate', '?')}")
        except Exception as e:
            print(f"  ✗ {date_str}: {e}")

    # ── Activities ───────────────────────────────────────────────────────────
    print("🏃 Fetching recent activities...")
    activities = []
    try:
        raw_activities = client.get_activities(0, 30)  # Last 30 activities
        for act in raw_activities:
            activity_type = "other"
            type_key = act.get("activityType", {}).get("typeKey", "")
            if "run" in type_key:
                activity_type = "running"
            elif "cycl" in type_key or "bik" in type_key:
                activity_type = "cycling"
            elif "swim" in type_key:
                activity_type = "swimming"
            elif "walk" in type_key:
                activity_type = "walking"
            elif "hik" in type_key:
                activity_type = "hiking"
            elif "strength" in type_key:
                activity_type = "strength_training"
            elif "yoga" in type_key:
                activity_type = "yoga"

            activities.append({
                "activityId": str(act.get("activityId", "")),
                "activityType": activity_type,
                "activityName": act.get("activityName", ""),
                "startTime": act.get("startTimeGMT", ""),
                "duration": act.get("duration", 0) or 0,
                "distance": act.get("distance"),
                "calories": act.get("calories"),
                "averageHR": act.get("averageHR"),
                "maxHR": act.get("maxHR"),
                "elevationGain": act.get("elevationGain"),
                "hasGPS": act.get("hasPolyline", False),
            })
        print(f"  ✓ {len(activities)} activities fetched")
    except Exception as e:
        print(f"  ✗ Activities fetch failed: {e}")

    # ── User Profile ─────────────────────────────────────────────────────────
    profile = None
    try:
        name = client.get_full_name()
        profile = {
            "userId": email.split("@")[0],
            "displayName": name or "Garmin User",
        }
        print(f"  ✓ Profile: {profile['displayName']}")
    except Exception:
        pass

    # ── Output ───────────────────────────────────────────────────────────────
    output = {
        "syncedAt": datetime.utcnow().isoformat() + "Z",
        "dailySummaries": daily_summaries,
        "activities": activities,
        "userProfile": profile,
    }

    # Write to public/data/ directory
    output_dir = os.path.join(os.path.dirname(__file__), "..", "public", "data")
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "garmin-data.json")

    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n✅ Done! Data written to {output_path}")
    print(f"   {len(daily_summaries)} daily summaries, {len(activities)} activities")


if __name__ == "__main__":
    main()
