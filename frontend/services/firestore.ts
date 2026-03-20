import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  DocumentData,
  QueryConstraint,
  Firestore,
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1VyVDJwacN6jfsBXzAmkPD_qSql3YTo4",
  authDomain: "universe-52b3b.firebaseapp.com",
  projectId: "universe-52b3b",
  storageBucket: "universe-52b3b.firebasestorage.app",
  messagingSenderId: "448711560736",
  appId: "1:448711560736:web:7ae3dfef51bd876f44b645",
  measurementId: "G-8WPNJJ6KCG"
};

let app: FirebaseApp;
let db: Firestore;

function getApp(): FirebaseApp {
  if (!app) {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  }
  return app;
}

function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getApp());
  }
  return db;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FILMS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Film {
  id: string;
  title: string;
  director: string;
  duration_minutes: number;
  duration_type: 'short' | 'medium' | 'long';
  genre: string;
  synopsis: string;
  poster_url: string;
  year: number;
  language: string;
  episodes_count: number;
  content_type: string;
  tags: string[];
  rating: number;
  views_count: number;
  video_id: string;
  exclusive?: boolean;
  premium_only?: boolean;
  created_at?: string;
}

export const filmsFirestore = {
  async getAll(filters?: { genre?: string; duration_type?: string; search?: string }): Promise<Film[]> {
    const constraints: QueryConstraint[] = [];
    
    if (filters?.genre && filters.genre !== 'all') {
      constraints.push(where('genre', '==', filters.genre));
    }
    if (filters?.duration_type && filters.duration_type !== 'all') {
      constraints.push(where('duration_type', '==', filters.duration_type));
    }
    
    constraints.push(orderBy('rating', 'desc'));
    constraints.push(limit(100));
    
    const q = query(collection(getDb(), 'films'), ...constraints);
    const snapshot = await getDocs(q);
    let films = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Film));
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      films = films.filter(f => 
        f.title.toLowerCase().includes(searchLower) ||
        f.director.toLowerCase().includes(searchLower)
      );
    }
    
    return films;
  },

  async getById(id: string): Promise<Film | null> {
    const docRef = doc(getDb(), 'films', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Film : null;
  },

  async getByDuration(type: 'short' | 'medium' | 'long', count: number = 10): Promise<Film[]> {
    const q = query(
      collection(getDb(), 'films'),
      where('duration_type', '==', type),
      orderBy('rating', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Film));
  },

  async getFeatured(): Promise<Film | null> {
    const q = query(
      collection(getDb(), 'films'),
      orderBy('views_count', 'desc'),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Film;
  },

  async getTrending(count: number = 10): Promise<Film[]> {
    const q = query(
      collection(getDb(), 'films'),
      orderBy('views_count', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Film));
  },

  async getExclusive(): Promise<Film[]> {
    const q = query(
      collection(getDb(), 'films'),
      where('exclusive', '==', true),
      limit(20)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Film));
  },

  async incrementViews(id: string): Promise<void> {
    const docRef = doc(getDb(), 'films', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const current = docSnap.data().views_count || 0;
      await updateDoc(docRef, { views_count: current + 1 });
    }
  },

  // Real-time listener
  subscribeToFilm(id: string, callback: (film: Film | null) => void): () => void {
    const docRef = doc(getDb(), 'films', id);
    return onSnapshot(docRef, (docSnap) => {
      callback(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Film : null);
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════════════════════

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string;
  bio: string;
  role: 'viewer' | 'creator' | 'director' | 'critic';
  followers_count: number;
  following_count: number;
  films_seen_count: number;
  reviews_count: number;
  is_premium?: boolean;
  premium_expires_at?: string;
  top10?: string[];
  created_at: string;
}

export const usersFirestore = {
  async getById(id: string): Promise<User | null> {
    const docRef = doc(getDb(), 'users', id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
  },

  async getByEmail(email: string): Promise<User | null> {
    const q = query(collection(getDb(), 'users'), where('email', '==', email), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() } as User;
  },

  async create(user: Omit<User, 'id' | 'created_at'>): Promise<User> {
    const data = {
      ...user,
      created_at: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(getDb(), 'users'), data);
    return { id: docRef.id, ...data } as User;
  },

  async update(id: string, data: Partial<User>): Promise<void> {
    const docRef = doc(getDb(), 'users', id);
    await updateDoc(docRef, data);
  },

  async setPremium(id: string, expiresAt: string): Promise<void> {
    const docRef = doc(getDb(), 'users', id);
    await updateDoc(docRef, {
      is_premium: true,
      premium_expires_at: expiresAt,
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WATCH HISTORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface WatchHistory {
  id: string;
  user_id: string;
  film_id: string;
  progress: number;
  episode_number?: number;
  watched_at: string;
}

export const watchHistoryFirestore = {
  async get(userId: string, count: number = 20): Promise<WatchHistory[]> {
    const q = query(
      collection(getDb(), 'watch_history'),
      where('user_id', '==', userId),
      orderBy('watched_at', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchHistory));
  },

  async getContinueWatching(userId: string, count: number = 10): Promise<WatchHistory[]> {
    const q = query(
      collection(getDb(), 'watch_history'),
      where('user_id', '==', userId),
      where('progress', '<', 95),
      where('progress', '>', 0),
      orderBy('progress'),
      orderBy('watched_at', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WatchHistory));
  },

  async upsert(data: Omit<WatchHistory, 'id' | 'watched_at'>): Promise<void> {
    const q = query(
      collection(getDb(), 'watch_history'),
      where('user_id', '==', data.user_id),
      where('film_id', '==', data.film_id),
      limit(1)
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      await addDoc(collection(getDb(), 'watch_history'), {
        ...data,
        watched_at: new Date().toISOString(),
      });
    } else {
      await updateDoc(snapshot.docs[0].ref, {
        progress: data.progress,
        episode_number: data.episode_number,
        watched_at: new Date().toISOString(),
      });
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// WATCHLIST
// ═══════════════════════════════════════════════════════════════════════════════

export const watchlistFirestore = {
  async get(userId: string): Promise<string[]> {
    const q = query(
      collection(getDb(), 'watchlist'),
      where('user_id', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data().film_id);
  },

  async add(userId: string, filmId: string): Promise<void> {
    await addDoc(collection(getDb(), 'watchlist'), {
      user_id: userId,
      film_id: filmId,
      added_at: new Date().toISOString(),
    });
  },

  async remove(userId: string, filmId: string): Promise<void> {
    const q = query(
      collection(getDb(), 'watchlist'),
      where('user_id', '==', userId),
      where('film_id', '==', filmId)
    );
    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      await deleteDoc(doc.ref);
    }
  },

  async isInWatchlist(userId: string, filmId: string): Promise<boolean> {
    const q = query(
      collection(getDb(), 'watchlist'),
      where('user_id', '==', userId),
      where('film_id', '==', filmId),
      limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface Notification {
  id: string;
  user_id: string;
  type: 'new_release' | 'recommendation' | 'social' | 'promotion' | 'system';
  title: string;
  body: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export const notificationsFirestore = {
  async get(userId: string, count: number = 50): Promise<Notification[]> {
    const q = query(
      collection(getDb(), 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(count)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
  },

  async create(notification: Omit<Notification, 'id' | 'created_at' | 'read'>): Promise<Notification> {
    const data = {
      ...notification,
      read: false,
      created_at: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(getDb(), 'notifications'), data);
    return { id: docRef.id, ...data } as Notification;
  },

  async markRead(id: string): Promise<void> {
    const docRef = doc(getDb(), 'notifications', id);
    await updateDoc(docRef, { read: true });
  },

  async markAllRead(userId: string): Promise<void> {
    const q = query(
      collection(getDb(), 'notifications'),
      where('user_id', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      await updateDoc(doc.ref, { read: true });
    }
  },

  async getUnreadCount(userId: string): Promise<number> {
    const q = query(
      collection(getDb(), 'notifications'),
      where('user_id', '==', userId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  },

  // Real-time listener for notifications
  subscribe(userId: string, callback: (notifications: Notification[]) => void): () => void {
    const q = query(
      collection(getDb(), 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
      callback(notifications);
    });
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// SEED DATA TO FIRESTORE
// ═══════════════════════════════════════════════════════════════════════════════

export async function seedFirestoreData(): Promise<{ success: boolean; message: string }> {
  try {
    // Check if already seeded
    const filmsSnapshot = await getDocs(query(collection(getDb(), 'films'), limit(1)));
    if (!filmsSnapshot.empty) {
      return { success: true, message: 'Data already seeded' };
    }

    // Import films from API and save to Firestore
    const response = await fetch('https://cinema-social-dev.preview.emergentagent.com/api/films');
    const films = await response.json();
    
    for (const film of films) {
      await setDoc(doc(getDb(), 'films', film.id), film);
    }

    return { success: true, message: `Seeded ${films.length} films to Firestore` };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export { getDb, getApp };
