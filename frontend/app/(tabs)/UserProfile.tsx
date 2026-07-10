/**
 * app/(tabs)/UserProfile.tsx — UNIVERSE · PROFIL PUBLIC
 *
 * Écran de profil public de chaque utilisateur Universe.
 * Copie exacte de l'architecture profile.tsx MAIS :
 *   ✓ Aucune donnée confidentielle (device_id interne, settings,
 *     historique privé, notifications, données de paiement)
 *   ✓ Seules les infos publiques : pseudo, avatar, bio, niveau,
 *     œuvres partagées, critiques publiques, followers/following
 *   ✓ Actions : suivre / arrêter de suivre
 *   ✓ Bouton "Envoyer un message" (deep-link notification)
 *   ✓ Design système identique (GalaxyBackground, palette, typo)
 *
 * Navigation : router.push('/(tabs)/UserProfile', { deviceId, pseudo })
 */

import React, {
    useState, useEffect, useCallback, useRef, memo,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, FlatList, ScrollView,
    TouchableOpacity, ActivityIndicator, Animated, Dimensions,
    Platform, Share,
  } from 'react-native';
  import { SafeAreaView }   from 'react-native-safe-area-context';
  import { StatusBar }      from 'expo-status-bar';
  import { Ionicons }       from '@expo/vector-icons';
  import { useRouter, useLocalSearchParams } from 'expo-router';
  import { LinearGradient } from 'expo-linear-gradient';
  import { BlurView }       from 'expo-blur';
  import * as Haptics       from 'expo-haptics';
  import { supabase }       from '@/lib/supabase';
  import { getDeviceId }    from '@/lib/deviceId';
  import GalaxyBackground   from '@/components/social/GalaxyBackground';
  
  const { width: W } = Dimensions.get('window');
  const EDGE = 16, GAP = 10, GRID = (W - EDGE * 2 - GAP) / 2;
  const HEADER_MAX = 260, HEADER_MIN = 70;
  
  // ─── PALETTE (identique profile.tsx) ─────────────────────────────────────────
  const C = {
    bg:        '#070C17',
    navy:      '#0D2040',
    navyLow:   '#0A1830',
    white:     '#FFFFFF',
    off:       'rgba(255,255,255,0.82)',
    mid:       'rgba(255,255,255,0.55)',
    muted:     'rgba(255,255,255,0.36)',
    subtle:    'rgba(255,255,255,0.14)',
    faint:     'rgba(255,255,255,0.07)',
    border:    'rgba(255,255,255,0.09)',
    borderHi:  'rgba(255,255,255,0.22)',
    violet:    '#FFFFFF',
    violetFt:  'rgba(167,139,250,0.10)',
    violetBd:  'rgba(167,139,250,0.25)',
    gold:      '#F5C842',
    goldDim:   'rgba(245,200,66,0.12)',
    green:     '#2ECC8A',
    greenFt:   'rgba(46,204,138,0.10)',
    red:       '#FF6B6B',
  } as const;
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  interface PublicUser {
    device_id:       string;
    pseudo:          string;
    avatar_url:      string | null;
    bio:             string | null;
    level:           number;
    xp:              number;
    xp_to_next:      number;
    title:           string;
    followers_count: number;
    following_count: number;
    works_count:     number;
    critiques_count: number;
    joined_at:       string;
    // badges earned (public)
    badges:          string[];
  }
  
  interface PublicWork {
    id:          number;
    title:       string;
    category:    string;
    genre:       string;
    year:        number | null;
    image:       string | null;
    likes_count: number;
    is_original: boolean;
    adjective:   string | null;
    director:    string | null;
    created_at:  string;
  }
  
  interface PublicCritique {
    id:          number;
    work_title:  string;
    work_image:  string | null;
    work_year:   number | null;
    body:        string;
    rating:      number;
    likes_count: number;
    created_at:  string;
  }
  
  type ProfileTab = 'oeuvres' | 'critiques' | 'a-propos';
  
  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  const LEVEL_NAMES: Record<number, string> = {
    1:'Météorite', 2:'Étoile Filante', 3:'Nébuleuse', 4:'Géante Rouge',
    5:'Supernova', 6:'Trou Noir', 7:'Quasar', 8:'Singularité',
  };
  
  function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }
  
  function timeAgo(iso: string): string {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'maintenant';
    if (diff < 3600)  return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return `${Math.floor(diff / 86400)} j`;
  }
  
  function Stars({ n }: { n: number }) {
    return (
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <Ionicons key={i} name={i <= n ? 'star' : 'star-outline'}
            size={10} color={i <= n ? C.gold : C.subtle}/>
        ))}
      </View>
    );
  }
  
  // ─── WORK CARD (grille 2 colonnes) ───────────────────────────────────────────
  const WorkCard = memo(({ item }: { item: PublicWork }) => (
    <View style={wc.card}>
      {item.image
        ? <Image source={{ uri: item.image }} style={wc.poster}/>
        : <View style={[wc.poster, wc.posterFb]}>
            <Ionicons name="film-outline" size={28} color={C.subtle}/>
          </View>
      }
      <LinearGradient colors={['transparent','rgba(7,12,23,0.95)']} style={wc.grad}/>
      <View style={wc.info}>
        {item.is_original && (
          <View style={wc.originalBadge}>
            <Text style={wc.originalTxt}>ORIGINAL</Text>
          </View>
        )}
        <Text style={wc.title} numberOfLines={2}>{item.title}</Text>
        <View style={wc.meta}>
          {item.year && <Text style={wc.metaTxt}>{item.year}</Text>}
          {item.genre && <Text style={wc.metaTxt}>{item.genre}</Text>}
        </View>
        <View style={wc.stats}>
          <Ionicons name="heart" size={11} color={C.red}/>
          <Text style={wc.statTxt}>{formatCount(item.likes_count)}</Text>
        </View>
      </View>
    </View>
  ));
  
  // ─── CRITIQUE ROW ─────────────────────────────────────────────────────────────
  const CritiqueRow = memo(({ item }: { item: PublicCritique }) => (
    <View style={cr.row}>
      {item.work_image
        ? <Image source={{ uri: item.work_image }} style={cr.poster}/>
        : <View style={[cr.poster, cr.posterFb]}>
            <Ionicons name="film-outline" size={14} color={C.subtle}/>
          </View>
      }
      <View style={cr.body}>
        <View style={cr.topRow}>
          <Text style={cr.title} numberOfLines={1}>{item.work_title}</Text>
          {item.work_year && <Text style={cr.year}>{item.work_year}</Text>}
        </View>
        <Stars n={item.rating}/>
        <Text style={cr.text} numberOfLines={3}>{item.body}</Text>
        <View style={cr.foot}>
          <Ionicons name="heart" size={11} color={C.red}/>
          <Text style={cr.footTxt}>{item.likes_count}</Text>
          <Text style={cr.footTxt}>·</Text>
          <Text style={cr.footTxt}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    </View>
  ));
  
  // ─── STAT BOX ─────────────────────────────────────────────────────────────────
  function StatBox({ value, label }: { value: string; label: string }) {
    return (
      <View style={pb.statBox}>
        <Text style={pb.statVal}>{value}</Text>
        <Text style={pb.statLabel}>{label}</Text>
      </View>
    );
  }
  
  // ─── BADGE PILL ───────────────────────────────────────────────────────────────
  function BadgePill({ name }: { name: string }) {
    return (
      <View style={pb.badge}>
        <Ionicons name="trophy" size={11} color={C.gold}/>
        <Text style={pb.badgeTxt}>{name}</Text>
      </View>
    );
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  //  MAIN SCREEN
  // ═══════════════════════════════════════════════════════════════════════════════
  export default function UserProfileScreen() {
    const router = useRouter();
    const { deviceId, pseudo: pseudoParam } = useLocalSearchParams<{
      deviceId: string; pseudo: string;
    }>();
  
    const [myId, setMyId]           = useState('');
    const [user, setUser]           = useState<PublicUser | null>(null);
    const [works, setWorks]         = useState<PublicWork[]>([]);
    const [critiques, setCritiques] = useState<PublicCritique[]>([]);
    const [loading, setLoading]     = useState(true);
    const [following, setFollowing] = useState(false);
    const [tab, setTab]             = useState<ProfileTab>('oeuvres');
  
    const scrollY = useRef(new Animated.Value(0)).current;
  
    // ── boot ──────────────────────────────────────────────────────────────────
    useEffect(() => { getDeviceId().then(setMyId); }, []);
  
    // ── fetch public profile ──────────────────────────────────────────────────
    useEffect(() => {
      if (!deviceId || !myId) return;
      setLoading(true);
  
      Promise.all([
    // Public profiles info — NO confidential fields
supabase
.from('profiles')
.select('id, username, display_name, avatar_url, bio, is_verified, follower_count, following_count, created_at, updated_at, location, website, equipment, contact_email, social_instagram, social_vimeo, social_youtube, social_imdb, specialties, festivals, open_to, notable_works, is_pro, is_industry_contact, films_seen_count, followers_count, role')
.eq('id', deviceId)
.maybeSingle(),
       
  
        // Public works
        supabase
          .from('works')
          .select('id, title, category, genre, year, image, likes_count, is_original, adjective, director, created_at')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(30),
  
        // Public critiques
        supabase
          .from('critiques')
          .select('id, work_title, work_image, work_year, body, rating, likes_count, created_at')
          .eq('device_id', deviceId)
          .order('created_at', { ascending: false })
          .limit(30),
  
        // Am I following?
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', myId)
          .eq('following_id', deviceId)
          .maybeSingle(),
      ]).then(([{ data: u }, { data: w }, { data: c }, { data: f }]) => {
        setUser(u as unknown as PublicUser ?? null);
        setWorks(w as PublicWork[] ?? []);
        setCritiques(c as PublicCritique[] ?? []);
        setFollowing(!!f);
        setLoading(false);
      });
    }, [deviceId, myId]);
  
    // ── follow / unfollow ─────────────────────────────────────────────────────
    const toggleFollow = useCallback(async () => {
      if (!myId || !deviceId || myId === deviceId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const next = !following;
      setFollowing(next);
      // optimistic update count
      setUser(u => u ? ({
        ...u,
        followers_count: u.followers_count + (next ? 1 : -1),
      }) : u);
      if (next) {
        await supabase.from('follows')
          .upsert({ follower_id: myId, following_id: deviceId });
      } else {
        await supabase.from('follows')
          .delete().eq('follower_id', myId).eq('following_id', deviceId);
      }
    }, [myId, deviceId, following]);
  
    // ── share profile ─────────────────────────────────────────────────────────
    const shareProfile = useCallback(async () => {
      if (!user) return;
      await Share.share({
        message: `Découvrez le profil de ${user.pseudo} sur Universe 🎬`,
      });
    }, [user]);
  
    // ── animated header ───────────────────────────────────────────────────────
    const headerHeight = scrollY.interpolate({
      inputRange: [0, HEADER_MAX - HEADER_MIN],
      outputRange: [HEADER_MAX, HEADER_MIN],
      extrapolate: 'clamp',
    });
    const avatarScale = scrollY.interpolate({
      inputRange: [0, HEADER_MAX - HEADER_MIN],
      outputRange: [1, 0.5],
      extrapolate: 'clamp',
    });
    const avatarOpacity = scrollY.interpolate({
      inputRange: [0, 80],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
    const titleOpacity = scrollY.interpolate({
      inputRange: [60, 120],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  
    // ── render ─────────────────────────────────────────────────────────────────
    if (loading) {
      return (
        <SafeAreaView style={s.root}>
          <GalaxyBackground/>
          <View style={s.center}>
            <ActivityIndicator color={C.violet} size="large"/>
          </View>
        </SafeAreaView>
      );
    }
  
    if (!user) {
      return (
        <SafeAreaView style={s.root}>
          <GalaxyBackground/>
          <View style={s.center}>
            <Ionicons name="person-outline" size={48} color={C.subtle}/>
            <Text style={s.errorTxt}>Profil introuvable</Text>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backBtnTxt}>Retour</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
  
    const isSelf = myId === deviceId;
    const xpPct  = user.xp_to_next > 0 ? (user.xp / user.xp_to_next) : 1;
  
    // ── List data by tab ──────────────────────────────────────────────────────
    const listData: any[] = tab === 'oeuvres' ? works
      : tab === 'critiques' ? critiques
      : [{ _about: true }];
  
    const numCols = tab === 'oeuvres' ? 2 : 1;
  
    return (
      <SafeAreaView edges={['top']} style={s.root}>
        <StatusBar style="light"/>
        <GalaxyBackground/>
  
        {/* ── Animated header ── */}
        <Animated.View style={[s.header, { height: headerHeight }]}>
          {/* Background blur */}
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill}/>
          <LinearGradient
            colors={['rgba(13,32,64,0.7)', 'rgba(7,12,23,0.95)']}
            style={StyleSheet.absoluteFill}
          />
  
          {/* Mini title bar (visible when scrolled) */}
          <Animated.View style={[s.miniBar, { opacity: titleOpacity }]}>
            <TouchableOpacity onPress={() => router.back()} style={s.backArrow}>
              <Ionicons name="chevron-back" size={22} color={C.white}/>
            </TouchableOpacity>
            <Text style={s.miniTitle} numberOfLines={1}>{user.pseudo}</Text>
            <TouchableOpacity onPress={shareProfile} style={s.backArrow}>
              <Ionicons name="share-outline" size={20} color={C.white}/>
            </TouchableOpacity>
          </Animated.View>
  
          {/* Full header content */}
          <Animated.View style={[s.headerBody, { opacity: avatarOpacity }]}>
            {/* top row */}
            <View style={s.headerTopRow}>
              <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
                <Ionicons name="chevron-back" size={22} color={C.white}/>
              </TouchableOpacity>
              <TouchableOpacity onPress={shareProfile} style={s.headerBtn}>
                <Ionicons name="share-outline" size={20} color={C.white}/>
              </TouchableOpacity>
            </View>
  
            {/* Avatar + identity */}
            <View style={s.identity}>
              <Animated.View style={[s.avatarWrap, { transform: [{ scale: avatarScale }] }]}>
                {user.avatar_url
                  ? <Image source={{ uri: user.avatar_url }} style={s.avatar}/>
                  : <View style={[s.avatar, s.avatarFb]}>
                      <Text style={s.avatarInit}>
                        {user.pseudo?.[0]?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                }
                {/* Level ring */}
                <View style={s.levelRing}>
                  <Text style={s.levelNum}>{user.level}</Text>
                </View>
              </Animated.View>
  
              <View style={s.identityMeta}>
                <Text style={s.pseudo}>{user.pseudo}</Text>
                <View style={s.titleRow}>
                  <View style={s.levelPill}>
                    <Ionicons name="planet" size={10} color={C.violet}/>
                    <Text style={s.levelPillTxt}>
                      {LEVEL_NAMES[user.level] ?? 'Explorateur'}
                    </Text>
                  </View>
                  {user.title && <Text style={s.userTitle}>{user.title}</Text>}
                </View>
  
                {/* XP bar */}
                <View style={s.xpRow}>
                  <Text style={s.xpTxt}>{formatCount(user.xp)} XP</Text>
                  <View style={s.xpTrack}>
                    <View style={[s.xpFill, { width: `${Math.min(xpPct * 100, 100)}%` }]}/>
                  </View>
                  <Text style={s.xpTxt}>{formatCount(user.xp_to_next)}</Text>
                </View>
              </View>
            </View>
  
            {/* Actions */}
            {!isSelf && (
              <View style={s.actions}>
                <TouchableOpacity
                  style={[s.followBtn, following && s.followBtnOn]}
                  onPress={toggleFollow}
                >
                  <Ionicons
                    name={following ? 'checkmark' : 'person-add-outline'}
                    size={14} color={following ? C.violet : C.white}
                  />
                  <Text style={[s.followBtnTxt, following && s.followBtnTxtOn]}>
                    {following ? 'Suivi' : 'Suivre'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
  
        {/* ── Scrollable content ── */}
        <Animated.FlatList
          data={listData}
          keyExtractor={(it, i) => ('id' in it ? String(it.id) : String(i))}
          numColumns={numCols}
          key={`grid-${numCols}`}
          columnWrapperStyle={numCols === 2 ? s.gridRow : undefined}
          contentContainerStyle={[s.listContent, { paddingTop: HEADER_MAX }]}
          showsVerticalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          ListHeaderComponent={
            <View>
              {/* Stats row */}
              <View style={pb.statsRow}>
                <StatBox value={formatCount(user.followers_count)} label="abonnés"/>
                <View style={pb.statDivider}/>
                <StatBox value={formatCount(user.following_count)} label="abonnements"/>
                <View style={pb.statDivider}/>
                <StatBox value={String(user.works_count)} label="œuvres"/>
                <View style={pb.statDivider}/>
                <StatBox value={String(user.critiques_count)} label="critiques"/>
              </View>
  
              {/* Bio */}
              {user.bio ? (
                <Text style={pb.bio}>{user.bio}</Text>
              ) : null}
  
              {/* Badges */}
              {user.badges?.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={pb.badgesRow}>
                  {user.badges.map(b => <BadgePill key={b} name={b}/>)}
                </ScrollView>
              )}
  
              {/* Joined */}
              <Text style={pb.joined}>
                Membre depuis {new Date(user.joined_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </Text>
  
              {/* Tabs */}
              <View style={pb.tabs}>
                {([['oeuvres','Œuvres'],['critiques','Critiques'],['a-propos','À propos']] as const)
                  .map(([id, label]) => (
                  <TouchableOpacity key={id}
                    style={[pb.tab, tab === id && pb.tabOn]}
                    onPress={() => { Haptics.selectionAsync(); setTab(id); }}>
                    <Text style={[pb.tabTxt, tab === id && pb.tabTxtOn]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            if ('_about' in item) {
              // À propos tab
              return (
                <View style={ab.container}>
                  <View style={ab.row}>
                    <Ionicons name="planet-outline" size={18} color={C.violet}/>
                    <View style={ab.rowBody}>
                      <Text style={ab.rowLabel}>Niveau</Text>
                      <Text style={ab.rowVal}>
                        {user.level} — {LEVEL_NAMES[user.level] ?? 'Explorateur'}
                      </Text>
                    </View>
                  </View>
                  <View style={ab.row}>
                    <Ionicons name="star-outline" size={18} color={C.gold}/>
                    <View style={ab.rowBody}>
                      <Text style={ab.rowLabel}>XP total</Text>
                      <Text style={ab.rowVal}>{formatCount(user.xp)} XP</Text>
                    </View>
                  </View>
                  <View style={ab.row}>
                    <Ionicons name="film-outline" size={18} color={C.mid}/>
                    <View style={ab.rowBody}>
                      <Text style={ab.rowLabel}>Œuvres partagées</Text>
                      <Text style={ab.rowVal}>{user.works_count}</Text>
                    </View>
                  </View>
                  <View style={ab.row}>
                    <Ionicons name="create-outline" size={18} color={C.mid}/>
                    <View style={ab.rowBody}>
                      <Text style={ab.rowLabel}>Critiques publiées</Text>
                      <Text style={ab.rowVal}>{user.critiques_count}</Text>
                    </View>
                  </View>
                  <View style={ab.row}>
                    <Ionicons name="people-outline" size={18} color={C.mid}/>
                    <View style={ab.rowBody}>
                      <Text style={ab.rowLabel}>Abonnés</Text>
                      <Text style={ab.rowVal}>{formatCount(user.followers_count)}</Text>
                    </View>
                  </View>
                  {user.badges?.length > 0 && (
                    <View style={ab.row}>
                      <Ionicons name="trophy-outline" size={18} color={C.gold}/>
                      <View style={ab.rowBody}>
                        <Text style={ab.rowLabel}>Badges</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                          {user.badges.map(b => <BadgePill key={b} name={b}/>)}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            }
            if (tab === 'oeuvres') return <WorkCard item={item as PublicWork}/>;
            return <CritiqueRow item={item as PublicCritique}/>;
          }}
          ListEmptyComponent={
            tab !== 'a-propos' ? (
              <View style={s.empty}>
                <Ionicons
                  name={tab === 'oeuvres' ? 'film-outline' : 'create-outline'}
                  size={40} color={C.subtle}/>
                <Text style={s.emptyTxt}>
                  {tab === 'oeuvres' ? 'Aucune œuvre partagée' : 'Aucune critique publiée'}
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    );
  }
  
  // ─── STYLES ───────────────────────────────────────────────────────────────────
  const s = StyleSheet.create({
    root:          { flex: 1, backgroundColor: C.bg },
    center:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    errorTxt:      { fontSize: 15, color: C.muted, marginTop: 8 },
    backBtn:       { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 50, backgroundColor: C.faint, borderWidth: 1, borderColor: C.border },
    backBtnTxt:    { color: C.mid, fontSize: 14 },
    listContent:   { paddingBottom: 120 },
    gridRow:       { paddingHorizontal: EDGE, gap: GAP },
  
    // animated header
    header:        { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100, overflow: 'hidden' },
    miniBar:       { position: 'absolute', bottom: 0, left: 0, right: 0, height: HEADER_MIN, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: EDGE, borderBottomWidth: 1, borderColor: C.border },
    miniTitle:     { fontSize: 16, fontWeight: '700', color: C.white, flex: 1, textAlign: 'center' },
    backArrow:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    headerBody:    { flex: 1, paddingHorizontal: EDGE },
    headerTopRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 8 : 12 },
    headerBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: C.faint, borderRadius: 18 },
  
    // identity
    identity:      { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 8 },
    avatarWrap:    { position: 'relative' },
    avatar:        { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: C.violetBd },
    avatarFb:      { backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    avatarInit:    { fontSize: 30, fontWeight: '800', color: C.violet },
    levelRing:     { position: 'absolute', bottom: -4, right: -4, width: 22, height: 22, borderRadius: 11, backgroundColor: C.bg, borderWidth: 2, borderColor: C.violetBd, alignItems: 'center', justifyContent: 'center' },
    levelNum:      { fontSize: 10, fontWeight: '900', color: C.violet },
    identityMeta:  { flex: 1, gap: 4 },
    pseudo:        { fontSize: 18, fontWeight: '800', color: C.white },
    titleRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    levelPill:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.violetFt, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: C.violetBd },
    levelPillTxt:  { fontSize: 11, color: C.violet, fontWeight: '600' },
    userTitle:     { fontSize: 11, color: C.muted, fontStyle: 'italic' },
    xpRow:         { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    xpTxt:         { fontSize: 10, color: C.muted },
    xpTrack:       { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.faint, overflow: 'hidden' },
    xpFill:        { height: 4, borderRadius: 2, backgroundColor: C.violet },
  
    // actions
    actions:       { flexDirection: 'row', gap: 8, marginTop: 10 },
    followBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 9, borderRadius: 50, backgroundColor: C.faint, borderWidth: 1, borderColor: C.borderHi },
    followBtnOn:   { backgroundColor: C.violetFt, borderColor: C.violetBd },
    followBtnTxt:  { fontSize: 13, fontWeight: '700', color: C.white },
    followBtnTxtOn:{ color: C.violet },
  
    // empty
    empty:         { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyTxt:      { fontSize: 13, color: C.muted, textAlign: 'center' },
  });
  
  // ─── PROFILE BLOCKS ───────────────────────────────────────────────────────────
  const pb = StyleSheet.create({
    statsRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: EDGE, marginTop: 12, marginBottom: 14, backgroundColor: C.faint, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border },
    statBox:     { alignItems: 'center', flex: 1 },
    statVal:     { fontSize: 16, fontWeight: '800', color: C.white },
    statLabel:   { fontSize: 10, color: C.muted, marginTop: 2 },
    statDivider: { width: 1, height: 28, backgroundColor: C.border },
    bio:         { fontSize: 13, color: C.mid, lineHeight: 20, marginHorizontal: EDGE, marginBottom: 12 },
    badgesRow:   { paddingHorizontal: EDGE, paddingBottom: 10, gap: 6, flexDirection: 'row' },
    badge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.goldDim, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(245,200,66,0.25)' },
    badgeTxt:    { fontSize: 11, color: C.gold, fontWeight: '600' },
    joined:      { fontSize: 11, color: C.muted, marginHorizontal: EDGE, marginBottom: 14 },
    tabs:        { flexDirection: 'row', gap: 6, paddingHorizontal: EDGE, marginBottom: 12 },
    tab:         { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 50, backgroundColor: C.faint, borderWidth: 1, borderColor: C.border },
    tabOn:       { backgroundColor: C.violetFt, borderColor: C.violetBd },
    tabTxt:      { fontSize: 13, color: C.mid, fontWeight: '500' },
    tabTxtOn:    { color: C.violet, fontWeight: '700' },
  });
  
  // ─── WORK CARD ────────────────────────────────────────────────────────────────
  const wc = StyleSheet.create({
    card:        { width: GRID, borderRadius: 12, overflow: 'hidden', marginBottom: GAP, position: 'relative' },
    poster:      { width: GRID, height: GRID * 1.48 },
    posterFb:    { backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    grad:        { position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%' },
    info:        { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 10, gap: 4 },
    originalBadge:{ backgroundColor: C.violetFt, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginBottom: 2 },
    originalTxt: { fontSize: 8, fontWeight: '800', color: C.violet, letterSpacing: 0.5 },
    title:       { fontSize: 12, fontWeight: '700', color: C.white, lineHeight: 16 },
    meta:        { flexDirection: 'row', gap: 5 },
    metaTxt:     { fontSize: 10, color: C.muted },
    stats:       { flexDirection: 'row', alignItems: 'center', gap: 3 },
    statTxt:     { fontSize: 10, color: C.mid },
  });
  
  // ─── CRITIQUE ROW ─────────────────────────────────────────────────────────────
  const cr = StyleSheet.create({
    row:       { flexDirection: 'row', gap: 12, padding: 14, marginHorizontal: EDGE, marginBottom: 6, backgroundColor: C.faint, borderRadius: 14, borderWidth: 1, borderColor: C.border },
    poster:    { width: 44, height: 62, borderRadius: 6 },
    posterFb:  { backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center' },
    body:      { flex: 1, gap: 4 },
    topRow:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
    title:     { flex: 1, fontSize: 13, fontWeight: '700', color: C.white },
    year:      { fontSize: 11, color: C.muted },
    text:      { fontSize: 12, color: C.mid, lineHeight: 18 },
    foot:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    footTxt:   { fontSize: 11, color: C.muted },
  });
  
  // ─── À PROPOS ─────────────────────────────────────────────────────────────────
  const ab = StyleSheet.create({
    container: { marginHorizontal: EDGE, gap: 0 },
    row:       { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 14, borderBottomWidth: 1, borderColor: C.border },
    rowBody:   { flex: 1, gap: 2 },
    rowLabel:  { fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    rowVal:    { fontSize: 14, color: C.off, fontWeight: '500' },
  });