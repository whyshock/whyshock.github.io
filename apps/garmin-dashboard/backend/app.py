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
    # Add more origins as needed
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
                    "bodyBattery": stats.get("bodyBatteryHighestValue"),
                    "respirationRate": stats.get("averageRespirationValue"),
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
