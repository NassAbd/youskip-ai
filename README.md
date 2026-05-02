# 🚀 YouSkipAI (YSA)

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Gemini](https://img.shields.io/badge/Gemini_2.5-4285F4?style=for-the-badge&logo=google)](https://aistudio.google.com/)
[![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)

**YouSkipAI** is a high-precision YouTube sponsor detector. It combines local embeddings (SentenceTransformers) and advanced reasoning via **Google Gemini 2.5 Flash** to automatically skip sponsors, product placements, and self-promotions.

---

## ✨ Key Features
- **Hybrid Analysis**: Uses ultra-fast local embeddings for standard detection and LLM (Gemini) for complex cases.
- **Smart Merging**: Automatically merges close segments for a smooth viewing experience.
- **Micro-Precision**: Snaps skip points to actual transcript timestamps (no cutting mid-sentence).
- **Gratifying Dashboard**: Keep track of exactly how much time you've saved from watching ads.
- **Instant Toggle**: Enable or disable the extension in real-time without refreshing your page.

---

## 🛠 Installation

### 1. Backend (Python)
Ensure you have `uv` installed.

```bash
# Clone the repo
git clone <repo-url>
cd sponso_detector

# Setup environment
cp .env.example .env
# Edit .env and add your YSA_GOOGLE_API_KEY

# Run the server
uv run uvicorn youskip_ai.main:app --reload
```

### 2. Chrome Extension
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/` folder in this project.
4. Click the extension icon to set your Backend URL (default: `http://localhost:8000`).

---

## 📊 Monitoring
- **Backend Stats**: Access `http://localhost:8000/stats` to see token consumption and cache metrics.
- **Time Saved**: View your personal savings directly in the extension popup.

---

## ⚖️ License
MIT - Created by Abdallah Nassur
