# YouSkipAI (YSA)

> AI-powered YouTube sponsor detection and auto-skipping.

YouSkipAI detects sponsored segments in YouTube videos from transcript data, then lets the Chrome extension skip those moments automatically. The backend combines Gemini 2.5 Flash with a local semantic fallback, while the extension displays analysis status, sponsor markers, skip notifications, and saved-time stats directly in the browser.

https://github.com/NassAbd/youskip-ai/blob/hackathon/landing/demo.mp4

---

## Hackathon Branch

The `hackathon` branch was dedicated to pursuing the project beyond the initial prototype. It adds a polished landing page, the donation flow, improved extension styling, a custom in-player sponsor timeline, loading states while analysis runs, and a fresh demo video.

---

## Tech Stack

- **Backend**: FastAPI, Python 3.11+
- **Dependency Management**: [uv](https://docs.astral.sh/uv/)
- **AI Engine**:
  - **Cloud**: Gemini 2.5 Flash for contextual sponsor detection
  - **Local fallback**: `sentence-transformers` for offline-first semantic matching
- **Browser Extension**: Chrome Manifest V3 content script and popup
- **Landing Page**: Static HTML, CSS, and JavaScript served by FastAPI
- **Payments**: Mollie checkout integration with local mock mode for development

---

## Implemented Features

- **AI Sponsor Detection**: Finds sponsor segments from YouTube transcript windows.
- **Automatic Skipping**: Jumps over detected sponsor ranges during playback.
- **Scanning Animation**: Shows an in-player loading badge while the backend analyzes a video.
- **Custom Mini Timeline**: Displays detected sponsor ranges on an extension-owned timeline, avoiding fragile YouTube progress-bar DOM injection.
- **Skip Banner**: Shows a glass-style confirmation banner with an `Unskip` action.
- **Extension Popup Dashboard**: Tracks total skips, time saved, API status, and backend URL configuration.
- **Persistent Caching**: Stores analyzed video results locally to reduce repeat analysis.
- **Bilingual Detection Markers**: Includes English and French sponsor phrases and transition cues.
- **Landing Page**: Product page with the recorded demo video, feature overview, and support section.
- **Donation Flow**: Mollie payment session creation, loading state before redirect, local mock checkout, and animated support stats after payment.

---

## Getting Started

### 1. Backend Setup

Install dependencies and run the FastAPI server:

```bash
uv sync
uv run uvicorn youskip_ai.main:app --reload
```

Optional environment setup:

```bash
cp .env.example .env
```

Set `YSA_GOOGLE_API_KEY` in `.env` to use Gemini. Without a live Mollie key, the donation flow runs in mock mode.

### 2. Landing Page

Start the backend, then open:

```text
http://localhost:8000
```

The demo video is served from:

```text
/landing/demo.mp4
```

### 3. Chrome Extension

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `extension/` folder.
5. Open the popup and confirm the backend URL is `http://localhost:8000`.

---

## API

Analyze a YouTube video:

```text
GET /analyze/{video_id}
```

Health check:

```text
GET /health
```

Runtime metrics:

```text
GET /stats
```

Donation stats:

```text
GET /api/v1/donations/stats
```

Create a donation session:

```text
POST /api/v1/donations
```

---

## Development Notes

- The extension content script runs on `youtube.com` and calls the local backend.
- The in-video sponsor timeline is intentionally independent from YouTube's internal progress bar DOM.
- The payment redirect returns to `/?payment=success#donation`, then the landing page animates the raised amount, backer count, and progress bar.
- Mock Mollie sessions are used when `YSA_MOLLIE_API_KEY` is unset or set to `mock`.

---

## Testing

Run the test suite:

```bash
uv run pytest
```

Useful focused checks:

```bash
uv run pytest tests/test_donations.py
node --check extension/content.js
node --check extension/popup.js
node --check landing/app.js
```

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

Created by Abdallah Nassur.
