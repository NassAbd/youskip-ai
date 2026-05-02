"""Configuration centralisée via variables d'environnement."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, configurable via environment variables.

    Attributes:
        confidence_threshold: Cosine similarity threshold above which a segment
            is flagged as sponsored. Range [0.0, 1.0].
        window_seconds: Duration in seconds of each sliding window used to
            chunk the transcript for embedding comparison.
        model_name: HuggingFace model identifier for sentence embeddings.
        cache_dir: Directory path where the JSON cache files are stored.
        reference_phrases: Pipe-separated list of reference phrases used to
            build the sponsor reference embedding vector.
    """

    confidence_threshold: float = 0.45
    window_seconds: float = 15.0
    model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    cache_dir: str = ".cache"
    reference_phrases: str = (
        # English
        "this video is sponsored by"
        "|thanks to our sponsor"
        "|check out the link in the description"
        "|use code at checkout"
        "|sign up for free using my link"
        "|today's sponsor"
        "|exclusive deal"
        "|highspeed VPN"
        "|free shipping"
        # French
        "|cette vidéo est sponsorisée par"
        "|merci à notre partenaire"
        "|merci à notre sponsor"
        "|le lien est dans la description"
        "|profitez d'une réduction"
        "|code promo"
        "|en utilisant mon lien"
        "|sponsorisé par"
        "|merci à NordVPN"
        "|merci à RhinoShield"
    )

    model_config = {"env_prefix": "SPONSOR_AI_"}

    @property
    def reference_phrase_list(self) -> list[str]:
        """Split pipe-separated reference phrases into a list."""
        return [p.strip() for p in self.reference_phrases.split("|") if p.strip()]


def get_settings() -> Settings:
    """Factory function for Settings, enables dependency injection override."""
    return Settings()
