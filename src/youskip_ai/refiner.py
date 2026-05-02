"""Refinement logic for sponsor segments.

Provides functions to merge close segments and align timestamps precisely
with the transcript's phrase boundaries.
"""

from youskip_ai.config import Settings
from youskip_ai.schemas import SponsorSegment


def refine_segments(
    segments: list[SponsorSegment],
    raw_entries: list[dict[str, float | str]],
    settings: Settings,
) -> list[SponsorSegment]:
    """Refine detected segments by merging and aligning with transcript.

    Args:
        segments: Initially detected segments (from 15s windows).
        raw_entries: Precise transcript entries.
        settings: Application settings (merge threshold).

    Returns:
        A list of refined, merged and aligned SponsorSegments.
    """
    if not segments:
        return []

    # 1. Sort segments by start time
    sorted_segs = sorted(segments, key=lambda s: s.start)

    # 2. Merge overlapping or close segments
    merged: list[SponsorSegment] = []
    if sorted_segs:
        current = sorted_segs[0]
        for next_seg in sorted_segs[1:]:
            # If segments are closer than merge_threshold, join them
            if next_seg.start - current.end <= settings.merge_threshold_seconds:
                current.end = max(current.end, next_seg.end)
                current.confidence = max(current.confidence, next_seg.confidence)
            else:
                merged.append(current)
                current = next_seg
        merged.append(current)

    # 3. Align with precise transcript boundaries
    # We want the 'start' to be the start of the first phrase in the block
    # and 'end' to be the end of the last phrase in the block.
    refined: list[SponsorSegment] = []
    for m in merged:
        # Find the earliest phrase that overlaps with this segment
        actual_start = m.start
        actual_end = m.end
        
        overlapping_phrases = [
            p for p in raw_entries 
            if float(p["start"]) < m.end and (float(p["start"]) + float(p["duration"])) > m.start
        ]
        
        if overlapping_phrases:
            actual_start = float(overlapping_phrases[0]["start"])
            last_p = overlapping_phrases[-1]
            actual_end = float(last_p["start"]) + float(last_p["duration"])

        refined.append(
            SponsorSegment(
                start=round(actual_start, 3),
                end=round(actual_end, 3),
                confidence=m.confidence,
                type=m.type
            )
        )

    return refined
