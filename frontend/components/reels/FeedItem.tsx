/**
 * FeedItem.tsx — UNIVERSE · v7
 *
 * ★ useReelsUI().setUIVisible() → NavBar + TopHeader + Sidebar + BottomCard
 *   disparaissent/réapparaissent SIMULTANÉMENT via 1 Animated.Value
 * ★ Auto-hide : 4 s sans interaction → fullscreen
 * ★ Toute interaction reset le timer (tap, skip, like, sidebar, seek)
 * ★ En pause → timer suspendu, overlay reste visible
 * ★ Long-press → fullscreen immédiat
 */

import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Animated, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons }       from '@expo/vector-icons';
import * as Haptics       from 'expo-haptics';

import BottomCard     from './BottomCard';
import { P }          from './types';
import { useReelsUI } from '@/contexts/ReelsUIContext';
import type { FeedFilm } from './types';

// ── expo-video ────────────────────────────────────────────────────────────────
function setupPlayer(p:any) {
  if(!p) return;
  p.loop=false; p.muted=false;
  try { p.bufferOptions={preferredForwardBufferDuration:12,preferredBackwardBufferDuration:2}; } catch {}
}

let _useVideoPlayer:((src:any,setup:any)=>any)|null=null;
let _VideoView:any=null;
let _useEvent:(player:any,event:string,initial:any)=>any=(_p,_e,d)=>d;

if(Platform.OS!=='web'){
  try{
    const ev=require('expo-video');
    _useVideoPlayer=ev.useVideoPlayer;
    _VideoView=ev.VideoView;
    _useEvent=ev.useEvent??require('expo').useEvent;
  } catch(e){ console.warn('[FeedItem] expo-video:',e); }
}

const _nullHook  =(_src:any,_setup:any)=>null;
const _playerHook=_useVideoPlayer??_nullHook;

const UI_AUTO_HIDE_MS = 4000; // 4 secondes sans interaction
const DBL_TAP_MS      = 280;

// ── Props ─────────────────────────────────────────────────────────────────────
export interface FeedItemProps {
  film:FeedFilm; isActive:boolean; isNear:boolean; screenFocused:boolean;
  itemW:number; itemH:number; insetBot:number;
  onLike?:(id:string)=>void; onInfoPress?:(f:FeedFilm)=>void;
  /** Mute contrôlé par la SideBar (vient de index.tsx) */
  muted?: boolean;
  /** Reset timer auto-hide dans le contexte */
  onResetTimer?:    () => void;
  /** Pause auto-hide quand la vidéo est en pause */
  onPauseAutoHide?: () => void;
  /** Reprend auto-hide quand la vidéo reprend */
  onResumeAutoHide?: () => void;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
const Spinner=memo(function Spinner(){
  const rot=useRef(new Animated.Value(0)).current;
  useEffect(()=>{
    const a=Animated.loop(Animated.timing(rot,{toValue:1,duration:800,useNativeDriver:true}));
    a.start(); return ()=>a.stop();
  },[rot]);
  const spin=rot.interpolate({inputRange:[0,1],outputRange:['0deg','360deg']});
  return <Animated.View style={[fi.spinner,{transform:[{rotate:spin}]}]}/>;
});

// ── WebPlayer ─────────────────────────────────────────────────────────────────
interface WPProps {
  src:string;paused:boolean;isActive:boolean;muted:boolean;
  itemW:number;itemH:number;
  onPlay:(v:boolean)=>void;onTime:(ct:number,dur:number)=>void;
  onWait:(v:boolean)=>void;onErr:()=>void;
  seekRef:React.MutableRefObject<((t:number)=>void)|null>;
}
const WebPlayer=memo(function WebPlayer({src,paused,isActive,muted,itemW,itemH,onPlay,onTime,onWait,onErr,seekRef}:WPProps){
  const ref=useRef<HTMLVideoElement>(null);
  useEffect(()=>{ seekRef.current=(t)=>{ if(ref.current) ref.current.currentTime=t; }; return()=>{ seekRef.current=null; }; },[seekRef]);
  useEffect(()=>{
    const v=ref.current; if(!v) return;
    if(isActive&&!paused){ v.currentTime=0; v.play().catch(()=>{}); }
    else if(!isActive){ v.pause(); v.currentTime=0; }
  },[isActive]);
  useEffect(()=>{ const v=ref.current; if(!v||!isActive) return; if(paused) v.pause(); else v.play().catch(()=>{}); },[paused,isActive]);
  useEffect(()=>{ if(ref.current) ref.current.muted=muted; },[muted]);
  useEffect(()=>{
    const v=ref.current; if(!v) return;
    const oP=()=>onPlay(true),oA=()=>onPlay(false);
    const oT=()=>{ if(v.duration>0) onTime(v.currentTime,v.duration); };
    const oW=()=>onWait(true),oC=()=>onWait(false);
    v.addEventListener('play',oP);v.addEventListener('pause',oA);v.addEventListener('ended',oA);
    v.addEventListener('timeupdate',oT);v.addEventListener('waiting',oW);
    v.addEventListener('canplay',oC);v.addEventListener('error',onErr);
    return()=>{
      v.removeEventListener('play',oP);v.removeEventListener('pause',oA);v.removeEventListener('ended',oA);
      v.removeEventListener('timeupdate',oT);v.removeEventListener('waiting',oW);
      v.removeEventListener('canplay',oC);v.removeEventListener('error',onErr);
    };
  },[onPlay,onTime,onWait,onErr]);
  return React.createElement('video',{ref,src,muted,playsInline:true,preload:'auto',
    style:{position:'absolute',top:0,left:0,width:itemW,height:itemH,objectFit:'cover',background:'#000'}});
});

// ── PlayPauseFlash ────────────────────────────────────────────────────────────
const PlayPauseFlash=memo(function PlayPauseFlash({anim,isPaused}:{anim:Animated.Value;isPaused:boolean}){
  return(
    <Animated.View style={[fi.ppFlash,{opacity:anim}]} pointerEvents="none">
      <View style={fi.ppCircle}>
        <Ionicons name={isPaused?'play':'pause'} size={38} color="rgba(255,255,255,0.95)"/>
      </View>
    </Animated.View>
  );
});

// ── FeedItem ──────────────────────────────────────────────────────────────────
const FeedItem=memo(function FeedItem({film,isActive,isNear,screenFocused,itemW,itemH,insetBot,onLike,onInfoPress,muted:mutedProp,onResetTimer,onPauseAutoHide,onResumeAutoHide}:FeedItemProps){
  const isWeb=Platform.OS==='web';
  const src=film.video_url?.trim()||null;

  // ★ Une seule fonction pour tout cacher/montrer
  const {setUIVisible}=useReelsUI();

  const nativeSrc=!isWeb&&isNear&&src?src:null;
  const player=_playerHook(nativeSrc,setupPlayer);
  const {isPlaying:nativePlaying}=_useEvent(player,'playingChange',{isPlaying:false});
  const {currentTime:nativeCT}=_useEvent(player,'timeUpdate',{currentTime:0,bufferedPosition:0,currentLiveTimestamp:null,currentOffsetFromLive:null});
  const {isPlaybackEnded}=_useEvent(player,'playToEnd',{isPlaybackEnded:false});

  const [liked,    setLiked]   =useState(film.is_liked??false);
  // muted : contrôlé par la SideBar (prop) ou localement
  const [_mutedLocal, setMuted]   =useState(false);
  const muted = mutedProp !== undefined ? mutedProp : _mutedLocal;
  const [saved,    setSaved]   =useState(film.is_saved??false);
  const [buffering,setBuffering]=useState(true);
  const [hasErr,   setHasErr]  =useState(false);
  const [webPlaying,setWebPlaying]=useState(false);
  const [webCT,    setWebCT]   =useState(0);
  const [webDur,   setWebDur]  =useState(0);

  // showUI contrôle Sidebar + BottomCard localement
  // setUIVisible contrôle NavBar + TopHeader via le contexte
  // Les deux sont appelés ensemble dans hideAll/showAll
  const [showUI,   setShowUI]  =useState(true);
  const [isPaused,_setIsPaused]=useState(false);
  const isPausedRef=useRef(false);
  const setIsPaused=useCallback((v:boolean)=>{ isPausedRef.current=v; _setIsPaused(v); },[]);

  const endRef    =useRef(false);
  const seekRef   =useRef<((t:number)=>void)|null>(null);
  const hideTimer =useRef<ReturnType<typeof setTimeout>|null>(null);
  const ppFlashAnim=useRef(new Animated.Value(0)).current;
  const ppFlashTO =useRef<ReturnType<typeof setTimeout>|null>(null);

  const currentTime=isWeb?webCT:nativeCT;
  const dur=isWeb?webDur:(player?.duration??0);
  const progress=dur>0?Math.min(currentTime/dur,1):0;

  // ★ hideAll / showAll — appellent TOUJOURS les deux ensemble
  const hideAll=useCallback(()=>{
    setShowUI(false);      // Sidebar + BottomCard
    setUIVisible(false);   // NavBar + TopHeader
  },[setUIVisible]);

  const showAll=useCallback(()=>{
    setShowUI(true);
    setUIVisible(true);
  },[setUIVisible]);

  // ★ Timer 4 s — reset à chaque interaction utilisateur
  const resetHideTimer=useCallback(()=>{
    if(hideTimer.current) clearTimeout(hideTimer.current);
    if(isPausedRef.current) return; // En pause → pas d'auto-hide
    hideTimer.current=setTimeout(hideAll,UI_AUTO_HIDE_MS);
  },[hideAll]);

  const clearHideTimer=useCallback(()=>{
    if(hideTimer.current) clearTimeout(hideTimer.current);
  },[]);

  useEffect(()=>{
    if(isActive&&showUI) resetHideTimer();
    return clearHideTimer;
  },[isActive,showUI,resetHideTimer,clearHideTimer]);

  // Status natif
  useEffect(()=>{
    if(isWeb||!player?.addListener) return;
    let sub:any;
    try{
      sub=player.addListener('statusChange',(ev:any)=>{
        const st=typeof ev?.status==='string'?ev.status:(ev?.status?.status??'');
        if(st==='loading') setBuffering(true);
        if(st==='readyToPlay'){ setBuffering(false); setHasErr(false); }
        if(st==='error'){ setHasErr(true); setBuffering(false); }
        if(st==='idle') setBuffering(false);
      });
    }catch{}
    return()=>{ try{ sub?.remove(); }catch{} };
  },[player,isWeb]);

  // Play/Pause natif
  useEffect(()=>{
    if(isWeb||!player) return;
    const should=isActive&&screenFocused&&!isPaused;
    if(should){ try{ player.play(); }catch{} }
    else{
      try{ player.pause(); }catch{}
      if(!isActive&&!isPaused){ const ct=nativeCT; if(ct>0.3) setTimeout(()=>{ try{ player.seekBy(-ct); }catch{} },0); }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isActive,screenFocused,isPaused,player,isWeb]);

  useEffect(()=>{ if(isWeb||!player) return; try{ player.muted=muted; }catch{}; },[muted,player,isWeb]);

  useEffect(()=>{
    if(isWeb||!isPlaybackEnded||endRef.current||!player) return;
    endRef.current=true; setIsPaused(false);
    try{ player.seekBy(-nativeCT); }catch{}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[isPlaybackEnded,isWeb,player]);

  // Reset sur changement de film → restore + relance timer
  useEffect(()=>{
    endRef.current=false;
    setHasErr(false); setBuffering(true);
    setWebPlaying(false); setWebCT(0); setWebDur(0);
    setIsPaused(false);
    showAll();
    clearHideTimer();
    hideTimer.current=setTimeout(hideAll,UI_AUTO_HIDE_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[film.id]);

  useEffect(()=>()=>{ clearHideTimer(); },[clearHideTimer]);

  const onWebPlay=useCallback((v:boolean)=>{ setWebPlaying(v); setBuffering(false); },[]);
  const onWebTime=useCallback((ct:number,d:number)=>{ setWebCT(ct); setWebDur(d); },[]);
  const onWebWait=useCallback((v:boolean)=>setBuffering(v),[]);
  const onWebErr =useCallback(()=>{ setHasErr(true); setBuffering(false); },[]);

  const handleSeek=useCallback((sec:number)=>{
    if(isWeb) seekRef.current?.(sec);
    else if(player) try{ player.seekBy(sec-nativeCT); }catch{}
    resetHideTimer(); // ★ seek = interaction
  },[isWeb,player,nativeCT,resetHideTimer]);

  // Flash icône pause/play
  const flashIcon=useCallback(()=>{
    if(ppFlashTO.current) clearTimeout(ppFlashTO.current);
    ppFlashAnim.setValue(1);
    ppFlashTO.current=setTimeout(()=>{
      Animated.timing(ppFlashAnim,{toValue:0,duration:200,useNativeDriver:true}).start();
    },380);
  },[ppFlashAnim]);

  const togglePlayPause=useCallback(()=>{
    const next=!isPausedRef.current;
    setIsPaused(next);
    flashIcon();
    if(!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    if(!next){
      onResumeAutoHide?.();  // reprise → auto-hide reprend dans le contexte
      resetHideTimer();
    } else {
      onPauseAutoHide?.();   // pause → overlay reste visible
      clearHideTimer();
    }
  },[setIsPaused,flashIcon,isWeb,resetHideTimer,clearHideTimer,onPauseAutoHide,onResumeAutoHide]);

  // Skip ±10s
  const leftBadge =useRef(new Animated.Value(0)).current;
  const rightBadge=useRef(new Animated.Value(0)).current;

  const flashBadge=useCallback((anim:Animated.Value)=>{
    Animated.sequence([
      Animated.timing(anim,{toValue:1,duration:80,useNativeDriver:true}),
      Animated.delay(350),
      Animated.timing(anim,{toValue:0,duration:200,useNativeDriver:true}),
    ]).start();
  },[]);

  const skip=useCallback((d:number)=>{
    handleSeek(Math.max(0,Math.min(dur,currentTime+d)));
    d<0?flashBadge(leftBadge):flashBadge(rightBadge);
    if(!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    // resetHideTimer déjà appelé dans handleSeek
  },[dur,currentTime,handleSeek,flashBadge,leftBadge,rightBadge,isWeb]);

  // Like
  const heartOp   =useRef(new Animated.Value(0)).current;
  const heartScale=heartOp.interpolate({inputRange:[0,0.4,1],outputRange:[0,1.3,1]});
  const heartAlpha=heartOp.interpolate({inputRange:[0,0.1,0.85,1],outputRange:[0,1,1,0]});

  const doLike=useCallback(()=>{
    if(!liked){ setLiked(true); onLike?.(film.id); }
    if(!isWeb) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(()=>{});
    Animated.sequence([
      Animated.spring(heartOp,{toValue:1,useNativeDriver:true,speed:20,bounciness:12}),
      Animated.delay(500),
      Animated.timing(heartOp,{toValue:0,duration:250,useNativeDriver:true}),
    ]).start();
    onResetTimer?.();
    resetHideTimer();
  },[liked,heartOp,isWeb,film.id,onLike,resetHideTimer,onResetTimer]);

  // Zones tap
  const tL=useRef(0),tC=useRef(0),tR=useRef(0);

  const tapL=useCallback(()=>{
    const n=Date.now();const isDbl=n-tL.current<DBL_TAP_MS;tL.current=n;
    if(isDbl){ doLike(); return; }
    if(!showUI){ showAll(); resetHideTimer(); return; }
    skip(-10);
  },[doLike,skip,showUI,showAll,resetHideTimer]);

  const tapC=useCallback(()=>{
    const n=Date.now();const isDbl=n-tC.current<DBL_TAP_MS;tC.current=n;
    if(isDbl){ doLike(); return; }
    if(!showUI){ showAll(); resetHideTimer(); return; }
    togglePlayPause();
    resetHideTimer();
  },[doLike,showUI,showAll,togglePlayPause,resetHideTimer]);

  const tapR=useCallback(()=>{
    const n=Date.now();const isDbl=n-tR.current<DBL_TAP_MS;tR.current=n;
    if(isDbl){ doLike(); return; }
    if(!showUI){ showAll(); resetHideTimer(); return; }
    skip(10);
  },[doLike,skip,showUI,showAll,resetHideTimer]);

  const handleLongPress=useCallback(()=>{ clearHideTimer(); hideAll(); },[clearHideTimer,hideAll]);

  const zW=itemW/3;

  const handleSideLike=useCallback(()=>{ setLiked(v=>{ if(!v) onLike?.(film.id); return !v; }); resetHideTimer(); },[film.id,onLike,resetHideTimer]);
  const handleSideMute=useCallback(()=>{ setMuted(v=>!v); resetHideTimer(); },[resetHideTimer]);
  const handleSideSave=useCallback(()=>{ setSaved(v=>!v); resetHideTimer(); },[resetHideTimer]);

  return(
    <View style={[fi.root,{width:itemW,height:itemH}]}>
      <View style={[StyleSheet.absoluteFill,fi.bg]}/>

      {!isWeb&&isNear&&!!src&&!hasErr&&_VideoView&&player&&(
        <_VideoView player={player} style={[StyleSheet.absoluteFill,{width:itemW,height:itemH}]}
          contentFit="cover" nativeControls={false} allowsFullscreen={false} allowsPictureInPicture={false}/>
      )}
      {isWeb&&!!src&&!hasErr&&(
        <WebPlayer src={src} paused={isPaused} isActive={isActive&&screenFocused} muted={muted}
          itemW={itemW} itemH={itemH} onPlay={onWebPlay} onTime={onWebTime}
          onWait={onWebWait} onErr={onWebErr} seekRef={seekRef}/>
      )}
      {!src&&(
        <View style={fi.diagBox} pointerEvents="none">
          <Ionicons name="videocam-off-outline" size={36} color="rgba(255,255,255,0.25)"/>
          <Text style={fi.diagTxt}>video_url manquante</Text>
        </View>
      )}

      <LinearGradient colors={['transparent','rgba(0,0,0,0.55)','rgba(0,0,0,0.92)']} locations={[0.30,0.68,1]} style={fi.grad} pointerEvents="none"/>

      <TouchableOpacity style={[fi.zone,{left:0   }]} onPress={tapL} onLongPress={handleLongPress} activeOpacity={1}/>
      <TouchableOpacity style={[fi.zone,{left:zW  }]} onPress={tapC} onLongPress={handleLongPress} activeOpacity={1}/>
      <TouchableOpacity style={[fi.zone,{left:zW*2}]} onPress={tapR} onLongPress={handleLongPress} activeOpacity={1}/>

      <PlayPauseFlash anim={ppFlashAnim} isPaused={isPaused}/>

      {isActive&&buffering&&!hasErr&&!!src&&(
        <View style={fi.center} pointerEvents="none"><Spinner/></View>
      )}

      {hasErr&&(
        <View style={fi.errBox}>
          <Ionicons name="warning-outline" size={34} color={P.hot}/>
          <Text style={fi.errTxt}>Impossible de lire la vidéo</Text>
          <Text style={fi.errUrl} numberOfLines={1}>{src}</Text>
          <TouchableOpacity style={fi.retryBtn} onPress={()=>{ setHasErr(false); setBuffering(true); }}>
            <Ionicons name="refresh" size={14} color="#fff"/>
            <Text style={fi.retryTxt}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[fi.badge,{opacity:leftBadge, left:16, top:itemH*0.45}]} pointerEvents="none"/>
      <Animated.View style={[fi.badge,{opacity:rightBadge,right:16,top:itemH*0.45}]} pointerEvents="none"/>
      <Animated.View style={[fi.heart,{opacity:heartAlpha,transform:[{scale:heartScale}]}]} pointerEvents="none">
        <Ionicons name="heart" size={90} color={P.red}/>
      </Animated.View>

      {showUI&&(
        <View style={fi.sidebar} pointerEvents="box-none">
          <TouchableOpacity style={fi.sBtn} onPress={handleSideLike}>
            <View style={[fi.sIcon,liked&&fi.sIconOn]}>
              <Ionicons name={liked?'heart':'heart-outline'} size={26} color={liked?P.red:'#fff'}/>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={fi.sBtn} onPress={handleSideMute}>
            <View style={[fi.sIcon,muted&&fi.sIconOn]}>
              <Ionicons name={muted?'volume-mute':'volume-high'} size={23} color="#fff"/>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={fi.sBtn} onPress={handleSideSave}>
            <View style={[fi.sIcon,saved&&fi.sIconOn]}>
              <Ionicons name={saved?'bookmark':'bookmark-outline'} size={23} color="#fff"/>
            </View>
          </TouchableOpacity>
          {onInfoPress&&(
            <TouchableOpacity style={fi.sBtn} onPress={()=>{ onInfoPress(film); resetHideTimer(); }}>
              <View style={fi.sIcon}>
                <Ionicons name="list-outline" size={24} color="rgba(255,255,255,0.75)"/>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      <BottomCard film={film} progress={progress} duration={dur} currentTime={currentTime}
        isReady={!buffering&&!hasErr&&!!src} insetBot={insetBot}
        onSeek={handleSeek} visible={showUI}/>
    </View>
  );
});

export default FeedItem;

const fi=StyleSheet.create({
  root:   {overflow:'hidden'},
  bg:     {backgroundColor:'#000'},
  grad:   {position:'absolute',bottom:0,left:0,right:0,height:'62%'},
  zone:   {position:'absolute',top:0,bottom:0,width:'33.33%',zIndex:10},
  center: {...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',zIndex:20},
  spinner:{width:38,height:38,borderRadius:19,borderWidth:3,borderColor:'transparent',borderTopColor:'rgba(255,255,255,0.90)',borderRightColor:'rgba(255,255,255,0.20)'},
  diagBox:{...StyleSheet.absoluteFillObject,zIndex:5,alignItems:'center',justifyContent:'center',gap:10},
  diagTxt:{color:'rgba(255,255,255,0.35)',fontSize:13,textAlign:'center'},
  errBox: {...StyleSheet.absoluteFillObject,zIndex:20,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,0.88)',gap:12,padding:32},
  errTxt: {color:'rgba(255,255,255,0.70)',fontSize:14,fontWeight:'600'},
  errUrl: {color:'rgba(255,255,255,0.28)',fontSize:10,textAlign:'center'},
  retryBtn:{flexDirection:'row',alignItems:'center',gap:8,backgroundColor:P.primary,borderRadius:12,paddingHorizontal:18,paddingVertical:10},
  retryTxt:{color:'#fff',fontSize:13,fontWeight:'700'},
  badge:  {position:'absolute',zIndex:20},
  heart:  {position:'absolute',top:'50%',left:'50%',marginTop:-45,marginLeft:-45,zIndex:20},
  ppFlash:{position:'absolute',zIndex:25,top:'50%',left:'50%',marginTop:-40,marginLeft:-40},
  ppCircle:{width:80,height:80,borderRadius:40,backgroundColor:'rgba(0,0,0,0.60)',alignItems:'center',justifyContent:'center',borderWidth:1.5,borderColor:'rgba(255,255,255,0.22)'},
  sidebar:{position:'absolute',right:14,bottom:270,alignItems:'center',gap:20,zIndex:15},
  sBtn:   {alignItems:'center',gap:4},
  sIcon:  {width:50,height:50,borderRadius:25,backgroundColor:'rgba(0,0,0,0.40)',alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'rgba(255,255,255,0.12)'},
  sIconOn:{backgroundColor:'rgba(255,255,255,0.15)'},
});