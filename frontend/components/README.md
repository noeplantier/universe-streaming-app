# 🌌 UNIVERSE — React Native Design System

Architecture de l'app "voie lactée" violet sombre, inspirée des mockups Sora.

---

## 📁 Fichiers générés

```
universe/
├── constants/
│   └── theme.ts              ← Design tokens (couleurs, gradients, radius, shadows)
│
├── components/
│   ├── StarField.tsx          ← Champ d'étoiles animé (fond galaxy)
│   ├── GlowButton.tsx         ← Bouton CTA avec halo lumineux pulsant
│   └── GalaxyTabBar.tsx       ← Bottom nav glassmorphism + bouton ✦ central
│
└── screens/
    ├── HomeScreen.tsx          ← Accueil : Hero banner + Trending ranké + Nouveautés
    ├── FeedScreen.tsx          ← Reels TikTok : vidéo plein écran + action bar
    ├── SearchScreen.tsx        ← Rechercher : tabs Séries/Films + filtres + grid
    ├── ProfileScreen.tsx       ← Profil : header galaxy + stats + tabs + grid
    └── FilmDetailScreen.tsx    ← Détail film : hero + Lecture/Ma liste + épisodes
```

---

## 🎨 Design System

### Couleurs clés
| Token              | Valeur      | Usage                     |
|--------------------|-------------|---------------------------|
| `background`       | `#080010`   | Fond principal (espace)   |
| `primary`          | `#9B3FDE`   | Violet nébuleuse          |
| `primaryLight`     | `#C060FF`   | Accents lumineux          |
| `primaryGlow`      | gradient    | Boutons CTA + sparkle     |
| `gold`             | `#FFD60A`   | Étoiles de notation       |

### Composants clés
- **StarField** — 80 étoiles qui clignotent aléatoirement, fond de toutes les pages
- **GalaxyTabBar** — Barre glassmorphism, bouton ✦ central rotatif avec pulsation
- **GlowButton** — CTA avec halo violet pulsant autour du bouton
- `SHADOWS.primary` — Ombre violette pour cards et boutons

---

## 📦 Dépendances requises

```bash
npx expo install expo-linear-gradient expo-blur
# Déjà dans un projet Expo classique :
# react-native-safe-area-context @expo/vector-icons expo-router
```

---

## 🚀 Intégration rapide

### 1. Remplacer le thème
```ts
// Remplacer votre constants/theme.ts existant par le nouveau
import { COLORS, GRADIENTS, RADIUS, SHADOWS } from './constants/theme';
```

### 2. Remplacer les screens un par un
Chaque screen est **drop-in** — il conserve les mêmes props et appels API que votre code actuel.

### 3. Ajouter la TabBar galaxy
```tsx
// Dans votre layout _layout.tsx
import GalaxyTabBar from '../components/GalaxyTabBar';

// Remplacer votre tab bar existante par :
<GalaxyTabBar activeTab={currentTab} onTabPress={setTab} avatarUrl={user?.avatar_url} />
```

### 4. Ajouter StarField aux pages principales
```tsx
// En première ligne dans le return de chaque screen :
<StarField />
```

---

## ✨ Effets visuels implémentés

| Effet                    | Composant              |
|--------------------------|------------------------|
| Étoiles clignotantes     | `StarField`            |
| Blobs nébuleuse ambiant  | `HomeScreen`, `SearchScreen` |
| Halo pulsant CTA         | `GlowButton`, `GalaxyTabBar` |
| Anneau tournant ✦        | `GalaxyTabBar`         |
| Glassmorphism            | `FeedScreen`, `FilmDetailScreen`, `GalaxyTabBar` |
| Dégradé galaxy header    | `ProfileScreen`        |
| Ombre violette cards     | `SHADOWS.primary`      |
| Barre de progression     | `FeedScreen`           |
| Scale spring on press    | `HeroBanner`, `FeedScreen` |
| Parallax header shrink   | `ProfileScreen`        |
| Fade in animation        | `SearchScreen`         |
