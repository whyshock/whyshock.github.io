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
                    "startTime": act.get("startTimeGMT", ""),
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
    Fetches GPS route data for a specific activity using geoPolylineDTO.
    Requires credentials in the body (same as /api/sync).
    Returns decoded lat/lon coordinates.
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

        # Get activity details which contains geoPolylineDTO
        details = client.get_activity_details(activity_id)

        gps_route = []

        if details and isinstance(details, dict):
            # Strategy 1: Look for geoPolylineDTO
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

            # Fallback: check metricDescriptors + activityDetailMetrics for coordinate data
            if not gps_route:
                metrics = details.get("activityDetailMetrics", [])
                if metrics and isinstance(metrics, list):
                    for metric in metrics:
                        if isinstance(metric, dict):
                            lat = metric.get("directLatitude") or metric.get("latitude")
                            lon = metric.get("directLongitude") or metric.get("longitude")
                            if lat is not None and lon is not None:
                                gps_route.append({
                                    "lat": lat / 1.0,  # Garmin stores as semicircles sometimes
                                    "lon": lon / 1.0,
                                    "elevation": metric.get("directElevation") or metric.get("elevation"),
                                })

        return jsonify({
            "activityId": activity_id,
            "gpsRoute": gps_route,
            "pointCount": len(gps_route),
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
