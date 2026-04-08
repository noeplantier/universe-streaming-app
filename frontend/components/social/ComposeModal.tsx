import React, {
    memo, useState, useCallback, useRef, useEffect,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, TouchableOpacity, TextInput,
    Modal, KeyboardAvoidingView, Platform, ScrollView, Animated,
  } from 'react-native';
  import { BlurView }      from 'expo-blur';
  import { LinearGradient } from 'expo-linear-gradient';
  import { Ionicons }      from '@expo/vector-icons';
  import { SafeAreaView }  from 'react-native-safe-area-context';
  import * as Haptics      from 'expo-haptics';
  
  import { useSocial }         from './SocialContext';
  import { G, ME, ROLES }      from './types';
  import type { PostData }     from './types';
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  const MAX_CHARS = 500;
  
  // Mini-liste de films à tagger (dans un vrai projet → API TMDB)
  const FILM_SUGGESTIONS: NonNullable<PostData['film']>[] = [
    { title: 'Petite Maman',    poster: 'https://picsum.photos/seed/pm/200/300',  year: '2021', filmId: 'petite-maman' },
    { title: 'Parasite',        poster: 'https://picsum.photos/seed/para/200/300',year: '2019', filmId: 'parasite' },
    { title: 'Spencer',         poster: 'https://picsum.photos/seed/spnc/200/300',year: '2021', filmId: 'spencer' },
    { title: 'Tár',             poster: 'https://picsum.photos/seed/tar1/200/300',year: '2022', filmId: 'tar' },
    { title: 'Drive My Car',    poster: 'https://picsum.photos/seed/dmc/200/300', year: '2021', filmId: 'drive-my-car' },
    { title: 'The Power of the Dog', poster: 'https://picsum.photos/seed/pow/200/300', year: '2021', filmId: 'the-power-of-the-dog' },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  
  interface Props {
    visible: boolean;
    onClose: () => void;
  }
  
  const ComposeModal = memo(function ComposeModal({ visible, onClose }: Props) {
    const { addPost }   = useSocial();
    const [text, setText] = useState('');
    const [selectedFilm, setSelectedFilm] = useState<PostData['film'] | null>(null);
    const [showFilmPicker, setShowFilmPicker] = useState(false);
    const [publishing, setPublishing] = useState(false);
  
    const slideAnim = useRef(new Animated.Value(0)).current;
  
    useEffect(() => {
      if (visible) {
        Animated.spring(slideAnim, {
          toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6,
        }).start();
      } else {
        slideAnim.setValue(0);
        setText('');
        setSelectedFilm(null);
        setShowFilmPicker(false);
      }
    }, [visible, slideAnim]);
  
    const handlePublish = useCallback(async () => {
      if (text.trim().length === 0 || publishing) return;
      setPublishing(true);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await new Promise(r => setTimeout(r, 400));
      addPost(text.trim(), selectedFilm ?? undefined);
      setPublishing(false);
      onClose();
    }, [text, publishing, addPost, selectedFilm, onClose]);
  
    const canPublish = text.trim().length > 0 && text.length <= MAX_CHARS;
    const charsLeft  = MAX_CHARS - text.length;
    const myRole     = ROLES[ME.role];
  
    const slideY = slideAnim.interpolate({
      inputRange: [0, 1], outputRange: [80, 0],
    });
    const opacity = slideAnim;
  
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}
        statusBarTranslucent
      >
        <View style={s.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={s.kv}
          >
            <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1 }}>
              <Animated.View style={[s.sheet, { opacity, transform: [{ translateY: slideY }] }]}>
  
                {/* ── Barre top ── */}
                <View style={s.topBar}>
                  <TouchableOpacity onPress={onClose} style={s.cancelBtn} activeOpacity={0.7}>
                    <Text style={s.cancelTxt}>Annuler</Text>
                  </TouchableOpacity>
                  <Text style={s.sheetTitle}>Nouvelle publication</Text>
                  <TouchableOpacity
                    onPress={handlePublish}
                    disabled={!canPublish || publishing}
                    style={[s.publishBtn, canPublish && s.publishBtnActive]}
                    activeOpacity={0.85}
                  >
                    {publishing ? (
                      <Ionicons name="hourglass" size={14} color="#000" />
                    ) : (
                      <Text style={[s.publishTxt, canPublish && s.publishTxtActive]}>
                        Publier
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
  
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
  
                  {/* ── Avatar + Role ── */}
                  <View style={s.authorRow}>
                    <Image source={{ uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTJAonSMhABsc42klQbsziDZ0ga-xmluRvfLQ&s' }} style={s.avi} />
                    <View>
                      <View style={s.nameRow}>
                        <Text style={s.name}>{ME.name}</Text>
                        {myRole.label !== '' && (
                          <View style={[s.badge, { backgroundColor: myRole.bg }]}>
                            <Text style={[s.badgeTxt, { color: myRole.color }]}>{myRole.label}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.handle}>@{ME.handle}</Text>
                    </View>
                  </View>
  
                  {/* ── TextInput ── */}
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder="Partagez votre analyse, votre critique…"
                    placeholderTextColor="rgba(237,232,255,0.28)"
                    style={s.input}
                    multiline
                    autoFocus={visible}
                    maxLength={MAX_CHARS + 10}
                  />
  
                  {/* ── Film tagué ── */}
                  {selectedFilm ? (
                    <View style={s.filmTagged}>
                      <Image source={{ uri: selectedFilm.poster }} style={s.filmThumb} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.filmTagTitle}>{selectedFilm.title}</Text>
                        <Text style={s.filmTagYear}>{selectedFilm.year}</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSelectedFilm(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                      </TouchableOpacity>
                    </View>
                  ) : null}
  
                  {/* ── Film picker ── */}
                  {showFilmPicker && (
                    <View style={s.filmPicker}>
                      <Text style={s.pickerTitle}>Taguer un film</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filmScroll}>
                        {FILM_SUGGESTIONS.map(f => (
                          <TouchableOpacity
                            key={f.filmId}
                            onPress={() => { setSelectedFilm(f); setShowFilmPicker(false); }}
                            style={s.filmOption}
                            activeOpacity={0.85}
                          >
                            <Image source={{ uri: f.poster }} style={s.filmOptionImg} />
                            <Text style={s.filmOptionTitle} numberOfLines={2}>{f.title}</Text>
                            <Text style={s.filmOptionYear}>{f.year}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </ScrollView>
  
                {/* ── Barre d'actions bas ── */}
                <View style={s.bottomBar}>
                  <View style={s.tools}>
                    <TouchableOpacity
                      style={[s.toolBtn, showFilmPicker && s.toolBtnActive]}
                      onPress={() => setShowFilmPicker(v => !v)}
                    >
                      <Ionicons name="film-outline" size={20} color={showFilmPicker ? G.primary : 'rgba(237,232,255,0.45)'} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.toolBtn}>
                      <Ionicons name="image-outline" size={20} color="rgba(237,232,255,0.45)" />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.toolBtn}>
                      <Ionicons name="star-outline" size={20} color="rgba(237,232,255,0.45)" />
                    </TouchableOpacity>
                  </View>
  
                  {/* Compteur de caractères */}
                  <Text style={[s.counter, charsLeft < 50 && s.counterWarn, charsLeft < 0 && s.counterError]}>
                    {charsLeft}
                  </Text>
                </View>
  
              </Animated.View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  });
  
  export default ComposeModal;
  
  const s = StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
    kv:       { flex: 1 },
    sheet:    { flex: 1, backgroundColor: '#0B0020', margin: 12, borderRadius: 26, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(192,96,255,0.2)' },
  
    topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
    cancelBtn:    { paddingHorizontal: 4 },
    cancelTxt:    { color: 'rgba(237,232,255,0.55)', fontSize: 15, fontWeight: '600' },
    sheetTitle:   { color: G.sW, fontSize: 16, fontWeight: '800' },
    publishBtn:   { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.1)' },
    publishBtnActive: { backgroundColor: G.primary },
    publishTxt:   { fontSize: 14, fontWeight: '700', color: 'rgba(237,232,255,0.35)' },
    publishTxtActive: { color: '#000' },
  
    authorRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, alignItems: 'center' },
    avi:       { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    nameRow:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name:      { color: G.sW, fontWeight: '700', fontSize: 14 },
    handle:    { color: 'rgba(237,232,255,0.4)', fontSize: 12, marginTop: 2 },
    badge:     { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
    badgeTxt:  { fontSize: 9, fontWeight: '800' },
  
    input: { color: 'rgba(237,232,255,0.9)', fontSize: 16, lineHeight: 24, paddingHorizontal: 20, paddingVertical: 12, minHeight: 120 },
  
    filmTagged:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, padding: 12, backgroundColor: G.glass, borderRadius: 14, borderWidth: 1, borderColor: G.glassBorder, marginBottom: 8 },
    filmThumb:     { width: 44, height: 64, borderRadius: 8, resizeMode: 'cover' },
    filmTagTitle:  { color: G.sW, fontWeight: '700', fontSize: 13 },
    filmTagYear:   { color: 'rgba(237,232,255,0.4)', fontSize: 11, marginTop: 2 },
  
    filmPicker:   { marginHorizontal: 16, marginTop: 8 },
    pickerTitle:  { color: 'rgba(237,232,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
    filmScroll:   { gap: 10 },
    filmOption:   { width: 90, alignItems: 'center', gap: 4 },
    filmOptionImg:{ width: 72, height: 108, borderRadius: 10, resizeMode: 'cover', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    filmOptionTitle:{ color: G.sW, fontSize: 10, fontWeight: '600', textAlign: 'center' },
    filmOptionYear: { color: 'rgba(237,232,255,0.4)', fontSize: 9, textAlign: 'center' },
  
    bottomBar:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    tools:      { flexDirection: 'row', gap: 4 },
    toolBtn:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    toolBtnActive: { backgroundColor: G.primaryDim },
    counter:    { color: 'rgba(237,232,255,0.3)', fontSize: 13, fontWeight: '600' },
    counterWarn:{ color: G.gold },
    counterError:{ color: G.red },
  });