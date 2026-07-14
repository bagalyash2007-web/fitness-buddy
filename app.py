"""
app.py — Fitness Buddy Flask Backend
--------------------------------------
Main entry point for the Fitness Buddy web application.
Handles chat routing to IBM watsonx.ai (Granite model),
a multi-step onboarding profile wizard, and a habit tracker.
"""

import os
import json
from datetime import date, timedelta

from flask import Flask, request, jsonify, render_template, redirect, url_for
from flask_cors import CORS
from dotenv import load_dotenv
# ibm-watsonx-ai is the modern SDK (Python >=3.11, used on Render.com)
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ── Load environment variables from .env file ──────────────────────────────────
load_dotenv()

app = Flask(__name__)
CORS(app)  # Allow cross-origin requests (useful during local development)

# ── Constants ──────────────────────────────────────────────────────────────────
HABIT_FILE   = "habit_data.json"    # Habit streak data
PROFILE_FILE = "profile.json"       # Onboarding profile data
MODEL_ID     = "ibm/granite-3-3-8b-instruct"

# ── Profile helpers ────────────────────────────────────────────────────────────
def load_profile():
    """Load the user profile saved during onboarding, or return None if missing."""
    if os.path.exists(PROFILE_FILE):
        with open(PROFILE_FILE, "r") as f:
            return json.load(f)
    return None


def save_profile(data):
    """Persist the onboarding profile to disk."""
    with open(PROFILE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def build_system_prompt(profile=None):
    """
    Build a personalised system prompt for the Granite model.
    If a user profile exists from onboarding, inject their stats and goal so
    the AI gives advice tailored to that specific person.
    """
    base = """You are Fitness Buddy, a warm, encouraging, and knowledgeable AI fitness coach.
Your role is to help users with:
- Home workout routines and exercise recommendations tailored to their goals, time, equipment, and fitness level
- Daily motivation, fitness inspiration, and positive reinforcement
- Simple, nutritious meal ideas based on their dietary preference
- Building healthy habits and staying consistent

Your tone is friendly, concise, and practical. Keep responses to 2-4 sentences unless the user
explicitly asks for a detailed plan — in that case, provide a clear, structured response.

Safety guidelines you must always follow:
- Never recommend extreme diets, dangerous supplements, or injury-prone exercises without proper caveats
- For any medical condition, injury, or health concern, always advise consulting a qualified doctor or physiotherapist
- Do not make medical diagnoses or prescribe treatments
- Promote sustainable, long-term healthy habits over quick fixes
"""
    if not profile:
        return base + "\nStart each session ready to learn about the user's fitness goals and level.\n"

    # ── Inject personalised user context ──────────────────────────────────────
    # Calculate BMI if we have height and weight
    bmi_line = ""
    try:
        h = float(profile.get("height", 0))
        w = float(profile.get("weight", 0))
        if h > 0 and w > 0:
            bmi = round(w / ((h / 100) ** 2), 1)
            if   bmi < 18.5: bmi_cat = "underweight"
            elif bmi < 25.0: bmi_cat = "normal weight"
            elif bmi < 30.0: bmi_cat = "overweight"
            else:             bmi_cat = "obese"
            bmi_line = f"BMI: {bmi} ({bmi_cat}). "
    except Exception:
        pass

    personal = f"""
The user's profile (use this to personalise every response):
- Name: {profile.get('name', 'the user')}
- Primary goal: {profile.get('goal', 'general fitness')}
- Sex: {profile.get('sex', 'not specified')}
- Age: {profile.get('age', 'unknown')} years
- Height: {profile.get('height', '?')} cm | Current weight: {profile.get('weight', '?')} kg | Goal weight: {profile.get('goal_weight', '?')} kg
- {bmi_line}Activity level: {profile.get('activity', 'moderate')}
- Dietary preference: {profile.get('diet', 'no preference')}

Always address the user by their first name ({profile.get('name', 'friend')}).
Tailor all workout, diet, and habit advice directly to their goal ({profile.get('goal', 'general fitness')}),
their activity level ({profile.get('activity', 'moderate')}), and their dietary preference ({profile.get('diet', 'no preference')}).
When giving calorie or nutrition targets, base them on their age, sex, weight, and activity level.
"""
    return base + personal

# ── watsonx.ai client initialisation ──────────────────────────────────────────
def get_model():
    """
    Initialise and return a watsonx.ai ModelInference instance using ibm-watsonx-ai.
    Credentials are read from environment variables:
      - WATSONX_APIKEY      : IBM Cloud API key
      - WATSONX_URL         : watsonx.ai service URL (e.g. https://us-south.ml.cloud.ibm.com)
      - WATSONX_PROJECT_ID  : Your watsonx.ai project ID
    """
    credentials = Credentials(
        url=os.getenv("WATSONX_URL"),
        api_key=os.getenv("WATSONX_APIKEY"),
    )
    client = APIClient(credentials=credentials)

    model = ModelInference(
        model_id=MODEL_ID,
        api_client=client,
        project_id=os.getenv("WATSONX_PROJECT_ID"),
        params={
            GenParams.MAX_NEW_TOKENS: 512,
            GenParams.TEMPERATURE: 0.7,
            GenParams.TOP_P: 0.9,
            GenParams.REPETITION_PENALTY: 1.1,
        },
    )
    return model


# ── Habit tracker helpers ──────────────────────────────────────────────────────
def load_habit_data():
    """Load habit data from the local JSON file, or return defaults if missing."""
    if os.path.exists(HABIT_FILE):
        with open(HABIT_FILE, "r") as f:
            return json.load(f)
    return {"last_checkin": None, "streak": 0, "total_checkins": 0}


def save_habit_data(data):
    """Persist habit data to the local JSON file."""
    with open(HABIT_FILE, "w") as f:
        json.dump(data, f, indent=2)


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    """
    Serve the main chat UI.
    Redirects to /onboarding if no profile has been saved yet — first-time users
    must complete the wizard before accessing the chat.
    """
    if not load_profile():
        return redirect(url_for("onboarding"))
    habit   = load_habit_data()
    profile = load_profile()
    return render_template(
        "index.html",
        streak=habit["streak"],
        total=habit["total_checkins"],
        profile=profile,
    )


@app.route("/onboarding", methods=["GET", "POST"])
def onboarding():
    """
    GET  /onboarding — show the multi-step profile wizard.
                       Passing ?reset=1 clears the existing profile so the user can redo it.
    POST /onboarding — save the submitted profile JSON and redirect to /.
    """
    if request.method == "POST":
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"error": "No data"}), 400
        save_profile(data)
        return jsonify({"ok": True})
    # GET — allow reset via ?reset=1 (triggered by the ✏️ edit link)
    if request.args.get("reset") and os.path.exists(PROFILE_FILE):
        os.remove(PROFILE_FILE)
    # Skip wizard if profile already exists (and no reset)
    if load_profile():
        return redirect(url_for("index"))
    return render_template("onboarding.html")


@app.route("/chat", methods=["POST"])
def chat():
    """
    POST /chat
    Accepts JSON: { "message": "<user message>", "history": [{"role": "...", "content": "..."}] }
    Forwards the conversation to the Granite model on watsonx.ai with the Fitness Buddy
    system prompt and returns the AI reply as JSON: { "reply": "<assistant response>" }
    """
    body = request.get_json(silent=True)
    if not body or not body.get("message"):
        return jsonify({"error": "No message provided."}), 400

    user_message = body["message"].strip()
    history      = body.get("history", [])   # Conversation history from the frontend

    # Build a personalised system prompt using the saved user profile
    profile      = load_profile()
    system_prompt = build_system_prompt(profile)

    # Build the prompt using a chat-style format the Granite instruct model understands
    prompt_parts = [f"<|system|>\n{system_prompt}\n<|user|>"]

    # Append prior turns so the model has conversational context
    for turn in history[-6:]:   # Keep last 3 exchanges (6 messages) to stay within token limits
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        tag     = "<|user|>" if role == "user" else "<|assistant|>"
        prompt_parts.append(f"{tag}\n{content}")

    prompt_parts.append(f"<|user|>\n{user_message}\n<|assistant|>")
    prompt = "\n".join(prompt_parts)

    try:
        model    = get_model()
        # generate_text returns the string directly in ibm-watson-machine-learning
        response = model.generate_text(prompt=prompt)
        reply    = response.strip() if isinstance(response, str) else str(response)
        return jsonify({"reply": reply})

    except Exception as e:
        # Return a friendly error instead of a 500 crash page
        print(f"[watsonx error] {e}")
        return jsonify({
            "reply": "Sorry, I'm having trouble connecting right now. "
                     "Please check your watsonx.ai credentials and try again! 💪"
        }), 200   # Return 200 so the frontend can display the message normally


@app.route("/checkin", methods=["POST"])
def checkin():
    """
    POST /checkin
    Logs today's workout check-in, updates the streak counter, and returns
    the updated stats as JSON: { "streak": N, "total": N, "message": "..." }
    Streak resets if the user misses more than one consecutive day.
    """
    habit = load_habit_data()
    today = str(date.today())

    if habit["last_checkin"] == today:
        # User already checked in today — don't double-count
        return jsonify({
            "streak":  habit["streak"],
            "total":   habit["total_checkins"],
            "message": "You already checked in today! Keep it up! 🔥"
        })

    # Determine whether the streak continues or resets
    yesterday = str(date.today() - timedelta(days=1))
    if habit["last_checkin"] == yesterday:
        habit["streak"] += 1
    else:
        habit["streak"] = 1  # Missed a day (or first ever check-in) — reset streak

    habit["last_checkin"]   = today
    habit["total_checkins"] += 1
    save_habit_data(habit)

    streak = habit["streak"]
    if streak == 1:
        msg = "Great start! Day 1 done. Come back tomorrow to build your streak! 💪"
    elif streak < 7:
        msg = f"Awesome! {streak}-day streak going strong! 🔥"
    elif streak < 30:
        msg = f"🏆 Incredible! {streak} days in a row! You're building a real habit!"
    else:
        msg = f"🌟 LEGEND STATUS: {streak}-day streak! You're unstoppable!"

    return jsonify({"streak": streak, "total": habit["total_checkins"], "message": msg})


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    # Use PORT env variable if set (Render.com injects this automatically),
    # otherwise fall back to 5001 for local development.
    port = int(os.environ.get("PORT", 5001))
    app.run(debug=False, host="0.0.0.0", port=port)
