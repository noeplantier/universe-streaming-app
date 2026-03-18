import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, RefreshControl, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Modal, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../../constants/theme';
import { postsAPI, filmsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Post {
  id: string; user_id: string; content: string; film_id?: string;
  likes_count: number; liked_by?: string[]; comments_count: number;
  created_at: string;
  user?: { id: string; username: string; avatar_url: string; role: string };
  film?: { id: string; title: string; poster_url: string; genre: string };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

function PostCard({ post, currentUserId, onLike }: { post: Post; currentUserId: string | undefined; onLike: (id: string) => void }) {
  const router = useRouter();
  const isLiked = post.liked_by?.includes(currentUserId || '') || false;

  return (
    <View testID={`post-card-${post.id}`} style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <TouchableOpacity onPress={() => router.push(`/film/${post.film_id}`)} style={styles.avatarRow}>
          <Image source={{ uri: post.user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' }} style={styles.avatar} />
          <View>
            <View style={styles.usernameRow}>
              <Text style={styles.username}>{post.user?.username || 'Anonyme'}</Text>
              {post.user?.role === 'director' && <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>🎬 Réalisateur</Text></View>}
              {post.user?.role === 'critic' && <View style={[styles.roleBadge, { backgroundColor: 'rgba(255,200,0,0.15)' }]}><Text style={[styles.roleBadgeText, { color: '#FFD60A' }]}>✍️ Critique</Text></View>}
              {post.user?.role === 'creator' && <View style={[styles.roleBadge, { backgroundColor: 'rgba(0,224,150,0.15)' }]}><Text style={[styles.roleBadgeText, { color: '#00E096' }]}>⭐ Créateur</Text></View>}
            </View>
            <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textTertiary} />
      </View>

      {/* Content */}
      <Text style={styles.postContent}>{post.content}</Text>

      {/* Film ref */}
      {post.film && (
        <TouchableOpacity testID={`post-film-${post.id}`} onPress={() => router.push(`/film/${post.film!.id}`)} style={styles.filmRef}>
          <Image source={{ uri: post.film.poster_url }} style={styles.filmRefImage} />
          <View style={styles.filmRefInfo}>
            <Text style={styles.filmRefTitle} numberOfLines={1}>{post.film.title}</Text>
            <Text style={styles.filmRefGenre}>{post.film.genre}</Text>
          </View>
          <Ionicons name="play-circle" size={28} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* Actions */}
      <View style={styles.postActions}>
        <TouchableOpacity testID={`post-like-${post.id}`} onPress={() => onLike(post.id)} style={styles.actionBtn}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#FF3B30' : COLORS.textSecondary} />
          <Text style={[styles.actionCount, isLiked && { color: '#FF3B30' }]}>{post.likes_count + (isLiked && !post.liked_by?.includes(currentUserId || '') ? 1 : 0)}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionCount}>Partager</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SocialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  const fetchPosts = useCallback(async () => {
    try {
      const data = await postsAPI.getAll();
      setPosts(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handleLike(postId: string) {
    if (!user) { Alert.alert('', 'Connectez-vous pour liker'); return; }
    try {
      await postsAPI.like(postId);
      setLikedPosts(prev => {
        const next = new Set(prev);
        if (next.has(postId)) next.delete(postId); else next.add(postId);
        return next;
      });
      setPosts(prev => prev.map(p => p.id === postId
        ? { ...p, likes_count: likedPosts.has(postId) ? p.likes_count - 1 : p.likes_count + 1 }
        : p));
    } catch {}
  }

  async function handlePost() {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      const post = await postsAPI.create({ content: newContent.trim() });
      setPosts(prev => [{ ...post, user: { id: user!.id, username: user!.username, avatar_url: user!.avatar_url, role: user!.role } }, ...prev]);
      setNewContent('');
      setShowCreate(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setPosting(false);
    }
  }

  const STORIES = posts.slice(0, 6).map(p => p.user).filter(Boolean);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.background }}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Social</Text>
          <TouchableOpacity testID="social-create-btn" onPress={() => setShowCreate(true)} style={styles.createBtn}>
            <LinearGradient colors={GRADIENTS.primary} style={styles.createBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Poster</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <PostCard post={item} currentUserId={user?.id} onLike={handleLike} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View>
              {/* Stories/Active Users */}
              <View style={styles.storiesSection}>
                <Text style={styles.storiesTitle}>En ligne</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: SPACING.screenEdge }}>
                  {STORIES.map((u, i) => u && (
                    <View key={i} style={styles.storyItem}>
                      <LinearGradient colors={GRADIENTS.primary} style={styles.storyRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Image source={{ uri: u.avatar_url }} style={styles.storyAvatar} />
                      </LinearGradient>
                      <Text style={styles.storyName} numberOfLines={1}>{u.username.substring(0, 8)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.divider} />
            </View>
          }
        />
      )}

      {/* Create Post Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
            <View style={styles.createSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>Nouveau Post</Text>
              <View style={styles.createRow}>
                <Image source={{ uri: user?.avatar_url }} style={styles.createAvatar} />
                <TextInput
                  testID="social-post-input"
                  style={styles.postInput}
                  placeholder="Partagez votre avis sur le cinéma indépendant..."
                  placeholderTextColor={COLORS.textTertiary}
                  value={newContent}
                  onChangeText={setNewContent}
                  multiline
                  autoFocus
                />
              </View>
              <TouchableOpacity testID="social-post-submit" onPress={handlePost} disabled={posting || !newContent.trim()} activeOpacity={0.85}>
                <LinearGradient
                  colors={!newContent.trim() ? ['#333', '#222'] : GRADIENTS.primary}
                  style={styles.postSubmitBtn}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                >
                  {posting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.postSubmitText}>Publier</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 14 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  createBtn: {},
  createBtnGrad: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.full },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  storiesSection: { paddingTop: 16, paddingBottom: 12 },
  storiesTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textTertiary, paddingHorizontal: SPACING.screenEdge, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  storyItem: { alignItems: 'center', gap: 6 },
  storyRing: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: COLORS.background },
  storyName: { color: COLORS.textSecondary, fontSize: 10, maxWidth: 56, textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.screenEdge },
  postCard: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.screenEdge, marginTop: 16, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight },
  postHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: COLORS.border },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  username: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  roleBadge: { backgroundColor: 'rgba(140,46,186,0.15)', borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { color: COLORS.primary, fontSize: 10, fontWeight: '600' },
  timestamp: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postContent: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 22, marginBottom: 12 },
  filmRef: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 10, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  filmRefImage: { width: 44, height: 60, borderRadius: 6 },
  filmRefInfo: { flex: 1 },
  filmRefTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  filmRefGenre: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postActions: { flexDirection: 'row', gap: 20, paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { color: COLORS.textSecondary, fontSize: 13 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  createSheet: { backgroundColor: '#0B0014', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  createRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  createAvatar: { width: 40, height: 40, borderRadius: 20 },
  postInput: { flex: 1, color: COLORS.textPrimary, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  postSubmitBtn: { borderRadius: RADIUS.full, paddingVertical: 14, alignItems: 'center' },
  postSubmitText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
