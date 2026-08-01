import os
import json

from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv
from groq import Groq

from data.bajaj_data import (
    PRODUCTS_DATA,
    SBU_MAPPING,
    SBU_IMAGES,
    BCG_RMS_THRESHOLD,
    BCG_IGR_THRESHOLD,
)

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

GROQ_MODEL = "llama-3.3-70b-versatile"

app = Flask(__name__)
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0


@app.after_request
def no_cache(response):
    if app.debug:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/data")
def api_data():
    return jsonify(
        {
            "products":   PRODUCTS_DATA,
            "sbus":       SBU_MAPPING,
            "sbu_images": SBU_IMAGES,
            "thresholds": {
                "rms": BCG_RMS_THRESHOLD,
                "igr": BCG_IGR_THRESHOLD,
            },
        }
    )


@app.route("/api/strategy-insight", methods=["POST"])
def strategy_insight():
    if not groq_client:
        return jsonify({"error": "GROQ_API not configured on server"}), 500

    payload = request.get_json(force=True) or {}
    product_name = payload.get("product", "Unknown Product")
    metrics = payload.get("data", {})

    prompt = f"""You are a senior BCG strategy consultant. Analyze this product's current
BCG matrix position and give a crisp, executive-style strategic insight in under 120 words.

Product: {product_name}
SBU: {metrics.get('sbu')}
Market Share: {metrics.get('market_share')}%
Largest Competitor Market Share: {metrics.get('largest_competitor_market_share')}%
Relative Market Share: {metrics.get('relative_market_share')}x
Industry Growth Rate: {metrics.get('industry_growth_rate')}%
Current Quadrant: {metrics.get('quadrant')}

Cover: why it belongs in this quadrant, one strength, one risk, and one clear recommendation
(Invest, Maintain, Harvest, or Divest). No preamble, no headers, no financial KPIs."""

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=220,
            temperature=0.7,
        )
        return jsonify({"insight": response.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/performance-insight", methods=["POST"])
def performance_insight():
    if not groq_client:
        return jsonify({"error": "GROQ_API not configured on server"}), 500

    payload = request.get_json(force=True) or {}
    product_name = payload.get("product", "Unknown Product")
    metrics = payload.get("data", {})

    prompt = f"""You are a senior business performance analyst. Analyze this product's
operational and financial performance and give a crisp, executive-style summary in under 120 words.

Product: {product_name}
SBU: {metrics.get('sbu')}
Sales Volume: {metrics.get('sales_volume')} units
Average Selling Price: {metrics.get('average_selling_price')}
Revenue: {metrics.get('revenue')}
Profit: {metrics.get('profit')}
Profit Margin: {metrics.get('profit_margin')}%
Investment Level: {metrics.get('investment_level')}%
Marketing Spend: {metrics.get('marketing_spend')}%
Product Growth Rate: {metrics.get('growth_rate')}%
Performance Score: {metrics.get('performance_score')}

Cover: sales performance, revenue performance, investment effectiveness, and 2-3 concrete
business improvement suggestions. No preamble, no headers, no BCG quadrant talk."""

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=220,
            temperature=0.7,
        )
        return jsonify({"insight": response.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    if not groq_client:
        return jsonify({"error": "GROQ_API not configured on server"}), 500

    payload = request.get_json(force=True) or {}
    user_message = payload.get("message", "").strip()
    history = payload.get("history", [])

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    portfolio_snapshot = json.dumps(PRODUCTS_DATA, indent=2)
    sbu_snapshot = json.dumps(SBU_MAPPING, indent=2)

    system_context = f"""You are an elite strategy and business performance consultant embedded inside the Bajaj Auto AI Strategic Portfolio Analyzer dashboard.
You have LIVE access to the full portfolio dataset below. Use it to give sharp, data-driven answers.

Rules:
- Answer ONLY questions related to Bajaj Auto products, BCG strategy, investment planning, market share, revenue, growth, profit, or portfolio decisions.
- For off-topic questions, politely decline and redirect to portfolio strategy.
- Keep replies concise (under 150 words) and executive-style unless the user asks for detail.
- Use numbers from the data when relevant. Format currency as ₹X Billion.
- Never hallucinate data not in the portfolio.

=== LIVE PORTFOLIO DATA ===
{portfolio_snapshot}

=== SBU MAPPING ===
{sbu_snapshot}

=== THRESHOLDS ===
BCG RMS Threshold: {BCG_RMS_THRESHOLD}x  |  BCG IGR Threshold: {BCG_IGR_THRESHOLD}%"""

    messages = [{"role": "system", "content": system_context}]

    for turn in history[-10:]:
        role = "user" if turn.get("role") == "user" else "assistant"
        messages.append({"role": role, "content": turn.get("text", "")})

    messages.append({"role": "user", "content": user_message})

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=messages,
            max_tokens=300,
            temperature=0.7,
        )
        return jsonify({"reply": response.choices[0].message.content.strip()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)