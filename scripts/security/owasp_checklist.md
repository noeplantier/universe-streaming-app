# Universe App — OWASP Mobile Top 10 (2024) Security Checklist

**Date :** 2026-07-02  
**App :** Universe — React Native / Expo Router  
**Architecture :** Supabase REST + Storage CDN, device-ID auth (ZERO supabase.auth.*)

---

## Légende
- ✅ Conforme / corrigé
- ⚠️ Partiel / à surveiller
- ❌ Vulnérable / action requise
- 🔍 À vérifier manuellement

---

## M1 — Improper Credential Usage

| Check | Statut | Action |
|-------|--------|--------|
| Clé anon Supabase hardcodée en fallback (`lib/supabase.ts:10`) | ⚠️ | La clé anon est publique par design (protégée par RLS), mais la coder en dur expose l'URL du projet. Utiliser `EXPO_PUBLIC_SUPABASE_ANON_KEY` uniquement en prod, fallback supprimé. |
| Aucune clé secrète (service_role) dans le code client | ✅ | Confirmé : seule la clé anon est présente. |
| Secrets non commités dans git | 🔍 | Exécuter `git grep -E "service_role\|eyJhbGci.*supabase.io"` pour vérifier. |
| Clé anon dans les logs d'erreur ou analytics | 🔍 | Vérifier que `SUPABASE_ANON` n'est pas loggé dans Sentry/analytics. |

---

## M2 — Inadequate Supply Chain Security

| Check | Statut | Action |
|-------|--------|--------|
| Dépendances npm auditées | 🔍 | Exécuter `npm audit --audit-level=high` et corriger les High/Critical. |
| Lockfile (package-lock.json) committé | ✅ | Présent dans le repo. |
| Dépendances avec CVE connues | 🔍 | Exécuter `npx snyk test` ou `npx audit-ci --high`. |
| expo-video, expo-blur, expo-image — versions à jour | 🔍 | `npx expo upgrade` pour aligner sur les dernières versions stables. |

**Commandes :**
```bash
cd frontend
npm audit --audit-level=high
npx snyk test --severity-threshold=high
```

---

## M3 — Insecure Authentication / Authorization

| Check | Statut | Action |
|-------|--------|--------|
| Authentification basée sur device ID (`getDeviceId()`) | ❌ | `getDeviceId()` génère un UUID stocké dans AsyncStorage. Sur un appareil rooté/jailbreaké, il est modifiable → usurpation d'identité. Documenter comme risque accepté ou implémenter une vérification serveur. |
| Backoffice (`/backoffice/universe-admin`) sans authentification | ❌ | N'importe qui connaissant l'URL peut accéder à l'interface de modération. Implémenter une gate d'auth (même basique : mot de passe admin Supabase ou variable d'env côté frontend). |
| RLS Supabase sur les tables sensibles | 🔍 | Vérifier dans la console Supabase que `user_preferences`, `daily_checkins`, `cinephile_profiles` ont des policies RLS restrictives. |
| Tokens JWT d'accès expirables | ⚠️ | La clé anon est un JWT avec expiration 2090 — très longue durée. Acceptable pour anon, mais tout service role doit avoir une rotation. |

---

## M4 — Insufficient Input/Output Validation

| Check | Statut | Action |
|-------|--------|--------|
| Longueur max sur les champs texte (title, synopsis, etc.) | ❌ | PostgREST n'impose pas de limite par défaut. Ajouter des contraintes `CHECK (char_length(title) <= 200)` côté DB. |
| Validation des URLs de vidéo avant stockage | ⚠️ | `VideoTab.tsx` valide l'extension mais pas le contenu MIME réel du fichier (peut uploader un .mp4 contenant du contenu malveillant). Ajouter validation MIME signature côté backend. |
| XSS dans les champs affichés | ✅ | React Native n'utilise pas de HTML brut — XSS classique impossible dans la UI native. |
| Injection via params URL (`[id]`, `[type]`) | ✅ | PostgREST paramétrise les requêtes — injection SQL neutralisée. |

---

## M5 — Insecure Communication

| Check | Statut | Action |
|-------|--------|--------|
| HTTPS partout | ✅ | Supabase force HTTPS sur toutes les API. |
| TLS 1.2+ | ✅ | Supabase utilise TLS 1.3. |
| Certificate Pinning | ❌ | Non implémenté. Sur iOS/Android, une attaque MITM avec un proxy comme Charles/Burp peut intercepter le trafic. Implémenter avec `react-native-ssl-pinning` ou via Expo EAS. |
| No-cache sur données sensibles | 🔍 | Vérifier les headers `Cache-Control` sur les réponses API (user_preferences, etc.). |

**Pour implémenter le certificate pinning (React Native) :**
```bash
npm install react-native-ssl-pinning
```
```typescript
// lib/supabase-pinned.ts
import { fetch as pinnedFetch } from 'react-native-ssl-pinning';
// Utiliser pinnedFetch pour les appels sensibles avec pin SHA256 de knrzbdqfflobfjdmqyte.supabase.co
```

---

## M6 — Inadequate Privacy Controls

| Check | Statut | Action |
|-------|--------|--------|
| PII dans les analytics/logs | 🔍 | Vérifier que `console.error` n'expose pas d'IDs utilisateurs en prod. Supprimer les logs de debug avant release. |
| Device ID = pseudo-identifiant permanent | ⚠️ | Le device ID agit comme un identifiant persistant non consenti. Ajouter un écran de consentement RGPD si déployé en Europe. |
| Crash reports (ex. Sentry) | 🔍 | Si Sentry est intégré, configurer `beforeSend` pour masquer les champs sensibles (user_id, device_id). |
| Vidéos stockées publiquement sans signed URLs | ❌ | Tous les fichiers de `community-images` sont accessibles à quiconque connaît l'URL. Activer les Signed URLs Supabase pour protéger le contenu. |

---

## M7 — Insufficient Binary Protections

| Check | Statut | Action |
|-------|--------|--------|
| Obfuscation Android (ProGuard/R8) | ❌ | Non activé dans le build Expo par défaut. Activer dans `android/app/build.gradle` : `minifyEnabled true`. |
| iOS Symbol stripping | ⚠️ | Expo strip symbols en release par défaut, mais vérifier le build EAS. |
| Détection de root/jailbreak | ❌ | Non implémenté. Ajouter `react-native-jailbreak-device` pour détecter les appareils compromis. |
| Anti-tampering | 🔍 | Vérifier que le bundle JS n'est pas extractible facilement (EAS OTA protections). |

---

## M8 — Security Misconfiguration

| Check | Statut | Action |
|-------|--------|--------|
| RLS désactivé sur des tables | 🔍 | Exécuter en SQL Supabase : `SELECT schemaname, tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_policies);` |
| Bucket `community-images` public | ❌ | Le bucket est entièrement public — n'importe qui peut lister et télécharger tout le contenu. Implémenter des **Signed URLs** avec expiration courte. |
| Policies de storage trop permissives | 🔍 | Vérifier dans Supabase Storage que les policies INSERT sont restreintes (actuellement : anon peut uploader dans `posts/` — intentionnel mais à documenter). |
| Mode debug actif en production | 🔍 | Vérifier que `__DEV__` est false en build EAS prod. |

**SQL pour vérifier les tables sans RLS :**
```sql
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN (
    SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public'
  );
```

---

## M9 — Insecure Data Storage

| Check | Statut | Action |
|-------|--------|--------|
| Device ID dans AsyncStorage (non chiffré) | ❌ | AsyncStorage est en clair sur Android (SQLite accessible sur appareils rootés). Migrer vers `expo-secure-store` pour les données d'identité. |
| Préférences utilisateurs locales en clair | ⚠️ | Les préférences (show_level_on_profile, etc.) sont en DB Supabase — pas de stockage local sensible détecté. |
| Cache HTTP/images en clair | ⚠️ | `expo-image` met en cache les images — incluant potentiellement des miniatures de vidéos privées si on les ajoute. |

**Migration AsyncStorage → SecureStore :**
```typescript
// services/api.ts — remplacer AsyncStorage par SecureStore
import * as SecureStore from 'expo-secure-store';

export async function getDeviceId(): Promise<string> {
  let id = await SecureStore.getItemAsync('device_id');
  if (!id) {
    id = generateUUID();
    await SecureStore.setItemAsync('device_id', id);
  }
  return id;
}
```

---

## M10 — Insufficient Cryptography

| Check | Statut | Action |
|-------|--------|--------|
| Chiffrement des vidéos au repos | ❌ | Les vidéos sont stockées en clair dans Supabase Storage. Pour du contenu premium, implémenter DRM (Widevine/FairPlay) ou au minimum AES-128 encryption sur les segments. |
| Rotation des clés d'accès | 🔍 | Documenter une procédure de rotation de la clé anon (nécessite un redéploiement). |
| Hachage des identifiants sensibles | ⚠️ | Le device ID est envoyé brut dans les logs. Hacher (SHA-256) avant d'inclure dans les analytics. |

---

## Plan d'action priorisé

### 🔴 Critique (corriger avant lancement public)
1. **Backoffice sans auth** — Ajouter une gate d'auth côté React Native (ex. env var `ADMIN_SECRET` vérifiée au montage)
2. **AsyncStorage → SecureStore** — Migrer `getDeviceId()` pour protéger l'identité device
3. **Signed URLs pour les vidéos** — Activer dans Supabase Storage pour éviter le hotlinking
4. **Rate limiting** — Activer via Supabase Edge Functions ou un proxy (Cloudflare Workers)
5. **add_xp RPC sans ownership check** — Ajouter `WHERE user_id = auth.uid()` (ou paramètre device_id vérifié)

### 🟡 Important (dans les 2 prochaines semaines)
6. **Certificate Pinning** — Protège contre les proxies MITM
7. **Contraintes de taille en DB** — `CHECK (char_length(title) <= 200)` etc.
8. **ProGuard/R8 Android** — Obfuscation du bundle
9. **Détection root/jailbreak** — Block ou warn l'utilisateur
10. **Audit des dépendances** — `npm audit` + Snyk en CI

### 🟢 À moyen terme (1 mois)
11. DRM pour contenu premium
12. Consentement RGPD si déploiement EU
13. SIEM / alerting sur les patterns d'accès anormaux (Supabase Logs → CloudWatch)
14. Pentest externe par un tiers
