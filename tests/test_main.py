"""Tests for the FastAPI application — integration tests on /analyze endpoint."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from youskip_ai.main import app
from youskip_ai.schemas import AnalyzeResponse, SponsorSegment


@patch("youskip_ai.main.analyze_video")
class TestAnalyzeEndpoint:
    """Integration tests for GET /analyze/{video_id}."""

    def test_success_response(self, mock_analyze: MagicMock) -> None:
        """Successful analysis should return 200 with segments."""
        mock_analyze.return_value = AnalyzeResponse(
            video_id="abc123",
            segments=[SponsorSegment(start=120.0, end=185.0, confidence=0.78)],
        )
        client = TestClient(app)
        resp = client.get("/analyze/abc123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["video_id"] == "abc123"
        assert len(data["segments"]) == 1
        assert data["segments"][0]["start"] == 120.0

    def test_empty_segments(self, mock_analyze: MagicMock) -> None:
        """Video with no sponsors should return empty segments list."""
        mock_analyze.return_value = AnalyzeResponse(video_id="clean", segments=[])
        client = TestClient(app)
        resp = client.get("/analyze/clean")
        assert resp.status_code == 200
        assert resp.json()["segments"] == []

    def test_transcript_error_returns_404(self, mock_analyze: MagicMock) -> None:
        """Missing transcript should yield 404."""
        mock_analyze.side_effect = ValueError("Aucune transcription disponible")
        client = TestClient(app)
        resp = client.get("/analyze/bad_id")
        assert resp.status_code == 404
        assert "detail" in resp.json()


class TestHealthEndpoint:
    """Health check endpoint."""

    def test_health_ok(self) -> None:
        client = TestClient(app)
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
