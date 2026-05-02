"""AI detection engine — embeddings + cosine similarity.

Uses sentence-transformers to embed transcript chunks and compare them
against a reference sponsor vector via cosine similarity.
"""

import numpy as np
from numpy.typing import NDArray
from sentence_transformers import SentenceTransformer

from youskip_ai.config import Settings
from youskip_ai.schemas import SponsorSegment, TranscriptChunk

# Module-level model cache to avoid reloading on every call
_model_cache: dict[str, SentenceTransformer] = {}


def _get_model(model_name: str) -> SentenceTransformer:
    """Load and cache the sentence-transformer model.

    Args:
        model_name: HuggingFace model identifier.

    Returns:
        Cached SentenceTransformer instance.
    """
    if model_name not in _model_cache:
        _model_cache[model_name] = SentenceTransformer(model_name)
    return _model_cache[model_name]


def _build_reference_embedding(settings: Settings) -> NDArray[np.float32]:
    """Build a single reference vector by averaging embeddings of sponsor phrases.

    Args:
        settings: Application settings containing reference phrases and model name.

    Returns:
        Normalized reference embedding vector of shape (D,).
    """
    model = _get_model(settings.model_name)
    phrases = settings.reference_phrase_list
    embeddings: NDArray[np.float32] = model.encode(phrases, convert_to_numpy=True)
    # Average all reference phrase embeddings into one vector
    ref_vector: NDArray[np.float32] = np.mean(embeddings, axis=0)
    # Normalize
    norm = np.linalg.norm(ref_vector)
    if norm > 0:
        ref_vector = (ref_vector / norm).astype(np.float32)
    return ref_vector


def compute_similarities(
    chunks: list[TranscriptChunk],
    settings: Settings,
) -> NDArray[np.float32]:
    """Compute cosine similarity between each chunk and the sponsor reference vector.

    Args:
        chunks: List of transcript chunks to evaluate.
        settings: Application settings.

    Returns:
        1-D numpy array of shape (len(chunks),) with similarity scores in [-1, 1].
    """
    model = _get_model(settings.model_name)
    ref_vector = _build_reference_embedding(settings)

    texts = [chunk.text for chunk in chunks]
    chunk_embeddings: NDArray[np.float32] = model.encode(texts, convert_to_numpy=True)

    # Normalize chunk embeddings row-wise
    norms = np.linalg.norm(chunk_embeddings, axis=1, keepdims=True)
    norms = np.where(norms > 0, norms, 1.0)
    chunk_embeddings = chunk_embeddings / norms

    # Cosine similarity = dot product of normalized vectors
    similarities: NDArray[np.float32] = chunk_embeddings @ ref_vector
    return similarities


def detect_segments(
    chunks: list[TranscriptChunk],
    settings: Settings,
) -> list[SponsorSegment]:
    """Run the full detection pipeline: chunks → similarity → filtered segments.

    Args:
        chunks: Transcript chunks from the sliding window.
        settings: Application settings (threshold, model, phrases).

    Returns:
        List of SponsorSegment for chunks exceeding the confidence threshold.
    """
    if not chunks:
        return []

    scores = compute_similarities(chunks, settings)

    segments: list[SponsorSegment] = []
    for chunk, score in zip(chunks, scores, strict=True):
        if float(score) >= settings.confidence_threshold:
            segments.append(
                SponsorSegment(
                    start=chunk.start,
                    end=chunk.end,
                    confidence=round(float(score), 4),
                )
            )

    return segments
