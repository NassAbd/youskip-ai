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
  let videoRequestToken = 0;
  let playerObserver = null;

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

  /**
   * Get the YouTube player container used as the anchor for overlays.
   * @returns {HTMLElement|null}
   */
  function getPlayerContainer() {
    return document.querySelector("#movie_player") || document.querySelector(".html5-video-player");
  }

  /**
   * Build a namespaced DOM element for extension UI.
   * @param {string} tag - Tag name to create.
   * @param {string|string[]} classNames - Class or classes to add.
   * @param {string} text - Text content.
   * @returns {HTMLElement}
   */
  function createElement(tag, classNames, text = "") {
    const element = document.createElement(tag);
    const classes = Array.isArray(classNames) ? classNames : [classNames];
    classes.filter(Boolean).forEach((className) => element.classList.add(className));
    if (text) element.textContent = text;
    return element;
  }

  /**
   * Keep only usable sponsor segments for the current video duration.
   * @param {Array<{start: number, end: number, type?: string, confidence?: number}>} rawSegments
   * @param {number} duration
   * @returns {Array<{start: number, end: number, type: string, confidence: number}>}
   */
  function normalizeSegments(rawSegments, duration) {
    const hasDuration = Number.isFinite(duration) && duration > 0;

    return (Array.isArray(rawSegments) ? rawSegments : [])
      .map((segment) => {
        const start = Number(segment.start);
        const end = Number(segment.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

        const normalizedStart = hasDuration
          ? Math.max(0, Math.min(start, duration))
          : Math.max(0, start);
        const normalizedEnd = hasDuration
          ? Math.max(0, Math.min(end, duration))
          : Math.max(0, end);
        if (normalizedEnd <= normalizedStart) return null;

        return {
          start: normalizedStart,
          end: normalizedEnd,
          type: segment.type || "sponsor",
          confidence: Number.isFinite(Number(segment.confidence)) ? Number(segment.confidence) : 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
  }

  /**
   * Stop and clear banner timers.
   */
  function cleanupBannerTimers() {
    if (bannerTimerId) {
      clearTimeout(bannerTimerId);
      bannerTimerId = null;
    }
    if (bannerCountdownIntervalId) {
      clearInterval(bannerCountdownIntervalId);
      bannerCountdownIntervalId = null;
    }
  }

  /**
   * Stop all extension timers.
   */
  function cleanupTimers() {
    if (notificationTimerId) {
      clearTimeout(notificationTimerId);
      notificationTimerId = null;
    }
    cleanupBannerTimers();
  }

  /**
   * Remove all injected UI and disconnect player observers.
   */
  function cleanupOverlays() {
    document.getElementById("sponsor-ai-notification")?.remove();
    document.getElementById("youskip-skip-banner")?.remove();
    document.getElementById("youskip-mini-timeline")?.remove();

    if (playerObserver) {
      playerObserver.disconnect();
      playerObserver = null;
    }
  }

  /**
   * Re-render timeline markers when YouTube rebuilds player controls.
   */
  function observePlayerControls() {
    if (playerObserver || segments.length === 0) return;

    const playerContainer = getPlayerContainer();
    if (!playerContainer) return;

    playerObserver = new MutationObserver(() => {
      if (!enabled || segments.length === 0) return;
      if (!document.getElementById("youskip-mini-timeline")) {
        updateTimelineOverlay();
      }
    });

    playerObserver.observe(playerContainer, { childList: true, subtree: true });
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
    const playerContainer = getPlayerContainer();
    if (playerContainer) {
      playerContainer.style.position = "relative";
      playerContainer.appendChild(overlay);
    } else {
      document.body.appendChild(overlay);
    }

    // Trigger entrance animation
    requestAnimationFrame(() => overlay.classList.add("sponsor-ai-visible"));

    notificationTimerId = setTimeout(() => {
      notificationTimerId = null;
      if (!overlay.isConnected) return;
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
    const container = document.getElementById("youskip-mini-timeline");
    if (!container) {
      updateTimelineOverlay();
    }
  }

  /**
   * Render the timeline sponsor segment overlays inside YouTube's progress bars.
   */
  function updateTimelineOverlay() {
    const video = getVideoElement();
    if (
      !video ||
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      segments.length === 0
    ) {
      return;
    }

    const playerContainer = getPlayerContainer();
    if (!playerContainer) return;

    playerContainer.style.position = "relative";

    let container = document.getElementById("youskip-mini-timeline");
    if (!container) {
      container = document.createElement("div");
      container.id = "youskip-mini-timeline";
      container.setAttribute("aria-label", "Detected sponsor segments");
      playerContainer.appendChild(container);
    } else {
      container.innerHTML = "";
    }

    const track = createElement("div", "youskip-mini-timeline-track");
    container.appendChild(track);

    const renderableSegments = normalizeSegments(segments, video.duration);
    renderableSegments.forEach((seg) => {
      const startPct = (seg.start / video.duration) * 100;
      const endPct = (seg.end / video.duration) * 100;
      const widthPct = endPct - startPct;
      if (widthPct <= 0) return;

      const segmentDiv = document.createElement("div");
      segmentDiv.className = "youskip-mini-timeline-segment";
      segmentDiv.style.left = `${startPct}%`;
      segmentDiv.style.width = `${widthPct}%`;
      segmentDiv.title = `Sponsor ${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s`;
      track.appendChild(segmentDiv);
    });
  }

  /**
   * Show an interactive countdown skip banner with an Unskip button.
   * @param {Object} seg - The skipped sponsor segment object.
   */
  function showSkipBanner(seg) {
    const existing = document.getElementById("youskip-skip-banner");
    if (existing) existing.remove();
    cleanupBannerTimers();

    const banner = document.createElement("div");
    banner.id = "youskip-skip-banner";

    let secondsLeft = 7;

    const header = createElement("div", "youskip-banner-header");
    const titleWrapper = createElement("div", "youskip-banner-title-wrapper");
    const icon = createElement("span", "youskip-banner-icon", "⚡");
    const title = createElement("span", "youskip-banner-title", "Sponsor Skipped");
    titleWrapper.append(icon, title);

    const meta = createElement("div", "youskip-banner-meta");
    const countdownSpan = createElement(
      "span",
      "youskip-banner-countdown",
      `closes in ${secondsLeft}s`
    );
    const closeBtn = createElement("button", "youskip-banner-close", "✕");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close");
    meta.append(countdownSpan, closeBtn);
    header.append(titleWrapper, meta);

    const actions = createElement("div", "youskip-banner-actions");
    const unskipBtn = createElement(
      "button",
      ["youskip-banner-btn", "youskip-banner-btn-unskip"],
      "Unskip"
    );
    unskipBtn.type = "button";
    actions.appendChild(unskipBtn);
    banner.append(header, actions);

    const playerContainer = getPlayerContainer();
    if (playerContainer) {
      playerContainer.style.position = "relative";
      playerContainer.appendChild(banner);
    } else {
      document.body.appendChild(banner);
    }

    requestAnimationFrame(() => banner.classList.add("youskip-banner-visible"));

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

    closeBtn.addEventListener("click", () => {
      dismissBanner();
    });

    function dismissBanner() {
      cleanupBannerTimers();
      if (!banner.isConnected) return;

      banner.classList.remove("youskip-banner-visible");
      banner.addEventListener("transitionend", () => banner.remove(), { once: true });
      setTimeout(() => banner.remove(), 400);
    }

    bannerCountdownIntervalId = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft <= 0) {
        clearInterval(bannerCountdownIntervalId);
        bannerCountdownIntervalId = null;
      } else {
        countdownSpan.textContent = `closes in ${secondsLeft}s`;
      }
    }, 1000);

    bannerTimerId = setTimeout(() => {
      bannerTimerId = null;
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
    const requestToken = ++videoRequestToken;
    currentVideoId = videoId;
    segments = [];
    stopSkipMonitor();

    // Clean up existing overlay and timer bypass
    cleanupTimers();
    cleanupOverlays();
    skipDisabledUntil = 0;

    if (!enabled) return;

    console.log(`[YouSkipAI] Analyzing video: ${videoId}`);
    const fetchedSegments = await fetchSegments(videoId);
    if (requestToken !== videoRequestToken || videoId !== currentVideoId || !enabled) {
      console.log(`[YouSkipAI] Ignoring stale analysis result for: ${videoId}`);
      return;
    }

    const video = getVideoElement();
    segments = normalizeSegments(fetchedSegments, video?.duration);

    if (segments.length > 0) {
      console.log(`[YouSkipAI] Found ${segments.length} sponsor segment(s)`);
      showNotification(`🔍 ${segments.length} sponsor(s) detected`, 4000);
      startSkipMonitor();

      // Attempt immediate render if duration is ready
      if (video) {
        video.addEventListener("durationchange", updateTimelineOverlay, { once: true });
        video.addEventListener(
          "loadedmetadata",
          () => {
            segments = normalizeSegments(segments, video.duration);
            updateTimelineOverlay();
          },
          { once: true }
        );
        if (video.duration) {
          segments = normalizeSegments(segments, video.duration);
          updateTimelineOverlay();
        }
      }
      observePlayerControls();
    } else {
      console.log("[YouSkipAI] No sponsor segments detected");
    }
  }

  // ── Navigation Observer ────────────────────────
  // YouTube is a SPA — standard page loads don't fire on navigation.
  // We combine YouTube's navigation event with popstate and polling.

  /**
   * Poll-check the current URL for a video ID change.
   */
  function checkForVideoChange() {
    const videoId = getVideoId();
    if (!videoId && currentVideoId) {
      videoRequestToken += 1;
      currentVideoId = null;
      segments = [];
      stopSkipMonitor();
      cleanupTimers();
      cleanupOverlays();
      skipDisabledUntil = 0;
      return;
    }

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
  function loadSettings(onReady = () => {}) {
    if (typeof chrome !== "undefined" && chrome.storage) {
      chrome.storage.local.get(
        ["enabled", "apiUrl", "totalSkips", "totalSecondsSaved"],
        (result) => {
          enabled = result.enabled !== false; // Default to true
          if (result.apiUrl) apiUrl = result.apiUrl;
          totalSkips = result.totalSkips || 0;
          totalSecondsSaved = result.totalSecondsSaved || 0;
          console.log(`[YouSkipAI] Settings loaded: enabled=${enabled}, apiUrl=${apiUrl}`);
          onReady();
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
            cleanupTimers();
            cleanupOverlays();
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
    } else {
      onReady();
    }
  }

  // ── Init ───────────────────────────────────────

  function init() {
    loadSettings(checkForVideoChange);
    console.log("[YouSkipAI] Content script loaded");
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
