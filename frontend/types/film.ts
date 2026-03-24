export interface Film {
    /** Identifiant unique du film */
    id: number | string;
    
    /** Titre du film */
    title: string;
    
    /** URL de l'affiche (format portrait) */
    poster_url: string;
    
    /** URL de l'image de fond (format paysage), optionnel */
    backdrop_url?: string;
    
    /** Résumé ou synopsis du film, optionnel */
    overview?: string;
    
    /** Date de sortie (format ISO string YYYY-MM-DD), optionnel */
    release_date?: string;
    
    /** Note moyenne (ex: 7.5), optionnel */
    vote_average?: number;
    
    /** Liste des IDs de genres associés, optionnel */
    genre_ids?: number[];
  }