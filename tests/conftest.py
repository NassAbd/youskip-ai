"""Shared fixtures for all test modules."""

import pytest

from youskip_ai.config import Settings


@pytest.fixture
def settings() -> Settings:
    """Default test settings with lowered threshold for easier assertions."""
    return Settings(
        confidence_threshold=0.5,
        window_seconds=10.0,
        cache_dir=".test_cache",
        reference_phrases="this video is sponsored by|thanks to our sponsor",
    )


@pytest.fixture
def sample_transcript_raw() -> list[dict[str, float | str]]:
    """Simulated raw transcript entries from youtube-transcript-api.

    Mimics the FetchedTranscriptSnippet format: list of dicts with
    'text', 'start', and 'duration' keys.
    """
    return [
        {"text": "Hey everyone welcome back to the channel", "start": 0.0, "duration": 4.0},
        {"text": "today we are going to talk about Python", "start": 4.0, "duration": 3.5},
        {"text": "but first this video is sponsored by", "start": 7.5, "duration": 3.0},
        {"text": "Awesome VPN the best VPN service", "start": 10.5, "duration": 3.0},
        {"text": "check out the link in the description", "start": 13.5, "duration": 3.0},
        {"text": "use code PYTHON for 20 percent off", "start": 16.5, "duration": 3.0},
        {"text": "alright so lets get into the tutorial", "start": 19.5, "duration": 4.0},
        {"text": "first you need to install the library", "start": 23.5, "duration": 3.5},
        {"text": "then import it in your script", "start": 27.0, "duration": 3.0},
        {"text": "and thats it for today thanks for watching", "start": 30.0, "duration": 4.0},
    ]
