# YouSkipAI (YSA) Technical Audit — Raw Material

This document serves as a comprehensive, highly technical audit of the `youskipai` repository, capturing concrete facts, architectures, execution flows, code references, and developer experience metrics.

---

## 1. Project Overview & Core Mission

### 1.1 Problem Solved
YouSkipAI solves the problem of automated sponsor segment detection and skipping in YouTube videos. It handles the identification of paid advertisements (e.g., VPNs, meal kits, website builders), product placements, and significant self-promotions (e.g., merchandise, Patreon shoutouts) within YouTube transcripts. It provides high precision (reducing false positives/negatives), micro-timestamp alignment to avoid clipping the surrounding organic content, and low latency through a hybrid detection model.

### 1.2 Core Architecture Pattern
The project implements a **Decoupled Frontend-Backend Architecture** composed of:
1. **Chrome Extension (Frontend)**: A Manifest V3 Chrome browser extension that operates within YouTube pages (`*://www.youtube.com/*`). It intercepts Single Page Application (SPA) navigation events, queries the backend API, monitors the video player's playback position (`currentTime`) in real-time, updates statistics (time saved, skip counts), and performs automated skipping.
2. **FastAPI Backend Service (Local Daemon / Server)**: An asynchronous REST API that coordinates transcript downloading, acts as the decision engine for the two detection strategies, implements micro-alignment rules, and maintains a local cache to optimize performance and prevent duplicate API costs.

### 1.3 Tech Stack Detail
- **Language**:
  - **Backend**: Python (>=3.11, <3.14) with strict PEP 561 compliance (tracked via `py.typed`).
  - **Frontend**: Pure ES6+ Vanilla JavaScript (Chrome extension environment), HTML5, CSS3.
- **Frameworks**: FastAPI (0.115+) for the backend REST API, utilizing Uvicorn (0.34+) as the ASGI web server.
- **AI/LLM Engine**:
  - **Primary Cloud Detection**: Google Gemini 2.5 Flash via the new `google-genai` (1.74.0+) SDK.
  - **Local/Offline Fallback Detection**: `sentence-transformers` (4.0+) utilizing Hugging Face's `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` model, backed by PyTorch (`torch>=2.0`) running on CPU-optimized configurations (defined via custom PyTorch index URL in `pyproject.toml`).
- **Transcript Retrieval**: `youtube-transcript-api` (1.0+) to pull and parse raw transcript files directly from YouTube.
- **Async Libraries**: Built-in Python `asyncio` (via FastAPI/Uvicorn), `anyio`, and `pytest-asyncio` for test suites.
- **Package & Dependency Manager**: `uv` by Astral (configured via `pyproject.toml` and `uv.lock`). It enforces isolated environments and provides extremely fast dependency resolution.
- **Linters/Formatters**: `ruff` (0.11+) targeting Python 3.11, enforcing linting rules: Pyflakes (`F`), pycodestyle (`E`), isort (`I`), pep8-naming (`N`), pyupgrade (`UP`), flake8-bugbear (`B`), flake8-simplify (`SIM`), and Ruff-specific rules (`RUF`).

---

## 2. Architecture & Pipeline Breakdown

### 2.1 End-to-End Data Pipeline Flow

```
[YouTube SPA Navigation]
       │
       ▼ (extracts video_id)
[Chrome Extension (content.js)]
       │
       ▼ HTTP GET /analyze/{video_id}
[FastAPI Backend (main.py)]
       │
  ┌────┴────┐
  │         ▼
  │   [Cache Check (cache.py)] ────(Hit)───► [Return Cache Response]
  │         │
  │       (Miss)
  │         │
  │         ▼
  │   [Fetch Transcript (transcript.py)]
  │         │
  │   ┌─────┴──────────────────────────────────────┐
  │   ▼ (If Settings.use_llm & google_api_key)     ▼ (If LLM disabled or API fails)
  │ [LLM Engine (llm.py)]                     [Embedding Engine (detector.py)]
  │   │ (Prompt Gemini 2.5 Flash)                  │ (Build 15s Sliding Windows)
  │   │                                            │ (Generate Sentence Embeddings)
  │   │                                            │ (Compute Cosine Similarity)
  │   ▼ (Output list of segments)                  ▼ (Filter by confidence threshold)
  │   │                                       [Heuristic Refiner (refiner.py)]
  │   │                                            │ (Merge close segments < 30s)
  │   │                                            │ (Snap to Transcript Boundaries)
  │   ▼                                            ▼
  └───┼────────────────────────────────────────────┘
      │
      ▼
  [Cache Write & Response Payloads] ──► [Chrome Extension] ──► [Automated skipping]
```

#### Detailed Stage Description:
1. **Ingestion & SPA Tracking**:
   - YouTube utilizes Single Page Application (SPA) mechanics, meaning standard page reload events do not fire upon navigation.
   - The Chrome extension (`content.js`) listens to the custom YouTube SPA navigation finish event `yt-navigate-finish`, fallback `popstate` events, and runs a fallback periodic interval checker (every 2 seconds) to parse the current query parameter `v` to isolate the `video_id`.
2. **REST Call**:
   - The extension triggers an HTTP `GET /analyze/{video_id}` to the local FastAPI backend (default: `http://localhost:8000`).
3. **Caching Layer (`cache.py`)**:
   - The `CacheManager` translates the `video_id` into a file path `<cache_dir>/<video_id>.json` (sanitizing inputs to prevent directory traversal by replacing `/` and `..` with `_`).
   - If the file exists and is validated successfully against the `AnalyzeResponse` Pydantic schema, it is returned immediately, achieving sub-millisecond response latency.
4. **Transcript Retrieval (`transcript.py`)**:
   - On a cache miss, `fetch_transcript(video_id)` cleans the query string (splitting on `&` or `?` to remove timestamp offsets like `&t=150s`).
   - It attempts to fetch transcripts via `YouTubeTranscriptApi`. It first looks up available languages with `api.list()` or `api.list_transcripts()`, prioritizing native French (`fr`) or English (`en`) captions. If native is missing, it falls back to generated transcripts (`find_generated_transcript`), and finally to any available caption if those are missing.
   - Converts raw caption cues into structured dictionary entries containing `text`, `start`, and `duration` keys.
5. **Detection Strategies (Hybrid Dual-Strategy)**:
   - **Primary Strategy (LLM Contextual Extraction)**: If `YSA_USE_LLM` is true and `YSA_GOOGLE_API_KEY` is configured, `detect_with_llm()` is executed. It formats the entire transcript and relies on Gemini 2.5 Flash to extract sponsor bounds contextually.
   - **Fallback Strategy (Local Semantic Embeddings)**: If the LLM is disabled, missing an API key, or if the cloud API call encounters any failure (rate limit, downtime), the pipeline transparently falls back to local sentence-transformer chunk embeddings (`detector.py` and `refiner.py`).
6. **Persistence & Return**:
   - The verified sponsor segments are packed into an `AnalyzeResponse` schema, serialized to a local `.cache` JSON file, and sent back to the browser extension as a JSON array.

---

### 2.2 Dual-Strategy Detection Engine Deep-Dive

#### 1. Primary AI Strategy: LLM Detection (`youskip_ai/llm.py`)
- **Model**: `gemini-2.5-flash`
- **Method**: System instruction prompting with enforced JSON output formatting (`response_mime_type="application/json"`).
- **Core Prompting Mechanics**:
  - The model is instructed to act as a "YouTube content analyst" to isolate exact start and end boundaries for advertisements, product placements, and self-promotions.
  - The transcript is structured with specific cue indicators: `[START_TIME - END_TIME] transcript text`.
  - The model outputs a clean JSON array containing keys: `start`, `end`, `type`, and `confidence`.
- **Metrics Tracking**: Updates global session metadata (`METRICS`) with token counts (`prompt_tokens`, `candidates_tokens`, `total_tokens`) and request numbers.

#### 2. Local Fallback Strategy: Semantic Embeddings & Cosine Similarity (`youskip_ai/detector.py`)
- **Model**: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- **Embedding Reference Generation (`_build_reference_embedding`)**:
  - The system loads the configured `reference_phrases` string (a pipe-separated list of highly aggressive marketing markers, product-specific jargon like "ExpressVPN", "Raid Shadow Legends", "HelloFresh", and transition keywords like "let's jump back in").
  - The SentenceTransformer embeds all these reference sentences, computes a single averaged vector representation (shape `(D,)`), and normalizes it.
- **Sliding-Window Chunking (`transcript.py:build_windows`)**:
  - Chunks the raw transcript into fixed-duration sliding windows (default duration: `window_seconds = 15.0`). Consecutive cues are concatenated without overlaps.
- **Similarity Evaluation (`compute_similarities`)**:
  - Encodes the window text inputs using the same transformer model.
  - Normalizes chunk embeddings row-wise.
  - Computes cosine similarity scores via a matrix-vector dot product (`chunk_embeddings @ ref_vector`).
- **Confidence Filtering**: Segments exceeding `confidence_threshold` (default `0.35`) are flagged as potential sponsor segments.

#### 3. Post-Processing & Alignment (`youskip_ai/refiner.py`)
- After similarity scoring, the sliding window boundaries are raw (coarse 15-second blocks).
- **Merging**: Segments whose gaps are smaller than `merge_threshold_seconds` (default `30.0` seconds) are merged into a single cohesive segment, preventing disruptive multiple skips during a single sponsor section.
- **Micro-Timestamp Alignment**:
  - Snapping bounds back to actual spoken cues. The refiner isolates all raw transcript cues overlapping with the coarse segment window.
  - It adjusts the segment's starting timestamp to the exact millisecond start of the first overlapping phrase.
  - It adjusts the ending timestamp to the exact millisecond end (`start + duration`) of the last overlapping phrase.

---

### 2.3 Concurrency, Latency, & Browser Execution

- **FastAPI/Uvicorn Concurrency**: The backend uses standard ASGI-compliant coroutine event loops. File operations for caches use synchronous standard library operations since files are small and read/written highly efficiently.
- **Caching Mechanics**: A simple, robust, synchronous local filesystem JSON cache prevents any redundant embedding generations or LLM completions for repeat requests.
- **Lightweight Browser Check Loop**:
  - The Chrome Extension utilizes an extremely lightweight `setInterval()` loop executing every 500ms.
  - Because skipping logic is calculated client-side in JS using cached endpoints, there are no real-time network requests made as the video plays. The extension compares `video.currentTime` directly against the fetched, memory-stored segments.
  - A small tolerance buffer (`0.5s`) is used to catch fast-moving video cues without causing high CPU overhead.
  - Stats (`totalSkips` and `totalSecondsSaved`) are persistent in chrome's local sandbox storage (`chrome.storage.local`).

---

## 3. Technical Bottlenecks & Solutions

### 3.1 Challenge 1: The "Dead Space" Skipping & Boundary Clipping
*Problem*: Embedding windows (e.g., 15s) don't align nicely with actual spoken words. If a segment starts at `01:12` but the sliding window starts at `01:00` and gets flagged, skipping the whole window clips 12 seconds of normal content. If the window ends at `01:30` but the sponsor finished at `01:23`, the user experiences a "dead space" or misses content.

*Solution*: Implement a precise micro-timestamp alignment engine in `refiner.py` that projects the coarse similarity boundaries back onto the raw, millisecond-accurate transcript sentence cue list from YouTube's API.

*Code Reference (`src/youskip_ai/refiner.py`)*:
```python
def refine_segments(
    segments: list[SponsorSegment],
    raw_entries: list[dict[str, float | str]],
    settings: Settings,
) -> list[SponsorSegment]:
    if not segments:
        return []

    # 1. Sort segments by start time
    sorted_segs = sorted(segments, key=lambda s: s.start)

    # 2. Merge overlapping or close segments
    merged: list[SponsorSegment] = []
    if sorted_segs:
        current = sorted_segs[0]
        for next_seg in sorted_segs[1:]:
            if next_seg.start - current.end <= settings.merge_threshold_seconds:
                current.end = max(current.end, next_seg.end)
                current.confidence = max(current.confidence, next_seg.confidence)
            else:
                merged.append(current)
                current = next_seg
        merged.append(current)

    # 3. Align with precise transcript boundaries
    refined: list[SponsorSegment] = []
    for m in merged:
        actual_start = m.start
        actual_end = m.end

        overlapping_phrases = [
            p for p in raw_entries
            if float(p["start"]) < m.end and (float(p["start"]) + float(p["duration"])) > m.start
        ]

        if overlapping_phrases:
            actual_start = float(overlapping_phrases[0]["start"])
            last_p = overlapping_phrases[-1]
            actual_end = float(last_p["start"]) + float(last_p["duration"])

        refined.append(
            SponsorSegment(
                start=round(actual_start, 3),
                end=round(actual_end, 3),
                confidence=m.confidence,
                type=m.type
            )
        )

    return refined
```

---

### 3.2 Challenge 2: Transitioning to the New Structured Google GenAI SDK
*Problem*: Migrating to the new `google-genai` SDK from older legacy libraries while strictly enforcing Pydantic validations, keeping low temperature configurations to guarantee schema consistency, and extracting accurate tokens and cost usage metrics.

*Solution*: Leveraging the new `genai.Client` and `types.GenerateContentConfig` structure with a strict `response_mime_type` of `application/json`, parsing the response safely, and building real-time metrics trackers.

*Code Reference (`src/youskip_ai/llm.py`)*:
```python
# New SDK syntax initialization and generate_content call
client = genai.Client(api_key=settings.google_api_key)

formatted_transcript = "\n".join([
    f"[{e['start']:.2f} - {float(e['start']) + float(e['duration']):.2f}] {e['text']}"
    for e in raw_entries
])

response = client.models.generate_content(
    model=settings.llm_model_name,
    contents=f"Analyze this transcript and find sponsor segments:\n\n{formatted_transcript}",
    config=types.GenerateContentConfig(
        system_instruction=SYSTEM_PROMPT,
        response_mime_type="application/json",
        temperature=0.1,  # Enforce structural consistency
    )
)

if not response.text:
    return None

# Update metrics using usage_metadata from the new SDK
if hasattr(response, 'usage_metadata'):
    usage = response.usage_metadata
    METRICS["total_requests"] += 1
    METRICS["prompt_tokens"] += getattr(usage, "prompt_token_count", 0)
    METRICS["candidates_tokens"] += getattr(usage, "candidates_token_count", 0)
    METRICS["total_tokens"] += getattr(usage, "total_token_count", 0)
```

---

### 3.3 Challenge 3: Maintaining Extension State Across YouTube Single-Page App (SPA) Navigation
*Problem*: YouTube does not trigger standard page load hooks when navigate-clicks are made. This causes standard Chrome extension context scripts to become stagnant or mismatch video segments. Furthermore, the extension must maintain state variables like active status, customizable API targets, and persistence of reclaim statistics without injecting high latency.

*Solution*: A hybrid subscription mechanism listening to the custom YouTube SPA complete event `yt-navigate-finish`, `popstate` browser back/forward history events, combined with a periodic low-frequency safety loop, coupled with storage monitors using standard `chrome.storage.local`.

*Code Reference (`extension/content.js`)*:
```javascript
// Navigation Observer mapping to SPA mechanics
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

// Storage synchronization of states and stats
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.enabled) {
    enabled = changes.enabled.newValue;
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
    const vid = getVideoId();
    if (vid && enabled) {
      currentVideoId = null;
      onVideoChange(vid);
    }
  }
});
```

---

## 4. Developer Experience & Code Quality

### 4.1 Dependency & Tooling Orchestration
- **Package Management (`uv`)**: Standardizes the workspace, bypassing virtualenv speed limitations. It leverages global caching mechanisms and manages dependencies natively.
- **Ruff Compliance**: Line length limits are configured strictly to `100` characters. Lint selection contains rules:
  - `E`, `F` (Pyflakes/Pycodestyle standard rules)
  - `I` (Auto-sorting imports / isort)
  - `N` (Enforce PEP-8 Naming conventions)
  - `UP` (Enforce modern Python syntax upgrades)
  - `B` (Flake8 bug prevention)
  - `SIM` (Simplify instructions)
  - `RUF` (Ruff-specific correctness checks)
- **Environment Isolation**: Utilizes `.env` loading with fallback defaults encapsulated within the Pydantic-Settings BaseSettings layout (`youskip_ai/config.py`).

### 4.2 Test & Coverage Topology
YSA features high-coverage unit and integration test coverage across all major python subsystems inside the `tests/` directory:
1. **Cache Tests (`test_cache.py`)**: Tests sanitization constraints on video identifier file writes and schema loads.
2. **Detector Tests (`test_detector.py`)**: Asserts that similarities calculate as standard 1-D numpy arrays, ensures sponsor markers score higher than standard math tutorials, and confirms confidence bounds filters are respected.
3. **LLM Integration Tests (`test_llm.py`)**: Mocks Gemini API output structures using `unittest.mock` and patches `google.genai.Client`, checking fallback mechanisms when api keys are absent.
4. **Endpoint Integration Tests (`test_main.py`)**: Tests `/analyze/{video_id}` endpoints and health probes using standard FastAPI `TestClient`.
5. **Boundary Refiner Tests (`test_refiner.py`)**: Simulates merging heuristics and snapping calculations on boundaries.
6. **Transcript & Window Tests (`test_transcript.py`)**: Mocks raw YouTube transcription responses, asserting sliding-window size limits.

All Python tests run asynchronously with pytest mode configuration set to `auto`. Execution command is simple and fast:
```bash
uv run pytest
```
