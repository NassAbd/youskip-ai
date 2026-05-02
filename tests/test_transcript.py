"""Tests for transcript retrieval and windowing logic."""

from unittest.mock import MagicMock, patch

import pytest

from youskip_ai.config import Settings
from youskip_ai.schemas import TranscriptChunk
from youskip_ai.transcript import build_windows, fetch_transcript


class TestFetchTranscript:
    """Tests for the youtube-transcript-api wrapper."""

    @patch("youskip_ai.transcript.YouTubeTranscriptApi")
    def test_returns_raw_entries(self, mock_api_class: MagicMock) -> None:
        """Should return list of dicts with text/start/duration keys."""
        mock_transcript = MagicMock()
        mock_transcript.fetch.return_value = [
            {"text": "hello", "start": 0.0, "duration": 2.0},
        ]
        mock_list = MagicMock()
        mock_list.find_transcript.return_value = mock_transcript
        
        mock_api = mock_api_class.return_value
        mock_api.list.return_value = mock_list

        result = fetch_transcript("test_id")
        assert len(result) == 1
        assert result[0]["text"] == "hello"

    @patch("youskip_ai.transcript.YouTubeTranscriptApi")
    def test_no_transcript_raises(self, mock_api_class: MagicMock) -> None:
        """Should raise ValueError when no transcript is available."""
        mock_api = mock_api_class.return_value
        mock_api.list.side_effect = Exception("No transcript")

        with pytest.raises(ValueError, match="Impossible de récupérer"):
            fetch_transcript("bad_id")


class TestBuildWindows:
    """Tests for the sliding-window chunking of raw transcript data."""

    def test_basic_windowing(
        self, sample_transcript_raw: list[dict[str, float | str]], settings: Settings
    ) -> None:
        """Should produce TranscriptChunk objects covering the full transcript."""
        chunks = build_windows(sample_transcript_raw, window_seconds=settings.window_seconds)
        assert len(chunks) > 0
        assert all(isinstance(c, TranscriptChunk) for c in chunks)

    def test_window_size_respected(
        self, sample_transcript_raw: list[dict[str, float | str]]
    ) -> None:
        """Each window should not exceed the specified duration."""
        window_s = 10.0
        chunks = build_windows(sample_transcript_raw, window_seconds=window_s)
        for chunk in chunks:
            assert chunk.end - chunk.start <= window_s + 1.0  # +1s tolerance for boundary

    def test_text_not_empty(
        self, sample_transcript_raw: list[dict[str, float | str]], settings: Settings
    ) -> None:
        """Every chunk should contain non-empty text."""
        chunks = build_windows(sample_transcript_raw, window_seconds=settings.window_seconds)
        for chunk in chunks:
            assert len(chunk.text.strip()) > 0

    def test_empty_transcript(self) -> None:
        """Empty transcript should return empty list."""
        chunks = build_windows([], window_seconds=15.0)
        assert chunks == []
