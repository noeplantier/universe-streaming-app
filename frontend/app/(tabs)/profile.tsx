/**
 * app/(tabs)/profile.tsx — UNIVERSE · Final
 *
 * Tables : public.critiques · public.user_history · public.user_favorites
 * ✦ Header dynamique avec ring animé, level bar, streak, activité
 * ✦ Fetch ultra-optimisé : phase 1 parallèle → phase 2 works → phase 3 reco
 * ✦ Supabase Realtime : likes critiques + badge notifications en direct
 * ✦ Thème Universe cohérent — zéro couleur vive parasite
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Image, Linking, Modal, Platform, Pressable,
  RefreshControl, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, FlatList, ActivityIndicator,
} from 'react-native';
import { LinearGradient }  from 'expo-linear-gradient';
import { BlurView }        from 'expo-blur';
import { Ionicons }        from '@expo/vector-icons';
import { useRouter }       from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar }       from 'expo-status-bar';
import GalaxyBackground    from '@/components/social/GalaxyBackground';
import { supabase }        from '@/lib/supabase';
import { T } from '@/components/search/shared';

const { width: SW } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navyMid:  '#0D2040',
  navyLow:  '#0A1830',
  navyDark: '#06101F',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.88)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.35)',
  faint:    'rgba(255,255,255,0.07)',
  subtle:   'rgba(255,255,255,0.13)',
  border:   'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
  gold:     '#F5C842',
  goldDim:  'rgba(245,200,66,0.12)',
  blue:     '#5A96E6',
  blueDim:  'rgba(90,150,230,0.10)',
  ring:     'rgba(255,255,255,0.22)',
} as const;

const H_PAD = 20;
const CARD_W = 124, CARD_H = 185;
const REEL_W = 156, REEL_H = 220;
const CRIT_W = 214, CRIT_H = 144;
const GRID_GAP = 10;
const GRID_COL = (SW - 32 - GRID_GAP) / 2;
const WORK_COLS = 'id,title,category,genre,year,likes,image,is_original,duration,director';

// ─── UUID GUARD ───────────────────────────────────────────────────────────────
const isUUID = (v?: string | null): v is string =>
  !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; image:string|null; is_original:boolean; duration:number|null; director:string|null }
interface UserReel { id:string; video_url:string; thumbnail_url:string|null; title:string|null; genre:string|null; duration:number|null; status:'pending'|'approved'|'rejected'; likes_count:number; views_count:number; created_at:string }
interface ReviewItem { id:string; content:string; rating:number; likes:number; film:{ id:string; title:string; genre:string } }
interface ProfileData {
  display_name:string; username:string; bio:string; role:string;
  location:string; avatar_url:string; website:string; is_pro:boolean;
  is_industry_contact:boolean; specialties:string[]; festivals:string[];
  open_to:string[]; notable_works:any[]; equipment:string;
  social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string;
}
interface Badge { id:string; label:string; icon:keyof typeof Ionicons.glyphMap; earned:boolean; pts:number }
interface Mission { id:string; title:string; desc:string; reward:string; icon:keyof typeof Ionicons.glyphMap; target:number; progress:number; completed:boolean }
interface GamiStats { watchCount:number; critiqueCount:number; favCount:number; isNight:boolean; streak:number }
type GridTab = 0|1|2;
type ModalType = 'favorites'|'reviews'|'watched'|'recs'|'creations';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const EMPTY_PROFILE: ProfileData = {
  display_name:'', username:'', bio:'', role:'creator', location:'',
  avatar_url:'', website:'', is_pro:false, is_industry_contact:false,
  specialties:[], festivals:[], open_to:[], notable_works:[],
  equipment:'', social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};
const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice', other:'Cinéaste',
};
const GENRE_ICONS: Record<string,keyof typeof Ionicons.glyphMap> = {
  Drame:'sad-outline', Thriller:'eye-outline', 'Science-Fiction':'planet-outline',
  Documentaire:'library-outline', Animation:'color-palette-outline',
  Expérimental:'flask-outline', Biopic:'person-outline', Horreur:'skull-outline',
  Comédie:'happy-outline', Romance:'heart-outline', Action:'flash-outline',
  Fantastique:'sparkles-outline', Policier:'shield-outline', Musical:'musical-notes-outline',
};

// ─── MAPPERS ─────────────────────────────────────────────────────────────────
const mapProfile = (r: any): ProfileData => ({
  display_name:       r?.display_name    ?? '',
  username:           r?.username        ?? '',
  bio:                r?.bio             ?? '',
  role:               r?.role            ?? 'creator',
  location:           r?.location        ?? '',
  avatar_url:         r?.avatar_url      ?? '',
  website:            r?.website         ?? '',
  is_pro:             r?.is_pro          ?? false,
  is_industry_contact:r?.is_industry_contact ?? false,
  specialties:        Array.isArray(r?.specialties)    ? r.specialties    : [],
  festivals:          Array.isArray(r?.festivals)       ? r.festivals       : [],
  open_to:            Array.isArray(r?.open_to)         ? r.open_to         : [],
  notable_works:      Array.isArray(r?.notable_works)   ? r.notable_works   : [],
  equipment:          r?.equipment        ?? '',
  social_instagram:   r?.social_instagram ?? '',
  social_vimeo:       r?.social_vimeo     ?? '',
  social_youtube:     r?.social_youtube   ?? '',
  social_imdb:        r?.social_imdb      ?? '',
});

const mapWork = (r: any): Work => ({
  id:          Number(r?.id) || 0,
  title:       r?.title    ?? '',
  category:    r?.category ?? '',
  genre:       r?.genre    ?? '',
  year:        Number(r?.year) || 0,
  likes:       Number(r?.likes) || 0,
  image:       r?.image ?? null,
  is_original: r?.is_original ?? false,
  duration:    r?.duration != null ? Number(r.duration) : null,
  director:    r?.director ?? null,
});

// ★ Colonnes réelles de public.critiques + champs legacy (titre/contenu/note)
const mapReview = (r: any): ReviewItem => ({
  id:      String(r?.id ?? ''),
  content: String(r?.content ?? r?.contenu ?? ''),
  rating:  r?.rating != null ? Number(r.rating) : r?.note != null ? Number(r.note) : 0,
  likes:   Number(r?.likes_count ?? 0),
  film: {
    id:    String(r?.reel_id ?? r?.id),
    title: String(r?.film_title ?? r?.title ?? r?.titre ?? '—'),
    genre: '—',
  },
});

const mapReel = (r: any): UserReel => ({
  id:            String(r?.id ?? ''),
  video_url:     r?.video_url     ?? '',
  thumbnail_url: r?.thumbnail_url ?? null,
  title:         r?.title ?? null,
  genre:         r?.genre ?? null,
  duration:      r?.duration != null ? Number(r.duration) : null,
  status:        (['pending','approved','rejected'].includes(r?.status) ? r.status : 'pending') as any,
  likes_count:   Number(r?.likes_count) || 0,
  views_count:   Number(r?.views_count) || 0,
  created_at:    r?.created_at ?? new Date().toISOString(),
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const resolveImg = (id: number, img: string | null) => {
  if (!img) return `https://picsum.photos/seed/w${id}/400/600`;
  if (img.startsWith('http')) return img;
  try { return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl; }
  catch { return `https://picsum.photos/seed/w${id}/400/600`; }
};
const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`
  : `${n}`;
const momentum = (r: UserReel) =>
  Math.round((r.views_count * 0.3 + r.likes_count * 2) /
    Math.max(0.5, (Date.now() - new Date(r.created_at).getTime()) / 86400000));

// ─── GAMIFICATION ─────────────────────────────────────────────────────────────
function buildBadges(s: GamiStats): Badge[] { return [
  { id:'explorer', label:'Explorateur',   icon:'compass-outline',  earned:s.watchCount>=5,    pts:15 },
  { id:'nocturne', label:'Insomniaque', icon:'moon-outline',     earned:s.isNight,          pts:5  },
  { id:'critique', label:'Critique',  icon:'create-outline',   earned:s.critiqueCount>=5, pts:40 },
  { id:'curateur', label:'Curateur',           icon:'bookmark-outline', earned:s.favCount>=10,     pts:20 },
  { id:'omnivore', label:'Omnivore',           icon:'layers-outline',   earned:s.watchCount>=15,   pts:25 },
  { id:'streak',   label:'Habitué',            icon:'flame-outline',    earned:s.streak>=3,        pts:10 },
]; }
function buildMissions(s: GamiStats): Mission[] { return [
  { id:'watch5', title:'Cinéphile actif',   desc:'5 œuvres visionnées',  reward:'+15 pts',         icon:'play-circle-outline', target:5,  progress:Math.min(5,s.watchCount),    completed:s.watchCount>=5    },
  { id:'crit5',  title:'Voix critique',     desc:'5 critiques publiées', reward:'+40 pts + badge', icon:'create-outline',      target:5,  progress:Math.min(5,s.critiqueCount), completed:s.critiqueCount>=5 },
  { id:'fav10',  title:'Curateur passionné',desc:'10 favoris',           reward:'+20 pts + badge', icon:'bookmark-outline',    target:10, progress:Math.min(10,s.favCount),      completed:s.favCount>=10     },
]; }
function cinephileLevel(score: number) {
  const L = [
    { at:0,   n:1, l:'Spectateur curieux'    },
    { at:50,  n:2, l:'Explorateur indé'      },
    { at:150, n:3, l:'Critique amateur'      },
    { at:400, n:4, l:'Curateur underground'  },
    { at:900, n:5, l:'Ambassadeur cinéma'    },
  ];
  const cur = [...L].reverse().find(x => score >= x.at) ?? L[0];
  const ni  = L.findIndex(x => x.n === cur.n) + 1;
  const nxt = L[ni] ?? L[L.length - 1];
  return { n: cur.n, label: cur.l, pct: cur.n === 5 ? 1 : Math.min(1, (score - cur.at) / (nxt.at - cur.at)), nextAt: nxt.at, prevAt: cur.at };
}

function useGamification(uid: string | null) {
  const [stats, setStats] = useState<GamiStats>({ watchCount:0, critiqueCount:0, favCount:0, isNight:false, streak:0 });
  useEffect(() => {
    if (!isUUID(uid)) return;
    const isNight = new Date().getHours() >= 22 || new Date().getHours() < 4;
    Promise.all([
      supabase.from('user_history').select('work_id', { count:'exact' }).eq('user_id', uid),
      supabase.from('critiques').select('id',         { count:'exact' }).eq('user_id', uid),
      supabase.from('user_favorites').select('work_id', { count:'exact' }).eq('user_id', uid),
    ]).then(([h, c, f]) => setStats(p => ({
      watchCount:    h.count ?? (h.data ?? []).length,
      critiqueCount: c.count ?? (c.data ?? []).length,
      favCount:      f.count ?? (f.data ?? []).length,
      isNight, streak: p.streak + 1,
    }))).catch(console.error);
  }, [uid]);
  const score   = useMemo(() => stats.watchCount * 3 + stats.critiqueCount * 8 + stats.favCount * 2 + (stats.isNight ? 5 : 0) + (stats.streak >= 3 ? 10 : 0), [stats]);
  const level   = useMemo(() => cinephileLevel(score), [score]);
  const badges  = useMemo(() => buildBadges(stats), [stats]);
  const missions = useMemo(() => buildMissions(stats), [stats]);
  return { score, level, badges, missions };
}

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
const Shimmer = memo(({ w, h, r=8 }: { w:number; h:number; r?:number }) => {
  const op = useRef(new Animated.Value(0.12)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue:0.30, duration:900, useNativeDriver:true }),
      Animated.timing(op, { toValue:0.12, duration:900, useNativeDriver:true }),
    ])); l.start(); return () => l.stop();
  }, [op]);
  return <Animated.View style={{ width:w, height:h, borderRadius:r, backgroundColor:C.navyMid, opacity:op }} />;
});
Shimmer.displayName = 'Shimmer';

const HRow = memo(({ c, pb=0 }: { c:React.ReactNode; pb?:number }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{ paddingHorizontal:H_PAD, paddingBottom:pb }}>
    {c}
  </ScrollView>
));
HRow.displayName = 'HRow';

const Div = memo(() => <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:C.faint, marginTop:22 }} />);
Div.displayName = 'Div';

const SecHead = memo(({ icon, label, count, onMore }: { icon:keyof typeof Ionicons.glyphMap; label:string; count?:number; onMore?:()=>void }) => (
  <View style={{ flexDirection:'row', alignItems:'center', paddingHorizontal:H_PAD, paddingTop:22, paddingBottom:12, gap:7 }}>
    <Ionicons name={icon} size={13} color={C.mid} />
    <Text style={{ color:C.white, fontSize:15, fontWeight:'800', letterSpacing:-0.2, flex:1 }}>{label}</Text>
    {count != null && <View style={sech.pill}><Text style={sech.pillTxt}>{count}</Text></View>}
    {onMore && <TouchableOpacity onPress={onMore} hitSlop={8} style={sech.btn}><Text style={sech.btnTxt}>Tout voir</Text><Ionicons name="chevron-forward" size={11} color={C.blue} /></TouchableOpacity>}
  </View>
));
SecHead.displayName = 'SecHead';
const sech = StyleSheet.create({
  pill:   { paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  pillTxt:{ color:C.muted, fontSize:9, fontWeight:'700' },
  btn:    { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:10, paddingVertical:5, borderRadius:10, backgroundColor:C.blueDim, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(90,150,230,0.20)' },
  btnTxt: { color:C.blue, fontSize:11, fontWeight:'700' },
});

const Empty = memo(({ icon, text, sub }: { icon:keyof typeof Ionicons.glyphMap; text:string; sub?:string }) => (
  <View style={{ alignItems:'center', paddingVertical:32, paddingHorizontal:H_PAD, gap:8 }}>
    <View style={{ width:52, height:52, borderRadius:26, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' }}>
      <Ionicons name={icon} size={22} color={C.muted} />
    </View>
    <Text style={{ color:C.muted, fontSize:13, fontWeight:'600' }}>{text}</Text>
    {sub && <Text style={{ color:C.muted, fontSize:11, textAlign:'center', lineHeight:17 }}>{sub}</Text>}
  </View>
));
Empty.displayName = 'Empty';

// ─── ★ PROFILE HEADER (refondu) ───────────────────────────────────────────────
interface HeaderProps {
  profile:       ProfileData;
  uid:           string | null;
  filmCount:     number;
  critiqueCount: number;
  reelCount:     number;
  level:         ReturnType<typeof cinephileLevel>;
  score:         number;
  unreadNotifs:  number;
  streak:        number;
  onEdit:        () => void;
  onAdmin:       () => void;
  onNotifs:      () => void;
  onSettings:    () => void;
}

const ProfileHeader = memo(function ProfileHeader({
  profile, uid, filmCount, critiqueCount, reelCount,
  level, score, unreadNotifs, streak, onEdit, onAdmin, onNotifs, onSettings,
}: HeaderProps) {
  const [bioExpanded, setBioExpanded] = useState(false);
  const [imgErr, setImgErr]           = useState(false);
  const ringAnim  = useRef(new Animated.Value(0)).current;
  const levelAnim = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0.4)).current;

  useEffect(() => { setImgErr(false); }, [profile.avatar_url]);

  useEffect(() => {
    Animated.timing(levelAnim, { toValue: level.pct, duration: 1100, useNativeDriver: false }).start();
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1,   duration: 2200, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 2200, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(ringAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
      Animated.timing(ringAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
    ])).start();
  }, [level.pct]);

  const dn    = profile.display_name || profile.username || 'Cinéphile';
  const init  = dn.trim().split(/\s+/).map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const links = [
    { k:'ig', icon:'logo-instagram' as const,  url:profile.social_instagram, label:'Instagram' },
    { k:'vi', icon:'videocam-outline' as const, url:profile.social_vimeo,     label:'Vimeo'     },
    { k:'yt', icon:'logo-youtube' as const,     url:profile.social_youtube,   label:'YouTube'   },
    { k:'ws', icon:'globe-outline' as const,    url:profile.website,          label:'Portfolio' },
  ].filter(l => !!l.url);

  const levelBarW = levelAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] });
  const ringScale = ringAnim.interpolate({ inputRange:[0,1], outputRange:[1,1.06] });
  const ptsToNext = Math.max(0, level.nextAt - score);

  return (
    <View>
      {/* ── Top nav — transparent, GalaxyBackground visible derrière ── */}
      <View style={ph.topNav}>
        <View style={ph.navLeft}>
          <Text style={ph.brandTxt}>UNIVERSE</Text>
          <View style={ph.navDot} />
          <Text style={ph.navSub}>{ROLE_LABELS[profile.role] ?? 'Cinéaste'}</Text>
        </View>
        <View style={ph.navRight}>
        
          {/* Back-office */}
          <TouchableOpacity style={ph.navIconBtn} onPress={onAdmin} activeOpacity={0.75}>
            <Ionicons name="eye-outline" size={17} color={C.offWhite} />
          </TouchableOpacity>
        
          {/* Settings */}
          <TouchableOpacity style={ph.navIconBtn} onPress={onSettings} activeOpacity={0.75}>
            <Ionicons name="settings-outline" size={17} color={C.offWhite} />
          </TouchableOpacity>
          {/*Edit profile (only for own profile) */}
            <TouchableOpacity style={ph.navIconBtn} onPress={onEdit} activeOpacity={0.75}>
              <Ionicons name="create-outline" size={17} color={C.offWhite} />
            </TouchableOpacity>
          
        </View>
      </View>

      {/* ── Identité : avatar + stats ── */}
      <View style={ph.identityRow}>
        {/* Avatar avec ring animé */}
        <View style={{ position:'relative', marginRight:18 }}>
          <Animated.View style={[ph.avatarRingOuter, { transform:[{ scale:ringScale }], opacity:glowAnim }]} />
          <View style={ph.avatarWrap}>
            {profile.avatar_url && !imgErr ? (
              <Image source={{ uri:profile.avatar_url }} style={ph.avatar} resizeMode="cover" onError={() => setImgErr(true)} />
            ) : (
              <View style={[ph.avatar, ph.avatarFallback]}>
                <Text style={ph.avatarInitials}>{init}</Text>
                  {/* Level badge */}
            <View style={ph.levelBadge}>
              <Text style={ph.levelBadgeTxt}>{level.n}</Text>
            </View>
              </View>
            )}
          
            {/* PRO badge */}
            {profile.is_pro && (
              <View style={ph.proBadge}>
                <Text style={ph.proBadgeTxt}>PRO</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats chips */}
        <View style={{ flex:1, gap:6 }}>
          <View style={{ flexDirection:'row', gap:6 }}>
            {[
              { val:fmt(filmCount),     label:'films'     },
              { val:fmt(critiqueCount), label:'critiques' },
              { val:fmt(reelCount),     label:'créas'     },
            ].map(chip => (
              <View key={chip.label} style={ph.statChip}>
                <Text style={ph.statVal}>{chip.val}</Text>
                <Text style={ph.statLbl}>{chip.label}</Text>
              </View>
            ))}
          </View>

          {/* Level progress inline */}
          <View style={ph.levelRow}>
            <Text style={ph.levelLabel}>Niv.{level.n} · {level.label}</Text>
            <Text style={ph.levelPts}>{fmt(score)} pts</Text>
          </View>
          <View style={ph.levelTrack}>
            <Animated.View style={[ph.levelFill, { width: levelBarW }]} />
          </View>
          {level.n < 5 && (
            <Text style={ph.levelNext}>
              {fmt(ptsToNext)} pts → Niv.{level.n + 1}
            </Text>
          )}
        </View>
      </View>

      {/* ── Nom + badges inline ── */}
      <View style={ph.nameRow}>
        <Text style={ph.displayName} numberOfLines={1}>{dn}</Text>
        {profile.is_industry_contact && (
          <View style={ph.industryBadge}>
            <Ionicons name="briefcase-outline" size={9} color={C.mid} />
            <Text style={ph.industryTxt}>INDUSTRIE</Text>
          </View>
        )}
        {streak >= 3 && (
          <View style={ph.streakBadge}>
            <Ionicons name="flame-outline" size={9} color={C.gold} />
            <Text style={[ph.industryTxt, { color:C.gold }]}>{streak}J</Text>
          </View>
        )}
      </View>

      {/* Sous-titre : location */}
      {(profile.location || profile.username) && (
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:H_PAD, marginBottom:10 }}>
          {profile.location && <Ionicons name="location-outline" size={11} color={C.muted} />}
          <Text style={ph.subline}>
            {[profile.username && `@${profile.username}`, profile.location].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}

      {/* ── Bio ── */}
      {!!profile.bio && (
        <Pressable onPress={() => setBioExpanded(e => !e)} style={{ paddingHorizontal:H_PAD, marginBottom:12 }}>
          <Text style={ph.bio} numberOfLines={bioExpanded ? undefined : 2}>{profile.bio}</Text>
          {profile.bio.length > 90 && (
            <Text style={ph.bioToggle}>{bioExpanded ? 'Moins ↑' : 'Suite ↓'}</Text>
          )}
        </Pressable>
      )}

      {/* ── Liens sociaux ── */}
      {links.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal:H_PAD, gap:7, marginTop:10, paddingBottom:2 }}>
          {links.map(l => (
            <TouchableOpacity key={l.k} style={ph.socialBtn}
              onPress={() => Linking.openURL(l.url!).catch(() => {})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFill} />
              <Ionicons name={l.icon} size={13} color={C.offWhite} />
              <Text style={ph.socialTxt}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

    </View>
    
  );
});
ProfileHeader.displayName = 'ProfileHeader';

const ph = StyleSheet.create({
  topNav:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:H_PAD, paddingTop:6, paddingBottom:14 },
  navLeft:       { flexDirection:'row', alignItems:'center', gap:6 },
  brandTxt:      { color:C.muted, fontSize:8, fontWeight:'900', letterSpacing:2.5, textTransform:'uppercase' },
  navDot:        { width:2, height:10, backgroundColor:C.faint, borderRadius:1 },
  navSub:        { color:C.muted, fontSize:9, fontWeight:'600', letterSpacing:0.3 },
  navRight:      { flexDirection:'row', gap:6 },
  navIconBtn:    { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center', backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  notifBadge:    { position:'absolute', top:4, right:4, minWidth:14, height:14, borderRadius:7, backgroundColor:C.white, alignItems:'center', justifyContent:'center', paddingHorizontal:2 },
  notifBadgeTxt: { color:C.navyDark, fontSize:7, fontWeight:'900' },
  identityRow:   { flexDirection:'row', alignItems:'flex-start', paddingHorizontal:H_PAD, marginBottom:14 },
  avatarRingOuter:{ position:'absolute', top:-5, left:-5, width:90, height:90, borderRadius:45, borderWidth:1.5, borderColor:C.ring },
  avatarWrap:    { position:'relative' },
  avatar:        { width:80, height:80, borderRadius:40, backgroundColor:C.navyMid },
  avatarFallback:{ alignItems:'center', justifyContent:'center' },
  avatarInitials:{ color:C.white, fontSize:24, fontWeight:'900', letterSpacing:-0.5 },
  levelBadge:    { position:'absolute', top:-5, right:-5, width:12, height:12, borderRadius:11, backgroundColor:C.navyDark, borderWidth:0.5, borderColor:C.borderHi, alignItems:'center', justifyContent:'center' },
  levelBadgeTxt: { color:C.white, fontSize:9, fontWeight:'900' },
  proBadge:      { position:'absolute', bottom:0, right:-2, paddingHorizontal:5, paddingVertical:1.5, borderRadius:5, backgroundColor:C.navyDark, borderWidth:1, borderColor:C.borderHi },
  proBadgeTxt:   { color:C.offWhite, fontSize:7, fontWeight:'900', letterSpacing:0.8 },
  statChip:      { flex:1, alignItems:'center', gap:1, paddingVertical:7, borderRadius:11, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  statVal:       { color:C.white, fontSize:16, fontWeight:'900', letterSpacing:-0.5 },
  statLbl:       { color:C.muted, fontSize:7.5, fontWeight:'700', textTransform:'uppercase', letterSpacing:0.5 },
  levelRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center' },
  levelLabel:    { color:C.muted, fontSize:9.5, fontWeight:'600' },
  levelPts:      { color:C.muted, fontSize:9, fontWeight:'700' },
  levelTrack:    { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
  levelFill:     { height:'100%', borderRadius:2, backgroundColor:C.subtle },
  levelNext:     { color:C.muted, fontSize:8.5, fontWeight:'600' },
  nameRow:       { flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:H_PAD, marginBottom:3, flexWrap:'wrap' },
  displayName:   { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.5, flexShrink:1 },
  industryBadge: { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:2.5, borderRadius:6, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyMid },
  industryTxt:   { color:C.muted, fontSize:7.5, fontWeight:'800', letterSpacing:0.5 },
  streakBadge:   { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:2.5, borderRadius:6, borderWidth:StyleSheet.hairlineWidth, borderColor:C.goldDim, backgroundColor:'rgba(245,200,66,0.07)' },
  subline:       { color:C.muted, fontSize:11.5, fontWeight:'500' },
  bio:           { color:C.mid, fontSize:12.5, lineHeight:18 },
  bioToggle:     { color:C.offWhite, fontSize:11, fontWeight:'700', marginTop:3 },
  socialBtn:     { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:7, borderRadius:10, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  socialTxt:     { color:C.offWhite, fontSize:10, fontWeight:'600' },
});

// ─── CARDS ────────────────────────────────────────────────────────────────────
const PortraitCard = memo(({ item, rank }: { item:Work; rank?:number }) => {
  const router = useRouter();
  const uri = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={ptc.card}>
        <Image source={{ uri }} style={ptc.img} resizeMode="cover" />
        <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}} />
        <View style={ptc.badge}><Text style={ptc.badgeTxt}>{item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}</Text></View>
        {rank != null && <Text style={ptc.rank}>{rank}</Text>}
        <View style={ptc.meta}>
          <Text style={ptc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="heart" size={9} color={C.mid} />
            <Text style={ptc.stat}>{(item.likes ?? 0).toLocaleString('fr-FR')}</Text>
            {item.year > 0 && <><View style={{ width:2, height:2, borderRadius:1, backgroundColor:C.subtle }} /><Text style={ptc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
PortraitCard.displayName = 'PortraitCard';
const ptc = StyleSheet.create({
  card:     { width:CARD_W, height:CARD_H, borderRadius:13, overflow:'hidden', backgroundColor:C.navyMid },
  img:      { width:CARD_W, height:CARD_H },
  badge:    { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  badgeTxt: { color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  rank:     { position:'absolute', bottom:32, right:5, fontSize:48, fontWeight:'900', lineHeight:48, letterSpacing:-3, color:'rgba(255,255,255,0.09)' },
  meta:     { position:'absolute', bottom:7, left:8, right:8, gap:3 },
  title:    { color:C.white, fontSize:11, fontWeight:'700', lineHeight:14 },
  stat:     { color:C.muted, fontSize:9, fontWeight:'600' },
});

const WorkGridCard = memo(({ item, onPress }: { item:Work; onPress:()=>void }) => {
  const uri = useMemo(() => resolveImg(item.id, item.image), [item.id, item.image]);
  return (
    <TouchableOpacity style={gc.card} onPress={onPress} activeOpacity={0.88}>
      <Image source={{ uri }} style={gc.img} resizeMode="cover" />
      <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}} />
      <View style={gc.badge}><Text style={gc.badgeTxt}>{item.is_original ? 'ORIG' : (item.category ?? '').slice(0,4).toUpperCase()}</Text></View>
      <View style={gc.meta}>
        {item.genre ? <Text style={gc.genre}>{item.genre.toUpperCase()}</Text> : null}
        <Text style={gc.title} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection:'row', alignItems:'center', gap:5, marginTop:2 }}>
          <Ionicons name="heart" size={9} color={C.muted} />
          <Text style={gc.stat}>{fmt(item.likes ?? 0)}</Text>
          {item.year > 0 && <><Text style={{ color:C.muted, fontSize:9 }}>·</Text><Text style={gc.stat}>{item.year}</Text></>}
        </View>
      </View>
    </TouchableOpacity>
  );
});
WorkGridCard.displayName = 'WorkGridCard';
const gc = StyleSheet.create({
  card:     { width:GRID_COL, height:GRID_COL*1.5, borderRadius:13, overflow:'hidden', backgroundColor:C.navyMid },
  img:      { width:'100%', height:'100%', position:'absolute' },
  badge:    { position:'absolute', top:7, left:7, paddingHorizontal:5, paddingVertical:2.5, borderRadius:5, backgroundColor:'rgba(7,12,23,0.72)' },
  badgeTxt: { color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  meta:     { position:'absolute', bottom:0, left:0, right:0, padding:10, gap:2 },
  genre:    { color:C.muted, fontSize:8, fontWeight:'700', letterSpacing:0.8 },
  title:    { color:C.white, fontSize:12, fontWeight:'800', lineHeight:16 },
  stat:     { color:C.muted, fontSize:9, fontWeight:'600' },
});

const CritiqueGridCard = memo(({ r, rank, onPress }: { r:ReviewItem; rank:number; onPress:()=>void }) => {
  const stars = Math.round(r.rating ?? 0);
  return (
    <TouchableOpacity style={cgc.card} onPress={onPress} activeOpacity={0.88}>
      <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}} />
      <View style={{ position:'absolute', top:9, left:9, paddingHorizontal:7, paddingVertical:3, borderRadius:7, backgroundColor:C.navyDark }}><Text style={{ color:C.mid, fontSize:9, fontWeight:'800' }}>#{rank}</Text></View>
      {r.likes > 0 && <View style={{ position:'absolute', top:9, right:9, flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:6, paddingVertical:2.5, borderRadius:7, backgroundColor:C.navyDark }}><Ionicons name="heart" size={8} color={C.mid} /><Text style={{ color:C.mid, fontSize:8, fontWeight:'700' }}>{fmt(r.likes)}</Text></View>}
      <View style={{ position:'absolute', bottom:0, left:0, right:0, padding:11, gap:3 }}>
        <Text style={{ color:C.white, fontSize:12, fontWeight:'800', letterSpacing:-0.2 }} numberOfLines={1}>{r.film?.title ?? '—'}</Text>
        <View style={{ flexDirection:'row', gap:2 }}>{[1,2,3,4,5].map(s => <Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle} />)}</View>
        <Text style={{ color:C.muted, fontSize:10, lineHeight:13 }} numberOfLines={2}>{r.content || '—'}</Text>
      </View>
      <View style={{ ...StyleSheet.absoluteFillObject, borderRadius:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }} pointerEvents="none" />
    </TouchableOpacity>
  );
});
CritiqueGridCard.displayName = 'CritiqueGridCard';
const cgc = StyleSheet.create({ card: { width:GRID_COL, height:GRID_COL*1.1, borderRadius:13, overflow:'hidden', backgroundColor:C.navyMid } });

const CritCard = memo(({ r, rank, onPress }: { r:ReviewItem; rank:number; onPress:()=>void }) => {
  const stars = Math.round(r.rating ?? 0);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={onPress} activeOpacity={0.88}>
      <View style={{ width:CRIT_W, height:CRIT_H, borderRadius:14, overflow:'hidden' }}>
        <LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject} />
        <View style={{ position:'absolute', top:9, left:9, paddingHorizontal:7, paddingVertical:3, borderRadius:7, backgroundColor:C.navyDark }}><Text style={{ color:C.mid, fontSize:9, fontWeight:'800' }}>#{rank}</Text></View>
        {r.likes > 0 && <View style={{ position:'absolute', top:9, right:9, flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:6, paddingVertical:2.5, borderRadius:7, backgroundColor:C.navyDark }}><Ionicons name="heart" size={8} color={C.mid} /><Text style={{ color:C.mid, fontSize:8, fontWeight:'700' }}>{fmt(r.likes)}</Text></View>}
        <View style={{ position:'absolute', bottom:0, left:0, right:0, padding:11, gap:3 }}>
          <Text style={{ color:C.white, fontSize:12, fontWeight:'800', letterSpacing:-0.2 }} numberOfLines={1}>{r.film?.title ?? '—'}</Text>
          <View style={{ flexDirection:'row', gap:2 }}>{[1,2,3,4,5].map(s => <Ionicons key={s} name={s<=stars?'star':'star-outline'} size={9} color={s<=stars?C.offWhite:C.subtle} />)}</View>
          <Text style={{ color:C.muted, fontSize:10, lineHeight:13 }} numberOfLines={2}>{r.content || '—'}</Text>
        </View>
        <View style={{ ...StyleSheet.absoluteFillObject, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }} pointerEvents="none" />
      </View>
    </TouchableOpacity>
  );
});
CritCard.displayName = 'CritCard';

// Reel Card
const VideoThumbnails: any = Platform.select({ native: () => { try { return require('expo-video-thumbnails'); } catch { return null; } }, default: () => null })?.() ?? null;
function useThumb(url: string, thumb: string | null): string | null {
  const [uri, setUri] = useState<string | null>(thumb ?? null);
  useEffect(() => {
    if (thumb || !url || !VideoThumbnails) return;
    let ok = true;
    VideoThumbnails.getThumbnailAsync(url, { time:1500, quality:0.65 }).then(({ uri: u }: { uri:string }) => { if (ok) setUri(u); }).catch(() => {});
    return () => { ok = false; };
  }, [url, thumb]);
  return uri;
}
const STATUS_CFG: Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}> = {
  pending:  { icon:'time-outline',            label:'En attente' },
  approved: { icon:'checkmark-circle-outline', label:'Validée'   },
  rejected: { icon:'close-circle-outline',    label:'Refusée'   },
};
const ReelCard = memo(({ reel, isHot }: { reel:UserReel; isHot:boolean }) => {
  const router = useRouter(), thumb = useThumb(reel.video_url, reel.thumbnail_url);
  const cfg = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  const [err, setErr] = useState(false), m = momentum(reel);
  return (
    <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push({ pathname:'/reel/[id]', params:{ id:reel.id } } as any)} activeOpacity={0.88}>
      <View style={rlc.card}>
        {thumb && !err ? <Image source={{ uri:thumb }} style={rlc.img} resizeMode="cover" onError={() => setErr(true)} /> : <View style={rlc.ph}><LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject} /><Ionicons name="film-outline" size={24} color={C.subtle} /></View>}
        <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}} />
        <View style={{ position:'absolute', top:'38%', alignSelf:'center', marginTop:-13 }} pointerEvents="none"><Ionicons name="play-circle-outline" size={26} color={C.mid} /></View>
        <View style={rlc.status}><Ionicons name={cfg.icon} size={9} color={C.mid} /><Text style={rlc.stTxt}>{cfg.label}</Text></View>
        {(isHot || reel.views_count >= 10) && <View style={rlc.mom}><Ionicons name={isHot ? 'flame-outline' : 'trending-up-outline'} size={8} color={C.mid} /><Text style={rlc.momTxt}>{isHot ? 'EN HAUSSE' : `${fmt(reel.views_count)} vues`}</Text></View>}
        <View style={rlc.meta}><Text style={rlc.title} numberOfLines={2}>{reel.title || 'Sans titre'}</Text><View style={{ flexDirection:'row', alignItems:'center', gap:7, marginTop:2 }}><View style={{ flexDirection:'row', alignItems:'center', gap:3 }}><Ionicons name="eye-outline" size={8} color={C.muted} /><Text style={rlc.stTxt}>{fmt(reel.views_count)}</Text></View><View style={{ flexDirection:'row', alignItems:'center', gap:3 }}><Ionicons name="heart-outline" size={8} color={C.muted} /><Text style={rlc.stTxt}>{fmt(reel.likes_count)}</Text></View>{m > 0 && <Text style={{ marginLeft:'auto' as any, color:C.muted, fontSize:7, fontWeight:'700' }}>{m}pts/j</Text>}</View></View>
      </View>
    </TouchableOpacity>
  );
});
ReelCard.displayName = 'ReelCard';
const rlc = StyleSheet.create({
  card:   { width:REEL_W, height:REEL_H, borderRadius:13, overflow:'hidden', backgroundColor:C.navyMid },
  img:    { width:REEL_W, height:REEL_H },
  ph:     { width:REEL_W, height:REEL_H, alignItems:'center', justifyContent:'center' },
  status: { position:'absolute', top:8, left:8, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(7,12,23,0.72)' },
  stTxt:  { color:C.muted, fontSize:7.5, fontWeight:'700' },
  mom:    { position:'absolute', top:8, right:8, flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:6, paddingVertical:2.5, borderRadius:7, backgroundColor:'rgba(7,12,23,0.82)', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  momTxt: { color:C.mid, fontSize:7, fontWeight:'800', letterSpacing:0.4 },
  meta:   { position:'absolute', bottom:0, left:0, right:0, padding:10, gap:2 },
  title:  { color:C.white, fontSize:10.5, fontWeight:'800', lineHeight:13 },
});

const ReelGridCard = memo(({ reel, isHot, onPress }: { reel:UserReel; isHot:boolean; onPress:()=>void }) => {
  const thumb = useThumb(reel.video_url, reel.thumbnail_url), [err, setErr] = useState(false);
  const cfg = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  return (
    <TouchableOpacity style={rgc.card} onPress={onPress} activeOpacity={0.88}>
      {thumb && !err ? <Image source={{ uri:thumb }} style={rgc.img} resizeMode="cover" onError={() => setErr(true)} /> : <View style={rgc.ph}><LinearGradient colors={[C.navyMid, C.navyLow]} style={StyleSheet.absoluteFillObject} /><Ionicons name="film-outline" size={22} color={C.subtle} /></View>}
      <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}} />
      <View style={rgc.status}><Ionicons name={cfg.icon} size={9} color={C.mid} /><Text style={rgc.stTxt}>{cfg.label}</Text></View>
      {isHot && <View style={rgc.hot}><Ionicons name="flame-outline" size={8} color={C.mid} /></View>}
      <View style={rgc.meta}><Text style={rgc.title} numberOfLines={2}>{reel.title || 'Sans titre'}</Text><View style={{ flexDirection:'row', alignItems:'center', gap:6, marginTop:2 }}><View style={{ flexDirection:'row', alignItems:'center', gap:2 }}><Ionicons name="eye-outline" size={8} color={C.muted} /><Text style={rgc.stat}>{fmt(reel.views_count)}</Text></View><View style={{ flexDirection:'row', alignItems:'center', gap:2 }}><Ionicons name="heart-outline" size={8} color={C.muted} /><Text style={rgc.stat}>{fmt(reel.likes_count)}</Text></View></View></View>
    </TouchableOpacity>
  );
});
ReelGridCard.displayName = 'ReelGridCard';
const rgc = StyleSheet.create({
  card:   { width:GRID_COL, height:GRID_COL*1.4, borderRadius:13, overflow:'hidden', backgroundColor:C.navyMid },
  img:    { width:'100%', height:'100%', position:'absolute' },
  ph:     { width:'100%', height:'100%', alignItems:'center', justifyContent:'center' },
  status: { position:'absolute', top:8, left:8, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:8, backgroundColor:'rgba(7,12,23,0.72)' },
  stTxt:  { color:C.muted, fontSize:7.5, fontWeight:'700' },
  hot:    { position:'absolute', top:8, right:8, width:22, height:22, borderRadius:11, backgroundColor:'rgba(7,12,23,0.72)', alignItems:'center', justifyContent:'center' },
  meta:   { position:'absolute', bottom:0, left:0, right:0, padding:10, gap:2 },
  title:  { color:C.white, fontSize:11, fontWeight:'800', lineHeight:14 },
  stat:   { color:C.muted, fontSize:9, fontWeight:'600' },
});

// ─── SEE ALL MODAL ────────────────────────────────────────────────────────────
interface SeeAllModalProps { visible:boolean; onClose:()=>void; type:ModalType; title:string; icon:keyof typeof Ionicons.glyphMap; works?:Work[]; reviews?:ReviewItem[]; reels?:UserReel[]; hotReelId?:string|null }
const SeeAllModal = memo(function SeeAllModal({ visible, onClose, type, title, icon, works=[], reviews=[], reels=[], hotReelId=null }: SeeAllModalProps) {
  const router = useRouter(), insets = useSafeAreaInsets(), [q, setQ] = useState('');
  const inputRef = useRef<TextInput>(null), slideY = useRef(new Animated.Value(600)).current;
  useEffect(() => {
    if (visible) { setQ(''); Animated.spring(slideY, { toValue:0, tension:65, friction:12, useNativeDriver:true }).start(); setTimeout(() => inputRef.current?.focus(), 280); }
    else { Animated.timing(slideY, { toValue:600, duration:210, useNativeDriver:true }).start(); }
  }, [visible, slideY]);
  const fWorks   = useMemo(() => q.trim() ? works.filter(w => w.title.toLowerCase().includes(q.toLowerCase()) || (w.genre ?? '').toLowerCase().includes(q.toLowerCase())) : works, [works, q]);
  const fReviews = useMemo(() => q.trim() ? reviews.filter(r => r.film?.title.toLowerCase().includes(q.toLowerCase()) || r.content.toLowerCase().includes(q.toLowerCase())) : reviews, [reviews, q]);
  const fReels   = useMemo(() => q.trim() ? reels.filter(r => (r.title ?? '').toLowerCase().includes(q.toLowerCase())) : reels, [reels, q]);
  const count    = type === 'reviews' ? fReviews.length : type === 'creations' ? fReels.length : fWorks.length;
  const renderWork   = useCallback(({ item }: { item:Work })       => <WorkGridCard item={item} onPress={() => { onClose(); router.push(`/film/${item.id}` as any); }} />, [router, onClose]);
  const renderReview = useCallback(({ item, index }: { item:ReviewItem; index:number }) => <CritiqueGridCard r={item} rank={index+1} onPress={() => { onClose(); router.push(`/review/${item.id}` as any); }} />, [router, onClose]);
  const renderReel   = useCallback(({ item }: { item:UserReel })   => <ReelGridCard reel={item} isHot={item.id===hotReelId} onPress={() => { onClose(); router.push({ pathname:'/reel/[id]', params:{ id:item.id } } as any); }} />, [router, onClose, hotReelId]);
  if (!visible) return null;
  return (
    <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GalaxyBackground />
      <Animated.View style={[sam.root, { transform:[{ translateY:slideY }] }]}>
        <View style={[sam.topBar, { paddingTop:insets.top + 10 }]}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}><Ionicons name={icon} size={15} color={C.muted} /><Text style={sam.title}>{title}</Text></View>
          <TouchableOpacity onPress={onClose}><Text style={sam.close}>Fermer</Text></TouchableOpacity>
        </View>
        <View style={sam.inputWrap}><Ionicons name="search-outline" size={14} color={C.muted} /><TextInput ref={inputRef} style={sam.input} value={q} onChangeText={setQ} placeholder="Rechercher…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" /></View>
        <Text style={sam.count}>{count} résultat{count !== 1 ? 's' : ''}{q.trim() ? ` · « ${q.trim()} »` : ''}</Text>
        {count === 0 ? <View style={sam.empty}><Ionicons name="search-outline" size={36} color={C.muted} /><Text style={{ color:C.mid, fontSize:14, fontWeight:'600' }}>Aucun résultat</Text></View>
          : type === 'reviews'   ? <FlatList data={fReviews} keyExtractor={r => `r_${r.id}`}   renderItem={renderReview} numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list, { paddingBottom:insets.bottom+40 }]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} />
          : type === 'creations' ? <FlatList data={fReels}   keyExtractor={r => `rl_${r.id}`}  renderItem={renderReel}   numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list, { paddingBottom:insets.bottom+40 }]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} />
          :                        <FlatList data={fWorks}   keyExtractor={w => `w_${w.id}`}   renderItem={renderWork}   numColumns={2} columnWrapperStyle={sam.col} contentContainerStyle={[sam.list, { paddingBottom:insets.bottom+40 }]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} />
        }
      </Animated.View>
    </Modal>
  );
});
SeeAllModal.displayName = 'SeeAllModal';
const sam = StyleSheet.create({
  root:     { flex:1, backgroundColor:C.bg },
  topBar:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:10 },
  title:    { color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.3 },
  close:    { color:C.muted, fontSize:14, fontWeight:'600' },
  inputWrap:{ flexDirection:'row', alignItems:'center', gap:10, marginHorizontal:16, marginBottom:8, paddingHorizontal:14, height:42, borderRadius:13, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  input:    { flex:1, color:C.white, fontSize:14 },
  count:    { color:C.muted, fontSize:10, paddingHorizontal:16, marginBottom:12 },
  col:      { justifyContent:'space-between', gap:GRID_GAP, marginBottom:GRID_GAP },
  list:     { paddingHorizontal:16 },
  empty:    { flex:1, alignItems:'center', justifyContent:'center', gap:10, paddingBottom:80 },
});


const asc = StyleSheet.create({
  w:      { marginHorizontal:H_PAD, borderRadius:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow, padding:16, flexDirection:'row', alignItems:'center', gap:16, marginBottom:4 },
  ring:   { position:'absolute', width:86, height:86, borderRadius:43, borderWidth:1.5, borderColor:C.ring, top:8, left:8 },
  circle: { width:72, height:72, borderRadius:36, borderWidth:1.5, borderColor:C.border, alignItems:'center', justifyContent:'center', backgroundColor:C.navyMid },
  num:    { color:C.white, fontSize:18, fontWeight:'900', letterSpacing:-0.8 },
  lbl:    { color:C.muted, fontSize:7, fontWeight:'800', letterSpacing:2, marginTop:-2 },
});

const IBadge = memo(({ b }: { b:Badge }) => {
  const [open, setOpen] = useState(false), sc = useRef(new Animated.Value(1)).current;
  const press = () => { Animated.sequence([Animated.spring(sc, { toValue:0.88, tension:300, friction:7, useNativeDriver:true }), Animated.spring(sc, { toValue:1, tension:200, friction:8, useNativeDriver:true })]).start(); setOpen(v => !v); };
  return (
    <Animated.View style={{ transform:[{ scale:sc }] }}>
      <TouchableOpacity onPress={press} activeOpacity={0.85} style={[ib.w, b.earned && ib.e]}>
        <View style={[ib.ic, b.earned && ib.eo]}><Ionicons name={b.icon} size={16} color={b.earned ? C.white : C.muted} /></View>
        <Text style={[ib.l, b.earned && { color:C.white }]} numberOfLines={2}>{b.label}</Text>
        {b.earned && <Text style={{ color:C.gold, fontSize:8, fontWeight:'800' }}>+{b.pts}pts</Text>}
        {!b.earned && <View style={{ position:'absolute', top:7, right:7 }}><Ionicons name="lock-closed" size={7} color={C.muted} /></View>}
      </TouchableOpacity>
    </Animated.View>
  );
});
IBadge.displayName = 'IBadge';
const ib = StyleSheet.create({
  w:  { alignItems:'center', gap:5, padding:11, borderRadius:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, width:86, opacity:0.55 },
  e:  { opacity:1, borderColor:C.borderHi, backgroundColor:C.subtle },
  ic: { width:36, height:36, borderRadius:18, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  eo: { borderColor:C.borderHi },
  l:  { color:C.muted, fontSize:9, fontWeight:'600', textAlign:'center', lineHeight:12 },
});

const MissionCard = memo(({ m }: { m:Mission }) => {
  const pct = m.target > 0 ? Math.min(1, m.progress / m.target) : 0;
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(prog, { toValue:pct, duration:900, useNativeDriver:false }).start(); }, [pct]);
  return (
    <View style={[mc.w, m.completed && mc.done]}>
      <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={{ flexDirection:'row', alignItems:'flex-start', gap:11, padding:13 }}>
        <View style={[mc.ic, m.completed && mc.icDone]}><Ionicons name={m.completed ? 'checkmark-circle' : m.icon} size={18} color={m.completed ? C.white : C.mid} /></View>
        <View style={{ flex:1, gap:4 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <Text style={{ color:m.completed ? C.white : C.offWhite, fontSize:12, fontWeight:'700', flex:1 }} numberOfLines={1}>{m.title}</Text>
            {m.completed && <View style={{ paddingHorizontal:6, paddingVertical:2, borderRadius:7, backgroundColor:C.subtle, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi }}><Text style={{ color:C.white, fontSize:7, fontWeight:'800', letterSpacing:0.4 }}>ACCOMPLI</Text></View>}
          </View>
          <Text style={{ color:C.muted, fontSize:10, lineHeight:14 }}>{m.desc}</Text>
          <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
            <View style={{ flex:1, height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' }}>
              <Animated.View style={{ height:'100%', borderRadius:2, backgroundColor:m.completed ? C.white : C.subtle, width:prog.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }} />
            </View>
            <Text style={{ color:m.completed ? C.white : C.muted, fontSize:9, fontWeight:'700' }}>{m.progress}/{m.target}</Text>
          </View>
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}><Ionicons name="gift-outline" size={8} color={C.muted} /><Text style={{ color:C.muted, fontSize:9 }}>{m.reward}</Text></View>
        </View>
      </View>
    </View>
  );
});
MissionCard.displayName = 'MissionCard';
const mc = StyleSheet.create({
  w:     { marginHorizontal:H_PAD, marginBottom:8, borderRadius:14, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  done:  { borderColor:C.borderHi },
  ic:    { width:40, height:40, borderRadius:11, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' },
  icDone:{ backgroundColor:C.subtle, borderColor:C.borderHi },
});

// Accordion + GenreBar + RatingRow (inchangés visuellement)
const Accordion = memo(function Accordion({ icon, title, count, badge, defaultOpen=false, children }: { icon:keyof typeof Ionicons.glyphMap; title:string; count?:number; badge?:string; defaultOpen?:boolean; children:React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen), rot = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const toggle = () => { Animated.spring(rot, { toValue:open?0:1, tension:80, friction:10, useNativeDriver:true }).start(); setOpen(!open); };
  return (
    <View style={{ marginHorizontal:H_PAD, marginBottom:8, borderRadius:14, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:open?C.borderHi:C.border, backgroundColor:C.navyLow }}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.80} style={{ flexDirection:'row', alignItems:'center', gap:11, padding:15 }}>
        <View style={{ width:34, height:34, borderRadius:11, backgroundColor:open?C.subtle:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:open?C.borderHi:C.border, alignItems:'center', justifyContent:'center' }}><Ionicons name={icon} size={15} color={open?C.white:C.mid} /></View>
        <Text style={{ color:open?C.white:C.offWhite, fontSize:13, fontWeight:'700', flex:1, letterSpacing:-0.2 }}>{title}</Text>
        {badge && <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:18, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint }}><Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{badge}</Text></View>}
        {count != null && <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }}><Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{count}</Text></View>}
        <Animated.View style={{ transform:[{ rotate:rot.interpolate({ inputRange:[0,1], outputRange:['0deg','90deg'] }) }] }}><Ionicons name="chevron-forward" size={14} color={C.muted} /></Animated.View>
      </TouchableOpacity>
      {open && <View style={{ borderTopWidth:StyleSheet.hairlineWidth, borderTopColor:C.border, paddingHorizontal:14, paddingTop:14, paddingBottom:16, gap:10 }}>{children}</View>}
    </View>
  );
});
Accordion.displayName = 'Accordion';

const GenreBar = memo(({ genre, count, total }: { genre:string; count:number; total:number }) => {
  const pct = total > 0 ? count / total : 0, prog = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(prog, { toValue:pct, duration:800, useNativeDriver:false }).start(); }, [pct]);
  const icon = GENRE_ICONS[genre] ?? 'film-outline';
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
      <Ionicons name={icon} size={12} color={C.muted} />
      <Text style={{ width:110, color:C.mid, fontSize:11, fontWeight:'600' }}>{genre}</Text>
      <View style={{ flex:1, height:4, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' }}>
        <Animated.View style={{ height:'100%', borderRadius:2, backgroundColor:C.subtle, width:prog.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }} />
      </View>
      <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', width:20, textAlign:'right' }}>{count}</Text>
    </View>
  );
});
GenreBar.displayName = 'GenreBar';

const StarRatingRow = memo(({ rating, count, max }: { rating:number; count:number; max:number }) => {
  const pct = max > 0 ? count / max : 0, prog = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(prog, { toValue:pct, duration:700, useNativeDriver:false }).start(); }, [pct]);
  return (
    <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
      <View style={{ flexDirection:'row', gap:1 }}>{[1,2,3,4,5].map(s => <Ionicons key={s} name={s<=rating?'star':'star-outline'} size={9} color={s<=rating?C.gold:C.muted} />)}</View>
      <View style={{ flex:1, height:4, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' }}>
        <Animated.View style={{ height:'100%', borderRadius:2, backgroundColor:C.goldDim, borderWidth:0.5, borderColor:C.gold, width:prog.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }) }} />
      </View>
      <Text style={{ color:C.muted, fontSize:10, fontWeight:'700', width:18, textAlign:'right' }}>{count}</Text>
    </View>
  );
});
StarRatingRow.displayName = 'StarRatingRow';

const SkeletonSection = memo(() => (
  <View>
    <View style={{ flexDirection:'row', alignItems:'center', gap:8, paddingHorizontal:H_PAD, paddingTop:20, paddingBottom:12 }}>
      <Shimmer w={24} h={24} r={8} /><Shimmer w={120} h={11} r={6} />
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:H_PAD, gap:10 }}>
      {[0,1,2,3].map(i => <Shimmer key={i} w={CARD_W} h={CARD_H} r={12} />)}
    </ScrollView>
  </View>
));
SkeletonSection.displayName = 'SkeletonSection';

// ─────────────────────────────────────────────────────────────────────────────
// ★★★  SCREEN PRINCIPAL  ★★★
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────────────────────
  const [uid,          setUid]         = useState<string|null>(null);
  const [profile,      setProfile]     = useState<ProfileData>(EMPTY_PROFILE);
  const [reels,        setReels]       = useState<UserReel[]>([]);
  const [reviews,      setReviews]     = useState<ReviewItem[]>([]);
  const [favWorks,     setFavW]        = useState<Work[]>([]);
  const [watched,      setWatched]     = useState<Work[]>([]);
  const [recs,         setRecs]        = useState<Work[]>([]);
  const [loading,      setLoading]     = useState(true);
  const [refreshing,   setRef]         = useState(false);
  const [fetchError,   setFErr]        = useState(false);
  const [activeTab,    setTab]         = useState<GridTab>(0);
  const [modal,        setModal]       = useState<ModalType|null>(null);
  // ★ Realtime
  const [unreadNotifs, setUnread]      = useState(0);
  const [streak,       setStreak]      = useState(0);

  const { score, level, badges, missions } = useGamification(uid);

  // ── ★ Init session anon — fix uid jamais setté ────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data:{ session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;

      if (!isUUID(userId)) {
        const { data } = await supabase.auth.signInAnonymously();
        userId = data.session?.user?.id;
      }
      if (!mounted || !isUUID(userId)) return;
      setUid(userId);
      loadAll(userId);
      loadUnread(userId);
      loadStreak(userId);
    };
    init();

    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_, sess) => {
      const id = sess?.user?.id;
      if (mounted && isUUID(id)) setUid(id);
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── ★ Realtime — ID unique par montage, évite "cannot add .on() after subscribe()" ─
  const rtChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const rtMountId    = useRef(Date.now()); // unique par instance de composant

  useEffect(() => {
    if (!isUUID(uid)) return;

    // Cleanup strict avant création
    if (rtChannelRef.current) {
      supabase.removeChannel(rtChannelRef.current);
      rtChannelRef.current = null;
    }

    // Nom unique = pas de collision avec un channel identique encore subscribed
    const chName = `prt_${rtMountId.current}_${uid}`;

    rtChannelRef.current = supabase
      .channel(chName)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${uid}`,
      }, () => setUnread(n => n + 1))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'critiques',
        filter: `user_id=eq.${uid}`,
      }, (payload: any) => {
        const row = payload.new;
        setReviews(prev => prev.map(r =>
          r.id === String(row.id) ? { ...r, likes: Number(row.likes_count ?? 0) } : r,
        ));
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'reels',
        filter: `user_id=eq.${uid}`,
      }, (payload: any) => {
        const row = payload.new;
        setReels(prev => prev.map(r => r.id === String(row.id) ? mapReel(row) : r));
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'user_history',
        filter: `user_id=eq.${uid}`,
      }, () => {
        if (isUUID(uid)) loadAll(uid);
      })
      .subscribe();

    return () => {
      if (rtChannelRef.current) {
        supabase.removeChannel(rtChannelRef.current);
        rtChannelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // ── Helpers secondaires ──────────────────────────────────────────────────
  const loadUnread = useCallback(async (userId: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count:'exact', head:true })
      .eq('user_id', userId)
      .eq('read', false);
    setUnread(count ?? 0);
  }, []);

  const loadStreak = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_history')
      .select('watched_at')
      .eq('user_id', userId)
      .order('watched_at', { ascending:false })
      .limit(30);
    if (!data?.length) return;
    let s = 1;
    for (let i = 1; i < data.length; i++) {
      const gap = new Date(data[i-1].watched_at).getTime() - new Date(data[i].watched_at).getTime();
      if (gap <= 86400000 * 2) s++; else break;
    }
    setStreak(s);
  }, []);

  // ── ★ loadAll ultra-optimisé ─────────────────────────────────────────────
  const loadAll = useCallback(async (userId: string) => {
    if (!isUUID(userId)) return;
    setLoading(true); setFErr(false);

    try {
      // ── Phase 1 : 5 requêtes parallèles (données user) ──────────────────
      const [profR, reelsR, critR, favR, seenR] = await Promise.all([
        supabase.from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),

        supabase.from('reels')
          .select('id,video_url,thumbnail_url,title,genre,duration,status,likes_count,views_count,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending:false }),

        // ★ Table publique critiques (champs actifs + legacy)
        supabase.from('critiques')
          .select('id,user_id,reel_id,film_title,title,titre,content,contenu,rating,note,likes_count,tags,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending:false }),

        // ★ user_favorites — work_id
        supabase.from('user_favorites')
          .select('work_id')
          .eq('user_id', userId),

        // ★ user_history — work_id (bigint), watched_at
        supabase.from('user_history')
          .select('work_id,watched_at')
          .eq('user_id', userId)
          .order('watched_at', { ascending:false }),
      ]);

      // Hydrate
      if (profR.data) setProfile(mapProfile(profR.data));
      setReels((reelsR.data ?? []).map(mapReel));

      const critData = critR.data ?? [];
      setReviews(critData.map(mapReview).sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0)));

      // IDs normalisés
      const favIds  = [...new Set((favR.data ?? []).map((r: any) => r.work_id).filter(Boolean))] as number[];
      const seenRaw = seenR.data ?? [];
      const seenIds = [...new Set(seenRaw.map((r: any) => r.work_id).filter(Boolean))] as number[];
      const allIds  = [...new Set([...favIds, ...seenIds])];

      // ── Phase 2 : fetch works en parallèle ──────────────────────────────
      const [favD, seenD] = await Promise.all([
        favIds.length
          ? supabase.from('works').select(WORK_COLS).in('id', favIds)
          : Promise.resolve({ data:[] as any[] }),
        seenIds.length
          ? supabase.from('works').select(WORK_COLS).in('id', seenIds)
          : Promise.resolve({ data:[] as any[] }),
      ]);

      const favWks  = (favD.data ?? []).map(mapWork);
      const seenWks = (seenD.data ?? []).map(mapWork);
      setFavW(favWks);
      setWatched(seenWks);

      // ── Phase 3 : algorithme de recommandation personnalisé ─────────────
      // Pondération :
      //   Favori          → genre +3, catégorie +1.5
      //   Vu (noté)       → genre +(rating/5)*2
      //   Vu (non noté)   → genre +1
      //   Critique ≥ 3    → genre +(rating/5)*2  (signal positif uniquement)
      const genreW: Record<string,number> = {};
      // user_history n'a pas de rating → chaque film vu = +1 (signal neutre de visionnage)
      const seenSet = new Set(seenRaw.map((r: any) => String(r.work_id)));

      favWks.forEach(w => {
        if (w.genre)    genreW[w.genre]    = (genreW[w.genre]    ?? 0) + 3;
        if (w.category) genreW[w.category] = (genreW[w.category] ?? 0) + 1.5;
      });
      seenWks.forEach(w => {
        // Pas de rating dans user_history → +1 fixe
        if (w.genre)    genreW[w.genre]    = (genreW[w.genre]    ?? 0) + 1;
        if (w.category) genreW[w.category] = (genreW[w.category] ?? 0) + 0.5;
      });
      // Critiques ≥ 3 → signal genre via film_title (pas de genre dans critiques)
      critData.forEach((c: any) => {
        const r = Number(c.rating ?? c.note ?? 0);
        if (r < 3) return;
        // Futur enrichissement : JOIN works via reel_id pour récupérer le genre
      });

      const topGenres = Object.entries(genreW)
        .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g]) => g);

      if (topGenres.length) {
        const exclude = allIds.slice(0, 150);
        let q = supabase.from('works').select(WORK_COLS)
          .in('genre', topGenres).order('likes', { ascending:false }).limit(30);
        if (exclude.length) q = (q as any).not('id', 'in', `(${exclude.join(',')})`);
        const { data: recData } = await q;
        if (recData?.length) {
          const maxL = Math.max(1, ...recData.map((w: any) => w.likes ?? 0));
          setRecs(recData
            .map((w: any) => ({ ...w, _score:(genreW[w.genre] ?? 0) * 10 + ((w.likes ?? 0) / maxL) * 5 }))
            .sort((a: any, b: any) => b._score - a._score)
            .slice(0, 12)
            .map(mapWork),
          );
        }
      }

    } catch (e) {
      console.error('[profile] loadAll:', e);
      setFErr(true);
    } finally {
      setLoading(false);
      setRef(false);
    }
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────
  const hotId       = useMemo(() => reels.length < 2 ? null : [...reels].sort((a,b) => momentum(b)-momentum(a))[0]?.id ?? null, [reels]);
  const reelsByCat  = useMemo(() => {
    const courts:UserReel[]=[], moyens:UserReel[]=[], series:UserReel[]=[];
    reels.forEach(r => { if (!r.duration||r.duration<=1800) courts.push(r); else if(r.duration<=5400) moyens.push(r); else series.push(r); });
    return { courts, moyens, series };
  }, [reels]);
  const genreStats  = useMemo(() => { const m:Record<string,number>={}; watched.forEach(w => { if(w.genre) m[w.genre]=(m[w.genre]??0)+1; }); return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,8); }, [watched]);
  const maxGenre    = useMemo(() => Math.max(1,...genreStats.map(g=>g[1])), [genreStats]);
  const ratingDist  = useMemo(() => { const d:Record<number,number>={1:0,2:0,3:0,4:0,5:0}; reviews.forEach(r=>{const s=Math.round(r.rating);if(s>=1&&s<=5)d[s]++;}); return d; }, [reviews]);
  const maxRating   = useMemo(() => Math.max(1,...Object.values(ratingDist)), [ratingDist]);
  const avgRating   = useMemo(() => reviews.length ? (reviews.reduce((s,r)=>s+r.rating,0)/reviews.length).toFixed(1) : '—', [reviews]);

  const nav = {
    notifs:   () => { setUnread(0); router.push('/notifications' as any); },
    settings: () => router.push('/settings' as any),
    edit:     () => router.push('/edit' as any),
    admin:    () => router.push('/backoffice/universe-admin' as any),
  };

  const ErrorState = () => (
    <View style={{ alignItems:'center', paddingVertical:40, gap:12, paddingHorizontal:H_PAD }}>
      <View style={{ width:60, height:60, borderRadius:30, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' }}>
        <Ionicons name="cloud-offline-outline" size={28} color={C.muted} />
      </View>
      <Text style={{ color:C.muted, fontSize:13, textAlign:'center' }}>Impossible de charger les données</Text>
      <TouchableOpacity style={{ paddingHorizontal:20, paddingVertical:10, borderRadius:13, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }} onPress={() => isUUID(uid) && loadAll(uid!)}>
        <Text style={{ color:C.white, fontSize:13, fontWeight:'700' }}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Tab Films ───────────────────────────────────────────────────────────
  const renderFilms = () => {
    if (loading) return <View><SkeletonSection /><SkeletonSection /><SkeletonSection /></View>;
    if (fetchError) return <ErrorState />;
    return (
      <View>
        <SecHead icon="heart-outline" label="Œuvres favorites" count={favWorks.length} onMore={favWorks.length>0?()=>setModal('favorites'):undefined}/>
        {!favWorks.length ? <Empty icon="heart-outline" text="Aucun favori" sub="Sauvegardez des films depuis le catalogue" /> : <HRow c={favWorks.map((f,i) => <PortraitCard key={f.id} item={f} rank={i+1} />)} />}
        <Div/>
        <SecHead icon="create-outline" label="Mes critiques" count={reviews.length} onMore={reviews.length>0?()=>setModal('reviews'):undefined}/>
        {!reviews.length ? <Empty icon="chatbubble-outline" text="Aucune critique" /> : <HRow c={reviews.map((r,i) => <CritCard key={r.id} r={r} rank={i+1} onPress={() => router.push(`/review/${r.id}` as any)} />)} />}
        <Div/>
        <SecHead icon="eye-outline" label="Œuvres visionnées" count={watched.length} onMore={watched.length>0?()=>setModal('watched'):undefined}/>
        {!watched.length ? <Empty icon="film-outline" text="Aucun visionnage" /> : <HRow c={watched.map((f,i) => <PortraitCard key={f.id} item={f} rank={i+1} />)} />}
        <Div/>
        <SecHead icon="shuffle-outline" label="Recommandés pour vous" onMore={recs.length>0?()=>setModal('recs'):undefined}/>
        {!recs.length ? <Empty icon="planet-outline" text="Regardez des films pour des recs personnalisées" /> : <HRow c={recs.map(f => <PortraitCard key={f.id} item={f} />)} />}
        <View style={{ height:110 }} />
      </View>
    );
  };

  // ─── Tab Cinéma ──────────────────────────────────────────────────────────
  const renderCinema = () => {
    if (loading) return <View><SkeletonSection /></View>;
    return (
      <View style={{ marginTop:16 }}>
        <Accordion icon="person-circle-outline" title="Identité cinématographique" defaultOpen badge={ROLE_LABELS[profile.role]??'Cinéaste'}>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:7 }}>
            {[ROLE_LABELS[profile.role]??'Cinéaste', ...profile.specialties].map((s,i) => (
              <View key={i} style={{ paddingHorizontal:11, paddingVertical:6, borderRadius:18, borderWidth:StyleSheet.hairlineWidth, borderColor:i===0?C.borderHi:C.border, backgroundColor:i===0?C.subtle:C.faint }}>
                <Text style={{ color:i===0?C.white:C.mid, fontSize:11, fontWeight:i===0?'700':'500' }}>{s}</Text>
              </View>
            ))}
          </View>
          {profile.location ? <View style={{ flexDirection:'row', alignItems:'center', gap:7, marginTop:4 }}><Ionicons name="location-outline" size={12} color={C.muted} /><Text style={{ color:C.muted, fontSize:12 }}>{profile.location}</Text></View> : null}
          {profile.equipment ? <View style={{ gap:4 }}><Text style={{ color:C.muted, fontSize:9, fontWeight:'800', letterSpacing:1, textTransform:'uppercase' }}>Équipement</Text><Text style={{ color:C.mid, fontSize:12, lineHeight:18 }}>{profile.equipment}</Text></View> : null}
        </Accordion>
        <Accordion icon="layers-outline" title="Genres explorés" count={genreStats.length}>
          {genreStats.length === 0 ? <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>Regardez des films pour voir vos genres préférés</Text> : genreStats.map(([genre,count]) => <GenreBar key={genre} genre={genre} count={count} total={maxGenre} />)}
        </Accordion>
        <Accordion icon="star-outline" title="Mes notes & avis" count={reviews.length}>
          {reviews.length === 0 ? <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>Aucune critique publiée</Text> : (
            <View style={{ gap:7 }}>
              {[5,4,3,2,1].map(s => <StarRatingRow key={s} rating={s} count={ratingDist[s]??0} max={maxRating} />)}
              <Text style={{ color:C.muted, fontSize:10, marginTop:4, textAlign:'center' }}>Note moyenne : {avgRating} / 5</Text>
            </View>
          )}
        </Accordion>
        <Accordion icon="trophy-outline" title="Palmarès & Festivals" count={profile.festivals.length}>
          {profile.festivals.length === 0 ? <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>Ajoutez vos festivals depuis "Modifier le profil"</Text>
            : profile.festivals.map((f,i) => (
              <View key={f} style={{ flexDirection:'row', alignItems:'center', gap:10, paddingVertical:8, borderBottomWidth:i<profile.festivals.length-1?StyleSheet.hairlineWidth:0, borderBottomColor:C.border }}>
                <View style={{ width:28, height:28, borderRadius:8, backgroundColor:C.goldDim, borderWidth:StyleSheet.hairlineWidth, borderColor:C.gold, alignItems:'center', justifyContent:'center' }}><Ionicons name="trophy-outline" size={13} color={C.gold} /></View>
                <Text style={{ color:C.offWhite, fontSize:13, fontWeight:'600', flex:1 }}>{f}</Text>
                <Text style={{ color:C.muted, fontSize:10 }}>#{i+1}</Text>
              </View>
            ))}
        </Accordion>
        {profile.notable_works.length > 0 && (
          <Accordion icon="film-outline" title="Œuvres notables" count={profile.notable_works.length}>
            {profile.notable_works.map((w:any,i:number) => (
              <TouchableOpacity key={w.id??i} style={{ flexDirection:'row', alignItems:'center', gap:12, paddingVertical:10, borderBottomWidth:i<profile.notable_works.length-1?StyleSheet.hairlineWidth:0, borderBottomColor:C.border }} onPress={() => w.url ? Linking.openURL(w.url).catch(()=>{}) : null} activeOpacity={0.80}>
                <View style={{ width:36, height:36, borderRadius:10, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' }}><Text style={{ color:C.mid, fontSize:11, fontWeight:'900' }}>{w.year?.slice(-2)??'—'}</Text></View>
                <View style={{ flex:1, gap:2 }}><Text style={{ color:C.white, fontSize:13, fontWeight:'700' }} numberOfLines={1}>{w.title||'Sans titre'}</Text><Text style={{ color:C.muted, fontSize:11 }}>{w.role||'—'}</Text></View>
                {w.url && <Ionicons name="open-outline" size={13} color={C.muted} />}
              </TouchableOpacity>
            ))}
          </Accordion>
        )}
        <Accordion icon="link-outline" title="Ouvert à collaborer">
          {profile.open_to.length === 0 ? <Text style={{ color:C.muted, fontSize:12, textAlign:'center', paddingVertical:8 }}>Précisez vos disponibilités dans "Modifier le profil"</Text>
            : <View style={{ flexDirection:'row', flexWrap:'wrap', gap:7 }}>{profile.open_to.map(col => (
              <View key={col} style={{ flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:6, borderRadius:18, borderWidth:StyleSheet.hairlineWidth, borderColor:C.blueDim, backgroundColor:'rgba(90,150,230,0.06)' }}>
                <Ionicons name="checkmark-circle-outline" size={11} color={C.blue} /><Text style={{ color:C.blue, fontSize:11, fontWeight:'600' }}>{col}</Text>
              </View>
            ))}</View>}
        </Accordion>
        <View style={{ height:110 }} />
      </View>
    );
  };

  // ─── Tab Créations ───────────────────────────────────────────────────────
  const renderCreations = () => {
    if (loading) return <View><SkeletonSection /></View>;
    if (!reels.length) return (
      <View style={{ paddingTop:50, paddingHorizontal:H_PAD }}>
        <Empty icon="videocam-outline" text="Aucune création" sub="Importez vos vidéos depuis l'onglet Créer" />
        <TouchableOpacity style={{ flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, marginTop:16, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow, paddingVertical:13 }} onPress={() => router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={14} color={C.mid} /><Text style={{ color:C.mid, fontSize:12.5, fontWeight:'700' }}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{ height:110 }} />
      </View>
    );
    const rejected = reels.filter(r => r.status === 'rejected').length;
    const secs = reels.every(r => r.duration == null)
      ? [{ key:'all', icon:'videocam-outline' as const, data:reels }]
      : [
          { key:'courts', icon:'videocam-outline' as const, data:reelsByCat.courts },
          { key:'moyens', icon:'tv-outline'       as const, data:reelsByCat.moyens },
          { key:'series', icon:'film-outline'     as const, data:reelsByCat.series },
        ].filter(s => s.data.length > 0);
    return (
      <View>
        {rejected > 0 && <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginHorizontal:H_PAD, marginBottom:10, paddingHorizontal:12, paddingVertical:9, borderRadius:10, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.navyLow }}><Ionicons name="alert-circle-outline" size={12} color={C.mid} /><Text style={{ color:C.mid, fontSize:11, flex:1 }}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''}</Text></View>}
        <SecHead icon="play-circle-outline" label="Toutes mes créations" count={reels.length} onMore={reels.length>0?()=>setModal('creations'):undefined}/>
        {secs.map((s,si) => <View key={s.key}><HRow pb={8} c={s.data.map(r => <ReelCard key={r.id} reel={r} isHot={r.id===hotId} />)} />{si < secs.length-1 && <Div />}</View>)}
        <View style={{ height:110 }} />
      </View>
    );
  };

  const tabs = [
    { icon:'grid-outline'         as const, label:'Films'    },
    { icon:'star-outline'         as const, label:'Cinéma'   },
    { icon:'play-circle-outline'  as const, label:'Créations'},

  ];

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar style="light" />
      <GalaxyBackground />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRef(true); if (isUUID(uid)) { loadAll(uid!); loadUnread(uid!); } }}
            tintColor={C.mid}
          />
        }
      >
        <SafeAreaView edges={['top']}>
          {/* Header complet */}
          <ProfileHeader
            profile={profile} uid={uid}
            level={level} score={score}

            filmCount={watched.length} critiqueCount={reviews.length} reelCount={reels.length}
            unreadNotifs={unreadNotifs} streak={streak}
            onEdit={nav.edit} onAdmin={nav.admin} onNotifs={nav.notifs} onSettings={nav.settings}
          />
                 </SafeAreaView>

        {/* Gamification */}
        <View style={{ marginTop:16, gap:12, marginBottom:4 }}>
          <View>
           
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal:H_PAD, gap:8 }}>
              {[...badges.filter(b=>b.earned), ...badges.filter(b=>!b.earned)].map(b => <IBadge key={b.id} b={b} />)}
            </ScrollView>
          </View>
      
        </View>

        {/* Tabs */}
        <View style={{ flexDirection:'row', borderTopWidth:StyleSheet.hairlineWidth, borderBottomWidth:StyleSheet.hairlineWidth, borderColor:C.border, marginTop:16 }}>
          {tabs.map(({ icon, label }, idx) => {
            const active = activeTab === idx;
            const badge  = idx === 1 ? reels.filter(r => r.status === 'pending').length : 0;
            return (
              <TouchableOpacity key={icon} style={{ flex:1, alignItems:'center', paddingVertical:10, gap:3, position:'relative' }} onPress={() => setTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active ? (icon.replace('-outline','') as any) : icon} size={17} color={active?C.white:C.muted} />
                <Text style={{ fontSize:8.5, fontWeight:'700', color:active?C.white:C.muted, letterSpacing:0.5, textTransform:'uppercase' }}>{label}</Text>
                {active && <View style={{ position:'absolute', top:0, left:'20%', right:'20%', height:2, backgroundColor:C.white, borderBottomLeftRadius:2, borderBottomRightRadius:2 }} />}
                {badge > 0 && <View style={{ position:'absolute', top:6, right:10, minWidth:14, height:14, borderRadius:7, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center', paddingHorizontal:3 }}><Text style={{ color:C.white, fontSize:7, fontWeight:'900' }}>{badge}</Text></View>}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 0 && renderFilms()}
        {activeTab === 1 && renderCinema()}
        {activeTab === 2 && renderCreations()}
      </ScrollView>

      {/* Modales */}
      <SeeAllModal visible={modal==='favorites'} onClose={()=>setModal(null)} type="favorites" title="Œuvres favorites"   icon="heart-outline"        works={favWorks}   />
      <SeeAllModal visible={modal==='reviews'}   onClose={()=>setModal(null)} type="reviews"   title="Mes critiques"      icon="create-outline"       reviews={reviews}  />
      <SeeAllModal visible={modal==='watched'}   onClose={()=>setModal(null)} type="watched"   title="Œuvres visionnées"  icon="eye-outline"          works={watched}    />
      <SeeAllModal visible={modal==='recs'}      onClose={()=>setModal(null)} type="recs"      title="Recommandations"    icon="shuffle-outline"      works={recs}       />
      <SeeAllModal visible={modal==='creations'} onClose={()=>setModal(null)} type="creations" title="Mes créations"      icon="play-circle-outline"  reels={reels}  hotReelId={hotId} />
    </View>
  );
}