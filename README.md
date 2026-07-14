# 💪 Fitness Buddy — AI-Powered Health & Fitness Coach

> An intelligent, conversational fitness assistant built with **Python Flask** and **IBM watsonx.ai (Granite)**, designed as a full-stack student project showcasing real-world AI integration.

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 **AI Chat** | Conversational fitness coach powered by IBM Granite 3.3 8B Instruct |
| 🏋️ **Workout Plans** | Personalized home workout routines based on your goals and equipment |
| 🥗 **Meal Suggestions** | Simple, nutritious meal ideas (vegetarian & non-vegetarian) |
| ⚡ **Motivation** | Daily fitness inspiration and habit-building advice |
| 🔥 **Streak Tracker** | Log daily workouts and track your consistency streak |
| 📱 **Responsive UI** | Clean, modern chat interface that works on desktop and mobile |

---

## 🏗️ Project Structure

```
fitness-buddy/
├── app.py                  # Flask backend — routes & watsonx.ai integration
├── templates/
│   └── index.html          # Chat UI + habit tracker HTML
├── static/
│   ├── style.css           # Responsive CSS styling
│   └── script.js           # Frontend JS (chat, check-in, history)
├── requirements.txt        # Python dependencies
├── .env.example            # Environment variable template
├── habit_data.json         # Auto-created: stores streak data locally
└── README.md
```

---

## 🚀 Setup & Installation

### 1. Prerequisites

- Python 3.9 or higher
- An [IBM Cloud account](https://cloud.ibm.com/registration) (free tier works)

---

### 2. Get IBM watsonx.ai Credentials

You need three values: an **API key**, a **service URL**, and a **project ID**.

#### Step A — Create an IBM Cloud API Key
1. Log in at [https://cloud.ibm.com](https://cloud.ibm.com)
2. Go to **Manage → Access (IAM) → API keys**
3. Click **Create an IBM Cloud API key** and copy the key value

#### Step B — Launch watsonx.ai and Get the Service URL
1. In the IBM Cloud catalog, search for **"watsonx.ai"** and provision an instance
2. The service URL corresponds to your region, e.g.:
   - US South → `https://us-south.ml.cloud.ibm.com`
   - EU DE → `https://eu-de.ml.cloud.ibm.com`

#### Step C — Create a Project and Get the Project ID
1. Open [https://dataplatform.cloud.ibm.com/wx/home](https://dataplatform.cloud.ibm.com/wx/home)
2. Click **New project → Create an empty project**
3. Give it a name and click **Create**
4. Open the project → go to **Manage → General**
5. Copy the **Project ID** shown at the top

---

### 3. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/your-username/fitness-buddy.git
cd fitness-buddy

# Create your .env file from the template
cp .env.example .env
```

Open `.env` and fill in your credentials:

```env
WATSONX_APIKEY=your_ibm_cloud_api_key_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=your_watsonx_project_id_here
```

---

### 4. Install Dependencies

```bash
# (Optional but recommended) Create a virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

# Install all Python packages
pip install -r requirements.txt
```

---

### 5. Run the App

```bash
python app.py
```

Open your browser at → **[http://localhost:5000](http://localhost:5000)**

---

## 🖥️ Usage Guide

### Chat with Fitness Buddy
- Type any fitness-related question in the chat box and press **Enter** (or click the send button)
- Use the **Quick Start chips** in the sidebar to get instant results:
  - 🏠 *Home Workout* — generates a beginner 15-min routine
  - 🥗 *Healthy Meal* — suggests a nutritious meal idea
  - ⚡ *Motivate Me* — delivers an encouraging message
  - 📅 *Weekly Plan* — builds a 7-day workout schedule

### Daily Check-in & Streak Tracker
- Click **"✅ Log Today's Workout"** in the sidebar whenever you complete a workout
- Your streak increments if you check in on consecutive days
- Miss a day? Your streak resets — motivation to stay consistent!

---

## 🔧 API Reference

| Endpoint | Method | Payload | Response |
|---|---|---|---|
| `/` | GET | — | Renders `index.html` |
| `/chat` | POST | `{ "message": "...", "history": [...] }` | `{ "reply": "..." }` |
| `/checkin` | POST | — | `{ "streak": N, "total": N, "message": "..." }` |

---

## 🤖 AI Model Details

| Parameter | Value |
|---|---|
| Model | `ibm/granite-3-3-8b-instruct` |
| Max new tokens | 512 |
| Temperature | 0.7 |
| Top-p | 0.9 |
| Repetition penalty | 1.1 |

The system prompt instructs the model to act as a warm, practical fitness coach. Responses are limited to 2–4 sentences for casual questions and expand for detailed plan requests.

---

## 🛡️ Safety & Limitations

- **Not a medical device** — Fitness Buddy always recommends consulting a doctor for health conditions or injuries
- No extreme diets or dangerous exercise advice is provided
- Streak data is stored locally in `habit_data.json` — no database or login required
- This is a single-user MVP; for multi-user support, add session management

---

## 📦 Dependencies

| Package | Purpose |
|---|---|
| `flask` | Web framework |
| `flask-cors` | CORS headers for local dev |
| `ibm-watsonx-ai` | IBM watsonx.ai Python SDK |
| `python-dotenv` | Load `.env` credentials |

---

## 📸 Screenshots

> Start the app and visit `http://localhost:5000` to see the chat interface with the habit tracker sidebar.

---

## 🎓 About This Project

Built as a student IEEE/college project demonstrating:
- Full-stack web development with Python Flask
- Real-world integration with IBM watsonx.ai foundation models
- Responsible AI usage with clear safety guardrails
- Clean, modern frontend design without any JavaScript framework

---

## 📄 License

MIT — feel free to fork, modify, and build on top of this project.
