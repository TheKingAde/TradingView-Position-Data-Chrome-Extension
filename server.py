from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime

app = Flask(__name__)

# Allow all origins (for testing only)
CORS(app)

@app.route("/trade", methods=["GET", "POST", "OPTIONS"])
def receive_trade():
    try:
        if request.method == "OPTIONS":
            # Preflight handled automatically by flask-cors
            return "", 200

        if request.method == "POST":
            data = request.get_json(force=True)
        else:
            data = request.args.to_dict()

        # Basic validation
        required_fields = ["symbol", "direction", "current_price"]
        missing = [f for f in required_fields if f not in data]

        if missing:
            return jsonify({
                "status": "error",
                "message": f"Missing fields: {missing}"
            }), 400

        print("\n===== TRADE RECEIVED =====")
        print(data)
        print("==========================\n")

        return jsonify({
            "status": "success",
            "received_at": datetime.utcnow().isoformat(),
            "received_data": data
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/")
def health():
    return jsonify({
        "status": "server_running",
        "time": datetime.utcnow().isoformat()
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)