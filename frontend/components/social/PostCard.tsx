import React, { memo, useCallback, useRef, useMemo, useContext } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { C, TONES, EDGE } from './SocialTokens';
import type { Post } from './SocialTypes';
import { InteractionCtx } from './InteractionContext';

const StarRow = memo(({ rating, size = 11 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 1.5 }}>
    {[1,2,3,4,5].map(i => (
      <Ionicons
        key={i}
        name={rating >= i ? 'star' : rating >= i - 0.5 ? 'star-half' : 'star-outline'}
        size={size} color={C.gold}
      />
    ))}
  </View>
));

const PostCard = memo(function PostCard({ post, userId }: { post: Post; userId: string }) {
  const router = useRouter();
  const { liked, saved, toggleLike, toggleSave, sharePost } = useContext(InteractionCtx);

  const isLiked  = !!liked[post.id];
  const isSaved  = !!saved[post.id];
  const likeScale = useRef(new Animated.Value(1)).current;
  const saveScale = useRef(new Animated.Value(1)).current;

  const bounce = useCallback((anim: Animated.Value) => {
    Animated.sequence([
      Animated.spring(anim, { toValue: 1.42, useNativeDriver: true, tension: 300, friction: 7 }),
      Animated.spring(anim, { toValue: 1,    useNativeDriver: true, tension: 200, friction: 8 }),
    ]).start();
  }, []);

  const onLike = useCallback(() => {
    bounce(likeScale);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleLike(post.id, userId);
  }, [post.id, userId, toggleLike, likeScale, bounce]);

  const onSave = useCallback(() => {
    bounce(saveScale);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleSave(post.id);
  }, [post.id, toggleSave, saveScale, bounce]);

  const toneInfo = useMemo(() => TONES.find(t => t.key === post.tone) ?? TONES[0], [post.tone]);
  const imgSrc   = useMemo(() =>
    post.image_url ? { uri: post.image_url } : { uri: `https://picsum.photos/seed/${post.id}/800/450` },
  [post.image_url, post.id]);
  const metaStr  = [post.work_director, post.work_year].filter(Boolean).join(' · ');

  return (
    <View style={s.card}>
      {/* ── Hero image ── */}
      <TouchableOpacity activeOpacity={0.92} onPress={() => router.push(`/film/${post.id}`)}>
        <Image source={imgSrc} style={s.img} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.92)']} style={s.imgGrad} />

        {/* Tone badge */}
        <View style={[s.toneBadge, { borderColor: `${toneInfo.color}30` }]}>
          <Ionicons name={toneInfo.icon as any} size={10} color={toneInfo.color} />
          <Text style={[s.toneTxt, { color: toneInfo.color }]}>{toneInfo.label}</Text>
        </View>

        {/* Film info overlay */}
        <View style={s.filmOverlay}>
          <Text style={s.filmTitle} numberOfLines={1}>{post.work_title || 'Œuvre inconnue'}</Text>
          {metaStr.length > 0 && <Text style={s.filmMeta}>{metaStr}</Text>}
          <StarRow rating={post.rating} />
        </View>
      </TouchableOpacity>

      {/* ── Body ── */}
      <View style={s.body}>
        {/* Author row */}
        <View style={s.authorRow}>
          <Image source={{ uri: post.avatar }} style={s.avi} />
          <View style={{ flex: 1 }}>
            <Text style={s.authorName}>{post.userName}</Text>
            <Text style={s.authorTime}>{post.timeAgo}</Text>
          </View>
          {post.work_genre.length > 0 && (
            <View style={s.genrePill}><Text style={s.genrePillTxt}>{post.work_genre}</Text></View>
          )}
        </View>

        {/* Content */}
        <Text style={s.content} numberOfLines={4}>{post.content}</Text>

        {/* Tags */}
        {post.tags.length > 0 && (
          <View style={s.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <Text key={tag} style={s.tag}>#{tag}</Text>
            ))}
          </View>
        )}

        <View style={s.divider} />

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity style={s.action} onPress={onLike} activeOpacity={0.78}>
            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={18} color={isLiked ? C.red : C.textSec} />
            </Animated.View>
            <Text style={[s.actionTxt, isLiked && { color: C.red }]}>{post.likes + (isLiked ? 1 : 0)}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.action} onPress={() => router.push(`/film/${post.id}`)} activeOpacity={0.78}>
            <Ionicons name="chatbubble-outline" size={17} color={C.textSec} />
          </TouchableOpacity>

          <TouchableOpacity style={s.action} onPress={() => sharePost(post.id, post.work_title, userId)} activeOpacity={0.78}>
            <Ionicons name="share-outline" size={18} color={C.textSec} />
            <Text style={s.actionTxt}>{post.shares}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity style={s.action} onPress={onSave} activeOpacity={0.78}>
            <Animated.View style={{ transform: [{ scale: saveScale }] }}>
              <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={18} color={isSaved ? C.gold : C.textSec} />
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity style={s.arrowBtn} onPress={() => router.push(`/film/${post.id}`)}>
            <Ionicons name="arrow-forward" size={14} color={C.textSec} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default PostCard;

const s = StyleSheet.create({
  card:        { marginHorizontal: EDGE, marginBottom: 20, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.surf },
  img:         { width: '100%', height: 205 },
  imgGrad:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '62%' },
  toneBadge:   { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(2,8,16,0.72)', borderWidth: 1 },
  toneTxt:     { fontSize: 10, fontWeight: '700' },
  filmOverlay: { position: 'absolute', bottom: 12, left: 14, right: 14 },
  filmTitle:   { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: -0.3, marginBottom: 2 },
  filmMeta:    { color: 'rgba(255,255,255,0.42)', fontSize: 11, marginBottom: 6 },
  body:        { padding: 14 },
  authorRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avi:         { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.border },
  authorName:  { color: C.text, fontSize: 13, fontWeight: '700' },
  authorTime:  { color: C.textSec, fontSize: 10, marginTop: 1 },
  genrePill:   { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, backgroundColor: C.navyLight, borderWidth: 1, borderColor: C.borderBlue },
  genrePillTxt:{ color: C.textSec, fontSize: 10, fontWeight: '700' },
  content:     { color: C.textSec, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  tagRow:      { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  tag:         { color: C.gold, fontSize: 11, fontWeight: '600' },
  divider:     { height: 1, backgroundColor: C.border, marginBottom: 12 },
  actions:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 14 },
  actionTxt:   { color: C.textSec, fontSize: 12, fontWeight: '600' },
  arrowBtn:    { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.navyLight },
});