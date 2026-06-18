"""Pydantic schemas — the API contract.

This module defines ALL data structures exchanged between layers.
No logic here, only shapes.
"""

from pydantic import BaseModel, Field


class SponsorSegment(BaseModel):
    """A single detected sponsor segment with timestamps."""

    start: float = Field(..., ge=0, description="Start time in seconds.")
    end: float = Field(..., ge=0, description="End time in seconds.")
    type: str = Field(default="sponsor", description="Segment type label.")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Cosine similarity score for this segment."
    )


class AnalyzeResponse(BaseModel):
    """Response payload for GET /analyze/{video_id}."""

    video_id: str = Field(..., description="YouTube video identifier.")
    segments: list[SponsorSegment] = Field(
        default_factory=list, description="Detected sponsor segments."
    )


class TranscriptChunk(BaseModel):
    """A chunk of transcript text within a time window."""

    text: str = Field(..., description="Concatenated transcript text for this window.")
    start: float = Field(..., ge=0, description="Window start time in seconds.")
    end: float = Field(..., ge=0, description="Window end time in seconds.")


class ErrorResponse(BaseModel):
    """Standard error response."""

    detail: str = Field(..., description="Human-readable error message.")


class CreateDonationRequest(BaseModel):
    """Request to create a new donation/payment session."""

    amount: float = Field(..., ge=1.00, description="Donation amount (minimum €1.00).")
    currency: str = Field(default="EUR", description="Currency code, e.g. EUR.")


class DonationResponse(BaseModel):
    """Payload representing a single donation."""

    id: str = Field(..., description="Mollie Payment ID or Mock ID.")
    amount: float = Field(..., description="Donation amount.")
    currency: str = Field(..., description="Currency code.")
    status: str = Field(
        ...,
        description="Status of the payment (open, paid, failed, expired, cancelled)."
    )
    checkout_url: str | None = Field(None, description="Checkout redirect URL.")
    created_at: str = Field(..., description="Timestamp of payment creation.")


class DonationStatsResponse(BaseModel):
    """Aggregation stats for the donation campaign."""

    total_raised: float = Field(..., description="Total amount raised so far.")
    target_goal: float = Field(..., description="Monthly campaign target goal.")
    backers_count: int = Field(..., description="Number of unique backers.")
    percent_raised: float = Field(..., description="Percentage of goal raised.")

