document.addEventListener("DOMContentLoaded", () => {
  // --- DETECTOR DEMO SIMULATION ELEMENTS ---
  const btnSimulate = document.getElementById("btn-simulate");
  const btnPlayPause = document.getElementById("btn-play-pause");
  const currentTimeLbl = document.getElementById("current-time-lbl");
  const durationLbl = document.getElementById("duration-lbl");
  const playerTimeline = document.getElementById("player-timeline");
  const timelinePlayhead = document.getElementById("timeline-playhead");
  const timeTooltip = document.getElementById("time-tooltip");
  const terminalBody = document.getElementById("terminal-body");
  const demoNotification = document.getElementById("demo-notification");
  const screenContent = document.getElementById("screen-content");
  const playOverlay = document.getElementById("play-overlay");
  
  const heroSeconds = document.getElementById("hero-seconds");
  const heroSkips = document.getElementById("hero-skips");

  // --- DONATIONS CAMPAIGN ELEMENTS ---
  const totalRaisedLbl = document.getElementById("total-raised-lbl");
  const backersCountLbl = document.getElementById("backers-count-lbl");
  const progressBarFill = document.getElementById("progress-bar-fill");
  
  const btnDonateTrigger = document.getElementById("btn-donate-trigger");
  const donationModal = document.getElementById("donation-modal");
  const modalClose = document.getElementById("modal-close");
  const presetBtns = document.querySelectorAll(".preset-btn");
  const customAmountInput = document.getElementById("custom-amount");
  const btnMollieCheckout = document.getElementById("btn-mollie-checkout");

  // --- MOLLIE SANDBOX OVERLAY ELEMENTS ---
  const mollieCheckoutOverlay = document.getElementById("mollie-checkout-overlay");
  const molliePaymentAmount = document.getElementById("mollie-payment-amount");
  const btnMollieSimulatePay = document.getElementById("btn-mollie-simulate-pay");
  const btnMollieCancel = document.getElementById("btn-mollie-cancel");

  // --- DETECTOR SIMULATION VARIABLES ---
  const VIDEO_DURATION = 180; // seconds
  const SPONSOR_START = 36;   // 20%
  const SPONSOR_END = 81;     // 45%

  let isPlaying = false;
  let currentTime = 0;
  let playInterval = null;
  let lastTimeSaved = 124580;
  let lastSkipsCount = 4821;

  const carbonaraFrames = [
    // Cooking prep
    "url('https://images.unsplash.com/photo-1612874742237-6526221588e3?q=80&w=800')",
    // Sponsor placeholder
    "url('https://images.unsplash.com/photo-1546549032-9571cd6b27df?q=80&w=800')",
  ];

  function addLog(text, type = "info") {
    if (!terminalBody) {
      console.log(`[YouSkipAI] ${text}`);
      return;
    }

    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
    terminalBody.appendChild(line);
    terminalBody.scrollTop = terminalBody.scrollHeight;
  }

  function formatSeconds(sec) {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }

  function updateTimeDisplay() {
    if (!currentTimeLbl || !durationLbl || !timelinePlayhead || !screenContent) return;

    currentTimeLbl.textContent = formatSeconds(currentTime);
    durationLbl.textContent = formatSeconds(VIDEO_DURATION);
    const percentage = (currentTime / VIDEO_DURATION) * 100;
    timelinePlayhead.style.left = `${percentage}%`;

    if (currentTime >= SPONSOR_START && currentTime < SPONSOR_END) {
      screenContent.style.backgroundImage = carbonaraFrames[1];
      document.getElementById("video-subtitle").textContent = "🔥 Try NordVPN today!";
      document.getElementById("video-desc").textContent =
        "Keep your browsing private with 70% off.";
    } else {
      screenContent.style.backgroundImage = carbonaraFrames[0];
      document.getElementById("video-subtitle").textContent =
        "Cooking the perfect Carbonara Pasta...";
      document.getElementById("video-desc").textContent =
        "Now, add the eggs and whisk them with pecorino.";
    }
  }

  function togglePlay() {
    if (!btnPlayPause || !playOverlay) return;

    if (isPlaying) {
      pauseSimulation();
    } else {
      playSimulation();
    }
  }

  function playSimulation() {
    if (!btnPlayPause || !playOverlay) return;

    isPlaying = true;
    btnPlayPause.textContent = "⏸";
    playOverlay.style.opacity = 0;
    setTimeout(() => { playOverlay.classList.add("hidden"); }, 200);

    playInterval = setInterval(() => {
      currentTime += 1;
      
      if (currentTime >= SPONSOR_START && currentTime < SPONSOR_END) {
        currentTime = SPONSOR_END;
        triggerSkipUI();
      }

      if (currentTime >= VIDEO_DURATION) {
        currentTime = 0;
        pauseSimulation();
      }
      
      updateTimeDisplay();
    }, 1000);
  }

  function pauseSimulation() {
    if (!btnPlayPause || !playOverlay) return;

    isPlaying = false;
    btnPlayPause.textContent = "▶";
    playOverlay.classList.remove("hidden");
    playOverlay.style.opacity = 1;
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
    }
  }

  function triggerSkipUI() {
    if (!demoNotification || !heroSeconds || !heroSkips) return;

    demoNotification.classList.add("visible");
    setTimeout(() => {
      demoNotification.classList.remove("visible");
    }, 3000);

    addLog(`SUCCESS: Automatically skipped sponsor segment [36s - 81s]! Saved 45s.`, "success");

    lastTimeSaved += 45;
    lastSkipsCount += 1;
    heroSeconds.textContent = lastTimeSaved.toLocaleString();
    heroSkips.textContent = lastSkipsCount.toLocaleString();
  }

  if (screenContent) {
    screenContent.style.backgroundImage = carbonaraFrames[0];
    updateTimeDisplay();
  }

  if (btnSimulate) btnSimulate.addEventListener("click", () => {
    pauseSimulation();
    currentTime = 0;
    updateTimeDisplay();
    if (terminalBody) terminalBody.innerHTML = "";

    addLog("Parsing YouTube URL...");
    setTimeout(() => {
      addLog(`Video ID detected: dQw4w9WgXcQ`);
      setTimeout(() => {
        addLog("Checking local cache for sponsor segments... (Miss)", "warn");
        setTimeout(() => {
          addLog("Routing to FastAPI: Running Gemini 2.5 Flash Transcript Analysis...", "info");
          setTimeout(() => {
            addLog(
              "SUCCESS: Gemini identified sponsor segment: [36.0s - 81.0s] " +
                "(confidence: 96.5%)",
              "success"
            );
            addLog("Saving detected segments to the local cache...", "info");
            playSimulation();
          }, 1200);
        }, 800);
      }, 600);
    }, 400);
  });

  if (playerTimeline) playerTimeline.addEventListener("click", (e) => {
    const rect = playerTimeline.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const clickPercentage = clickX / width;
    currentTime = Math.floor(clickPercentage * VIDEO_DURATION);
    if (currentTime < 0) currentTime = 0;
    if (currentTime > VIDEO_DURATION) currentTime = VIDEO_DURATION;
    updateTimeDisplay();
  });

  if (playerTimeline) playerTimeline.addEventListener("mousemove", (e) => {
    if (!timeTooltip) return;

    const rect = playerTimeline.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const width = rect.width;
    const hoverPercentage = hoverX / width;
    const hoverTime = Math.floor(hoverPercentage * VIDEO_DURATION);
    
    timeTooltip.style.display = "block";
    timeTooltip.style.left = `${hoverX}px`;
    timeTooltip.textContent = formatSeconds(hoverTime);
  });

  if (playerTimeline) playerTimeline.addEventListener("mouseleave", () => {
    if (!timeTooltip) return;
    timeTooltip.style.display = "none";
  });

  if (btnPlayPause) btnPlayPause.addEventListener("click", togglePlay);
  if (playOverlay) playOverlay.addEventListener("click", playSimulation);


  // --- DONATIONS CAMPAIGN INTEGRATION ---
  let activeDonationAmount = 5.00;
  let activePaymentId = null;

  async function fetchStats() {
    try {
      const response = await fetch("/api/v1/donations/stats");
      if (response.ok) {
        const stats = await response.json();
        totalRaisedLbl.textContent = `€${stats.total_raised.toFixed(2)} raised`;
        backersCountLbl.textContent = `❤️ Supported by ${stats.backers_count} awesome backers`;
        progressBarFill.style.width = `${Math.min(stats.percent_raised, 100)}%`;
      }
    } catch (err) {
      console.error("Failed to load donation stats", err);
    }
  }

  // Initial load
  fetchStats();

  // Handle redirection callback from Mollie payment page
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("payment") === "success") {
    const savedPaymentId = localStorage.getItem("ysa_active_payment_id");
    const savedAmount = localStorage.getItem("ysa_active_payment_amount");
    if (savedPaymentId && savedAmount) {
      addLog(`Redirected back from Mollie Checkout for session: ${savedPaymentId}`, "info");
      addLog(
        `Simulating webhook registration for successful payment of ` +
          `€${parseFloat(savedAmount).toFixed(2)}...`,
        "info"
      );
      
      // Trigger simulate-webhook endpoint locally to mock Mollie IPN callback
      fetch(`/api/v1/donations/simulate-webhook/${savedPaymentId}`, {
        method: "POST"
      }).then(res => {
        if (res.ok) {
          addLog(
            `SUCCESS: Webhook registered payment of ` +
              `€${parseFloat(savedAmount).toFixed(2)} as PAID!`,
            "success"
          );
          localStorage.removeItem("ysa_active_payment_id");
          localStorage.removeItem("ysa_active_payment_amount");
          fetchStats();
          
          // Clear query params from the browser address bar
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          addLog("FAILED: Webhook simulation failed to register payment.", "error");
        }
      }).catch(err => {
        addLog(`Webhook simulation error: ${err.message}`, "error");
      });
    }
  }

  btnDonateTrigger.addEventListener("click", () => {
    donationModal.classList.remove("hidden");
  });

  modalClose.addEventListener("click", () => {
    donationModal.classList.add("hidden");
  });

  // Toggle presets
  presetBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      presetBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeDonationAmount = parseFloat(btn.getAttribute("data-amount"));
      customAmountInput.value = "";
    });
  });

  customAmountInput.addEventListener("input", () => {
    presetBtns.forEach(b => b.classList.remove("active"));
    activeDonationAmount = parseFloat(customAmountInput.value) || 0.00;
  });

  btnMollieCheckout.addEventListener("click", async () => {
    if (activeDonationAmount < 1.00) {
      alert("Please enter a donation amount of at least €1.00.");
      return;
    }

    addLog(`Initiating payment session for €${activeDonationAmount.toFixed(2)}...`);
    donationModal.classList.add("hidden");

    try {
      const response = await fetch("/api/v1/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: activeDonationAmount, currency: "EUR" })
      });

      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }

      const data = await response.json();
      activePaymentId = data.id;

      addLog(`Payment session generated: ${activePaymentId}`, "info");

      if (data.checkout_url.startsWith("/landing") || data.checkout_url.startsWith("landing")) {
        // Mock Sandbox Checkout Overlay
        molliePaymentAmount.textContent = `€${activeDonationAmount.toFixed(2)}`;
        mollieCheckoutOverlay.classList.remove("hidden");
        addLog("[Mollie Sandbox] Redirected to local simulated checkout interface.", "warn");
      } else {
        // Real Mollie redirect (same window to enable back redirection)
        addLog(`Redirecting to official checkout page: ${data.checkout_url}`, "success");
        localStorage.setItem("ysa_active_payment_id", data.id);
        localStorage.setItem("ysa_active_payment_amount", activeDonationAmount.toString());
        setTimeout(() => {
          window.location.href = data.checkout_url;
        }, 1000);
      }
    } catch (err) {
      addLog(`Checkout failed: ${err.message}`, "error");
      alert("Could not establish checkout session. Check FastAPI server log.");
    }
  });

  // Mock Payment Controls
  btnMollieSimulatePay.addEventListener("click", async () => {
    mollieCheckoutOverlay.classList.add("hidden");
    addLog(`Simulating customer bank authorization for: ${activePaymentId}...`, "info");
    
    // Simulate webhook ping from Mollie to Backend
    setTimeout(async () => {
      addLog(`Mollie Webhook simulation call sent for transaction: ${activePaymentId}`, "info");
      
      try {
        const response = await fetch(`/api/v1/donations/simulate-webhook/${activePaymentId}`, {
          method: "POST"
        });

        if (response.ok) {
          addLog(
            "SUCCESS: Webhook confirmed payment of €" +
              activeDonationAmount.toFixed(2) +
              " as PAID!",
            "success"
          );
          fetchStats();
        } else {
          addLog("FAILED: Webhook simulation failed to register payment.", "error");
        }
      } catch (err) {
        addLog(`Webhook simulation error: ${err.message}`, "error");
      }
    }, 1000);
  });

  btnMollieCancel.addEventListener("click", () => {
    mollieCheckoutOverlay.classList.add("hidden");
    addLog(`Simulated: Checkout cancelled by customer. Transaction: ${activePaymentId}`, "warn");
  });
});
