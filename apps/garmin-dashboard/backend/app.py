"""
Garmin Connect Data Sync API — Multi-user.
Any user can POST their Garmin credentials, we fetch their data and return JSON.
Credentials are never stored — used only for the duration of the request.

Deployed on Render.com (free tier).
"""

import os
from datetime import date, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from garminconnect import Garmin

app = Flask(__name__)

# Allow requests from your frontend (GitHub Pages + localhost)
CORS(app, origins=[
    "http://localhost:5173",
    "http://localhost:4173",
    "https://kuppast.github.io",
    "https://www.whyshock.com",
    "https://whyshock.com",
])


@app.route("/")
def index():
    return jsonify({
        "service": "Garmin Fitness Dashboard API",
        "status": "ok",
        "endpoints": ["/api/sync"],
    })


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/api/sync", methods=["POST"])
def sync():
    """
    Accepts Garmin credentials, fetches data, returns JSON.
    Credentials are NOT stored — used only for this request.

    Request body: { "email": "...", "password": "...", "days": 14 }
    """
    body = request.get_json()
    if not body:
        return jsonify({"error": "Missing request body"}), 400

    email = body.get("email")
    password = body.get("password")
    days = body.get("days", 14)

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        # Login to Garmin Connect
        client = Garmin(email, password)
        client.login()

        # Fetch daily summaries
        daily_summaries = []
        today = date.today()

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
                    "bodyBattery": stats.get("bodyBatteryMostRecentValue") or stats.get("bodyBatteryHighestValue") or stats.get("bodyBatteryChargedValue"),
                    "respirationRate": stats.get("averageRespirationValue"),
                    "vo2Max": stats.get("vo2MaxValue"),
                    "calories": stats.get("totalKilocalories") or stats.get("activeKilocalories"),
                    "intensity": stats.get("intensityMinutesGoal"),
                }

                # Sleep
                try:
                    sleep = client.get_sleep_data(date_str)
                    if sleep and "dailySleepDTO" in sleep:
                        dto = sleep["dailySleepDTO"]
                        secs = dto.get("sleepTimeSeconds")
                        if secs:
                            summary["sleepDuration"] = secs // 60
                        deep = (dto.get("deepSleepSeconds") or 0) // 60
                        light = (dto.get("lightSleepSeconds") or 0) // 60
                        rem = (dto.get("remSleepSeconds") or 0) // 60
                        awake = (dto.get("awakeSleepSeconds") or 0) // 60
                        if deep or light or rem or awake:
                            summary["sleepStages"] = {
                                "deep": deep, "light": light,
                                "rem": rem, "awake": awake,
                            }
                except Exception:
                    pass

                daily_summaries.append(summary)
            except Exception:
                pass

        # Fetch detailed time-series data for the most recent day
        daily_details = {}
        try:
            latest_date = today.isoformat()

            # Heart rate timeline
            hr_data = client.get_heart_rates(latest_date)
            hr_timeline = []
            if hr_data and "heartRateValues" in hr_data:
                for entry in hr_data["heartRateValues"]:
                    if entry and len(entry) >= 2 and entry[1] and entry[1] > 0:
                        # entry[0] is timestamp in ms, entry[1] is HR value
                        ts = entry[0]
                        if ts:
                            from datetime import datetime as dt
                            time_str = dt.fromtimestamp(ts / 1000).isoformat()
                            hr_timeline.append({"time": time_str, "value": entry[1]})

            # Stress timeline
            stress_data = client.get_stress_data(latest_date)
            stress_timeline = []
            if stress_data and "stressValuesArray" in stress_data:
                for entry in stress_data["stressValuesArray"]:
                    if entry and len(entry) >= 2 and entry[1] and entry[1] > 0:
                        ts = entry[0]
                        if ts:
                            from datetime import datetime as dt
                            time_str = dt.fromtimestamp(ts / 1000).isoformat()
                            stress_timeline.append({"time": time_str, "value": entry[1]})

            # Body battery timeline
            bb_data = client.get_body_battery(latest_date)
            bb_timeline = []
            if bb_data and isinstance(bb_data, list):
                for entry in bb_data:
                    if isinstance(entry, dict):
                        ts = entry.get("startTimestampGMT") or entry.get("startTimestampLocal")
                        val = entry.get("charged") or entry.get("bodyBatteryLevel")
                        if ts and val:
                            from datetime import datetime as dt
                            if isinstance(ts, (int, float)):
                                time_str = dt.fromtimestamp(ts / 1000).isoformat()
                            else:
                                time_str = str(ts)
                            bb_timeline.append({"time": time_str, "value": val})

            if hr_timeline or stress_timeline or bb_timeline:
                daily_details[latest_date] = {
                    "heartRates": hr_timeline,
                    "stressReadings": stress_timeline,
                    "bodyBatteryReadings": bb_timeline,
                }
        except Exception:
            pass

        # Fetch activities
        activities = []
        try:
            raw = client.get_activities(0, 30)
            for act in raw:
                type_key = (act.get("activityType") or {}).get("typeKey", "")
                activity_type = map_type(type_key)
                activities.append({
                    "activityId": str(act.get("activityId", "")),
                    "activityType": activity_type,
                    "activityName": act.get("activityName", ""),
                    "startTime": act.get("startTimeLocal", "") or act.get("startTimeGMT", ""),
                    "duration": act.get("duration", 0) or 0,
                    "distance": act.get("distance"),
                    "calories": act.get("calories"),
                    "averageHR": act.get("averageHR"),
                    "maxHR": act.get("maxHR"),
                    "elevationGain": act.get("elevationGain"),
                    "hasGPS": act.get("hasPolyline", False),
                })
        except Exception:
            pass

        # Profile
        display_name = None
        try:
            display_name = client.get_full_name()
        except Exception:
            pass

        return jsonify({
            "success": True,
            "data": {
                "dailySummaries": daily_summaries,
                "dailyDetails": daily_details,
                "activities": activities,
                "displayName": display_name or "Garmin User",
            }
        })

    except Exception as e:
        msg = str(e)
        if "401" in msg or "credentials" in msg.lower() or "login" in msg.lower():
            return jsonify({
                "error": "auth_failed",
                "message": "Invalid email or password. Please check your Garmin Connect credentials."
            }), 401
        return jsonify({
            "error": "sync_failed",
            "message": f"Failed to sync: {msg}"
        }), 500


@app.route("/api/activity/<activity_id>/route", methods=["POST"])
def get_activity_route(activity_id):
    """
    Fetches GPS route + detailed metrics for a specific activity.
    Returns decoded lat/lon coordinates plus splits, HR zones, training effect.
    """
    body = request.get_json()
    if not body:
        return jsonify({"error": "Missing request body"}), 400

    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    try:
        client = Garmin(email, password)
        client.login()

        # Get full activity summary (has training effect, max speed, etc.)
        activity_summary = None
        try:
            activity_summary = client.get_activity(activity_id)
        except Exception:
            pass

        # Get activity details (has geoPolylineDTO)
        details = None
        try:
            details = client.get_activity_details(activity_id)
        except Exception:
            pass

        # Get splits/laps
        splits = []
        try:
            splits_data = client.get_activity_splits(activity_id)
            if splits_data and "lapDTOs" in splits_data:
                for i, lap in enumerate(splits_data["lapDTOs"]):
                    splits.append({
                        "index": i + 1,
                        "distance": lap.get("distance", 0),
                        "duration": lap.get("duration", 0) or lap.get("movingDuration", 0),
                        "avgHR": lap.get("averageHR"),
                        "maxHR": lap.get("maxHR"),
                        "avgSpeed": lap.get("averageSpeed"),
                        "maxSpeed": lap.get("maxSpeed"),
                        "calories": lap.get("calories"),
                        "elevationGain": lap.get("elevationGain"),
                    })
        except Exception:
            pass

        # Get HR zones
        hr_zones = []
        try:
            hr_data = client.get_activity_hr_in_timezones(activity_id)
            if hr_data and isinstance(hr_data, list):
                for i, zone in enumerate(hr_data):
                    hr_zones.append({
                        "zone": i + 1,
                        "minHR": zone.get("zoneLowBoundary", 0),
                        "maxHR": zone.get("zoneHighBoundary", 0),
                        "timeInZone": zone.get("secsInZone", 0),
                    })
        except Exception:
            pass

        # Extract GPS route
        gps_route = []
        if details and isinstance(details, dict):
            geo_polyline = details.get("geoPolylineDTO")
            if geo_polyline and isinstance(geo_polyline, dict):
                polyline_points = geo_polyline.get("polyline", [])
                if polyline_points and isinstance(polyline_points, list):
                    for point in polyline_points:
                        if isinstance(point, dict) and point.get("lat") is not None and point.get("lon") is not None:
                            gps_route.append({
                                "lat": point["lat"],
                                "lon": point["lon"],
                                "elevation": point.get("altitude"),
                            })

        # Extract extra metrics from activity summary
        extra_metrics = {}
        if activity_summary and isinstance(activity_summary, dict):
            extra_metrics = {
                "maxSpeed": activity_summary.get("maxSpeed"),
                "avgSpeed": activity_summary.get("averageSpeed"),
                "movingDuration": activity_summary.get("movingDuration"),
                "elapsedDuration": activity_summary.get("elapsedDuration") or activity_summary.get("duration"),
                "avgCadence": activity_summary.get("averageRunningCadenceInStepsPerMinute") or activity_summary.get("averageBikingCadenceInRevPerMinute"),
                "maxCadence": activity_summary.get("maxRunningCadenceInStepsPerMinute") or activity_summary.get("maxBikingCadenceInRevPerMinute"),
                "aerobicTE": activity_summary.get("aerobicTrainingEffect"),
                "anaerobicTE": activity_summary.get("anaerobicTrainingEffect"),
                "elevationGain": activity_summary.get("elevationGain"),
                "elevationLoss": activity_summary.get("elevationLoss"),
                "minElevation": activity_summary.get("minElevation"),
                "maxElevation": activity_summary.get("maxElevation"),
                "avgPower": activity_summary.get("avgPower"),
                "maxPower": activity_summary.get("maxPower"),
                "normPower": activity_summary.get("normPower"),
                "strideLength": activity_summary.get("avgStrideLength"),
                "vo2MaxValue": activity_summary.get("vO2MaxValue"),
            }

        return jsonify({
            "activityId": activity_id,
            "gpsRoute": gps_route,
            "pointCount": len(gps_route),
            "splits": splits,
            "hrZones": hr_zones,
            "metrics": extra_metrics,
        })

    except Exception as e:
        return jsonify({
            "error": "route_fetch_failed",
            "message": str(e),
        }), 500


def map_type(key: str) -> str:
    k = key.lower()
    if "run" in k: return "running"
    if "cycl" in k or "bik" in k: return "cycling"
    if "swim" in k: return "swimming"
    if "walk" in k: return "walking"
    if "hik" in k: return "hiking"
    if "strength" in k: return "strength_training"
    if "yoga" in k: return "yoga"
    return "other"


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
