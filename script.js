/* ============================================
   MTM HACKATHON — JavaScript (Groq + MongoDB)
   Chat history with backend persistence
============================================ */

// 🔑 STEP 1: PASTE YOUR API KEY HERE
const API_KEY = "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";

// Groq API endpoint
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Backend API base URL
const BACKEND = "http://localhost:3000/api";

// DOM references
const userInput    = document.getElementById("user-input");
const sendBtn      = document.getElementById("send-btn");
const clearBtn     = document.getElementById("clear-btn");
const loading      = document.getElementById("loading");
const messagesArea = document.getElementById("messages-area");
const statusText   = document.getElementById("status-text");
const chatList     = document.getElementById("chat-list");
const chatListEmpty = document.getElementById("chat-list-empty");
const newChatBtn   = document.getElementById("new-chat-btn");
const searchInput  = document.getElementById("search-chats");

// State
let currentChatId = null;
let conversationHistory = [];
let allChats = [];

/* ─────────────────────────────────────────────
   INITIALIZATION
───────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  loadChatList();
});

/* ─────────────────────────────────────────────
   BACKEND API HELPERS
───────────────────────────────────────────── */
async function apiGet(path) {
  const res = await fetch(`${BACKEND}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiPost(path, data) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiPut(path, data) {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(`${BACKEND}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/* ─────────────────────────────────────────────
   CHAT LIST (SIDEBAR)
───────────────────────────────────────────── */
async function loadChatList() {
  try {
    allChats = await apiGet("/chats");
    renderChatList(allChats);
  } catch (err) {
    console.warn("Backend unavailable, running in local-only mode:", err.message);
  }
}

function renderChatList(chats) {
  // Remove old items but keep empty state
  chatList.querySelectorAll(".chat-item").forEach(el => el.remove());

  if (chats.length === 0) {
    chatListEmpty.style.display = "flex";
    return;
  }
  chatListEmpty.style.display = "none";

  chats.forEach(chat => {
    const item = document.createElement("div");
    item.className = `chat-item${chat._id === currentChatId ? " active" : ""}`;
    item.dataset.id = chat._id;

    const timeAgo = getTimeAgo(new Date(chat.updatedAt));
    const msgCount = chat.messageCount || 0;

    item.innerHTML = `
      <div class="chat-item-icon">💬</div>
      <div class="chat-item-info">
        <div class="chat-item-title">${escapeHtml(chat.title)}</div>
        <div class="chat-item-meta">${msgCount} msgs · ${timeAgo}</div>
      </div>
      <button class="chat-item-delete" title="Delete chat" onclick="event.stopPropagation(); deleteChat('${chat._id}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/>
        </svg>
      </button>
    `;

    item.addEventListener("click", () => loadChat(chat._id));
    chatList.appendChild(item);
  });
}

/* ─────────────────────────────────────────────
   CHAT CRUD OPERATIONS
───────────────────────────────────────────── */
async function createNewChat() {
  clearMessagesUI();
  currentChatId = null;
  conversationHistory = [];
  // Highlight nothing in sidebar
  chatList.querySelectorAll(".chat-item").forEach(el => el.classList.remove("active"));
  userInput.focus();
}

async function loadChat(chatId) {
  try {
    statusText.textContent = "Loading…";
    const chat = await apiGet(`/chats/${chatId}`);
    currentChatId = chatId;
    conversationHistory = chat.messages.map(m => ({ role: m.role, content: m.content }));

    // Render messages
    clearMessagesUI();
    chat.messages.forEach(msg => {
      if (msg.role === "user") appendUserBubble(msg.content);
      else if (msg.role === "assistant") appendAIBubble(msg.content);
    });

    // Highlight active in sidebar
    chatList.querySelectorAll(".chat-item").forEach(el => {
      el.classList.toggle("active", el.dataset.id === chatId);
    });

    statusText.textContent = "Ready";
  } catch (err) {
    console.error("Failed to load chat:", err);
    statusText.textContent = "Error";
  }
}

async function deleteChat(chatId) {
  try {
    await apiDelete(`/chats/${chatId}`);
    if (currentChatId === chatId) createNewChat();
    loadChatList();
  } catch (err) {
    console.error("Failed to delete chat:", err);
  }
}

async function saveMessages() {
  try {
    if (currentChatId) {
      await apiPut(`/chats/${currentChatId}`, { messages: conversationHistory });
    } else {
      // Create new chat — use first user message as title
      const firstMsg = conversationHistory.find(m => m.role === "user");
      const title = firstMsg ? firstMsg.content.substring(0, 60) : "New Chat";
      const chat = await apiPost("/chats", { title, messages: conversationHistory });
      currentChatId = chat._id;
    }
    loadChatList();
  } catch (err) {
    console.warn("Failed to save to MongoDB:", err.message);
  }
}

/* ─────────────────────────────────────────────
   SEARCH CHATS
───────────────────────────────────────────── */
searchInput.addEventListener("input", () => {
  const q = searchInput.value.toLowerCase().trim();
  if (!q) {
    renderChatList(allChats);
    return;
  }
  const filtered = allChats.filter(c => c.title.toLowerCase().includes(q));
  renderChatList(filtered);
});

/* ─────────────────────────────────────────────
   UI: Append bubbles
───────────────────────────────────────────── */
function appendUserBubble(text) {
  const row = document.createElement("div");
  row.className = "user-row";
  row.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
  messagesArea.appendChild(row);
  scrollToBottom();
}

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
        <button class="action-btn" onclick="copyResponse(this, document.getElementById('${contentId}').innerText)" title="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
    </div>
  `;
  messagesArea.appendChild(row);
  scrollToBottom();
}

function clearMessagesUI() {
  messagesArea.innerHTML = "";
  // Re-add welcome message
  const welcome = document.createElement("div");
  welcome.className = "welcome-msg";
  welcome.innerHTML = `
    <div class="ai-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 4v4l3 3"/>
      </svg>
    </div>
    <div class="welcome-bubble">
      <p>Hello! I'm your AI assistant for the MTM Hackathon. Ask me anything!</p>
    </div>
  `;
  messagesArea.appendChild(welcome);
}

/* ─────────────────────────────────────────────
   MAIN: Send prompt to Groq AI
───────────────────────────────────────────── */
async function generateResponse() {
  const prompt = userInput.value.trim();
  if (!prompt) return;

  if (API_KEY === "YOUR_API_KEY_HERE") {
    appendAIBubble("⚠️ Please add your Groq API key in script.js line 8.");
    return;
  }

  conversationHistory.push({ role: "user", content: prompt });
  appendUserBubble(prompt);
  userInput.value = "";
  userInput.style.height = "auto";

  sendBtn.disabled = true;
  loading.classList.remove("hidden");
  statusText.textContent = "Processing…";
  scrollToBottom();

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a helpful, concise AI assistant for the MTM AI Hackathon 2026." },
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
    const aiText = data.choices?.[0]?.message?.content || "No response received.";

    conversationHistory.push({ role: "assistant", content: aiText });
    appendAIBubble(aiText);
    statusText.textContent = "Ready";

    // Save to MongoDB
    saveMessages();
  } catch (error) {
    console.error("Groq API Error:", error);
    appendAIBubble(`❌ Error: ${error.message}`);
    statusText.textContent = "Error";
    conversationHistory.pop();
  } finally {
    sendBtn.disabled = false;
    loading.classList.add("hidden");
    userInput.focus();
  }
}

/* ─────────────────────────────────────────────
   CLEAR ALL
───────────────────────────────────────────── */
function clearAll() {
  createNewChat();
  statusText.textContent = "Ready";
}

/* ─────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────── */
function scrollToBottom() {
  requestAnimationFrame(() => { messagesArea.scrollTop = messagesArea.scrollHeight; });
}

function escapeHtml(text) {
  return text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function formatResponse(text) {
  return escapeHtml(text)
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.08);padding:2px 6px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function getTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

/* ─────────────────────────────────────────────
   EVENT LISTENERS
───────────────────────────────────────────── */
sendBtn.addEventListener("click", generateResponse);
clearBtn.addEventListener("click", clearAll);
newChatBtn.addEventListener("click", createNewChat);

userInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); generateResponse(); }
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateResponse(); }
});

console.log("✅ MTM Hackathon Starter loaded — MongoDB chat history enabled.");
