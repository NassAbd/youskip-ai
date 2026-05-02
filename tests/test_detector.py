"""Tests for the AI detection engine — embeddings + cosine similarity."""

import numpy as np

from sponsor_ai.config import Settings
from sponsor_ai.detector import compute_similarities, detect_segments
from sponsor_ai.schemas import SponsorSegment, TranscriptChunk


class TestComputeSimilarities:
    """Tests for raw cosine similarity computation."""

    def test_output_shape(self, settings: Settings) -> None:
        """Similarity scores should be a 1-D array matching chunk count."""
        chunks = [
            TranscriptChunk(text="this video is sponsored by NordVPN", start=0.0, end=10.0),
            TranscriptChunk(text="lets talk about python decorators", start=10.0, end=20.0),
        ]
        scores = compute_similarities(chunks, settings)
        assert isinstance(scores, np.ndarray)
        assert scores.shape == (2,)

    def test_sponsor_chunk_scores_higher(self, settings: Settings) -> None:
        """Chunks with sponsor language should score higher than organic content."""
        chunks = [
            TranscriptChunk(
                text="this video is sponsored by our amazing partner", start=0.0, end=10.0
            ),
            TranscriptChunk(
                text="the fibonacci sequence is a mathematical concept", start=10.0, end=20.0
            ),
        ]
        scores = compute_similarities(chunks, settings)
        assert scores[0] > scores[1], (
            f"Sponsor chunk ({scores[0]:.3f}) should score higher than organic ({scores[1]:.3f})"
        )


class TestDetectSegments:
    """Tests for the full detection pipeline: chunks → segments."""

    def test_returns_sponsor_segments(self, settings: Settings) -> None:
        """Should return SponsorSegment objects for chunks above threshold."""
        chunks = [
            TranscriptChunk(
                text="this video is sponsored by the best VPN service", start=5.0, end=15.0
            ),
            TranscriptChunk(text="so here is how you write a for loop", start=15.0, end=25.0),
        ]
        segments = detect_segments(chunks, settings)
        assert all(isinstance(s, SponsorSegment) for s in segments)

    def test_organic_content_not_flagged(self, settings: Settings) -> None:
        """Pure organic content should yield no segments."""
        chunks = [
            TranscriptChunk(text="python is a great programming language", start=0.0, end=10.0),
            TranscriptChunk(
                text="lets learn about data structures today", start=10.0, end=20.0
            ),
        ]
        segments = detect_segments(chunks, settings)
        assert len(segments) == 0, f"Expected 0 segments but got {len(segments)}"

    def test_confidence_above_threshold(self, settings: Settings) -> None:
        """Every returned segment must have confidence >= threshold."""
        chunks = [
            TranscriptChunk(
                text="thanks to our sponsor for making this possible", start=0.0, end=10.0
            ),
            TranscriptChunk(text="now back to the code", start=10.0, end=20.0),
        ]
        segments = detect_segments(chunks, settings)
        for seg in segments:
            assert seg.confidence >= settings.confidence_threshold
