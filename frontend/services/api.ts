import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

async function request(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem('universe_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api${path}`, { ...options, headers });
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

// Reviews
export const reviewsAPI = {
  getByFilm: (filmId: string) => request(`/reviews?film_id=${filmId}`),
  getByUser: (userId: string) => request(`/reviews?user_id=${userId}`),
  create: (data: { film_id: string; content: string; rating: number }) =>
    request('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  like: (id: string) => request(`/reviews/${id}/like`, { method: 'POST' }),
};

// Posts
export const postsAPI = {
  getAll: () => request('/posts'),
  create: (data: { content: string; film_id?: string }) =>
    request('/posts', { method: 'POST', body: JSON.stringify(data) }),
  like: (id: string) => request(`/posts/${id}/like`, { method: 'POST' }),
};

// Users
export const usersAPI = {
  getById: (id: string) => request(`/users/${id}`),
  follow: (id: string) => request(`/users/${id}/follow`, { method: 'POST' }),
};

// Films Seen
export const seenAPI = {
  markSeen: (filmId: string) =>
    request('/films-seen', { method: 'POST', body: JSON.stringify({ film_id: filmId }) }),
  getByUser: (userId: string) => request(`/films-seen?user_id=${userId}`),
};

// Token management
export const tokenAPI = {
  save: (token: string) => AsyncStorage.setItem('universe_token', token),
  get: () => AsyncStorage.getItem('universe_token'),
  remove: () => AsyncStorage.removeItem('universe_token'),
};
