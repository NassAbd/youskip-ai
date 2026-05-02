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

    confidence_threshold: float = 0.35
    window_seconds: float = 15.0
    model_name: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    cache_dir: str = ".cache"
    merge_threshold_seconds: float = 30.0
    
    # LLM Settings
    use_llm: bool = True
    google_api_key: str | None = None
    llm_model_name: str = "gemini-2.5-flash"
    reference_phrases: str = (
        # --- ENGLISH: AGGRESSIVE MARKETING MARKERS ---
        "this video is sponsored by"
        "|sponsored segment"
        "|massive thanks to our friends at"
        "|use my link in the description below"
        "|limited time deal for my viewers"
        "|get started today for free"
        "|go to the website and use code"
        "|save up to 70 percent off"
        "|the first 100 people to click"
        "|thank you for supporting the channel"
        "|download for free on ios and android"
        "|check out the new collection"
        "|this is the best way to support me"
        
        # --- ENGLISH: PRODUCT SPECIFIC JARGON ---
        "|vpn protection and privacy"
        "|military grade encryption"
        "|website builder"
        "|online therapy session"
        "|language learning app"
        "|meal kit delivery"
        "|high quality organic ingredients"
        "|razor sharp blades"
        "|raid shadow legends"
        "|express vpn"
        "|squarespace"
        "|keeps"
        "|betterhelp"
        
        # --- ENGLISH: THE "BACK TO TOPIC" MARKERS (Crucial for End-of-Sponsor) ---
        "|anyway let's get back to the video"
        "|now back to the main topic"
        "|let's jump back in"
        "|moving on to the rest of the video"
        "|okay let's talk about"

        # --- FRENCH: MARQUEURS MARKETING AGRESSIFS ---
        "|cette vidéo est sponsorisée par"
        "|merci à notre partenaire"
        "|en partenariat avec"
        "|le lien est en barre d'infos"
        "|profitez de mon code promo exclusif"
        "|cliquez sur le lien juste en dessous"
        "|offre valable pendant 48 heures"
        "|téléchargez l'application gratuitement"
        "|merci à eux de soutenir la chaîne"
        "|pour une durée limitée"
        "|testez gratuitement pendant un mois"
        "|satisfait ou intégralement remboursé"
        
        # --- FRENCH: PRODUITS ET SERVICES RÉCURRENTS ---
        "|protégez votre connexion internet"
        "|votre vie privée en ligne"
        "|créer votre propre site web"
        "|apprendre une nouvelle langue"
        "|repas livrés à domicile"
        "|ingrédients frais et de saison"
        "|coques de téléphone ultra résistantes"
        "|rhinoshield"
        "|disney plus"
        "|hellofresh"
        "|shadow pc"
        "|manscaped"
        
        # --- FRENCH: TRANSITIONS DE FIN (Pour le "Skip" précis) ---
        "|bref retournons à notre sujet"
        "|sur ce on reprend la vidéo"
        "|allez on retourne au contenu"
        "|fin de cette courte parenthèse"
        "|revenons à nos moutons"
        "|voilà pour le sponsor"
    )

    model_config = {
        "env_prefix": "YSA_",
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def reference_phrase_list(self) -> list[str]:
        """Split pipe-separated reference phrases into a list."""
        return [p.strip() for p in self.reference_phrases.split("|") if p.strip()]


def get_settings() -> Settings:
    """Factory function for Settings, enables dependency injection override."""
    return Settings()
