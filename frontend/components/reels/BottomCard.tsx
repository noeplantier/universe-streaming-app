/**
 * BottomCard.tsx — titre · stats · seek bar
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import type { FeedFilm } from './types';

export interface BottomCardProps {
  film:     FeedFilm;
  progress: number;    // 0–1
  duration: number;    // secondes
  isReady:  boolean;
  insetBot: number;
  onSeek:   (sec: number) => void;
}

const fmtT = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
};
const fmtN = (n: number) =>
  n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `${Math.round(n/1_000)}K` : String(n||0);

const BottomCard = memo(function BottomCard({ film, progress, duration, isReady, insetBot, onSeek }: BottomCardProps) {

  const [trackW, setTrackW] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [dragPct, setDragPct]   = useState(0);
  const wRef   = useRef(1);
  const durRef = useRef(duration);
  wRef.current   = trackW;
  durRef.current = duration;

  const thumbSc = useRef(new Animated.Value(0)).current;
  const trackH  = useRef(new Animated.Value(2.5)).current;
  const ctrlOp  = useRef(new Animated.Value(0)).current;

  const pct  = dragging ? dragPct : Math.min(Math.max(progress, 0), 0.9999);
  const curS = pct * (duration || 0);

  const spring = (v: Animated.Value, to: number) =>
    Animated.spring(v, { toValue: to, useNativeDriver: false, tension: 300, friction: 12 }).start();
  const springN = (v: Animated.Value, to: number) =>
    Animated.spring(v, { toValue: to, useNativeDriver: true,  tension: 300, friction: 12 }).start();

  const expand  = useCallback(() => { spring(trackH, 5); springN(thumbSc, 1); }, [trackH, thumbSc]);
  const collapse= useCallback(() => { spring(trackH, 2.5); springN(thumbSc, 0); }, [trackH, thumbSc]);

  const clamp = (lx: number) => Math.max(0, Math.min(1, lx / Math.max(wRef.current, 1)));

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => true,
    onPanResponderGrant: (e) => { const p=clamp(e.nativeEvent.locationX); setDragPct(p); setDragging(true); expand(); onSeek(p*durRef.current); },
    onPanResponderMove:  (e) => { const p=clamp(e.nativeEvent.locationX); setDragPct(p); onSeek(p*durRef.current); },
    onPanResponderRelease: (e) => { onSeek(clamp(e.nativeEvent.locationX)*durRef.current); setDragging(false); collapse(); },
    onPanResponderTerminate: () => { setDragging(false); collapse(); },
  })).current;

  useEffect(() => {
    Animated.timing(ctrlOp, { toValue: isReady ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [isReady, ctrlOp]);

  const meta = [film.director, film.year, film.genre].filter(Boolean).join(' · ');

  return (
    <View style={[bc.wrap, { paddingBottom: insetBot + 18 }]} pointerEvents="box-none">
      <View style={bc.inner} pointerEvents="box-none">

        {!!film.title && <Text style={bc.title} numberOfLines={2}>{film.title}</Text>}
        {!!meta       && <Text style={bc.meta}  numberOfLines={1}>{meta}</Text>}
        {!!film.synopsis && <Text style={bc.synop} numberOfLines={2}>{film.synopsis}</Text>}

        <View style={bc.stats} pointerEvents="none">
          <Text style={bc.stat}>👁 {fmtN(film.views_count)}</Text>
          <Text style={bc.dot}>·</Text>
          <Text style={bc.stat}>♥ {fmtN(film.likes_count)}</Text>
          {film.duration > 0 && <>
            <Text style={bc.dot}>·</Text>
            <Text style={bc.stat}>⏱ {fmtT(film.duration)}</Text>
          </>}
        </View>

        <Animated.View style={{ opacity: ctrlOp }} pointerEvents={isReady ? 'box-none' : 'none'}>
          <View style={bc.timeRow} pointerEvents="none">
            <Text style={bc.curr}>{fmtT(curS)}</Text>
            <Text style={bc.total}>{fmtT(duration)}</Text>
          </View>
          <View
            style={bc.hit}
            onLayout={e => { setTrackW(e.nativeEvent.layout.width); wRef.current = e.nativeEvent.layout.width; }}
            {...pan.panHandlers}
          >
            <Animated.View style={[bc.track, { height: trackH }]}>
              <View style={bc.bg} />
              <View style={[bc.fill, { width:`${pct*100}%` as any }]} />
              <Animated.View style={[bc.thumb, { left:`${pct*100}%` as any, transform:[{ scale: thumbSc }] }]} />
            </Animated.View>
          </View>
        </Animated.View>

      </View>
    </View>
  );
});

export default BottomCard;

const bc = StyleSheet.create({
  wrap:    { position:'absolute', bottom:70, left:0, right:0, background:'transparent' },
  inner:   { paddingHorizontal:20, paddingTop:36 },
  title:   { color:'rgba(255,255,255,0.96)', fontSize:17, fontWeight:'800', letterSpacing:-0.4, lineHeight:22, marginBottom:3 },
  meta:    { color:'rgba(255,255,255,0.46)', fontSize:12, fontStyle:'italic', marginBottom:3 },
  synop:   { color:'rgba(255,255,255,0.36)', fontSize:11, lineHeight:15, marginBottom:8 },
  stats:   { flexDirection:'row', alignItems:'center', gap:6, marginBottom:10 },
  stat:    { color:'rgba(255,255,255,0.44)', fontSize:11, fontWeight:'600' },
  dot:     { color:'rgba(255,255,255,0.20)', fontSize:11 },
  timeRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:3 },
  curr:    { color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:'700' },
  total:   { color:'rgba(255,255,255,0.30)', fontSize:11 },
  hit:     { height:28, justifyContent:'center' },
  track:   { width:'100%', borderRadius:3, justifyContent:'center', overflow:'visible' },
  bg:      { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(255,255,255,0.18)', borderRadius:3 },
  fill:    { height:'100%', backgroundColor:'#fff', borderRadius:3 },
  thumb:   { position:'absolute', width:14, height:14, borderRadius:7, backgroundColor:'#fff', marginLeft:-7, top:'50%', marginTop:-7, shadowColor:'#fff', shadowOffset:{width:0,height:0}, shadowOpacity:0.8, shadowRadius:5, elevation:5 },
});
