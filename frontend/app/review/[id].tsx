import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { DEFAULT_REVIEWS } from '../../components/profile/data';

const { width: W, height: H } = Dimensions.get('window');

const G = {
  bg0: '#060010',
  bg1: '#0A001E',
  bg2: '#070014',
  textSub: '#BCB8C2',
  primary: '#C060FF',
  glass: 'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
};

export default function ReviewDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchReview = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(false);

    // 1) Vérification si l'ID est un vrai UUID Supabase ou un faux ID de de test (ex: "cr2")
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 2) Gérer les données de test (Mock data)
    if (!isUUID) {
      const mockReview = DEFAULT_REVIEWS.find(r => r.id === id);
      if (mockReview) {
        setReview({
          id: mockReview.id,
          content: mockReview.content,
          rating: mockReview.rating,
          likes_count: mockReview.likes,
          created_at: mockReview.date,
          user: { 
            username: 'Critique Cinéma', 
            avatar_url: `https://i.pravatar.cc/150?u=${mockReview.id}` 
          },
          film: {
            id: mockReview.film.id,
            title: mockReview.film.title,
            poster_url: mockReview.film.posterUrl,
            genre: mockReview.film.genre || '—',
          }
        });
        setLoading(false);
        return;
      }

      setError(true);
      setLoading(false);
      return;
    }

    // 3) Gérer les vraies données Supabase si c'est un UUID
    try {
      const { data: reviewData, error: reviewErr } = await supabase
        .from('critiques')
        .select('*')
        .eq('id', id)
        .single();

      if (reviewErr) throw reviewErr;

      let userData: any = null;

      if (reviewData?.user_id) {
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .eq('id', reviewData.user_id)
          .maybeSingle();

        if (!profileErr) userData = profile;
      }

      const filmTitle = reviewData.film_title || reviewData.title || 'Film inconnu';
      
      setReview({
        ...reviewData,
        user: userData,
        film: {
          id: reviewData.reel_id || reviewData.id,
          title: filmTitle,
          poster_url: `https://picsum.photos/seed/${encodeURIComponent(filmTitle)}/500/750`,
          genre: '—',
        },
      });

    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReview();
  }, [fetchReview]);

  const stars = useMemo(() => [1, 2, 3, 4, 5], []);

  if (loading) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={G.primary} />
      </View>
    );
  }

  if (error || !review) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={56} color="rgba(255,255,255,0.2)" />
        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 16, marginTop: 16 }}>
          Critique introuvable
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtnCenter}>
          <Text style={{ color: G.primary, fontWeight: '700' }}>← Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[G.bg0, G.bg1, G.bg2]} style={StyleSheet.absoluteFill} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Navigation */}
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <BlurView intensity={30} tint="dark" style={s.blurCircle}>
              <Ionicons name="chevron-back" size={22} color="white" />
            </BlurView>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Critique</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Film Context */}
        {!!review.film && (
          <TouchableOpacity
            style={s.filmCard}
            onPress={() => router.push(`/film/${review.film.id}`)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: review.film.poster_url }} style={s.filmPoster} />
            <View style={s.filmInfo}>
              <Text style={s.filmTitle}>{review.film.title}</Text>
              <Text style={s.filmGenre}>{review.film.genre}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={G.textSub} />
          </TouchableOpacity>
        )}

        {/* Review Content */}
        <View style={s.reviewBody}>
          <View style={s.userRow}>
            <Image
              source={{ uri: review.user?.avatar_url || 'https://i.pravatar.cc/100?img=13' }}
              style={s.userAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.userName}>{review.user?.username || 'Utilisateur inconnu'}</Text>
              <View style={s.ratingRow}>
                {stars.map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= (review.rating || 0) ? 'star' : 'star-outline'}
                    size={14}
                    color="#FFD700"
                  />
                ))}
              </View>
            </View>
          </View>

          <Text style={s.reviewText}>{review.content}</Text>

          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Ionicons name="heart" size={18} color={G.primary} />
              <Text style={s.statText}>{review.likes_count || 0}</Text>
            </View>

            <View style={s.statItem}>
              <Ionicons name="calendar-outline" size={18} color={G.textSub} />
              <Text style={s.statText}>
                {review.created_at ? new Date(review.created_at).toLocaleDateString() : '—'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: G.bg0 },
  scroll: { paddingBottom: 100 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 20,
  },
  backBtn: {},
  blurCircle: {
    width: 40, height: 40, borderRadius: 20, overflow: 'hidden',
    justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: G.glassBorder,
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
  backBtnCenter: {
    marginTop: 20, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 24, borderWidth: 1, borderColor: G.primary,
  },
  filmCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: G.glass,
    marginHorizontal: 20, padding: 12, borderRadius: 16, borderWidth: 1,
    borderColor: G.glassBorder, marginBottom: 24,
  },
  filmPoster: { width: 50, height: 75, borderRadius: 8, marginRight: 12, backgroundColor: G.glassBorder },
  filmInfo: { flex: 1 },
  filmTitle: { color: 'white', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  filmGenre: { color: G.textSub, fontSize: 13 },
  reviewBody: {
    backgroundColor: G.glass, marginHorizontal: 20, padding: 20,
    borderRadius: 20, borderWidth: 1, borderColor: G.glassBorder,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  userAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12, backgroundColor: G.glassBorder },
  userName: { color: 'white', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', gap: 2 },
  reviewText: { color: 'white', fontSize: 16, lineHeight: 26, marginBottom: 24, fontStyle: 'italic' },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: G.glassBorder, paddingTop: 16,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: G.textSub, fontSize: 13, fontWeight: '600' },
});