/**
 * YouSkipAI — Content Script
 *
 * Injected into youtube.com pages. Monitors navigation, fetches sponsor
 * segments from the backend API, and skips them in real-time.
 */

(() => {
  "use strict";

  // ── State ──────────────────────────────────────
  const DEFAULT_API_URL = "http://localhost:8000";
  let currentVideoId = null;
  let segments = [];
  let enabled = true;
  let apiUrl = DEFAULT_API_URL;
  let skipTimerId = null;
  let notificationTimerId = null;
  let totalSkips = 0;
  let totalSecondsSaved = 0;
  let skipDisabledUntil = 0;
  let bannerTimerId = null;
  let bannerCountdownIntervalId = null;

  // ── Helpers ────────────────────────────────────

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

  // ── Notification Overlay ───────────────────────

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

  // ── API Communication ──────────────────────────

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

  // ── Skip Logic ─────────────────────────────────

  /**
   * Safe check to ensure the segment overlays are present in the progress bars.
   */
  function ensureTimelineOverlay() {
    if (segments.length === 0) return;
    const container = document.querySelector(".youskip-segments-container");
    if (!container) {
      updateTimelineOverlay();
    }
  }

  /**
   * Render the timeline sponsor segment overlays inside YouTube's progress bars.
   */
  function updateTimelineOverlay() {
    const video = getVideoElement();
    if (!video || !video.duration || segments.length === 0) return;

    const progressBar =
      document.querySelector("#movie_player .ytp-progress-list") ||
      document.querySelector(".ytp-progress-list") ||
      document.querySelector(".ytp-progress-bar");
    if (!progressBar) return;

    let container = progressBar.querySelector(".youskip-segments-container");
    if (!container) {
      container = document.createElement("div");
      container.className = "youskip-segments-container";
      progressBar.appendChild(container);
    } else {
      container.innerHTML = "";
    }

    segments.forEach((seg) => {
      const startPct = (seg.start / video.duration) * 100;
      const endPct = (seg.end / video.duration) * 100;
      const widthPct = endPct - startPct;

      const segmentDiv = document.createElement("div");
      segmentDiv.className = "youskip-timeline-segment";
      segmentDiv.style.left = `${startPct}%`;
      segmentDiv.style.width = `${widthPct}%`;
      container.appendChild(segmentDiv);
    });
  }

  /**
   * Show an interactive countdown skip banner with an Unskip button.
   * @param {Object} seg - The skipped sponsor segment object.
   */
  function showSkipBanner(seg) {
    const existing = document.getElementById("youskip-skip-banner");
    if (existing) existing.remove();
    if (bannerTimerId) clearTimeout(bannerTimerId);
    if (bannerCountdownIntervalId) clearInterval(bannerCountdownIntervalId);

    const banner = document.createElement("div");
    banner.id = "youskip-skip-banner";

    let secondsLeft = 7;

    banner.innerHTML = `
      <div class="youskip-banner-header">
        <div class="youskip-banner-title-wrapper">
          <span style="font-size: 15px;">⚡</span>
          <span class="youskip-banner-title">Sponsor Skipped</span>
        </div>
        <div class="youskip-banner-meta">
          <span id="youskip-countdown" class="youskip-banner-countdown">
            closes in ${secondsLeft}s
          </span>
          <button id="youskip-close-btn" class="youskip-banner-close">✕</button>
        </div>
      </div>
      <div class="youskip-banner-actions">
        <button id="youskip-unskip-btn" class="youskip-banner-btn youskip-banner-btn-unskip">
          Unskip
        </button>
      </div>
    `;

    const playerContainer =
      document.querySelector("#movie_player") ||
      document.querySelector(".html5-video-player");
    if (playerContainer) {
      playerContainer.appendChild(banner);
    } else {
      document.body.appendChild(banner);
    }

    requestAnimationFrame(() => banner.classList.add("youskip-banner-visible"));

    const unskipBtn = banner.querySelector("#youskip-unskip-btn");
    unskipBtn.addEventListener("click", () => {
      const video = getVideoElement();
      if (video) {
        console.log(
          `[YouSkipAI] User requested Unskip. Seeking to ${seg.start.toFixed(1)}s.`
        );
        skipDisabledUntil = seg.end;
        video.currentTime = seg.start;
        if (video.paused) {
          video.play().catch(() => {});
        }
      }
      dismissBanner();
    });

    const closeBtn = banner.querySelector("#youskip-close-btn");
    closeBtn.addEventListener("click", () => {
      dismissBanner();
    });

    function dismissBanner() {
      if (bannerCountdownIntervalId) clearInterval(bannerCountdownIntervalId);
      if (bannerTimerId) clearTimeout(bannerTimerId);
      
      banner.classList.remove("youskip-banner-visible");
      banner.addEventListener("transitionend", () => banner.remove(), { once: true });
      setTimeout(() => banner.remove(), 400);
    }

    const countdownSpan = banner.querySelector("#youskip-countdown");
    bannerCountdownIntervalId = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(bannerCountdownIntervalId);
      } else {
        countdownSpan.textContent = `closes in ${secondsLeft}s`;
      }
    }, 1000);

    bannerTimerId = setTimeout(() => {
      dismissBanner();
    }, secondsLeft * 1000);
  }

  /**
   * Check if the current playback time falls within a sponsor segment
   * and skip past it if so.
   */
  function checkAndSkip() {
    if (!enabled || segments.length === 0) return;

    const video = getVideoElement();
    if (!video) return;

    // Draw overlay if missing
    ensureTimelineOverlay();

    const currentTime = video.currentTime;

    for (const seg of segments) {
      if (currentTime >= seg.start && currentTime < seg.end - 0.5) {
        // Ignore skip if we unskipped this segment and are still inside it
        if (skipDisabledUntil > 0 && currentTime < skipDisabledUntil) {
          continue;
        }

        console.log(
          `[YouSkipAI] Skipping: ${seg.start.toFixed(1)}s → ${seg.end.toFixed(1)}s`
        );
        video.currentTime = seg.end;
        showSkipBanner(seg);
        
        // Update stats - skip count and time saved
        const segmentDuration = seg.end - seg.start;
        totalSkips += 1;
        totalSecondsSaved += Math.round(segmentDuration);
        
        if (typeof chrome !== "undefined" && chrome.storage) {
          chrome.storage.local.set({
            totalSkips: totalSkips,
            totalSecondsSaved: totalSecondsSaved,
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

  // ── Video Change Detection ─────────────────────

  /**
   * Handle a new video being loaded.
   * @param {string} videoId - The new video's ID.
   */
  async function onVideoChange(videoId) {
    if (videoId === currentVideoId) return;
    currentVideoId = videoId;
    segments = [];
    stopSkipMonitor();

    // Clean up existing overlay and timer bypass
    document.querySelectorAll(".youskip-segments-container").forEach(el => el.remove());
    const banner = document.getElementById("youskip-skip-banner");
    if (banner) banner.remove();
    if (bannerTimerId) clearTimeout(bannerTimerId);
    if (bannerCountdownIntervalId) clearInterval(bannerCountdownIntervalId);
    skipDisabledUntil = 0;

    if (!enabled) return;

    console.log(`[YouSkipAI] Analyzing video: ${videoId}`);
    segments = await fetchSegments(videoId);

    if (segments.length > 0) {
      console.log(`[YouSkipAI] Found ${segments.length} sponsor segment(s)`);
      showNotification(`🔍 ${segments.length} sponsor(s) detected`, 4000);
      startSkipMonitor();

      // Attempt immediate render if duration is ready
      const video = getVideoElement();
      if (video) {
        video.addEventListener("durationchange", updateTimelineOverlay, { once: true });
        video.addEventListener("loadedmetadata", updateTimelineOverlay, { once: true });
        if (video.duration) {
          updateTimelineOverlay();
        }
      }
    } else {
      console.log("[YouSkipAI] No sponsor segments detected");
    }
  }

  // ── Navigation Observer ────────────────────────
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

  // ── Settings Sync ──────────────────────────────

  /**
   * Load saved settings from chrome.storage.
   */
  function loadSettings() {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        ["enabled", "apiUrl", "totalSkips", "totalSecondsSaved"],
        (result) => {
          enabled = result.enabled !== false; // Default to true
          if (result.apiUrl) apiUrl = result.apiUrl;
          totalSkips = result.totalSkips || 0;
          totalSecondsSaved = result.totalSecondsSaved || 0;
          console.log(`[YouSkipAI] Settings loaded: enabled=${enabled}, apiUrl=${apiUrl}`);
        }
      );

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
            document.querySelectorAll(".youskip-segments-container").forEach(el => el.remove());
            const banner = document.getElementById("youskip-skip-banner");
            if (banner) banner.remove();
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

  // ── Init ───────────────────────────────────────

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
