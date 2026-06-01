/**
 * app/(tabs)/search.tsx — UNIVERSE · PAGE ACCUEIL v3
 *
 * ★ Gamification déportée dans contexts/GamificationSystem.tsx
 *   → useGamification, useWeeklyChallenge, XPBar, BadgesRow,
 *     WeeklyChallengeCard, WeeklyChallengeModal
 * ★ Code initial (Hero, PortraitCard, LandscapeCard, RowSection,
 *   SearchOverlay, fetchAllWorks) inchangé
 * ★ Défi de la semaine : narrative, XP par étape, tips pro,
 *   dots de progression, difficulty badge
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

// ★ Gamification — tout importé depuis le module dédié
import {
  useGamification,
  useWeeklyChallenge,
  XPBar,
  BadgesRow,
  WeeklyChallengeCard,
  WeeklyChallengeModal,
  resolveImg,
  type Work,
} from '@/contexts/GamificationSystem';

const { width:SW, height:SH } = Dimensions.get('window');

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
  blue:'#5A96E6', blueFaint:'rgba(90,150,230,0.10)',
  gold:'#F5C842', green:'#2ECC8A',
} as const;
const EDGE = 20;

// ─── HELPERS (inchangés) ──────────────────────────────────────────────────────
const fmtK   = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const fmtDur = (m:number|null) => { if(!m)return''; if(m>=60)return`${Math.floor(m/60)}h${m%60>0?` ${m%60}min`:''}`; return`${m}min`; };

// ─── FETCH WORKS (inchangé) ───────────────────────────────────────────────────
const COLS='id,title,category,genre,year,likes,comments,image,is_original,adjective,duration,description,director,created_at';
async function fetchAllWorks():Promise<Work[]>{
  const{data,error}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);
  if(error){const{data:fb}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(100);return(fb??[]) as Work[];}
  return(data??[]) as Work[];
}

// ─── SHIMMER (inchangé) ───────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.18)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.38,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.18,duration:900,useNativeDriver:true})]));a.start();return()=>a.stop();},[op]);
  return<Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.navyMid,opacity:op}}/>;
});

// ─── HERO (inchangé) ──────────────────────────────────────────────────────────
const HERO_H=SH*0.50,AUTO_MS=5000;
const HeroSlide=memo(({item,width,onPress}:{item:Work;width:number;onPress:()=>void})=>{
  const fade=useRef(new Animated.Value(0)).current;
  const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const isPepite=(item.likes??0)<100;
  return(<TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{width,height:HERO_H}}><View style={[StyleSheet.absoluteFill,{backgroundColor:C.navyMid}]}/><Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover" onLoad={()=>Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/><LinearGradient colors={['rgba(7,12,23,0.50)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:140}} pointerEvents="none"/><LinearGradient colors={['transparent','rgba(7,12,23,0.72)','rgba(7,12,23,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/><View style={hs.content}><View style={{flexDirection:'row',alignItems:'center',gap:6}}>{item.is_original&&<View style={hs.origBadge}><Ionicons name="star" size={8} color={C.white}/><Text style={hs.origTxt}>ORIGINAL</Text></View>}{isPepite&&<View style={hs.pepiteBadge}><Ionicons name="sparkles" size={8} color={C.white}/><Text style={hs.pepiteTxt}>PÉPITE</Text></View>}</View><Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>{!!(item.adjective||item.genre)&&<Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.mid}/><Text style={hs.statTxt}>{fmtK(item.likes??0)}</Text></View>{item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.subtle}}/><Text style={hs.statTxt}>{fmtDur(item.duration)}</Text></>}</View><View style={hs.actions}><TouchableOpacity style={hs.playBtn} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.navyMid}/><Text style={{color:C.navyMid,fontSize:13,fontWeight:'700'}}>Regarder</Text></TouchableOpacity><TouchableOpacity style={hs.infoBtn} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:13,fontWeight:'600'}}>Détails</Text></TouchableOpacity></View></View></TouchableOpacity>);
});
const hs=StyleSheet.create({content:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:52,gap:8},origBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.08)'},origTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},pepiteBadge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:'rgba(255,255,255,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},pepiteTxt:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},title:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32},sub:{color:C.muted,fontSize:13},statTxt:{color:C.muted,fontSize:11,fontWeight:'600'},actions:{flexDirection:'row',gap:10,marginTop:2},playBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24},infoBtn:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

const HeroBanner=memo(({works,loading}:{works:Work[];loading:boolean})=>{
  const router=useRouter();const scrollX=useRef(new Animated.Value(0)).current;const flatRef=useRef<FlatList<Work>>(null);const timer=useRef<ReturnType<typeof setInterval>>();const paused=useRef(false),idxRef=useRef(0);const[slotW,setSlotW]=useState(SW);
  const scrollTo=useCallback((i:number,animated=true)=>{if(!works.length||slotW===0)return;const next=((i%works.length)+works.length)%works.length;flatRef.current?.scrollToOffset({offset:next*slotW,animated});idxRef.current=next;},[works.length,slotW]);
  useEffect(()=>{if(works.length<2)return;clearInterval(timer.current);timer.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},AUTO_MS);return()=>clearInterval(timer.current);},[works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[scrollX]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} width={slotW} onPress={()=>router.push(`/film/${item.id}` as any)}/>,[router,slotW]);
  const keyExtract=useCallback((w:Work)=>`hero-${w.id}`,[]);
  if(loading||!works.length)return<View style={{height:HERO_H,backgroundColor:C.navyLow}}><View style={{...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10}}><Shimmer w="50%" h={12}/><Shimmer w="75%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="54%" h={40} r={24}/></View></View>;
  const dotCount=Math.min(works.length,8);
  return(<View style={{height:HERO_H,overflow:'hidden'}} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}><FlatList ref={flatRef} data={works} keyExtractor={keyExtract} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={()=>{paused.current=true;}} onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>{works.length>1&&<View style={{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>{Array.from({length:dotCount}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(<TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}><Animated.View style={{height:3,borderRadius:2,backgroundColor:C.white,opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/></TouchableOpacity>);})}</View>}</View>);
});

// ─── PORTRAIT CARD (inchangé) ────────────────────────────────────────────────
const PORT_W=128,PORT_H=190;
const PortraitCard=memo(({item,rank,isPepite}:{item:Work;rank?:number;isPepite?:boolean})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={prc.card}><Image source={{uri}} style={prc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.90)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={prc.badge}><Text style={prc.badgeTxt}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{isPepite&&<View style={prc.pepite}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>PÉPITE</Text></View>}{rank!=null&&<Text style={prc.rankNum}>{rank}</Text>}<View style={prc.meta}><Text style={prc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={prc.stat}>{fmtK(item.likes??0)}</Text>{item.year&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={prc.stat}>{item.year}</Text></>}</View></View></View></TouchableOpacity>);
});
const prc=StyleSheet.create({card:{width:PORT_W,height:PORT_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(7,12,23,0.72)'},badgeTxt:{color:C.mid,fontSize:7,fontWeight:'800',letterSpacing:0.4},pepite:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},rankNum:{position:'absolute',bottom:32,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255,255,255,0.12)'},meta:{position:'absolute',bottom:8,left:9,right:9,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});

// ─── LANDSCAPE CARD (inchangé) ────────────────────────────────────────────────
const LAND_W=226,LAND_H=128;
const LandscapeCard=memo(({item}:{item:Work})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}><View style={lc.card}><Image source={{uri}} style={lc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>{item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}<View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={lc.stat}>{fmtK(item.likes??0)}</Text>{item.director&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View></View></TouchableOpacity>);
});
const lc=StyleSheet.create({card:{width:LAND_W,height:LAND_H,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},img:{width:'100%',height:'100%',resizeMode:'cover'},dur:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(7,12,23,0.72)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},meta:{position:'absolute',bottom:9,left:10,right:10,gap:2},title:{color:C.white,fontSize:12,fontWeight:'700'},stat:{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}});

// ─── ROW SECTION (inchangé) ───────────────────────────────────────────────────
const RowSection=memo(({title,subtitle,count,items,loading,variant,showRank,showPepite}:{title:string;subtitle?:string;count?:number;items:Work[];loading:boolean;variant:'portrait'|'landscape';showRank?:boolean;showPepite?:boolean})=>{
  const isPort=variant==='portrait';const CW=isPort?PORT_W:LAND_W;const CH=isPort?PORT_H:LAND_H;const SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>isPort?<PortraitCard item={item} rank={showRank?index+1:undefined} isPepite={showPepite&&(item.likes??0)<100}/>:<LandscapeCard item={item}/>,[isPort,showRank,showPepite]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyExtract=useCallback((w:Work)=>`${variant}-${w.id}`,[variant]);
  if(loading)return(<View style={{marginBottom:0}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>);
  if(!items.length)return null;
  return(<View style={{marginBottom:0}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingHorizontal:EDGE,marginBottom:14}}><View style={{flex:1,gap:2}}><Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>{(subtitle||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[subtitle,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}</View></View><FlatList horizontal data={items} keyExtractor={keyExtract} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE}} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/></View>);
});

// ─── SEARCH OVERLAY (inchangé) ────────────────────────────────────────────────
const SearchOverlay=memo(({visible,onClose,works}:{visible:boolean;onClose:()=>void;works:Work[]})=>{
  const router=useRouter();const insets=useSafeAreaInsets();const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible,slideY]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lower=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lower)||(w.genre??'').toLowerCase().includes(lower)||(w.director??'').toLowerCase().includes(lower)||(w.adjective??'').toLowerCase().includes(lower)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const renderResult=useCallback(({item}:ListRenderItemInfo<Work>)=>(<TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}><Image source={{uri:resolveImg(item.id,item.image)}} style={so.cardImg} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/>{(item.likes??0)<100&&<View style={so.pepiteBadge}><Ionicons name="sparkles" size={7} color={C.white}/><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}<View style={so.cardInfo}><Text style={so.cardTitle} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.mid}/><Text style={so.cardMeta}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.subtle}}/><Text style={so.cardMeta}>{fmtDur(item.duration)}</Text></>}</View></View></TouchableOpacity>),[goFilm,CW]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={{flex:1,transform:[{translateY:slideY}]}}><View style={[so.topBar,{paddingTop:insets.top+10}]}><View style={so.inputRow}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"/></View><TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity></View><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` pour « ${q.trim()} »`:' · Catalogue'}</Text></View>{results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="search-outline" size={36} color={C.white}/><Text style={{color:C.mid,fontSize:15,fontWeight:'600'}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderResult} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={[{paddingHorizontal:16},{paddingBottom:insets.bottom+40}]} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}</Animated.View></Modal>);
});
const so=StyleSheet.create({topBar:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},inputRow:{flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},card:{height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.navyMid},cardImg:{width:'100%',height:'100%'},cardInfo:{position:'absolute',bottom:8,left:9,right:9,gap:4},cardTitle:{color:C.white,fontSize:12,fontWeight:'700'},cardMeta:{color:C.muted,fontSize:10,fontWeight:'600'},pepiteBadge:{position:'absolute',top:7,right:7,flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}});

// ─════════════════════════════════════════════════════════════════════════════
// ★★★ SCREEN
// ─════════════════════════════════════════════════════════════════════════════
export default function SearchScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const [works,      setWorks]     = useState<Work[]>([]);
  const [loading,    setLoading]   = useState(true);
  const [searchOpen, setSearchOpen]= useState(false);
  const [userId,     setUserId]    = useState('anonymous');
  const [challengeOpen, setChallengeOpen] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Auth
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{ if(session?.user?.id) setUserId(session.user.id); });
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{ if(s?.user?.id) setUserId(s.user.id); });
    return()=>subscription.unsubscribe();
  },[]);

  // Works
  useEffect(()=>{
    let dead=false;setLoading(true);
    fetchAllWorks().then(data=>{if(!dead){setWorks(data);setLoading(false);}}).catch(()=>{if(!dead)setLoading(false);});
    return()=>{dead=true;};
  },[]);

  // ★ Gamification — importé de GamificationSystem
  const { profile, badges, earnedBadges, loading:gLoading } = useGamification(userId, works);

  // ★ Défi hebdomadaire — importé de GamificationSystem
  const { challenge, progress, upsertProgress } = useWeeklyChallenge(userId);

  const handleStepComplete = useCallback(async (stepIndex:number, completed:boolean) => {
    await upsertProgress(stepIndex, completed);
  }, [upsertProgress]);

  // Sections (inchangé)
  const heroItems=useMemo(()=>works.slice(0,20),[works]);
  const popular  =useMemo(()=>works,[works]);
  const recent   =useMemo(()=>[...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30),[works]);
  const originals=useMemo(()=>works.filter(w=>w.is_original),[works]);
  const courts   =useMemo(()=>works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60),[works]);
  const moyens   =useMemo(()=>works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100),[works]);
  const longs    =useMemo(()=>works.filter(w=>(w.duration??0)>100),[works]);
  const pepites  =useMemo(()=>works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20),[works]);

  const headerOp=scrollY.interpolate({inputRange:[0,80],outputRange:[1,0],extrapolate:'clamp'});

  return (
    <View style={{ flex:1, backgroundColor:C.bg }}>
      <StatusBar style="light"/>
      <GalaxyBackground/>

      {/* Floating header (inchangé) */}
      <Animated.View style={{position:'absolute',top:5,left:0,right:0,zIndex:10,flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp}} pointerEvents="box-none">
        <Text style={{flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5}}>UNIVERSE</Text>
        <TouchableOpacity style={{width:38,height:38,borderRadius:19,backgroundColor:C.subtle,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} onPress={()=>setSearchOpen(true)} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>

      <SearchOverlay visible={searchOpen} onClose={()=>setSearchOpen(false)} works={works}/>

      {/* ★ Modale défi — depuis GamificationSystem */}
      <WeeklyChallengeModal
        visible={challengeOpen}
        onClose={()=>setChallengeOpen(false)}
        challenge={challenge}
        progress={progress}
        onStepComplete={handleStepComplete}
        works={works}
        userId={userId}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom:120 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}
      >
        {/* Hero (inchangé) */}
        <HeroBanner works={heroItems} loading={loading}/>
        <View style={{ height:24 }}/>

        {/* ★ DÉFI DE LA SEMAINE — WeeklyChallengeCard depuis GamificationSystem */}
        <View style={{ marginBottom:20 }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:EDGE, marginBottom:12 }}>
            <Ionicons name="flame-outline" size={13} color={C.mid}/>
            <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>Défi de la semaine</Text>
            {!progress?.completed && (
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:'rgba(245,200,66,0.12)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.25)', marginLeft:'auto' as any }}>
                <Text style={{ color:C.gold, fontSize:9, fontWeight:'700' }}>NOUVEAU</Text>
              </View>
            )}
          </View>
          <WeeklyChallengeCard
            challenge={challenge}
            progress={progress}
            onOpen={() => setChallengeOpen(true)}
          />
        </View>

        {/* ★ XP Bar — depuis GamificationSystem */}
        {userId !== 'anonymous' && !gLoading && (
          <View style={{ marginHorizontal:EDGE, marginBottom:20 }}>
            <XPBar profile={profile}/>
          </View>
        )}

        {/* ★ Badges — depuis GamificationSystem */}
        {userId !== 'anonymous' && earnedBadges.length > 0 && !gLoading && (
          <View style={{ marginBottom:28 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:7, paddingHorizontal:EDGE, marginBottom:12 }}>
              <Ionicons name="ribbon-outline" size={13} color={C.mid}/>
              <Text style={{ color:C.white, fontSize:17, fontWeight:'800' }}>Mes badges</Text>
              <View style={{ paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, marginLeft:'auto' as any }}>
                <Text style={{ color:C.muted, fontSize:9, fontWeight:'700' }}>{earnedBadges.length} obtenus</Text>
              </View>
            </View>
            <BadgesRow badges={badges}/>
          </View>
        )}

        {/* Séparateur */}
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginBottom:28}}/>

        {/* Sections catalogue (inchangé) */}
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} variant="portrait" showRank/>
        <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/>

        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" subtitle="Nouvelles œuvres" items={recent} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {pepites.length>0&&<>
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

        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" subtitle="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} variant="portrait"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" subtitle="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" subtitle="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} variant="landscape"/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:EDGE,marginVertical:24}}/></>}

        {(longs.length>0||loading)&&<RowSection title="Mini-séries" subtitle="Plus de 100 min" count={loading?undefined:longs.length} items={longs} loading={loading} variant="landscape"/>}

        <View style={{ height:120 }}/>
      </Animated.ScrollView>
    </View>
  );
}