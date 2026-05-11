/* ============================================
   MTM HACKATHON STARTER — JavaScript (Groq)

   ⚠️  IMPORTANT:
   1. Get your FREE Groq API key from:
      https://console.groq.com/keys
   2. Paste it below where it says YOUR_API_KEY_HERE
   3. Save the file and open index.html in a browser
============================================ */

// 🔑 STEP 1: PASTE YOUR API KEY HERE
const API_KEY = "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";

// Groq API endpoint (OpenAI-compatible, very fast & free)
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

// DOM references
const userInput   = document.getElementById("user-input");
const sendBtn     = document.getElementById("send-btn");
const clearBtn    = document.getElementById("clear-btn");
const loading     = document.getElementById("loading");
const messagesArea = document.getElementById("messages-area");
const statusText  = document.getElementById("status-text");

// Conversation history (for context-aware multi-turn chat)
const conversationHistory = [];

/* ─────────────────────────────────────────────
   Append a USER bubble to the chat
───────────────────────────────────────────── */
function appendUserBubble(text) {
  const row = document.createElement("div");
  row.className = "user-row";
  row.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
  messagesArea.appendChild(row);
  scrollToBottom();
}

/* ─────────────────────────────────────────────
   Append an AI response bubble to the chat
───────────────────────────────────────────── */
function appendAIBubble(text) {
  const row = document.createElement("div");
  row.className = "response-row";

  const contentId = `ai-msg-${Date.now()}`;

  row.innerHTML = `
    <div class="ai-avatar small">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v4l3 3"/>
      </svg>
    </div>
    <div class="response-bubble">
      <div class="output-content" id="${contentId}">${formatResponse(text)}</div>
      <div class="response-actions">
        <button class="action-btn" onclick="copyResponse(this, document.getElementById('${contentId}').innerText)" title="Copy response">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
  `;

  // Insert before loading indicator
  messagesArea.appendChild(row);
  scrollToBottom();
}

/* ─────────────────────────────────────────────
   Main: send prompt to Groq AI
───────────────────────────────────────────── */
async function generateResponse() {
  const prompt = userInput.value.trim();

  if (!prompt) return;

  // Check API key
  if (API_KEY === "YOUR_API_KEY_HERE") {
    appendAIBubble("⚠️ Please add your Groq API key in script.js (line 13).\n\nGet a free key at: https://console.groq.com/keys");
    return;
  }

  // Push user message into history & UI
  conversationHistory.push({ role: "user", content: prompt });
  appendUserBubble(prompt);

  // Clear input
  userInput.value = "";
  userInput.style.height = "auto";

  // UI: loading state
  sendBtn.disabled = true;
  loading.classList.remove("hidden");
  statusText.textContent = "Processing…";
  scrollToBottom();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            // 💡 TIP: Customize this system prompt for your hackathon problem!
            role: "system",
            content: "You are a helpful, concise, and expert AI assistant for the MTM AI Hackathon 2026. Help participants brainstorm ideas, write and debug code, and solve problems creatively.",
          },
          ...conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "No response received. Try again.";

    // Push AI reply into history
    conversationHistory.push({ role: "assistant", content: aiText });

    appendAIBubble(aiText);
    statusText.textContent = "Ready";

  } catch (error) {
    console.error("Groq API Error:", error);
    appendAIBubble(`❌ Error: ${error.message}\n\nCheck your API key and internet connection.`);
    statusText.textContent = "Error";
    // Remove failed user message from history
    conversationHistory.pop();
  } finally {
    sendBtn.disabled = false;
    loading.classList.add("hidden");
    userInput.focus();
  }
}

/* ─────────────────────────────────────────────
   Clear all chat messages & history
───────────────────────────────────────────── */
function clearAll() {
  // Keep only the initial welcome message
  const welcomeMsg = messagesArea.querySelector(".welcome-msg");
  messagesArea.innerHTML = "";
  if (welcomeMsg) messagesArea.appendChild(welcomeMsg);

  conversationHistory.length = 0;
  userInput.value = "";
  userInput.style.height = "auto";
  statusText.textContent = "Ready";
  userInput.focus();
}

/* ─────────────────────────────────────────────
   Utilities
───────────────────────────────────────────── */
function scrollToBottom() {
  requestAnimationFrame(() => {
    messagesArea.scrollTop = messagesArea.scrollHeight;
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatResponse(text) {
  // Basic markdown-lite: code blocks, bold, inline code, line breaks
  return escapeHtml(text)
    // ```code block```
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // `inline code`
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;">$1</code>')
    // **bold**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // newlines → <br>
    .replace(/\n/g, '<br>');
}

/* ─────────────────────────────────────────────
   Event Listeners
───────────────────────────────────────────── */
sendBtn.addEventListener("click", generateResponse);
clearBtn.addEventListener("click", clearAll);

// Ctrl/Cmd + Enter to submit
userInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    generateResponse();
  }
  // Enter alone to submit (Shift+Enter = newline)
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    generateResponse();
  }
});

console.log("✅ MTM Hackathon Starter loaded. Edit script.js to customize.");
