/**
 * Card.tsx — v2.0
 *
 * Changements :
 *   • FavCard   : le grand numéro de rang n'est plus affiché à l'intérieur de la carte.
 *                 La gestion du rang est entièrement confiée au composant RankedItem
 *                 du parent (profile.tsx). Le ring coloré ≤ 3 est conservé.
 *   • SeenCard  : onPress obligatoire → navigation vers /film/:id
 *   • ReelCard  : compatible avec données Supabase (posterUrl OU image)
 *   • Tous les composants sont memo + displayName.
 */

import React, { memo, useEffect, useRef } from 'react';
import {
  Animated, Easing, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';

import {
  G, CARD_W, CARD_H, CARD_RADIUS,
} from './theme';
import { ImageWithFallback } from './ImageWithFallback';
import type { FilmItem, ReviewItem, ReelItem } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ StarRating
// ─────────────────────────────────────────────────────────────────────────────
export const StarRating = memo(({ rating, size = 9 }: { rating: number; size?: number }) => (
  <View style={{ flexDirection: 'row', gap: 1.5 }}>
    {[1, 2, 3, 4, 5].map(s => (
      <Ionicons key={s} name={s <= rating ? 'star' : 'star-outline'} size={size} color={G.gold} />
    ))}
  </View>
));
StarRating.displayName = 'StarRating';

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 Shared shell styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  card: {
    width: CARD_W, height: CARD_H, borderRadius: CARD_RADIUS,
    overflow: 'hidden', backgroundColor: G.surface,
  },
  innerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CARD_RADIUS, borderWidth: 0.6,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  overlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 8, paddingTop: 32, paddingBottom: 8, gap: 3,
  },
  title: {
    color: G.text, fontSize: 10, fontWeight: '800', lineHeight: 13,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  meta:    { color: G.textTer, fontSize: 8, fontStyle: 'italic' },
  pill:    { position: 'absolute', top: 7, right: 7, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2.5, backgroundColor: 'rgba(0,0,0,0.70)' },
  pillTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 7, fontWeight: '700', letterSpacing: 0.2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🏆 FavCard
//
//   CHANGEMENT v2 : le grand numéro de rang a été supprimé de l'intérieur
//   de la carte. Le rang est maintenant affiché par le RankedItem parent.
//   Le ring coloré (or / argent / bronze) est conservé.
// ─────────────────────────────────────────────────────────────────────────────
export interface FavCardProps { film: FilmItem; rank: number; onPress: () => void; }

export const FavCard = memo(({ film, rank, onPress }: FavCardProps) => {
  // Pulse douce sur #1
  const pulseScl = useRef(new Animated.Value(1)).current;
  const glowOp   = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    if (rank !== 1) return;
    Animated.loop(Animated.sequence([
      Animated.timing(pulseScl, { toValue: 1.014, duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulseScl, { toValue: 1,     duration: 2400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 1,    duration: 2400, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.35, duration: 2400, useNativeDriver: true }),
    ])).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <Animated.View style={[s.card, rank === 1 && { transform: [{ scale: pulseScl }] }]}>
        <ImageWithFallback uri={film.posterUrl} style={StyleSheet.absoluteFillObject} />

        {/* Genre pill */}
        <View style={s.pill}>
          <Text style={s.pillTxt} numberOfLines={1}>{film.genre}</Text>
        </View>

        {/* Rings de rang — uniquement cosmétiques, plus de chiffre intégré */}
        {rank === 1 && (
          <Animated.View style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: CARD_RADIUS, borderWidth: 1.5, borderColor: G.gold, opacity: glowOp },
          ]} />
        )}
        {rank === 2 && (
          <View style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: 'rgba(232,232,240,0.45)' },
          ]} />
        )}
        {rank === 3 && (
          <View style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: 'rgba(255,159,10,0.45)' },
          ]} />
        )}

        {/* Info en bas */}
        <LinearGradient
          colors={['transparent', 'rgba(13,13,18,0.5)', 'rgba(13,13,18,0.96)']}
          style={s.overlay}
        >
          <StarRating rating={film.rating} size={9} />
          <Text style={s.title} numberOfLines={2}>{film.title}</Text>
          {film.director && (
            <Text style={s.meta} numberOfLines={1}>
              {film.director}{film.year ? ` · ${film.year}` : ''}
            </Text>
          )}
        </LinearGradient>

        <View style={s.innerBorder} pointerEvents="none" />
      </Animated.View>
    </TouchableOpacity>
  );
});
FavCard.displayName = 'FavCard';

// ─────────────────────────────────────────────────────────────────────────────
// ✍️ CritiqueCard
// ─────────────────────────────────────────────────────────────────────────────
export interface CritiqueCardProps { review: ReviewItem; onPress: () => void; }

export const CritiqueCard = memo(({ review, onPress }: CritiqueCardProps) => {
  const film = review.film;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <View style={s.card}>
        {film && <ImageWithFallback uri={film.posterUrl} style={StyleSheet.absoluteFillObject} />}
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(120,55,0,0.16)' }]} />

        {/* Badge critique */}
        <BlurView intensity={22} tint="dark" style={cc.badge}>
          <Ionicons name="pencil" size={8} color={G.gold} />
          <Text style={cc.badgeTxt}>Critique</Text>
        </BlurView>

        {/* Likes */}
        <BlurView intensity={22} tint="dark" style={cc.likes}>
          <Ionicons name="heart" size={8} color={G.danger} />
          <Text style={cc.likesTxt}>
            {review.likes >= 1000 ? `${(review.likes / 1000).toFixed(1)}k` : review.likes}
          </Text>
        </BlurView>

        <LinearGradient
          colors={['transparent', 'rgba(13,13,18,0.45)', 'rgba(13,13,18,0.98)']}
          style={s.overlay}
        >
          <StarRating rating={review.rating} size={9} />
          <Text style={s.title} numberOfLines={1}>{film?.title ?? '—'}</Text>
          <Text style={cc.snippet} numberOfLines={3}>{review.content}</Text>
          <Text style={s.meta}>
            {new Date(review.date).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
          </Text>
        </LinearGradient>

        <View style={s.innerBorder} pointerEvents="none" />
      </View>
    </TouchableOpacity>
  );
});
CritiqueCard.displayName = 'CritiqueCard';

const cc = StyleSheet.create({
  badge:    { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3.5, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,214,10,0.28)' },
  badgeTxt: { color: G.gold, fontSize: 7.5, fontWeight: '800', letterSpacing: 0.3 },
  likes:    { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3.5, overflow: 'hidden' },
  likesTxt: { color: 'rgba(255,255,255,0.72)', fontSize: 7.5, fontWeight: '700' },
  snippet:  { color: 'rgba(255,255,255,0.50)', fontSize: 8, lineHeight: 11, fontStyle: 'italic' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 👁️ SeenCard — cliquable, navigue vers /film/:id
// ─────────────────────────────────────────────────────────────────────────────
export interface SeenCardProps { film: FilmItem; onPress: () => void; }

export const SeenCard = memo(({ film, onPress }: SeenCardProps) => {
  const isSerie    = film.type === 'série' || film.type === 'Mini-série';
  const scoreColor = film.rating >= 5 ? G.success : film.rating >= 4 ? G.cyan : G.textTer;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
      <View style={s.card}>
        <ImageWithFallback uri={film.posterUrl} style={StyleSheet.absoluteFillObject} />

        {/* Type badge */}
        <View style={[sc.typeBadge, { backgroundColor: isSerie ? `${G.cyan}CC` : `${G.success}BB` }]}>
          <Ionicons name={isSerie ? 'tv' : 'film'} size={7} color="#fff" />
          <Text style={sc.typeTxt}>{isSerie ? 'Série' : 'Film'}</Text>
        </View>

        {/* Épisodes (séries uniquement) */}
        {isSerie && film.episodes != null && (
          <View style={sc.epBadge}>
            <Text style={sc.epTxt}>{film.episodes} ep.</Text>
          </View>
        )}

        <LinearGradient
          colors={['transparent', 'rgba(13,13,18,0.45)', 'rgba(13,13,18,0.98)']}
          style={s.overlay}
        >
          <View style={[sc.scorePill, { borderColor: `${scoreColor}44`, backgroundColor: `${scoreColor}16` }]}>
            <Ionicons name="star" size={8} color={scoreColor} />
            <Text style={[sc.scoreVal, { color: scoreColor }]}>{film.rating > 0 ? `${film.rating}.0` : '—'}</Text>
            <Text style={[sc.statusTxt, { color: scoreColor }]}>{film.status ?? 'Vu'}</Text>
          </View>
          <Text style={s.title} numberOfLines={2}>{film.title}</Text>
          <Text style={s.meta}>{film.genre}</Text>
        </LinearGradient>

        <View style={s.innerBorder} pointerEvents="none" />
      </View>
    </TouchableOpacity>
  );
});
SeenCard.displayName = 'SeenCard';

const sc = StyleSheet.create({
  typeBadge: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2.5 },
  typeTxt:   { color: '#fff', fontSize: 7, fontWeight: '800', letterSpacing: 0.2 },
  epBadge:   { position: 'absolute', top: 7, right: 7, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2.5 },
  epTxt:     { color: G.textTer, fontSize: 7, fontWeight: '700' },
  scorePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 0.5, alignSelf: 'flex-start' },
  scoreVal:  { fontSize: 9, fontWeight: '900' },
  statusTxt: { fontSize: 7.5, fontWeight: '600' },
});

// ─────────────────────────────────────────────────────────────────────────────
// 🎞️ ReelCard — créations (courts/moyens/mini-séries)
// ─────────────────────────────────────────────────────────────────────────────
export interface ReelCardProps { reel: ReelItem; onPress: () => void; }

export const ReelCard = memo(({ reel, onPress }: ReelCardProps) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.88}>
    <View style={s.card}>
      <ImageWithFallback uri={reel.posterUrl} style={StyleSheet.absoluteFillObject} />
      <LinearGradient
        colors={['rgba(13,13,18,0.08)', 'rgba(13,13,18,0.88)']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Play */}
      <View style={rc.playBtn}>
        <Ionicons name="play" size={16} color="#fff" />
      </View>

      {/* Badge festival / catégorie */}
      <BlurView intensity={22} tint="dark" style={rc.festivalBadge}>
        <Text style={rc.festivalTxt}>{reel.festival}</Text>
      </BlurView>

      <LinearGradient
        colors={['transparent', 'rgba(13,13,18,0.96)']}
        style={s.overlay}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!!reel.duration && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="time-outline" size={8} color={G.textTer} />
              <Text style={s.meta}>{reel.duration}</Text>
            </View>
          )}
          {!!reel.views && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="eye-outline" size={8} color={G.textTer} />
              <Text style={s.meta}>{reel.views}</Text>
            </View>
          )}
        </View>
        <Text style={s.title} numberOfLines={2}>{reel.title}</Text>
      </LinearGradient>

      <View style={s.innerBorder} pointerEvents="none" />
    </View>
  </TouchableOpacity>
));
ReelCard.displayName = 'ReelCard';

const rc = StyleSheet.create({
  playBtn:       { position: 'absolute', top: '50%', left: '50%', marginTop: -18, marginLeft: -18, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.58)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.50)', alignItems: 'center', justifyContent: 'center' },
  festivalBadge: { position: 'absolute', top: 7, left: 7, paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: 6, overflow: 'hidden', borderWidth: 0.5, borderColor: 'rgba(255,214,10,0.30)' },
  festivalTxt:   { color: G.gold, fontSize: 7, fontWeight: '800', letterSpacing: 0.3 },
});