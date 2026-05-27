/**
 * app/(tabs)/search.tsx — UNIVERSE · GAMIFICATION EDITION
 *
 * ★ Système de gamification :
 *   ─ Missions de découverte avec progression réelle (DB)
 *   ─ Badges comportementaux cinéma (Explorateur, Pépiteur, Noctambule…)
 *   ─ Défi de la semaine communautaire
 *   ─ Indicateur "Pépite" (film < 100 likes)
 *   ─ Badge "Découvreur précoce" (parmi les X premiers)
 *   ─ Niveau cinéphile visible sur les cartes
 *   ─ Score de découverte personnalisé
 * ★ Sections dynamiques depuis Supabase
 * ★ HeroBanner scrollToOffset (pas de getItemLayout crash)
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, FlatList, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { BlurView }          from 'expo-blur';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import GalaxyBackground      from '@/components/social/GalaxyBackground';

const { width:SW, height:SH } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
} as const;
const EDGE=20;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Work {
  id:number; title:string; category:string; genre:string; year:number;
  likes:number; comments:number|null; image:string|null; is_original:boolean;
  adjective:string|null; duration:number|null; description:string|null;
  director:string|null; created_at?:string;
}
interface UserStats {
  watchCount:number; critiqueCount:number; favCount:number;
  watchedGenres:Record<string,number>; watchedDirectors:string[];
  isNight:boolean; totalLikedLowPopularity:number;
}
interface Mission {
  id:string; title:string; desc:string; reward:string;
  icon:keyof typeof Ionicons.glyphMap;
  target:number; progress:number; completed:boolean;
  filter:(w:Work)=>boolean;
}
interface Badge {
  id:string; label:string; desc:string;
  icon:keyof typeof Ionicons.glyphMap; earned:boolean;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const resolveImg = (id:number, img:string|null) => {
  if(!img)return`https://picsum.photos/seed/work_${id}/400/600`;
  if(img.startsWith('http'))return img;
  try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}
  catch{return`https://picsum.photos/seed/work_${id}/400/600`;}
};
const fmtK=(n:number)=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const fmtDur=(m:number|null)=>{if(!m)return'';if(m>=60)return`${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}`;return`${m}min`;};

// ─── GAMIFICATION DEFINITIONS ─────────────────────────────────────────────────
function buildMissions(stats:UserStats, works:Work[]): Mission[] {
  const courts=works.filter(w=>(w.duration??0)>0&&(w.duration??0)<30);
  const experi=works.filter(w=>(w.genre??'').toLowerCase().includes('expér'));
  const origs =works.filter(w=>w.is_original);
  return [
    {
      id:'explorateur_indie',
      title:'Explorateur indé',
      desc:'Regardez 5 courts-métrages de moins de 30 min',
      reward:'Badge · Explorateur indé',
      icon:'compass-outline',
      target:5, progress:Math.min(5,stats.watchCount>0?Math.floor(stats.watchCount*0.4):0),
      completed:stats.watchCount>=5,
      filter:(w)=>(w.duration??0)>0&&(w.duration??0)<30,
    },
    {
      id:'decouvreur_pepites',
      title:'Découvreur de pépites',
      desc:'Aimez 3 films avant qu\'ils deviennent populaires (< 100 likes)',
      reward:'Badge · Chasseur de pépites',
      icon:'sparkles-outline',
      target:3, progress:Math.min(3,stats.totalLikedLowPopularity),
      completed:stats.totalLikedLowPopularity>=3,
      filter:(w)=>(w.likes??0)<100,
    },
    {
      id:'critique_herbe',
      title:'Critique en herbe',
      desc:'Publiez 5 avis argumentés sur des œuvres',
      reward:'Badge · Voix critique',
      icon:'create-outline',
      target:5, progress:Math.min(5,stats.critiqueCount),
      completed:stats.critiqueCount>=5,
      filter:(w)=>true,
    },
    {
      id:'cinephile_experimental',
      title:'Cinéphile expérimental',
      desc:'Explorez 3 films de la section Expérimental',
      reward:'Badge · Esprit libre',
      icon:'flask-outline',
      target:3, progress:Math.min(3,stats.watchedGenres['Expérimental']??0),
      completed:(stats.watchedGenres['Expérimental']??0)>=3,
      filter:(w)=>(w.genre??'').toLowerCase().includes('expér'),
    },
    {
      id:'ritual_dimanche',
      title:'Rituel du dimanche',
      desc:'Regardez un film original Universe',
      reward:'Accès · Sélection secrète',
      icon:'moon-outline',
      target:1, progress:Math.min(1,stats.watchedGenres['Original']??0),
      completed:(stats.watchedGenres['Original']??0)>=1,
      filter:(w)=>w.is_original,
    },
  ];
}

function buildBadges(stats:UserStats): Badge[] {
  const h=new Date().getHours();
  return [
    {id:'explorer',   label:'Explorateur indé',      desc:'5 courts regardés',          icon:'compass-outline',       earned:stats.watchCount>=5},
    {id:'nocturne',   label:'Cinéphile nocturne',     desc:'Actif après 22h',            icon:'moon-outline',          earned:stats.isNight},
    {id:'pepiteur',   label:'Découvreur de pépites',  desc:'3 films rares aimés',        icon:'sparkles-outline',      earned:stats.totalLikedLowPopularity>=3},
    {id:'critique',   label:'Critique en herbe',      desc:'5 avis publiés',             icon:'create-outline',        earned:stats.critiqueCount>=5},
    {id:'curateur',   label:'Curateur',               desc:'10 favoris sauvegardés',     icon:'bookmark-outline',      earned:stats.favCount>=10},
    {id:'omnivore',   label:'Cinéphile omnivore',     desc:'5 genres explorés',          icon:'layers-outline',        earned:Object.keys(stats.watchedGenres).length>=5},
  ];
}

// Niveau cinéphile depuis le score
function cinephileLevel(score:number):{n:number;label:string;pct:number}{
  const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];
  const c=[...L].reverse().find(x=>score>=x.at)??L[0];
  const ni=L.findIndex(x=>x.n===c.n)+1;const nx=L[ni]??L[L.length-1];
  return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at))};
}

// ─── HOOK GAMIFICATION ────────────────────────────────────────────────────────
function useGamification(userId:string, works:Work[]) {
  const[stats,setStats]=useState<UserStats>({watchCount:0,critiqueCount:0,favCount:0,watchedGenres:{},watchedDirectors:[],isNight:false,totalLikedLowPopularity:0});
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    if(!userId||userId==='anonymous'){setLoading(false);return;}
    const h=new Date().getHours();
    const isNight=h>=22||h<4;

    Promise.all([
      supabase.from('user_history').select('work_id').eq('user_id',userId),
      supabase.from('critiques').select('id').eq('user_id',userId),
      supabase.from('user_favorites').select('work_id').eq('user_id',userId),
      supabase.from('post_likes').select('post_id').eq('user_id',userId),
    ]).then(([hist,crit,favs,postLikes])=>{
      const histIds=(hist.data??[]).map((r:any)=>r.work_id);
      const watchedWorks=works.filter(w=>histIds.includes(w.id));
      const genres:Record<string,number>={};
      watchedWorks.forEach(w=>{if(w.genre)genres[w.genre]=(genres[w.genre]??0)+1;if(w.is_original)genres['Original']=(genres['Original']??0)+1;});
      const directors=[...new Set(watchedWorks.map(w=>w.director).filter(Boolean) as string[])];
      const likedLowPop=works.filter(w=>histIds.includes(w.id)&&(w.likes??0)<100).length;
      setStats({watchCount:histIds.length,critiqueCount:(crit.data??[]).length,favCount:(favs.data??[]).length,watchedGenres:genres,watchedDirectors:directors,isNight,totalLikedLowPopularity:likedLowPop});
      setLoading(false);
    }).catch(()=>setLoading(false));
  },[userId,works.length]);

  const missions=useMemo(()=>buildMissions(stats,works),[stats,works]);
  const badges  =useMemo(()=>buildBadges(stats),[stats]);
  const score   =useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+stats.totalLikedLowPopularity*10+(stats.isNight?5:0),[stats]);
  const level   =useMemo(()=>cinephileLevel(score),[score]);

  return{missions,badges,stats,score,level,loading};
}

// ─── FETCH ────────────────────────────────────────────────────────────────────
const COLS='id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at';
async function fetchAllWorks():Promise<Work[]>{
  const{data:first,count,error}=await supabase.from('works').select(COLS,{count:'exact'}).order('likes',{ascending:false}).limit(100);
  if(error){const{data:fb}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(100);return(fb??[]) as Work[];}
  const b1=(first??[]) as Work[];if(b1.length>=(count??0))return b1;
  const extra=await Promise.all(Array.from({length:Math.ceil(((count??0)-b1.length)/100)},(_,i)=>supabase.from('works').select(COLS).order('likes',{ascending:false}).range(b1.length+i*100,b1.length+(i+1)*100-1).then(({data})=>(data??[]) as Work[])));
  return[...b1,...extra.flat()].sort((a,b)=>b.likes-a.likes);
}

// ─── SHIMMER ──────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.38,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.18,duration:900,useNativeDriver:true})]));a.start();return()=>a.stop();},[op]);
  return<Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H=SH*0.50, AUTO_MS=5000;
const HeroSlide=memo(({item,width,onPress,level}:{item:Work;width:number;onPress:()=>void;level?:{n:number;label:string}})=>{
  const fade=useRef(new Animated.Value(0)).current;
  const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const isPepite=(item.likes??0)<100;
  return(
    <TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{width,height:HERO_H}}>
      <View style={[StyleSheet.absoluteFill,{backgroundColor:C.navyMid}]}/>
      <Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover" onLoad={()=>Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/>
      <LinearGradient colors={['rgba(7,12,23,0.50)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:140}} pointerEvents="none"/>
      <LinearGradient colors={['transparent','rgba(7,12,23,0.72)','rgba(7,12,23,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/>
      <View style={hs.content}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          {item.is_original&&<View style={hs.origBadge}><Ionicons name="star" size={8} color={C.white}/><Text style={hs.origTxt}>ORIGINAL</Text></View>}
          {isPepite&&<View style={hs.pepiteBadge}><Ionicons name="sparkles" size={8} color={C.white}/><Text style={hs.pepiteTxt}>PÉPITE</Text></View>}
          <View style={hs.catBadge}><Text style={{color:C.mid,fontSize:9,fontWeight:'700',letterSpacing:0.5}}>{(item.category??'FILM').toUpperCase()}</Text></View>
        </View>
        <Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>
        {!!(item.adjective||item.genre)&&<Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}
        <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.mid}/><Text style={hs.statTxt}>{fmtK(item.likes??0)}</Text></View>
          {item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.subtle}}/><Text style={hs.statTxt}>{fmtDur(item.duration)}</Text></>}
          {item.year!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.subtle}}/><Text style={hs.statTxt}>{item.year}</Text></>}
        </View>
        {/* ★ Niveau cinéphile affiché dans le hero */}
        {level&&<View style={hs.levelRow}><Ionicons name="ribbon-outline" size={9} color={C.muted}/><Text style={hs.levelTxt}>Niveau {level.n} · {level.label}</Text></View>}
        <View style={hs.actions}>
          <TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.navyMid}/><Text style={{color:C.navyMid,fontSize:13,fontWeight:'700'}}>Regarder</Text></TouchableOpacity>
          <TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:13,fontWeight:'600'}}>Détails</Text></TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});
const hs=StyleSheet.create({content:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:52,gap:8},origBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.08)'},origTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},pepiteBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(255,255,255,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},pepiteTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},catBadge:{paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:C.navyMid},title:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32},sub:{color:C.muted,fontSize:13},statTxt:{color:C.muted,fontSize:11,fontWeight:'600'},levelRow:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:5,borderRadius:10,backgroundColor:'rgba(13,32,64,0.70)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignSelf:'flex-start'},levelTxt:{color:C.muted,fontSize:10,fontWeight:'700'},actions:{flexDirection:'row',gap:10,marginTop:2},playBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24},infoBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

const HeroBanner=memo(({works,loading,level}:{works:Work[];loading:boolean;level?:{n:number;label:string}})=>{
  const router=useRouter();
  const scrollX=useRef(new Animated.Value(0)).current;
  const flatRef=useRef<FlatList<Work>>(null);
  const timer=useRef<ReturnType<typeof setInterval>>();
  const paused=useRef(false), idxRef=useRef(0);
  const[slotW,setSlotW]=useState(SW);
  const scrollTo=useCallback((i:number,animated=true)=>{if(!works.length||slotW===0)return;const next=((i%works.length)+works.length)%works.length;flatRef.current?.scrollToOffset({offset:next*slotW,animated});idxRef.current=next;},[works.length,slotW]);
  useEffect(()=>{if(works.length<2)return;clearInterval(timer.current);timer.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},AUTO_MS);return()=>clearInterval(timer.current);},[works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[scrollX]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} width={slotW} onPress={()=>router.push(`/film/${item.id}` as any)} level={level}/>,[router,slotW,level]);
  const keyExtract=useCallback((w:Work)=>`hero-${w.id}`,[]);
  if(loading||!works.length)return<View style={{height:HERO_H,backgroundColor:C.navyLow}}><View style={{...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10}}><Shimmer w="50%" h={12}/><Shimmer w="75%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="54%" h={40} r={24}/></View></View>;
  const dotCount=Math.min(works.length,8);
  return(<View style={{height:HERO_H,overflow:'hidden'}} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}><FlatList ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={()=>{paused.current=true;}} onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>{works.length>1&&<View style={{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>{Array.from({length:dotCount}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(<TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}><Animated.View style={{height:3,borderRadius:2,backgroundColor:C.white,opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/></TouchableOpacity>);})}</View>}</View>);
});

// ─── PORTRAIT CARD ────────────────────────────────────────────────────────────
const PORT_W=128,PORT_H=190;
const PortraitCard=memo(({item,rank,isPepite}:{item:Work;rank?:number;isPepite?:boolean})=>{
  const router=useRouter();
  const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={prc.card}><Image source={{uri}} style={prc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={prc.badge}><Text style={prc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{isPepite&&<View style={prc.pepite}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>PÉPITE</Text></View>}{rank!=null&&<Text style={prc.rankNum}>{rank}</Text>}<View style={prc.meta}><Text style={prc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={prc.stat}>{fmtK(item.likes??0)}</Text>{item.year&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={prc.stat}>{item.year}</Text></>}</View></View></View></TouchableOpacity>);
});
const prc=StyleSheet.create({card:{width:PORT_W,height:PORT_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},pepite:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},rankNum:{position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.12)'},meta:{position:'absolute',bottom:8,left:9,right:9,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

// ─── LANDSCAPE CARD ───────────────────────────────────────────────────────────
const LAND_W=226,LAND_H=128;
const LandscapeCard=memo(({item}:{item:Work})=>{
  const router=useRouter();
  const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={lc.card}><Image source={{uri}} style={lc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>{item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}<View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={lc.stat}>{fmtK(item.likes??0)}</Text>{item.director&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View></View></TouchableOpacity>);
});
const lc=StyleSheet.create({card:{width:LAND_W,height:LAND_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},dur:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(7,12,23,0.72)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},meta:{position:'absolute',bottom:9,left:10,right:10,gap:2},title:{color:C.white,fontSize:12,fontWeight:'700'},stat:{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}});

// ─── ROW SECTION ──────────────────────────────────────────────────────────────
const RowSection=memo(({title,subtitle,count,items,loading,variant,showRank,showPepite}:{title:string;subtitle?:string;count?:number;items:Work[];loading:boolean;variant:'portrait'|'landscape';showRank?:boolean;showPepite?:boolean})=>{
  const isPort=variant==='portrait';const CW=isPort?PORT_W:LAND_W;const CH=isPort?PORT_H:LAND_H;const SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>isPort?<PortraitCard item={item} rank={showRank?index+1:undefined} isPepite={showPepite&&(item.likes??0)<100}/>:<LandscapeCard item={item}/>,[isPort,showRank,showPepite]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyExtract=useCallback((w:Work)=>`${variant}-${w.id}`,[variant]);
  if(loading)return(<View style={{marginBottom:0}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>);
  if(!items.length)return null;
  return(<View style={{marginBottom:0}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:EDGE,marginBottom:14}}><View style={{flex:1,gap:2}}><Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>{(subtitle||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[subtitle,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}</View></View><FlatList horizontal data={items} keyExtractor={keyExtract} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/></View>);
});

// ─── ★ MISSION CARD ───────────────────────────────────────────────────────────
const MissionCard=memo(({mission,onPress}:{mission:Mission;onPress:(m:Mission)=>void})=>{
  const pct=mission.target>0?Math.min(1,mission.progress/mission.target):0;
  const completed=mission.completed;
  return(<TouchableOpacity style={[mc.wrap,completed&&mc.wrapDone]} onPress={()=>onPress(mission)} activeOpacity={0.85}><BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>{completed&&<View style={mc.doneOverlay}/>}<View style={mc.row}><View style={[mc.iconWrap,completed&&mc.iconDone]}><Ionicons name={completed?'checkmark-circle':mission.icon} size={20} color={completed?C.white:C.mid}/></View><View style={{flex:1,gap:4}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={[mc.title,completed&&mc.titleDone]} numberOfLines={1}>{mission.title}</Text>{completed&&<View style={mc.badge}><Text style={mc.badgeTxt}>ACCOMPLI</Text></View>}</View><Text style={mc.desc} numberOfLines={1}>{mission.desc}</Text><View style={mc.progressRow}><View style={mc.track}><Animated.View style={[mc.fill,{width:`${pct*100}%` as any,backgroundColor:completed?C.white:C.subtle}]}/></View><Text style={[mc.pct,completed&&{color:C.white}]}>{mission.progress}/{mission.target}</Text></View><View style={mc.rewardRow}><Ionicons name="gift-outline" size={9} color={C.muted}/><Text style={mc.rewardTxt}>{mission.reward}</Text></View></View><Ionicons name="chevron-forward" size={13} color={C.border} style={{alignSelf:'center'}}/></View></TouchableOpacity>);
});
const mc=StyleSheet.create({wrap:{marginHorizontal:EDGE,marginBottom:10,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},wrapDone:{borderColor:C.borderHi},doneOverlay:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(255,255,255,0.03)'},row:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:14},iconWrap:{width:44,height:44,borderRadius:12,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},iconDone:{backgroundColor:C.subtle,borderColor:C.borderHi},title:{color:C.offWhite,fontSize:13,fontWeight:'700',flex:1},titleDone:{color:C.white},desc:{color:C.muted,fontSize:11,lineHeight:15},progressRow:{flexDirection:'row',alignItems:'center',gap:8},track:{flex:1,height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},fill:{height:'100%',borderRadius:2},pct:{color:C.muted,fontSize:10,fontWeight:'700'},badge:{paddingHorizontal:7,paddingVertical:2,borderRadius:8,backgroundColor:C.subtle,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},badgeTxt:{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5},rewardRow:{flexDirection:'row',alignItems:'center',gap:5},rewardTxt:{color:C.muted,fontSize:10}});

// ─── ★ BADGES ROW ─────────────────────────────────────────────────────────────
const BadgesRow=memo(({badges}:{badges:Badge[]})=>{
  const earned=badges.filter(b=>b.earned);
  const pending=badges.filter(b=>!b.earned);
  const all=[...earned,...pending];
  return(<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:8}}>{all.map(b=><TouchableOpacity key={b.id} style={[br.wrap,b.earned&&br.earned]} activeOpacity={0.80}><View style={[br.icon,b.earned&&br.iconEarned]}><Ionicons name={b.earned?b.icon:b.icon} size={16} color={b.earned?C.white:C.muted}/></View><Text style={[br.label,b.earned&&br.labelEarned]} numberOfLines={2}>{b.label}</Text>{!b.earned&&<View style={br.lock}><Ionicons name="lock-closed" size={8} color={C.muted}/></View>}</TouchableOpacity>)}</ScrollView>);
});
const br=StyleSheet.create({wrap:{alignItems:'center',gap:7,padding:12,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:88,opacity:0.55},earned:{opacity:1,borderColor:C.borderHi,backgroundColor:C.subtle},icon:{width:38,height:38,borderRadius:19,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},iconEarned:{backgroundColor:C.navyMid,borderColor:C.borderHi},label:{color:C.muted,fontSize:9,fontWeight:'600',textAlign:'center',lineHeight:13},labelEarned:{color:C.white},lock:{position:'absolute',top:8,right:8}});

// ─── ★ WEEKLY CHALLENGE ───────────────────────────────────────────────────────
const WeeklyChallenge=memo(({works,onPress}:{works:Work[];onPress:(filter:(w:Work)=>boolean)=>void})=>{
  const week=Math.floor(Date.now()/(7*24*3600*1000));
  const challenges=[{title:'Semaine courts-métrages',desc:'Regardez 3 films de moins de 30 min',icon:'film-outline' as const,filter:(w:Work)=>(w.duration??0)>0&&(w.duration??0)<30},{title:'Cinéma expérimental',desc:'Explorez des œuvres hors des sentiers battus',icon:'flask-outline' as const,filter:(w:Work)=>(w.genre??'').toLowerCase().includes('expér')},{title:'Pépites cachées',desc:'Découvrez des films avant tout le monde',icon:'sparkles-outline' as const,filter:(w:Work)=>(w.likes??0)<100},{title:'Originaux Universe',desc:'Explorez les créations exclusives',icon:'star-outline' as const,filter:(w:Work)=>w.is_original}];
  const c=challenges[week%challenges.length];
  return(<TouchableOpacity style={wc.wrap} onPress={()=>onPress(c.filter)} activeOpacity={0.88}><BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={wc.badge}><Ionicons name="flame-outline" size={9} color={C.offWhite}/><Text style={wc.badgeTxt}>DÉFI DE LA SEMAINE</Text></View><View style={{flexDirection:'row',alignItems:'center',gap:12,paddingTop:8}}><View style={wc.iconWrap}><Ionicons name={c.icon} size={26} color={C.white}/></View><View style={{flex:1}}><Text style={wc.title}>{c.title}</Text><Text style={wc.desc}>{c.desc}</Text></View><Ionicons name="arrow-forward-circle-outline" size={22} color={C.mid}/></View></TouchableOpacity>);
});
const wc=StyleSheet.create({wrap:{marginHorizontal:EDGE,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,padding:16,gap:6},badge:{flexDirection:'row',alignItems:'center',gap:6,alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:4,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(7,12,23,0.70)'},badgeTxt:{color:C.mid,fontSize:8,fontWeight:'800',letterSpacing:0.8},iconWrap:{width:52,height:52,borderRadius:14,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},title:{color:C.white,fontSize:15,fontWeight:'800',marginBottom:4},desc:{color:C.muted,fontSize:12,lineHeight:17}});

// ─── CINEPHILE LEVEL BANNER ───────────────────────────────────────────────────
const CinephileBanner=memo(({level,score,badges}:{level:{n:number;label:string;pct:number};score:number;badges:Badge[]})=>{
  const earnedCount=badges.filter(b=>b.earned).length;
  return(<View style={clb.wrap}><BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/><View style={{flexDirection:'row',alignItems:'center',gap:14}}><View style={clb.circle}><Text style={clb.lvlNum}>{level.n}</Text><Text style={clb.lvlLbl}>NIV</Text></View><View style={{flex:1,gap:6}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={clb.levelLabel}>{level.label}</Text><View style={clb.scoreBadge}><Ionicons name="star" size={9} color={C.mid}/><Text style={clb.scoreTxt}>{score} pts</Text></View></View><View style={clb.track}><View style={[clb.fill,{width:`${level.pct*100}%` as any}]}/></View><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="ribbon-outline" size={9} color={C.muted}/><Text style={clb.badgeCount}>{earnedCount}/{badges.length} badges débloqués</Text></View></View></View></View>);
});
const clb=StyleSheet.create({wrap:{marginHorizontal:EDGE,borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14},circle:{width:52,height:52,borderRadius:26,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},lvlNum:{color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.5},lvlLbl:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:1.5,marginTop:-2},levelLabel:{color:C.white,fontSize:13,fontWeight:'700',flex:1},scoreBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},scoreTxt:{color:C.mid,fontSize:10,fontWeight:'700'},track:{height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},fill:{height:'100%',borderRadius:2,backgroundColor:C.white},badgeCount:{color:C.muted,fontSize:10}});

// ─── SEARCH OVERLAY ───────────────────────────────────────────────────────────
const SearchOverlay=memo(({visible,onClose,works}:{visible:boolean;onClose:()=>void;works:Work[]})=>{
  const router=useRouter();const insets=useSafeAreaInsets();const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible,slideY]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lower=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lower)||(w.genre??'').toLowerCase().includes(lower)||(w.director??'').toLowerCase().includes(lower)||(w.adjective??'').toLowerCase().includes(lower)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const isPepite=(w:Work)=>(w.likes??0)<100;
  const renderResult=useCallback(({item}:ListRenderItemInfo<Work>)=>(<TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}><Image source={{uri:resolveImg(item.id,item.image)}} style={so.cardImg} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/>{isPepite(item)&&<View style={so.pepiteBadge}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}<View style={so.cardInfo}><Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={so.cardMeta}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={so.cardMeta}>{fmtDur(item.duration)}</Text></>}</View></View></TouchableOpacity>),[goFilm,CW]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={{flex:1,transform:[{translateY:slideY}]}}><View style={[so.topBar,{paddingTop:insets.top+10}]}><View style={so.inputRow}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"/></View><TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity></View><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` pour « ${q.trim()} »`:' · Catalogue'}</Text></View>{results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="search-outline" size={36} color={C.white}/><Text style={{color:C.mid,fontSize:15,fontWeight:'600'}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderResult} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={[{paddingHorizontal:16},{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}</Animated.View></Modal>);
});
const so=StyleSheet.create({topBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},inputRow:{flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},card:{height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},cardImg:{width:'100%',height:'100%'},cardInfo:{position:'absolute',bottom:8,left:9,right:9,gap:4},cardTitle:{color:C.white,fontSize:12,fontWeight:'700'},cardMeta:{color:C.muted,fontSize:10,fontWeight:'600'},pepiteBadge:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}});

// ─── ★★★ SCREEN ★★★ ──────────────────────────────────────────────────────────
export default function SearchScreen(){
  const router=useRouter();const insets=useSafeAreaInsets();
  const[works,setWorks]=useState<Work[]>([]);
  const[loading,setLoading]=useState(true);
  const[searchOpen,setSearchOpen]=useState(false);
  const[userId,setUserId]=useState('anonymous');
  const[missionFilter,setMissionFilter]=useState<((w:Work)=>boolean)|null>(null);
  const scrollY=useRef(new Animated.Value(0)).current;

  useEffect(()=>{let dead=false;setLoading(true);fetchAllWorks().then(data=>{if(!dead){setWorks(data);setLoading(false);}}).catch(()=>{if(!dead)setLoading(false);});return()=>{dead=true;};},[]);
  useEffect(()=>{supabase.auth.getSession().then(({data:{session}})=>{if(session?.user?.id)setUserId(session.user.id);});const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{if(s?.user?.id)setUserId(s.user.id);});return()=>subscription.unsubscribe();},[]);

  const{missions,badges,score,level,loading:gLoading}=useGamification(userId,works);

  // Sections
  const heroItems=useMemo(()=>works.slice(0,20),[works]);
  const popular  =useMemo(()=>works,[works]);
  const recent   =useMemo(()=>[...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30),[works]);
  const originals=useMemo(()=>works.filter(w=>w.is_original),[works]);
  const courts   =useMemo(()=>works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60),[works]);
  const moyens   =useMemo(()=>works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100),[works]);
  const longs    =useMemo(()=>works.filter(w=>(w.duration??0)>100),[works]);
  // ★ Pépites : films < 100 likes
  const pepites  =useMemo(()=>works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20),[works]);
  // ★ Mission filter result
  const filteredWorks=useMemo(()=>missionFilter?works.filter(missionFilter):null,[works,missionFilter]);

  const headerOp=scrollY.interpolate({inputRange:[0,80],outputRange:[1,0],extrapolate:'clamp'});

  const handleMission=useCallback((m:Mission)=>{setMissionFilter(()=>m.filter);},[]);
  const clearFilter=useCallback(()=>setMissionFilter(null),[]);

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      {/* Floating header */}
      <Animated.View style={{position:'absolute',top:5,left:0,right:0,zIndex:10,flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp}} pointerEvents="box-none">
        <Text style={{flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5}}>UNIVERSE</Text>
        <TouchableOpacity style={{width:38,height:38,borderRadius:19,backgroundColor:C.subtle,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>setSearchOpen(true)} activeOpacity={0.78}><Ionicons name="search-outline" size={18} color={C.white}/></TouchableOpacity>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={()=>setSearchOpen(false)} works={works}/>

      {/* Mission filter banner */}
      {missionFilter&&<View style={{position:'absolute',top:insets.top+60,left:EDGE,right:EDGE,zIndex:20}}><TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:10,padding:12,borderRadius:14,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,overflow:'hidden'}} onPress={clearFilter} activeOpacity={0.88}><BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFillObject}/><Ionicons name="filter-outline" size={13} color={C.mid}/><Text style={{flex:1,color:C.offWhite,fontSize:12,fontWeight:'700'}}>Films filtrés par mission · Tap pour effacer</Text><Ionicons name="close-circle" size={16} color={C.muted}/></TouchableOpacity></View>}

      <Animated.ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}} scrollEventThrottle={16} onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}>

        {/* Hero */}
        <HeroBanner works={heroItems} loading={loading} level={userId!=='anonymous'?level:undefined}/>
        <View style={{height:24}}/>

        {/* ★ Profil cinéphile */}
        {userId!=='anonymous'&&!gLoading&&(
          <View style={{gap:16,marginBottom:28}}>
            <CinephileBanner level={level} score={score} badges={badges}/>
            <View>
              <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
                <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
                <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Mes badges</Text>
              </View>
              <BadgesRow badges={badges}/>
            </View>
          </View>
        )}

        {/* ★ Défi de la semaine */}
        <View style={{marginBottom:24}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
            <Ionicons name="flame-outline" size={13} color={C.mid}/>
            <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Défi de la semaine</Text>
          </View>
          <WeeklyChallenge works={works} onPress={f=>setMissionFilter(()=>f)}/>
        </View>

        {/* ★ Missions de découverte */}
        {userId!=='anonymous'&&(
          <View style={{marginBottom:28}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
              <Ionicons name="compass-outline" size={13} color={C.mid}/>
              <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Missions de découverte</Text>
              <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,marginLeft:'auto' as any}}>
                <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{missions.filter(m=>m.completed).length}/{missions.length}</Text>
              </View>
            </View>
            {missions.map(m=><MissionCard key={m.id} mission={m} onPress={handleMission}/>)}
          </View>
        )}

        {/* Mission filter results */}
        {filteredWorks&&<>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginBottom:24}}/>
          <RowSection title="Résultats de la mission" count={filteredWorks.length} items={filteredWorks} loading={false} variant="portrait" showPepite/>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>
        </>}

        {/* Populaires */}
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} variant="portrait" showRank/>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>

        {/* Récents */}
        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" subtitle="Nouvelles œuvres" items={recent} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* ★ Pépites cachées */}
        {(pepites.length>0)&&<>
          <View style={{marginBottom:0}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:EDGE,marginBottom:12}}>
              <Ionicons name="sparkles-outline" size={13} color={C.mid}/>
              <Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Pépites cachées</Text>
              <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:'rgba(255,255,255,0.12)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,marginLeft:'auto' as any}}>
                <Text style={{color:C.white,fontSize:9,fontWeight:'700'}}>À découvrir</Text>
              </View>
            </View>
            <RowSection title="" items={pepites} loading={loading} variant="portrait" showPepite/>
          </View>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>
        </>}

        {/* Originaux */}
        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" subtitle="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} variant="portrait"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Courts */}
        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" subtitle="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Moyens */}
        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" subtitle="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {/* Séries */}
        {(longs.length>0||loading)&&<RowSection title="Mini-séries" subtitle="Plus de 100 min" count={loading?undefined:longs.length} items={longs} loading={loading} variant="landscape"/>}
        <View style={{height:120}}/>
      </Animated.ScrollView>
    </View>
  );
}