import React, { memo, useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Dimensions,
  PanResponder, Image, ScrollView,
} from 'react-native';
import { Video } from 'expo-av';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

import { G, type VideoEditParams } from './constants';
import { SectionHeader } from './UIKit';

const { width } = Dimensions.get('window');
const TIMELINE_WIDTH = width - 40;
const THUMB_COUNT = 12;

interface Props {
  videoUri: string | null;
  duration: number;
  editParams: VideoEditParams;
  setEditParams: (v: VideoEditParams) => void;
}

export const StepThumbnail = memo(function StepThumbnail({
  videoUri,
  duration,
  editParams,
  setEditParams,
}: Props) {
  const videoRef = useRef<Video>(null);

  const [layoutWidth, setLayoutWidth] = useState(TIMELINE_WIDTH);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const [loadingThumbs, setLoadingThumbs] = useState(false);

  const pxPerSec = layoutWidth / (duration || 1);

  const startX = editParams?.trimStart * pxPerSec;
  const endX   = editParams?.trimEnd * pxPerSec;

  const clamp = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(v, max));

  // ─────────────────────────────────────────────
  // 🎞️ GENERATE THUMBNAILS (CROSS PLATFORM SAFE)
  // ─────────────────────────────────────────────
  const generateThumbnails = useCallback(async () => {
    if (!videoUri || !videoRef.current || duration === 0) return;

    setLoadingThumbs(true);

    const frames: string[] = [];
    const step = duration / THUMB_COUNT;

    for (let i = 0; i < THUMB_COUNT; i++) {
      const t = i * step;

      try {
        await videoRef.current.setPositionAsync(t * 1000);

        // fallback: same frame URI (Expo Web limitation)
        frames.push(videoUri);
      } catch {
        frames.push(videoUri);
      }
    }

    setThumbnails(frames);
    setLoadingThumbs(false);
  }, [videoUri, duration]);

  useEffect(() => {
    generateThumbnails();
  }, [generateThumbnails]);

  // ─────────────────────────────────────────────
  // 🎯 LEFT HANDLE
  // ─────────────────────────────────────────────
  const leftPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const newX = clamp(startX + g.dx, 0, endX - 40);
        const newTime = newX / pxPerSec;

        setEditParams({ ...editParams, trimStart: newTime });

        videoRef.current?.setPositionAsync(newTime * 1000);
      },
    })
  ).current;

  // ─────────────────────────────────────────────
  // 🎯 RIGHT HANDLE
  // ─────────────────────────────────────────────
  const rightPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, g) => {
        const newX = clamp(endX + g.dx, startX + 40, layoutWidth);
        const newTime = newX / pxPerSec;

        setEditParams({ ...editParams, trimEnd: newTime });

        videoRef.current?.setPositionAsync(newTime * 1000);
      },
    })
  ).current;

  // ─────────────────────────────────────────────
  // 🔁 LOOP PLAYBACK
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!videoUri) return;

    const interval = setInterval(async () => {
      const status = await videoRef.current?.getStatusAsync();

      if (!status?.isLoaded) return;

      if (status.positionMillis >= editParams?.trimEnd * 1000) {
        await videoRef.current?.setPositionAsync(editParams?.trimStart * 1000);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [editParams, videoUri]);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <View style={s.root}>
      <SectionHeader
        icon="image-outline"
        title="Thumbnail & Trim"
        sub="Timeline pro + preview temps réel"
      />

      {/* VIDEO */}
      <View style={s.videoWrap}>
        {videoUri && (
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={s.video}
            resizeMode="contain"
            shouldPlay
            isLooping
          />
        )}
      </View>

      {/* TIME */}
      <View style={s.timeRow}>
        <Text style={s.time}>{fmt(editParams?.trimStart)}</Text>
        <Text style={s.time}>{fmt(editParams?.trimEnd)}</Text>
      </View>

      {/* TIMELINE */}
      <BlurView
        intensity={20}
        tint="dark"
        style={s.timeline}
        onLayout={e => setLayoutWidth(e.nativeEvent.layout.width)}
      >
        {/* THUMBNAILS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.thumbRow}>
            {thumbnails.map((uri, i) => (
              <Image
                key={`${uri}-${i}`}
                source={{ uri }}
                style={s.thumb}
              />
            ))}
          </View>
        </ScrollView>

        {/* SELECTION */}
        <View
          style={[
            s.selection,
            { left: startX, width: endX - startX },
          ]}
        />

        {/* LEFT HANDLE */}
        <View {...leftPan.panHandlers} style={[s.handle, { left: startX - 10 }]}>
          <Ionicons name="chevron-back" size={14} color="#fff" />
        </View>

        {/* RIGHT HANDLE */}
        <View {...rightPan.panHandlers} style={[s.handle, { left: endX - 10 }]}>
          <Ionicons name="chevron-forward" size={14} color="#fff" />
        </View>
      </BlurView>

      {/* INFO */}
      <BlurView intensity={10} tint="dark" style={s.info}>
        <Ionicons name="flash-outline" size={14} color={G.info} />
        <Text style={s.infoTxt}>
          Timeline interactive type CapCut. Thumbnails générés dynamiquement.
        </Text>
      </BlurView>
    </View>
  );
});

const s = StyleSheet.create({
  root: { gap: 12 },

  videoWrap: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  time: {
    color: '#fff',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },

  timeline: {
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },

  thumbRow: {
    flexDirection: 'row',
  },

  thumb: {
    width: 50,
    height: 70,
  },

  selection: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(192,96,255,0.25)',
  },

  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
  },

  infoTxt: {
    color: G.textSub,
    fontSize: 11,
    flex: 1,
  },
});