/**
 * app/(tabs)/search.tsx  —  UNIVERSE v11
 * ─────────────────────────────────────────────────────────────────────────────
 *  ★ Découverte de catalogue : hero, sections, recherche
 *  ★ Galaxie XP — Cosmos uniquement : niveau, XP, défis du jour créateur
 *  ★ 3 défis tirés chaque jour d'un pool de 8 (regarder/critiquer/créer/réseauter…)
 *  ★ Palette or/blanc · C.card (#0D2040) · aura divine breathing
 *  ★ ZERO supabase.auth.* · getDeviceId()
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Animated, Dimensions, Easing, FlatList, Image, Modal,
  Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
  type ListRenderItemInfo,
} from 'react-native';
import { LinearGradient }    from 'expo-linear-gradient';
import { Ionicons }          from '@expo/vector-icons';
import { useRouter }         from 'expo-router';
import { StatusBar }         from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase }          from '@/lib/supabase';
import { getDeviceId }       from '@/services/api';
import GalaxyBackground      from '@/components/shared/GalaxyBackground';
import { GlowAccentCard }    from '@/components/shared/GlowAccentCard';
import {
  resolveImg, useGamification, XPFloat, XPBar as GamiXPBar, LevelUpCelebration,
  type Work, type GamiProfile, type GamiBadge,
} from '@/contexts/GamificationSystem';

const { width: SW, height: SH } = Dimensions.get('window');
let _H: any = null;
if (Platform.OS !== 'web') { try { _H = require('expo-haptics'); } catch {} }
const hL = () => _H?.impactAsync?.(_H.ImpactFeedbackStyle?.Light  ).catch(() => {});

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg      : '#04080F',
  card    : '#0D2040',   // fond unique badges / cartes
  navy    : '#0A1830',
  white   : '#FFFFFF',
  text    : 'rgba(255,255,255,0.88)',
  muted   : 'rgba(255,255,255,0.42)',
  subtle  : 'rgba(255,255,255,0.14)',
  faint   : 'rgba(255,255,255,0.06)',
  border  : 'rgba(255,255,255,0.09)',
  borderHi: 'rgba(255,255,255,0.20)',
  gold    : '#F5C842',
  goldFaint: 'rgba(245,200,66,0.13)',
  goldBd  : 'rgba(245,200,66,0.28)',
  blue    : '#5A96E6',  blueFaint : 'rgba(90,150,230,0.11)',
  green   : '#2ECC8A',  greenFaint: 'rgba(46,204,138,0.11)',
  purple  : '#9B6BFF',  purpleFaint:'rgba(155,107,255,0.12)',
  cyan    : '#4DD8E8',  cyanFaint : 'rgba(77,216,232,0.11)',
  red     : '#FF5C72',
  orange  : '#FF8C42',
} as const;
const E = 20;
const fmtK   = (n:number)=>n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
const fmtDur = (m:number|null)=>{ if(!m)return''; if(m>=60)return`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`; return`${m}m`; };

// Module-level singleton — survives component remounts and tab switches.
// Prevents LevelUpCelebration from replaying on Supabase hydration.
const _lastCelebratedLevel = new Map<string, number>();

// ─── ATOMS ───────────────────────────────────────────────────────────────────
const Shimmer=memo(({w,h,r=8}:{w:number|string;h:number;r?:number})=>{
  const op=useRef(new Animated.Value(0.15)).current;
  useEffect(()=>{const a=Animated.loop(Animated.sequence([Animated.timing(op,{toValue:0.34,duration:900,useNativeDriver:true}),Animated.timing(op,{toValue:0.15,duration:900,useNativeDriver:true})]));a.start();return()=>a.stop();},[]);
  return<Animated.View style={{width:w as any,height:h,borderRadius:r,backgroundColor:C.card,opacity:op}}/>;
});

// ─── ICÔNE PAR NIVEAU — cosmétique seule ; le niveau/titre/XP viennent tous
// de GamificationSystem.useGamification (cinephile_profiles), jamais recalculés ici.
const LEVEL_ICONS = ['star-outline','sparkles-outline','flash-outline','rocket-outline','flash-outline','nuclear-outline','infinite-outline','planet-outline','planet-outline','planet-outline'] as const;
const levelIcon = (level:number) => LEVEL_ICONS[Math.min(Math.max(level,1),10)-1];

// ─── DÉFIS DU JOUR — 8 actions ancrées dans les vraies features de l'app ────
const DAILY_POOL = [
  { id:'upload',     icon:'cloud-upload-outline'  as const, title:'Premier Clap',     desc:"Importer et publier une nouvelle vidéo dans Universe",           xp:80, total:1, cta:'Créer'     },
  { id:'comment',    icon:'chatbubble-outline'     as const, title:'Retour Créateur',  desc:"Laisser un commentaire sur une critique ou un post",              xp:35, total:1, cta:'Commenter' },
  { id:'watch',      icon:'play-circle-outline'    as const, title:'Scout du Jour',    desc:"Visionner un reel ou une vidéo sur le feed principal",            xp:30, total:1, cta:'Visionner' },
  { id:'write_crit', icon:'create-outline'         as const, title:'Plume Critique',   desc:"Rédiger et publier une critique argumentée sur une œuvre",        xp:60, total:1, cta:'Rédiger'   },
  { id:'like_crit',  icon:'heart-outline'          as const, title:'Coup de Cœur',    desc:"Liker le commentaire ou la critique d'un autre membre",           xp:20, total:1, cta:'Explorer'  },
  { id:'like_reel',  icon:'thumbs-up-outline'      as const, title:'Applaudissement',  desc:"Liker une vidéo ou un reel dans le feed Reels",                   xp:20, total:1, cta:'Feed'      },
  { id:'share',      icon:'share-outline'          as const, title:'Porte-Voix',       desc:"Partager une vidéo par mail, message ou WhatsApp",                xp:30, total:1, cta:'Partager'  },
  { id:'favorite',   icon:'bookmark-outline'       as const, title:'Cinémathèque',     desc:"Mettre une vidéo ou un film en favoris dans ta liste",            xp:25, total:1, cta:'Explorer'  },
] as const;
type DailyTpl = typeof DAILY_POOL[number];
type DailyId  = DailyTpl['id'];

// Tous les défis affichés chaque jour — 8 actions, 1 par feature
function todaysChallenges(): DailyTpl[] { return [...DAILY_POOL] as DailyTpl[]; }

// ─── FOMO + EN-TÊTE ROTATIF DU BOUTON ────────────────────────────────────────
const FOMO = [
  "Tu es à quelques XP du prochain niveau — continue.",
  "3 cinéphiles t'ont dépassé cette nuit.",
  "Ton streak risque de s'effacer avant demain.",
  "Un créateur indépendant a besoin de toi ce soir.",
  "5 pépites non découvertes ce soir — prends-les.",
  "Ta prochaine critique pourrait lancer une carrière.",
  "47 créateurs actifs en ce moment.",
  "Une critique = 50 XP. C'est maintenant ou jamais.",
  "Ton badge « Cinéphile » est presque là.",
  "Un professionnel attend peut-être ton message.",
  "Chaque film visionné = +20 XP directs.",
  "Sois le premier à noter ce film.",
  "Ton univers ne grandit pas sans toi.",
  "3 minutes d'action = XP garantis.",
  "XP gratuits — juste là, maintenant.",
  "Chaque défi terminé = badge en approche.",
  "Qui soutiendra le cinéma indé aujourd'hui ? Toi.",
];
const SECTIONS = [
  { label:'Galaxie XP', icon:'planet-outline'   as const },
  { label:'Cosmos',     icon:'infinite-outline' as const },
] as const;

// ─── HOOK DÉFIS DU JOUR — Supabase daily_checkins ────────────────────────────
function useDailyChallenges(userId:string) {
  const today = useMemo(()=>new Date().toISOString().split('T')[0],[]);
  const challenges = useMemo(()=>todaysChallenges(),[today]);
  const [progress, setProgress] = useState<Record<string,number>>({});
  const [claimed,  setClaimed]  = useState<DailyId[]>([]);

  useEffect(()=>{
    if(!userId)return;
    supabase.from('daily_checkins')
      .select('badge_id,claimed,steps_done')
      .eq('user_id',userId).eq('date',today)
      .then(({data})=>{
        if(!data)return;
        setClaimed(data.filter(r=>r.claimed&&r.badge_id).map(r=>r.badge_id as DailyId));
        const p:Record<string,number>={};
        data.forEach(r=>{ if(r.badge_id&&r.steps_done!=null)p[r.badge_id]=r.steps_done; });
        setProgress(p);
      },()=>{});
  },[userId,today]);

  const bump=useCallback((id:DailyId,total:number)=>{
    setProgress(p=>({...p,[id]:Math.min((p[id]??0)+1,total)}));
    if(!userId)return;
    supabase.from('daily_checkins').upsert({
      user_id:userId,date:today,badge_id:id,steps_done:1,claimed:false,xp_earned:0,streak_day:1,
    }).then(()=>{},()=>{});
  },[userId,today]);

  const claimChallenge=useCallback((id:DailyId,xp:number)=>{
    if(claimed.includes(id))return;
    setClaimed(c=>[...c,id]);
    if(!userId)return;
    supabase.from('daily_checkins').upsert({
      user_id:userId,date:today,badge_id:id,steps_done:1,claimed:true,xp_earned:xp,streak_day:1,
    }).then(()=>{},()=>{});
  },[claimed,userId,today]);

  return{challenges,progress,claimed,bump,claimChallenge};
}

// ─── DAILY ROW ────────────────────────────────────────────────────────────────
const DailyRow=memo(({ch,progress:rawProg,claimed,onClaim,onAction}:{
  ch:DailyTpl;progress:number;claimed:boolean;onClaim:()=>void;onAction:()=>void;
})=>{
  const p=rawProg/ch.total;
  const done=p>=1||claimed;
  const barAnim=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(barAnim,{toValue:done?1:p,duration:700,easing:Easing.out(Easing.quad),useNativeDriver:false}).start();},[done,p]);
  return(
    <View style={{marginBottom:9,borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:done?C.goldBd:'rgba(255,255,255,0.08)'}}>
      <LinearGradient
        colors={done?['rgba(245,200,66,0.11)','rgba(13,26,54,0.97)']:['rgba(13,26,54,0.94)','rgba(4,8,15,0.98)']}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={{paddingHorizontal:14,paddingVertical:13,flexDirection:'row',alignItems:'center',gap:12}}>
        {/* Icon */}
        <View style={{width:42,height:42,borderRadius:13,backgroundColor:done?C.goldFaint:'rgba(255,255,255,0.05)',borderWidth:1,borderColor:done?C.goldBd:'rgba(255,255,255,0.09)',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <Ionicons name={done?'checkmark-circle':ch.icon} size={done?20:18} color={done?C.gold:C.muted}/>
        </View>
        {/* Body */}
        <View style={{flex:1,gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}>
            <Text style={{color:done?C.gold:C.white,fontSize:12,fontWeight:'800',flex:1}} numberOfLines={1}>{ch.title}</Text>
            <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
              <Ionicons name="flash" size={9} color={C.gold}/>
              <Text style={{color:C.gold,fontSize:11,fontWeight:'800'}}>+{ch.xp}</Text>
            </View>
          </View>
          <View style={{height:2.5,backgroundColor:'rgba(255,255,255,0.07)',borderRadius:2,overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:done?C.gold:'rgba(255,255,255,0.45)',width:barAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/>
          </View>
          <Text style={{color:C.muted,fontSize:10,lineHeight:14}} numberOfLines={2}>{ch.desc}</Text>
        </View>
        {/* CTA */}
        <View style={{flexShrink:0}}>
          {claimed&&<View style={{width:30,height:30,borderRadius:15,backgroundColor:'rgba(245,200,66,0.12)',borderWidth:1,borderColor:C.goldBd,alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={14} color={C.gold}/></View>}
          {!claimed&&done&&<TouchableOpacity onPress={()=>{hL();onClaim();}} style={{backgroundColor:C.gold,borderRadius:11,paddingHorizontal:13,paddingVertical:8}} activeOpacity={0.82}><Text style={{color:C.bg,fontSize:11,fontWeight:'900'}}>CLAIM</Text></TouchableOpacity>}
          {!claimed&&!done&&<TouchableOpacity onPress={()=>{hL();onAction();}} style={{borderRadius:11,paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderColor:C.goldBd,backgroundColor:C.goldFaint}} activeOpacity={0.82}><Text style={{color:C.gold,fontSize:11,fontWeight:'700'}}>{ch.cta}</Text></TouchableOpacity>}
        </View>
      </LinearGradient>
    </View>
  );
});

// ─── GALAXY MODAL — helpers ───────────────────────────────────────────────────
const RARITY_COLOR:Record<string,string>={commun:'rgba(255,255,255,0.38)',rare:'#5A96E6',épique:'#9B6BFF',légendaire:'#F5C842'};
const streakMultiplier=(d:number)=>d>=30?2.0:d>=14?1.5:d>=7?1.25:d>=3?1.1:1.0;
const XP_TIPS=[
  {icon:'videocam-outline', color:C.orange, title:'Publier une vidéo',    desc:'Upload un reel ou projet complet',          xp:80},
  {icon:'create-outline',   color:C.purple, title:'Rédiger une critique', desc:'Analyse argumentée sur une œuvre',          xp:60},
  {icon:'compass-outline',  color:C.blue,   title:'Découvrir une pépite', desc:'Like/commente une œuvre < 100 likes',       xp:40},
  {icon:'person-outline',   color:C.cyan,   title:'Compléter le profil',  desc:'Avatar, bio, localisation, spécialité',     xp:45},
  {icon:'flame-outline',    color:C.orange, title:'Maintenir son streak', desc:'7 jours consécutifs = ×1.25 XP',           xp:175},
] as const;

// ─── GALAXY MODAL — Cosmos + Défis du jour ; XP réel via GamificationSystem ──
const GalaxyModal=memo(({
  visible,onClose,profile,awardXP,daily,userId,badges,
}:{
  visible:boolean;onClose:()=>void;
  profile:GamiProfile;
  awardXP:(amount:number,reason:string)=>void;
  daily:ReturnType<typeof useDailyChallenges>;
  userId:string;badges:GamiBadge[];
})=>{
  const router=useRouter(),insets=useSafeAreaInsets();
  const slideY=useRef(new Animated.Value(SH)).current;
  const[burst,setBurst]=useState({v:false,n:0});
  const[levelUp,setLevelUp]=useState<{level:number;title:string}|null>(null);
  const[activeBadge,setActiveBadge]=useState<string|null>(null);
  const[tipsOpen,setTipsOpen]=useState(false);

  // Singleton-based guard: only fire for genuine in-session level gains.
  // Module-level map survives remounts and tab switches — immune to hydration.
  useEffect(()=>{
    if(!userId||profile.level===0)return;
    const last=_lastCelebratedLevel.get(userId);
    if(last===undefined){
      // First time we see this user — set baseline, no celebration
      _lastCelebratedLevel.set(userId,profile.level);
      return;
    }
    if(profile.level>last){
      setLevelUp({level:profile.level,title:profile.title});
      _lastCelebratedLevel.set(userId,profile.level);
    }
  },[userId,profile.level,profile.title]);

  useEffect(()=>{
    if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:62,friction:11}).start();}
    else{Animated.timing(slideY,{toValue:SH,duration:280,useNativeDriver:true}).start();}
  },[visible]);

  const showBurst=useCallback((n:number)=>{setBurst({v:true,n});setTimeout(()=>setBurst({v:false,n:0}),1300);},[]);
  const handleClaim=useCallback((id:DailyId,xp:number)=>{daily.claimChallenge(id,xp);awardXP(xp,`défi_du_jour_${id}`);showBurst(xp);},[daily,awardXP,showBurst]);
  const go=useCallback((route:string)=>{onClose();setTimeout(()=>router.push(route as any),320);},[onClose,router]);

  const dailyActions:Partial<Record<DailyId,()=>void>>={
    upload:     ()=>go('/(tabs)/create'),
    comment:    ()=>go('/(tabs)/social'),
    watch:      ()=>go('/(tabs)'),
    write_crit: ()=>go('/(tabs)/create'),
    like_crit:  ()=>go('/(tabs)/social'),
    like_reel:  ()=>go('/(tabs)'),
    share:      ()=>go('/(tabs)'),
    favorite:   ()=>go('/(tabs)/search'),
  };

  const mult=streakMultiplier(profile.streak_days);
  const claimedToday=daily.claimed.length;
  const activeBadgeData=useMemo(()=>badges.find(b=>b.id===activeBadge),[badges,activeBadge]);

  if(!visible)return null;
  return(
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{flex:1,backgroundColor:'rgba(4,8,15,0.92)'}}>
        <GalaxyBackground/>
        <Animated.View style={{flex:1,transform:[{translateY:slideY}]}}>
          {/* Header */}
          <View style={{paddingTop:insets.top+12,paddingHorizontal:E,paddingBottom:14,flexDirection:'row',alignItems:'center'}}>
            <View style={{flex:1}}>
              <Text style={{color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.5}}>Galaxie XP</Text>
              <Text style={{color:C.muted,fontSize:12,marginTop:1}}>{profile.xp.toLocaleString()} XP · {profile.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{width:38,height:38,borderRadius:19,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
              <Ionicons name="close" size={18} color={C.white}/>
            </TouchableOpacity>
          </View>
          <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginBottom:4}}/>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{padding:E,paddingBottom:52}}>
            {/* XP bar */}
            <GamiXPBar profile={profile}/>

            {/* Streak card — tappable, goes to home to keep streak alive */}
            {profile.streak_days>0&&(
              <TouchableOpacity activeOpacity={0.82} onPress={()=>go('/(tabs)')}
                style={{flexDirection:'row',alignItems:'center',gap:12,marginTop:12,padding:13,borderRadius:14,borderWidth:1,borderColor:'rgba(255,140,66,0.28)',backgroundColor:'rgba(255,140,66,0.07)'}}>
                <View style={{width:40,height:40,borderRadius:12,backgroundColor:'rgba(255,140,66,0.15)',borderWidth:1,borderColor:'rgba(255,140,66,0.38)',alignItems:'center',justifyContent:'center'}}>
                  <Ionicons name="flame" size={19} color={C.orange}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={{color:C.white,fontSize:13,fontWeight:'800'}}>Streak · {profile.streak_days} jour{profile.streak_days>1?'s':''}</Text>
                  <Text style={{color:C.muted,fontSize:10,marginTop:1}}>Multiplicateur actif — connexion quotidienne</Text>
                </View>
                <View style={{paddingHorizontal:10,paddingVertical:6,borderRadius:10,backgroundColor:'rgba(255,140,66,0.15)',borderWidth:1,borderColor:'rgba(255,140,66,0.38)',alignItems:'center'}}>
                  <Text style={{color:C.orange,fontSize:14,fontWeight:'900'}}>×{mult.toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Badges earned — horizontal scrollable, tap for description */}
            {badges.length>0&&(
              <>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:20,marginBottom:10}}>
                  <Ionicons name="ribbon-outline" size={13} color={C.gold}/>
                  <Text style={{color:C.white,fontSize:15,fontWeight:'800',flex:1}}>Badges débloqués</Text>
                  <Text style={{color:C.muted,fontSize:11}}>{badges.length}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8,paddingRight:4}}>
                  {badges.map(b=>{
                    const col=RARITY_COLOR[b.rarity]??C.muted;
                    const active=activeBadge===b.id;
                    return(
                      <TouchableOpacity key={b.id} onPress={()=>{hL();setActiveBadge(active?null:b.id);}} activeOpacity={0.78} style={{width:72,alignItems:'center',gap:5}}>
                        <View style={{width:52,height:52,borderRadius:16,backgroundColor:`${col}18`,borderWidth:active?1.5:1,borderColor:active?col:`${col}40`,alignItems:'center',justifyContent:'center'}}>
                          <Ionicons name={b.icon} size={22} color={col}/>
                        </View>
                        <Text style={{color:active?col:C.muted,fontSize:9,fontWeight:'700',textAlign:'center',lineHeight:12}} numberOfLines={2}>{b.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                {activeBadgeData&&(
                  <View style={{marginTop:8,padding:11,borderRadius:12,backgroundColor:C.faint,borderWidth:1,borderColor:C.border,flexDirection:'row',alignItems:'flex-start',gap:8}}>
                    <Ionicons name="information-circle-outline" size={13} color={C.muted} style={{marginTop:1}}/>
                    <Text style={{color:C.muted,fontSize:11,flex:1,lineHeight:16}}>{activeBadgeData.description}</Text>
                  </View>
                )}
              </>
            )}

            {/* Claimed today summary */}
            {claimedToday>0&&(
              <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:16,marginBottom:4}}>
                <Ionicons name="checkmark-circle" size={12} color={C.gold}/>
                <Text style={{color:C.muted,fontSize:11}}>{claimedToday} défi{claimedToday>1?'s':''} réclamé{claimedToday>1?'s':''} aujourd'hui</Text>
              </View>
            )}

            {/* Daily challenges */}
            <Text style={{color:C.white,fontSize:15,fontWeight:'800',marginTop:18,marginBottom:4}}>Défis du jour</Text>
            <Text style={{color:C.muted,fontSize:11,marginBottom:10,fontStyle:'italic'}}>Renouvelés à minuit — XP réel au CLAIM</Text>
            {daily.challenges.map(ch=>(
              <DailyRow key={ch.id} ch={ch} progress={daily.progress[ch.id]??0} claimed={daily.claimed.includes(ch.id)}
                onClaim={()=>handleClaim(ch.id,ch.xp)}
                onAction={()=>{daily.bump(ch.id,ch.total);dailyActions[ch.id]?.();}}/>
            ))}

            {/* XP Tips accordion */}
            <TouchableOpacity onPress={()=>setTipsOpen(x=>!x)} activeOpacity={0.78}
              style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:18,paddingVertical:12,paddingHorizontal:13,borderRadius:14,backgroundColor:C.faint,borderWidth:1,borderColor:C.border}}>
              <Ionicons name="bulb-outline" size={14} color={C.gold}/>
              <Text style={{color:C.gold,fontSize:13,fontWeight:'700',flex:1}}>Comment gagner plus de XP ?</Text>
              <Ionicons name={tipsOpen?'chevron-up-outline':'chevron-down-outline'} size={13} color={C.muted}/>
            </TouchableOpacity>
            {tipsOpen&&(
              <View style={{marginTop:6,gap:6}}>
                {XP_TIPS.map((t,i)=>(
                  <View key={i} style={{flexDirection:'row',alignItems:'center',gap:10,padding:11,borderRadius:12,backgroundColor:C.faint,borderWidth:1,borderColor:C.border}}>
                    <View style={{width:32,height:32,borderRadius:9,backgroundColor:`${t.color}18`,borderWidth:1,borderColor:`${t.color}30`,alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <Ionicons name={t.icon as any} size={14} color={t.color}/>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={{color:C.white,fontSize:11,fontWeight:'700'}}>{t.title}</Text>
                      <Text style={{color:C.muted,fontSize:10,marginTop:1}}>{t.desc}</Text>
                    </View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:2,flexShrink:0}}>
                      <Ionicons name="flash" size={9} color={C.gold}/>
                      <Text style={{color:C.gold,fontSize:11,fontWeight:'800'}}>+{t.xp}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
          <XPFloat amount={burst.n} visible={burst.v} onDone={()=>{}}/>
        </Animated.View>
      </View>
      <LevelUpCelebration level={levelUp?.level??1} title={levelUp?.title??''} visible={!!levelUp} onClose={()=>setLevelUp(null)}/>
    </Modal>
  );
});

// ─── GAMIFICATION BADGE — bouton d'entrée (identique à l'original) ──────────
const GamificationBadge=memo(({profile,earnedCount,onPress}:{profile:GamiProfile;earnedCount:number;onPress:()=>void;})=>{
  const[si,setSi]=useState(0);const fade=useRef(new Animated.Value(1)).current;const btnSc=useRef(new Animated.Value(1)).current;const glowOp=useRef(new Animated.Value(0.26)).current;
  useEffect(()=>{const l=Animated.loop(Animated.sequence([Animated.timing(glowOp,{toValue:0.95,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),Animated.timing(glowOp,{toValue:0.26,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true})]));l.start();return()=>l.stop();},[]);
  useEffect(()=>{const t=setInterval(()=>{Animated.timing(fade,{toValue:0,duration:200,useNativeDriver:true}).start(()=>{setSi(i=>(i+1)%SECTIONS.length);Animated.timing(fade,{toValue:1,duration:260,useNativeDriver:true}).start();});},3600);return()=>clearInterval(t);},[]);
  const press=()=>{hL();Animated.sequence([Animated.timing(btnSc,{toValue:0.94,duration:80,useNativeDriver:true}),Animated.spring(btnSc,{toValue:1,tension:300,friction:8,useNativeDriver:true})]).start(onPress);};
  const sec=SECTIONS[si];const phrase=FOMO[Math.floor((profile.xp+si*37)%FOMO.length)];
  const fmtXP=(n:number)=>n>=1000?`${(n/1000).toFixed(1)}k`:`${n}`;
  const glowStyle:any={position:'absolute',top:-3,bottom:-3,left:-3,right:-3,borderRadius:21,...(Platform.OS==='web'?{boxShadow:`0 0 24px 8px rgba(245,200,66,0.42), 0 0 8px 2px rgba(245,200,66,0.18)`}:{shadowColor:C.gold,shadowOffset:{width:0,height:0},shadowOpacity:0.82,shadowRadius:16,elevation:8})};
  return(
    <TouchableOpacity onPress={press} activeOpacity={1} style={{marginHorizontal:E}}>
      <Animated.View style={{transform:[{scale:btnSc}]}}>
        <Animated.View style={[glowStyle,{opacity:glowOp}]} pointerEvents="none"/>
        <LinearGradient colors={['rgba(245,200,66,0.12)','rgba(13,32,64,0.88)','rgba(4,8,15,0.97)']} start={{x:0,y:0}} end={{x:1,y:1}} style={{height:88,borderRadius:18,paddingHorizontal:17,borderWidth:1,borderColor:C.goldBd,flexDirection:'row',alignItems:'center',gap:14}}>
          <View style={{width:46,height:46,borderRadius:14,flexShrink:0,backgroundColor:C.goldFaint,borderWidth:1.5,borderColor:C.goldBd,alignItems:'center',justifyContent:'center'}}>
            <Ionicons name={levelIcon(profile.level)} size={21} color={C.gold}/>
          </View>
          <View style={{flex:1,gap:4}}>
            <Animated.View style={{opacity:fade,flexDirection:'row',alignItems:'center',gap:6}}>
              <Ionicons name={sec.icon} size={11} color={C.gold}/>
              <Text style={{color:C.gold,fontSize:12,fontWeight:'900',letterSpacing:0.4}}>{sec.label}</Text>
              <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.goldFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd}}>
                <Text style={{color:C.gold,fontSize:9,fontWeight:'800'}}>NIV.{profile.level}</Text>
              </View>
            </Animated.View>
            <Animated.Text style={{color:C.muted,fontSize:11,fontStyle:'italic',opacity:fade}} numberOfLines={1}>{phrase}</Animated.Text>
            <View style={{height:3,backgroundColor:C.subtle,borderRadius:2,overflow:'hidden'}}>
              <View style={{height:'100%',borderRadius:2,backgroundColor:C.gold,width:`${profile.pct*100}%` as any}}/>
            </View>
          </View>
          <View style={{alignItems:'flex-end',gap:5,flexShrink:0}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="flash" size={11} color={C.gold}/><Text style={{color:C.gold,fontSize:13,fontWeight:'900'}}>{fmtXP(profile.xp)}</Text></View>
            {profile.streak_days>0&&<Text style={{color:C.gold,fontSize:10,fontWeight:'800'}}>★{profile.streak_days}j</Text>}
            {earnedCount>0&&<Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{earnedCount} badges</Text>}
            <Ionicons name="chevron-forward" size={13} color={C.muted}/>
          </View>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ─── FETCH ───────────────────────────────────────────────────────────────────
const COLS='id,title,category,genre,year,likes,image,is_original,adjective,duration,director,created_at';
async function fetchWorks():Promise<Work[]>{const{data,error}=await supabase.from('works').select(COLS).order('likes',{ascending:false}).limit(200);if(error){const{data:fb}=await supabase.from('works').select(COLS).limit(100);return(fb??[])as Work[];}return(data??[])as Work[];}

// ─── HERO ─────────────────────────────────────────────────────────────────────
const HERO_H=SH*0.50;
const HeroSlide=memo(({item,W,onPress}:{item:Work;W:number;onPress:()=>void})=>{
  const fade=useRef(new Animated.Value(0)).current;const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  return(<TouchableOpacity activeOpacity={0.95} onPress={onPress} style={{width:W,height:HERO_H}}><View style={[StyleSheet.absoluteFill,{backgroundColor:C.card}]}/><Animated.Image source={{uri}} style={[StyleSheet.absoluteFill,{opacity:fade}]} resizeMode="cover" onLoad={()=>Animated.timing(fade,{toValue:1,duration:400,useNativeDriver:true}).start()}/><LinearGradient colors={['rgba(4,8,15,0.48)','transparent']} style={{position:'absolute',top:0,left:0,right:0,height:130}} pointerEvents="none"/><LinearGradient colors={['transparent','rgba(4,8,15,0.72)','rgba(4,8,15,0.97)']} style={{position:'absolute',bottom:0,left:0,right:0,height:'65%' as any}} pointerEvents="none"/><View style={hs.c}><View style={{flexDirection:'row',gap:6}}>{item.is_original&&<View style={hs.orig}><Text style={hs.origT}>★ ORIGINAL</Text></View>}{(item.likes??0)<100&&<View style={hs.pep}><Text style={hs.pepT}>PÉPITE</Text></View>}</View><Text style={hs.title} numberOfLines={2}>{item.title??''}</Text>{!!(item.adjective||item.genre)&&<Text style={hs.sub} numberOfLines={1}>{item.adjective||`${item.genre??''}${item.year?` · ${item.year}`:''}`}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={11} color={C.muted}/><Text style={hs.stat}>{fmtK(item.likes??0)}</Text></View>{item.duration!=null&&<><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.faint}}/><Text style={hs.stat}>{fmtDur(item.duration)}</Text></>}</View><View style={hs.actions}><TouchableOpacity style={hs.play} onPress={onPress} activeOpacity={0.85}><Ionicons name="play" size={14} color={C.bg}/><Text style={{color:C.bg,fontSize:13,fontWeight:'700'}}>Regarder</Text></TouchableOpacity><TouchableOpacity style={hs.info} onPress={onPress} activeOpacity={0.80}><Ionicons name="information-circle-outline" size={14} color={C.white}/><Text style={{color:C.white,fontSize:13,fontWeight:'600'}}>Détails</Text></TouchableOpacity></View></View></TouchableOpacity>);
});
const hs=StyleSheet.create({c:{position:'absolute',bottom:0,left:0,right:0,paddingHorizontal:22,paddingBottom:50,gap:8},orig:{paddingHorizontal:8,paddingVertical:3,borderRadius:6,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldBd,backgroundColor:C.goldFaint},origT:{color:C.gold,fontSize:9,fontWeight:'800',letterSpacing:0.6},pep:{paddingHorizontal:8,paddingVertical:3,borderRadius:6,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},pepT:{color:C.white,fontSize:9,fontWeight:'800',letterSpacing:0.6},title:{color:C.white,fontSize:26,fontWeight:'800',letterSpacing:-0.4,lineHeight:32},sub:{color:C.muted,fontSize:13},stat:{color:C.muted,fontSize:11,fontWeight:'600'},actions:{flexDirection:'row',gap:10,marginTop:2},play:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.white,paddingHorizontal:20,paddingVertical:10,borderRadius:24},info:{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:C.faint,paddingHorizontal:16,paddingVertical:10,borderRadius:24,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}});

const HeroBanner=memo(({works,loading,onFilmPress}:{works:Work[];loading:boolean;onFilmPress:(item:Work)=>void})=>{
  const scrollX=useRef(new Animated.Value(0)).current;const flatRef=useRef<FlatList<Work>>(null);const timerRef=useRef<ReturnType<typeof setInterval>>();const paused=useRef(false),idxRef=useRef(0);const[slotW,setSlotW]=useState(SW);
  const scrollTo=useCallback((i:number)=>{if(!works.length||!slotW)return;const nx=((i%works.length)+works.length)%works.length;flatRef.current?.scrollToOffset({offset:nx*slotW,animated:true});idxRef.current=nx;},[works.length,slotW]);
  useEffect(()=>{if(works.length<2)return;clearInterval(timerRef.current);timerRef.current=setInterval(()=>{if(!paused.current)scrollTo(idxRef.current+1);},5200);return()=>clearInterval(timerRef.current);},[works.length,scrollTo]);
  const onScroll=useMemo(()=>Animated.event([{nativeEvent:{contentOffset:{x:scrollX}}}],{useNativeDriver:false}),[]);
  const renderItem=useCallback(({item}:ListRenderItemInfo<Work>)=><HeroSlide item={item} W={slotW} onPress={()=>onFilmPress(item)}/>,[slotW,onFilmPress]);
  const keyEx=useCallback((w:Work)=>`h${w.id}`,[]);
  if(loading||!works.length)return(<View style={{height:HERO_H,backgroundColor:C.card}}><View style={{...StyleSheet.absoluteFillObject,padding:22,justifyContent:'flex-end',gap:10}}><Shimmer w="50%" h={12}/><Shimmer w="74%" h={26}/><Shimmer w="40%" h={11}/><Shimmer w="52%" h={40} r={24}/></View></View>);
  const dc=Math.min(works.length,8);
  return(<View style={{height:HERO_H,overflow:'hidden'}} onLayout={e=>setSlotW(e.nativeEvent.layout.width)}><FlatList ref={flatRef} data={works} keyExtractor={keyEx} renderItem={renderItem} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16} onScrollBeginDrag={()=>{paused.current=true;}} onMomentumScrollEnd={e=>{idxRef.current=Math.round(e.nativeEvent.contentOffset.x/slotW);paused.current=false;}} windowSize={5} initialNumToRender={3} maxToRenderPerBatch={3} removeClippedSubviews={false}/>{works.length>1&&<View style={{position:'absolute',bottom:14,left:0,right:0,flexDirection:'row',justifyContent:'center',alignItems:'center',gap:5}}>{Array.from({length:dc}).map((_,i)=>{const inp=[(i-1)*slotW,i*slotW,(i+1)*slotW];return(<TouchableOpacity key={i} onPress={()=>scrollTo(i)} hitSlop={10}><Animated.View style={{height:3,borderRadius:2,backgroundColor:C.white,opacity:scrollX.interpolate({inputRange:inp,outputRange:[0.25,1,0.25],extrapolate:'clamp'}),width:scrollX.interpolate({inputRange:inp,outputRange:[6,20,6],extrapolate:'clamp'})}}/></TouchableOpacity>);})}</View>}</View>);
});

// ─── CARDS ───────────────────────────────────────────────────────────────────
const PW=128,PH=190,LW=226,LH=128;
const PortraitCard=memo(({item,rank,pep,onPress}:{item:Work;rank?:number;pep?:boolean;onPress?:(item:Work)=>void})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const handlePress=()=>{ onPress?.(item); router.push(`/film/${item.id}` as any); };
  return(<TouchableOpacity style={{marginRight:10}} onPress={handlePress} activeOpacity={0.88}><GlowAccentCard accentColor={C.gold} tier="subtle" borderRadius={12} style={pc.card}><Image source={{uri}} style={pc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/><View style={pc.badge}><Text style={pc.badgeT}>{item.is_original?'ORIG':(item.category??'').slice(0,4).toUpperCase()}</Text></View>{pep&&<View style={pc.pepite}><Text style={{color:C.white,fontSize:7,fontWeight:'800',letterSpacing:0.5}}>PÉPITE</Text></View>}{rank!=null&&<Text style={pc.rank}>{rank}</Text>}<View style={pc.meta}><Text style={pc.title} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={pc.stat}>{fmtK(item.likes??0)}</Text>{item.year&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={pc.stat}>{item.year}</Text></>}</View></View></GlowAccentCard></TouchableOpacity>);
});
const pc=StyleSheet.create({card:{width:PW,height:PH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%',resizeMode:'cover'},badge:{position:'absolute',top:7,left:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(4,8,15,0.75)'},badgeT:{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:0.4},pepite:{position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.16)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},rank:{position:'absolute',bottom:45,right:6,fontSize:48,fontWeight:'900',lineHeight:48,letterSpacing:-3,color:'rgba(255, 255, 255, 0.55)'},meta:{position:'absolute',bottom:8,left:9,right:9,gap:3},title:{color:C.white,fontSize:11,fontWeight:'700',lineHeight:14},stat:{color:C.muted,fontSize:9,fontWeight:'600'}});
const LandscapeCard=memo(({item,onPress}:{item:Work;onPress?:(item:Work)=>void})=>{
  const router=useRouter();const uri=useMemo(()=>resolveImg(item.id,item.image),[item.id,item.image]);
  const handlePress=()=>{ onPress?.(item); router.push(`/film/${item.id}` as any); };
  return(<TouchableOpacity style={{marginRight:10}} onPress={handlePress} activeOpacity={0.88}><GlowAccentCard accentColor={C.gold} tier="subtle" borderRadius={12} style={lc.card}><Image source={{uri}} style={lc.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.92)']} style={StyleSheet.absoluteFillObject} start={{x:0.3,y:0}} end={{x:1,y:1}}/>{item.duration!=null&&<View style={lc.dur}><Ionicons name="time-outline" size={8} color={C.muted}/><Text style={{color:C.muted,fontSize:8,fontWeight:'600'}}>{fmtDur(item.duration)}</Text></View>}<View style={lc.meta}><Text style={lc.title} numberOfLines={1}>{item.title}</Text>{!!item.adjective&&<Text style={{color:C.muted,fontSize:9}} numberOfLines={1}>{item.adjective}</Text>}<View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={lc.stat}>{fmtK(item.likes??0)}</Text>{item.director&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={lc.stat} numberOfLines={1}>{item.director}</Text></>}</View></View></GlowAccentCard></TouchableOpacity>);
});
const lc=StyleSheet.create({card:{width:LW,height:LH,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%',resizeMode:'cover'},dur:{position:'absolute',top:8,right:8,flexDirection:'row',alignItems:'center',gap:3,backgroundColor:'rgba(4,8,15,0.74)',paddingHorizontal:7,paddingVertical:3,borderRadius:7},meta:{position:'absolute',bottom:9,left:10,right:10,gap:2},title:{color:C.white,fontSize:12,fontWeight:'700'},stat:{color:C.muted,fontSize:9,fontWeight:'600',flexShrink:1}});

const RowSection=memo(({title,sub,count,items,loading,portrait,rank,pep,onItemPress}:{title:string;sub?:string;count?:number;items:Work[];loading:boolean;portrait:boolean;rank?:boolean;pep?:boolean;onItemPress?:(item:Work)=>void;})=>{
  const CW=portrait?PW:LW,CH=portrait?PH:LH,SNAP=CW+10;
  const renderItem=useCallback(({item,index}:{item:Work;index:number})=>portrait?<PortraitCard item={item} rank={rank?index+1:undefined} pep={pep&&(item.likes??0)<100} onPress={onItemPress}/>:<LandscapeCard item={item} onPress={onItemPress}/>,[portrait,rank,pep,onItemPress]);
  const getLayout=useCallback((_:any,i:number)=>({length:SNAP,offset:SNAP*i,index:i}),[SNAP]);
  const keyEx=useCallback((w:Work)=>`${portrait?'p':'l'}${w.id}`,[portrait]);
  if(loading)return<View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E,gap:10}}>{[0,1,2,3,4].map(i=><Shimmer key={i} w={CW} h={CH} r={12}/>)}</ScrollView></View>;
  if(!items.length)return null;
  return(<View>{!!title&&<View style={{paddingHorizontal:E,marginBottom:14,gap:2}}><Text style={{color:C.white,fontSize:17,fontWeight:'800',letterSpacing:-0.3}}>{title}</Text>{(sub||count!=null)&&<Text style={{color:C.muted,fontSize:11}}>{[sub,count!=null?`${count} œuvres`:null].filter(Boolean).join(' · ')}</Text>}</View>}<FlatList horizontal data={items} keyExtractor={keyEx} renderItem={renderItem} getItemLayout={getLayout} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:E}} decelerationRate="fast" snapToInterval={SNAP} snapToAlignment="start" initialNumToRender={6} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews/></View>);
});

// ─── SEARCH OVERLAY ──────────────────────────────────────────────────────────
const SearchOverlay=memo(({visible,onClose,works}:{visible:boolean;onClose:()=>void;works:Work[]})=>{
  const router=useRouter(),insets=useSafeAreaInsets();const[q,setQ]=useState('');const inputRef=useRef<TextInput>(null);const slideY=useRef(new Animated.Value(SH)).current;
  useEffect(()=>{if(visible){Animated.spring(slideY,{toValue:0,useNativeDriver:true,tension:65,friction:10}).start();const t=setTimeout(()=>inputRef.current?.focus(),300);return()=>clearTimeout(t);}else{setQ('');Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}},[visible]);
  const results=useMemo(()=>{if(!q.trim())return works.slice(0,40);const lo=q.toLowerCase();return works.filter(w=>(w.title??'').toLowerCase().includes(lo)||(w.genre??'').toLowerCase().includes(lo)||(w.director??'').toLowerCase().includes(lo)).slice(0,80);},[q,works]);
  const CW=(SW-42)/2;
  const goFilm=useCallback((id:number)=>{onClose();router.push(`/film/${id}` as any);},[onClose,router]);
  const renderR=useCallback(({item}:ListRenderItemInfo<Work>)=>(<TouchableOpacity style={[so.card,{width:CW}]} onPress={()=>goFilm(item.id)} activeOpacity={0.85}><Image source={{uri:resolveImg(item.id,item.image)}} style={so.img} resizeMode="cover"/><LinearGradient colors={['transparent','rgba(4,8,15,0.94)']} style={StyleSheet.absoluteFillObject}/>{(item.likes??0)<100&&<View style={so.pep}><Text style={{color:C.white,fontSize:7,fontWeight:'800'}}>PÉPITE</Text></View>}<View style={so.info}><Text style={so.iT} numberOfLines={2}>{item.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:5}}><Ionicons name="heart" size={9} color={C.muted}/><Text style={so.iM}>{fmtK(item.likes??0)}</Text>{item.duration!=null&&<><View style={{width:2,height:2,borderRadius:1,backgroundColor:C.faint}}/><Text style={so.iM}>{fmtDur(item.duration)}</Text></>}</View></View></TouchableOpacity>),[goFilm,CW]);
  if(!visible)return null;
  return(<Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent><GalaxyBackground/><Animated.View style={{flex:1,transform:[{translateY:slideY}]}}><View style={[so.top,{paddingTop:insets.top+10}]}><View style={so.row}><Ionicons name="search-outline" size={15} color={C.muted}/><TextInput ref={inputRef} style={so.input} value={q} onChangeText={setQ} placeholder="Titre, genre, réalisateur…" placeholderTextColor={C.muted} returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing" selectionColor={C.gold}/></View><TouchableOpacity onPress={onClose} style={{paddingLeft:8}}><Text style={{color:C.muted,fontSize:14,fontWeight:'600'}}>Annuler</Text></TouchableOpacity></View><View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:16,marginBottom:12}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.muted,fontSize:11}}>{results.length} résultat{results.length!==1?'s':''}{q.trim()?` · «\u00a0${q.trim()}\u00a0»`:''}</Text></View>{results.length===0?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:8}}><Text style={{color:C.gold,fontSize:28}}>★</Text><Text style={{color:C.muted,fontSize:14}}>Aucun résultat</Text></View>:<FlatList data={results} keyExtractor={w=>`s${w.id}`} renderItem={renderR} numColumns={2} columnWrapperStyle={{justifyContent:'space-between',gap:10,marginBottom:10}} contentContainerStyle={{paddingHorizontal:16,paddingBottom:insets.bottom+40}} keyboardDismissMode="on-drag" removeClippedSubviews initialNumToRender={8} maxToRenderPerBatch={10} windowSize={5}/>}</Animated.View></Modal>);
});
const so=StyleSheet.create({top:{flexDirection:'row',alignItems:'center',paddingHorizontal:14,paddingBottom:10,gap:8},row:{flex:1,flexDirection:'row',alignItems:'center',borderRadius:10,paddingHorizontal:12,height:40,gap:8,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},input:{flex:1,color:C.white,fontSize:14},card:{height:200,borderRadius:12,overflow:'hidden',backgroundColor:C.card},img:{width:'100%',height:'100%'},pep:{position:'absolute',top:7,right:7,paddingHorizontal:5,paddingVertical:2.5,borderRadius:5,backgroundColor:'rgba(255,255,255,0.18)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},info:{position:'absolute',bottom:8,left:9,right:9,gap:4},iT:{color:C.white,fontSize:12,fontWeight:'700'},iM:{color:C.muted,fontSize:10,fontWeight:'600'}});

// ══════════════════════════════════════════════════════════════════════════════
// ★★★ SEARCH SCREEN
// ══════════════════════════════════════════════════════════════════════════════
export default function SearchScreen(){
  const router=useRouter(),insets=useSafeAreaInsets();
  const[works,setWorks]=useState<Work[]>([]);const[loading,setLoading]=useState(true);
  const[srch,setSrch]=useState(false);
  const[galaxy,setGalaxy]=useState(false);
  const[userId,setUserId]=useState('');
  const scrollY=useRef(new Animated.Value(0)).current;
  const scrollRef=useRef<ScrollView>(null);

  // ★ XP/niveau réels — intrinsèquement liés à GamificationSystem (cinephile_profiles)
  const{profile:gamiProfile,earnedBadges,awardXP}=useGamification(userId);
  const daily=useDailyChallenges(userId);

  useEffect(()=>{getDeviceId().then(id=>setUserId(id));},[]);
  useEffect(()=>{let dead=false;setLoading(true);fetchWorks().then(d=>{if(!dead){setWorks(d);setLoading(false);}}).catch(()=>{if(!dead)setLoading(false);});return()=>{dead=true;};},[]);

  const hero     =useMemo(()=>works.slice(0,20),[works]);
  const popular  =useMemo(()=>works,[works]);
  const recent   =useMemo(()=>[...works].sort((a,b)=>{const da=a.created_at?new Date(a.created_at).getTime():0,db=b.created_at?new Date(b.created_at).getTime():0;return db-da;}).slice(0,30),[works]);
  const originals=useMemo(()=>works.filter(w=>w.is_original),[works]);
  const courts   =useMemo(()=>works.filter(w=>(w.duration??0)>0&&(w.duration??0)<60),[works]);
  const moyens   =useMemo(()=>works.filter(w=>(w.duration??0)>=60&&(w.duration??0)<=100),[works]);
  const longs    =useMemo(()=>works.filter(w=>(w.duration??0)>100),[works]);
  const pepites  =useMemo(()=>works.filter(w=>(w.likes??0)<100&&(w.likes??0)>5).sort((a,b)=>(b.likes??0)-(a.likes??0)).slice(0,20),[works]);

  const headerOp=scrollY.interpolate({inputRange:[0,80],outputRange:[1,0],extrapolate:'clamp'});
  const DIV=<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.faint,marginHorizontal:E,marginVertical:24}}/>;

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <Animated.View pointerEvents="box-none" style={{position:'absolute',top:5,left:0,right:0,zIndex:10,flexDirection:'row',alignItems:'center',paddingHorizontal:E,paddingTop:insets.top+4,paddingBottom:8,opacity:headerOp}}>
        <Text style={{flex:1,color:C.white,fontSize:30,fontWeight:'800',letterSpacing:-0.5}}>UNIVERSE</Text>
        <TouchableOpacity onPress={()=>{hL();setSrch(true);}} style={{width:38,height:38,borderRadius:19,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}} activeOpacity={0.78}>
          <Ionicons name="search-outline" size={18} color={C.white}/>
        </TouchableOpacity>
      </Animated.View>
      <SearchOverlay visible={srch} onClose={()=>setSrch(false)} works={works}/>
      <GalaxyModal visible={galaxy} onClose={()=>setGalaxy(false)} profile={gamiProfile} awardXP={awardXP} daily={daily} userId={userId} badges={earnedBadges}/>
      <Animated.ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:120}} scrollEventThrottle={16}
        onScroll={Animated.event([{nativeEvent:{contentOffset:{y:scrollY}}}],{useNativeDriver:true})}>
        <HeroBanner works={hero} loading={loading} onFilmPress={item=>router.push(`/film/${item.id}` as any)}/>
        <View style={{height:20}}/>
        <GamificationBadge profile={gamiProfile} earnedCount={earnedBadges.length} onPress={()=>setGalaxy(true)}/>
        <View style={{height:24}}/>
        <RowSection title="Les plus populaires" count={loading?undefined:works.length} items={popular} loading={loading} portrait rank/>
        {DIV}
        {(recent.length>0||loading)&&<><RowSection title="Récemment ajoutés" sub="Nouvelles œuvres" items={recent} loading={loading} portrait={false}/>{DIV}</>}
        {pepites.length>0&&<><View style={{paddingHorizontal:E,marginBottom:12,flexDirection:'row',alignItems:'center',gap:7}}><Text style={{color:C.gold,fontSize:13}}>★</Text><Text style={{color:C.white,fontSize:17,fontWeight:'800'}}>Pépites cachées</Text><View style={{marginLeft:'auto' as any,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi}}><Text style={{color:C.white,fontSize:9,fontWeight:'700'}}>À découvrir</Text></View></View><RowSection title="" items={pepites} loading={loading} portrait pep/>{DIV}</>}
        {(originals.length>0||loading)&&<><RowSection title="Originaux Universe" sub="Créations exclusives" count={loading?undefined:originals.length} items={originals} loading={loading} portrait/>{DIV}</>}
        {(courts.length>0||loading)&&<><RowSection title="Courts métrages" sub="Moins de 60 min" count={loading?undefined:courts.length} items={courts} loading={loading} portrait={false}/>{DIV}</>}
        {(moyens.length>0||loading)&&<><RowSection title="Moyens métrages" sub="60 – 100 min" count={loading?undefined:moyens.length} items={moyens} loading={loading} portrait={false}/>{DIV}</>}
        {(longs.length>0||loading)&&<RowSection title="Mini-séries & longs" sub="100 min+" count={loading?undefined:longs.length} items={longs} loading={loading} portrait={false}/>}
        <View style={{height:0}}/>
      </Animated.ScrollView>
    </View>
  );
}

