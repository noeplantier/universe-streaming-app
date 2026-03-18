# UNIVERSE — Product Requirements Document

## Problem Statement
Application de streaming interactive mettant en avant le cinéma indépendant. Hyper-moderne, thème galaxie/espace, palette noir/violet profond/violet (#000000, #240056, #8C2EBA).

## Architecture
- **Frontend**: Expo SDK 54, React Native, expo-router (file-based routing)
- **Backend**: FastAPI + MongoDB
- **Auth**: JWT (PyJWT + bcrypt)
- **Navigation**: Bottom tabs (5 onglets) + Stack pour détail film et settings

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

## What's Been Implemented (MVP - March 2026)

### Backend (/app/backend/server.py)
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- GET /api/films (filtre genre, durée, recherche), GET /api/films/{id}
- GET /api/feed (films pour TikTok feed)
- GET/POST /api/reviews, POST /api/reviews/{id}/like
- GET/POST /api/posts, POST /api/posts/{id}/like
- GET /api/users/{id}, POST /api/users/{id}/follow
- POST /api/films-seen, GET /api/films-seen
- POST /api/seed (données auto-seedées au démarrage)
- 10 films mock avec durées variées, 3 users, 5 reviews, 5 posts

### Frontend (/app/frontend/app/)
- **(auth)/welcome.tsx** — Splash galaxy avec étoiles animées, CTAs connexion/inscription
- **(auth)/login.tsx** — Connexion email/password avec bouton démo
- **(auth)/register.tsx** — Inscription username/email/password
- **(tabs)/index.tsx** — Page Accueil: 3 sections horizontales (Long/Moyen/Court) + filtres genre
- **(tabs)/feed.tsx** — Feed TikTok-style: full-screen vertical, barre d'action droite (like/info/étoile/vu), modal info
- **(tabs)/social.tsx** — Social: stories row, fil de posts, create post modal, badges rôles utilisateurs
- **(tabs)/search.tsx** — Recherche: barre texte + filtres durée + filtres genre, grille résultats
- **(tabs)/profile.tsx** — Profil Instagram-style: stats (critiques/films vus/abonnés), 4 tabs horizontaux (Top10/Critiques/Films Vus/Réalisés)
- **film/[id].tsx** — Détail film: hero poster, stats (note/durée/vues), synopsis, tags, critiques, écrire critique
- **settings.tsx** — Paramètres: profil, abonnement premium, préférences, communauté, déconnexion

### Theme & Services
- constants/theme.ts — Palette de couleurs, gradients, spacing, radius
- services/api.ts — Toutes les fonctions API (authAPI, filmsAPI, reviewsAPI, postsAPI, usersAPI, seenAPI)
- contexts/AuthContext.tsx — AuthProvider avec login/register/logout + AsyncStorage

## Test Results (MVP)
- Backend: 21/21 tests passés ✅
- Frontend: Tous les écrans vérifiés ✅

## Prioritized Backlog

### P0 — Bloquant (à faire avant v1.1)
- [ ] Lecteur vidéo réel (YouTube embed ou react-native-video)
- [ ] Upload et soumission de films par les réalisateurs
- [ ] Commentaires sur les posts sociaux

### P1 — Haute priorité (v1.1)
- [ ] Système de watchlist/favoris persistant
- [ ] Notifications push (films recommandés, nouveaux abonnés)
- [ ] Page profil d'autres utilisateurs (/users/[id])
- [ ] Edition du profil (bio, avatar) depuis Settings
- [ ] Recherche d'utilisateurs

### P2 — Améliorations (v1.2)
- [ ] Mode hors-ligne (cache des données)
- [ ] Filtres avancés (pays, langue, année)
- [ ] Système de badges et accomplissements
- [ ] Statistiques détaillées pour les réalisateurs
- [ ] Export de listes (Top 10 partageables)
- [ ] Mode Premium (sans pub, HD, contenu exclusif)

## Next Tasks
1. Implémenter la page profil d'autres utilisateurs
2. Ajouter l'édition de profil depuis Settings
3. Ajouter le lecteur vidéo YouTube
4. Implémenter les commentaires sur les posts
