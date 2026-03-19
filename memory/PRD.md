# UNIVERSE — Product Requirements Document

## Problem Statement
Application de streaming interactive mettant en avant le cinéma indépendant. Hyper-moderne, thème galaxie/espace, palette noir/violet profond/violet (#000000, #240056, #8C2EBA).

## Architecture
- **Frontend**: Expo SDK 54, React Native, expo-router (file-based routing)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT (PyJWT + bcrypt)
- **Navigation**: Bottom tabs (5 onglets) + Stack pour détail film, user profile et settings

## User Personas
- Cinéphiles amateurs de cinéma indépendant (18-35 ans)
- Réalisateurs de courts métrages
- Critiques de cinéma
- Créateurs de contenu cinématographique

## Core Requirements (Static)
1. Authentification JWT (email/mot de passe)
2. Contenu vidéo mocké avec affiches Unsplash
3. Vignettes de taille variable par durée (short<10min, medium 10-40min, long>40min)
4. Bilingue Français/Anglais
5. 5 pages principales

## What's Been Implemented (Beta v1.0 - March 2026)

### Backend (/app/backend/server.py)
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET /api/films (filtre genre, durée, recherche), GET /api/films/{id}
- GET /api/feed (films pour TikTok feed)
- GET/POST /api/reviews, POST /api/reviews/{id}/like
- GET/POST /api/posts, POST /api/posts/{id}/like
- GET /api/users/{id}, POST /api/users/{id}/follow
- POST /api/films-seen, GET /api/films-seen
- GET/POST/DELETE /api/watchlist
- GET/POST /api/comments
- GET /api/notifications
- GET /api/trending, GET /api/featured
- POST /api/seed (données auto-seedées au démarrage)
- 10 films mock avec durées variées, 3 users, 5 reviews, 5 posts

### Frontend (/app/frontend/app/)
- **(auth)/welcome.tsx** — Splash galaxy avec étoiles animées, CTAs connexion/inscription
- **(auth)/login.tsx** — Connexion email/password avec bouton démo
- **(auth)/register.tsx** — Inscription username/email/password
- **(tabs)/index.tsx** — Page Accueil: 3 sections horizontales (Long/Moyen/Court) + filtres genre + GlobalHeader
- **(tabs)/feed.tsx** — Feed TikTok-style: full-screen vertical, barre d'action droite (like/info/étoile/vu), modal info
- **(tabs)/social.tsx** — Social: stories row, fil de posts avec navigation vers profils users, badges rôles utilisateurs
- **(tabs)/search.tsx** — Recherche: barre texte + filtres durée + filtres genre, grille résultats
- **(tabs)/profile.tsx** — Profil Instagram-style: stats (critiques/films vus/abonnés), 4 tabs horizontaux (Top10/Critiques/Films Vus/Réalisés)
- **film/[id].tsx** — Détail film: hero poster, stats, synopsis, tags, critiques, lecteur vidéo YouTube, watchlist
- **user/[id].tsx** — ✅ NEW: Profil utilisateur externe avec follow/unfollow
- **settings.tsx** — Paramètres: profil, édition de profil modal, abonnement premium, préférences, déconnexion
- **watchlist.tsx** — Liste des films à voir
- **notifications.tsx** — Centre de notifications
- **category/[type].tsx** — Pages catégories (Top 10, Critiques, Films Vus)
- **post/[id].tsx** — Détail post avec commentaires

### Components
- **GlobalHeader.tsx** — Header avec navigation rapide vers toutes les features en 1 clic
- **EditProfileModal.tsx** — ✅ NEW: Modal d'édition de profil (username, bio, avatar)
- **VideoPlayer.tsx** — ✅ NEW: Lecteur vidéo YouTube intégré avec modal fullscreen

### Theme & Services
- constants/theme.ts — Palette de couleurs, gradients, spacing, radius
- services/api.ts — Toutes les fonctions API (authAPI, filmsAPI, reviewsAPI, postsAPI, usersAPI, seenAPI, watchlistAPI, commentsAPI, notificationsAPI, discoverAPI)
- contexts/AuthContext.tsx — AuthProvider avec login/register/logout/updateUser + AsyncStorage

## Test Results (Beta)
- Backend: All endpoints functional ✅
- Frontend: All screens implemented ✅

## New Features Added (March 2026)
1. ✅ Page profil utilisateur externe (/user/[id]) avec follow/unfollow
2. ✅ Modal d'édition de profil depuis Settings
3. ✅ Lecteur vidéo YouTube intégré
4. ✅ Bouton Watchlist sur page film
5. ✅ Navigation vers profils depuis les posts sociaux

## Prioritized Backlog

### P0 — Bloquant (à faire avant v1.1)
- [ ] Intégration CDN pour contenu vidéo réel (remplacer YouTube)
- [ ] Upload et soumission de films par les réalisateurs
- [ ] API endpoint pour mise à jour profil (PUT /api/users/me)

### P1 — Haute priorité (v1.1)
- [ ] Notifications push réelles (Firebase)
- [ ] Recherche d'utilisateurs
- [ ] Mode offline (cache des données)
- [ ] Stories interactives

### P2 — Améliorations (v1.2)
- [ ] Filtres avancés (pays, langue, année)
- [ ] Système de badges et accomplissements
- [ ] Statistiques détaillées pour les réalisateurs
- [ ] Export de listes (Top 10 partageables)
- [ ] Mode Premium (sans pub, HD, contenu exclusif)

## Localhost Setup Guide

```bash
# 1. Clone le repo
git clone <your-repo-url>
cd <project-folder>

# 2. Backend Setup
cd backend
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Créer .env avec: MONGO_URL=mongodb://localhost:27017 et DB_NAME=universe
uvicorn server:app --reload --port 8001

# 3. Frontend Setup (nouveau terminal)
cd frontend
yarn install  # ou npm install
# Créer .env avec: EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
npx expo start

# 4. Accès
# - Backend API: http://localhost:8001/api
# - Frontend Web: Pressez 'w' dans le terminal Expo
# - Mobile: Scanner le QR code avec Expo Go
```
