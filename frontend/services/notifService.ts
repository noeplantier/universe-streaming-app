/**
 * services/notifService.ts — UNIVERSE · SERVICE DE NOTIFICATIONS
 *
 * Couvre toutes les actions de profile.tsx et social.tsx :
 *   social.tsx  → like · mention · connexion pro · partage · nouveau post
 *   profile.tsx → reel approuvé/rejeté · visite profil · film vu
 *   VideoTab    → confirmation soumission reel
 *
 * ★ Robustesse :
 *   – push() retry une fois en cas d'échec réseau
 *   – insert groupé pour les notifications multi-utilisateurs
 *   – UUID guard : n'envoie jamais à un non-UUID
 *   – Pas d'auto-notification (acteur !== cible)
 */

import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES — correspondent au schéma public.notifications
// ─────────────────────────────────────────────────────────────────────────────
export type NotifType =
  | 'like'                 // quelqu'un a aimé votre post community
  | 'critique_like'        // quelqu'un a aimé votre critique
  | 'comment'              // commentaire sur votre critique/post
  | 'follow'               // quelqu'un consulte votre profil
  | 'connection_request'   // demande connexion pro (Pros tab)
  | 'connection_accepted'  // connexion pro acceptée
  | 'reel_submitted'       // confirmation soumission reel (vers le créateur)
  | 'reel_approved'        // reel validé par modération
  | 'reel_rejected'        // reel rejeté par modération
  | 'new_film'             // nouveau film dans un genre suivi
  | 'mention'              // mention @username dans un post/critique
  | 'seen_film'            // quelqu'un a marqué un film comme vu
  | 'system';              // notification système / backoffice

interface PushPayload {
  userId: string;
  type:   NotifType;
  title:  string;
  body:   string;
  data?:  Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// GUARDS
// ─────────────────────────────────────────────────────────────────────────────
function isUUID(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// PUSH — insertion simple avec 1 retry
// ─────────────────────────────────────────────────────────────────────────────
async function push(p: PushPayload): Promise<void> {
  if (!isUUID(p.userId)) {
    if (__DEV__) console.warn('[NotifService] push ignoré — userId non-UUID:', p.userId);
    return;
  }
  const row = {
    user_id:    p.userId,
    type:       p.type,
    title:      p.title,
    body:       p.body,
    data:       p.data ?? {},
    read:       false,
    created_at: new Date().toISOString(),
  };
  const { error } = await supabase.from('notifications').insert(row);
  if (error) {
    // 1 retry après 600 ms
    await new Promise(r => setTimeout(r, 600));
    const { error: e2 } = await supabase.from('notifications').insert(row);
    if (e2 && __DEV__) console.warn('[NotifService] push échec (×2):', e2.message);
  }
}

/** Insert groupé pour notifier plusieurs utilisateurs en une seule requête */
async function pushMany(payloads: PushPayload[]): Promise<void> {
  const rows = payloads
    .filter(p => isUUID(p.userId))
    .map(p => ({
      user_id:    p.userId,
      type:       p.type,
      title:      p.title,
      body:       p.body,
      data:       p.data ?? {},
      read:       false,
      created_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('notifications').insert(rows);
  if (error && __DEV__) console.warn('[NotifService] pushMany:', error.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESOLVE ACTOR — nom + avatar depuis profiles
// ─────────────────────────────────────────────────────────────────────────────
async function resolveActor(actorId: string): Promise<{ name: string; avatar: string | null }> {
  if (!isUUID(actorId)) return { name: 'Quelqu\'un', avatar: null };
  const { data } = await supabase
    .from('profiles')
    .select('display_name,username,avatar_url')
    .eq('id', actorId)
    .maybeSingle();
  return {
    name:   data?.display_name || data?.username || 'Un cinéphile',
    avatar: data?.avatar_url ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ SOCIAL.tsx — ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Like sur un post community — social.tsx toggleLike
 * Appelé quand un user like un post dont il n'est pas l'auteur
 */
export async function notifyLike(params: {
  postOwnerId: string;
  actorId:     string;
  postId:      string;
  filmTitle:   string;
}): Promise<void> {
  if (params.postOwnerId === params.actorId) return;
  const actor = await resolveActor(params.actorId);
  await push({
    userId: params.postOwnerId,
    type:   'like',
    title:  `${actor.name} a aimé votre critique`,
    body:   `Sur « ${params.filmTitle} »`,
    data: {
      post_id:    params.postId,
      actor_id:   params.actorId,
      actor_name: actor.name,
      avatar_url: actor.avatar,
      film_title: params.filmTitle,
    },
  });
}

/**
 * Mention @username dans un post/critique — social.tsx ComposeModal
 * Appelé après résolution des mentions dans le body du post
 */
export async function notifyMention(params: {
  mentionedUserId: string;
  actorId:         string;
  postId:          string;
  filmTitle:       string;
  bodyExcerpt:     string;
}): Promise<void> {
  if (params.mentionedUserId === params.actorId) return;
  const actor = await resolveActor(params.actorId);
  await push({
    userId: params.mentionedUserId,
    type:   'mention',
    title:  `${actor.name} vous a mentionné`,
    body:   params.bodyExcerpt.length > 80
              ? params.bodyExcerpt.slice(0, 77) + '…'
              : params.bodyExcerpt,
    data: {
      post_id:    params.postId,
      actor_id:   params.actorId,
      actor_name: actor.name,
      avatar_url: actor.avatar,
      film_title: params.filmTitle,
    },
  });
}

/**
 * Demande de connexion pro — social.tsx ConnectionRequestModal (dbSendConnection)
 */
export async function notifyConnectionRequest(params: {
  proUserId:   string;    // l'ID Supabase du professionnel
  requesterId: string;
  message:     string;
}): Promise<void> {
  if (params.proUserId === params.requesterId) return;
  const actor = await resolveActor(params.requesterId);
  await push({
    userId: params.proUserId,
    type:   'connection_request',
    title:  `${actor.name} souhaite se connecter`,
    body:   params.message.slice(0, 100),
    data: {
      requester_id:  params.requesterId,
      actor_name:    actor.name,
      avatar_url:    actor.avatar,
    },
  });
}

/**
 * Connexion pro acceptée — côté backoffice ou realtime
 */
export async function notifyConnectionAccepted(params: {
  requesterId: string;
  proName:     string;
  proId:       string;
}): Promise<void> {
  await push({
    userId: params.requesterId,
    type:   'connection_accepted',
    title:  'Connexion professionnelle acceptée',
    body:   `${params.proName} a accepté votre invitation.`,
    data: { pro_id: params.proId, pro_name: params.proName },
  });
}

/**
 * Commentaire sur une critique
 */
export async function notifyComment(params: {
  critiqueOwnerId: string;
  actorId:         string;
  critiqueId:      string;
  filmTitle:       string;
  commentExcerpt:  string;
}): Promise<void> {
  if (params.critiqueOwnerId === params.actorId) return;
  const actor = await resolveActor(params.actorId);
  await push({
    userId: params.critiqueOwnerId,
    type:   'comment',
    title:  `${actor.name} a commenté votre critique`,
    body:   `Sur « ${params.filmTitle} » : ${params.commentExcerpt.slice(0, 70)}`,
    data: {
      critique_id: params.critiqueId,
      actor_id:    params.actorId,
      actor_name:  actor.name,
      avatar_url:  actor.avatar,
      film_title:  params.filmTitle,
    },
  });
}

/**
 * Nouveau film correspondant aux goûts de plusieurs utilisateurs
 */
export async function notifyNewFilm(params: {
  targetUserIds: string[];
  filmId:        number;
  filmTitle:     string;
  genre:         string;
}): Promise<void> {
  await pushMany(params.targetUserIds.map(uid => ({
    userId: uid,
    type:   'new_film' as NotifType,
    title:  `Nouveau film : ${params.filmTitle}`,
    body:   `Un nouveau ${params.genre} vient d'être ajouté au catalogue Universe.`,
    data:   { film_id: params.filmId, film_title: params.filmTitle, genre: params.genre },
  })));
}

/**
 * Film vu — quelqu'un a marqué votre film comme vu
 */
export async function notifySeenFilm(params: {
  filmOwnerId: string;
  viewerId:    string;
  filmId:      number;
  filmTitle:   string;
}): Promise<void> {
  if (params.filmOwnerId === params.viewerId) return;
  const viewer = await resolveActor(params.viewerId);
  await push({
    userId: params.filmOwnerId,
    type:   'seen_film',
    title:  `${viewer.name} a regardé votre film`,
    body:   `« ${params.filmTitle} » vient d'être vu`,
    data: {
      film_id:    params.filmId,
      actor_id:   params.viewerId,
      actor_name: viewer.name,
      avatar_url: viewer.avatar,
      film_title: params.filmTitle,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ PROFILE.tsx / VideoTab — REELS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirmation de soumission du reel au créateur — VideoTab.tsx après upload
 */
export async function notifyReelSubmitted(params: {
  userId:    string;
  reelId:    string;
  reelTitle: string;
}): Promise<void> {
  await push({
    userId: params.userId,
    type:   'reel_submitted',
    title:  'Vidéo soumise à l\'équipe Universe',
    body:   `« ${params.reelTitle || 'Ta vidéo'} » est en attente de vérification.`,
    data:   { reel_id: params.reelId, reel_title: params.reelTitle },
  });
}

/**
 * Reel approuvé par la modération — déclenché par le backoffice
 */
export async function notifyReelApproved(params: {
  userId:    string;
  reelId:    string;
  reelTitle: string;
}): Promise<void> {
  await push({
    userId: params.userId,
    type:   'reel_approved',
    title:  '🎬 Vidéo publiée sur Universe',
    body:   `« ${params.reelTitle || 'Ta vidéo'} » est maintenant visible dans les Reels.`,
    data:   { reel_id: params.reelId, reel_title: params.reelTitle },
  });
}

/**
 * Reel rejeté par la modération — déclenché par le backoffice
 */
export async function notifyReelRejected(params: {
  userId:           string;
  reelId:           string;
  reelTitle:        string;
  rejectionCategory:string;
  rejectionReason:  string;
}): Promise<void> {
  const categories: Record<string,string> = {
    inappropriate: 'Contenu inapproprié',
    quality:       'Qualité insuffisante',
    format:        'Format non supporté',
    copyright:     'Problème de droits',
    spam:          'Spam détecté',
    other:         'Autre raison',
  };
  const cat = categories[params.rejectionCategory] ?? params.rejectionCategory;
  await push({
    userId: params.userId,
    type:   'reel_rejected',
    title:  'Vidéo non publiée',
    body:   `« ${params.reelTitle || 'Ta vidéo'} » — ${cat} : ${params.rejectionReason.slice(0,80)}`,
    data: {
      reel_id:            params.reelId,
      reel_title:         params.reelTitle,
      rejection_category: params.rejectionCategory,
      rejection_reason:   params.rejectionReason,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTÈME
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Notification système manuelle (annonces, maintenance, etc.)
 */
export async function notifySystem(params: {
  targetUserIds: string[];
  title:         string;
  body:          string;
  data?:         Record<string, unknown>;
}): Promise<void> {
  await pushMany(params.targetUserIds.map(uid => ({
    userId: uid,
    type:   'system' as NotifType,
    title:  params.title,
    body:   params.body,
    data:   params.data ?? {},
  })));
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrait les @mentions d'un texte et retourne les user_ids correspondants
 * Utilisé dans social.tsx ComposeModal après publication
 */
export async function resolveMentions(text: string): Promise<string[]> {
  const handles = [...text.matchAll(/@([a-z0-9._-]+)/gi)].map(m => m[1]);
  if (!handles.length) return [];
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .in('username', handles);
  return ((data ?? []) as any[]).map(r => r.id as string).filter(isUUID);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const NotifService = {
  // social.tsx
  like:                notifyLike,
  mention:             notifyMention,
  comment:             notifyComment,
  connectionRequest:   notifyConnectionRequest,
  connectionAccepted:  notifyConnectionAccepted,
  newFilm:             notifyNewFilm,
  seenFilm:            notifySeenFilm,
  // profile.tsx / VideoTab
  reelSubmitted:       notifyReelSubmitted,
  reelApproved:        notifyReelApproved,
  reelRejected:        notifyReelRejected,
  // système
  system:              notifySystem,
  // utils
  resolveMentions,
} as const;

export default NotifService;