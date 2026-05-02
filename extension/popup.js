/**
 * YouSkipAI — Popup Script
 * Manages toggle state, API URL config, and health check display.
 */

const DEFAULT_API = "http://localhost:8000";

const toggleEl = document.getElementById("toggle-enabled");
const apiUrlEl = document.getElementById("api-url");
const saveBtn = document.getElementById("save-url");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const savedTimeEl = document.getElementById("savedTime");
const skipCountEl = document.getElementById("skipCount");

function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// ── Load saved settings ──────────────────────────────────────────────
chrome.storage.local.get(["enabled", "apiUrl", "totalSecondsSaved", "totalSkips"], (result) => {
  toggleEl.checked = result.enabled !== false; // Default to true
  apiUrlEl.value = result.apiUrl || DEFAULT_API;
  
  // Update Stats
  if (savedTimeEl) savedTimeEl.textContent = formatTime(result.totalSecondsSaved || 0);
  if (skipCountEl) skipCountEl.textContent = result.totalSkips || 0;
  
  checkHealth(apiUrlEl.value);
});

// ── Toggle handler ───────────────────────────────────────────────────
toggleEl.addEventListener("change", () => {
  const isEnabled = toggleEl.checked;
  chrome.storage.local.set({ enabled: isEnabled });
  
  // Notify content scripts in all tabs
  chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_ENABLED", enabled: isEnabled });
    });
  });
});

// ── Save API URL ─────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  const url = apiUrlEl.value.trim().replace(/\/+$/, "");
  if (url) {
    chrome.storage.local.set({ apiUrl: url });
    checkHealth(url);
    const originalText = saveBtn.textContent;
    saveBtn.textContent = "✓";
    setTimeout(() => { saveBtn.textContent = originalText; }, 1500);
  }
});

// ── Health check ─────────────────────────────────────────────────────
async function checkHealth(baseUrl) {
  statusDot.className = "status-dot";
  statusText.textContent = "Checking...";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    const resp = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (resp.ok) {
      statusDot.classList.add("online");
      statusText.textContent = "API Connected";
    } else {
      throw new Error();
    }
  } catch {
    statusDot.classList.add("offline");
    statusText.textContent = "API Offline";
  }
}
