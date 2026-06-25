# Passe performance / stabilité / scalabilité — 2026-06-25

Journal des décisions de la passe staff-engineer sur Universe (audit + fixes).
Contexte global : objectif 10 000 viewers simultanés + 500 vidéos uploadées
d'environ 25 min, sans redesign radical. Disque machine à 100% pendant toute
la session (120 Mo libres / 228 Go) — voir "Contrainte disque" en bas.

---

## 1. Auth streaming/upload : JWT → X-Device-Id

**Contexte** : `routes/streaming.py` et `routes/upload.py` exigeaient un JWT
décodé via `JWT_SECRET`. Mais l'app entière fonctionne en identité anonyme
par UUID device (`frontend/services/api.ts`, commentaire explicite : "ZÉRO
appel Supabase Auth... RLS USING (true) → accessible sans JWT"). Aucun code
frontend ne produisait jamais ce JWT — chaque appel à `/api/stream/*/token`
envoyait `Authorization: Bearer ` (vide) → 401 systématique.

**Décision** : remplacer la dépendance JWT par un header `X-Device-Id`
(`backend/services/auth_helpers.py`), cohérent avec `routes/data.py`/`users.py`
qui ne demandaient déjà aucun JWT. Le token DRM (HMAC, `drm_service.py`) reste
inchangé — seule la couche "qui demande" change, pas la protection anti-partage.

**Alternative écartée** : implémenter un vrai système d'auth (Supabase Auth
complet, JWT signés, sessions). Rejetée : aurait touché tout le modèle de
données (RLS ouvertes, table `profiles` vs `users`) pour un gain hors scope —
contraire à "pas de redesign radical".

**Risque** : si un jour une vraie auth utilisateur est introduite, il faudra
revisiter ce binding device-id → repenser le DRM en conséquence à ce moment.

---

## 2. Transcodage : BackgroundTasks → Celery

**Contexte** : `routes/upload.py` lançait `transcode_video` via FastAPI
`BackgroundTasks` — FFmpeg tournait *dans le conteneur API*. Un pipeline
Celery complet existait déjà (`worker/celery_app.py`, `worker/tasks.py`,
service `transcoder` dans `docker-compose.yml`, 2 replicas) mais n'était
jamais invoqué : infrastructure provisionnée et morte.

**Décision** : `start_transcode` appelle maintenant `transcode_task.delay(...)`.

**Risque connu** : nécessite Redis + au moins un worker Celery actif. Sans
ça, l'upload reste en `pending_upload` indéfiniment sans erreur visible.
**Conséquence locale** : le venv de dev (`backend/venv`) n'a pas `celery`
installé → `main.py` ne s'importe plus tant que
`pip install -r requirements.txt` n'est pas relancé. Les images Docker
api/transcoder l'installent déjà fraîchement (`Dockerfile.api`/`.transcoder`),
donc aucun impact en déploiement — seulement sur l'exécution locale hors
Docker. Déférré : `pip install` non lancé dans cette session (disque).

---

## 3. Client Supabase : singleton au lieu de recréation par appel

**Contexte** : `services/video_storage.py` recréait un `create_client()`
(et son pool httpx) à chaque appel, en synchrone, depuis des routes `async
def` — bloque l'event loop sur chaque requête. `database.py` avait déjà le
bon pattern (singleton paresseux + cache anti-thundering-herd) mais n'était
utilisé par rien.

**Décision** : `video_storage.py` utilise `database.get_supabase()`. Upload
des segments HLS parallélisé (`ThreadPoolExecutor`, 12 workers) — était
strictement séquentiel (~1000 fichiers/vidéo).

**Non fait, à surveiller** : les appels restent des fonctions synchrones
invoquées depuis des handlers `async def` (pas de `run_in_threadpool`
explicite). FastAPI/Starlette n'offload pas automatiquement le code sync
appelé À L'INTÉRIEUR d'un `async def` (contrairement à un handler `def`
classique) — sous forte charge réelle (10k viewers), ça reste le prochain
goulot à mesurer en premier si la latence de `/token` se dégrade.

---

## 4. GalaxyBackground : Skia, choix validé avec l'utilisateur

**Contexte** : deux implémentations quasi-dupliquées (`components/social/`,
`components/studio/`) + une 3e réimplémentation locale découverte dans
`app/review/[id].tsx` — chacune montant 55-60 `Animated.View` individuels
+ boucles `Animated.loop`. Avec le `<Stack>` racine (pas de `<Tabs>` natif),
les écrans empilés restaient montés dessous → 2+ instances simultanées
confirmées par grep (ex: `film/[id]` + l'écran `(tabs)` dessous).

**Décision** (3 options présentées, Skia choisie) : nouveau composant unique
`frontend/components/shared/GalaxyBackground.tsx`, un seul `<Canvas>` Skia,
piloté par des worklets Reanimated (une horloge partagée, pas une boucle par
étoile). Remplacement à l'identique sur les 14 sites d'appel + le site local
de review/[id].tsx (15 au total). Fallback `LinearGradient` statique sur web
(CanvasKit/WASM non justifié pour un fond d'écran).

**Non fait, volontairement** : le hissage en instance unique globale (root
layout) n'a pas été fait dans cette passe — chaque écran monte toujours sa
propre instance Skia. Le rendre vraiment unique impliquerait de passer
`contentStyle.backgroundColor` à transparent sur chaque écran du Stack, donc
un risque de régression visuelle écran par écran qu'on ne peut pas valider
sans lancer l'app (cf. contrainte disque). Le gain de perf de cette passe
vient déjà du remplacement Views→Canvas, pas du dé-duplication d'instances.

**Risque non vérifié** : Skia nécessite un dev client natif (`expo prebuild`
+ build), **pas Expo Go** — `Podfile.lock`/`Pods/` n'existent pas encore dans
ce checkout (jamais buildé nativement ici). À valider au premier build natif
une fois le disque libéré.

**Anciens fichiers conservés** (`components/social/GalaxyBackground.tsx`,
`components/studio/GalaxyBackground.tsx`) : orphelins (zéro import restant)
mais non supprimés — chemin de retour immédiat si la validation visuelle
révèle un problème.

---

## 5. Fuites d'animations (Animated.loop sans cleanup)

**Contexte** : plusieurs `Animated.loop()` démarrés sans jamais être
`.stop()`-és — chaque déclenchement (changement de prop, montage répété)
empile une nouvelle boucle infinie sur la précédente.

**Corrigés** : `contexts/GamificationSystem.tsx` (modale level-up, glow XP
bar ×2 — découplés de `profile.pct` qui les redéclenchait à chaque gain
d'XP), `app/(tabs)/search.tsx` (10 étoiles décoratives d'OracleGame).
**Vérifié déjà correct** (faux positif de l'audit initial) :
`WeeklyChallengeCard` avait déjà son cleanup.

**setTimeout/setInterval sans cleanup, corrigés** : `StarMap.flip` (carte
qui se retourne après 900ms), `CosBotGame.handleUserDone` (compteur du bot).

---

## 6. Pistes vérifiées puis écartées (pas d'action)

Documenté pour éviter de re-creuser inutilement plus tard :
- **Contexte XP/badges "partagé"** : l'audit initial supposait un
  `Context.Provider` causant des re-renders croisés. En réalité
  `useGamification` est un hook simple (pas de Context), `profile`/`badges`
  sont déjà des `useState` indépendants. Rien à scinder.
- **Grille de résultats de quiz en FlatList** : liste plafonnée à 12 éléments
  (`.slice(0,12)`) — la virtualisation n'apporte rien à cette taille, aurait
  ajouté de la complexité pour zéro gain réel.
- **`ffmpeg-kit-react-native` / `expo-av`** : tous deux activement utilisés
  (export studio, prévisualisation review/[id].tsx, import/thumbnail studio)
  — pas du code mort, pas de retrait justifié.

## 7. Nettoyage

- `backend/server.py` supprimé (320 lignes, doublon FastAPI legacy jamais
  importé, logique d'auth bcrypt/JWT divergente de `routes/auth.py` actif).
- `motor` et `bcrypt` retirés de `requirements.txt` (zéro usage — tout est
  Supabase/Postgres ; `bcrypt` n'était utilisé que par `server.py`).
- `nginx.conf` → `nginx.conf.template` : le placeholder littéral
  `your-supabase-project.supabase.co` ne pouvait jamais être substitué (fichier
  monté tel quel, pas en `.template`). Migré vers le mécanisme officiel
  envsubst-on-templates de l'image `nginx:1.25-alpine` (`SUPABASE_URL`,
  `VIDEO_BUCKET` ajoutés aux env du service nginx dans docker-compose.yml).
- `app/(tabs)/_layout.tsx` réduit à un layout de groupe minimal — il
  contenait une quasi-copie complète du root layout (même Stack, écrans qui
  ne sont pourtant pas enfants de ce groupe). La version la plus complète
  (FLAG_SECURE Android + dissuasion web) a été fusionnée dans le vrai root
  `app/_layout.tsx`, qui ne l'avait pas — possible régression de sécurité
  non vérifiée en runtime (à confirmer sur device au prochain build natif).

## 8. Trouvé mais non traité (hors scope de cette passe)

- `videos.director_id` référence `public.users(id)` (FK), mais l'app ne
  peuple jamais cette table — seulement `public.profiles` (device UUID). Tant
  que rien n'insère dans `users`, tout `POST /api/upload/init` réel échouera
  sur la contrainte FK. Pas de caller frontend actuellement (vérifié), donc
  latent. Décision à prendre : FK vers `profiles` à la place, ou peupler
  `users` en parallèle.
- `backend/middleware/auth_middleware.py` : système JWT+Redis+ban-check bien
  construit mais jamais branché (zéro import). Contrairement à `server.py`,
  pas supprimé — réfère `users.status`/`role`, cohérent avec le point
  précédent ; pourrait être l'amorce d'un futur palier "comptes vérifiés"
  plutôt que du code mort pur. À trancher par l'équipe.
- `backend/tests/test_universe.py` : la fixture `auth_headers` attend un
  champ `token` que `/api/auth/login` ne renvoie jamais (`{"status","user"}`
  seulement) — cassé indépendamment de cette passe.

## Contrainte disque (toute la session)

Disque à 100% (120 Mo libres / 228 Go) dès le début de la session. Décisions
prises en conséquence :
- Aucun `pip install` / `npm install` / build Docker exécuté.
- Aucun lancement de serveur de dev (`expo start`, `uvicorn`) pour valider
  visuellement — tout ce qui touche au rendu (GalaxyBackground, layout
  consolidé, FLAG_SECURE) est vérifié statiquement (lecture de code, git log,
  `tsc --noEmit`) mais **pas** en exécution réelle.
- Scripts de charge (`tests/load/locustfile.py`) et de stockage
  (`tests/load/storage_diffusion_test.py`) rédigés et documentés, non exécutés.
- Prochaine étape une fois l'espace libéré : `pip install -r requirements.txt`
  dans `backend/venv`, build natif frontend (`expo prebuild`), puis suivre la
  section Vérification du plan de cette passe.
