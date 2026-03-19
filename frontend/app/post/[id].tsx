import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SPACING, RADIUS, GRADIENTS } from '../constants/theme';
import { discoverAPI, commentsAPI, postsAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Post {
  id: string; user_id: string; content: string; film_id?: string;
  likes_count: number; liked_by?: string[]; comments_count: number; created_at: string;
  user?: { id: string; username: string; avatar_url: string; role: string };
  film?: { id: string; title: string; poster_url: string; genre: string };
}
interface Comment {
  id: string; post_id: string; user_id: string; content: string;
  likes_count: number; created_at: string;
  user?: { id: string; username: string; avatar_url: string };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}j`;
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    Promise.all([
      discoverAPI.getPost(id!),
      commentsAPI.getByPost(id!),
    ]).then(([postData, commentsData]) => {
      setPost(postData);
      setComments(commentsData || []);
      setLiked(postData.liked_by?.includes(user?.id) || false);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  async function handleLike() {
    if (!user) return;
    try {
      await postsAPI.like(id!);
      setLiked(prev => !prev);
      setPost(prev => prev ? { ...prev, likes_count: liked ? prev.likes_count - 1 : prev.likes_count + 1 } : prev);
    } catch {}
  }

  async function handleComment() {
    if (!commentText.trim() || !user) return;
    setPosting(true);
    try {
      const comment = await commentsAPI.create({ post_id: id!, content: commentText.trim() });
      setComments(prev => [...prev, comment]);
      setPost(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : prev);
      setCommentText('');
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setPosting(false);
    }
  }

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color={COLORS.primary} />
    </View>
  );

  if (!post) return null;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="post-back-btn" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discussion</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <FlatList
          data={comments}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListHeaderComponent={
            <View>
              {/* Post card */}
              <View style={styles.postCard}>
                <View style={styles.postHeader}>
                  <Image source={{ uri: post.user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60' }} style={styles.postAvatar} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postUsername}>{post.user?.username}</Text>
                    <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
                  </View>
                </View>
                <Text style={styles.postContent}>{post.content}</Text>

                {post.film && (
                  <TouchableOpacity onPress={() => router.push(`/film/${post.film!.id}`)} style={styles.filmRef}>
                    <Image source={{ uri: post.film.poster_url }} style={styles.filmRefImage} />
                    <View>
                      <Text style={styles.filmRefTitle}>{post.film.title}</Text>
                      <Text style={styles.filmRefGenre}>{post.film.genre}</Text>
                    </View>
                    <Ionicons name="play-circle" size={24} color={COLORS.primary} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                )}

                <View style={styles.postActions}>
                  <TouchableOpacity testID="post-detail-like-btn" onPress={handleLike} style={styles.actionBtn}>
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#FF3B30' : COLORS.textSecondary} />
                    <Text style={[styles.actionText, liked && { color: '#FF3B30' }]}>{post.likes_count}</Text>
                  </TouchableOpacity>
                  <View style={styles.actionBtn}>
                    <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>{post.comments_count}</Text>
                  </View>
                  <TouchableOpacity style={styles.actionBtn}>
                    <Ionicons name="share-social-outline" size={20} color={COLORS.textSecondary} />
                    <Text style={styles.actionText}>Partager</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Comments header */}
              <View style={styles.commentsHeader}>
                <Text style={styles.commentsTitle}>Commentaires ({comments.length})</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <View testID={`comment-${item.id}`} style={styles.commentCard}>
              <Image source={{ uri: item.user?.avatar_url || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60' }} style={styles.commentAvatar} />
              <View style={styles.commentBody}>
                <View style={styles.commentBubble}>
                  <Text style={styles.commentUsername}>{item.user?.username || 'Anonyme'}</Text>
                  <Text style={styles.commentText}>{item.content}</Text>
                </View>
                <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.noComments}>
              <Ionicons name="chatbubble-outline" size={36} color={COLORS.textTertiary} />
              <Text style={styles.noCommentsText}>Soyez le premier à commenter</Text>
            </View>
          }
        />

        {/* Comment Input */}
        <View style={styles.commentInputRow}>
          {user && <Image source={{ uri: user.avatar_url }} style={styles.inputAvatar} />}
          <View style={styles.inputWrapper}>
            <TextInput
              testID="comment-input"
              style={styles.commentInput}
              placeholder="Écrire un commentaire..."
              placeholderTextColor={COLORS.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
          </View>
          <TouchableOpacity
            testID="comment-submit-btn"
            onPress={handleComment}
            disabled={!commentText.trim() || posting}
            style={[styles.sendBtn, commentText.trim() && styles.sendBtnActive]}
          >
            {posting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Ionicons name="send" size={18} color={commentText.trim() ? '#fff' : COLORS.textTertiary} />
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.screenEdge, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  postCard: { backgroundColor: COLORS.surface, margin: SPACING.screenEdge, borderRadius: RADIUS.lg, padding: 16, borderWidth: 1, borderColor: COLORS.borderLight },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  postAvatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: COLORS.border },
  postUsername: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  postTime: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postContent: { color: COLORS.textPrimary, fontSize: 15, lineHeight: 24, marginBottom: 14 },
  filmRef: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: RADIUS.md, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: COLORS.borderLight },
  filmRefImage: { width: 40, height: 56, borderRadius: 6 },
  filmRefTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '600' },
  filmRefGenre: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  postActions: { flexDirection: 'row', gap: 20, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.borderLight },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { color: COLORS.textSecondary, fontSize: 13 },
  commentsHeader: { paddingHorizontal: SPACING.screenEdge, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  commentsTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  commentCard: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.screenEdge, paddingVertical: 12, alignItems: 'flex-start' },
  commentAvatar: { width: 36, height: 36, borderRadius: 18 },
  commentBody: { flex: 1, gap: 4 },
  commentBubble: { backgroundColor: COLORS.surface, borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: COLORS.borderLight },
  commentUsername: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  commentText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  commentTime: { color: COLORS.textTertiary, fontSize: 10, marginLeft: 4 },
  noComments: { alignItems: 'center', paddingTop: 40, gap: 10 },
  noCommentsText: { color: COLORS.textSecondary, fontSize: 14 },
  commentInputRow: { flexDirection: 'row', gap: 10, paddingHorizontal: SPACING.screenEdge, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.borderLight, alignItems: 'flex-end', backgroundColor: COLORS.background },
  inputAvatar: { width: 36, height: 36, borderRadius: 18 },
  inputWrapper: { flex: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, paddingHorizontal: 14, paddingVertical: 10 },
  commentInput: { color: COLORS.textPrimary, fontSize: 14, maxHeight: 80 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(140,46,186,0.3)', alignItems: 'center', justifyContent: 'center' },
  sendBtnActive: { backgroundColor: COLORS.primary },
});
