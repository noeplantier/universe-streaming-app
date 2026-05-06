import React, {
    memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
    Animated, Modal, Platform, ActivityIndicator,
    FlatList, ListRenderItemInfo, ScrollView,
  } from 'react-native';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter }      from 'expo-router';
  
  import type { Work } from '@/lib/supabase';
  import { T, DIMS, resolveWorkImage } from './shared';
  import {
    PortraitCard, LandscapeCard,
    PortraitSkeleton, LandscapeSkeleton,
  } from './Cards';
  
  const { PORT_W, PORT_H, LAND_W, width: W, height: H } = { ...DIMS, width: DIMS.W, height: 0 };
  import { Dimensions } from 'react-native';
  const SH = Dimensions.get('window').height;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ROW SECTION
  // ─────────────────────────────────────────────────────────────────────────────
  interface RowSectionProps {
    title:     string;
    subtitle?: string;
    items:     Work[];
    loading:   boolean;
    variant:   'portrait' | 'landscape';
    showRank?: boolean;
    onSeeAll?: () => void;
  }
  
  export const RowSection = memo(function RowSection({
    title, subtitle, items, loading, variant, showRank = false, onSeeAll,
  }: RowSectionProps) {
    const isPort = variant === 'portrait';
    const snapW  = isPort ? PORT_W + 14 : LAND_W + 14;
  
    const renderWork = useCallback(({ item, index }: ListRenderItemInfo<Work>) =>
      isPort
        ? <PortraitCard  item={item} rank={showRank ? index + 1 : undefined} />
        : <LandscapeCard item={item} />,
    [isPort, showRank]);
  
    return (
      <View style={rs.section}>
        <View style={rs.head}>
          <View>
            <Text style={rs.title}>{title}</Text>
            {subtitle && <Text style={rs.sub}>{subtitle}</Text>}
          </View>
          {onSeeAll && (
            <TouchableOpacity onPress={onSeeAll} style={rs.seeAllBtn}>
              <Text style={rs.seeAllTxt}>Tout voir</Text>
              <Ionicons name="chevron-forward" size={14} color={T.blue} />
            </TouchableOpacity>
          )}
        </View>
  
        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={rs.pad}>
            {[0, 1, 2, 3, 4].map(i =>
              isPort ? <PortraitSkeleton key={i} /> : <LandscapeSkeleton key={i} />,
            )}
          </ScrollView>
        ) : (
          <FlatList
            horizontal
            data={items}
            keyExtractor={i => String(i.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={rs.pad}
            renderItem={renderWork}
            decelerationRate="fast"
            snapToInterval={snapW}
            snapToAlignment="start"
            removeClippedSubviews
            initialNumToRender={5}
            maxToRenderPerBatch={5}
            windowSize={5}
          />
        )}
      </View>
    );
  });
  
  const rs = StyleSheet.create({
    section:   { marginBottom: 32 },
    head:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 20, marginBottom: 14 },
    title:     { color: T.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
    sub:       { color: T.textTert, fontSize: 12, marginTop: 2 },
    seeAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    seeAllTxt: { color: T.blue, fontSize: 13, fontWeight: '600' },
    pad:       { paddingHorizontal: 20 },
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SEARCH OVERLAY
  // ─────────────────────────────────────────────────────────────────────────────
  interface SearchOverlayProps {
    visible:            boolean;
    onClose:            () => void;
    search:             string;
    setSearch:          (v: string) => void;
    works:              Work[];
    loading:            boolean;
    error:              boolean;
    onRetry:            () => void;
    activeFilterCount:  number;
    onResetFilters:     () => void;
  }
  
  export const SearchOverlay = memo(function SearchOverlay({
    visible, onClose, search, setSearch,
    works, loading, error, onRetry,
    activeFilterCount, onResetFilters,
  }: SearchOverlayProps) {
    const router   = useRouter();
    const inputRef = useRef<TextInput>(null);
    const slideY   = useRef(new Animated.Value(SH)).current;
  
    useEffect(() => {
      if (visible) {
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 10 }).start();
        const t = setTimeout(() => inputRef.current?.focus(), 350);
        return () => clearTimeout(t);
      } else {
        Animated.timing(slideY, { toValue: SH, duration: 240, useNativeDriver: true }).start();
      }
    }, [visible, slideY]);
  
    const goFilm = useCallback((id: Work['id']) => {
      onClose();
      router.push(`/film/${id}` as any);
    }, [onClose, router]);
  
    const renderItem = useCallback(({ item }: ListRenderItemInfo<Work>) => (
      <TouchableOpacity style={so.card} onPress={() => goFilm(item.id)} activeOpacity={0.85}>
        <Image source={{ uri: resolveWorkImage(item) }} style={so.cardImg} resizeMode="cover" />
        <LinearGradient colors={['transparent', 'rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject} />
        <View style={[so.cardBadge, { backgroundColor: item.is_original ? T.navyBright : T.navyMid }]}>
          <Text style={so.cardBadgeTxt}>{item.category.toUpperCase()}</Text>
        </View>
        <View style={so.cardInfo}>
          <Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="heart" size={10} color={T.gold} />
            <Text style={so.cardMeta}>{item.likes}</Text>
            {item.duration != null && <Text style={[so.cardMeta, { color: T.textTert }]}>· {item.duration}m</Text>}
          </View>
        </View>
      </TouchableOpacity>
    ), [goFilm]);
  
    if (!visible) return null;
  
    return (
      <Modal visible animationType="none" onRequestClose={onClose}>
        {/* Background handled by GalaxyBackground in parent */}
        <Animated.View style={[so.root, { transform: [{ translateY: slideY }] }]}>
          <View style={so.inner}>
  
            {/* Barre de recherche */}
            <View style={so.topBar}>
              <View style={so.inputRow}>
                <Ionicons name="search" size={16} color={T.textSec} style={{ marginRight: 8 }} />
                <TextInput
                  ref={inputRef}
                  style={so.input}
                  placeholder="Titre, genre, ambiance…"
                  placeholderTextColor={T.textTert}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
                    <Ionicons name="close-circle" size={15} color={T.textSec} />
                  </TouchableOpacity>
                )}
              </View>
              {activeFilterCount > 0 && (
                <TouchableOpacity style={so.resetBtn} onPress={onResetFilters}>
                  <Ionicons name="close" size={13} color={T.textSec} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={so.cancelBtn}>
                <Text style={so.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
            </View>
  
            {/* Résultats */}
            {loading ? (
              <View style={so.center}>
                <ActivityIndicator color={T.blue} size="large" />
              </View>
            ) : error ? (
              <View style={so.center}>
                <Ionicons name="cloud-offline-outline" size={44} color={T.textTert} />
                <Text style={so.emptyTxt}>Erreur de chargement</Text>
                <TouchableOpacity onPress={onRetry} style={so.retryBtn}>
                  <Text style={{ color: T.blue, fontWeight: '700', fontSize: 14 }}>Réessayer</Text>
                </TouchableOpacity>
              </View>
            ) : works.length === 0 ? (
              <View style={so.center}>
                <Ionicons name="film-outline" size={44} color={T.textTert} />
                <Text style={so.emptyTxt}>Aucun résultat</Text>
                <Text style={{ color: T.textTert, fontSize: 13, marginTop: 4 }}>Essayez d'autres mots-clés</Text>
              </View>
            ) : (
              <FlatList
                data={works}
                keyExtractor={i => String(i.id)}
                renderItem={renderItem}
                numColumns={2}
                columnWrapperStyle={so.colWrap}
                contentContainerStyle={so.listPad}
                ListHeaderComponent={
                  <Text style={so.count}>{works.length} œuvre{works.length > 1 ? 's' : ''}</Text>
                }
                removeClippedSubviews
                initialNumToRender={8}
                maxToRenderPerBatch={10}
                windowSize={7}
              />
            )}
          </View>
        </Animated.View>
      </Modal>
    );
  });
  
  const so = StyleSheet.create({
    root:         { flex: 1, backgroundColor: 'rgba(10,10,15,0.97)' },
    inner:        { flex: 1, paddingTop: Platform.OS === 'ios' ? 54 : 24 },
    topBar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, marginBottom: 10, gap: 8 },
    inputRow:     { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 11, height: 38, borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder },
    input:        { flex: 1, color: T.text, fontSize: 14, fontWeight: '500' },
    resetBtn:     { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: StyleSheet.hairlineWidth, borderColor: T.surfBorder, alignItems: 'center', justifyContent: 'center' },
    cancelBtn:    { paddingLeft: 4 },
    cancelTxt:    { color: T.textSec, fontSize: 14, fontWeight: '600' },
    center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
    emptyTxt:     { color: T.textSec, fontSize: 17, fontWeight: '600', marginTop: 14 },
    retryBtn:     { marginTop: 16, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: T.blue },
    count:        { color: T.textTert, fontSize: 12, marginBottom: 12, paddingHorizontal: 16, paddingTop: 4 },
    listPad:      { paddingHorizontal: 16, paddingBottom: 50 },
    colWrap:      { justifyContent: 'space-between', gap: 10 },
    card:         { width: (DIMS.W - 42) / 2, height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: T.surf },
    cardImg:      { width: '100%', height: '100%' },
    cardBadge:    { position: 'absolute', top: 8, left: 8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 },
    cardBadgeTxt: { color: T.white, fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
    cardInfo:     { position: 'absolute', bottom: 10, left: 10, right: 10, gap: 4 },
    cardTitle:    { color: T.white, fontSize: 14, fontWeight: '700' },
    cardMeta:     { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
  });