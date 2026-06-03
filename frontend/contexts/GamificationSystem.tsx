/**
 * contexts/GamificationSystem.tsx — UNIVERSE · Gamification v2
 *
 * ★ getDeviceId() / isValidUUID() — ZERO supabase.auth.* ni 'anonymous'
 * ★ 12 badges cinéphiles (doc Conception) : explorateur → légende
 * ★ 6 quêtes de découverte avec barre de progression
 * ★ Score de contribution : avis utiles · recommandations · commentaires
 * ★ Mécanique "Découvreur de pépites" : like avant 100 vues → badge
 * ★ Streak intelligent : 5 jours consécutifs → badge Rituel cinéphile
 * ★ Identité cinéphile évolutive : 10 titres progressifs
 * ★ Tous les composants mémoïsés + Realtime updates
 *
 * Exports publics :
 *   useGamification · useWeeklyChallenge · useQuests · useContributionScore
 *   XPBar · BadgesRow · BadgeChip · WeeklyChallengeCard · WeeklyChallengeModal
 *   QuestsPanel · ContributionCard
 *   xpToLevel · TITLES · XP_TABLE · CINEPHILE_BADGES_CATALOG · QUEST_DEFINITIONS
 */
import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
    Animated, Dimensions, FlatList, Image, Modal, Platform,
    ScrollView, StyleSheet, Text, TouchableOpacity, View,
  } from 'react-native';
  import { BlurView }          from 'expo-blur';
  import { Ionicons }          from '@expo/vector-icons';
  import { LinearGradient }    from 'expo-linear-gradient';
  import { useRouter }         from 'expo-router';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { supabase }          from '@/lib/supabase';
  import GalaxyBackground      from '@/components/social/GalaxyBackground';
  
  const { width: SW, height: SH } = Dimensions.get('window');
  
  // ─── PALETTE ──────────────────────────────────────────────────────────────────
  const C = {
    bg:'#070C17',navyMid:'#0D2040',navyLow:'#0A1830',
    white:'#FFFFFF',offWhite:'rgba(255,255,255,0.88)',
    mid:'rgba(255,255,255,0.55)',muted:'rgba(255,255,255,0.35)',
    faint:'rgba(255,255,255,0.07)',subtle:'rgba(255,255,255,0.13)',
    border:'rgba(255,255,255,0.09)',borderHi:'rgba(255,255,255,0.20)',
    blue:'#5A96E6',gold:'#F5C842',green:'#2ECC8A',
    red:'#FF3B5C',orange:'#F97316',purple:'#8B5CF6',
  } as const;
  
  // ─── CONSTANTES XP ───────────────────────────────────────────────────────────
  export const XP_TABLE = [0,100,300,700,1500,3000,6000,12000,25000,50000] as const;
  export const TITLES   = [
    'Spectateur curieux','Cinéphile émergent','Explorateur indé','Critique amateur',
    'Curateur underground','Chasseur de pépites','Ambassadeur cinéma',
    'Maître critique','Légende du 7ème art','Immortel du cinéma',
  ] as const;
  
  // ─── COULEURS RARETÉ / DIFFICULTÉ ─────────────────────────────────────────────
  const RARITY_COL: Record<string,string> = {
    commun:'rgba(255,255,255,0.55)',rare:C.blue,épique:C.purple,légendaire:C.gold,
  };
  const RARITY_LBL: Record<string,string> = {
    commun:'COMMUN',rare:'RARE',épique:'ÉPIQUE',légendaire:'LÉGENDAIRE',
  };
  const DIFF_COL: Record<string,string> = {
    facile:C.green,normal:C.blue,difficile:C.orange,légendaire:C.gold,
  };
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  export interface Work {
    id:number;title:string;category:string;genre:string;year:number;
    likes:number;image:string|null;is_original:boolean;duration:number|null;
  }
  export interface GamiBadge {
    id:string;label:string;description:string;icon:keyof typeof Ionicons.glyphMap;
    rarity:'commun'|'rare'|'épique'|'légendaire';xp_reward:number;
    earned:boolean;earned_at?:string;is_hidden:boolean;
  }
  export interface QuestDef {
    id:string;title:string;desc:string;target:number;
    reward_badge:string|null;xp:number;action:string;
    icon:keyof typeof Ionicons.glyphMap;tip:string;
  }
  export interface QuestProgress {
    quest_id:string;progress:number;completed:boolean;completed_at?:string;
  }
  export interface ContributionScore {
    total_score:number;useful_reviews:number;saved_recommendations:number;
    quality_comments:number;valid_reports:number;followed_playlists:number;
    shared_films:number;pepites_detected:number;
  }
  export interface ChallengeStep {
    index:number;title:string;desc:string;action:string;actionLabel:string;
    icon:keyof typeof Ionicons.glyphMap;xp:number;tip:string;
  }
  export interface WeeklyChallenge {
    id:number;week_number:number;title:string;subtitle:string|null;description:string;
    narrative:string|null;icon:keyof typeof Ionicons.glyphMap;color_accent:string;
    steps:ChallengeStep[];filter_config:{type:string;value?:any;max?:number}|null;
    reward_label:string|null;reward_points:number;reward_xp:number;
    difficulty:'facile'|'normal'|'difficile'|'légendaire';
  }
  export interface ChallengeProgress {
    step_index:number;steps_done:number[];completed:boolean;
    points_earned:number;xp_earned:number;time_spent_s:number;
  }
  export interface GamiProfile {
    xp:number;level:number;title:string;streak_days:number;
    xpToNext:number;xpInLevel:number;pct:number;contribution_score:number;
  }
  export interface GamiState {
    profile:GamiProfile;badges:GamiBadge[];
    earnedBadges:GamiBadge[];pendingBadges:GamiBadge[];
    loading:boolean;awardXP:(amount:number,reason:string)=>void;
    awardBadge:(badgeId:string)=>void;
  }
  
  // ─── ★ CATALOGUE BADGES CINÉPHILES (12 badges doc Conception) ───────────────
  export const CINEPHILE_BADGES_CATALOG: Omit<GamiBadge,'earned'|'earned_at'>[] = [
    {id:'explorateur_indie',    label:'Explorateur indé',         description:'10 courts-métrages visionnés.',                icon:'compass-outline',    rarity:'commun',     xp_reward:15, is_hidden:false},
    {id:'cinephile_nocturne',   label:'Cinéphile nocturne',        description:"Actif sur l'app après 22h.",                  icon:'moon-outline',       rarity:'commun',     xp_reward:5,  is_hidden:false},
    {id:'decouvreur_pepites',   label:'Découvreur de pépites',     description:'Liké un film avant 100 vues.',                icon:'star-outline',       rarity:'rare',       xp_reward:25, is_hidden:false},
    {id:'critique_herbe',       label:'Critique en herbe',         description:'5 avis argumentés (min. 50 mots) publiés.',   icon:'create-outline',     rarity:'rare',       xp_reward:40, is_hidden:false},
    {id:'festival_lover',       label:'Festival Lover',             description:'Sélection thématique complète regardée.',    icon:'trophy-outline',     rarity:'rare',       xp_reward:20, is_hidden:false},
    {id:'curateur_underground', label:'Curateur underground',      description:'3 playlists suivies par 10+ personnes.',      icon:'bookmark-outline',   rarity:'épique',     xp_reward:50, is_hidden:false},
    {id:'ambassadeur_indie',    label:'Ambassadeur indé',          description:'10 films partagés hors de l\app.',            icon:'share-outline',      rarity:'épique',     xp_reward:60, is_hidden:false},
    {id:'famille_cinemato',     label:'Famille cinématographique', description:'3 films du même réalisateur regardés.',       icon:'people-outline',     rarity:'commun',     xp_reward:10, is_hidden:false},
    {id:'esprit_ouvert',        label:'Esprit ouvert',              description:'Cinéma expérimental exploré.',               icon:'flask-outline',      rarity:'rare',       xp_reward:20, is_hidden:false},
    {id:'rituel_cinephile',     label:'Rituel cinéphile',          description:'1 film par jour pendant 5 jours.',            icon:'flame-outline',      rarity:'rare',       xp_reward:25, is_hidden:false},
    {id:'prescripteur',         label:'Prescripteur',               description:'Recommandation sauvegardée par 10+.',        icon:'thumbs-up-outline',  rarity:'épique',     xp_reward:30, is_hidden:false},
    {id:'legende_7art',         label:'Légende du 7ème art',       description:'50+ films vus, contribution exceptionnelle.', icon:'film-outline',       rarity:'légendaire', xp_reward:200,is_hidden:false},
  ];
  
  // ─── ★ QUÊTES DE DÉCOUVERTE (6 quêtes doc Conception) ────────────────────────
  export const QUEST_DEFINITIONS: QuestDef[] = [
    {id:'watch_3_same_director', title:'Famille cinématographique', desc:'Regarder 3 films du même réalisateur',       target:3, reward_badge:'famille_cinemato',     xp:20, action:'go_catalog', icon:'people-outline',      tip:'Cherchez "Trilogie" ou filtrez par réalisateur.'},
    {id:'watch_5_under_5min',    title:'Amateur de formats courts', desc:'Découvrir 5 films de moins de 5 minutes',    target:5, reward_badge:'explorateur_indie',    xp:25, action:'go_catalog', icon:'timer-outline',        tip:'Les courts-métrages sont dans la catégorie "Court".'},
    {id:'write_5_critiques',     title:'Voix critique',             desc:'Publier 5 critiques argumentées',            target:5, reward_badge:'critique_herbe',       xp:40, action:'go_social',  icon:'create-outline',       tip:'Un avis de 80+ mots est 3× plus utile.'},
    {id:'connect_1_pro',         title:'Réseau professionnel',      desc:'Se connecter à un professionnel du cinéma',  target:1, reward_badge:null,                   xp:15, action:'go_social',  icon:'briefcase-outline',    tip:'Les pros recherchent des talents indés.'},
    {id:'explore_experimental',  title:'Esprit ouvert',             desc:'Explorer le cinéma expérimental (3 films)',  target:3, reward_badge:'esprit_ouvert',        xp:20, action:'go_catalog', icon:'flask-outline',        tip:'Filtrez par genre "Expérimental".'},
    {id:'watch_5_consecutive',   title:'Rituel cinéphile',          desc:'1 film par jour pendant 5 jours',            target:5, reward_badge:'rituel_cinephile',     xp:30, action:'go_catalog', icon:'flame-outline',        tip:'La régularité construit une vraie cinéphilie.'},
  ];
  
  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  const isValidUUID = (v?:string|null) =>
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  
  export function xpToLevel(xp:number) {
    let level=1;
    for(let i=1;i<XP_TABLE.length;i++){ if(xp>=XP_TABLE[i])level=i+1;else break; }
    level=Math.min(level,10);
    const base=XP_TABLE[level-1];
    const next=level<10?XP_TABLE[level]:XP_TABLE[9]*2;
    const inLevel=xp-base, range=next-base;
    return{level,pct:range>0?Math.min(1,inLevel/range):1,xpInLevel:inLevel,xpToNext:Math.max(0,range-inLevel)};
  }
  
  export const resolveImg=(id:number,img:string|null)=>{
    if(!img)return`https://picsum.photos/seed/work_${id}/400/600`;
    if(img.startsWith('http'))return img;
    try{return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl;}
    catch{return`https://picsum.photos/seed/work_${id}/400/600`;}
  };
  
  function currentWeekNumber():number{
    const d=new Date();
    const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
    const day=date.getUTCDay()||7;
    date.setUTCDate(date.getUTCDate()+4-day);
    const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil(((date.getTime()-yearStart.getTime())/86400000+1)/7);
  }
  
  // ─── FALLBACK CHALLENGE ───────────────────────────────────────────────────────
  export const FALLBACK_CHALLENGE:WeeklyChallenge={
    id:0,week_number:currentWeekNumber(),
    title:"L'Éveil du Cinéphile",subtitle:'Chapitre I — Vos premiers pas',
    description:'Votre voyage dans le cinéma indépendant commence ici.',
    narrative:'Dans les rues de Paris, une affiche décrochée révèle un cinéma clandestin. Ce premier soir change tout.',
    icon:'film-outline',color_accent:C.blue,
    steps:[
      {index:0,title:'Créez votre profil',desc:'Personnalisez votre identité cinéphile.',action:'go_profile',actionLabel:'Mon profil',icon:'person-outline',xp:15,tip:'Un profil complet attire 3× plus de connexions.'},
      {index:1,title:'Premier visionnage',desc:"Regardez un reel jusqu'à la fin.",action:'go_catalog',actionLabel:'Explorer',icon:'play-circle-outline',xp:20,tip:'Les créateurs voient votre taux de complétion.'},
      {index:2,title:'Première critique',desc:'Écrivez 80 mots minimum sur un film.',action:'go_social',actionLabel:'Écrire',icon:'create-outline',xp:30,tip:'8 pts de score par critique publiée.'},
      {index:3,title:'Rejoignez les pros',desc:'Connectez-vous à un professionnel.',action:'go_social',actionLabel:'Voir les pros',icon:'briefcase-outline',xp:25,tip:'Universe connecte créateurs et industrie.'},
    ],
    filter_config:null,reward_label:'Badge Éveil',reward_points:40,reward_xp:90,difficulty:'facile',
  };
  
  // ═════════════════════════════════════════════════════════════════════════════
  // ★ HOOKS
  // ═════════════════════════════════════════════════════════════════════════════
  
  // ─── useGamification ─────────────────────────────────────────────────────────
  export function useGamification(userId:string, works:Work[]=[]): GamiState {
    const [profile, setProfile] = useState<GamiProfile>({
      xp:0,level:1,title:TITLES[0],streak_days:0,xpToNext:100,xpInLevel:0,pct:0,contribution_score:0,
    });
    const [badges,  setBadges]  = useState<GamiBadge[]>([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      Promise.all([
        supabase.from('cinephile_profiles').select('xp,level,title,streak_days,contribution_score').eq('user_id',userId).maybeSingle(),
        supabase.from('badges').select('id,label,description,icon,rarity,xp_reward,is_hidden').eq('is_hidden',false),
        supabase.from('user_badges').select('badge_id,earned_at').eq('user_id',userId),
      ]).then(([profR,badgesR,earnedR])=>{
        if(dead) return;
        if(profR.data){
          const{xp=0,level,title,streak_days=0,contribution_score=0}=profR.data as any;
          const lvl=xpToLevel(xp);
          setProfile({xp,level:level??lvl.level,title:title??TITLES[lvl.level-1],streak_days,contribution_score:contribution_score??0,...lvl});
        } else {
          supabase.from('cinephile_profiles').upsert({user_id:userId,xp:0},{onConflict:'user_id'}).catch(()=>{});
        }
        const earnedMap=new Map<string,string>((earnedR.data??[]).map((r:any)=>[r.badge_id,r.earned_at]));
        // Merge DB badges + catalog (fallback si badges table vide)
        const dbBadges=(badgesR.data??[]).map((b:any)=>({...b,earned:earnedMap.has(b.id),earned_at:earnedMap.get(b.id)??undefined})) as GamiBadge[];
        const merged = dbBadges.length>0 ? dbBadges : CINEPHILE_BADGES_CATALOG.map(b=>({...b,earned:earnedMap.has(b.id),earned_at:earnedMap.get(b.id)})) as GamiBadge[];
        setBadges(merged);
        setLoading(false);
      }).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
  
    const earnedBadges  = useMemo(()=>badges.filter(b=>b.earned),[badges]);
    const pendingBadges = useMemo(()=>badges.filter(b=>!b.earned),[badges]);
  
    // ★ awardXP — met à jour localement + DB
    const awardXP = useCallback(async(amount:number, reason:string)=>{
      if(!isValidUUID(userId)) return;
      await supabase.rpc('add_xp',{p_user_id:userId,p_xp:amount,p_reason:reason}).catch(()=>{});
      setProfile(prev=>{
        const newXp=prev.xp+amount;
        const lvl=xpToLevel(newXp);
        return{...prev,xp:newXp,...lvl,title:TITLES[lvl.level-1]};
      });
    },[userId]);
  
    // ★ awardBadge — octroie un badge et le XP associé
    const awardBadge = useCallback(async(badgeId:string)=>{
      if(!isValidUUID(userId)) return;
      const already=badges.find(b=>b.id===badgeId&&b.earned);
      if(already) return;
      const {error}=await supabase.from('user_badges').upsert({user_id:userId,badge_id:badgeId},{onConflict:'user_id,badge_id'});
      if(!error){
        const badge=badges.find(b=>b.id===badgeId);
        setBadges(prev=>prev.map(b=>b.id===badgeId?{...b,earned:true,earned_at:new Date().toISOString()}:b));
        if(badge?.xp_reward) awardXP(badge.xp_reward,`badge_${badgeId}`);
      }
    },[userId,badges,awardXP]);
  
    return{profile,badges,earnedBadges,pendingBadges,loading,awardXP,awardBadge};
  }
  
  // ─── useWeeklyChallenge ───────────────────────────────────────────────────────
  export function useWeeklyChallenge(userId:string){
    const[challenge,setChallenge]=useState<WeeklyChallenge>(FALLBACK_CHALLENGE);
    const[progress, setProgress] =useState<ChallengeProgress|null>(null);
    const[loading,  setLoading]  =useState(true);
    const weekNum=useMemo(()=>currentWeekNumber(),[]);
  
    useEffect(()=>{
      let dead=false;
      supabase.from('weekly_challenges')
        .select('id,week_number,title,subtitle,description,narrative,icon,color_accent,steps,filter_config,reward_label,reward_points,reward_xp,difficulty')
        .eq('week_number',weekNum).maybeSingle()
        .then(({data})=>{
          if(dead||!data)return;
          setChallenge({...data,steps:Array.isArray(data.steps)?data.steps:[],filter_config:data.filter_config??null,narrative:data.narrative??null,subtitle:data.subtitle??null,reward_label:data.reward_label??null} as WeeklyChallenge);
        }).catch(()=>{}).finally(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[weekNum]);
  
    useEffect(()=>{
      if(!isValidUUID(userId))return;
      let dead=false;
      supabase.from('challenge_progress').select('step_index,steps_done,completed,points_earned,xp_earned,time_spent_s').eq('user_id',userId).eq('week_number',weekNum).maybeSingle()
        .then(({data})=>{
          if(dead||!data)return;
          setProgress({step_index:data.step_index??0,steps_done:Array.isArray(data.steps_done)?data.steps_done:[],completed:data.completed??false,points_earned:data.points_earned??0,xp_earned:data.xp_earned??0,time_spent_s:data.time_spent_s??0});
        }).catch(()=>{});
      return()=>{dead=true;};
    },[userId,weekNum]);
  
    const upsertProgress=useCallback(async(stepIndex:number,completed:boolean)=>{
      if(!isValidUUID(userId))return;
      const total=challenge.steps.length;
      const points=completed?challenge.reward_points:Math.floor((challenge.reward_points??50)*stepIndex/Math.max(1,total));
      const xp=completed?challenge.reward_xp:Math.floor((challenge.reward_xp??0)*stepIndex/Math.max(1,total));
      const prevDone=progress?.steps_done??[];
      const steps_done=[...new Set([...prevDone,stepIndex])];
      const next:ChallengeProgress={step_index:stepIndex,steps_done,completed,points_earned:points,xp_earned:xp,time_spent_s:progress?.time_spent_s??0};
      setProgress(next);
      await supabase.from('challenge_progress').upsert({user_id:userId,week_number:weekNum,step_index:stepIndex,steps_done,completed,points_earned:points,xp_earned:xp,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id,week_number'}).catch(()=>{});
    },[userId,weekNum,challenge,progress]);
  
    return{challenge,progress,loading,upsertProgress};
  }
  
  // ─── ★ useQuests — suivi des 6 quêtes ─────────────────────────────────────────
  export function useQuests(userId:string){
    const[questProgress,setQuestProgress]=useState<Map<string,QuestProgress>>(new Map());
    const[loading,setLoading]=useState(true);
  
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      supabase.from('user_quests').select('quest_id,progress,completed,completed_at').eq('user_id',userId)
        .then(({data})=>{
          if(dead)return;
          const m=new Map<string,QuestProgress>();
          (data??[]).forEach((r:any)=>m.set(r.quest_id,{quest_id:r.quest_id,progress:r.progress??0,completed:r.completed??false,completed_at:r.completed_at??undefined}));
          setQuestProgress(m);
          setLoading(false);
        }).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
  
    // ★ Incrémenter progression d'une quête
    const incrementQuest=useCallback(async(questId:string, by=1)=>{
      if(!isValidUUID(userId))return;
      const def=QUEST_DEFINITIONS.find(q=>q.id===questId);
      if(!def)return;
      const prev=questProgress.get(questId);
      if(prev?.completed)return;
      const newProg=Math.min((prev?.progress??0)+by,def.target);
      const completed=newProg>=def.target;
      const next:QuestProgress={quest_id:questId,progress:newProg,completed,completed_at:completed?new Date().toISOString():undefined};
      setQuestProgress(m=>{const nm=new Map(m);nm.set(questId,next);return nm;});
      await supabase.from('user_quests').upsert({user_id:userId,quest_id:questId,progress:newProg,completed,completed_at:completed?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:'user_id,quest_id'}).catch(()=>{});
    },[userId,questProgress]);
  
    const questsWithProgress=useMemo(()=>QUEST_DEFINITIONS.map(def=>({
      ...def,
      progress:questProgress.get(def.id)?.progress??0,
      completed:questProgress.get(def.id)?.completed??false,
      pct:Math.min(1,(questProgress.get(def.id)?.progress??0)/def.target),
    })),[questProgress]);
  
    const completedCount=useMemo(()=>questsWithProgress.filter(q=>q.completed).length,[questsWithProgress]);
  
    return{questsWithProgress,completedCount,loading,incrementQuest};
  }
  
  // ─── ★ useContributionScore ────────────────────────────────────────────────────
  export function useContributionScore(userId:string){
    const[score,setScore]=useState<ContributionScore>({
      total_score:0,useful_reviews:0,saved_recommendations:0,
      quality_comments:0,valid_reports:0,followed_playlists:0,
      shared_films:0,pepites_detected:0,
    });
    const[loading,setLoading]=useState(true);
  
    useEffect(()=>{
      if(!isValidUUID(userId)){setLoading(false);return;}
      let dead=false;
      supabase.from('contribution_scores').select('*').eq('user_id',userId).maybeSingle()
        .then(({data})=>{
          if(dead)return;
          if(data)setScore({
            total_score:         data.total_score??0,
            useful_reviews:      data.useful_reviews??0,
            saved_recommendations:data.saved_recommendations??0,
            quality_comments:    data.quality_comments??0,
            valid_reports:       data.valid_reports??0,
            followed_playlists:  data.followed_playlists??0,
            shared_films:        data.shared_films??0,
            pepites_detected:    data.pepites_detected??0,
          });
          setLoading(false);
        }).catch(()=>{if(!dead)setLoading(false);});
      return()=>{dead=true;};
    },[userId]);
  
    // ★ Enregistrer une pépite détectée (like avant 100 vues)
    const detectPepite=useCallback(async(workId:number,viewsAtLike:number)=>{
      if(!isValidUUID(userId)||viewsAtLike>=100)return false;
      const{error}=await supabase.from('pepite_detections').upsert({user_id:userId,work_id:workId,views_at_like:viewsAtLike},{onConflict:'user_id,work_id'});
      if(!error){
        await supabase.from('contribution_scores').upsert({user_id:userId,pepites_detected:score.pepites_detected+1,total_score:score.total_score+12,updated_at:new Date().toISOString()},{onConflict:'user_id'}).catch(()=>{});
        setScore(prev=>({...prev,pepites_detected:prev.pepites_detected+1,total_score:prev.total_score+12}));
        return true;
      }
      return false;
    },[userId,score]);
  
    return{score,loading,detectPepite};
  }
  
  // ═════════════════════════════════════════════════════════════════════════════
  // ★ COMPOSANTS
  // ═════════════════════════════════════════════════════════════════════════════
  
  // ─── XP BAR ──────────────────────────────────────────────────────────────────
  export const XPBar=memo(function XPBar({profile,compact=false}:{profile:GamiProfile;compact?:boolean}){
    const prog=useRef(new Animated.Value(0)).current;
    const glow=useRef(new Animated.Value(0.4)).current;
    useEffect(()=>{
      Animated.timing(prog,{toValue:profile.pct,duration:1100,useNativeDriver:false}).start();
      Animated.loop(Animated.sequence([Animated.timing(glow,{toValue:1,duration:2200,useNativeDriver:true}),Animated.timing(glow,{toValue:0.4,duration:2200,useNativeDriver:true})])).start();
    },[profile.pct]);
    const barW=prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
    // Pre-compute strings
    const levelStr    = `Niveau ${profile.level}`;
    const xpInStr     = `${profile.xpInLevel} XP`;
    const xpNextStr   = `${profile.xpToNext} → niv. ${profile.level+1}`;
  
    if(compact) return(
      <View style={{flexDirection:'row',alignItems:'center',gap:9}}>
        <View style={xb.compactBadge}><Text style={xb.compactNum}>{profile.level}</Text></View>
        <View style={{flex:1,gap:4}}>
          <Text style={xb.compactTitle} numberOfLines={1}>{profile.title}</Text>
          <View style={xb.track}><Animated.View style={[xb.fill,{width:barW}]}/></View>
        </View>
        <Text style={xb.xpLabel}>{profile.xp} XP</Text>
      </View>
    );
  
    return(
      <View style={xb.wrap}>
        <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={{flexDirection:'row',alignItems:'center',gap:14}}>
          <Animated.View style={[xb.glowRing,{opacity:glow}]}/>
          <View style={xb.circle}>
            <Text style={xb.lvlBig}>{profile.level}</Text>
            <Text style={xb.lvlLbl}>NIV</Text>
          </View>
          <View style={{flex:1,gap:7}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
              <Text style={xb.title} numberOfLines={1}>{profile.title}</Text>
              {profile.streak_days>=3&&(
                <View style={xb.streakBadge}>
                  <Ionicons name="flame" size={9} color={C.orange}/>
                  <Text style={[xb.streakTxt,{color:C.orange}]}>{profile.streak_days}j</Text>
                </View>
              )}
              {profile.contribution_score>0&&(
                <View style={xb.contribPill}>
                  <Ionicons name="star-outline" size={8} color={C.gold}/>
                  <Text style={xb.contribTxt}>{profile.contribution_score}</Text>
                </View>
              )}
            </View>
            <View style={xb.track}><Animated.View style={[xb.fill,{width:barW}]}/></View>
            <View style={{flexDirection:'row',justifyContent:'space-between'}}>
              <Text style={xb.xpSub}>{xpInStr}</Text>
              {profile.level<10
                ?<Text style={xb.xpSub}>{xpNextStr}</Text>
                :<Text style={[xb.xpSub,{color:C.gold}]}>NIVEAU MAX ✦</Text>
              }
            </View>
          </View>
        </View>
      </View>
    );
  });
  XPBar.displayName='XPBar';
  const xb=StyleSheet.create({
    wrap:        {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,position:'relative'},
    glowRing:    {position:'absolute',width:82,height:82,borderRadius:41,borderWidth:1.5,borderColor:'rgba(255,255,255,0.15)',top:6,left:6},
    circle:      {width:72,height:72,borderRadius:36,borderWidth:2,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
    lvlBig:      {color:C.white,fontSize:22,fontWeight:'900',letterSpacing:-0.8},
    lvlLbl:      {color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:2,marginTop:-3},
    title:       {color:C.white,fontSize:13,fontWeight:'700',flex:1},
    track:       {height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},
    fill:        {height:'100%',borderRadius:2,backgroundColor:'rgba(255,255,255,0.45)'},
    xpLabel:     {color:C.muted,fontSize:10,fontWeight:'700'},
    xpSub:       {color:C.muted,fontSize:9.5},
    compactBadge:{width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'},
    compactNum:  {color:C.white,fontSize:11,fontWeight:'900'},
    compactTitle:{color:C.white,fontSize:11,fontWeight:'700'},
    streakBadge: {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:'rgba(249,115,22,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(249,115,22,0.28)'},
    streakTxt:   {fontSize:9.5,fontWeight:'800'},
    contribPill: {flexDirection:'row',alignItems:'center',gap:3,paddingHorizontal:6,paddingVertical:2,borderRadius:7,backgroundColor:'rgba(245,200,66,0.12)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.25)'},
    contribTxt:  {color:C.gold,fontSize:8,fontWeight:'700'},
  });
  
  // ─── ★ BADGE CHIP interactif (tap → description + rareté) ─────────────────────
  export const BadgeChip=memo(function BadgeChip({b,size='normal'}:{b:GamiBadge;size?:'normal'|'small'}){
    const[open,setOpen]=useState(false);
    const sc=useRef(new Animated.Value(1)).current;
    const col=RARITY_COL[b.rarity]??C.muted;
    const isSmall=size==='small';
    const ptsStr=`+${b.xp_reward} XP`;
  
    const press=()=>{
      Animated.sequence([
        Animated.spring(sc,{toValue:0.88,tension:350,friction:7,useNativeDriver:true}),
        Animated.spring(sc,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
      ]).start();
      setOpen(v=>!v);
    };
  
    return(
      <Animated.View style={{transform:[{scale:sc}]}}>
        <TouchableOpacity onPress={press} activeOpacity={0.85}
          style={[bc.wrap,b.earned&&{opacity:1,borderColor:`${col}45`,backgroundColor:`${col}0A`},isSmall&&bc.wrapSmall,open&&{borderWidth:1}]}>
          <View style={[bc.icon,b.earned&&{borderColor:`${col}35`,backgroundColor:`${col}14`},isSmall&&bc.iconSmall]}>
            <Ionicons name={b.icon} size={isSmall?12:17} color={b.earned?col:C.muted}/>
          </View>
          {b.earned&&(
            <View style={[bc.rarity,{backgroundColor:`${col}14`,borderColor:`${col}30`}]}>
              <Text style={[bc.rarityTxt,{color:col}]}>{RARITY_LBL[b.rarity]}</Text>
            </View>
          )}
          <Text style={[bc.label,b.earned&&{color:C.offWhite}]} numberOfLines={open?undefined:2}>{b.label}</Text>
          {b.earned&&<Text style={bc.xp}>{ptsStr}</Text>}
          {!b.earned&&<View style={{position:'absolute',top:7,right:7}}><Ionicons name="lock-closed" size={8} color={C.muted}/></View>}
          {/* Description au tap */}
          {open&&<Text style={bc.desc}>{b.description}</Text>}
        </TouchableOpacity>
      </Animated.View>
    );
  });
  BadgeChip.displayName='BadgeChip';
  const bc=StyleSheet.create({
    wrap:     {alignItems:'center',gap:5,padding:11,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,width:88,opacity:0.52,minHeight:100},
    wrapSmall:{width:68,padding:8,minHeight:76},
    icon:     {width:40,height:40,borderRadius:20,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    iconSmall:{width:28,height:28,borderRadius:14},
    label:    {color:C.muted,fontSize:8.5,fontWeight:'600',textAlign:'center',lineHeight:12},
    rarity:   {paddingHorizontal:5,paddingVertical:1.5,borderRadius:5,borderWidth:StyleSheet.hairlineWidth},
    rarityTxt:{fontSize:6.5,fontWeight:'900',letterSpacing:0.5},
    xp:       {color:C.gold,fontSize:8,fontWeight:'800'},
    desc:     {color:C.muted,fontSize:8,textAlign:'center',lineHeight:11,marginTop:2},
  });
  
  // ─── BADGES ROW ───────────────────────────────────────────────────────────────
  export const BadgesRow=memo(function BadgesRow({badges}:{badges:GamiBadge[]}){
    const sorted=useMemo(()=>[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)],[badges]);
    return(
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:9,paddingHorizontal:20}}>
        {sorted.map(b=><BadgeChip key={b.id} b={b}/>)}
      </ScrollView>
    );
  });
  BadgesRow.displayName='BadgesRow';
  
  // ─── ★ QUESTS PANEL ───────────────────────────────────────────────────────────
  export const QuestsPanel=memo(function QuestsPanel({
    questsWithProgress, completedCount, onAction,
  }:{
    questsWithProgress:ReturnType<typeof useQuests>['questsWithProgress'];
    completedCount:number;
    onAction:(action:string)=>void;
  }){
    const totalStr = String(QUEST_DEFINITIONS.length);
    const doneStr  = String(completedCount);
    return(
      <View style={qp.wrap}>
        <View style={qp.header}>
          <Ionicons name="flag-outline" size={13} color={C.mid}/>
          <Text style={qp.title}>Quêtes cinéphiles</Text>
          <View style={qp.badge}><Text style={qp.badgeTxt}>{doneStr}/{totalStr}</Text></View>
        </View>
        {questsWithProgress.map(q=>{
          const pctStr = `${Math.round(q.pct*100)}%`;
          const progStr= `${q.progress}/${q.target}`;
          return(
            <View key={q.id} style={[qp.row, q.completed&&qp.rowDone]}>
              <View style={[qp.iconWrap,q.completed&&qp.iconDone]}>
                <Ionicons name={q.completed?'checkmark-circle':q.icon} size={16} color={q.completed?C.green:C.mid}/>
              </View>
              <View style={{flex:1,gap:4}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Text style={[qp.rowTitle,q.completed&&{color:C.white}]} numberOfLines={1}>{q.title}</Text>
                  {q.reward_badge&&(
                    <View style={qp.rewardPill}>
                      <Ionicons name="ribbon-outline" size={8} color={C.gold}/>
                    </View>
                  )}
                </View>
                <Text style={qp.rowDesc} numberOfLines={1}>{q.desc}</Text>
                <View style={qp.barRow}>
                  <View style={qp.barTrack}>
                    <View style={[qp.barFill,{width:pctStr,backgroundColor:q.completed?C.green:C.blue}]}/>
                  </View>
                  <Text style={qp.progTxt}>{progStr}</Text>
                </View>
              </View>
              {!q.completed&&(
                <TouchableOpacity onPress={()=>onAction(q.action)} style={qp.actionBtn} activeOpacity={0.80}>
                  <Text style={qp.actionTxt}>→</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  });
  QuestsPanel.displayName='QuestsPanel';
  const qp=StyleSheet.create({
    wrap:       {gap:8},
    header:     {flexDirection:'row',alignItems:'center',gap:7,paddingHorizontal:20,marginBottom:4},
    title:      {color:C.white,fontSize:15,fontWeight:'800',flex:1},
    badge:      {paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
    badgeTxt:   {color:C.muted,fontSize:9,fontWeight:'700'},
    row:        {flexDirection:'row',alignItems:'center',gap:11,paddingHorizontal:20,paddingVertical:11,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,marginHorizontal:20},
    rowDone:    {borderColor:'rgba(46,204,138,0.20)',backgroundColor:'rgba(46,204,138,0.04)'},
    iconWrap:   {width:34,height:34,borderRadius:10,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    iconDone:   {backgroundColor:'rgba(46,204,138,0.14)',borderColor:'rgba(46,204,138,0.30)'},
    rowTitle:   {color:C.mid,fontSize:12,fontWeight:'700',flex:1},
    rowDesc:    {color:C.muted,fontSize:10},
    barRow:     {flexDirection:'row',alignItems:'center',gap:8},
    barTrack:   {flex:1,height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.07)',overflow:'hidden'},
    barFill:    {height:'100%',borderRadius:2},
    progTxt:    {color:C.muted,fontSize:9,fontWeight:'700',minWidth:28,textAlign:'right'},
    rewardPill: {width:16,height:16,borderRadius:8,backgroundColor:'rgba(245,200,66,0.14)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.28)',alignItems:'center',justifyContent:'center'},
    actionBtn:  {width:28,height:28,borderRadius:14,backgroundColor:C.blueFaint??'rgba(90,150,230,0.10)',alignItems:'center',justifyContent:'center'},
    actionTxt:  {color:C.blue,fontSize:14,fontWeight:'700'},
  });
  
  // ─── ★ CONTRIBUTION CARD ──────────────────────────────────────────────────────
  export const ContributionCard=memo(function ContributionCard({score}:{score:ContributionScore}){
    const rows=[
      {label:'Avis utiles',       value:score.useful_reviews,      pts:10, icon:'thumbs-up-outline'    as const},
      {label:'Recommandations',   value:score.saved_recommendations,pts:15, icon:'bookmark-outline'     as const},
      {label:'Commentaires',      value:score.quality_comments,    pts:5,  icon:'chatbubble-outline'   as const},
      {label:'Pépites détectées', value:score.pepites_detected,    pts:12, icon:'star-outline'         as const},
      {label:'Playlists suivies', value:score.followed_playlists,  pts:20, icon:'list-outline'         as const},
      {label:'Films partagés',    value:score.shared_films,        pts:12, icon:'share-outline'        as const},
    ].filter(r=>r.value>0);
  
    const totalStr = String(score.total_score);
  
    return(
      <View style={cc.wrap}>
        <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={cc.header}>
          <Ionicons name="analytics-outline" size={13} color={C.mid}/>
          <Text style={cc.title}>Score de contribution</Text>
          <View style={cc.scorePill}>
            <Text style={cc.scoreNum}>{totalStr}</Text>
            <Text style={cc.scoreLbl}>pts</Text>
          </View>
        </View>
        {rows.length===0
          ?<Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingVertical:12}}>Commencez à contribuer pour voir votre score</Text>
          :rows.map(r=>(
            <View key={r.label} style={cc.row}>
              <Ionicons name={r.icon} size={12} color={C.mid}/>
              <Text style={cc.rowLabel}>{r.label}</Text>
              <Text style={cc.rowVal}>{r.value}×</Text>
              <Text style={cc.rowPts}>+{r.pts} pts</Text>
            </View>
          ))
        }
      </View>
    );
  });
  ContributionCard.displayName='ContributionCard';
  const cc=StyleSheet.create({
    wrap:     {borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,gap:8},
    header:   {flexDirection:'row',alignItems:'center',gap:7,marginBottom:2},
    title:    {color:C.white,fontSize:13,fontWeight:'800',flex:1},
    scorePill:{flexDirection:'row',alignItems:'baseline',gap:3,paddingHorizontal:9,paddingVertical:3,borderRadius:9,backgroundColor:'rgba(245,200,66,0.12)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.28)'},
    scoreNum: {color:C.gold,fontSize:14,fontWeight:'900'},
    scoreLbl: {color:C.gold,fontSize:9,fontWeight:'700'},
    row:      {flexDirection:'row',alignItems:'center',gap:8},
    rowLabel: {color:C.mid,fontSize:11,flex:1},
    rowVal:   {color:C.white,fontSize:11,fontWeight:'700'},
    rowPts:   {color:C.muted,fontSize:10,width:44,textAlign:'right'},
  });
  
  // ─── WEEKLY CHALLENGE CARD ────────────────────────────────────────────────────
  export const WeeklyChallengeCard=memo(function WeeklyChallengeCard({
    challenge,progress,onOpen,
  }:{challenge:WeeklyChallenge;progress:ChallengeProgress|null;onOpen:()=>void}){
    const accent=challenge.color_accent;
    const total=challenge.steps.length;
    const doneDone=progress?.steps_done?.length??0;
    const pct=total>0?doneDone/total:0;
    const isDone=progress?.completed??false;
    const diffCol=DIFF_COL[challenge.difficulty]??C.blue;
    const pulseAnim=useRef(new Animated.Value(1)).current;
    const barAnim=useRef(new Animated.Value(0)).current;
    useEffect(()=>{
      if(isDone){pulseAnim.setValue(1);return;}
      const loop=Animated.loop(Animated.sequence([Animated.timing(pulseAnim,{toValue:1.012,duration:2200,useNativeDriver:true}),Animated.timing(pulseAnim,{toValue:1,duration:2200,useNativeDriver:true})]));
      loop.start(); return()=>loop.stop();
    },[isDone]);
    useEffect(()=>{Animated.timing(barAnim,{toValue:pct,duration:900,useNativeDriver:false}).start();},[pct]);
    const pctStr    = `${Math.round(pct*100)}%`;
    const weekStr   = `SEM. ${challenge.week_number}`;
    const diffStr   = challenge.difficulty.toUpperCase();
    const pointsStr = `${challenge.reward_points} pts`;
    const xpStr     = `+${challenge.reward_xp} XP`;
    return(
      <Animated.View style={{transform:[{scale:pulseAnim}],marginHorizontal:20,marginBottom:6}}>
        <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={wcc.wrap}>
          <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
          <View style={[wcc.strip,{backgroundColor:accent}]}/>
          <View style={wcc.inner}>
            <View style={wcc.header}>
              <View style={[wcc.iconWrap,{backgroundColor:`${accent}18`,borderColor:`${accent}38`}]}>
                <Ionicons name={challenge.icon} size={22} color={accent}/>
              </View>
              <View style={{flex:1,gap:4}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                  <View style={[wcc.pill,{borderColor:`${accent}35`,backgroundColor:`${accent}12`}]}>
                    <Ionicons name="flame-outline" size={8} color={accent}/>
                    <Text style={[wcc.pillTxt,{color:accent}]}>{weekStr}</Text>
                  </View>
                  <View style={[wcc.pill,{borderColor:`${diffCol}35`,backgroundColor:`${diffCol}10`}]}>
                    <Text style={[wcc.pillTxt,{color:diffCol}]}>{diffStr}</Text>
                  </View>
                  {isDone&&<View style={[wcc.pill,{borderColor:'rgba(46,204,138,0.30)',backgroundColor:'rgba(46,204,138,0.08)'}]}><Ionicons name="checkmark-circle" size={8} color={C.green}/><Text style={[wcc.pillTxt,{color:C.green}]}>TERMINÉ</Text></View>}
                </View>
                <Text style={wcc.title}>{challenge.title}</Text>
                {challenge.subtitle&&<Text style={wcc.subtitle}>{challenge.subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.muted}/>
            </View>
            <View style={{flexDirection:'row',gap:5}}>
              {challenge.steps.map((_,i)=>{
                const done=(progress?.steps_done??[]).includes(i)||isDone;
                return(<View key={i} style={[wcc.dot,done&&{backgroundColor:accent,borderColor:accent}]}>{done&&<Ionicons name="checkmark" size={7} color={C.white}/>}</View>);
              })}
            </View>
            <View style={{gap:5}}>
              <View style={wcc.track}>
                <Animated.View style={[wcc.fill,{width:barAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:accent}]}/>
              </View>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={wcc.progTxt}>{isDone?`+${pointsStr} gagnés`:`${pctStr} · ${pointsStr}`}</Text>
                <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                  <Ionicons name="flash" size={9} color={C.gold}/>
                  <Text style={[wcc.progTxt,{color:C.gold}]}>{xpStr}</Text>
                </View>
              </View>
            </View>
            {challenge.reward_label&&(
              <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                <Ionicons name="gift-outline" size={10} color={C.muted}/>
                <Text style={wcc.rewardTxt}>{challenge.reward_label}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  WeeklyChallengeCard.displayName='WeeklyChallengeCard';
  const wcc=StyleSheet.create({
    wrap:     {borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi},
    strip:    {position:'absolute',left:0,top:0,bottom:0,width:3},
    inner:    {padding:16,paddingLeft:20,gap:10},
    header:   {flexDirection:'row',alignItems:'flex-start',gap:12},
    iconWrap: {width:46,height:46,borderRadius:13,borderWidth:1,alignItems:'center',justifyContent:'center'},
    pill:     {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:7,borderWidth:StyleSheet.hairlineWidth},
    pillTxt:  {fontSize:7.5,fontWeight:'800',letterSpacing:0.6},
    title:    {color:C.white,fontSize:16,fontWeight:'800',letterSpacing:-0.3},
    subtitle: {color:C.muted,fontSize:11},
    dot:      {width:16,height:16,borderRadius:8,borderWidth:1.5,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
    track:    {height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},
    fill:     {height:'100%',borderRadius:2},
    progTxt:  {color:C.muted,fontSize:10,fontWeight:'600'},
    rewardTxt:{color:C.muted,fontSize:10},
  });
  
  // ─── WEEKLY CHALLENGE MODAL ───────────────────────────────────────────────────
  const ChallengeWorkCard=memo(function ChallengeWorkCard({item}:{item:Work}){
    const router=useRouter();
    const uri=resolveImg(item.id,item.image);
    return(
      <TouchableOpacity style={{marginRight:10}} onPress={()=>router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
        <View style={{width:100,height:148,borderRadius:11,overflow:'hidden',backgroundColor:C.navyMid}}>
          <Image source={{uri}} style={{width:'100%',height:'100%'}} resizeMode="cover"/>
          <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject}/>
          <View style={{position:'absolute',bottom:7,left:7,right:7}}>
            <Text style={{color:C.white,fontSize:9.5,fontWeight:'700',lineHeight:13}} numberOfLines={2}>{item.title}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  });
  
  export const WeeklyChallengeModal=memo(function WeeklyChallengeModal({
    visible,onClose,challenge,progress,onStepComplete,works,userId,
  }:{
    visible:boolean;onClose:()=>void;challenge:WeeklyChallenge;
    progress:ChallengeProgress|null;onStepComplete:(step:number,done:boolean)=>void;
    works:Work[];userId:string;
  }){
    const router=useRouter(),insets=useSafeAreaInsets();
    const accent=challenge.color_accent;
    const slideY=useRef(new Animated.Value(SH)).current;
    const[activeStep,setActiveStep]=useState(0);
    const[showNarrative,setShowNarrative]=useState(true);
    useEffect(()=>{if(progress)setActiveStep(Math.min(progress.step_index,Math.max(0,challenge.steps.length-1)));},[progress,challenge.steps.length]);
    useEffect(()=>{
      if(visible){setShowNarrative(!!challenge.narrative);Animated.spring(slideY,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();}
      else{Animated.timing(slideY,{toValue:SH,duration:220,useNativeDriver:true}).start();}
    },[visible,challenge.narrative]);
    const steps=challenge.steps,total=steps.length;
    const current=steps[activeStep]??steps[0];
    const isDone=progress?.completed??false;
    const doneSet=useMemo(()=>new Set(progress?.steps_done??[]),[progress]);
    const globalPct=total>0?doneSet.size/total:0;
    const diffCol=DIFF_COL[challenge.difficulty]??C.blue;
    const filteredWorks=useMemo(()=>{
      const cfg=challenge.filter_config;
      if(!cfg)return works.slice(0,10);
      switch(cfg.type){
        case 'duration':  return works.filter(w=>(w.duration??0)>0&&(w.duration??0)<=(cfg.max??Infinity)).slice(0,10);
        case 'likes_max': return works.filter(w=>(w.likes??0)<(cfg.value??100)).slice(0,10);
        case 'original':  return works.filter(w=>w.is_original).slice(0,10);
        default:          return works.slice(0,10);
      }
    },[challenge.filter_config,works]);
    const handleAction=useCallback((action:string)=>{
      const routes:Record<string,string>={go_profile:'/profile',go_create:'/(tabs)/create',go_social:'/(tabs)/social',go_catalog:'/search'};
      onClose();const route=routes[action];if(route)setTimeout(()=>router.push(route as any),250);
    },[onClose,router]);
    const handleNext=useCallback(()=>{const next=activeStep+1;if(next<total){setActiveStep(next);onStepComplete(next,false);}else{onStepComplete(activeStep,true);}},[activeStep,total,onStepComplete]);
    const handlePrev=useCallback(()=>{if(activeStep>0)setActiveStep(s=>s-1);},[activeStep]);
    const globalBarAnim=useRef(new Animated.Value(0)).current;
    useEffect(()=>{Animated.timing(globalBarAnim,{toValue:globalPct,duration:800,useNativeDriver:false}).start();},[globalPct]);
    // Pre-computed strings
    const stepCountStr   = isDone?'✓ Défi accompli !':doneSet.size===0?`${total} étapes`:`${doneSet.size}/${total} étapes`;
    const rewardPtsStr   = `${challenge.reward_points} pts`;
    const rewardXpStr    = `+${challenge.reward_xp} XP`;
    const worksCountStr  = String(filteredWorks.length);
    if(!visible)return null;
    return(
      <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <GalaxyBackground/>
        <Animated.View style={[wcm.root,{transform:[{translateY:slideY}]}]}>
          <View style={[wcm.topBar,{paddingTop:insets.top+10}]}>
            <View style={[wcm.topIcon,{backgroundColor:`${accent}18`,borderColor:`${accent}35`}]}>
              <Ionicons name={challenge.icon} size={14} color={accent}/>
            </View>
            <View style={{flex:1,gap:2}}>
              <Text style={[wcm.topBadge,{color:accent}]}>DÉFI · SEM. {challenge.week_number} · {challenge.difficulty.toUpperCase()}</Text>
              <Text style={wcm.topTitle} numberOfLines={1}>{challenge.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={wcm.closeBtn}><Ionicons name="close" size={15} color={C.muted}/></TouchableOpacity>
          </View>
          <View style={wcm.xpSection}>
            <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:6}}>
              <Text style={wcm.xpInfo}>{stepCountStr}</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="star-outline" size={9} color={C.muted}/><Text style={wcm.xpInfo}>{rewardPtsStr}</Text></View>
                <View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="flash" size={9} color={C.gold}/><Text style={[wcm.xpInfo,{color:C.gold}]}>{rewardXpStr}</Text></View>
              </View>
            </View>
            <View style={wcm.globalTrack}>
              <Animated.View style={[wcm.globalFill,{width:globalBarAnim.interpolate({inputRange:[0,1],outputRange:['0%','100%']}),backgroundColor:accent}]}/>
            </View>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:insets.bottom+40}}>
            {showNarrative&&!!challenge.narrative&&(
              <TouchableOpacity style={[wcm.narrativeCard,{borderColor:`${accent}28`,backgroundColor:`${accent}07`}]} onPress={()=>setShowNarrative(false)} activeOpacity={0.80}>
                <BlurView intensity={Platform.OS==='ios'?12:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{flexDirection:'row',alignItems:'flex-start',gap:10}}>
                  <View style={[wcm.narIcon,{borderColor:`${accent}35`,backgroundColor:`${accent}15`}]}><Ionicons name="book-outline" size={15} color={accent}/></View>
                  <View style={{flex:1,gap:6}}>
                    <Text style={[wcm.narLabel,{color:accent}]}>HISTOIRE DU DÉFI</Text>
                    <Text style={wcm.narText}>{challenge.narrative}</Text>
                  </View>
                </View>
                <Text style={[wcm.narCta,{color:`${accent}80`}]}>Appuyer pour continuer →</Text>
              </TouchableOpacity>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20,gap:7,marginBottom:14}}>
              {steps.map((s,i)=>{const done=doneSet.has(i)||isDone;const cur=i===activeStep&&!isDone;return(
                <TouchableOpacity key={s.index} onPress={()=>setActiveStep(i)} style={[wcm.stepDot,done&&wcm.stepDone,cur&&{borderColor:accent,borderWidth:2}]} activeOpacity={0.75}>
                  {done?<Ionicons name="checkmark" size={10} color={C.white}/>:<Text style={[wcm.stepNum,cur&&{color:accent}]}>{i+1}</Text>}
                </TouchableOpacity>
              );})}
            </ScrollView>
            {!isDone&&current&&(
              <View style={wcm.stepCard}>
                <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={{flexDirection:'row',alignItems:'center',gap:10}}>
                  <View style={[wcm.stepIconWrap,{backgroundColor:`${accent}15`,borderColor:`${accent}28`}]}><Ionicons name={current.icon} size={28} color={accent}/></View>
                  <View style={[wcm.xpPill,{backgroundColor:`${C.gold}15`,borderColor:`${C.gold}35`}]}><Ionicons name="flash" size={9} color={C.gold}/><Text style={[wcm.xpPillTxt,{color:C.gold}]}>+{current.xp} XP</Text></View>
                </View>
                <Text style={wcm.stepTitle}>{current.title}</Text>
                <Text style={wcm.stepDesc}>{current.desc}</Text>
                {current.tip&&(
                  <View style={wcm.tipCard}><Ionicons name="bulb-outline" size={12} color={C.gold}/><Text style={wcm.tipTxt}>{current.tip}</Text></View>
                )}
                <TouchableOpacity style={[wcm.actionBtn,{borderColor:`${accent}38`,backgroundColor:`${accent}10`}]} onPress={()=>handleAction(current.action)} activeOpacity={0.80}>
                  <Text style={[wcm.actionTxt,{color:accent}]}>{current.actionLabel}</Text>
                  <Ionicons name="arrow-forward" size={13} color={accent}/>
                </TouchableOpacity>
                <View style={wcm.navRow}>
                  <TouchableOpacity onPress={handlePrev} disabled={activeStep===0} style={[wcm.prevBtn,activeStep===0&&{opacity:0.3}]}>
                    <Ionicons name="chevron-back" size={13} color={C.muted}/><Text style={wcm.prevTxt}>Précédent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleNext} style={[wcm.nextBtn,{backgroundColor:accent}]} activeOpacity={0.85}>
                    <Text style={wcm.nextTxt}>{activeStep===total-1?'Terminer':'Suivant'}</Text>
                    <Ionicons name={activeStep===total-1?'checkmark-circle':'chevron-forward'} size={13} color={C.white}/>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {isDone&&(
              <View style={wcm.doneCard}>
                <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>
                <View style={wcm.trophyWrap}><Ionicons name="trophy" size={38} color={C.gold}/></View>
                <Text style={wcm.doneTitle}>Défi accompli !</Text>
                <Text style={wcm.doneSub}>+{challenge.reward_points} pts · +{challenge.reward_xp} XP</Text>
                <View style={{flexDirection:'row',gap:8,marginTop:6}}>
                  {challenge.reward_label&&(
                    <View style={[wcm.rewardPill,{borderColor:`${C.gold}30`,backgroundColor:`${C.gold}10`}]}>
                      <Ionicons name="ribbon-outline" size={11} color={C.gold}/><Text style={[wcm.rewardPillTxt,{color:C.gold}]}>{challenge.reward_label}</Text>
                    </View>
                  )}
                  <View style={[wcm.rewardPill,{borderColor:`${C.green}30`,backgroundColor:`${C.green}10`}]}>
                    <Ionicons name="flash" size={11} color={C.green}/><Text style={[wcm.rewardPillTxt,{color:C.green}]}>+{challenge.reward_xp} XP</Text>
                  </View>
                </View>
              </View>
            )}
            {filteredWorks.length>0&&(
              <View style={{marginTop:14}}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:20,marginBottom:11}}>
                  <Ionicons name="film-outline" size={12} color={C.muted}/>
                  <Text style={{color:C.white,fontSize:13,fontWeight:'800'}}>Œuvres pour ce défi</Text>
                  <View style={{paddingHorizontal:6,paddingVertical:1.5,borderRadius:6,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:8,fontWeight:'700'}}>{worksCountStr}</Text></View>
                </View>
                <FlatList horizontal data={filteredWorks} keyExtractor={w=>`cw_${w.id}`} renderItem={({item})=><ChallengeWorkCard item={item}/>} showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:20}} initialNumToRender={6}/>
              </View>
            )}
            <View style={{paddingHorizontal:20,marginTop:18}}>
              <Text style={{color:C.muted,fontSize:9.5,fontWeight:'700',letterSpacing:0.8,marginBottom:10}}>TOUTES LES ÉTAPES</Text>
              {steps.map((s,i)=>{
                const done=doneSet.has(i)||isDone;const isCur=i===activeStep&&!isDone;
                return(
                  <TouchableOpacity key={s.index} onPress={()=>setActiveStep(i)} style={[wcm.allRow,done&&wcm.allRowDone,isCur&&{borderColor:`${accent}38`}]} activeOpacity={0.78}>
                    <View style={[wcm.allNum,done&&{backgroundColor:`${C.green}18`,borderColor:`${C.green}38`},isCur&&{backgroundColor:`${accent}14`,borderColor:`${accent}30`}]}>
                      {done?<Ionicons name="checkmark" size={9} color={C.green}/>:<Text style={[wcm.allNumTxt,isCur&&{color:accent}]}>{i+1}</Text>}
                    </View>
                    <View style={{flex:1,gap:1}}>
                      <Text style={[wcm.allTitle,(done||isCur)&&{color:C.white}]}>{s.title}</Text>
                      <Text style={wcm.allDesc} numberOfLines={1}>{s.desc}</Text>
                    </View>
                    <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
                      <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
                        <Ionicons name="flash" size={8} color={done?C.green:C.muted}/>
                        <Text style={{color:done?C.green:C.muted,fontSize:9,fontWeight:'700'}}>{s.xp}</Text>
                      </View>
                      <Ionicons name={done?'checkmark-circle':'chevron-forward'} size={13} color={done?C.green:C.border}/>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={wcm.aboutCard}>
              <BlurView intensity={Platform.OS==='ios'?10:8} tint="dark" style={StyleSheet.absoluteFillObject}/>
              <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:8}}>
                <Ionicons name="information-circle-outline" size={13} color={C.muted}/>
                <Text style={{color:C.muted,fontSize:9.5,fontWeight:'700',letterSpacing:0.5}}>À PROPOS DU DÉFI</Text>
              </View>
              <Text style={wcm.aboutTxt}>{challenge.description}</Text>
            </View>
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  });
  WeeklyChallengeModal.displayName='WeeklyChallengeModal';
  const wcm=StyleSheet.create({
    root:         {flex:1,backgroundColor:'rgba(7,12,23,0.15)'},
    topBar:       {flexDirection:'row',alignItems:'center',paddingHorizontal:20,paddingBottom:12,gap:10},
    topIcon:      {width:32,height:32,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},
    topBadge:     {fontSize:7.5,fontWeight:'800',letterSpacing:1},
    topTitle:     {color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2},
    closeBtn:     {width:32,height:32,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
    xpSection:    {paddingHorizontal:20,marginBottom:14},
    xpInfo:       {color:C.muted,fontSize:10,fontWeight:'600'},
    globalTrack:  {height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'},
    globalFill:   {height:'100%',borderRadius:2},
    narrativeCard:{marginHorizontal:20,marginBottom:12,borderRadius:16,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,padding:16,gap:10},
    narIcon:      {width:36,height:36,borderRadius:10,borderWidth:1,alignItems:'center',justifyContent:'center'},
    narLabel:     {fontSize:8,fontWeight:'900',letterSpacing:1.5},
    narText:      {color:'rgba(255,255,255,0.68)',fontSize:13,lineHeight:20,fontStyle:'italic'},
    narCta:       {fontSize:9.5,fontWeight:'600',textAlign:'right',marginTop:4},
    stepDot:      {width:28,height:28,borderRadius:14,borderWidth:1.5,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
    stepDone:     {backgroundColor:'rgba(46,204,138,0.18)',borderColor:'rgba(46,204,138,0.45)'},
    stepNum:      {color:C.muted,fontSize:11,fontWeight:'700'},
    stepCard:     {marginHorizontal:20,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,padding:20,gap:12,marginBottom:10},
    stepIconWrap: {width:58,height:58,borderRadius:15,borderWidth:1,alignItems:'center',justifyContent:'center'},
    xpPill:       {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:3,borderRadius:9,borderWidth:StyleSheet.hairlineWidth},
    xpPillTxt:    {fontSize:10,fontWeight:'800'},
    stepTitle:    {color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4,lineHeight:26},
    stepDesc:     {color:'rgba(255,255,255,0.62)',fontSize:14,lineHeight:22},
    tipCard:      {flexDirection:'row',alignItems:'flex-start',gap:8,padding:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.22)',backgroundColor:'rgba(245,200,66,0.07)'},
    tipTxt:       {color:'rgba(255,255,255,0.58)',fontSize:12,lineHeight:18,flex:1},
    actionBtn:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:14,borderWidth:1},
    actionTxt:    {fontSize:14,fontWeight:'700'},
    navRow:       {flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:9},
    prevBtn:      {flexDirection:'row',alignItems:'center',gap:5,paddingVertical:10,paddingHorizontal:13,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
    prevTxt:      {color:C.muted,fontSize:12,fontWeight:'600'},
    nextBtn:      {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:13,borderRadius:14},
    nextTxt:      {color:C.white,fontSize:13,fontWeight:'800'},
    doneCard:     {marginHorizontal:20,borderRadius:18,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.32)',padding:24,alignItems:'center',gap:8,marginBottom:10},
    trophyWrap:   {width:68,height:68,borderRadius:34,backgroundColor:'rgba(245,200,66,0.14)',borderWidth:1.5,borderColor:'rgba(245,200,66,0.32)',alignItems:'center',justifyContent:'center'},
    doneTitle:    {color:C.white,fontSize:22,fontWeight:'900'},
    doneSub:      {color:C.muted,fontSize:12,textAlign:'center'},
    rewardPill:   {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:18,borderWidth:1},
    rewardPillTxt:{fontSize:11,fontWeight:'700'},
    aboutCard:    {marginHorizontal:20,borderRadius:13,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:13,marginTop:10,marginBottom:6},
    aboutTxt:     {color:'rgba(255,255,255,0.48)',fontSize:12,lineHeight:19},
    allRow:       {flexDirection:'row',alignItems:'center',gap:11,padding:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,marginBottom:7},
    allRowDone:   {borderColor:'rgba(46,204,138,0.18)',backgroundColor:'rgba(46,204,138,0.04)'},
    allNum:       {width:28,height:28,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center',flexShrink:0},
    allNumTxt:    {color:C.muted,fontSize:11,fontWeight:'700'},
    allTitle:     {color:C.muted,fontSize:12,fontWeight:'700'},
    allDesc:      {color:C.muted,fontSize:9},
  });
  
  // ─── EXPORTS ──────────────────────────────────────────────────────────────────
  export default {
    useGamification, useWeeklyChallenge, useQuests, useContributionScore,
    XPBar, BadgesRow, BadgeChip, WeeklyChallengeCard, WeeklyChallengeModal,
    QuestsPanel, ContributionCard,
    FALLBACK_CHALLENGE, CINEPHILE_BADGES_CATALOG, QUEST_DEFINITIONS,
    xpToLevel, resolveImg, isValidUUID,
  };