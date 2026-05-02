"""LLM-based sponsor detection using the new Google GenAI SDK.

Processes the full transcript to identify sponsor segments with high
contextual awareness and precision.
"""

import json
import logging
from typing import Any

from google import genai
from google.genai import types
from sponsor_ai.config import Settings
from sponsor_ai.schemas import SponsorSegment

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert YouTube content analyst. Your task is to identify "Sponsor Segments" in video transcripts.

A Sponsor Segment is:
- A paid advertisement (e.g., VPNs, games, services).
- A product placement.
- A significant self-promotion (e.g., "Buy my merch", "Join my Patreon").

Instructions:
1. You will be given a transcript where each line starts with [START_TIME - END_TIME].
2. Identify the exact start and end times for each sponsor segment.
3. Be precise: include the entire pitch but exclude the actual content of the video.
4. Output your answer ONLY as a JSON list of objects with "start", "end", "type", and "confidence" (0.0 to 1.0).
5. If no sponsor is found, return an empty list: [].

Example Output:
[{"start": 12.5, "end": 45.0, "type": "sponsor", "confidence": 0.95}]
"""

def detect_with_llm(
    raw_entries: list[dict[str, Any]], 
    settings: Settings
) -> list[SponsorSegment] | None:
    """Analyze the full transcript using the new Google GenAI SDK.
    
    Returns:
        List of SponsorSegments if successful, None if API fails.
    """
    if not settings.google_api_key:
        logger.warning("Gemini API key not configured. Skipping LLM detection.")
        return None

    try:
        # New SDK syntax
        client = genai.Client(api_key=settings.google_api_key)
        
        # Format transcript for the LLM
        formatted_transcript = "\n".join([
            f"[{e['start']:.2f} - {float(e['start']) + float(e['duration']):.2f}] {e['text']}"
            for e in raw_entries
        ])

        # Generation call aligned with user's working script
        response = client.models.generate_content(
            model=settings.llm_model_name,
            contents=f"Analyze this transcript and find sponsor segments:\n\n{formatted_transcript}",
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                temperature=0.1,  # Low temperature for stable JSON
            )
        )

        if not response.text:
            return None

        # Parse the JSON response
        data = json.loads(response.text)
        segments = []
        for item in data:
            segments.append(
                SponsorSegment(
                    start=float(item["start"]),
                    end=float(item["end"]),
                    type=item.get("type", "sponsor"),
                    confidence=float(item.get("confidence", 1.0))
                )
            )
        
        logger.info(f"LLM detection successful: found {len(segments)} segments.")
        return segments

    except Exception as e:
        logger.error(f"Error during Gemini detection: {e}")
        return None
