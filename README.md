# ⚡ Sponsor-AI

> Détection et saut automatique des segments sponsorisés dans les vidéos YouTube, propulsé par l'IA — 100% gratuit et local.

Sponsor-AI utilise des **embeddings sémantiques** (`sentence-transformers/all-MiniLM-L6-v2`) et la **similarité cosine** pour identifier les segments publicitaires dans les sous-titres YouTube, puis une extension Chrome les saute en temps réel.

---

## Architecture

```
┌─────────────────────┐        GET /analyze/{video_id}       ┌─────────────────────┐
│  Extension Chrome   │ ──────────────────────────────────── │  Backend FastAPI     │
│  (Manifest V3)      │ ◄──── { segments: [...] }            │  (Python / PyTorch)  │
│                     │                                      │                     │
│  • Détecte video_id │                                      │  • youtube-transcript│
│  • Saute les sponso │                                      │  • sentence-transformers
│  • Notification UI  │                                      │  • Cache JSON        │
└─────────────────────┘                                      └─────────────────────┘
```

## Prérequis

- **Python 3.11+**
- [**uv**](https://docs.astral.sh/uv/) — Gestionnaire de projet Python
- **Google Chrome** ou tout navigateur basé Chromium

---

## Installation & Démarrage

### 1. Backend (API)

```bash
# Cloner le projet
git clone <repo-url> && cd sponso_detector

# Installer les dépendances (crée l'environnement automatiquement)
uv sync

# Lancer le serveur de développement
uv run uvicorn sponsor_ai.main:app --reload
```

Le serveur démarre sur `http://localhost:8000`. Testez avec :

```bash
# Health check
curl http://localhost:8000/health
# → {"status": "ok"}

# Analyser une vidéo (remplacez VIDEO_ID)
curl http://localhost:8000/analyze/VIDEO_ID
# → {"video_id": "VIDEO_ID", "segments": [{"start": 120.0, "end": 185.0, "type": "sponsor", "confidence": 0.78}]}
```

### 2. Extension Chrome

1. Ouvrir Chrome et naviguer vers `chrome://extensions/`
2. Activer le **Mode développeur** (toggle en haut à droite)
3. Cliquer sur **Charger l'extension non empaquetée**
4. Sélectionner le dossier `extension/` du projet

L'icône ⚡ apparaît dans la barre d'outils. Cliquez dessus pour :
- **Activer/désactiver** la détection
- **Configurer l'URL de l'API** (par défaut : `http://localhost:8000`)
- **Vérifier la connexion** à l'API (indicateur vert/rouge)

---

## Utilisation

1. **Démarrez le backend** (`uv run uvicorn sponsor_ai.main:app --reload`)
2. **Ouvrez YouTube** et lancez une vidéo
3. L'extension appelle automatiquement l'API avec le `video_id`
4. Les segments sponsorisés sont **détectés et sautés** en temps réel
5. Une notification discrète « ⚡ Sponsor sauté par Sponsor-AI » s'affiche

---

## Configuration

Toutes les options sont configurables via **variables d'environnement** :

| Variable | Default | Description |
|---|---|---|
| `SPONSOR_AI_CONFIDENCE_THRESHOLD` | `0.65` | Seuil de similarité cosine (0.0 → 1.0) |
| `SPONSOR_AI_WINDOW_SECONDS` | `15.0` | Durée des fenêtres glissantes (secondes) |
| `SPONSOR_AI_MODEL_NAME` | `sentence-transformers/all-MiniLM-L6-v2` | Modèle d'embeddings HuggingFace |
| `SPONSOR_AI_CACHE_DIR` | `.cache` | Répertoire de cache JSON |
| `SPONSOR_AI_REFERENCE_PHRASES` | 6 phrases types | Phrases de référence (séparées par `\|`) |

Exemple :

```bash
SPONSOR_AI_CONFIDENCE_THRESHOLD=0.7 SPONSOR_AI_WINDOW_SECONDS=20 uv run uvicorn sponsor_ai.main:app --reload
```

---

## Tests & Qualité

```bash
# Lancer les tests
uv run pytest tests/ -v

# Linter
uvx ruff check src/ tests/

# Type-checker
uvx ty check --project .

# Tout d'un coup
uvx ruff check src/ tests/ && uvx ty check --project . && uv run pytest tests/ -v
```

**Couverture des tests (29 tests) :**

| Module | Tests | Couverture |
|---|---|---|
| `schemas.py` | 9 | Validation Pydantic, sérialisation roundtrip |
| `transcript.py` | 6 | Fetch (mocké), windowing, cas limites |
| `detector.py` | 5 | Shape embeddings, scoring, détection/filtrage |
| `cache.py` | 5 | CRUD JSON, création dossier, overwrite |
| `main.py` | 4 | Endpoints FastAPI, gestion d'erreurs |

---

## Structure du projet

```
sponso_detector/
├── src/sponsor_ai/
│   ├── __init__.py
│   ├── config.py          # Settings via env vars (SPONSOR_AI_*)
│   ├── schemas.py         # Pydantic contract (API shapes)
│   ├── transcript.py      # youtube-transcript-api + sliding windows
│   ├── detector.py        # sentence-transformers + cosine similarity
│   ├── cache.py           # JSON file cache
│   └── main.py            # FastAPI app
├── tests/                 # 29 tests pytest
├── extension/
│   ├── manifest.json      # Chrome Manifest V3
│   ├── content.js         # Content script (skip logic)
│   ├── styles.css         # Notification overlay
│   ├── popup.html/js/css  # Extension popup UI
│   └── icons/             # Extension icons
├── pyproject.toml
└── specs.md               # Spécifications techniques
```

---

## API

### `GET /analyze/{video_id}`

Analyse les sous-titres d'une vidéo YouTube et retourne les segments sponsorisés.

**Réponse 200 :**
```json
{
  "video_id": "dQw4w9WgXcQ",
  "segments": [
    {
      "start": 120.0,
      "end": 185.0,
      "type": "sponsor",
      "confidence": 0.78
    }
  ]
}
```

**Réponse 404 :** Aucune transcription disponible.

### `GET /health`

```json
{"status": "ok"}
```

---

## Licence

MIT
