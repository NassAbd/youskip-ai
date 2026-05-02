from typing import Any, cast

from youtube_transcript_api import YouTubeTranscriptApi

from sponsor_ai.schemas import TranscriptChunk


def fetch_transcript(video_id: str) -> list[dict[str, float | str]]:
    # Nettoyage de l'ID au cas où un paramètre d'URL est passé (ex: &t=150s)
    clean_id = video_id.split('&')[0].split('?')[0]
    
    try:
        api = YouTubeTranscriptApi()
        try:
            transcript_list = api.list(clean_id)
        except AttributeError:
            transcript_list = api.list_transcripts(clean_id)  # type: ignore
        
        try:
            transcript = transcript_list.find_transcript(['fr', 'en'])
        except Exception:
            try:
                transcript = transcript_list.find_generated_transcript(['fr', 'en'])
            except Exception:
                transcript = next(iter(transcript_list))
            
        raw_data = cast(list[Any], transcript.fetch())
        
        # Conversion forcée en liste de dicts si ce sont des objets
        result: list[dict[str, float | str]] = []
        for s in raw_data:
            if isinstance(s, dict):
                result.append({
                    "text": str(s.get("text", "")),
                    "start": float(s.get("start", 0)),
                    "duration": float(s.get("duration", 0))
                })
            else:
                result.append({
                    "text": str(getattr(s, "text", "")),
                    "start": float(getattr(s, "start", 0)),
                    "duration": float(getattr(s, "duration", 0))
                })
        return result
    except Exception as exc:
        msg = f"Impossible de récupérer la transcription pour '{clean_id}': {exc}"
        raise ValueError(msg) from exc


def build_windows(
    raw_entries: list[dict[str, float | str]],
    window_seconds: float,
) -> list[TranscriptChunk]:
    """Slice raw transcript entries into fixed-duration sliding windows.

    Each window aggregates consecutive transcript entries whose combined
    duration fits within `window_seconds`. Windows are non-overlapping.

    Args:
        raw_entries: Raw transcript data from youtube-transcript-api.
        window_seconds: Maximum duration of each window in seconds.

    Returns:
        List of TranscriptChunk models.
    """
    if not raw_entries:
        return []

    chunks: list[TranscriptChunk] = []
    current_texts: list[str] = []
    window_start: float = float(raw_entries[0]["start"])

    for entry in raw_entries:
        entry_start = float(entry["start"])
        entry_duration = float(entry["duration"])
        entry_end = entry_start + entry_duration
        entry_text = str(entry["text"])

        # If this entry would push the window past the limit, close the current window
        if current_texts and (entry_end - window_start) > window_seconds:
            chunks.append(
                TranscriptChunk(
                    text=" ".join(current_texts),
                    start=window_start,
                    end=entry_start,
                )
            )
            current_texts = []
            window_start = entry_start

        current_texts.append(entry_text)

    # Flush remaining entries
    if current_texts:
        last_entry = raw_entries[-1]
        last_end = float(last_entry["start"]) + float(last_entry["duration"])
        chunks.append(
            TranscriptChunk(
                text=" ".join(current_texts),
                start=window_start,
                end=last_end,
            )
        )

    return chunks
