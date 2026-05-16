import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient }            from 'expo-linear-gradient';
import { SafeAreaView }              from 'react-native-safe-area-context';
import { BlurView }                  from 'expo-blur';
import { Ionicons }                  from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar }                 from 'expo-status-bar';

import { useAuth }                   from '../../contexts/AuthContext';
import api                           from '../../services/api';
import GalaxyBackground              from '../../components/social/GalaxyBackground';
import { ImageWithFallback }         from '../../components/profile/ImageWithFallback';
import { ReelCard }                  from '../../components/profile/Card';
import {
  EmptyState, HScrollRow,
  SectionHeader, StatColumn,
} from '../../components/profile/Section';
import {
  CARD_GAP, CARD_H, CARD_W, G,
  HEADER_SCROLL_DISTANCE, H_PADDING,
  NUM_ITEM_W, NUM_OVERLAP, NUM_W,
} from '../../components/profile/theme';
import {
  DEFAULT_REVIEWS, DEFAULT_SEEN,
  type FilmItem, type ReviewItem,
} from '../../components/profile/data';
import { resolveWorkIdByTitleYear, supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Logo Universe (watermark CritiqueCards)
// ─────────────────────────────────────────────────────────────────────────────
const LOGO = require('@/assets/images/logouniverse2.png');

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null; director:string|null;
}

interface UserReel {
  id:string; video_url:string; title:string|null; genre:string|null;
  director:string|null; year:string|null; synopsis:string|null;
  duration:number|null; status:'pending'|'approved'|'rejected';
  rejection_category:string|null; rejection_reason:string|null;
  likes_count:number; views_count:number; created_at:string;
}

// ★ Données lues directement depuis public.profiles (sync avec edit.tsx)
interface ProfileData {
  display_name:  string;
  username:      string;
  bio:           string;
  role:          string;
  location:      string;
  avatar_url:    string;
  is_pro:        boolean;
  is_industry_contact: boolean;
  specialties:   string[];
  festivals:     string[];
  social_instagram: string;
  social_vimeo:     string;
  social_youtube:   string;
  social_imdb:      string;
  website:          string;
}

const PROFILE_EMPTY: ProfileData = {
  display_name:'', username:'', bio:'', role:'creator', location:'',
  avatar_url:'', is_pro:false, is_industry_contact:false,
  specialties:[], festivals:[],
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'', website:'',
};

type GridTab = 0 | 1 | 2;

const TAB_ICONS: Array<{ icon:keyof typeof Ionicons.glyphMap; label:string }> = [
  { icon:'grid-outline',         label:'Films'  },
  { icon:'play-circle-outline',  label:'Créas'  },
  { icon:'person-circle-outline',label:'Tags'   },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function resolveImage(id:number, image:string|null): string {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try {
    const { data } = supabase.storage.from('community-images').getPublicUrl(image);
    return data?.publicUrl ?? `https://picsum.photos/seed/work_${id}/400/600`;
  } catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
}

function fmtNumber(n:number): string {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n>=1_000)     return `${(n/1_000).toFixed(n>=10_000?0:1)}K`;
  return `${n}`;
}

function fmtDuration(sec:number|null): string {
  if (!sec) return '—';
  const m = Math.floor(sec/60);
  return m>0 ? `${m}m` : `${sec}s`;
}

function reelCategory(dur:number|null): 'courts'|'moyens'|'series' {
  if (!dur||dur<=1800) return 'courts';
  if (dur<=5400)       return 'moyens';
  return 'series';
}

const PROFILE_COLS = [
  'display_name','username','bio','role','location','avatar_url',
  'is_pro','is_industry_contact','specialties','festivals',
  'social_instagram','social_vimeo','social_youtube','social_imdb','website',
].join(',');

// ─────────────────────────────────────────────────────────────────────────────
// SHIMMER
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = memo(function Shimmer({w,h,r=8}:{w:number;h:number;r?:number}) {
  const op = useRef(new Animated.Value(0.22)).current;
  useEffect(()=>{
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op,{toValue:0.50,duration:850,useNativeDriver:true}),
      Animated.timing(op,{toValue:0.22,duration:850,useNativeDriver:true}),
    ]));
    loop.start();
    return ()=>loop.stop();
  },[op]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:'rgba(255,255,255,0.09)',opacity:op}}/>;
});

const SkeletonSection = memo(function SkeletonSection({accentColor=G.primary}:{accentColor?:string}) {
  return (
    <View>
      <View style={sk.header}>
        <View style={[sk.iconBox,{backgroundColor:`${accentColor}14`}]}/>
        <View style={sk.titleBar}/>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{paddingLeft:H_PADDING,paddingRight:H_PADDING,gap:CARD_GAP}}>
        {[0,1,2,3].map(i=>(
          <View key={i} style={{flexDirection:'row',alignItems:'flex-end',width:NUM_ITEM_W}}>
            <View style={sk.numCol}><View style={sk.ghostNum}/></View>
            <View style={[sk.ghostCard,{marginLeft:-NUM_OVERLAP}]}><Shimmer w={CARD_W} h={CARD_H} r={12}/></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});
const sk = StyleSheet.create({
  header:   {flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PADDING,paddingTop:22,paddingBottom:12},
  iconBox:  {width:26,height:26,borderRadius:9},
  titleBar: {height:12,width:120,borderRadius:6,backgroundColor:'rgba(255,255,255,0.06)'},
  numCol:   {width:NUM_W,height:CARD_H,justifyContent:'flex-start',paddingTop:6},
  ghostNum: {height:68,width:38,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:6,alignSelf:'flex-end'},
  ghostCard:{borderRadius:13,overflow:'hidden'},
});

// ─────────────────────────────────────────────────────────────────────────────
// PORTRAIT CARD
// ─────────────────────────────────────────────────────────────────────────────
const PortraitCard = memo(function PortraitCard({item,rank,noMargin}:{item:Work;rank?:number;noMargin?:boolean}) {
  const router = useRouter();
  const uri = useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);
  const rankColor = rank===1?G.gold:rank===2?'#C0C0C0':rank===3?'#CD7F32':'rgba(255,255,255,0.40)';
  return (
    <TouchableOpacity style={{marginRight:noMargin?0:12}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{uri}} style={pc.img} resizeMode="cover"/>
        <LinearGradient colors={['transparent','rgba(2,8,16,0.86)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.38}} end={{x:0,y:1}}/>
        <View style={[pc.badge,{backgroundColor:item.is_original?'#1E4A7A':'#0D2240'}]}>
          <Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text>
        </View>
        {rank!=null&&<Text style={[pc.rankNum,{color:rankColor}]}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
            <Ionicons name="heart" size={9} color={G.gold}/>
            <Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc = StyleSheet.create({
  card:    {width:CARD_W,height:CARD_H,borderRadius:13,overflow:'hidden',backgroundColor:'#0D2240'},
  img:     {width:'100%' as any,height:'100%' as any},
  badge:   {position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:4},
  badgeTxt:{color:'#FFFFFF',fontSize:7,fontWeight:'800',letterSpacing:0.3},
  rankNum: {position:'absolute',bottom:30,right:5,fontSize:52,fontWeight:'900',lineHeight:52,letterSpacing:-4,opacity:0.9},
  meta:    {position:'absolute',bottom:8,left:8,right:8,gap:2},
  title:   {color:'#FFFFFF',fontSize:11,fontWeight:'700',lineHeight:14},
  stat:    {color:'rgba(255,255,255,0.6)',fontSize:9},
});

// ─────────────────────────────────────────────────────────────────────────────
// REEL USER CARD
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  pending:  {icon:'time-outline'          as const,color:'#F59E0B',bg:'rgba(245,158,11,0.18)',label:'En vérification'},
  approved: {icon:'checkmark-circle'      as const,color:'#22C55E',bg:'rgba(34,197,94,0.18)', label:'Validé'        },
  rejected: {icon:'close-circle-outline'  as const,color:'#EF4444',bg:'rgba(239,68,68,0.18)', label:'Non validé'    },
};

const UserReelCard = memo(function UserReelCard({reel}:{reel:UserReel}) {
  const router = useRouter();
  const cfg    = STATUS_CFG[reel.status] ?? STATUS_CFG.pending;
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={()=>router.push(`/reel/${reel.id}` as any)} activeOpacity={0.88}>
      <View style={rc.card}>
        <View style={rc.imgPlaceholder}/>
        <LinearGradient colors={['transparent','rgba(2,8,16,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.3}} end={{x:0,y:1}}/>
        <View style={rc.playBtn} pointerEvents="none">
          <Ionicons name="play-circle" size={32} color="rgba(255,255,255,0.75)"/>
        </View>
        <View style={[rc.statusBadge,{backgroundColor:cfg.bg,borderColor:`${cfg.color}40`}]}>
          <Ionicons name={cfg.icon} size={9} color={cfg.color}/>
          <Text style={[rc.statusTxt,{color:cfg.color}]}>{cfg.label}</Text>
        </View>
        <View style={rc.meta}>
          <Text style={rc.title} numberOfLines={2}>{reel.title??'Sans titre'}</Text>
          {reel.genre&&<Text style={rc.genre} numberOfLines={1}>{reel.genre}</Text>}
          <View style={rc.statsRow}>
            {reel.duration!=null&&<View style={rc.stat}><Ionicons name="time-outline" size={9} color="rgba(255,255,255,0.45)"/><Text style={rc.statTxt}>{fmtDuration(reel.duration)}</Text></View>}
            <View style={rc.stat}><Ionicons name="eye-outline" size={9} color="rgba(255,255,255,0.45)"/><Text style={rc.statTxt}>{reel.views_count}</Text></View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const rc = StyleSheet.create({
  card:         {width:180,height:240,borderRadius:16,overflow:'hidden',backgroundColor:'#0D1A2A'},
  imgPlaceholder:{...StyleSheet.absoluteFillObject as any,backgroundColor:'#0D1A2A'},
  playBtn:      {position:'absolute',top:'50%',left:'50%',marginTop:-22,marginLeft:-16},
  statusBadge:  {position:'absolute',top:9,left:9,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:10,borderWidth:1},
  statusTxt:    {fontSize:8,fontWeight:'800',letterSpacing:0.3},
  meta:         {position:'absolute',bottom:0,left:0,right:0,padding:12,gap:3},
  title:        {color:'#FFFFFF',fontSize:11,fontWeight:'800',lineHeight:14},
  genre:        {color:'rgba(255,255,255,0.45)',fontSize:9,fontStyle:'italic'},
  statsRow:     {flexDirection:'row',gap:10,marginTop:4},
  stat:         {flexDirection:'row',alignItems:'center',gap:3},
  statTxt:      {color:'rgba(255,255,255,0.50)',fontSize:9,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CRITIQUE CARD
// ─────────────────────────────────────────────────────────────────────────────
const STAR_POS = [
  {top:8,left:18,op:0.55,r:1.8},{top:14,left:88,op:0.35,r:1.2},{top:22,left:155,op:0.60,r:2.0},
  {top:38,left:42,op:0.28,r:1.0},{top:48,left:190,op:0.45,r:1.5},{top:58,left:72,op:0.50,r:1.6},
  {top:70,left:130,op:0.32,r:1.0},{top:80,left:8,op:0.40,r:1.4},{top:92,left:200,op:0.55,r:1.8},
];
const ProfileCritiqueCard = memo(function ProfileCritiqueCard({review,rank,onPress}:{review:ReviewItem;rank:number;onPress:()=>void}) {
  const stars = Math.round(review.rating??0);
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={onPress} activeOpacity={0.88}>
      <View style={cc.card}>
        <LinearGradient colors={['#0D0822','#0A1628','#060C1A']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>
        {STAR_POS.map((s,i)=><View key={i} style={[cc.star,{top:s.top,left:s.left,opacity:s.op,width:s.r,height:s.r,borderRadius:s.r/2}]}/>)}
        <Image source={LOGO} style={cc.logo} resizeMode="contain"/>
        <View style={cc.rankBadge}><Text style={cc.rankTxt}>#{rank}</Text></View>
        <View style={cc.body}>
          <Text style={cc.filmTitle} numberOfLines={1}>{review.film?.title??'—'}</Text>
          <View style={cc.stars}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={10} color={G.gold}/>)}</View>
          <Text style={cc.excerpt} numberOfLines={3}>{review.content||'Aucun contenu'}</Text>
        </View>
        <View style={cc.border} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});
const cc = StyleSheet.create({
  card:     {width:220,height:148,borderRadius:16,overflow:'hidden',position:'relative'},
  star:     {position:'absolute',backgroundColor:'#FFFFFF'},
  logo:     {position:'absolute',right:8,bottom:8,width:52,height:52,opacity:0.10},
  rankBadge:{position:'absolute',top:10,left:10,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(0,19,127,0.28)',borderWidth:1,borderColor:'rgba(0,19,127,0.28)'},
  rankTxt:  {color:'#fff',fontSize:9,fontWeight:'800'},
  body:     {position:'absolute',bottom:0,left:0,right:0,padding:12,gap:4},
  filmTitle:{color:'#FFFFFF',fontSize:13,fontWeight:'800',letterSpacing:-0.2},
  stars:    {flexDirection:'row',gap:2},
  excerpt:  {color:'rgba(255,255,255,0.48)',fontSize:10,lineHeight:14},
  border:   {...StyleSheet.absoluteFillObject,borderRadius:16,borderWidth:1,borderColor:'rgba(124,94,252,0.20)'},
});

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router   = useRouter();
  const { user } = useAuth();
  const scrollY  = useRef(new Animated.Value(0)).current;

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useState<GridTab>(0);
  const [reviews,         setReviews]         = useState<ReviewItem[]>([]);
  const [seenFilms,       setSeenFilms]       = useState<FilmItem[]>([]);
  const [favWorks,        setFavWorks]        = useState<Work[]>([]);
  const [watchedWorks,    setWatchedWorks]    = useState<Work[]>([]);
  const [recommendations, setRecommendations] = useState<Work[]>([]);
  const [userReels,       setUserReels]       = useState<UserReel[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [refreshing,      setRefreshing]      = useState(false);
  const [userId,          setUserId]          = useState('');

  // ★ Données du profil lues depuis public.profiles (sync avec edit.tsx)
  const [profileData, setProfileData] = useState<ProfileData>(PROFILE_EMPTY);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ FETCH PROFILE depuis public.profiles
  // ─────────────────────────────────────────────────────────────────────────
  const loadProfileData = useCallback(async (uid:string) => {
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .eq('id', uid)
      .maybeSingle();
    if (data) setProfileData(data as ProfileData);
  }, []);

  // ── Init userId ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data:{ user:u } }) => {
      if (u?.id) setUserId(u.id);
    });
  }, [user]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ REALTIME — écoute les UPDATE de public.profiles
  //   Quand edit.tsx sauvegarde → profile.tsx se met à jour INSTANTANÉMENT
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    // Chargement initial du profil
    loadProfileData(userId);

    const chName = `profile_display_${userId}_${Date.now()}`;
    const ch = supabase.channel(chName)
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'profiles' },
        ({ new: row }) => {
          // Met à jour uniquement si c'est notre profil
          if ((row as any).id === userId) {
            setProfileData(prev => ({ ...prev, ...(row as Partial<ProfileData>) }));
          }
        })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [userId, loadProfileData]);

  // ── Fetch works / critiques / reels ───────────────────────────────────────
  const fetchFavWorks = useCallback(async (uid:string) => {
    const { data } = await supabase.from('user_favorites').select('works(*)').eq('user_id',uid);
    const items = (data?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setFavWorks(items);
    return items;
  }, []);

  const fetchWatchedWorks = useCallback(async (uid:string) => {
    const { data } = await supabase.from('user_history').select('works(*)').eq('user_id',uid);
    const items = (data?.map((d:any)=>d.works).filter(Boolean)??[]) as Work[];
    setWatchedWorks(items);
    return items;
  }, []);

  const fetchRecommendations = useCallback(async (favs:Work[], watched:Work[]) => {
    const combined = [...favs,...watched];
    if (!combined.length) return;
    const genres = [...new Set(combined.map(w=>w.genre))];
    const excludeIds = combined.map(w=>w.id);
    const { data } = await supabase.from('works')
      .select('id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director')
      .in('genre',genres).order('likes',{ascending:false}).limit(15);
    setRecommendations(((data??[]) as Work[]).filter(w=>!excludeIds.includes(w.id)));
  }, []);

  const loadReviews = useCallback(async (uid:string) => {
    const { data, error } = await supabase.from('critiques')
      .select('id,user_id,reel_id,film_title,title,content,rating,likes_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    if (error) { setReviews([]); return; }
    setReviews((data??[]).map((c:any)=>{
      const filmTitle = String(c.film_title??c.title??'—');
      return {
        id:String(c.id), filmId:String(c.reel_id??c.id),
        content:String(c.content??''),
        rating:c.rating==null?0:Number(c.rating),
        likes:c.likes_count??0,
        date:c.created_at?new Date(c.created_at).toISOString():new Date().toISOString(),
        film:{id:String(c.reel_id??c.id),title:filmTitle,posterUrl:`https://picsum.photos/seed/crit_${c.id}/400/600`,genre:'—',type:'film' as const},
      } satisfies ReviewItem;
    }));
  }, []);

  const loadSeen = useCallback(async (uid:string) => {
    // Utilisation de la nouvelle méthode getSeenFilms depuis api.works
    const seen = await api.works.getSeenFilms(uid).catch(() => null);
    setSeenFilms(seen?.length ? seen : DEFAULT_SEEN);
  }, []);

  const loadUserReels = useCallback(async (uid:string) => {
    const { data } = await supabase.from('reels')
      .select('id,video_url,title,genre,director,year,synopsis,duration,status,rejection_category,rejection_reason,likes_count,views_count,created_at')
      .eq('user_id',uid).order('created_at',{ascending:false});
    setUserReels((data??[]) as UserReel[]);
  }, []);

  const loadData = useCallback(async () => {
    const uid = userId || (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return;
    setLoading(true);
    try {
      const [favs, watched] = await Promise.all([
        fetchFavWorks(uid),
        fetchWatchedWorks(uid),
        loadReviews(uid),
        loadSeen(uid),
        loadUserReels(uid),
        loadProfileData(uid),
      ]);
      fetchRecommendations(favs, watched);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, fetchFavWorks, fetchWatchedWorks, loadReviews, loadSeen, loadUserReels, loadProfileData, fetchRecommendations]);

  useEffect(() => { if (userId) loadData(); }, [userId]);

  // ★ useFocusEffect — reload au retour depuis edit.tsx
  useFocusEffect(useCallback(() => {
    if (userId) loadData();
  }, [userId, loadData]));

  // ── Realtime tables autres ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const ts = Date.now();
    const chFav = supabase.channel(`pf_fav_${ts}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_favorites'},
        ()=>{fetchFavWorks(userId).then(favs=>fetchRecommendations(favs,watchedWorks));})
      .subscribe();
    const chHist = supabase.channel(`pf_hist_${ts}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'user_history'},
        ()=>{fetchWatchedWorks(userId).then(watched=>fetchRecommendations(favWorks,watched));})
      .subscribe();
    const chCrit = supabase.channel(`pf_crit_${ts}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'critiques'},
        ()=>{loadReviews(userId);})
      .subscribe();
    const chReels = supabase.channel(`pf_reels_${ts}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reels'},
        ({new:row})=>{const r=row as UserReel;if(r.status!==undefined)setUserReels(prev=>prev.some(x=>x.id===r.id)?prev:[r,...prev]);})
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reels'},
        ({new:row})=>{const r=row as UserReel;setUserReels(prev=>prev.map(x=>x.id===r.id?r:x));})
      .subscribe();
    return ()=>{
      supabase.removeChannel(chFav);
      supabase.removeChannel(chHist);
      supabase.removeChannel(chCrit);
      supabase.removeChannel(chReels);
    };
  }, [userId, fetchFavWorks, fetchWatchedWorks, loadReviews, favWorks, watchedWorks, fetchRecommendations]);

  // ── Dérivés ───────────────────────────────────────────────────────────────
  const sortedReviews = useMemo(
    ()=>[...reviews].sort((a,b)=>(b.likes??0)-(a.likes??0)),
    [reviews]
  );

  const reelsByCategory = useMemo(()=>{
    const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[];
    userReels.forEach(r=>{
      const cat=reelCategory(r.duration);
      if(cat==='courts')courts.push(r);
      else if(cat==='moyens')moyens.push(r);
      else series.push(r);
    });
    return {courts,moyens,series};
  },[userReels]);

  const fmt = useCallback((n:number)=>fmtNumber(n),[]);

  // ★ Données affichées : préfère profileData (sync realtime), fallback sur user (auth)
  const displayName = profileData.display_name || user?.username || 'Utilisateur';
  const displayRole = profileData.role          || (user as any)?.role || 'creator';
  const avatarUri   = profileData.avatar_url    || user?.avatar_url || `https://i.pravatar.cc/150?u=${user?.id}`;
  const roleLabel   =
    displayRole==='director'  ? 'Réalisateur·rice'    :
    displayRole==='producer'  ? 'Producteur·rice'      :
    displayRole==='writer'    ? 'Scénariste'           :
    displayRole==='actor'     ? 'Acteur·rice'          :
    displayRole==='dp'        ? 'Directeur·rice photo' :
    displayRole==='editor'    ? 'Monteur·euse'         :
    displayRole==='critic'    ? 'Critique'             :
    'Créateur·rice';

  if (!user) return null;

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 0 — Films
  // ─────────────────────────────────────────────────────────────────────────
  function renderMainContent() {
    if (loading) {
      return (
        <View>
          <SkeletonSection accentColor={G.gold}/>
          <SkeletonSection accentColor={G.amber}/>
          <SkeletonSection accentColor={G.cyan}/>
          <View style={{height:80}}/>
        </View>
      );
    }

    return (
      <View>
        <SectionHeader icon="trophy" label="Œuvres favorites" subtitle="Tes œuvres préférées"
          count={favWorks.length} accentColor="#fff"
          onViewAll={()=>router.push('/profile/favorites' as any)}/>
        {favWorks.length===0
          ? <EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegarde tes films avec l'étoile"/>
          : <HScrollRow>{favWorks.map((film,idx)=><PortraitCard key={`fav-${film.id}`} item={film} rank={idx+1}/>)}</HScrollRow>
        }
        <View style={pg.divider}/>

        <SectionHeader icon="pencil" label="Critiques par œuvres" subtitle="Classées par popularité"
          accentColor="#fff" onViewAll={()=>router.push('/profile/reviews' as any)}/>
        {sortedReviews.length===0
          ? <EmptyState icon="chatbubble-outline" text="Aucune critique publiée"/>
          : <HScrollRow>{sortedReviews.map((rev,idx)=><ProfileCritiqueCard key={rev.id} review={rev} rank={idx+1} onPress={()=>router.push(`/review/${rev.id}` as any)}/>)}</HScrollRow>
        }
        <View style={pg.divider}/>

        <SectionHeader icon="eye" label="Œuvres visionnées" subtitle="Votre historique de visionnage"
          accentColor="#fff" onViewAll={()=>router.push('/profile/seen_films' as any)}/>
        {watchedWorks.length===0
          ? <EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marque des films comme vus"/>
          : <HScrollRow>{watchedWorks.map((film,idx)=><PortraitCard key={`seen-${film.id}`} item={film} rank={idx+1}/>)}</HScrollRow>
        }
        <View style={pg.divider}/>

        <SectionHeader icon="sparkles" label="Recommandés pour vous" subtitle="Basé sur vos goûts" accentColor="#fff"/>
        {recommendations.length===0
          ? <EmptyState icon="planet-outline" text="Aucune recommandation" subtext="Regardez plus de films pour améliorer l'algorithme"/>
          : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:16,gap:12}}>
              {recommendations.map(film=><PortraitCard key={`rec-${film.id}`} item={film}/>)}
            </ScrollView>
        }

        <View style={{height:110}}/>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — Créas
  // ─────────────────────────────────────────────────────────────────────────
  function renderReelsContent() {
    if (loading) return <View><SkeletonSection accentColor={G.primary}/><SkeletonSection accentColor={G.primary}/><View style={{height:80}}/></View>;

    if (userReels.length===0) {
      return (
        <View style={{paddingTop:60,paddingHorizontal:32}}>
          <EmptyState icon="videocam-outline" text="Aucune création"
            subtext="Importez vos vidéos depuis l'onglet Créer pour les voir ici."/>
          <TouchableOpacity style={pg.createBtn} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
            <LinearGradient colors={['rgba(255,255,255,0.18)','rgba(255,255,255,0.08)']} style={pg.createBtnGrad}>
              <Ionicons name="add-circle-outline" size={16} color="#fff"/>
              <Text style={pg.createBtnTxt}>Importer une vidéo</Text>
            </LinearGradient>
          </TouchableOpacity>
          <View style={{height:110}}/>
        </View>
      );
    }

    const hasNullDuration = userReels.every(r=>r.duration==null);

    const sections = hasNullDuration
      ? [{ key:'all', label:'Mes vidéos', subtitle:'Importées depuis votre appareil', icon:'videocam' as const, data:userReels }]
      : [
          { key:'courts', label:'Courts métrages', subtitle:'≤ 30 minutes',  icon:'videocam' as const, data:reelsByCategory.courts },
          { key:'moyens', label:'Moyens métrages', subtitle:'30 – 90 min',   icon:'tv'       as const, data:reelsByCategory.moyens },
          { key:'series', label:'Mini-séries',     subtitle:'+ 90 minutes',  icon:'film'     as const, data:reelsByCategory.series },
        ].filter(s=>s.data.length>0);

    return (
      <View>
        {/* Stats bar */}
        <View style={pg.reelStats}>
          <View style={pg.reelStat}><Text style={pg.reelStatVal}>{userReels.length}</Text><Text style={pg.reelStatLabel}>vidéos</Text></View>
          <View style={pg.reelStatDiv}/>
          <View style={pg.reelStat}><Text style={[pg.reelStatVal,{color:'#22C55E'}]}>{userReels.filter(r=>r.status==='approved').length}</Text><Text style={pg.reelStatLabel}>validées</Text></View>
          <View style={pg.reelStatDiv}/>
          <View style={pg.reelStat}><Text style={[pg.reelStatVal,{color:'#F59E0B'}]}>{userReels.filter(r=>r.status==='pending').length}</Text><Text style={pg.reelStatLabel}>en attente</Text></View>
        </View>

        {sections.map((s,si)=>(
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={`Mes ${s.label.toLowerCase()}`} subtitle={s.subtitle} accentColor={G.primary}/>
            <HScrollRow paddingBottom={8}>{s.data.map(reel=><UserReelCard key={reel.id} reel={reel}/>)}</HScrollRow>
            {si<sections.length-1&&<View style={pg.divider}/>}
          </View>
        ))}
        <View style={{height:110}}/>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);loadData();}} tintColor={G.primary}/>}
      >
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(13,13,18,0.55)','transparent']} style={pg.topGradient} pointerEvents="none"/>

          {/* TOP NAV */}
          <View style={pg.topNav}>
            <View style={pg.topNavLeft}>
              <Ionicons name="lock-closed" size={11} color="rgba(255,255,255,0.5)"/>
              {/* ★ Affiche displayName depuis profileData (sync realtime) */}
              <Text style={pg.topNavUser}>{displayName}</Text>
              <Ionicons name="chevron-down" size={11} color="rgba(255,255,255,0.4)"/>
            </View>
            <View style={pg.topNavRight}>
              <TouchableOpacity style={pg.navIconBtn} onPress={()=>router.push('/notifications' as any)}>
                <Ionicons name="notifications-outline" size={21} color="rgba(255,255,255,0.85)"/>
                <View style={pg.notifDot}/>
              </TouchableOpacity>
              <TouchableOpacity style={pg.navIconBtn} onPress={()=>router.push('/settings')}>
                <Ionicons name="settings-outline" size={21} color="rgba(255,255,255,0.85)"/>
              </TouchableOpacity>
              <TouchableOpacity style={pg.navIconBtn} onPress={()=>router.push('/backoffice/universe-admin' as any)}>
                <Ionicons name="eye-outline" size={21} color="rgba(255,255,255,0.85)"/>
              </TouchableOpacity>
            </View>
          </View>

          {/* AVATAR + STATS */}
          <View style={pg.avatarRow}>
            <View style={pg.avatarWrap}>
              {/* ★ avatarUri depuis profileData (sync realtime) */}
              <ImageWithFallback uri={avatarUri} style={pg.avatar} fallbackColors={[G.surface,G.bg]}/>
              <View style={pg.avatarRing} pointerEvents="none"/>
            </View>
            <View style={pg.statsRow}>
              <StatColumn value={`${watchedWorks.length||user.films_seen_count||0}`} label="films"/>
              <View style={pg.statDivider}/>
              <StatColumn value={fmt(reviews.length)} label="critiques"/>
              <View style={pg.statDivider}/>
              <StatColumn value={`${userReels.length}`} label="vidéos"/>
            </View>
          </View>

          {/* BIO — ★ depuis profileData */}
          <View style={pg.bioRow}>
            <BlurView intensity={20} tint="dark" style={pg.rolePill}>
              <Text style={pg.rolePillTxt}>{roleLabel}</Text>
            </BlurView>
            {profileData.is_industry_contact&&(
              <BlurView intensity={20} tint="dark" style={pg.rolePill}>
                <Text style={pg.rolePillTxt}>Contactable</Text>
              </BlurView>
            )}
            {profileData.location&&(
              <BlurView intensity={20} tint="dark" style={pg.rolePill}>
                <Ionicons name="location-outline" size={10} color="rgba(255,255,255,0.88)"/>
                <Text style={pg.rolePillTxt}>{profileData.location}</Text>
              </BlurView>
            )}
            <Pressable style={pg.editBtn} onPress={()=>router.push('/edit' as any)}>              <Text style={pg.editBtnTxt}>Modifier</Text>
            </Pressable>
          </View>

          {/* Bio — ★ depuis profileData */}
          {profileData.bio&&(
            <View style={pg.bioTextWrap}>
              <Text style={pg.bioText} numberOfLines={3}>{profileData.bio}</Text>
            </View>
          )}

          <View style={pg.glowSep}/>
        </SafeAreaView>

        {/* TAB BAR */}
        <View style={pg.tabBar}>
          {TAB_ICONS.map(({icon,label},idx)=>{
            const active=activeTab===idx;
            return (
              <TouchableOpacity key={icon} style={pg.tabItem} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}>
                <Ionicons name={active?(icon.replace('-outline','') as any):icon} size={20} color={active?G.primary:'rgba(255,255,255,0.28)'}/>
                <Text style={[pg.tabLabel,active&&pg.tabLabelActive]}>{label}</Text>
                {active&&<View style={[pg.tabIndicator,{backgroundColor:G.primary}]}/>}
                {idx===1&&userReels.filter(r=>r.status==='pending').length>0&&(
                  <View style={pg.tabBadge}><Text style={pg.tabBadgeTxt}>{userReels.filter(r=>r.status==='pending').length}</Text></View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab===0&&renderMainContent()}
        {activeTab===1&&renderReelsContent()}
        {activeTab===2&&<EmptyState icon="pricetag-outline" text="Aucun tag" subtext="Les films où vous êtes tagué apparaissent ici"/>}
      </Animated.ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const pg = StyleSheet.create({
  root:         {flex:1,backgroundColor:G.bg},
  topGradient:  {position:'absolute',top:0,left:0,right:0,height:200},
  topNav:       {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PADDING,paddingVertical:10},
  topNavLeft:   {flexDirection:'row',alignItems:'center',gap:5},
  topNavRight:  {flexDirection:'row',alignItems:'center',gap:4},
  topNavUser:   {fontSize:17,fontWeight:'800',color:G.text,letterSpacing:-0.2},
  navIconBtn:   {padding:6,position:'relative'},
  notifDot:     {position:'absolute',top:5,right:5,width:7,height:7,borderRadius:3.5,backgroundColor:G.primary,borderWidth:1.5,borderColor:G.bg},
  avatarRow:    {flexDirection:'row',alignItems:'center',paddingHorizontal:H_PADDING,marginTop:6,gap:16},
  avatarWrap:   {position:'relative'},
  avatar:       {width:84,height:84,borderRadius:42},
  avatarRing:   {position:'absolute',top:-2,left:-2,right:-2,bottom:-2,borderRadius:44,borderWidth:2,borderColor:'rgba(191,95,255,0.4)'},
  statsRow:     {flex:1,flexDirection:'row',justifyContent:'space-around',alignItems:'center'},
  statDivider:  {width:1,height:28,backgroundColor:'rgba(255,255,255,0.07)'},
  bioRow:       {paddingHorizontal:H_PADDING,marginTop:12,flexDirection:'row',alignItems:'center',gap:8,flexWrap:'wrap'},
  rolePill:     {flexDirection:'row',alignItems:'center',gap:4,borderRadius:20,paddingHorizontal:9,paddingVertical:3.5,overflow:'hidden',borderWidth:1,borderColor:'rgba(191,95,255,0.30)'},
  rolePillTxt:  {color:'rgba(255,255,255,0.88)',fontSize:10,fontWeight:'700'},
  editBtn:      {marginLeft:'auto',paddingHorizontal:14,paddingVertical:5,borderRadius:20,borderWidth:1,borderColor:'rgba(255,255,255,0.15)',backgroundColor:'rgba(255,255,255,0.06)'},
  editBtnTxt:   {color:'rgba(255,255,255,0.75)',fontSize:11,fontWeight:'600'},
  bioTextWrap:  {paddingHorizontal:H_PADDING,marginTop:10},
  bioText:      {color:'rgba(255,255,255,0.45)',fontSize:13,lineHeight:19},
  glowSep:      {height:1,marginTop:16,backgroundColor:'rgba(191,95,255,0.14)'},
  divider:      {height:1,backgroundColor:'rgba(255,255,255,0.04)',marginTop:20},
  tabBar:       {flexDirection:'row',borderTopWidth:0.5,borderBottomWidth:0.5,borderColor:'rgba(255,255,255,0.07)',marginTop:4},
  tabItem:      {flex:1,alignItems:'center',paddingVertical:10,gap:3,position:'relative'},
  tabLabel:     {fontSize:9,fontWeight:'600',color:'rgba(255,255,255,0.28)',letterSpacing:0.5,textTransform:'uppercase'},
  tabLabelActive:{color:G.primary},
  tabIndicator: {position:'absolute',top:0,left:'20%',right:'20%',height:2,borderBottomLeftRadius:2,borderBottomRightRadius:2},
  tabBadge:     {position:'absolute',top:6,right:8,width:16,height:16,borderRadius:8,backgroundColor:'#F59E0B',alignItems:'center',justifyContent:'center'},
  tabBadgeTxt:  {color:'#03020A',fontSize:8,fontWeight:'900'},
  reelStats:    {flexDirection:'row',paddingHorizontal:H_PADDING,paddingVertical:14},
  reelStat:     {flex:1,alignItems:'center',gap:2},
  reelStatVal:  {color:'#FFFFFF',fontSize:20,fontWeight:'900',letterSpacing:-0.5},
  reelStatLabel:{color:'rgba(255,255,255,0.35)',fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5},
  reelStatDiv:  {width:1,backgroundColor:'rgba(255,255,255,0.07)',marginHorizontal:8},
  createBtn:    {borderRadius:20,overflow:'hidden',marginTop:20,marginHorizontal:16},
  createBtnGrad:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:10,paddingVertical:14,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.20)',borderRadius:20},
  createBtnTxt: {color:'#FFFFFF',fontSize:15,fontWeight:'700'},
});