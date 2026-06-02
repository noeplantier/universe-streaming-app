/**
 * contexts/GamificationSystem.tsx — UNIVERSE · Gamification
 *
 * Tables :
 *   public.weekly_challenges   — défis de la semaine (lecture publique)
 *   public.challenge_progress  — progression user (lecture/écriture propre)
 *   public.cinephile_profiles  — XP / level / title / streak
 *   public.badges              — catalogue badges
 *   public.user_badges         — badges obtenus
 *
 * Exports :
 *   useGamification(userId, works)  — hook principal
 *   useWeeklyChallenge(userId)      — défi hebdo
 *   XPBar                           — barre XP animée
 *   BadgesRow                       — galerie badges horizontale
 *   WeeklyChallengeCard             — carte compacte (accueil / profil)
 *   WeeklyChallengeModal            — modale tutoriel interactif
 *   xpToLevel, TITLES, XP_TABLE     — constantes publiques
 */
import React, {
    createContext, memo, useCallback, useContext,
    useEffect, useMemo, useRef, useState,
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
    bg:      '#070C17',
    navyMid: '#0D2040',
    navyLow: '#0A1830',
    white:   '#FFFFFF',
    offWhite:'rgba(255,255,255,0.88)',
    mid:     'rgba(255,255,255,0.55)',
    muted:   'rgba(255,255,255,0.35)',
    faint:   'rgba(255,255,255,0.07)',
    subtle:  'rgba(255,255,255,0.13)',
    border:  'rgba(255,255,255,0.09)',
    borderHi:'rgba(255,255,255,0.20)',
    blue:    '#5A96E6',
    gold:    '#F5C842',
    green:   '#2ECC8A',
    red:     '#FF3B5C',
    orange:  '#F97316',
    purple:  '#8B5CF6',
  } as const;
  
  // ─── CONSTANTES ───────────────────────────────────────────────────────────────
  export const XP_TABLE = [0,100,300,700,1500,3000,6000,12000,25000,50000] as const;
  export const TITLES   = [
    'Spectateur curieux','Cinéphile émergent','Explorateur indé','Critique amateur',
    'Curateur underground','Chasseur de pépites','Ambassadeur cinéma',
    'Maître critique','Légende du 7ème art','Immortel du cinéma',
  ] as const;
  
  const RARITY_COL: Record<string,string> = {
    commun:'rgba(255,255,255,0.55)', rare:C.blue, épique:C.purple, légendaire:C.gold,
  };
  const RARITY_LBL: Record<string,string> = {
    commun:'COMMUN', rare:'RARE', épique:'ÉPIQUE', légendaire:'LÉGENDAIRE',
  };
  const DIFF_COL: Record<string,string> = {
    facile:C.green, normal:C.blue, difficile:C.orange, légendaire:C.gold,
  };
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  export interface Work {
    id:number; title:string; category:string; genre:string; year:number;
    likes:number; image:string|null; is_original:boolean; duration:number|null;
  }
  
  export interface GamiBadge {
    id:string; label:string; description:string; icon:keyof typeof Ionicons.glyphMap;
    rarity:'commun'|'rare'|'épique'|'légendaire'; xp_reward:number;
    earned:boolean; earned_at?:string; is_hidden:boolean;
  }
  
  export interface ChallengeStep {
    index:number; title:string; desc:string;
    action:string; actionLabel:string;
    icon:keyof typeof Ionicons.glyphMap;
    xp:number; tip:string;
  }
  
  export interface WeeklyChallenge {
    id:number; week_number:number;
    title:string; subtitle:string|null; description:string; narrative:string|null;
    icon:keyof typeof Ionicons.glyphMap; color_accent:string;
    steps:ChallengeStep[]; filter_config:{ type:string; value?:any; max?:number }|null;
    reward_label:string|null; reward_points:number; reward_xp:number;
    difficulty:'facile'|'normal'|'difficile'|'légendaire';
  }
  
  export interface ChallengeProgress {
    step_index:number; steps_done:number[];
    completed:boolean; points_earned:number; xp_earned:number; time_spent_s:number;
  }
  
  export interface GamiProfile {
    xp:number; level:number; title:string; streak_days:number;
    xpToNext:number; xpInLevel:number; pct:number;
  }
  
  export interface GamiState {
    profile:GamiProfile; badges:GamiBadge[];
    earnedBadges:GamiBadge[]; pendingBadges:GamiBadge[];
    loading:boolean; awardXP:(amount:number, reason:string)=>void;
  }
  
  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  export function xpToLevel(xp:number) {
    let level = 1;
    for (let i = 1; i < XP_TABLE.length; i++) {
      if (xp >= XP_TABLE[i]) level = i + 1; else break;
    }
    level = Math.min(level, 10);
    const base    = XP_TABLE[level - 1];
    const next    = level < 10 ? XP_TABLE[level] : XP_TABLE[9] * 2;
    const inLevel = xp - base;
    const range   = next - base;
    return { level, pct: range > 0 ? Math.min(1, inLevel / range) : 1, xpInLevel: inLevel, xpToNext: Math.max(0, range - inLevel) };
  }
  
  export const resolveImg = (id:number, img:string|null) => {
    if (!img) return `https://picsum.photos/seed/work_${id}/400/600`;
    if (img.startsWith('http')) return img;
    try { return supabase.storage.from('community-images').getPublicUrl(img).data.publicUrl; }
    catch { return `https://picsum.photos/seed/work_${id}/400/600`; }
  };
  
  /** ISO week number (lundi = 1) */
  function currentWeekNumber(): number {
    const d    = new Date();
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day  = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
  
  // ─── FALLBACK CHALLENGE ───────────────────────────────────────────────────────
  export const FALLBACK_CHALLENGE: WeeklyChallenge = {
    id:0, week_number: currentWeekNumber(),
    title:"L'Éveil du Cinéphile", subtitle:'Chapitre I — Vos premiers pas',
    description:'Votre voyage dans le cinéma indépendant commence ici.',
    narrative:'Dans les rues de Paris, une affiche décrochée révèle un cinéma clandestin. Ce premier soir change tout.',
    icon:'film-outline', color_accent:C.blue,
    steps:[
      { index:0, title:'Créez votre profil',   desc:"Personnalisez votre identité cinéphile.",       action:'go_profile', actionLabel:'Mon profil',   icon:'person-outline',      xp:15, tip:'Un profil complet attire 3× plus de connexions.' },
      { index:1, title:'Premier visionnage',   desc:"Regardez un reel jusqu'à la fin.",              action:'go_catalog', actionLabel:'Explorer',      icon:'play-circle-outline', xp:20, tip:'Les créateurs voient votre taux de complétion.' },
      { index:2, title:'Première critique',    desc:"Écrivez 80 mots minimum sur un film.",          action:'go_social',  actionLabel:'Écrire',        icon:'create-outline',      xp:30, tip:'8 pts de score par critique publiée.' },
      { index:3, title:'Rejoignez les pros',   desc:"Connectez-vous à un professionnel.",            action:'go_social',  actionLabel:'Voir les pros', icon:'briefcase-outline',   xp:25, tip:'Universe connecte créateurs et industrie.' },
    ],
    filter_config:null, reward_label:'Badge Éveil',
    reward_points:40, reward_xp:90, difficulty:'facile',
  };
  
  // ─── HOOK : GAMIFICATION ─────────────────────────────────────────────────────
  export function useGamification(userId:string, works:Work[]): GamiState {
    const [profile, setProfile] = useState<GamiProfile>({
      xp:0, level:1, title:TITLES[0], streak_days:0, xpToNext:100, xpInLevel:0, pct:0,
    });
    const [badges,  setBadges]  = useState<GamiBadge[]>([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      const isAnon = !userId || userId === 'anonymous';
      if (isAnon) { setLoading(false); return; }
      let dead = false;
  
      Promise.all([
        supabase.from('cinephile_profiles').select('xp,level,title,streak_days').eq('user_id', userId).maybeSingle(),
        supabase.from('badges').select('id,label,description,icon,rarity,xp_reward,is_hidden').eq('is_hidden', false),
        supabase.from('user_badges').select('badge_id,earned_at').eq('user_id', userId),
      ]).then(([profR, badgesR, earnedR]) => {
        if (dead) return;
  
        // ── Profil XP ─────────────────────────────────────────────────────────
        if (profR.data) {
          const { xp = 0, level, title, streak_days = 0 } = profR.data as any;
          const lvl = xpToLevel(xp);
          setProfile({ xp, level: level ?? lvl.level, title: title ?? TITLES[lvl.level - 1], streak_days, ...lvl });
        } else {
          // Auto-créer si absent
          supabase.from('cinephile_profiles').upsert({ user_id: userId, xp: 0 }, { onConflict: 'user_id' }).catch(() => {});
        }
  
        // ── Badges ─────────────────────────────────────────────────────────────
        const earnedMap = new Map<string, string>(
          (earnedR.data ?? []).map((r: any) => [r.badge_id, r.earned_at]),
        );
        setBadges((badgesR.data ?? []).map((b: any) => ({
          ...b, earned: earnedMap.has(b.id), earned_at: earnedMap.get(b.id),
        })) as GamiBadge[]);
  
        setLoading(false);
      }).catch(() => { if (!dead) setLoading(false); });
  
      return () => { dead = true; };
    }, [userId]);
  
    const earnedBadges  = useMemo(() => badges.filter(b => b.earned),  [badges]);
    const pendingBadges = useMemo(() => badges.filter(b => !b.earned), [badges]);
  
    const awardXP = useCallback(async (amount: number, reason: string) => {
      if (!userId || userId === 'anonymous') return;
      await supabase.rpc('add_xp', { p_user_id: userId, p_xp: amount, p_reason: reason }).catch(() => {});
      setProfile(prev => {
        const newXp = prev.xp + amount;
        const lvl   = xpToLevel(newXp);
        return { ...prev, xp: newXp, ...lvl, title: TITLES[lvl.level - 1] };
      });
    }, [userId]);
  
    return { profile, badges, earnedBadges, pendingBadges, loading, awardXP };
  }
  
  // ─── HOOK : WEEKLY CHALLENGE ─────────────────────────────────────────────────
  export function useWeeklyChallenge(userId: string) {
    const [challenge, setChallenge] = useState<WeeklyChallenge>(FALLBACK_CHALLENGE);
    const [progress,  setProgress]  = useState<ChallengeProgress | null>(null);
    const [loading,   setLoading]   = useState(true);
  
    const weekNum = useMemo(() => currentWeekNumber(), []);
  
    // ── Fetch challenge de la semaine ─────────────────────────────────────────
    useEffect(() => {
      let dead = false;
      supabase.from('weekly_challenges')
        .select('id,week_number,title,subtitle,description,narrative,icon,color_accent,steps,filter_config,reward_label,reward_points,reward_xp,difficulty')
        .eq('week_number', weekNum)
        .maybeSingle()
        .then(({ data }) => {
          if (dead || !data) return;
          setChallenge({
            ...data,
            steps:         Array.isArray(data.steps) ? data.steps : [],
            filter_config: data.filter_config ?? null,
            narrative:     data.narrative ?? null,
            subtitle:      data.subtitle  ?? null,
            reward_label:  data.reward_label ?? null,
          } as WeeklyChallenge);
        })
        .catch(() => {})
        .finally(() => { if (!dead) setLoading(false); });
      return () => { dead = true; };
    }, [weekNum]);
  
    // ── Fetch progression user ─────────────────────────────────────────────────
    useEffect(() => {
      if (!userId || userId === 'anonymous') return;
      let dead = false;
      supabase.from('challenge_progress')
        .select('step_index,steps_done,completed,points_earned,xp_earned,time_spent_s')
        .eq('user_id', userId)
        .eq('week_number', weekNum)
        .maybeSingle()
        .then(({ data }) => {
          if (dead || !data) return;
          setProgress({
            step_index:    data.step_index    ?? 0,
            steps_done:    Array.isArray(data.steps_done) ? data.steps_done : [],
            completed:     data.completed     ?? false,
            points_earned: data.points_earned ?? 0,
            xp_earned:     data.xp_earned     ?? 0,
            time_spent_s:  data.time_spent_s  ?? 0,
          });
        })
        .catch(() => {});
      return () => { dead = true; };
    }, [userId, weekNum]);
  
    // ── Upsert progression ────────────────────────────────────────────────────
    const upsertProgress = useCallback(async (stepIndex: number, completed: boolean) => {
      if (!userId || userId === 'anonymous') return;
  
      const total      = challenge.steps.length;
      const points     = completed ? challenge.reward_points : Math.floor((challenge.reward_points ?? 50) * stepIndex / Math.max(1, total));
      const xp         = completed ? challenge.reward_xp : Math.floor((challenge.reward_xp ?? 0) * stepIndex / Math.max(1, total));
      const prevDone   = progress?.steps_done ?? [];
      const steps_done = [...new Set([...prevDone, stepIndex])];
  
      const next: ChallengeProgress = {
        step_index: stepIndex, steps_done,
        completed, points_earned: points, xp_earned: xp,
        time_spent_s: progress?.time_spent_s ?? 0,
      };
      setProgress(next);
  
      await supabase.from('challenge_progress').upsert({
        user_id:      userId,
        week_number:  weekNum,
        step_index:   stepIndex,
        steps_done,
        completed,
        points_earned: points,
        xp_earned:     xp,
        completed_at:  completed ? new Date().toISOString() : null,
        updated_at:    new Date().toISOString(),
      }, { onConflict: 'user_id,week_number' }).catch(() => {});
    }, [userId, weekNum, challenge, progress]);
  
    return { challenge, progress, loading, upsertProgress };
  }
  
  // ─── XP BAR ──────────────────────────────────────────────────────────────────
  export const XPBar = memo(function XPBar({
    profile, compact = false,
  }: { profile: GamiProfile; compact?: boolean }) {
    const prog = useRef(new Animated.Value(0)).current;
    const glow = useRef(new Animated.Value(0.4)).current;
  
    useEffect(() => {
      Animated.timing(prog, { toValue: profile.pct, duration: 1100, useNativeDriver: false }).start();
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1,   duration: 2200, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.4, duration: 2200, useNativeDriver: true }),
      ])).start();
    }, [profile.pct]);
  
    const barW = prog.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  
    if (compact) return (
      <View style={{ flexDirection:'row', alignItems:'center', gap:9 }}>
        <View style={xb.compactBadge}>
          <Text style={xb.compactNum}>{profile.level}</Text>
        </View>
        <View style={{ flex:1, gap:4 }}>
          <Text style={xb.compactTitle} numberOfLines={1}>{profile.title}</Text>
          <View style={xb.track}>
            <Animated.View style={[xb.fill, { width: barW }]} />
          </View>
        </View>
        <Text style={xb.xpLabel}>{profile.xp} XP</Text>
      </View>
    );
  
    return (
      <View style={xb.wrap}>
        <BlurView intensity={Platform.OS === 'ios' ? 14 : 10} tint="dark" style={StyleSheet.absoluteFillObject} />
        <View style={{ flexDirection:'row', alignItems:'center', gap:14 }}>
          {/* Cercle niveau */}
          <Animated.View style={[xb.glowRing, { opacity: glow }]} />
          <View style={xb.circle}>
            <Text style={xb.lvlBig}>{profile.level}</Text>
            <Text style={xb.lvlLbl}>NIV</Text>
          </View>
          <View style={{ flex:1, gap:7 }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <Text style={xb.title} numberOfLines={1}>{profile.title}</Text>
              {profile.streak_days >= 3 && (
                <View style={xb.streakBadge}>
                  <Ionicons name="flame" size={9} color={C.orange} />
                  <Text style={[xb.streakTxt, { color: C.orange }]}>{profile.streak_days}j</Text>
                </View>
              )}
            </View>
            <View style={xb.track}>
              <Animated.View style={[xb.fill, { width: barW }]} />
            </View>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={xb.xpSub}>{profile.xpInLevel} XP</Text>
              {profile.level < 10
                ? <Text style={xb.xpSub}>{profile.xpToNext} → niv. {profile.level + 1}</Text>
                : <Text style={[xb.xpSub, { color: C.gold }]}>NIVEAU MAX ✦</Text>
              }
            </View>
          </View>
        </View>
      </View>
    );
  });
  XPBar.displayName = 'XPBar';
  const xb = StyleSheet.create({
    wrap:        { borderRadius:14, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, padding:14, position:'relative' },
    glowRing:    { position:'absolute', width:82, height:82, borderRadius:41, borderWidth:1.5, borderColor:'rgba(255,255,255,0.15)', top:6, left:6 },
    circle:      { width:72, height:72, borderRadius:36, borderWidth:2, borderColor:C.border, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center' },
    lvlBig:      { color:C.white, fontSize:22, fontWeight:'900', letterSpacing:-0.8 },
    lvlLbl:      { color:C.muted, fontSize:7, fontWeight:'800', letterSpacing:2, marginTop:-3 },
    title:       { color:C.white, fontSize:13, fontWeight:'700', flex:1 },
    track:       { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
    fill:        { height:'100%', borderRadius:2, backgroundColor:'rgba(255,255,255,0.45)' },
    xpLabel:     { color:C.muted, fontSize:10, fontWeight:'700' },
    xpSub:       { color:C.muted, fontSize:9.5 },
    compactBadge:{ width:28, height:28, borderRadius:14, borderWidth:1.5, borderColor:C.border, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center' },
    compactNum:  { color:C.white, fontSize:11, fontWeight:'900' },
    compactTitle:{ color:C.white, fontSize:11, fontWeight:'700' },
    streakBadge: { flexDirection:'row', alignItems:'center', gap:3, paddingHorizontal:7, paddingVertical:2, borderRadius:7, backgroundColor:'rgba(249,115,22,0.14)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(249,115,22,0.28)' },
    streakTxt:   { fontSize:9.5, fontWeight:'800' },
  });
  
  // ─── BADGES ROW ──────────────────────────────────────────────────────────────
  export const BadgesRow = memo(function BadgesRow({ badges }: { badges: GamiBadge[] }) {
    const sorted = useMemo(() => [...badges.filter(b => b.earned), ...badges.filter(b => !b.earned)], [badges]);
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap:9, paddingHorizontal:20 }}>
        {sorted.map(b => {
          const col = RARITY_COL[b.rarity] ?? C.muted;
          return (
            <View key={b.id} style={[brow.card, b.earned && { opacity:1, borderColor:`${col}45`, backgroundColor:`${col}0A` }]}>
              <View style={[brow.icon, b.earned && { borderColor:`${col}35`, backgroundColor:`${col}14` }]}>
                <Ionicons name={b.icon} size={17} color={b.earned ? col : C.muted} />
              </View>
              {b.earned && (
                <View style={[brow.rarity, { backgroundColor:`${col}14`, borderColor:`${col}30` }]}>
                  <Text style={[brow.rarityTxt, { color: col }]}>{RARITY_LBL[b.rarity]}</Text>
                </View>
              )}
              <Text style={[brow.label, b.earned && { color: C.offWhite }]} numberOfLines={2}>{b.label}</Text>
              {!b.earned && (
                <View style={{ position:'absolute', top:7, right:7 }}>
                  <Ionicons name="lock-closed" size={8} color={C.muted} />
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  });
  BadgesRow.displayName = 'BadgesRow';
  const brow = StyleSheet.create({
    card:     { alignItems:'center', gap:5, padding:11, borderRadius:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, width:84, opacity:0.5 },
    icon:     { width:40, height:40, borderRadius:20, backgroundColor:C.navyMid, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, alignItems:'center', justifyContent:'center' },
    label:    { color:C.muted, fontSize:8.5, fontWeight:'600', textAlign:'center', lineHeight:12 },
    rarity:   { paddingHorizontal:5, paddingVertical:1.5, borderRadius:5, borderWidth:StyleSheet.hairlineWidth },
    rarityTxt:{ fontSize:6.5, fontWeight:'900', letterSpacing:0.5 },
  });
  
  // ─── WEEKLY CHALLENGE CARD ────────────────────────────────────────────────────
  export const WeeklyChallengeCard = memo(function WeeklyChallengeCard({
    challenge, progress, onOpen,
  }: { challenge:WeeklyChallenge; progress:ChallengeProgress|null; onOpen:()=>void }) {
    const accent   = challenge.color_accent;
    const total    = challenge.steps.length;
    const doneDone = progress?.steps_done?.length ?? 0;
    const pct      = total > 0 ? doneDone / total : 0;
    const isDone   = progress?.completed ?? false;
    const diffCol  = DIFF_COL[challenge.difficulty] ?? C.blue;
  
    const pulseAnim = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (isDone) { pulseAnim.setValue(1); return; }
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue:1.012, duration:2200, useNativeDriver:true }),
        Animated.timing(pulseAnim, { toValue:1,     duration:2200, useNativeDriver:true }),
      ]));
      loop.start();
      return () => loop.stop();
    }, [isDone]);
  
    const barAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(barAnim, { toValue:pct, duration:900, useNativeDriver:false }).start();
    }, [pct]);
  
    return (
      <Animated.View style={{ transform:[{ scale:pulseAnim }], marginHorizontal:20, marginBottom:6 }}>
        <TouchableOpacity onPress={onOpen} activeOpacity={0.88} style={wcc.wrap}>
          <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
          {/* Bande latérale accentuée */}
          <View style={[wcc.strip, { backgroundColor:accent }]} />
  
          <View style={wcc.inner}>
            {/* Header */}
            <View style={wcc.header}>
              <View style={[wcc.iconWrap, { backgroundColor:`${accent}18`, borderColor:`${accent}38` }]}>
                <Ionicons name={challenge.icon} size={22} color={accent} />
              </View>
              <View style={{ flex:1, gap:4 }}>
                {/* Pills : semaine + difficulté + terminé */}
                <View style={{ flexDirection:'row', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  <View style={[wcc.pill, { borderColor:`${accent}35`, backgroundColor:`${accent}12` }]}>
                    <Ionicons name="flame-outline" size={8} color={accent} />
                    <Text style={[wcc.pillTxt, { color:accent }]}>SEM. {challenge.week_number}</Text>
                  </View>
                  <View style={[wcc.pill, { borderColor:`${diffCol}35`, backgroundColor:`${diffCol}10` }]}>
                    <Text style={[wcc.pillTxt, { color:diffCol }]}>{challenge.difficulty.toUpperCase()}</Text>
                  </View>
                  {isDone && (
                    <View style={[wcc.pill, { borderColor:'rgba(46,204,138,0.30)', backgroundColor:'rgba(46,204,138,0.08)' }]}>
                      <Ionicons name="checkmark-circle" size={8} color={C.green} />
                      <Text style={[wcc.pillTxt, { color:C.green }]}>TERMINÉ</Text>
                    </View>
                  )}
                </View>
                <Text style={wcc.title}>{challenge.title}</Text>
                {challenge.subtitle && <Text style={wcc.subtitle}>{challenge.subtitle}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={14} color={C.muted} />
            </View>
  
            {/* Dots étapes */}
            <View style={{ flexDirection:'row', gap:5 }}>
              {challenge.steps.map((_, i) => {
                const done = (progress?.steps_done ?? []).includes(i) || isDone;
                return (
                  <View key={i} style={[wcc.dot, done && { backgroundColor:accent, borderColor:accent }]}>
                    {done && <Ionicons name="checkmark" size={7} color={C.white} />}
                  </View>
                );
              })}
            </View>
  
            {/* Barre progression */}
            <View style={{ gap:5 }}>
              <View style={wcc.track}>
                <Animated.View style={[wcc.fill, {
                  width: barAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
                  backgroundColor: accent,
                }]} />
              </View>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={wcc.progTxt}>
                  {isDone ? `+${challenge.reward_points} pts gagnés` : `${Math.round(pct * 100)}% · ${challenge.reward_points} pts`}
                </Text>
                <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
                  <Ionicons name="flash" size={9} color={C.gold} />
                  <Text style={[wcc.progTxt, { color:C.gold }]}>+{challenge.reward_xp} XP</Text>
                </View>
              </View>
            </View>
  
            {/* Reward */}
            {challenge.reward_label && (
              <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
                <Ionicons name="gift-outline" size={10} color={C.muted} />
                <Text style={wcc.rewardTxt}>{challenge.reward_label}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  WeeklyChallengeCard.displayName = 'WeeklyChallengeCard';
  const wcc = StyleSheet.create({
    wrap:    { borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi },
    strip:   { position:'absolute', left:0, top:0, bottom:0, width:3 },
    inner:   { padding:16, paddingLeft:20, gap:10 },
    header:  { flexDirection:'row', alignItems:'flex-start', gap:12 },
    iconWrap:{ width:46, height:46, borderRadius:13, borderWidth:1, alignItems:'center', justifyContent:'center' },
    pill:    { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:7, borderWidth:StyleSheet.hairlineWidth },
    pillTxt: { fontSize:7.5, fontWeight:'800', letterSpacing:0.6 },
    title:   { color:C.white, fontSize:16, fontWeight:'800', letterSpacing:-0.3 },
    subtitle:{ color:C.muted, fontSize:11 },
    dot:     { width:16, height:16, borderRadius:8, borderWidth:1.5, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
    track:   { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
    fill:    { height:'100%', borderRadius:2 },
    progTxt: { color:C.muted, fontSize:10, fontWeight:'600' },
    rewardTxt:{ color:C.muted, fontSize:10 },
  });
  
  // ─── CHALLENGE WORK CARD (interne à la modale) ───────────────────────────────
  const ChallengeWorkCard = memo(function ChallengeWorkCard({ item }: { item: Work }) {
    const router = useRouter();
    const uri    = resolveImg(item.id, item.image);
    return (
      <TouchableOpacity style={{ marginRight:10 }} onPress={() => router.push(`/film/${item.id}` as any)} activeOpacity={0.88}>
        <View style={{ width:100, height:148, borderRadius:11, overflow:'hidden', backgroundColor:C.navyMid }}>
          <Image source={{ uri }} style={{ width:'100%', height:'100%' }} resizeMode="cover" />
          <LinearGradient colors={['transparent','rgba(7,12,23,0.94)']} style={StyleSheet.absoluteFillObject} />
          <View style={{ position:'absolute', bottom:7, left:7, right:7 }}>
            <Text style={{ color:C.white, fontSize:9.5, fontWeight:'700', lineHeight:13 }} numberOfLines={2}>
              {item.title}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  });
  ChallengeWorkCard.displayName = 'ChallengeWorkCard';
  
  // ─── WEEKLY CHALLENGE MODAL ──────────────────────────────────────────────────
  export const WeeklyChallengeModal = memo(function WeeklyChallengeModal({
    visible, onClose, challenge, progress, onStepComplete, works, userId,
  }: {
    visible:boolean; onClose:()=>void; challenge:WeeklyChallenge;
    progress:ChallengeProgress|null; onStepComplete:(step:number,done:boolean)=>void;
    works:Work[]; userId:string;
  }) {
    const router  = useRouter();
    const insets  = useSafeAreaInsets();
    const accent  = challenge.color_accent;
    const slideY  = useRef(new Animated.Value(SH)).current;
  
    const [activeStep,    setActiveStep]    = useState(0);
    const [showNarrative, setShowNarrative] = useState(true);
  
    // Sync étape avec la progression
    useEffect(() => {
      if (progress) setActiveStep(Math.min(progress.step_index, Math.max(0, challenge.steps.length - 1)));
    }, [progress, challenge.steps.length]);
  
    useEffect(() => {
      if (visible) {
        setShowNarrative(!!challenge.narrative);
        Animated.spring(slideY, { toValue:0, tension:65, friction:12, useNativeDriver:true }).start();
      } else {
        Animated.timing(slideY, { toValue:SH, duration:220, useNativeDriver:true }).start();
      }
    }, [visible, challenge.narrative]);
  
    const steps   = challenge.steps;
    const total   = steps.length;
    const current = steps[activeStep] ?? steps[0];
    const isDone  = progress?.completed ?? false;
    const doneSet = useMemo(() => new Set(progress?.steps_done ?? []), [progress]);
    const globalPct = total > 0 ? doneSet.size / total : 0;
    const diffCol  = DIFF_COL[challenge.difficulty] ?? C.blue;
  
    // Filtrage des œuvres liées
    const filteredWorks = useMemo(() => {
      const cfg = challenge.filter_config;
      if (!cfg) return works.slice(0, 10);
      switch (cfg.type) {
        case 'duration':   return works.filter(w => (w.duration ?? 0) > 0 && (w.duration ?? 0) <= (cfg.max ?? Infinity)).slice(0, 10);
        case 'likes_max':  return works.filter(w => (w.likes ?? 0) < (cfg.value ?? 100)).slice(0, 10);
        case 'original':   return works.filter(w => w.is_original).slice(0, 10);
        default:           return works.slice(0, 10);
      }
    }, [challenge.filter_config, works]);
  
    const handleAction = useCallback((action: string) => {
      const routes: Record<string, string> = {
        go_profile: '/profile', go_create: '/(tabs)/create',
        go_social:  '/(tabs)/social', go_catalog: '/search',
      };
      const route = routes[action];
      onClose();
      if (route) setTimeout(() => router.push(route as any), 250);
    }, [onClose, router]);
  
    const handleNext = useCallback(() => {
      const next = activeStep + 1;
      if (next < total) { setActiveStep(next); onStepComplete(next, false); }
      else              { onStepComplete(activeStep, true); }
    }, [activeStep, total, onStepComplete]);
  
    const handlePrev = useCallback(() => {
      if (activeStep > 0) setActiveStep(s => s - 1);
    }, [activeStep]);
  
    const globalBarAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
      Animated.timing(globalBarAnim, { toValue:globalPct, duration:800, useNativeDriver:false }).start();
    }, [globalPct]);
  
    if (!visible) return null;
  
    return (
      <Modal visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
        <GalaxyBackground />
        <Animated.View style={[wcm.root, { transform:[{ translateY:slideY }] }]}>
  
          {/* ── Top bar ── */}
          <View style={[wcm.topBar, { paddingTop: insets.top + 10 }]}>
            <View style={[wcm.topIcon, { backgroundColor:`${accent}18`, borderColor:`${accent}35` }]}>
              <Ionicons name={challenge.icon} size={14} color={accent} />
            </View>
            <View style={{ flex:1, gap:2 }}>
              <Text style={[wcm.topBadge, { color:accent }]}>
                DÉFI · SEM. {challenge.week_number} · {challenge.difficulty.toUpperCase()}
              </Text>
              <Text style={wcm.topTitle} numberOfLines={1}>{challenge.title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={wcm.closeBtn}>
              <Ionicons name="close" size={15} color={C.muted} />
            </TouchableOpacity>
          </View>
  
          {/* ── XP / Points bar ── */}
          <View style={wcm.xpSection}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
              <Text style={wcm.xpInfo}>
                {isDone ? '✓ Défi accompli !' : doneSet.size === 0 ? `${total} étapes` : `${doneSet.size}/${total} étapes`}
              </Text>
              <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                  <Ionicons name="star-outline" size={9} color={C.muted} />
                  <Text style={wcm.xpInfo}>{challenge.reward_points} pts</Text>
                </View>
                <View style={{ flexDirection:'row', alignItems:'center', gap:3 }}>
                  <Ionicons name="flash" size={9} color={C.gold} />
                  <Text style={[wcm.xpInfo, { color:C.gold }]}>+{challenge.reward_xp} XP</Text>
                </View>
              </View>
            </View>
            <View style={wcm.globalTrack}>
              <Animated.View style={[wcm.globalFill, {
                width: globalBarAnim.interpolate({ inputRange:[0,1], outputRange:['0%','100%'] }),
                backgroundColor: accent,
              }]} />
            </View>
          </View>
  
          <ScrollView showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
  
            {/* ── Narrative ── */}
            {showNarrative && !!challenge.narrative && (
              <TouchableOpacity
                style={[wcm.narrativeCard, { borderColor:`${accent}28`, backgroundColor:`${accent}07` }]}
                onPress={() => setShowNarrative(false)} activeOpacity={0.80}>
                <BlurView intensity={Platform.OS === 'ios' ? 12 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={{ flexDirection:'row', alignItems:'flex-start', gap:10 }}>
                  <View style={[wcm.narIcon, { borderColor:`${accent}35`, backgroundColor:`${accent}15` }]}>
                    <Ionicons name="book-outline" size={15} color={accent} />
                  </View>
                  <View style={{ flex:1, gap:6 }}>
                    <Text style={[wcm.narLabel, { color:accent }]}>HISTOIRE DU DÉFI</Text>
                    <Text style={wcm.narText}>{challenge.narrative}</Text>
                  </View>
                </View>
                <Text style={[wcm.narCta, { color:`${accent}80` }]}>Appuyer pour continuer →</Text>
              </TouchableOpacity>
            )}
  
            {/* ── Dots navigation ── */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal:20, gap:7, marginBottom:14 }}>
              {steps.map((s, i) => {
                const done    = doneSet.has(i) || isDone;
                const current = i === activeStep && !isDone;
                return (
                  <TouchableOpacity key={s.index} onPress={() => setActiveStep(i)}
                    style={[wcm.stepDot, done && wcm.stepDone, current && { borderColor:accent, borderWidth:2 }]}
                    activeOpacity={0.75}>
                    {done
                      ? <Ionicons name="checkmark" size={10} color={C.white} />
                      : <Text style={[wcm.stepNum, current && { color:accent }]}>{i + 1}</Text>
                    }
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
  
            {/* ── Carte étape active ── */}
            {!isDone && current && (
              <View style={wcm.stepCard}>
                <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
  
                <View style={{ flexDirection:'row', alignItems:'center', gap:10 }}>
                  <View style={[wcm.stepIconWrap, { backgroundColor:`${accent}15`, borderColor:`${accent}28` }]}>
                    <Ionicons name={current.icon} size={28} color={accent} />
                  </View>
                  <View style={[wcm.xpPill, { backgroundColor:`${C.gold}15`, borderColor:`${C.gold}35` }]}>
                    <Ionicons name="flash" size={9} color={C.gold} />
                    <Text style={[wcm.xpPillTxt, { color:C.gold }]}>+{current.xp} XP</Text>
                  </View>
                </View>
  
                <Text style={wcm.stepTitle}>{current.title}</Text>
                <Text style={wcm.stepDesc}>{current.desc}</Text>
  
                {current.tip && (
                  <View style={wcm.tipCard}>
                    <Ionicons name="bulb-outline" size={12} color={C.gold} />
                    <Text style={wcm.tipTxt}>{current.tip}</Text>
                  </View>
                )}
  
                <TouchableOpacity
                  style={[wcm.actionBtn, { borderColor:`${accent}38`, backgroundColor:`${accent}10` }]}
                  onPress={() => handleAction(current.action)} activeOpacity={0.80}>
                  <Text style={[wcm.actionTxt, { color:accent }]}>{current.actionLabel}</Text>
                  <Ionicons name="arrow-forward" size={13} color={accent} />
                </TouchableOpacity>
  
                <View style={wcm.navRow}>
                  <TouchableOpacity onPress={handlePrev} disabled={activeStep === 0}
                    style={[wcm.prevBtn, activeStep === 0 && { opacity:0.3 }]}>
                    <Ionicons name="chevron-back" size={13} color={C.muted} />
                    <Text style={wcm.prevTxt}>Précédent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleNext}
                    style={[wcm.nextBtn, { backgroundColor:accent }]} activeOpacity={0.85}>
                    <Text style={wcm.nextTxt}>{activeStep === total - 1 ? 'Terminer' : 'Suivant'}</Text>
                    <Ionicons name={activeStep === total - 1 ? 'checkmark-circle' : 'chevron-forward'} size={13} color={C.white} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
  
            {/* ── Défi terminé ── */}
            {isDone && (
              <View style={wcm.doneCard}>
                <BlurView intensity={Platform.OS === 'ios' ? 18 : 12} tint="dark" style={StyleSheet.absoluteFillObject} />
                <View style={wcm.trophyWrap}>
                  <Ionicons name="trophy" size={38} color={C.gold} />
                </View>
                <Text style={wcm.doneTitle}>Défi accompli !</Text>
                <Text style={wcm.doneSub}>+{challenge.reward_points} pts · +{challenge.reward_xp} XP</Text>
                <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
                  {challenge.reward_label && (
                    <View style={[wcm.rewardPill, { borderColor:`${C.gold}30`, backgroundColor:`${C.gold}10` }]}>
                      <Ionicons name="ribbon-outline" size={11} color={C.gold} />
                      <Text style={[wcm.rewardPillTxt, { color:C.gold }]}>{challenge.reward_label}</Text>
                    </View>
                  )}
                  <View style={[wcm.rewardPill, { borderColor:`${C.green}30`, backgroundColor:`${C.green}10` }]}>
                    <Ionicons name="flash" size={11} color={C.green} />
                    <Text style={[wcm.rewardPillTxt, { color:C.green }]}>+{challenge.reward_xp} XP</Text>
                  </View>
                </View>
              </View>
            )}
  
            {/* ── Œuvres liées ── */}
            {filteredWorks.length > 0 && (
              <View style={{ marginTop:14 }}>
                <View style={{ flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:20, marginBottom:11 }}>
                  <Ionicons name="film-outline" size={12} color={C.muted} />
                  <Text style={{ color:C.white, fontSize:13, fontWeight:'800' }}>Œuvres pour ce défi</Text>
                  <View style={{ paddingHorizontal:6, paddingVertical:1.5, borderRadius:6, backgroundColor:C.faint, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border }}>
                    <Text style={{ color:C.muted, fontSize:8, fontWeight:'700' }}>{filteredWorks.length}</Text>
                  </View>
                </View>
                <FlatList
                  horizontal
                  data={filteredWorks}
                  keyExtractor={w => `cw_${w.id}`}
                  renderItem={({ item }) => <ChallengeWorkCard item={item} />}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal:20 }}
                  initialNumToRender={6}
                />
              </View>
            )}
  
            {/* ── Toutes les étapes ── */}
            <View style={{ paddingHorizontal:20, marginTop:18 }}>
              <Text style={{ color:C.muted, fontSize:9.5, fontWeight:'700', letterSpacing:0.8, marginBottom:10 }}>
                TOUTES LES ÉTAPES
              </Text>
              {steps.map((s, i) => {
                const done    = doneSet.has(i) || isDone;
                const isCur   = i === activeStep && !isDone;
                return (
                  <TouchableOpacity key={s.index} onPress={() => setActiveStep(i)}
                    style={[wcm.allRow, done && wcm.allRowDone, isCur && { borderColor:`${accent}38` }]}
                    activeOpacity={0.78}>
                    <View style={[wcm.allNum,
                      done  && { backgroundColor:`${C.green}18`, borderColor:`${C.green}38` },
                      isCur && { backgroundColor:`${accent}14`,  borderColor:`${accent}30` },
                    ]}>
                      {done
                        ? <Ionicons name="checkmark" size={9} color={C.green} />
                        : <Text style={[wcm.allNumTxt, isCur && { color:accent }]}>{i + 1}</Text>
                      }
                    </View>
                    <View style={{ flex:1, gap:1 }}>
                      <Text style={[wcm.allTitle, (done || isCur) && { color:C.white }]}>{s.title}</Text>
                      <Text style={wcm.allDesc} numberOfLines={1}>{s.desc}</Text>
                    </View>
                    <View style={{ flexDirection:'row', alignItems:'center', gap:5 }}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:2 }}>
                        <Ionicons name="flash" size={8} color={done ? C.green : C.muted} />
                        <Text style={{ color:done ? C.green : C.muted, fontSize:9, fontWeight:'700' }}>{s.xp}</Text>
                      </View>
                      <Ionicons name={done ? 'checkmark-circle' : 'chevron-forward'} size={13}
                        color={done ? C.green : C.border} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
  
            {/* ── À propos ── */}
            <View style={wcm.aboutCard}>
              <BlurView intensity={Platform.OS === 'ios' ? 10 : 8} tint="dark" style={StyleSheet.absoluteFillObject} />
              <View style={{ flexDirection:'row', alignItems:'center', gap:7, marginBottom:8 }}>
                <Ionicons name="information-circle-outline" size={13} color={C.muted} />
                <Text style={{ color:C.muted, fontSize:9.5, fontWeight:'700', letterSpacing:0.5 }}>À PROPOS DU DÉFI</Text>
              </View>
              <Text style={wcm.aboutTxt}>{challenge.description}</Text>
            </View>
  
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  });
  WeeklyChallengeModal.displayName = 'WeeklyChallengeModal';
  
  const wcm = StyleSheet.create({
    root:         { flex:1, backgroundColor:'rgba(7,12,23,0.15)' },
    topBar:       { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingBottom:12, gap:10 },
    topIcon:      { width:32, height:32, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'center' },
    topBadge:     { fontSize:7.5, fontWeight:'800', letterSpacing:1 },
    topTitle:     { color:C.white, fontSize:15, fontWeight:'800', letterSpacing:-0.2 },
    closeBtn:     { width:32, height:32, borderRadius:16, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
    xpSection:    { paddingHorizontal:20, marginBottom:14 },
    xpInfo:       { color:C.muted, fontSize:10, fontWeight:'600' },
    globalTrack:  { height:3, borderRadius:2, backgroundColor:C.faint, overflow:'hidden' },
    globalFill:   { height:'100%', borderRadius:2 },
    narrativeCard:{ marginHorizontal:20, marginBottom:12, borderRadius:16, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, padding:16, gap:10 },
    narIcon:      { width:36, height:36, borderRadius:10, borderWidth:1, alignItems:'center', justifyContent:'center' },
    narLabel:     { fontSize:8, fontWeight:'900', letterSpacing:1.5 },
    narText:      { color:'rgba(255,255,255,0.68)', fontSize:13, lineHeight:20, fontStyle:'italic' },
    narCta:       { fontSize:9.5, fontWeight:'600', textAlign:'right', marginTop:4 },
    stepDot:      { width:28, height:28, borderRadius:14, borderWidth:1.5, borderColor:C.border, backgroundColor:C.faint, alignItems:'center', justifyContent:'center' },
    stepDone:     { backgroundColor:'rgba(46,204,138,0.18)', borderColor:'rgba(46,204,138,0.45)' },
    stepNum:      { color:C.muted, fontSize:11, fontWeight:'700' },
    stepCard:     { marginHorizontal:20, borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderHi, padding:20, gap:12, marginBottom:10 },
    stepIconWrap: { width:58, height:58, borderRadius:15, borderWidth:1, alignItems:'center', justifyContent:'center' },
    xpPill:       { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:3, borderRadius:9, borderWidth:StyleSheet.hairlineWidth },
    xpPillTxt:    { fontSize:10, fontWeight:'800' },
    stepTitle:    { color:C.white, fontSize:20, fontWeight:'900', letterSpacing:-0.4, lineHeight:26 },
    stepDesc:     { color:'rgba(255,255,255,0.62)', fontSize:14, lineHeight:22 },
    tipCard:      { flexDirection:'row', alignItems:'flex-start', gap:8, padding:11, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.22)', backgroundColor:'rgba(245,200,66,0.07)' },
    tipTxt:       { color:'rgba(255,255,255,0.58)', fontSize:12, lineHeight:18, flex:1 },
    actionBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, paddingVertical:13, borderRadius:14, borderWidth:1 },
    actionTxt:    { fontSize:14, fontWeight:'700' },
    navRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:9 },
    prevBtn:      { flexDirection:'row', alignItems:'center', gap:5, paddingVertical:10, paddingHorizontal:13, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint },
    prevTxt:      { color:C.muted, fontSize:12, fontWeight:'600' },
    nextBtn:      { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:7, paddingVertical:13, borderRadius:14 },
    nextTxt:      { color:C.white, fontSize:13, fontWeight:'800' },
    doneCard:     { marginHorizontal:20, borderRadius:18, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(245,200,66,0.32)', padding:24, alignItems:'center', gap:8, marginBottom:10 },
    trophyWrap:   { width:68, height:68, borderRadius:34, backgroundColor:'rgba(245,200,66,0.14)', borderWidth:1.5, borderColor:'rgba(245,200,66,0.32)', alignItems:'center', justifyContent:'center' },
    doneTitle:    { color:C.white, fontSize:22, fontWeight:'900' },
    doneSub:      { color:C.muted, fontSize:12, textAlign:'center' },
    rewardPill:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:11, paddingVertical:5, borderRadius:18, borderWidth:1 },
    rewardPillTxt:{ fontSize:11, fontWeight:'700' },
    aboutCard:    { marginHorizontal:20, borderRadius:13, overflow:'hidden', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, padding:13, marginTop:10, marginBottom:6 },
    aboutTxt:     { color:'rgba(255,255,255,0.48)', fontSize:12, lineHeight:19 },
    allRow:       { flexDirection:'row', alignItems:'center', gap:11, padding:11, borderRadius:11, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border, backgroundColor:C.faint, marginBottom:7 },
    allRowDone:   { borderColor:'rgba(46,204,138,0.18)', backgroundColor:'rgba(46,204,138,0.04)' },
    allNum:       { width:28, height:28, borderRadius:14, borderWidth:1, borderColor:C.border, backgroundColor:C.navyMid, alignItems:'center', justifyContent:'center', flexShrink:0 },
    allNumTxt:    { color:C.muted, fontSize:11, fontWeight:'700' },
    allTitle:     { color:C.muted, fontSize:12, fontWeight:'700' },
    allDesc:      { color:C.muted, fontSize:9 },
  });
  
  // ─── EXPORTS ─────────────────────────────────────────────────────────────────
  export default {
    useGamification, useWeeklyChallenge,
    XPBar, BadgesRow, WeeklyChallengeCard, WeeklyChallengeModal,
    FALLBACK_CHALLENGE, xpToLevel, resolveImg,
  };