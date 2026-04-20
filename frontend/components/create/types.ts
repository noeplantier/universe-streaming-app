export type Step = 0 | 1 | 2;

export interface ReelMeta {
  title:    string;
  genre:    string;
  director: string;
  year:     string;
  synopsis: string;
}

export interface Critique {
  id:         string;
  user_id:    string;
  reel_id:    string | null;
  film_title: string;
  titre:      string;
  contenu:    string;
  note:       number | null;  
  tags:       string[];
  created_at: string;
  updated_at: string;
}

export interface ReelRef {
  id:    string;
  title: string;
}