"""Tests for the JSON file cache."""

import json
from pathlib import Path

import pytest

from youskip_ai.cache import CacheManager
from youskip_ai.schemas import AnalyzeResponse, SponsorSegment


@pytest.fixture
def cache_dir(tmp_path: Path) -> Path:
    """Provide a temporary directory for cache tests."""
    return tmp_path / "test_cache"


@pytest.fixture
def cache(cache_dir: Path) -> CacheManager:
    """Create a CacheManager instance pointed at temp dir."""
    return CacheManager(cache_dir=str(cache_dir))


class TestCacheManager:
    """Tests for CacheManager read/write operations."""

    def test_miss_returns_none(self, cache: CacheManager) -> None:
        """Cache miss should return None."""
        assert cache.get("nonexistent_id") is None

    def test_set_then_get(self, cache: CacheManager) -> None:
        """Written entry should be retrievable."""
        response = AnalyzeResponse(
            video_id="abc123",
            segments=[SponsorSegment(start=10.0, end=20.0, confidence=0.8)],
        )
        cache.set("abc123", response)
        cached = cache.get("abc123")
        assert cached is not None
        assert cached.video_id == "abc123"
        assert len(cached.segments) == 1

    def test_creates_directory(self, cache: CacheManager, cache_dir: Path) -> None:
        """Cache directory should be created on first write."""
        response = AnalyzeResponse(video_id="xyz")
        cache.set("xyz", response)
        assert cache_dir.exists()

    def test_file_is_valid_json(self, cache: CacheManager, cache_dir: Path) -> None:
        """Written cache file should be valid JSON."""
        response = AnalyzeResponse(
            video_id="test",
            segments=[SponsorSegment(start=5.0, end=15.0, confidence=0.7)],
        )
        cache.set("test", response)
        cache_file = cache_dir / "test.json"
        assert cache_file.exists()
        data = json.loads(cache_file.read_text())
        assert data["video_id"] == "test"

    def test_overwrite_existing(self, cache: CacheManager) -> None:
        """Setting a key that already exists should overwrite."""
        resp1 = AnalyzeResponse(video_id="v1", segments=[])
        resp2 = AnalyzeResponse(
            video_id="v1",
            segments=[SponsorSegment(start=1.0, end=2.0, confidence=0.9)],
        )
        cache.set("v1", resp1)
        cache.set("v1", resp2)
        cached = cache.get("v1")
        assert cached is not None
        assert len(cached.segments) == 1
