from flask import Flask, jsonify, render_template, request

from services.ow_aggregator import build_dashboard_payload


app = Flask(__name__)


@app.get("/")
def index() -> str:
    return render_template("index.html")


@app.get("/api/status")
def api_status():
    force_refresh = request.args.get("refresh") == "1"
    payload = build_dashboard_payload(force_refresh=force_refresh)
    status_code = 200 if payload.get("health") in {"ok", "degraded"} else 503
    return jsonify(payload), status_code


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
