import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  FlatList, RefreshControl, ActivityIndicator, Modal, KeyboardAvoidingView, Platform, TextInput, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../../constants/theme';
import { postsAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import GlobalHeader from '../../components/GlobalHeader';

interface Post {
  id: string; user_id: string; content: string; film_id?: string;
  likes_count: number; liked_by?: string[]; comments_count: number; created_at: string;
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

const ROLE_BADGES: Record<string, { label: string; color: string; bg: string }> = {
  director: { label: '🎬 Réalisateur', color: COLORS.primary, bg: 'rgba(140,46,186,0.15)' },
  critic:   { label: '✍️ Critique',    color: '#FFD60A',        bg: 'rgba(255,214,10,0.15)' },
  creator:  { label: '⭐ Créateur',    color: '#00E096',        bg: 'rgba(0,224,150,0.15)' },
  viewer:   { label: '👁️ Spectateur', color: COLORS.textTertiary, bg: 'rgba(255,255,255,0.08)' },
};

function PostCard({ post, currentUserId, onLike, onComment }: {
  post: Post; currentUserId?: string;
  onLike: (id: string) => void;
  onComment: (post: Post) => void;
}) {
  const router = useRouter();
  const isLiked = post.liked_by?.includes(currentUserId || '') || false;
  const roleMeta = ROLE_BADGES[post.user?.role || 'viewer'];

  return (
    <View testID={`post-${post.id}`} style={styles.postCard}>
      <View style={styles.postHeader}>
        <Image source={{ uri: post.user?.avatar_url || '' }} style={styles.postAvatar} />
        <View style={{ flex: 1 }}>
          <View style={styles.usernameRow}>
            <Text style={styles.postUsername}>{post.user?.username}</Text>
            <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>
          </View>
          <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textTertiary} />
      </View>

      <Text style={styles.postContent}>{post.content}</Text>

      {post.film && (
        <TouchableOpacity onPress={() => router.push(`/film/${post.film!.id}`)} style={styles.filmRef}>
          <Image source={{ uri: post.film.poster_url }} style={styles.filmRefImage} />
          <View style={{ flex: 1 }}>
            <Text style={styles.filmRefTitle} numberOfLines={1}>{post.film.title}</Text>
            <Text style={styles.filmRefGenre}>{post.film.genre}</Text>
          </View>
          <Ionicons name="play-circle" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      <View style={styles.postActions}>
        <TouchableOpacity testID={`like-${post.id}`} onPress={() => onLike(post.id)} style={styles.actionBtn}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? '#FF3B30' : COLORS.textSecondary} />
          <Text style={[styles.actionCount, isLiked && { color: '#FF3B30' }]}>{post.likes_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity testID={`comment-${post.id}`} onPress={() => onComment(post)} style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionCount}>{post.comments_count}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="share-social-outline" size={20} color={COLORS.textSecondary} />
          <Text style={styles.actionCount}>Partager</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push(`/post/${post.id}`)} style={styles.actionBtn}>
          <Ionicons name="open-outline" size={18} color={COLORS.textTertiary} />
          <Text style={styles.actionCount}>Ouvrir</Text>
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
    try { const data = await postsAPI.getAll(); setPosts(data || []); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  async function handleLike(postId: string) {
    if (!user) return;
    try {
      await postsAPI.like(postId);
      setLikedPosts(prev => { const n = new Set(prev); n.has(postId) ? n.delete(postId) : n.add(postId); return n; });
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: likedPosts.has(postId) ? p.likes_count - 1 : p.likes_count + 1 } : p));
    } catch {}
  }

  function handleComment(post: Post) {
    router.push(`/post/${post.id}`);
  }

  async function handlePost() {
    if (!newContent.trim()) return;
    setPosting(true);
    try {
      const post = await postsAPI.create({ content: newContent.trim() });
      setPosts(prev => [{ ...post, user: { id: user!.id, username: user!.username, avatar_url: user!.avatar_url, role: user!.role } }, ...prev]);
      setNewContent('');
      setShowCreate(false);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
    finally { setPosting(false); }
  }

  const STORIES = posts.slice(0, 7).map(p => p.user).filter(Boolean);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <GlobalHeader notificationCount={2} />
      </SafeAreaView>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchPosts(); }} tintColor={COLORS.primary} />}
          renderItem={({ item }) => (
            <PostCard post={item} currentUserId={user?.id} onLike={handleLike} onComment={handleComment} />
          )}
          ListHeaderComponent={
            <>
              {/* Social header row */}
              <View style={styles.socialHeader}>
                <Text style={styles.socialTitle}>Social</Text>
                <TouchableOpacity testID="social-create-btn" onPress={() => setShowCreate(true)}>
                  <LinearGradient colors={GRADIENTS.primary} style={styles.createBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Ionicons name="add" size={18} color="#fff" />
                    <Text style={styles.createBtnText}>Poster</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

              {/* Stories row */}
              <View style={styles.storiesRow}>
                <Text style={styles.storiesLabel}>EN LIGNE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: SPACING.screenEdge }}>
                  {STORIES.map((u, i) => u && (
                    <View key={i} style={styles.storyItem}>
                      <LinearGradient colors={GRADIENTS.primary} style={styles.storyRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                        <Image source={{ uri: u.avatar_url }} style={styles.storyAvatar} />
                      </LinearGradient>
                      <Text style={styles.storyName} numberOfLines={1}>{u.username.slice(0, 9)}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.divider} />
            </>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity testID="social-fab-btn" onPress={() => setShowCreate(true)} style={styles.fab}>
        <LinearGradient colors={GRADIENTS.primary} style={styles.fabGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Ionicons name="create-outline" size={24} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

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
                  multiline autoFocus
                />
              </View>
              <TouchableOpacity testID="social-post-submit" onPress={handlePost} disabled={posting || !newContent.trim()} activeOpacity={0.85}>
                <LinearGradient colors={!newContent.trim() ? ['#333','#222'] : GRADIENTS.primary} style={styles.postSubmitBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
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
  socialHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 14 },
  socialTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  createBtn: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  createBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  storiesRow: { paddingBottom: 14 },
  storiesLabel: { fontSize: 10, fontWeight: '800', color: COLORS.textTertiary, letterSpacing: 2, paddingHorizontal: SPACING.screenEdge, marginBottom: 12 },
  storyItem: { alignItems: 'center', gap: 6 },
  storyRing: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  storyAvatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: COLORS.background },
  storyName: { color: COLORS.textSecondary, fontSize: 10, maxWidth: 52, textAlign: 'center' },
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginHorizontal: SPACING.screenEdge },
  postCard: { backgroundColor: COLORS.surface, marginHorizontal: SPACING.screenEdge, marginTop: 14, borderRadius: RADIUS.lg, padding: 14, borderWidth: 1, borderColor: COLORS.borderLight },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: COLORS.border },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  postUsername: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  roleBadge: { borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 2 },
  roleBadgeText: { fontSize: 10, fontWeight: '600' },
  postTime: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postContent: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 22, marginBottom: 10 },
  filmRef: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 10, gap: 10, marginBottom: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  filmRefImage: { width: 42, height: 58, borderRadius: 6 },
  filmRefTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  filmRefGenre: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postActions: { flexDirection: 'row', gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { color: COLORS.textSecondary, fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 90, borderRadius: 28 },
  fabGrad: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
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
