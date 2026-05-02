"""Tests for the LLM detection module."""

import json
from unittest.mock import MagicMock, patch

from youskip_ai.config import Settings
from youskip_ai.llm import detect_with_llm


def test_detect_with_llm_success() -> None:
    settings = Settings(google_api_key="fake_key", use_llm=True)
    raw_entries = [{"start": 0.0, "duration": 10.0, "text": "hello"}]
    
    # Mocking the Gemini response
    mock_response = MagicMock()
    mock_response.text = json.dumps([
        {"start": 5.0, "end": 8.0, "type": "sponsor", "confidence": 0.9}
    ])
    
    with patch("google.genai.Client") as mock_client_class:
        mock_client = mock_client_class.return_value
        mock_client.models.generate_content.return_value = mock_response
        
        segments = detect_with_llm(raw_entries, settings)
        
        assert segments is not None
        assert len(segments) == 1
        assert segments[0].start == 5.0
        assert segments[0].confidence == 0.9


def test_detect_with_llm_no_key_returns_none() -> None:
    settings = Settings(google_api_key=None, use_llm=True)
    assert detect_with_llm([], settings) is None


def test_detect_with_llm_api_error_returns_none() -> None:
    settings = Settings(google_api_key="fake_key", use_llm=True)
    
    with patch("google.genai.Client") as mock_client_class:
        mock_client = mock_client_class.return_value
        mock_client.models.generate_content.side_effect = Exception("API Down")
        
        segments = detect_with_llm([], settings)
        assert segments is None
