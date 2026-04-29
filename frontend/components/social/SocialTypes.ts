import { TONE_KEYS, type Tone, type ProRole } from './SocialTokens';
export type { Tone, ProRole };

export interface SupabasePost {
  id: string; user_id: string; work_title: string; work_year: string;
  work_director: string; work_genre: string; rating: number; body: string;
  image_url: string; image_valid: boolean; tags: string[]; tone: string;
  likes_count: number; shares_count: number; created_at: string;
  profiles?: { display_name: string; avatar_url: string } | null;
}

export interface Post {
  id: string; userId: string; userName: string; avatar: string;
  timeAgo: string; content: string; likes: number; shares: number;
  work_title: string; work_year: string; work_director: string;
  work_genre: string; rating: number; image_url: string;
  tags: string[]; tone: Tone;
}

export interface Pro {
  id: string; name: string; role: ProRole; avatar: string | null;
  bio: string | null; films: string[]; location: string | null;
  contact_email: string | null; website: string | null;
  verified: boolean; open_to: string[]; created_at: string;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

export function mapPost(r: SupabasePost): Post {
  const tone: Tone = (TONE_KEYS as readonly string[]).includes(r.tone)
    ? (r.tone as Tone) : 'analyse';
  return {
    id: r.id, userId: r.user_id,
    userName: r.profiles?.display_name ?? 'Cinéphile',
    avatar:   r.profiles?.avatar_url   ?? `https://i.pravatar.cc/80?u=${r.user_id}`,
    timeAgo:  timeAgo(r.created_at),
    content:  r.body           ?? '',
    likes:    r.likes_count    ?? 0,
    shares:   r.shares_count   ?? 0,
    work_title:    r.work_title    ?? '',
    work_year:     r.work_year     ?? '',
    work_director: r.work_director ?? '',
    work_genre:    r.work_genre    ?? '',
    rating:    r.rating    ?? 0,
    image_url: r.image_url ?? '',
    tags:  Array.isArray(r.tags) ? r.tags : [],
    tone,
  };
}