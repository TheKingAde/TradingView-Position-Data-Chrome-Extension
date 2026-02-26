from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from decimal import Decimal, InvalidOperation
import math

app = Flask(__name__)
CORS(app)


def parse_decimal(value, field_name):
    """
    Safely parse numeric values and prevent:
    - Infinity
    - NaN
    - Negative numbers
    - Invalid input
    """
    try:
        num = Decimal(str(value))

        if num.is_nan():
            raise ValueError(f"{field_name} cannot be NaN")

        if num <= 0:
            raise ValueError(f"{field_name} must be positive")

        return format(num, 'f')

    except (InvalidOperation, ValueError):
        raise ValueError(f"Invalid value for {field_name}")

@app.route("/trade", methods=["GET", "POST", "OPTIONS"])
def receive_trade():
    try:
        if request.method == "OPTIONS":
            return "", 200

        # Get data
        if request.method == "POST":
            data = request.get_json(silent=True)
            if not data:
                return jsonify({"status": "error", "message": "Invalid JSON body"}), 400
        else:
            data = request.args.to_dict()

        # Required fields
        required_fields = [
            "action",
            "tradeId",
            "symbol",
            "direction",
            "current_price",
            "stop_loss",
            "take_profit",
            "tradingview_id"
        ]

        missing = [f for f in required_fields if f not in data]

        if missing:
            return jsonify({
                "status": "error",
                "message": f"Missing fields: {missing}"
            }), 400

        # Validate & normalize numeric values
        stop_loss = parse_decimal(data["stop_loss"], "stop_loss")
        take_profit = parse_decimal(data["take_profit"], "take_profit")
        current_price = parse_decimal(data["current_price"], "current_price")

        # Entry is optional
        entry = None
        if data.get("entry"):
            entry = parse_decimal(data["entry"], "entry")

        # Validate direction
        if data["direction"] not in ["buy", "sell"]:
            return jsonify({
                "status": "error",
                "message": "Direction must be 'buy' or 'sell'"
            }), 400

        # Validate action
        if data["action"] not in ["add", "edit", "delete"]:
            return jsonify({
                "status": "error",
                "message": "Action must be add, edit, or delete"
            }), 400

        normalized_payload = {
            "action": data["action"],
            "trade_id": str(data["tradeId"]),
            "tradingview_id": str(data["tradingview_id"]),
            "symbol": str(data["symbol"]),
            "exchange": data.get("exchange"),
            "entry": entry,
            "direction": data["direction"],
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "current_price": current_price,
            "timestamp": data.get("timestamp"),
            "received_at": datetime.utcnow().isoformat()
        }

        print("\n===== TRADE RECEIVED (NORMALIZED) =====")
        for k, v in normalized_payload.items():
            print(f"{k}: {v}")
        print("=======================================\n")

        return jsonify({
            "status": "success",
            "data": normalized_payload
        }), 200

    except ValueError as ve:
        return jsonify({
            "status": "error",
            "message": str(ve)
        }), 400

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