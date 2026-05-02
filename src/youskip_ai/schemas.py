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
