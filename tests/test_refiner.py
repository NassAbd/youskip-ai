"""Tests for the refiner module — merging and alignment."""

from youskip_ai.config import Settings
from youskip_ai.refiner import refine_segments
from youskip_ai.schemas import SponsorSegment


def test_refine_merges_close_segments() -> None:
    settings = Settings(merge_threshold_seconds=10.0)
    # Two segments separated by 5s (less than 10s threshold)
    segments = [
        SponsorSegment(start=10.0, end=20.0, confidence=0.8),
        SponsorSegment(start=25.0, end=35.0, confidence=0.9),
    ]
    # Dummy raw entries covering the range
    raw_entries = [
        {"start": 10.0, "duration": 10.0, "text": "seg1"},
        {"start": 20.0, "duration": 5.0, "text": "gap"},
        {"start": 25.0, "duration": 10.0, "text": "seg2"},
    ]
    
    refined = refine_segments(segments, raw_entries, settings)
    
    assert len(refined) == 1
    assert refined[0].start == 10.0
    assert refined[0].end == 35.0
    assert refined[0].confidence == 0.9


def test_refine_aligns_to_transcript_boundaries() -> None:
    settings = Settings(merge_threshold_seconds=5.0)
    # Window-based segment is 10-20, but transcript phrases are 9.5-19.5
    segments = [SponsorSegment(start=10.0, end=20.0, confidence=0.7)]
    raw_entries = [
        {"start": 9.5, "duration": 5.0, "text": "phrase1"},
        {"start": 14.5, "duration": 5.0, "text": "phrase2"},
        {"start": 19.5, "duration": 5.0, "text": "phrase3"},
    ]
    
    refined = refine_segments(segments, raw_entries, settings)
    
    assert len(refined) == 1
    # Should start at 9.5 and end at 19.5 (the end of phrase2 which is the last overlapping one)
    # Wait, 19.5 starts at 19.5 and ends at 24.5. 
    # Our segment ends at 20.0, so it overlaps with phrase3.
    assert refined[0].start == 9.5
    assert refined[0].end == 24.5


def test_refine_empty_input() -> None:
    settings = Settings()
    assert refine_segments([], [], settings) == []
