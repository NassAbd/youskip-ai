# ⚡ YouSkipAI (YSA)

> **High-precision, AI-powered YouTube sponsor detector and auto-skipper.**

YouSkipAI is a hybrid detection engine that eliminates sponsored segments from your YouTube experience. It combines **local semantic embeddings** for speed and **Gemini 2.5 Flash** for deep contextual reasoning, ensuring even the most subtle product placements are caught.

https://github.com/user-attachments/assets/1e9cac4c-b25a-4aee-91cd-f871a62388c4

---

## 🛠 Tech Stack

- **Backend**: FastAPI (Python 3.11+)
- **Dependency Management**: [uv](https://docs.astral.sh/uv/)
- **AI Engine**: 
  - **Cloud (Primary)**: Google Gemini 2.5 Flash for high-precision contextual extraction.
  - **Local (Fallback)**: `sentence-transformers` for offline-first semantic similarity if the LLM is disabled or the API is unreachable.
- **Frontend**: Chrome Extension

---

## ✨ Key Features

- **Resilient Hybrid Architecture**: Automatically falls back to local embedding-based detection if the Gemini API is unavailable, ensuring 100% uptime.
- **Micro-Timestamp Alignment**: Automatically snaps skip points to actual transcript sentence boundaries.
- **Smart Segment Merging**: Group contiguous sponsor segments for a seamless viewing experience.
- **Time-Saved Dashboard**: A real-time counter in the extension showing exactly how much of your life the AI has reclaimed.
- **Bilingual Optimized**: Fine-tuned markers for both English and French content.
- **Persistent Caching**: Locally stores analyzed segments to minimize API calls and latency.

---

## 🚀 Getting Started

### 1. Backend Setup

Ensure you have `uv` installed.

```bash
# Clone and install
git clone https://github.com/NassAbd/youskip-ai.git
cd youskip-ai
uv sync

# Configure environment
cp .env.example .env
# Set your YSA_GOOGLE_API_KEY in .env

# Run server
uv run uvicorn youskip_ai.main:app --reload
```

### 2. Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open the extension popup to verify the **API Connected** status.

---

## 📊 Monitoring & API

### Stats Dashboard
Access real-time Gemini API metrics (tokens, requests) and cache size:
`GET http://localhost:8000/stats`

### Health Check
Verify backend availability:
`GET http://localhost:8000/health`

---

## 🛡 License
This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.

Created with ❤️ by **Abdallah Nassur**
