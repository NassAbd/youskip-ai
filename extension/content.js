/**
 * YouSkipAI — Content Script
 *
 * Injected into youtube.com pages. Monitors navigation, fetches sponsor
 * segments from the backend API, and skips them in real-time.
 */

(() => {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────
  const DEFAULT_API_URL = "http://localhost:8000";
  let currentVideoId = null;
  let segments = [];
  let enabled = true;
  let apiUrl = DEFAULT_API_URL;
  let skipTimerId = null;
  let notificationTimerId = null;
  let totalSkips = 0;
  let totalSecondsSaved = 0;


  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Extract the video_id from the current YouTube URL.
   * @returns {string|null} Video ID or null if not a watch page.
   */
  function getVideoId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("v");
  }

  /**
   * Get the YouTube HTML5 video element.
   * @returns {HTMLVideoElement|null}
   */
  function getVideoElement() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  // ── Notification Overlay ───────────────────────────────────────────

  /**
   * Show a discreet notification overlay on the video player.
   * @param {string} message - Text to display.
   * @param {number} durationMs - How long to show the notification.
   */
  function showNotification(message, durationMs = 3000) {
    // Remove any existing notification
    const existing = document.getElementById("sponsor-ai-notification");
    if (existing) existing.remove();
    if (notificationTimerId) clearTimeout(notificationTimerId);

    const overlay = document.createElement("div");
    overlay.id = "sponsor-ai-notification";
    overlay.textContent = message;

    // Insert into the video player container for proper positioning
    const playerContainer =
      document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
    if (playerContainer) {
      playerContainer.style.position = "relative";
      playerContainer.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }

    // Trigger entrance animation
    requestAnimationFrame(() => overlay.classList.add("sponsor-ai-visible"));

    notificationTimerId = setTimeout(() => {
      overlay.classList.remove("sponsor-ai-visible");
      overlay.addEventListener("transitionend", () => overlay.remove(), { once: true });
      // Fallback removal if transition doesn't fire
      setTimeout(() => overlay.remove(), 500);
    }, durationMs);
  }

  // ── API Communication ──────────────────────────────────────────────

  /**
   * Fetch sponsor segments from the backend API.
   * @param {string} videoId - YouTube video ID.
   * @returns {Promise<Array<{start: number, end: number, type: string, confidence: number}>>}
   */
  async function fetchSegments(videoId) {
    try {
      const response = await fetch(`${apiUrl}/analyze/${videoId}`);
      if (!response.ok) {
        console.warn(`[YouSkipAI] API returned ${response.status} for ${videoId}`);
        return [];
      }
      const data = await response.json();
      return data.segments || [];
    } catch (error) {
      console.warn(`[YouSkipAI] API unreachable: ${error.message}`);
      return [];
    }
  }

  // ── Skip Logic ─────────────────────────────────────────────────────

  /**
   * Check if the current playback time falls within a sponsor segment
   * and skip past it if so.
   */
  function checkAndSkip() {
    if (!enabled || segments.length === 0) return;

    const video = getVideoElement();
    if (!video) return;

    const currentTime = video.currentTime;

    for (const seg of segments) {
      // Allow a small tolerance window (0.5s) to catch the segment entry
      if (currentTime >= seg.start && currentTime < seg.end - 0.5) {
        console.log(
          `[YouSkipAI] Skipping sponsor: ${seg.start.toFixed(1)}s → ${seg.end.toFixed(1)}s (confidence: ${seg.confidence})`
        );
        video.currentTime = seg.end;
        showNotification("⚡ Sponsor skipped by YouSkipAI");
        
        // Update stats - skip count and time saved
        const segmentDuration = seg.end - seg.start;
        totalSkips += 1;
        totalSecondsSaved += Math.round(segmentDuration);
        
        // Persist to chrome.storage for the popup
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({
            totalSkips: totalSkips,
            totalSecondsSaved: totalSecondsSaved
          });
        }
        break;
      }
    }
  }

  /**
   * Start the skip-checking interval.
   */
  function startSkipMonitor() {
    stopSkipMonitor();
    // Check every 500ms — lightweight and responsive enough
    skipTimerId = setInterval(checkAndSkip, 500);
  }

  /**
   * Stop the skip-checking interval.
   */
  function stopSkipMonitor() {
    if (skipTimerId) {
      clearInterval(skipTimerId);
      skipTimerId = null;
    }
  }

  // ── Video Change Detection ─────────────────────────────────────────

  /**
   * Handle a new video being loaded.
   * @param {string} videoId - The new video's ID.
   */
  async function onVideoChange(videoId) {
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;
    segments = [];
    stopSkipMonitor();

    if (!enabled) return;

    console.log(`[YouSkipAI] Analyzing video: ${videoId}`);
    segments = await fetchSegments(videoId);

    if (segments.length > 0) {
      console.log(`[YouSkipAI] Found ${segments.length} sponsor segment(s)`);
      showNotification(`🔍 ${segments.length} sponsor(s) detected`, 4000);
      startSkipMonitor();
    } else {
      console.log("[YouSkipAI] No sponsor segments detected");
    }
  }

  // ── Navigation Observer ────────────────────────────────────────────
  // YouTube is a SPA — standard page loads don't fire on navigation.
  // We use a MutationObserver on the <title> as a reliable proxy for
  // navigation events, combined with the yt-navigate-finish event.

  /**
   * Poll-check the current URL for a video ID change.
   */
  function checkForVideoChange() {
    const videoId = getVideoId();
    if (videoId && videoId !== currentVideoId) {
      onVideoChange(videoId);
    }
  }

  // Listen for YouTube's SPA navigation event
  window.addEventListener("yt-navigate-finish", checkForVideoChange);

  // Fallback: observe URL changes via popstate
  window.addEventListener("popstate", checkForVideoChange);

  // Fallback: periodic check (handles edge cases with player mini-nav)
  setInterval(checkForVideoChange, 2000);

  // ── Settings Sync ──────────────────────────────────────────────────

  /**
   * Load saved settings from chrome.storage.
   */
  function loadSettings() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(["enabled", "apiUrl", "totalSkips", "totalSecondsSaved"], (result) => {
        enabled = result.enabled !== false; // Default to true
        if (result.apiUrl) apiUrl = result.apiUrl;
        totalSkips = result.totalSkips || 0;
        totalSecondsSaved = result.totalSecondsSaved || 0;
        console.log(`[YouSkipAI] Settings loaded: enabled=${enabled}, apiUrl=${apiUrl}`);
      });

      // Listen for settings changes from the popup
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        if (changes.enabled) {
          enabled = changes.enabled.newValue;
          console.log(`[YouSkipAI] Extension ${enabled ? "Enabled" : "Disabled"}`);
          if (enabled) {
            const vid = getVideoId();
            if (vid) {
              currentVideoId = null; // Reset to force re-analysis
              onVideoChange(vid);
            }
          } else {
            stopSkipMonitor();
            segments = [];
          }
        }
        if (changes.apiUrl) {
          apiUrl = changes.apiUrl.newValue || DEFAULT_API_URL;
          console.log(`[YouSkipAI] API URL updated: ${apiUrl}`);
          const vid = getVideoId();
          if (vid && enabled) {
            currentVideoId = null;
            onVideoChange(vid);
          }
        }
      });
    }
  }

  // ── Init ───────────────────────────────────────────────────────────

  function init() {
    loadSettings();
    checkForVideoChange();
    console.log("[YouSkipAI] Content script loaded");
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
