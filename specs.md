# Spécifications Techniques : Sponsor-AI (Version Open-Source)

## 1. Objectif du Projet
Développer une solution gratuite et automatisée pour détecter et sauter les segments sponsorisés dans les vidéos YouTube en utilisant des modèles d'embeddings et la similarité cosine, sans dépendre du crowdsourcing.

## 2. Architecture Globale
Le système repose sur deux composants principaux :
*   **Backend (API) :** Un service **FastAPI** chargé de la récupération des données et de l'inférence IA.
*   **Frontend (Extension) :** Une extension de navigateur (Manifest V3) pour l'interaction avec le lecteur YouTube.

---

## 3. Spécifications du Backend (Python / FastAPI)

### A. Récupération des données
*   **Outil :** `youtube-transcript-api`.
*   **Fonction :** Extraire les sous-titres (automatiques ou manuels) à partir d'un `video_id`.
*   **Fallback :** Si aucune transcription n'est disponible, renvoyer une erreur explicite.

### B. Moteur IA (Embeddings)
*   **Modèle :** `sentence-transformers/all-MiniLM-L6-v2` (Léger et gratuit).
*   **Logique de détection :**
    1.  Prétraiter la transcription en fenêtres glissantes de $N$ secondes (ex: 15s).
    2.  Générer l'embedding vectoriel pour chaque fenêtre avec **PyTorch**.
    3.  Calculer la **similarité cosine** par rapport à un vecteur de référence (construit à partir de phrases types : "this video is sponsored by", "thanks to", "link in description", etc.).
    4.  Marquer les segments dont le score dépasse un seuil de confiance $T$.

### C. Endpoints API
*   `GET /analyze/{video_id}` : Renvoie un JSON contenant les timestamps des segments à sauter.
    *   Exemple de réponse : `{"segments": [{"start": 120, "end": 185, "type": "sponsor"}]}`

---

## 4. Spécifications de l'Extension (JavaScript)

### A. Content Script
*   Surveiller les changements d'URL sur `[youtube.com/watch](https://youtube.com/watch)*`.
*   Injecter un listener sur l'élément HTML5 `<video>`.
*   Appeler le Backend dès le chargement d'une nouvelle vidéo.

### B. Logique de "Skip"
*   Comparer `video.currentTime` avec la liste des segments reçus de l'API.
*   Si le temps actuel est dans une zone "sponsor", exécuter `video.currentTime = segment.end`.
*   Afficher une notification discrète dans l'interface YouTube : "Sponsor sauté par Sponsor-AI".

---

## 5. Roadmap de Développement (Prompt pour l'IA)

### Phase 1 : MVP Backend
> "Génère un script FastAPI en Python qui utilise `youtube-transcript-api` pour récupérer les sous-titres d'une vidéo et `sentence-transformers` pour identifier les segments contenant des mots-clés liés au sponsoring via la similarité cosine."

### Phase 2 : Optimisation
> "Ajoute une gestion de cache simple (dictionnaire ou fichier local) pour éviter de recalculer les vecteurs d'une vidéo déjà analysée, et conteneurise l'application avec **Docker**."

### Phase 3 : Extension Chrome
> "Crée le manifeste et le content script d'une extension Chrome qui détecte le `video_id` dans l'URL, interroge mon API locale, et modifie le `currentTime` du lecteur vidéo pour sauter les timestamps indiqués."

---

## 6. Contraintes techniques
*   **Coût :** 0€ (utilisation de modèles locaux et d'outils open-source).
*   **Performance :** L'analyse d'une vidéo de 10 min ne doit pas excéder 2 secondes (grâce à la légèreté de MiniLM).
*   **Robustesse :** Gérer les erreurs de connectivité et l'absence de sous-titres (Audit de bugs).