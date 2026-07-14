/*
  script.js — Fitness Buddy (Redesigned)
  ----------------------------------------
  Handles:
    1. Chat with IBM Granite via POST /chat, with conversation history
    2. Category-based dynamic quick-prompt chips
    3. Daily workout check-in via POST /checkin
    4. Hero banner hide on first message
    5. Textarea auto-resize, timestamps, clear chat
*/

// ── Conversation history ──────────────────────────────────────────────────────
let conversationHistory = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const messagesEl   = document.getElementById("messages");
const inputEl      = document.getElementById("user-input");
const sendBtn      = document.getElementById("send-btn");
const typingEl     = document.getElementById("typing-indicator");
const streakEl     = document.getElementById("streak-count");
const totalEl      = document.getElementById("total-count");
const checkinMsgEl = document.getElementById("checkin-message");
const checkinBtn   = document.getElementById("checkin-btn");
const heroBanner   = document.getElementById("hero-banner");
const chipsEl      = document.getElementById("quick-chips");

// ── Quick prompt library per category ────────────────────────────────────────
const PROMPTS = {
  workout: [
    "Give me a 15-minute beginner home workout with no equipment.",
    "Create a 4-day upper/lower body split for intermediate level.",
    "What are the best exercises to build a stronger core?",
    "Design a HIIT cardio routine I can do in 20 minutes.",
  ],
  diet: [
    "Suggest a high-protein vegetarian meal plan for muscle gain.",
    "What should I eat before and after a workout?",
    "Give me a simple healthy non-veg meal prep plan for the week.",
    "What are the best foods for weight loss that keep me full?",
  ],
  habits: [
    "How do I build a consistent morning workout habit?",
    "Give me a 30-day beginner fitness challenge plan.",
    "How do I stay motivated when I don't feel like working out?",
    "What small daily habits make the biggest fitness difference?",
  ],
  mindset: [
    "I keep giving up on my fitness goals. How do I stay consistent?",
    "How do I deal with a fitness plateau mentally?",
    "Give me a powerful motivational message to start my week.",
    "How do I build a positive relationship with exercise?",
  ],
  recovery: [
    "What is the best way to recover after an intense workout?",
    "How much sleep do I need for optimal muscle recovery?",
    "What are the best stretches for post-workout soreness?",
    "Should I take rest days? How many per week?",
  ],
};

let activeCategory = "workout";

// ── Initialise on load ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  renderChips("workout");
  inputEl.focus();

  // Show a personalised welcome message in the chat feed if we have a profile
  // USER_PROFILE is injected by Flask/Jinja2 into the page as a JS variable
  if (typeof USER_PROFILE !== "undefined" && USER_PROFILE) {
    const p = USER_PROFILE;
    const name = p.name || "there";
    const goal = p.goal ? ` Your goal is to <strong>${p.goal}</strong>.` : "";
    const bmi  = (p.height && p.weight)
      ? (() => {
          const b = (parseFloat(p.weight) / Math.pow(parseFloat(p.height) / 100, 2)).toFixed(1);
          return ` Your BMI is <strong>${b}</strong>.`;
        })()
      : "";
    const diet = p.diet && p.diet !== "No preference" ? ` I'll keep your <strong>${p.diet}</strong> diet in mind for all meal suggestions.` : "";
    appendMessage(
      "assistant",
      `Hey ${name}! 👋 I'm **Fitness Buddy**, your personal AI coach.${goal}${bmi}${diet}\n\nI've loaded your profile and every recommendation I give will be tailored specifically for you. What would you like help with today?`,
      false  // skip hero-banner-hide so it stays until user types
    );
  }
});

// ── Category switcher ─────────────────────────────────────────────────────────
function setCategory(btn, cat) {
  // Remove active class from all category buttons
  document.querySelectorAll(".cat-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  activeCategory = cat;
  renderChips(cat);
}

function renderChips(cat) {
  const prompts = PROMPTS[cat] || [];
  chipsEl.innerHTML = prompts
    .map(p => `<button class="chip" onclick="sendQuickPrompt(this)">${p}</button>`)
    .join("");
}

// ── Auto-resize textarea ──────────────────────────────────────────────────────
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + "px";
});

// ── Keyboard: Enter to send, Shift+Enter for newline ─────────────────────────
function handleKeyDown(event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

// ── Format timestamp ──────────────────────────────────────────────────────────
function getTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ── Append a message to the feed ─────────────────────────────────────────────
/**
 * @param {string} role  - "user" | "assistant"
 * @param {string} text  - Raw message text (supports **bold** and *italic*)
 */
function appendMessage(role, text, hideHero = true) {
  // Hide the hero banner after the first real message (unless explicitly suppressed)
  if (hideHero && heroBanner && heroBanner.style.display !== "none") {
    heroBanner.style.display = "none";
  }

  const row = document.createElement("div");
  row.classList.add("msg-row", role);

  // Avatar
  const avatar = document.createElement("div");
  avatar.classList.add("msg-avatar", role === "assistant" ? "ai-avatar" : "user-avatar");
  if (role === "assistant") {
    avatar.innerHTML = `<svg viewBox="0 0 24 24" fill="none" width="18" height="18"><path d="M12 2a5 5 0 110 10A5 5 0 0112 2zM4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`;
  } else {
    avatar.textContent = "You";
  }

  // Bubble + timestamp wrapper
  const msgWrapper = document.createElement("div");

  const bubble = document.createElement("div");
  bubble.classList.add("msg-bubble");
  bubble.innerHTML = formatText(text);

  const time = document.createElement("div");
  time.classList.add("msg-time");
  time.textContent = getTime();

  msgWrapper.appendChild(bubble);
  msgWrapper.appendChild(time);

  row.appendChild(avatar);
  row.appendChild(msgWrapper);
  messagesEl.appendChild(row);
  scrollToBottom();
}

// ── Text formatter — escapes HTML, applies basic markdown ────────────────────
function formatText(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br>");
}

// ── Scroll to bottom ──────────────────────────────────────────────────────────
function scrollToBottom() {
  setTimeout(() => { messagesEl.scrollTop = messagesEl.scrollHeight; }, 50);
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function showTyping() { typingEl.style.display = "flex"; scrollToBottom(); }
function hideTyping() { typingEl.style.display = "none"; }

// ── Send message ──────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  inputEl.value = "";
  inputEl.style.height = "auto";
  sendBtn.disabled = true;

  appendMessage("user", text);
  conversationHistory.push({ role: "user", content: text });

  showTyping();

  try {
    const res = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conversationHistory.slice(0, -1),
      }),
    });

    const data = await res.json();
    hideTyping();

    const reply = data.reply || "Sorry, I didn't get a response. Please try again.";
    appendMessage("assistant", reply);
    conversationHistory.push({ role: "assistant", content: reply });

    // Cap history to last 10 messages to stay within token limits
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }

  } catch (err) {
    hideTyping();
    appendMessage("assistant", "Connection error — please check your internet and try again. 🙏");
    console.error("[Fitness Buddy] Chat error:", err);
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

// ── Prompt map for hero-banner pill buttons ───────────────────────────────────
// Keys are the pill label text (lowercase, emoji stripped). When a pill is
// clicked its label is looked up here and expanded into a full chat prompt.
const PILL_PROMPTS = {
  "workouts":       "Give me a personalised workout plan based on my fitness goal and activity level.",
  "meal plans":     "Suggest a weekly meal plan that matches my dietary preference and fitness goal.",
  "habit tracking": "Help me build a daily fitness habit and keep my streak going. Give me a simple actionable plan.",
  "mindset":        "Give me motivation and mindset tips to stay consistent with my fitness journey.",
  "recovery":       "What are the best recovery practices — stretching, sleep, and rest days — for my activity level?",
};

// ── Quick prompt chip / pill click ────────────────────────────────────────────
// Works for both sidebar chips (pass full prompt text) and hero pills (map label → prompt).
function sendQuickPrompt(btn) {
  const rawLabel = btn.textContent.trim();
  // Strip leading emoji (any non-ASCII chars + following space) to get the keyword
  const keyword  = rawLabel.replace(/^[\p{Emoji}\s]+/u, "").trim().toLowerCase();
  const prompt   = PILL_PROMPTS[keyword] || rawLabel;
  inputEl.value  = prompt;
  sendMessage();
}

// ── Clear conversation ────────────────────────────────────────────────────────
function clearChat() {
  messagesEl.innerHTML = "";
  conversationHistory = [];
  if (heroBanner) heroBanner.style.display = "block";
}

// ── Daily check-in ────────────────────────────────────────────────────────────
async function handleCheckin() {
  checkinBtn.disabled = true;
  checkinBtn.innerHTML = `
    <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg>
    Saving…`;

  try {
    const res  = await fetch("/checkin", { method: "POST" });
    const data = await res.json();

    streakEl.textContent = data.streak;
    totalEl.textContent  = data.total;
    checkinMsgEl.textContent = data.message;

    checkinBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      Logged!`;

    // Echo the milestone into the chat
    appendMessage("assistant", `🎉 Check-in recorded! ${data.message}`);

  } catch (err) {
    checkinMsgEl.textContent = "Couldn't save. Please try again.";
    checkinBtn.disabled = false;
    checkinBtn.innerHTML = `
      <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
      Log Today's Workout`;
    console.error("[Fitness Buddy] Check-in error:", err);
  }
}
