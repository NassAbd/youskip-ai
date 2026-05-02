"""JSON file cache for analysis results.

Stores AnalyzeResponse objects as individual JSON files to avoid
re-computing embeddings for previously analyzed videos.
"""

import json
from pathlib import Path

from youskip_ai.schemas import AnalyzeResponse


class CacheManager:
    """File-based JSON cache for video analysis results.

    Each video_id maps to a single JSON file: ``<cache_dir>/<video_id>.json``.

    Attributes:
        cache_dir: Path to the cache directory.
    """

    def __init__(self, cache_dir: str) -> None:
        self.cache_dir = Path(cache_dir)

    def _path_for(self, video_id: str) -> Path:
        """Build the cache file path for a given video_id."""
        # Sanitize video_id to prevent path traversal
        safe_id = video_id.replace("/", "_").replace("..", "_")
        return self.cache_dir / f"{safe_id}.json"

    def get(self, video_id: str) -> AnalyzeResponse | None:
        """Retrieve a cached analysis result.

        Args:
            video_id: YouTube video identifier.

        Returns:
            AnalyzeResponse if cached, None on miss or corrupt data.
        """
        path = self._path_for(video_id)
        if not path.exists():
            return None
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            return AnalyzeResponse.model_validate(data)
        except (json.JSONDecodeError, Exception):
            return None

    def set(self, video_id: str, response: AnalyzeResponse) -> None:
        """Write an analysis result to cache.

        Args:
            video_id: YouTube video identifier.
            response: The analysis response to persist.
        """
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        path = self._path_for(video_id)
        path.write_text(
            json.dumps(response.model_dump(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
