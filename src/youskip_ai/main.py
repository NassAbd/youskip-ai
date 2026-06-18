"""FastAPI application — entrypoint and route definitions."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from youskip_ai.cache import CacheManager
from youskip_ai.config import Settings, get_settings
from youskip_ai.detector import detect_segments
from youskip_ai.donations import DonationManager
from youskip_ai.llm import detect_with_llm
from youskip_ai.mollie import MollieClient
from youskip_ai.refiner import refine_segments
from youskip_ai.schemas import (
    AnalyzeResponse,
    CreateDonationRequest,
    DonationResponse,
    DonationStatsResponse,
    SponsorSegment,
)
from youskip_ai.transcript import build_windows, fetch_transcript

app = FastAPI(
    title="YouSkipAI",
    description="Détection automatique de segments sponsorisés dans les vidéos YouTube.",
    version="0.1.0",
)

# CORS: Chrome extensions use chrome-extension:// origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Serve interactive landing page
app.mount("/landing", StaticFiles(directory="landing"), name="landing")


@app.get("/")
def read_root() -> FileResponse:
    """Serve the interactive landing page."""
    return FileResponse("landing/index.html")

# Initialize settings and cache at module level
_settings: Settings = get_settings()
_cache: CacheManager = CacheManager(cache_dir=_settings.cache_dir)


def analyze_video(video_id: str) -> AnalyzeResponse:
    """Core analysis pipeline: fetch → window → detect → cache.

    Args:
        video_id: YouTube video identifier.

    Returns:
        AnalyzeResponse with detected sponsor segments.

    Raises:
        ValueError: If transcript cannot be retrieved.
    """
    # Check cache first
    cached = _cache.get(video_id)
    if cached is not None:
        return cached

    # Fetch transcript
    raw_entries = fetch_transcript(video_id)

    # Strategy: Try LLM first if enabled, fallback to Embeddings
    segments: list[SponsorSegment] | None = None
    
    if _settings.use_llm:
        segments = detect_with_llm(raw_entries, _settings)
    
    if segments is None:
        # Fallback to Embedding-based detection
        chunks = build_windows(raw_entries, window_seconds=_settings.window_seconds)
        raw_segments = detect_segments(chunks, _settings)
        segments = refine_segments(raw_segments, raw_entries, _settings)

    # Build response
    response = AnalyzeResponse(video_id=video_id, segments=segments)

    # Cache the result
    _cache.set(video_id, response)

    return response


@app.get("/analyze/{video_id}", response_model=AnalyzeResponse)
def analyze_endpoint(video_id: str) -> AnalyzeResponse:
    """Analyze a YouTube video for sponsor segments.

    Args:
        video_id: YouTube video identifier.

    Returns:
        JSON with detected sponsor segments and timestamps.
    """
    try:
        return analyze_video(video_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/stats")
def get_stats():
    """Retrieve Gemini API usage metrics and general stats."""
    from youskip_ai.llm import METRICS
    return {
        "api_usage": METRICS,
        "cache_size": (
            len(list(Path(_settings.cache_dir).glob("*.json")))
            if Path(_settings.cache_dir).exists()
            else 0
        ),
    }


@app.get("/health")
def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


# Initialize Donation database manager
_donations: DonationManager = DonationManager(cache_dir=_settings.cache_dir)


@app.post("/api/v1/donations", response_model=DonationResponse)
async def create_donation_endpoint(req: CreateDonationRequest) -> DonationResponse:
    """Create a new payment/donation session."""
    mollie_client = MollieClient(_settings)
    payment = await mollie_client.create_payment(amount=req.amount, currency=req.currency)
    
    donation = _donations.create_donation(
        payment_id=payment["id"],
        amount=req.amount,
        currency=req.currency,
        checkout_url=payment["checkout_url"]
    )
    return donation


@app.get("/api/v1/donations/stats", response_model=DonationStatsResponse)
def get_donation_stats() -> DonationStatsResponse:
    """Get aggregate donation stats."""
    return _donations.get_stats()


@app.post("/api/v1/donations/webhook")
async def donations_webhook(request: Request) -> dict[str, str]:
    """Mollie callback webhook."""
    form_data = await request.form()
    payment_id = form_data.get("id")
    if not payment_id or not isinstance(payment_id, str):
        raise HTTPException(status_code=400, detail="Missing payment id.")
    
    mollie_client = MollieClient(_settings)
    status = await mollie_client.get_payment_status(payment_id)
    _donations.update_donation_status(payment_id, status)
    return {"status": "ok"}


@app.post("/api/v1/donations/simulate-webhook/{payment_id}", response_model=DonationResponse)
def simulate_webhook(payment_id: str) -> DonationResponse:
    """Trigger mock webhook updates during local simulation."""
    updated = _donations.update_donation_status(payment_id, "paid")
    if not updated:
        raise HTTPException(status_code=404, detail="Payment not found")
    return updated
