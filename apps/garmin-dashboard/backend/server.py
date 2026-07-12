"""
Garmin Connect Data Backend
Uses python-garminconnect to fetch your personal fitness data
and exposes it as a REST API for the React dashboard.

Usage:
  1. Copy .env.example to .env and add your Garmin credentials
  2. pip install -r requirements.txt
  3. python server.py
  4. The API runs on http://localhost:5000
"""

import os
import json
from datetime import date, datetime, timedelta
from functools import wraps

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv
from garminconnect import Garmin

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://localhost:4173"])

# ─── Garmin Client ─────────────────────────────────────────────────────────────

_garmin_client: Garmin | None = None
_session_dir = os.path.join(os.path.dirname(__file__), ".garmin_session")


def get_garmin_client() -> Garmin:
    """Get or create an authenticated Garmin client with session persistence."""
    global _garmin_client

    if _garmin_client is not None:
        return _garmin_client

    email = os.getenv("GARMIN_EMAIL")
    password = os.getenv("GARMIN_PASSWORD")

    if not email or not password:
        raise ValueError("GARMIN_EMAIL and GARMIN_PASSWORD must be set in .env")

    client = Garmin(email, password)

    # Try to resume a saved session first
    if os.path.exists(_session_dir):
        try:
            client.login(_session_dir)
            _garmin_client = client
            return client
        except Exception:
            pass  # Session expired, do a fresh login

    # Fresh login
    client.login()
    client.garth.dump(_session_dir)
    _garmin_client = client
    return client


def handle_garmin_errors(f):
    """Decorator to handle Garmin API errors gracefully."""
    @wraps(f)
    def decorated(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            return jsonify({"error": "configuration_error", "message": str(e)}), 500
        except Exception as e:
            error_msg = str(e)
            if "401" in error_msg or "Unauthorized" in error_msg:
                # Session expired, clear it and retry
                global _garmin_client
                _garmin_client = None
                if os.path.exists(_session_dir):
                    import shutil
                    shutil.rmtree(_session_dir, ignore_errors=True)
                return jsonify({
                    "error": "auth_expired",
                    "message": "Garmin session expired. Restart the server to re-authenticate."
                }), 401
            return jsonify({"error": "api_error", "message": error_msg}), 502
    return decorated


# ─── Helper ────────────────────────────────────────────────────────────────────

def serialize_dates(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


# ─── Routes ────────────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "timestamp": datetime.utcnow().isoformat()})


@app.route("/api/profile")
@handle_garmin_errors
def get_profile():
    """Get user profile info."""
    client = get_garmin_client()
    profile = client.get_full_name()
    user_settings = client.get_user_settings()

    return jsonify({
        "userId": user_settings.get("id", "unknown"),
        "displayName": profile or "Garmin User",
        "profileImageUrl": user_settings.get("profileImageUrl"),
    })


@app.route("/api/activities")
@handle_garmin_errors
def get_activities():
    """Get paginated activities. Query params: start (default 0), limit (default 50)."""
    client = get_garmin_client()
    start = request.args.get("start", 0, type=int)
    limit = request.args.get("limit", 50, type=int)

    activities = client.get_activities(start, limit)

    # Map to our frontend format
    mapped = []
    for act in activities:
        mapped.append({
            "activityId": str(act.get("activityId", "")),
            "activityType": map_activity_type(act.get("activityType", {}).get("typeKey", "other")),
            "activityName": act.get("activityName", ""),
            "startTime": act.get("startTimeGMT", ""),
            "duration": act.get("duration", 0),
            "distance": act.get("distance"),
            "calories": act.get("calories"),
            "averageHR": act.get("averageHR"),
            "maxHR": act.get("maxHR"),
            "elevationGain": act.get("elevationGain"),
            "hasGPS": act.get("hasPolyline", False),
        })

    return jsonify(mapped)


@app.route("/api/activities/<activity_id>")
@handle_garmin_errors
def get_activity_detail(activity_id):
    """Get detailed metrics for a specific activity."""
    client = get_garmin_client()

    # Get activity summary
    activity = client.get_activity(activity_id)

    # Get HR zones if available
    hr_zones = None
    try:
        hr_data = client.get_activity_hr_in_timezones(activity_id)
        if hr_data:
            hr_zones = [
                {
                    "zone": i + 1,
                    "minHR": z.get("zoneLowBoundary", 0),
                    "maxHR": z.get("zoneHighBoundary", 0),
                    "timeInZone": z.get("secsInZone", 0),
                    "percentageInZone": z.get("percentageInZone", 0) if "percentageInZone" in z else 0,
                }
                for i, z in enumerate(hr_data)
            ]
    except Exception:
        pass

    # Get GPS data if available
    gps_route = None
    try:
        gps_data = client.get_activity_details(activity_id)
        if gps_data and "geoPolylineDTO" in gps_data:
            polyline = gps_data["geoPolylineDTO"].get("polyline", [])
            gps_route = [
                {"lat": p.get("lat"), "lon": p.get("lon"), "elevation": p.get("altitude")}
                for p in polyline
                if p.get("lat") and p.get("lon")
            ]
    except Exception:
        pass

    # Get splits/pace data
    pace = None
    try:
        splits = client.get_activity_splits(activity_id)
        if splits and "lapDTOs" in splits:
            pace = [
                {
                    "splitIndex": i + 1,
                    "pace": lap.get("movingDuration", 0) / max(lap.get("distance", 1) / 1000, 0.001),
                    "distance": lap.get("distance", 0),
                    "timestamp": lap.get("startTimeGMT", ""),
                }
                for i, lap in enumerate(splits["lapDTOs"])
            ]
    except Exception:
        pass

    result = {
        "activityId": str(activity.get("activityId", activity_id)),
        "activityType": map_activity_type(activity.get("activityType", {}).get("typeKey", "other")),
        "activityName": activity.get("activityName", ""),
        "startTime": activity.get("startTimeGMT", ""),
        "duration": activity.get("duration", 0),
        "distance": activity.get("distance"),
        "calories": activity.get("calories"),
        "averageHR": activity.get("averageHR"),
        "maxHR": activity.get("maxHR"),
        "elevationGain": activity.get("elevationGain"),
        "hasGPS": activity.get("hasPolyline", False),
        "heartRateZones": hr_zones,
        "pace": pace,
        "gpsRoute": gps_route,
    }

    return jsonify(result)


@app.route("/api/daily-summary")
@handle_garmin_errors
def get_daily_summary():
    """Get daily summaries. Query params: startDate, endDate (YYYY-MM-DD)."""
    client = get_garmin_client()
    start_date = request.args.get("startDate", (date.today() - timedelta(days=6)).isoformat())
    end_date = request.args.get("endDate", date.today().isoformat())

    summaries = []
    current = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)

    while current <= end:
        date_str = current.isoformat()
        try:
            stats = client.get_stats(date_str)
            sleep_data = None
            try:
                sleep_data = client.get_sleep_data(date_str)
            except Exception:
                pass

            body_battery = None
            try:
                bb = client.get_body_battery(date_str)
                if bb and isinstance(bb, list) and len(bb) > 0:
                    # Get the latest body battery value
                    body_battery = bb[-1].get("charged") if bb[-1] else None
            except Exception:
                pass

            summary = {
                "date": date_str,
                "steps": stats.get("totalSteps", 0),
                "restingHeartRate": stats.get("restingHeartRate"),
                "sleepDuration": None,
                "sleepStages": None,
                "stressLevel": stats.get("averageStressLevel"),
                "bodyBattery": body_battery,
                "respirationRate": stats.get("averageRespirationValue"),
            }

            # Extract sleep data
            if sleep_data and "dailySleepDTO" in sleep_data:
                sleep_dto = sleep_data["dailySleepDTO"]
                duration_secs = sleep_dto.get("sleepTimeSeconds")
                if duration_secs:
                    summary["sleepDuration"] = duration_secs // 60  # Convert to minutes

                # Sleep stages
                deep = sleep_dto.get("deepSleepSeconds", 0) // 60
                light = sleep_dto.get("lightSleepSeconds", 0) // 60
                rem = sleep_dto.get("remSleepSeconds", 0) // 60
                awake = sleep_dto.get("awakeSleepSeconds", 0) // 60
                if deep or light or rem or awake:
                    summary["sleepStages"] = {
                        "deep": deep,
                        "light": light,
                        "rem": rem,
                        "awake": awake,
                    }

            summaries.append(summary)
        except Exception:
            # No data for this date
            summaries.append({"date": date_str, "steps": 0})

        current += timedelta(days=1)

    return jsonify(summaries)


@app.route("/api/personal-records")
@handle_garmin_errors
def get_personal_records():
    """Get personal records."""
    client = get_garmin_client()
    records = client.get_personal_record()

    mapped = []
    if records:
        for rec in records:
            mapped.append({
                "recordType": rec.get("typeId", "unknown"),
                "value": rec.get("value", 0),
                "unit": rec.get("unitSymbol", ""),
                "activityId": str(rec.get("activityId", "")),
                "date": rec.get("prStartTimeGMT", ""),
            })

    return jsonify(mapped)


@app.route("/api/training-status")
@handle_garmin_errors
def get_training_status():
    """Get training status (VO2 max, training load, recovery)."""
    client = get_garmin_client()

    # Get VO2 max
    vo2_max = None
    try:
        vo2_data = client.get_max_metrics(date.today().isoformat())
        if vo2_data and isinstance(vo2_data, list) and len(vo2_data) > 0:
            vo2_max = vo2_data[0].get("generic", {}).get("vo2MaxPreciseValue")
    except Exception:
        pass

    # Get training status
    training_load = None
    recovery_hours = None
    try:
        training_data = client.get_training_status(date.today().isoformat())
        if training_data:
            training_load = training_data.get("weeklyTrainingLoad")
            recovery_hours = training_data.get("recoveryTimeInMinutes", 0) // 60
    except Exception:
        pass

    if not vo2_max and not training_load:
        return jsonify(None)

    return jsonify({
        "vo2Max": vo2_max or 0,
        "trainingLoad": training_load or 0,
        "trainingLoadBalance": "optimal",
        "recoveryTimeHours": recovery_hours or 0,
    })


# ─── Helpers ───────────────────────────────────────────────────────────────────

def map_activity_type(garmin_type: str) -> str:
    """Map Garmin activity type keys to our simplified types."""
    mapping = {
        "running": "running",
        "trail_running": "running",
        "treadmill_running": "running",
        "cycling": "cycling",
        "road_biking": "cycling",
        "mountain_biking": "cycling",
        "indoor_cycling": "cycling",
        "swimming": "swimming",
        "lap_swimming": "swimming",
        "open_water_swimming": "swimming",
        "walking": "walking",
        "hiking": "hiking",
        "strength_training": "strength_training",
        "yoga": "yoga",
    }
    return mapping.get(garmin_type, "other")


# ─── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n🏃 Garmin Fitness Dashboard — Backend Server")
    print("=" * 50)
    print(f"  API:  http://localhost:5000/api/")
    print(f"  Docs: /api/health, /api/profile, /api/activities")
    print("=" * 50)
    print()

    # Test connection on startup
    try:
        client = get_garmin_client()
        name = client.get_full_name()
        print(f"✅ Connected as: {name}")
    except Exception as e:
        print(f"⚠️  Connection failed: {e}")
        print("   Check your .env credentials and try again.")

    app.run(host="0.0.0.0", port=5000, debug=True)
