import numpy as np
from sponsor_ai.transcript import fetch_transcript, build_windows
from sponsor_ai.detector import detect_segments, compute_similarities
from sponsor_ai.config import get_settings

video_id = "Qx-WaWLiT48"
settings = get_settings()

print(f"--- Debugging Video: {video_id} ---")
try:
    raw = fetch_transcript(video_id)
    chunks = build_windows(raw, settings.window_seconds)
    scores = compute_similarities(chunks, settings)

    print(f"Nombre de segments analysés : {len(chunks)}")
    print("\nTop 5 des scores de similarité :")

    indexed_scores = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)

    for i, score in indexed_scores[:5]:
        chunk = chunks[i]
        print(f"[{chunk.start:.1f}s - {chunk.end:.1f}s] Score: {score:.4f}")
        print(f"Texte: {chunk.text[:100]}...")
        print("-" * 20)
except Exception as e:
    print(f"Erreur : {e}")
