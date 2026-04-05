import React, {
    memo, useState, useCallback, useRef,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, TouchableOpacity,
    Animated, Platform,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter }      from 'expo-router';
  import * as Haptics       from 'expo-haptics';
  
  import CommentsModal from './CommentsModal';
  import { useSocial } from './SocialContext';
  import { G, ROLES }  from './types';
  import type { PostData } from './types';
  
  const EDGE = 18;
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface Props { post: PostData }
  
  const PostCard = memo(function PostCard({ post }: Props) {
    const router = useRouter();
    const { toggleLike, toggleSave, toggleFollow } = useSocial();
  
    const [showComments, setShowComments] = useState(false);
  
    // Animations
    const heartSc = useRef(new Animated.Value(1)).current;
    const saveSc  = useRef(new Animated.Value(1)).current;
  
    const bounce = useCallback((anim: Animated.Value) => {
      Animated.sequence([
        Animated.spring(anim, { toValue: 1.32, useNativeDriver: true, speed: 50, bounciness: 14 }),
        Animated.spring(anim, { toValue: 1,    useNativeDriver: true, speed: 50 }),
      ]).start();
    }, []);
  
    const handleLike = useCallback(() => {
      bounce(heartSc);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      toggleLike(post.id);
    }, [post.id, toggleLike, heartSc, bounce]);
  
    const handleSave = useCallback(() => {
      bounce(saveSc);
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      toggleSave(post.id);
    }, [post.id, toggleSave, saveSc, bounce]);
  
    const handleFollow = useCallback(() => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toggleFollow(post.author.handle);
    }, [post.author.handle, toggleFollow]);
  
    const role = ROLES[post.author.role] ?? ROLES.viewer;
  
    return (
      <View style={s.root}>
        <CommentsModal
          visible={showComments}
          onClose={() => setShowComments(false)}
          post={post}
        />
  
        {/* ── Ligne verticale timeline ── */}
        <View style={s.timeline}>
          <TouchableOpacity onPress={() => router.push(`/user/${post.author.handle}`)}>
            <Image source={{ uri: post.author.avi }} style={s.avi} />
          </TouchableOpacity>
          <View style={s.threadLine} />
        </View>
  
        {/* ── Corps ── */}
        <View style={s.body}>
  
          {/* Header auteur */}
          <View style={s.head}>
            <View style={s.authorInfo}>
              <Text style={s.name}>{post.author.name}</Text>
              {role.label !== '' && (
                <View style={[s.badge, { backgroundColor: role.bg }]}>
                  <Text style={[s.badgeTxt, { color: role.color }]}>{role.label}</Text>
                </View>
              )}
            </View>
            <View style={s.headRight}>
              <Text style={s.handle}>@{post.author.handle} · {post.time}</Text>
            </View>
          </View>
  
          {/* Handle + Follow */}
          <View style={s.handleRow}>
            {!post.author.following && post.author.handle !== 'hugoch' && (
              <TouchableOpacity onPress={handleFollow} style={s.followBtn} activeOpacity={0.85}>
                <Ionicons name="person-add" size={10} color={G.primary} />
                <Text style={s.followTxt}>Suivre</Text>
              </TouchableOpacity>
            )}
            {post.author.following && (
              <View style={s.followingBadge}>
                <Ionicons name="checkmark" size={10} color={G.green} />
                <Text style={[s.followTxt, { color: G.green }]}>Abonné</Text>
              </View>
            )}
          </View>
  
          {/* Contenu textuel */}
          <Text style={s.content}>{post.content}</Text>
  
          {/* Film embed */}
          {post.film && (
            <TouchableOpacity
              style={s.filmEmbed}
              activeOpacity={0.88}
              onPress={() => router.push(`/film/${post.film!.filmId ?? '1'}`)}
            >
              <Image source={{ uri: post.film.poster }} style={s.filmPoster} />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.65)']}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={s.filmInfo}>
                <Text style={s.filmTitle}>{post.film.title}</Text>
                <Text style={s.filmMeta}>Film · {post.film.year}</Text>
                {post.film.rating !== undefined && (
                  <View style={s.ratingRow}>
                    <Ionicons name="star" size={10} color={G.sG} />
                    <Text style={s.ratingTxt}>{post.film.rating.toFixed(1)}</Text>
                  </View>
                )}
                <View style={s.watchBtn}>
                  <Ionicons name="play" size={10} color="#000" />
                  <Text style={s.watchTxt}>Voir</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
  
          {/* Actions */}
          <View style={s.actions}>
            {/* Like */}
            <TouchableOpacity style={s.actBtn} onPress={handleLike} activeOpacity={0.8}>
              <Animated.View style={{ transform: [{ scale: heartSc }] }}>
                <Ionicons
                  name={post.liked ? 'heart' : 'heart-outline'}
                  size={20}
                  color={post.liked ? G.red : 'rgba(237,232,255,0.45)'}
                />
              </Animated.View>
              <Text style={[s.actTxt, post.liked && { color: G.red }]}>
                {post.likes.toLocaleString('fr-FR')}
              </Text>
            </TouchableOpacity>
  
            {/* Commentaires */}
            <TouchableOpacity
              style={s.actBtn}
              onPress={() => setShowComments(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-outline" size={19} color="rgba(237,232,255,0.45)" />
              <Text style={s.actTxt}>{post.comments.length}</Text>
            </TouchableOpacity>
  
            {/* Partager */}
            <TouchableOpacity style={s.actBtn} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={19} color="rgba(237,232,255,0.45)" />
            </TouchableOpacity>
  
            {/* Save */}
            <TouchableOpacity style={[s.actBtn, { marginLeft: 'auto' }]} onPress={handleSave} activeOpacity={0.8}>
              <Animated.View style={{ transform: [{ scale: saveSc }] }}>
                <Ionicons
                  name={post.saved ? 'bookmark' : 'bookmark-outline'}
                  size={19}
                  color={post.saved ? G.sG : 'rgba(237,232,255,0.45)'}
                />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  });
  
  export default PostCard;
  
  const AVI_SZ = 42;
  
  const s = StyleSheet.create({
    root:     { flexDirection: 'row', paddingTop: 16, paddingHorizontal: EDGE, paddingBottom: 4 },
  
    // Timeline layout
    timeline: { alignItems: 'center', width: AVI_SZ, marginRight: 12 },
    avi:      { width: AVI_SZ, height: AVI_SZ, borderRadius: AVI_SZ / 2, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)' },
    threadLine:{ flex: 1, width: 1.5, backgroundColor: 'rgba(255,255,255,0.07)', marginTop: 8, marginBottom: 4, borderRadius: 1, minHeight: 20 },
  
    body:     { flex: 1, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
    head:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    authorInfo:{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, flexWrap: 'wrap' },
    name:     { color: G.sW, fontWeight: '700', fontSize: 14 },
    badge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    badgeTxt: { fontSize: 9, fontWeight: '800' },
    headRight:{ },
    handle:   { color: 'rgba(237,232,255,0.38)', fontSize: 11, marginTop: 1 },
  
    handleRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 8 },
    followBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: G.primaryDim, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(192,96,255,0.35)', alignSelf: 'flex-start' },
    followingBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(48,209,88,0.10)', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(48,209,88,0.25)', alignSelf: 'flex-start' },
    followTxt:     { fontSize: 10, fontWeight: '700', color: G.primary },
  
    content:  { color: 'rgba(237,232,255,0.88)', fontSize: 15, lineHeight: 22, marginBottom: 12 },
  
    filmEmbed:  { flexDirection: 'row', height: 90, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 12 },
    filmPoster: { width: 62, height: '100%', resizeMode: 'cover' },
    filmInfo:   { flex: 1, padding: 12, justifyContent: 'center', gap: 2 },
    filmTitle:  { color: '#fff', fontWeight: '700', fontSize: 13 },
    filmMeta:   { color: 'rgba(255,255,255,0.45)', fontSize: 11 },
    ratingRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    ratingTxt:  { color: G.sG, fontSize: 11, fontWeight: '700' },
    watchBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: G.sG, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start', gap: 3, marginTop: 4 },
    watchTxt:   { fontSize: 10, fontWeight: '700', color: '#000' },
  
    actions:  { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 4 },
    actBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actTxt:   { color: 'rgba(237,232,255,0.45)', fontSize: 13, fontWeight: '600' },
  });