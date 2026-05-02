/**
 * Sponsor-AI — Popup Script
 * Manages toggle state, API URL config, and health check display.
 */

const DEFAULT_API = "http://localhost:8000";

const toggleEl = document.getElementById("toggle-enabled");
const apiUrlEl = document.getElementById("api-url");
const saveBtn = document.getElementById("save-url");
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");

// ── Load saved settings ──────────────────────────────────────────────
chrome.storage.sync.get(["enabled", "apiUrl"], (result) => {
  toggleEl.checked = result.enabled !== undefined ? result.enabled : true;
  apiUrlEl.value = result.apiUrl || DEFAULT_API;
  checkHealth(apiUrlEl.value);
});

// ── Toggle handler ───────────────────────────────────────────────────
toggleEl.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: toggleEl.checked });
});

// ── Save API URL ─────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  const url = apiUrlEl.value.trim().replace(/\/+$/, "");
  if (url) {
    chrome.storage.sync.set({ apiUrl: url });
    checkHealth(url);
    saveBtn.textContent = "✓";
    setTimeout(() => { saveBtn.textContent = "✓"; }, 1500);
  }
});

// ── Health check ─────────────────────────────────────────────────────
async function checkHealth(baseUrl) {
  statusDot.className = "status-dot";
  statusText.textContent = "Vérification...";
  try {
    const resp = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      statusDot.classList.add("online");
      statusText.textContent = "API connectée";
    } else {
      throw new Error("not ok");
    }
  } catch {
    statusDot.classList.add("offline");
    statusText.textContent = "API hors ligne";
  }
}
