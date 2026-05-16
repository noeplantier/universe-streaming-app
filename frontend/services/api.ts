import AsyncStorage from '@react-native-async-storage/async-storage';

// Remplacez par l'URL de votre backend FastAPI ou utilisez une variable d'environnement
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Fonction utilitaire de base pour les appels API
 */
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Service API principal exporté
 */
export const api = {
  // --- ENDPOINTS WORKS (Films / Créations) ---
  works: {
    // Récupère les créations d'un utilisateur spécifique
    getByUser: (userId: string) => fetchAPI(`/data/works?user_id=${userId}`),
    
    // Récupère la liste globale des films
    getAll: () => fetchAPI('/data/works'),
    
    // --- GESTION DES FILMS VUS (Seen Films) ---
    // Récupère l'historique des films vus par l'utilisateur
    getSeenFilms: (userId: string) => fetchAPI(`/data/seen?user_id=${userId}`),
    
    // Marque un film comme vu
    markAsSeen: (userId: string, workId: number) => fetchAPI(`/data/seen`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, work_id: workId })
    }),
    
    // Retire un film de la liste des vus
    removeSeenFilm: (userId: string, workId: number) => fetchAPI(`/data/seen`, {
      method: 'DELETE',
      body: JSON.stringify({ user_id: userId, work_id: workId })
    }),
  },

  // --- ENDPOINTS REELS ---
  reels: {
    getByUser: (userId: string) => fetchAPI(`/data/reels?user_id=${userId}`),
  },

  // --- ENDPOINTS USERS ---
  users: {
    getProfile: (userId: string) => fetchAPI(`/users/${userId}`),
    updateProfile: (userId: string, data: any) => fetchAPI(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  },

  // --- ENDPOINTS NOTIFICATIONS ---
  notifications: {
    getAll: () => fetchAPI(`/data/notifications`), // Ajustez l'URL selon votre backend
  },
};

export default api;