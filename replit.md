# YouSkipAI

AI-powered YouTube sponsor detection and auto-skipping backend service.

## Overview

YouSkipAI is a FastAPI backend that detects sponsored segments in YouTube videos using a hybrid AI approach:
- **Primary**: Google Gemini 2.5 Flash (LLM-based detection)
- **Fallback**: Sentence-Transformers local embeddings

The project also includes a Chrome extension (`extension/`) that connects to this local server and auto-skips sponsors while watching YouTube.

## Running the App

The server starts automatically via the "Start application" workflow:

```
.pythonlibs/bin/uvicorn youskip_ai.main:app --host 0.0.0.0 --port 5000 --app-dir src
```

## API Endpoints

- `GET /health` — Health check
- `GET /analyze/{video_id}` — Analyze a YouTube video for sponsor segments
- `GET /stats` — API usage metrics and cache stats

## Configuration

Copy `.env.example` to `.env` and set your Google API key:

```
YSA_GOOGLE_API_KEY=your_key_here
```

All settings use the `YSA_` prefix as environment variables.

## Project Structure

- `src/youskip_ai/` — Core backend (FastAPI app, LLM/embedding detection, caching)
- `extension/` — Chrome extension (Manifest V3)
- `tests/` — pytest test suite

## User Preferences

- Uses `uv` for Python package management with a `.pythonlibs` virtualenv
- Dependencies installed via `uv sync --frozen`
