/**
 * app/(tabs)/profile.tsx — UNIVERSE
 * ★ Avatar temps réel via realtime UPDATE profiles
 * ★ Fetch parallèle (Promise.all) → performance maximale
 * ★ getSession() uniquement → UUID garanti
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Linking, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Image }          from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import GalaxyBackground      from '@/components/social/GalaxyBackground';
import { ImageWithFallback } from '@/components/profile/ImageWithFallback';
import { EmptyState, HScrollRow, SectionHeader } from '@/components/profile/Section';
import { CARD_H, CARD_W, H_PADDING, NUM_ITEM_W, NUM_OVERLAP, NUM_W, CARD_GAP } from '@/components/profile/theme';
import { type ReviewItem } from '@/components/profile/data';
import { supabase } from '@/lib/supabase';

const VideoThumbnails: any = Platform.select({
  native: () => { try { return require('expo-video-thumbnails'); } catch { return null; } },
  default: () => null,
})?.() ?? null;
let LOGO: any = null;
try { LOGO = require('@/assets/images/logouniverse2.png'); } catch {}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)',
} as const;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work { id:number; title:string; category:string; genre:string; year:number; likes:number; image:string|null; is_original:boolean; duration:number|null; director:string|null }
interface UserReel { id:string; video_url:string; thumbnail_url:string|null; title:string|null; genre:string|null; duration:number|null; status:'pending'|'approved'|'rejected'; likes_count:number; views_count:number; created_at:string }
interface ProfileData { display_name:string; username:string; bio:string; role:string; location:string; avatar_url:string; website:string; is_pro:boolean; is_industry_contact:boolean; specialties:string[]; festivals:string[]; open_to:string[]; social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string }
type GridTab = 0 | 1 | 2;

const EMPTY_PROFILE: ProfileData = {
  display_name:'', username:'', bio:'', role:'creator', location:'',
  avatar_url:'', website:'', is_pro:false, is_industry_contact:false,
  specialties:[], festivals:[], open_to:[],
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};
const ROLE_LABELS: Record<string,string> = {
  director:'Réalisateur·rice', producer:'Producteur·rice', writer:'Scénariste',
  actor:'Acteur·rice', dp:'Dir. photo', editor:'Monteur·euse',
  critic:'Critique', creator:'Créateur·rice', other:'Cinéaste',
};

// ─── MAPPERS ──────────────────────────────────────────────────────────────────
const mapProfile = (r:any): ProfileData => ({
  display_name:r?.display_name??'', username:r?.username??'', bio:r?.bio??'',
  role:r?.role??'creator', location:r?.location??'', avatar_url:r?.avatar_url??'',
  website:r?.website??'', is_pro:r?.is_pro??false, is_industry_contact:r?.is_industry_contact??false,
  specialties:Array.isArray(r?.specialties)?r.specialties:[], festivals:Array.isArray(r?.festivals)?r.festivals:[],
  open_to:Array.isArray(r?.open_to)?r.open_to:[], social_instagram:r?.social_instagram??'',
  social_vimeo:r?.social_vimeo??'', social_youtube:r?.social_youtube??'', social_imdb:r?.social_imdb??'',
});
const mapWork = (r:any): Work => ({ id:Number(r?.id)||0, title:r?.title??'', category:r?.category??'', genre:r?.genre??'', year:Number(r?.year)||0, likes:Number(r?.likes)||0, image:r?.image??null, is_original:r?.is_original??false, duration:r?.duration!=null?Number(r.duration):null, director:r?.director??null });
const mapReel = (r:any): UserReel => ({ id:String(r?.id??''), video_url:r?.video_url??'', thumbnail_url:r?.thumbnail_url??null, title:r?.title??null, genre:r?.genre??null, duration:r?.duration!=null?Number(r.duration):null, status:(['pending','approved','rejected'].includes(r?.status)?r.status:'pending') as any, likes_count:Number(r?.likes_count)||0, views_count:Number(r?.views_count)||0, created_at:r?.created_at??new Date().toISOString() });
const mapCritique = (r:any): ReviewItem => ({ id:String(r?.id), filmId:String(r?.reel_id??r?.work_id??r?.id), content:String(r?.content??r?.body??''), rating:r?.rating!=null?Number(r.rating):0, likes:Number(r?.likes_count??r?.likes??0), date:r?.created_at?new Date(r.created_at).toISOString():new Date().toISOString(), film:{ id:String(r?.reel_id??r?.id), title:String(r?.film_title??r?.work_title??r?.title??'—'), posterUrl:`https://picsum.photos/seed/crit_${r?.id}/400/600`, genre:'—', type:'film' as const } } satisfies ReviewItem);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const resolveImage = (id:number, image:string|null) => {
  if (!image) return `https://picsum.photos/seed/work_${id}/400/600`;
  if (image.startsWith('http')) return image;
  try { return supabase.storage.from('community-images').getPublicUrl(image).data.publicUrl; }
  catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
};
const fmt = (n:number) => n>=1_000_000?`${(n/1_000_000).toFixed(1)}M`:n>=1_000?`${(n/1_000).toFixed(n>=10_000?0:1)}K`:`${n}`;
const fmtDur = (s:number|null) => { if(!s)return''; const h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?`${h}h${m>0?` ${m}min`:''}`:m>0?`${m}min`:''; };
const momentum = (r:UserReel) => Math.round((r.views_count*0.3+r.likes_count*2)/Math.max(0.5,(Date.now()-new Date(r.created_at).getTime())/86400000));

// ─── AURA ─────────────────────────────────────────────────────────────────────
const computeAura = (reels:UserReel[], reviews:ReviewItem[], favCount:number, festivals:string[]) =>
  Math.min(9999,Math.round(reels.reduce((s,r)=>s+r.views_count,0)*0.2+reels.reduce((s,r)=>s+r.likes_count,0)*2.5+reels.filter(r=>r.status==='approved').length*40+festivals.length*20+reviews.reduce((s,r)=>s+(r.likes??0),0)*2+favCount*6));

const creatorLevel = (aura:number) => {
  const L=[{at:0,n:1,l:'Émergent'},{at:100,n:2,l:'Indépendant'},{at:500,n:3,l:'Reconnu'},{at:1500,n:4,l:'Confirmé'},{at:4000,n:5,l:'Visionnaire'}];
  const c=[...L].reverse().find(x=>aura>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===c.n)+1; const nx=L[ni]??L[L.length-1];
  return { level:c.n, label:c.l, nextAt:nx.at, pct:c.n===5?1:Math.min(1,(aura-c.at)/(nx.at-c.at)) };
};

// ─── FETCH ────────────────────────────────────────────────────────────────────
async function db<T>(fn:()=>PromiseLike<{data:T|null;error:any}>, label?:string): Promise<T|null> {
  try { const {data,error}=await fn(); if(error){if(__DEV__)console.warn('[profile]',label,error.code);return null;} return data; }
  catch(e){ if(__DEV__)console.warn('[profile]',label,e); return null; }
}

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer = memo(({w,h,r=8}:{w:number;h:number;r?:number}) => {
  const op = useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{ const l=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.38,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.18,duration:900,useNativeDriver:true})])); l.start(); return()=>l.stop(); },[op]);
  return <Animated.View style={{width:w,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

const SkeletonSection = memo(() => (
  <View>
    <View style={{flexDirection:'row',alignItems:'center',gap:8,paddingHorizontal:H_PADDING,paddingTop:22,paddingBottom:12}}>
      <View style={{width:26,height:26,borderRadius:9,backgroundColor:C.navyMid}}/>
      <View style={{height:12,width:120,borderRadius:6,backgroundColor:C.navyMid}}/>
    </View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:H_PADDING,gap:CARD_GAP}}>
      {[0,1,2,3].map(i=>(
        <View key={i} style={{flexDirection:'row',alignItems:'flex-end',width:NUM_ITEM_W}}>
          <View style={{width:NUM_W,height:CARD_H,justifyContent:'flex-start',paddingTop:6}}><View style={{height:68,width:38,backgroundColor:C.faint,borderRadius:6,alignSelf:'flex-end'}}/></View>
          <View style={{borderRadius:13,overflow:'hidden',marginLeft:-NUM_OVERLAP}}><Shimmer w={CARD_W} h={CARD_H} r={12}/></View>
        </View>
      ))}
    </ScrollView>
  </View>
));

// ─── AURA DISPLAY ─────────────────────────────────────────────────────────────
const AuraDisplay = memo(({aura,level}:{aura:number;level:ReturnType<typeof creatorLevel>}) => {
  const prog = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0.4)).current;
  useEffect(()=>{
    Animated.timing(prog,{toValue:level.pct,duration:1200,useNativeDriver:false}).start();
    Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:2200,useNativeDriver:true}),Animated.timing(glow,{toValue:0.4,duration:2200,useNativeDriver:true})])).start();
  },[level.pct]);
  return (
    <View style={au.wrap}>
      <View style={{flexDirection:'row',alignItems:'center',gap:16}}>
        <View style={{alignItems:'center',justifyContent:'center'}}>
          <Animated.View style={[au.ring,{opacity:glow}]}/>
          <View style={au.circle}><Text style={au.num}>{fmt(aura)}</Text><Text style={au.lbl}>AURA</Text></View>
        </View>
        <View style={{flex:1,gap:7}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
            <Ionicons name="layers-outline" size={12} color={C.mid}/>
            <Text style={{color:C.mid,fontSize:11,fontWeight:'700'}}>Niveau {level.level}</Text>
            <View style={au.chip}><Text style={{color:C.offWhite,fontSize:9,fontWeight:'800',letterSpacing:0.3}}>{level.label}</Text></View>
          </View>
          <View style={{height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
          </View>
          <Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>
            {level.level<5?`${fmt(Math.max(0,level.nextAt-aura))} pts → niveau ${level.level+1}`:'Niveau maximum atteint'}
          </Text>
        </View>
      </View>
    </View>
  );
});
const au = StyleSheet.create({
  wrap:  {marginHorizontal:H_PADDING,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,padding:16,marginBottom:4},
  ring:  {position:'absolute',width:82,height:82,borderRadius:41,borderWidth:1.5,borderColor:'rgba(255,255,255,0.18)'},
  circle:{width:72,height:72,borderRadius:36,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center',backgroundColor:C.navyMid},
  num:   {color:C.white,fontSize:19,fontWeight:'900',letterSpacing:-0.8},
  lbl:   {color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:2,marginTop:-2},
  chip:  {paddingHorizontal:8,paddingVertical:2,borderRadius:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid},
});

// ─── ACTIVITY PULSE ───────────────────────────────────────────────────────────
const ActivityPulse = memo(({reels,reviews,favCount}:{reels:UserReel[];reviews:ReviewItem[];favCount:number}) => {
  const pulse = useRef(new Animated.Value(1)).current;
  const totalR = reels.reduce((s,r)=>s+r.views_count,0)+reviews.reduce((s,r)=>s+(r.likes??0),0);
  const rate = useMemo(()=>{ const v=reels.reduce((s,r)=>s+r.views_count,0),l=reels.reduce((s,r)=>s+r.likes_count,0); return v?`${((l/v)*100).toFixed(1)}%`:'—'; },[reels]);
  const hot = useMemo(()=>[...reels].sort((a,b)=>momentum(b)-momentum(a))[0],[reels]);
  useEffect(()=>{ const l=Animated.loop(Animated.sequence([Animated.timing(pulse,{toValue:1.2,duration:950,useNativeDriver:true}),Animated.timing(pulse,{toValue:1,duration:950,useNativeDriver:true})])); l.start(); return()=>l.stop(); },[]);
  return (
    <View style={ap.wrap}>
      <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
      <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
        <Animated.View style={{width:6,height:6,borderRadius:3,backgroundColor:C.white,transform:[{scale:pulse}]}}/>
        <Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:1.5,textTransform:'uppercase'}}>ACTIVITÉ EN DIRECT</Text>
      </View>
      <View style={{flexDirection:'row',justifyContent:'space-around'}}>
        {[{v:fmt(totalR),l:'portée totale'},{v:rate,l:'engagement'},{v:fmt(favCount),l:'en favori'}].map(({v,l},i)=>(
          <React.Fragment key={l}>
            {i>0&&<View style={{width:1,backgroundColor:C.faint}}/>}
            <View style={ap.cell}><Text style={ap.val}>{v}</Text><Text style={ap.lbl}>{l}</Text></View>
          </React.Fragment>
        ))}
      </View>
      {hot&&hot.views_count>0&&(
        <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingTop:8,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border}}>
          <Ionicons name="flame-outline" size={11} color={C.mid}/>
          <Text style={{color:C.muted,fontSize:10,flex:1}} numberOfLines={1}>«{hot.title||'Sans titre'}» · {fmt(hot.views_count)} vues · {momentum(hot)} pts/j</Text>
        </View>
      )}
    </View>
  );
});
const ap = StyleSheet.create({ wrap:{marginHorizontal:H_PADDING,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,gap:10}, cell:{alignItems:'center',gap:3,flex:1}, val:{color:C.white,fontSize:16,fontWeight:'900',letterSpacing:-0.5}, lbl:{color:C.muted,fontSize:8,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.3} });

// ─── ACHIEVEMENTS ─────────────────────────────────────────────────────────────
const AchievementsRow = memo(({reels,reviews,profile,favCount}:{reels:UserReel[];reviews:ReviewItem[];profile:ProfileData;favCount:number}) => {
  const items = useMemo(()=>{
    const a:{icon:keyof typeof Ionicons.glyphMap;label:string}[]=[];
    if(reels.length>=1) a.push({icon:'film-outline',label:'Première création'});
    if(reels.filter(r=>r.status==='approved').length>=3) a.push({icon:'checkmark-circle-outline',label:'3 créas validées'});
    if(profile.festivals.length>=1) a.push({icon:'trophy-outline',label:'Sélection festival'});
    if(reviews.length>=5) a.push({icon:'create-outline',label:'5 critiques'});
    if(favCount>=10) a.push({icon:'heart-outline',label:'10 favoris'});
    if(profile.is_pro) a.push({icon:'star-outline',label:'Membre PRO'});
    if(profile.is_industry_contact) a.push({icon:'briefcase-outline',label:'Contact industrie'});
    if(profile.specialties.length>=3) a.push({icon:'layers-outline',label:'Multi-discipline'});
    if(reels.reduce((s,r)=>s+r.views_count,0)>=1000) a.push({icon:'eye-outline',label:'1K vues'});
    if(reels.length>0&&!reels.some(r=>r.status==='rejected')) a.push({icon:'shield-checkmark-outline',label:'Aucun refus'});
    return a;
  },[reels,reviews,profile,favCount]);
  if(!items.length) return null;
  return (
    <View style={{gap:10}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:H_PADDING}}>
        <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
        <Text style={{color:C.muted,fontSize:9,fontWeight:'800',letterSpacing:1.2,textTransform:'uppercase',flex:1}}>Distinctions</Text>
        <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{items.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingHorizontal:H_PADDING,paddingVertical:2}}>
        {items.map((a,i)=>(
          <View key={i} style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:12,paddingVertical:8,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}>
            <Ionicons name={a.icon} size={12} color={C.mid}/>
            <Text style={{color:C.offWhite,fontSize:11,fontWeight:'600'}}>{a.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
});

// ─── PORTRAIT CARD ────────────────────────────────────────────────────────────
const PortraitCard = memo(({item,rank}:{item:Work;rank?:number}) => {
  const router=useRouter();
  const uri=useMemo(()=>resolveImage(item.id,item.image),[item.id,item.image]);
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
      <View style={pc.card}>
        <Image source={{uri}} style={pc.img} contentFit="cover"/>
        <LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
        <View style={pc.badge}><Text style={pc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>
        {rank!=null&&<Text style={pc.rank}>{rank}</Text>}
        <View style={pc.meta}>
          <Text style={pc.title} numberOfLines={2}>{item.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
            <Ionicons name="heart" size={9} color={C.mid}/>
            <Text style={pc.stat}>{(item.likes??0).toLocaleString('fr-FR')}</Text>
            {item.year>0&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={pc.stat}>{item.year}</Text></>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const pc = StyleSheet.create({ card:{width:CARD_W,height:CARD_H,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid}, img:{width:'100%' as any,height:'100%' as any}, badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'}, badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4}, rank:{position:'absolute',bottom:32,right:6,fontSize:52,fontWeight:'900',lineHeight:52,letterSpacing:-4,color:'rgba(255,255,255,0.10)'}, meta:{position:'absolute',bottom:8,left:8,right:8,gap:3}, title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14}, stat:{color:C.muted,fontSize:9,fontWeight:'600'} });

// ─── REEL CARD ────────────────────────────────────────────────────────────────
const S_CFG: Record<string,{icon:keyof typeof Ionicons.glyphMap;label:string}> = {
  pending:{icon:'time-outline',label:'En attente'},
  approved:{icon:'checkmark-circle-outline',label:'Validée'},
  rejected:{icon:'close-circle-outline',label:'Refusée'},
};
function useThumb(url:string, thumb:string|null): string|null {
  const [uri,setUri]=useState<string|null>(thumb??null);
  useEffect(()=>{ if(thumb||!url||!VideoThumbnails)return; let ok=true; VideoThumbnails.getThumbnailAsync(url,{time:1500,quality:0.65}).then(({uri:u}:{uri:string})=>{if(ok)setUri(u);}).catch(()=>{}); return()=>{ok=false;}; },[url,thumb]);
  return uri;
}
const ReelCard = memo(({reel,isHot}:{reel:UserReel;isHot:boolean}) => {
  const router=useRouter(), thumb=useThumb(reel.video_url,reel.thumbnail_url), cfg=S_CFG[reel.status]??S_CFG.pending, [err,setErr]=useState(false), m=momentum(reel);
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={()=>router.push({pathname:'/reel/[id]',params:{id:reel.id}} as any)} activeOpacity={0.88}>
      <View style={rc.card}>
        {thumb&&!err?<Image source={{uri:thumb}} style={StyleSheet.absoluteFillObject} contentFit="cover" onError={()=>setErr(true)}/>:<View style={rc.ph}><LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject}/><Ionicons name="film-outline" size={28} color={C.subtle}/></View>}
        <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.35}} end={{x:0,y:1}}/>
        <View style={rc.play} pointerEvents="none"><Ionicons name="play-circle-outline" size={28} color={C.mid}/></View>
        <View style={rc.status}><Ionicons name={cfg.icon} size={9} color={C.mid}/><Text style={rc.stTxt}>{cfg.label}</Text></View>
        {(isHot||reel.views_count>=10)&&<View style={rc.mom}><Ionicons name={isHot?'flame-outline':'trending-up-outline'} size={8} color={C.mid}/><Text style={rc.momTxt}>{isHot?'EN HAUSSE':`${fmt(reel.views_count)} vues`}</Text></View>}
        {reel.duration!=null&&<View style={rc.dur}><Text style={rc.stTxt}>{fmtDur(reel.duration)}</Text></View>}
        <View style={rc.meta}>
          <Text style={rc.title} numberOfLines={2}>{reel.title||'Sans titre'}</Text>
          {reel.genre&&<Text style={{color:C.muted,fontSize:9}}>{reel.genre}</Text>}
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:2}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="eye-outline" size={9} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.views_count)}</Text></View>
            <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart-outline" size={9} color={C.muted}/><Text style={rc.stTxt}>{fmt(reel.likes_count)}</Text></View>
            {m>0&&<Text style={{marginLeft:'auto' as any,color:C.muted,fontSize:8,fontWeight:'700'}}>{m}pts/j</Text>}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const rc = StyleSheet.create({ card:{width:162,height:225,borderRadius:14,overflow:'hidden',backgroundColor:C.navyMid}, ph:{flex:1,alignItems:'center',justifyContent:'center'}, play:{position:'absolute',top:'40%',alignSelf:'center',marginTop:-14}, status:{position:'absolute',top:8,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.72)'}, stTxt:{color:C.muted,fontSize:8,fontWeight:'700'}, mom:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:'rgba(7,12,23,0.82)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}, momTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.5}, dur:{position:'absolute',bottom:90,right:8,paddingHorizontal:6,paddingVertical:2,borderRadius:6,backgroundColor:'rgba(7,12,23,0.72)'}, meta:{position:'absolute',bottom:0,left:0,right:0,padding:11,gap:3}, title:{color:C.white,fontSize:11,fontWeight:'800',lineHeight:14} });

// ─── CRITIQUE CARD ────────────────────────────────────────────────────────────
const SD=[{t:8,l:18,op:0.30,r:1.5},{t:14,l:88,op:0.18,r:1.0},{t:22,l:155,op:0.32,r:1.8},{t:38,l:42,op:0.14,r:0.8},{t:48,l:190,op:0.22,r:1.2},{t:58,l:72,op:0.25,r:1.4},{t:70,l:130,op:0.16,r:0.8},{t:80,l:8,op:0.20,r:1.0},{t:92,l:200,op:0.28,r:1.5}];
const CritiqueCard = memo(({review,rank,onPress}:{review:ReviewItem;rank:number;onPress:()=>void}) => {
  const stars=Math.round(review.rating??0);
  return (
    <TouchableOpacity style={{marginRight:12}} onPress={onPress} activeOpacity={0.88}>
      <View style={cc.card}>
        <LinearGradient colors={[C.navyMid,C.navyLow]} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:1,y:1}}/>
        {SD.map((s,i)=><View key={i} style={[cc.star,{top:s.t,left:s.l,opacity:s.op,width:s.r,height:s.r,borderRadius:s.r/2}]}/>)}
        {LOGO&&<Image source={LOGO} style={cc.logo} contentFit="contain"/>}
        <View style={cc.badge}><Text style={cc.badgeTxt}>#{rank}</Text></View>
        {(review.likes??0)>0&&<View style={cc.likes}><Ionicons name="heart" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:8,fontWeight:'700'}}>{fmt(review.likes??0)}</Text></View>}
        <View style={cc.body}>
          <Text style={cc.filmTitle} numberOfLines={1}>{review.film?.title??'—'}</Text>
          <View style={{flexDirection:'row',gap:2}}>{[1,2,3,4,5].map(s=><Ionicons key={s} name={s<=stars?'star':'star-outline'} size={10} color={s<=stars?C.offWhite:C.subtle}/>)}</View>
          <Text style={cc.excerpt} numberOfLines={3}>{review.content||'Aucun contenu'}</Text>
        </View>
        <View style={{...StyleSheet.absoluteFillObject,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} pointerEvents="none"/>
      </View>
    </TouchableOpacity>
  );
});
const cc = StyleSheet.create({ card:{width:220,height:148,borderRadius:16,overflow:'hidden'}, star:{position:'absolute',backgroundColor:C.white}, logo:{position:'absolute',right:8,bottom:8,width:44,height:44,opacity:0.06}, badge:{position:'absolute',top:10,left:10,paddingHorizontal:7,paddingVertical:3,borderRadius:8,backgroundColor:C.navyMid}, badgeTxt:{color:C.mid,fontSize:9,fontWeight:'800'}, likes:{position:'absolute',top:10,right:10,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2.5,borderRadius:7,backgroundColor:C.navyMid}, body:{position:'absolute',bottom:0,left:0,right:0,padding:12,gap:4}, filmTitle:{color:C.white,fontSize:13,fontWeight:'800',letterSpacing:-0.2}, excerpt:{color:C.muted,fontSize:10,lineHeight:14} });

// ─── PROFILE HEADER ───────────────────────────────────────────────────────────
const ProfileHeader = memo(({profile,filmCount,critiqueCount,reelCount,level,onEdit}:{
  profile:ProfileData; filmCount:number; critiqueCount:number; reelCount:number;
  level:ReturnType<typeof creatorLevel>; onEdit:()=>void;
}) => {
  const [exp,setExp]=useState(false);
  // ★ Avatar dynamique : profile.avatar_url mis à jour par realtime UPDATE profiles
  const avatarUri = profile.avatar_url || `https://i.pravatar.cc/150?u=${profile.username||'anon'}`;
  const links = useMemo(()=>[
    {key:'ig',icon:'logo-instagram' as any,url:profile.social_instagram,label:'Instagram'},
    {key:'vi',icon:'videocam-outline' as any,url:profile.social_vimeo,label:'Vimeo'},
    {key:'yt',icon:'logo-youtube' as any,url:profile.social_youtube,label:'YouTube'},
    {key:'im',icon:'film-outline' as any,url:profile.social_imdb,label:'IMDb'},
    {key:'ws',icon:'globe-outline' as any,url:profile.website,label:'Portfolio'},
  ].filter(l=>!!l.url),[profile]);

  return (
    <View style={hdr.wrap}>
      <View style={hdr.topRow}>
        {/* ★ ImageWithFallback reçoit avatarUri — se met à jour instantanément via realtime */}
        <View style={{position:'relative'}}>
          <ImageWithFallback uri={avatarUri} style={hdr.avatar} fallbackColors={[C.navyMid,C.navyLow]}/>
          <View style={hdr.lvlBadge}><Text style={hdr.lvlTxt}>{level.level}</Text></View>
          {profile.is_pro&&<View style={hdr.proBadge}><Ionicons name="checkmark-circle" size={15} color={C.white}/></View>}
        </View>
        <View style={hdr.stats}>
          {[{v:fmt(filmCount),l:'films'},{v:fmt(critiqueCount),l:'critiques'},{v:fmt(reelCount),l:'créas'}].map(({v,l},i,arr)=>(
            <React.Fragment key={l}>
              <View style={{alignItems:'center',gap:2}}><Text style={hdr.statVal}>{v}</Text><Text style={hdr.statLbl}>{l}</Text></View>
              {i<arr.length-1&&<View style={{width:1,height:30,backgroundColor:C.faint}}/>}
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* Nom + badges */}
      <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:12,flexWrap:'wrap'}}>
        <Text style={hdr.name}>{profile.display_name||profile.username||'Cinéaste'}</Text>
        {profile.is_pro&&<View style={hdr.proChip}><Text style={{color:C.offWhite,fontSize:8,fontWeight:'900',letterSpacing:0.8}}>PRO</Text></View>}
        {profile.is_industry_contact&&<View style={hdr.indChip}><Ionicons name="briefcase-outline" size={8} color={C.mid}/><Text style={{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.8}}>INDUSTRIE</Text></View>}
      </View>

      <Text style={hdr.role}>{ROLE_LABELS[profile.role]??'Créateur·rice'}{profile.location?` · ${profile.location}`:''}{` · ${level.label}`}</Text>

      {!!profile.bio&&(
        <Pressable onPress={()=>setExp(e=>!e)} style={{marginTop:10,gap:3}}>
          <Text style={{color:C.mid,fontSize:13,lineHeight:19}} numberOfLines={exp?undefined:3}>{profile.bio}</Text>
          {profile.bio.length>120&&<Text style={{color:C.offWhite,fontSize:12,fontWeight:'600',marginTop:2}}>{exp?'Voir moins':'Voir plus'}</Text>}
        </Pressable>
      )}

      <TouchableOpacity style={hdr.editBtn} onPress={onEdit} activeOpacity={0.80}>
        <Ionicons name="create-outline" size={13} color={C.mid}/>
        <Text style={{color:C.mid,fontSize:12,fontWeight:'700'}}>Modifier le profil</Text>
      </TouchableOpacity>

      {profile.specialties.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:2}} style={{marginTop:12}}>
          {profile.specialties.map(s=><View key={s} style={hdr.chip}><Text style={{color:C.offWhite,fontSize:11,fontWeight:'600'}}>{s}</Text></View>)}
        </ScrollView>
      )}
      {profile.festivals.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:2}} style={{marginTop:8}}>
          {profile.festivals.map(f=><View key={f} style={hdr.fest}><Ionicons name="trophy-outline" size={9} color={C.mid}/><Text style={{color:C.mid,fontSize:10,fontWeight:'600'}}>{f}</Text></View>)}
        </ScrollView>
      )}
      {profile.open_to.length>0&&(
        <View style={{flexDirection:'row',alignItems:'center',gap:7,marginTop:10,flexWrap:'wrap'}}>
          <Ionicons name="link-outline" size={10} color={C.muted}/>
          <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>Ouvert à</Text>
          {profile.open_to.slice(0,3).map(o=><View key={o} style={{paddingHorizontal:9,paddingVertical:3,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow}}><Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{o}</Text></View>)}
        </View>
      )}
      {links.length>0&&(
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:14}}>
          {links.map(l=>(
            <TouchableOpacity key={l.key} style={hdr.soc} onPress={()=>Linking.openURL(l.url!).catch(()=>{})} activeOpacity={0.78}>
              <BlurView intensity={Platform.OS==='ios'?14:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <Ionicons name={l.icon} size={14} color={C.offWhite}/>
              <Text style={{color:C.offWhite,fontSize:11,fontWeight:'600'}}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:20}}/>
    </View>
  );
});
const hdr = StyleSheet.create({
  wrap:    {paddingHorizontal:H_PADDING},
  topRow:  {flexDirection:'row',alignItems:'center',gap:16,marginTop:6},
  avatar:  {width:82,height:82,borderRadius:41,borderWidth:1.5,borderColor:C.border},
  lvlBadge:{position:'absolute',top:-2,right:-2,width:20,height:20,borderRadius:10,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  lvlTxt:  {color:C.white,fontSize:8,fontWeight:'900'},
  proBadge:{position:'absolute',bottom:0,right:0,width:20,height:20,borderRadius:10,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  stats:   {flex:1,flexDirection:'row',justifyContent:'space-around'},
  statVal: {color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.5},
  statLbl: {color:C.muted,fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  name:    {color:C.white,fontSize:17,fontWeight:'900',letterSpacing:-0.3,flexShrink:1},
  proChip: {paddingHorizontal:8,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid},
  indChip: {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:2,borderRadius:7,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyMid},
  role:    {color:C.muted,fontSize:12,marginTop:3},
  editBtn: {marginTop:14,borderRadius:11,backgroundColor:C.navyLow,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,paddingVertical:10,alignItems:'center',flexDirection:'row',justifyContent:'center',gap:6},
  chip:    {paddingHorizontal:11,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  fest:    {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  soc:     {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:8,borderRadius:12,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
});

// ─── TOP NAV ──────────────────────────────────────────────────────────────────
const TopNav = memo(({name}:{name:string}) => {
  const router=useRouter();
  return (
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PADDING,paddingTop:8,paddingBottom:4}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
        <Ionicons name="person-circle-outline" size={14} color={C.muted}/>
        <Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.2}}>{name}</Text>
      </View>
      <View style={{flexDirection:'row',gap:8}}>
        {([{icon:'notifications-outline',route:'/notifications',dot:true},{icon:'settings-outline',route:'/settings',dot:false},{icon:'eye-outline',route:'/backoffice/universe-admin',dot:false}] as const).map(({icon,route,dot})=>(
          <TouchableOpacity key={icon} style={{width:36,height:36,borderRadius:18,alignItems:'center',justifyContent:'center',overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>router.push(route as any)} activeOpacity={0.75}>
            <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={{position:'absolute',top:0,left:0,right:0,bottom:0}}/>
            <Ionicons name={icon} size={16} color={C.offWhite}/>
            {dot&&<View style={{position:'absolute',top:7,right:7,width:6,height:6,borderRadius:3,backgroundColor:C.white,borderWidth:1,borderColor:C.bg}}/>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const router=useRouter();
  const [uid,setUid]=useState<string|null>(null);
  const [profile,setProfile]=useState<ProfileData>(EMPTY_PROFILE);
  const [reels,setReels]=useState<UserReel[]>([]);
  const [reviews,setReviews]=useState<ReviewItem[]>([]);
  const [favWorks,setFavWorks]=useState<Work[]>([]);
  const [watched,setWatched]=useState<Work[]>([]);
  const [recs,setRecs]=useState<Work[]>([]);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [activeTab,setActiveTab]=useState<GridTab>(0);

  // Auth — getSession() uniquement, UUID garanti
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{if(session?.user?.id)setUid(session.user.id);});
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>setUid(s?.user?.id??null));
    return()=>subscription.unsubscribe();
  },[]);

  // Fetch parallèle
  const loadAll = useCallback(async (userId:string) => {
    setLoading(true);
    try {
      const [prof,reelsData,critData,favIds,histIds] = await Promise.all([
        db<any>(()=>supabase.from('profiles').select('*').eq('id',userId).maybeSingle(),'profiles'),
        db<any[]>(()=>supabase.from('reels').select('*').eq('user_id',userId).order('created_at',{ascending:false}),'reels'),
        db<any[]>(()=>supabase.from('critiques').select('*').eq('user_id',userId).order('created_at',{ascending:false}),'critiques'),
        db<any[]>(()=>supabase.from('user_favorites').select('work_id').eq('user_id',userId),'favorites'),
        db<any[]>(()=>supabase.from('user_history').select('work_id').eq('user_id',userId),'history'),
      ]);
      if(prof) setProfile(mapProfile(prof));
      setReels((reelsData??[]).map(mapReel));
      setReviews((critData??[]).map(mapCritique).sort((a,b)=>(b.likes??0)-(a.likes??0)));

      const favIds2=(favIds??[]).map((r:any)=>r.work_id).filter(Boolean);
      const histIds2=(histIds??[]).map((r:any)=>r.work_id).filter(Boolean);
      const [favData,histData] = await Promise.all([
        favIds2.length?db<any[]>(()=>supabase.from('works').select('*').in('id',favIds2),'works-fav'):null,
        histIds2.length?db<any[]>(()=>supabase.from('works').select('*').in('id',histIds2),'works-hist'):null,
      ]);
      if(favData) setFavWorks(favData.map(mapWork));
      if(histData) setWatched(histData.map(mapWork));

      const seenIds=[...new Set([...favIds2,...histIds2])];
      const allWorks=[...(favData??[]),...(histData??[])];
      const genres=[...new Set(allWorks.map((w:any)=>w?.genre).filter(Boolean))];
      if(genres.length){
        const recData=await db<any[]>(()=>supabase.from('works').select('*').in('genre',genres).order('likes',{ascending:false}).limit(12),'recs');
        if(recData) setRecs(recData.map(mapWork).filter(w=>!seenIds.includes(w.id)));
      }
    } catch(e){ if(__DEV__)console.error('[profile]',e); }
    finally { setLoading(false); setRefreshing(false); }
  },[]);

  useEffect(()=>{if(uid)loadAll(uid);},[uid,loadAll]);
  useFocusEffect(useCallback(()=>{if(uid)loadAll(uid);},[uid,loadAll]));

  // ★ Realtime — avatar mis à jour instantanément via UPDATE profiles
  useEffect(()=>{
    if(!uid) return;
    const ts=Date.now();
    const ch1=supabase.channel(`rt_r_${ts}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reels'},({new:r})=>{const u=mapReel(r);setReels(p=>p.map(x=>x.id===u.id?u:x));})
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'reels'},({new:r})=>{const reel=mapReel(r);if(reel.id)setReels(p=>[reel,...p.filter(x=>x.id!==reel.id)]);})
      .subscribe();
    // ★ Ce canal capte les UPDATE sur profiles, y compris avatar_url
    // → ProfileHeader reçoit le nouvel avatar sans aucune action utilisateur
    const ch2=supabase.channel(`rt_p_${ts}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},({new:r})=>{if((r as any).id===uid)setProfile(mapProfile(r));})
      .subscribe();
    return()=>{supabase.removeChannel(ch1);supabase.removeChannel(ch2);};
  },[uid]);

  const aura=useMemo(()=>computeAura(reels,reviews,favWorks.length,profile.festivals),[reels,reviews,favWorks.length,profile.festivals]);
  const level=useMemo(()=>creatorLevel(aura),[aura]);
  const hotId=useMemo(()=>reels.length<2?null:[...reels].sort((a,b)=>momentum(b)-momentum(a))[0]?.id??null,[reels]);
  const reelsByCat=useMemo(()=>{ const courts:UserReel[]=[],moyens:UserReel[]=[],series:UserReel[]=[]; reels.forEach(r=>{ if(!r.duration||r.duration<=1800)courts.push(r); else if(r.duration<=5400)moyens.push(r); else series.push(r); }); return{courts,moyens,series}; },[reels]);

  const renderFilms = () => {
    if(loading) return <View><SkeletonSection/><SkeletonSection/><SkeletonSection/></View>;
    return (
      <View>
        <SectionHeader icon="heart-outline" label="Œuvres favorites" subtitle="Vos favoris" count={favWorks.length} accentColor={C.white} onViewAll={()=>router.push('/profile/favorites' as any)}/>
        {!favWorks.length?<EmptyState icon="heart-outline" text="Aucun favori" subtext="Sauvegardez des films"/>:<HScrollRow>{favWorks.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="create-outline" label="Mes critiques" subtitle="Classées par popularité" accentColor={C.white} onViewAll={()=>router.push('/profile/reviews' as any)}/>
        {!reviews.length?<EmptyState icon="chatbubble-outline" text="Aucune critique"/>:<HScrollRow>{reviews.map((r,i)=><CritiqueCard key={r.id} review={r} rank={i+1} onPress={()=>router.push(`/review/${r.id}` as any)}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="eye-outline" label="Œuvres visionnées" subtitle="Votre historique" accentColor={C.white} onViewAll={()=>router.push('/profile/seen_films' as any)}/>
        {!watched.length?<EmptyState icon="film-outline" text="Aucun visionnage" subtext="Marquez des films comme vus"/>:<HScrollRow>{watched.map((f,i)=><PortraitCard key={f.id} item={f} rank={i+1}/>)}</HScrollRow>}
        <View style={pg.div}/>
        <SectionHeader icon="shuffle-outline" label="Recommandés" subtitle="Basé sur vos goûts" accentColor={C.white}/>
        {!recs.length?<EmptyState icon="planet-outline" text="Aucune recommandation"/>:<HScrollRow>{recs.map(f=><PortraitCard key={f.id} item={f}/>)}</HScrollRow>}
        <View style={{height:110}}/>
      </View>
    );
  };

  const renderCreations = () => {
    if(loading) return <View><SkeletonSection/></View>;
    if(!reels.length) return (
      <View style={{paddingTop:60,paddingHorizontal:H_PADDING}}>
        <EmptyState icon="videocam-outline" text="Aucune création" subtext="Importez vos vidéos depuis l'onglet Créer"/>
        <TouchableOpacity style={pg.importBtn} onPress={()=>router.push('/(tabs)/create' as any)} activeOpacity={0.85}>
          <Ionicons name="add-circle-outline" size={15} color={C.mid}/>
          <Text style={pg.importTxt}>Importer une vidéo</Text>
        </TouchableOpacity>
        <View style={{height:110}}/>
      </View>
    );
    const approved=reels.filter(r=>r.status==='approved').length, pending=reels.filter(r=>r.status==='pending').length, rejected=reels.filter(r=>r.status==='rejected').length;
    const totalV=reels.reduce((s,r)=>s+r.views_count,0), totalL=reels.reduce((s,r)=>s+r.likes_count,0);
    const secs=reels.every(r=>r.duration==null)
      ?[{key:'all',label:'Mes vidéos',icon:'videocam-outline' as const,sub:'Toutes',data:reels}]
      :[{key:'courts',label:'Courts métrages',icon:'videocam-outline' as const,sub:'≤ 30 min',data:reelsByCat.courts},{key:'moyens',label:'Moyens métrages',icon:'tv-outline' as const,sub:'30–90 min',data:reelsByCat.moyens},{key:'series',label:'Mini-séries',icon:'film-outline' as const,sub:'> 90 min',data:reelsByCat.series}].filter(s=>s.data.length>0);
    return (
      <View>
        <View style={pg.reelStats}>
          {[{icon:'film-outline' as const,v:`${reels.length}`,l:'vidéos'},{icon:'checkmark-circle-outline' as const,v:`${approved}`,l:'validées'},{icon:'time-outline' as const,v:`${pending}`,l:'en attente'},{icon:'eye-outline' as const,v:fmt(totalV),l:'vues'},{icon:'heart-outline' as const,v:fmt(totalL),l:'likes'}].map(({icon,v,l},i,arr)=>(
            <React.Fragment key={l}>
              <View style={pg.reelStat}><Ionicons name={icon} size={12} color={C.muted}/><Text style={pg.rsV}>{v}</Text><Text style={pg.rsL}>{l}</Text></View>
              {i<arr.length-1&&<View style={{width:1,backgroundColor:C.faint,marginHorizontal:6}}/>}
            </React.Fragment>
          ))}
        </View>
        {rejected>0&&<View style={pg.rejBar}><Ionicons name="alert-circle-outline" size={13} color={C.mid}/><Text style={pg.rejTxt}>{rejected} création{rejected>1?'s':''} refusée{rejected>1?'s':''}</Text></View>}
        {secs.map((s,si)=>(
          <View key={s.key}>
            <SectionHeader icon={s.icon} label={s.label} subtitle={s.sub} accentColor={C.white}/>
            <HScrollRow paddingBottom={8}>{s.data.map(r=><ReelCard key={r.id} reel={r} isHot={r.id===hotId}/>)}</HScrollRow>
            {si<secs.length-1&&<View style={pg.div}/>}
          </View>
        ))}
        <View style={{height:110}}/>
      </View>
    );
  };

  const tabs=[{icon:'grid-outline' as const,label:'Films'},{icon:'play-circle-outline' as const,label:'Créations'},{icon:'pricetag-outline' as const,label:'Tags'}];

  return (
    <View style={pg.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <Animated.ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);if(uid)loadAll(uid);}} tintColor={C.mid}/>}>
        <SafeAreaView edges={['top']}>
          <LinearGradient colors={['rgba(7,12,23,0.60)','transparent']} style={pg.topGrad} pointerEvents="none"/>
          <TopNav name={profile.display_name||profile.username||'Mon Profil'}/>
          <ProfileHeader profile={profile} filmCount={watched.length} critiqueCount={reviews.length} reelCount={reels.length} level={level} onEdit={()=>router.push('/edit' as any)}/>
        </SafeAreaView>
        <View style={{marginTop:16,marginBottom:12}}><AuraDisplay aura={aura} level={level}/></View>
        {!loading&&(reels.length>0||reviews.length>0)&&<View style={{marginBottom:12}}><ActivityPulse reels={reels} reviews={reviews} favCount={favWorks.length}/></View>}
        <View style={{marginBottom:16}}><AchievementsRow reels={reels} reviews={reviews} profile={profile} favCount={favWorks.length}/></View>
        <View style={pg.tabBar}>
          {tabs.map(({icon,label},idx)=>{const active=activeTab===idx,badge=idx===1?reels.filter(r=>r.status==='pending').length:0;return(<TouchableOpacity key={icon} style={pg.tabItem} onPress={()=>setActiveTab(idx as GridTab)} activeOpacity={0.75}><Ionicons name={active?(icon.replace('-outline','') as any):icon} size={18} color={active?C.white:C.muted}/><Text style={[pg.tabLabel,active&&pg.tabLabelOn]}>{label}</Text>{active&&<View style={pg.tabInd}/>}{badge>0&&<View style={pg.badge}><Text style={pg.badgeTxt}>{badge}</Text></View>}</TouchableOpacity>);})}
        </View>
        {activeTab===0&&renderFilms()}
        {activeTab===1&&renderCreations()}
        {activeTab===2&&<View style={{paddingTop:60}}><EmptyState icon="pricetag-outline" text="Onglet Tags" subtext="Les œuvres où vous êtes crédité·e apparaîtront ici."/><View style={{height:110}}/></View>}
      </Animated.ScrollView>
    </View>
  );
}

const pg = StyleSheet.create({
  root:      {flex:1,backgroundColor:C.bg},
  topGrad:   {position:'absolute',top:0,left:0,right:0,height:200},
  div:       {height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginTop:24},
  tabBar:    {flexDirection:'row',borderTopWidth:StyleSheet.hairlineWidth,borderBottomWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginTop:16},
  tabItem:   {flex:1,alignItems:'center',paddingVertical:11,gap:3,position:'relative'},
  tabLabel:  {fontSize:9,fontWeight:'700',color:C.muted,letterSpacing:0.6,textTransform:'uppercase'},
  tabLabelOn:{color:C.white},
  tabInd:    {position:'absolute',top:0,left:'20%',right:'20%',height:2,backgroundColor:C.white,borderBottomLeftRadius:2,borderBottomRightRadius:2},
  badge:     {position:'absolute',top:7,right:10,minWidth:15,height:15,borderRadius:8,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',paddingHorizontal:3},
  badgeTxt:  {color:C.white,fontSize:7,fontWeight:'900'},
  reelStats: {flexDirection:'row',paddingHorizontal:H_PADDING,paddingVertical:16,marginBottom:4},
  reelStat:  {flex:1,alignItems:'center',gap:3},
  rsV:       {color:C.white,fontSize:16,fontWeight:'900',letterSpacing:-0.5},
  rsL:       {color:C.muted,fontSize:8,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.4},
  rejBar:    {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:H_PADDING,marginBottom:12,paddingHorizontal:12,paddingVertical:10,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow},
  rejTxt:    {color:C.mid,fontSize:11,flex:1},
  importBtn: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:20,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.navyLow,paddingVertical:14},
  importTxt: {color:C.mid,fontSize:13,fontWeight:'700'},
});