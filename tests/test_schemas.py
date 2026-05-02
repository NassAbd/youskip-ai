"""Tests for Pydantic schemas — validate contract shapes."""

import pytest
from pydantic import ValidationError

from sponsor_ai.schemas import AnalyzeResponse, ErrorResponse, SponsorSegment, TranscriptChunk


class TestSponsorSegment:
    """SponsorSegment model validation."""

    def test_valid_segment(self) -> None:
        seg = SponsorSegment(start=120.0, end=185.0, confidence=0.78)
        assert seg.start == 120.0
        assert seg.end == 185.0
        assert seg.type == "sponsor"
        assert seg.confidence == 0.78

    def test_custom_type(self) -> None:
        seg = SponsorSegment(start=0.0, end=10.0, type="intro", confidence=0.9)
        assert seg.type == "intro"

    def test_negative_start_rejected(self) -> None:
        with pytest.raises(ValidationError):
            SponsorSegment(start=-1.0, end=10.0, confidence=0.5)

    def test_confidence_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            SponsorSegment(start=0.0, end=10.0, confidence=1.5)


class TestAnalyzeResponse:
    """AnalyzeResponse model validation."""

    def test_empty_segments(self) -> None:
        resp = AnalyzeResponse(video_id="abc123")
        assert resp.video_id == "abc123"
        assert resp.segments == []

    def test_with_segments(self) -> None:
        seg = SponsorSegment(start=10.0, end=20.0, confidence=0.7)
        resp = AnalyzeResponse(video_id="xyz", segments=[seg])
        assert len(resp.segments) == 1
        assert resp.segments[0].start == 10.0

    def test_serialization_roundtrip(self) -> None:
        seg = SponsorSegment(start=5.0, end=15.0, confidence=0.8)
        resp = AnalyzeResponse(video_id="test", segments=[seg])
        data = resp.model_dump()
        restored = AnalyzeResponse.model_validate(data)
        assert restored == resp


class TestTranscriptChunk:
    """TranscriptChunk model validation."""

    def test_valid_chunk(self) -> None:
        chunk = TranscriptChunk(text="hello world", start=0.0, end=15.0)
        assert chunk.text == "hello world"
        assert chunk.end == 15.0


class TestErrorResponse:
    """ErrorResponse model validation."""

    def test_error_message(self) -> None:
        err = ErrorResponse(detail="No transcript found.")
        assert err.detail == "No transcript found."
