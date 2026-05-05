import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function request(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('universe_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Si c’est une Edge Function, on n’ajoute pas "/api"
  const isFunction = path.startsWith('/functions/');
  const prefix = isFunction ? '' : '/api';

  const res = await fetch(`${BASE_URL}${prefix}${path}`, { ...options, headers });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Erreur réseau' }));
    throw new Error(err.detail || 'Erreur');
  }
  return res.json();
}

// Auth
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
};

// Films
export const filmsAPI = {
  getAll: (params?: { genre?: string; duration_type?: string; q?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request(`/films${qs ? `?${qs}` : ''}`);
  },
  getById: (id: string) => request(`/films/${id}`),
  getFeed: () => request('/feed'),
};

// Reviews (Edge Function)
export const reviewsAPI = {
  getByFilm: (filmId: string) =>
    request(`/functions/v1/reviews?film_id=${filmId}`),

  getByUser: (userId: string) =>
    request(`/functions/v1/reviews?user_id=${userId}`),

  create: (data: { film_id: string; content: string; rating: number }) =>
    request(`/functions/v1/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  like: (id: string) =>
    request(`/functions/v1/reviews/${id}/like`, { method: 'POST' }),
};

// Posts
export const postsAPI = {
  getAll: () => request('/posts'),
  create: (data: { content: string; film_id?: string }) =>
    request('/posts', { method: 'POST', body: JSON.stringify(data) }),
  like: (id: string) => request(`/posts/${id}/like`, { method: 'POST' }),
};

// Favorites
export const favoritesAPI = {
  getByUser: (userId: string) => request(`/favorites?user_id=${userId}`),
};

// Users
export const usersAPI = {
  getById: (id: string) => request(`/users/${id}`),
  follow: (id: string) => request(`/users/${id}/follow`, { method: 'POST' }),
};


// Watchlist
export const watchlistAPI = {
  get: (userId: string) => request(`/watchlist?user_id=${userId}`),
  add: (filmId: string) => request('/watchlist', { method: 'POST', body: JSON.stringify({ film_id: filmId }) }),
  remove: (filmId: string) => request(`/watchlist/${filmId}`, { method: 'DELETE' }),
};

// Films vus
export const seenApi = {

  get: (userId: string) => request(`/seen?user_id=${userId}`),
  add: (filmId: string) => request('/seen', { method: 'POST', body: JSON.stringify({ film_id: filmId }) }),

}

// Comments
export const commentsAPI = {
  getByPost: (postId: string) => request(`/comments?post_id=${postId}`),
  create: (data: { post_id: string; content: string }) =>
    request('/comments', { method: 'POST', body: JSON.stringify(data) }),
};

// Notifications
export const notificationsAPI = {
  getAll: () => request('/notifications'),
};

// Trending & Featured
export const discoverAPI = {
  trending: () => request('/trending'),
  featured: () => request('/featured'),
  getPost: (id: string) => request(`/posts/${id}`),
  newReleases: (limit: number = 10) => request(`/new-releases?limit=${limit}`),
  genres: () => request('/genres'),
};

// Watch History & Continue Watching
export const watchHistoryAPI = {
  get: (userId: string, limit: number = 20) => request(`/watch-history?user_id=${userId}&limit=${limit}`),
  add: (data: { user_id: string; film_id: string; progress: number; episode_number?: number }) =>
    request('/watch-history', { method: 'POST', body: JSON.stringify(data) }),
  continueWatching: (userId: string, limit: number = 10) => request(`/continue-watching?user_id=${userId}&limit=${limit}`),
};

// Recommendations & Premium
export const premiumAPI = {
  getRecommendations: (userId?: string, limit: number = 10) => 
    request(`/recommendations?${userId ? `user_id=${userId}&` : ''}limit=${limit}`),
  getPremiumContent: () => request('/premium-content'),
};

// Token management
export const tokenAPI = {
  save: (token: string) => AsyncStorage.setItem('universe_token', token),
  get: () => AsyncStorage.getItem('universe_token'),
  remove: () => AsyncStorage.removeItem('universe_token'),
};
