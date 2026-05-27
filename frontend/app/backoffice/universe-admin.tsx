import React, {
    memo, useCallback, useEffect, useMemo, useRef, useState,
  } from 'react';
  import {
      ActivityIndicator,
    Animated, FlatList, Keyboard, KeyboardAvoidingView,
    Modal, Platform, Pressable, ScrollView, SectionList,
    StyleSheet, Text, TextInput, TouchableOpacity, View,
  } from 'react-native';
  import { Image }         from 'expo-image';
  import { LinearGradient }from 'expo-linear-gradient';
  import { BlurView }      from 'expo-blur';
  import { StatusBar }     from 'expo-status-bar';
  import { SafeAreaView }  from 'react-native-safe-area-context';
  import { useRouter }     from 'expo-router';
  import { Ionicons }      from '@expo/vector-icons';
  import * as Haptics      from 'expo-haptics';
  import { supabase }      from '@/lib/supabase';
  import GalaxyBackground  from '@/components/social/GalaxyBackground';
  
  // ── expo-video (optional)
  let _useVideoPlayer: any = null;
  let _VideoView:      any = null;
  let _useEvent:       any = (_p:any,_e:string,d:any)=>d;
  if (Platform.OS !== 'web') {
    try {
      const ev        = require('expo-video');
      _useVideoPlayer = ev.useVideoPlayer;
      _VideoView      = ev.VideoView;
      _useEvent       = ev.useEvent ?? ((_p:any,_e:string,d:any)=>d);
    } catch {}
  }
  function setupPlayer(p:any) {
    if (!p) return;
    p.loop=true; p.muted=true;
    try { p.bufferOptions={preferredForwardBufferDuration:6,preferredBackwardBufferDuration:0}; } catch {}
  }
  const _hook = _useVideoPlayer ?? ((_src:any)=>null);
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TOKENS
  // ─────────────────────────────────────────────────────────────────────────────
  // TOKENS — rouge / vert + navyMid transparent uniquement
  const NAVY = '#0D2240';
  const C = {
    bg:       '#03020A',
    nav:      NAVY,
    surface:  'rgba(13,34,64,0.55)',
    surfMd:   'rgba(13,34,64,0.80)',
    border:   'rgba(255,255,255,0.09)',
    borderHi: 'rgba(255,255,255,0.18)',
    white:    '#FFFFFF',
    offWhite: 'rgba(255,255,255,0.85)',
    muted:    'rgba(255,255,255,0.40)',
    faint:    'rgba(255,255,255,0.13)',
    green:    '#22C55E',  greenDk:'#14532D',
    red:      '#EF4444',  redDk:  '#7F1D1D',
    // Neutralisés — garder les refs sans changer le code
    amber:    'rgba(255,255,255,0.70)',  amberDk: NAVY,
    blue:     'rgba(255,255,255,0.70)',  blueDk:  NAVY,
    violet:   'rgba(255,255,255,0.70)',
  } as const;
  
  const VIDEO_H = 220;
  const EDGE    = 14;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TYPES
  // ─────────────────────────────────────────────────────────────────────────────
  type Status      = 'pending'|'approved'|'rejected';
  type RejCategory = 'inappropriate'|'quality'|'format'|'copyright'|'spam'|'other'|'privacy'|'violence';
  type SortKey     = 'date_desc'|'date_asc'|'score_asc'|'score_desc'|'likes_desc';
  
  interface AdminReel {
    id:string; created_at:string; user_id:string; video_url:string;
    thumbnail_url:string|null; title:string|null; genre:string|null;
    director:string|null; year:string|null; synopsis:string|null;
    duration:number|null; likes_count:number; views_count:number;
    status:Status; rejection_category:RejCategory|null;
    rejection_reason:string|null; moderated_at:string|null;
    moderated_by:string|null;
  }
  
  interface SafetyResult {
    score:       number;           // 0 (dangereux) → 100 (sûr)
    level:       'safe'|'warn'|'danger';
    flags:       SafetyFlag[];
    suggestion:  'approve'|'review'|'reject';
  }
  
  interface SafetyFlag {
    type:    'vulgar'|'privacy'|'violence'|'spam'|'copyright'|'quality';
    label:   string;
    detail:  string;
    weight:  number;              // contribution au score
  }
  
  interface Filters {
    search:  string;
    genre:   string;
    sort:    SortKey;
    minScore:number;
    dateFrom:string;
  }
  
  const FILTER_DEFAULTS: Filters = {
    search:'', genre:'', sort:'date_desc', minScore:0, dateFrom:'',
  };
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ★ ANALYSEUR DE SÉCURITÉ AUTONOME — AI-type, côté client
  //   Analyse titre + synopsis + genre pour détecter contenu problématique
  // ─────────────────────────────────────────────────────────────────────────────
  const VULGAR_CORPUS = [
    'pornograph','sexe explicit','contenu sexuel','nudite explicit','nude','naked',
    'nsfw','xxx','porn ','sex tape','adult content','erotique','18+','topless',
    'fellation','masturbat','penetr','sodomie','foutre','encule','enculer',
    'pute','salope','connard','connasse','batard','fdp','ntm','nique ta',
    'fuck','bitch','cunt','whore','slut','asshole','motherfuck','faggot',
  ];
  const PRIVACY_CORPUS = [
    'revenge porn','photo volee','leaked','fuitee','sans consentement',
    'voyeur','camera cachee','hidden cam','spy cam','upskirt',
    'nude prive','intimite','ex petite amie','ex petit ami','sextape',
    'iban','carte bancaire','passeport','adresse perso','doxxing','swatting',
    'stalking','harcelement','hacke','donnees personnelles',
  ];
  const VIOLENCE_CORPUS = [
    'torture','massacre','meurtre','homicide','assassinat','decapitation',
    'suicide','automutilation','self harm','overdose',
    'viol','agression sexuelle','molest','pedophil','mineur',
    'terrorisme','attentat','extremisme','arme a feu','bombe','explosif',
    'drogue','deal ','cocaine','heroine','crack ','meth',
    'gore ','snuff','combat reel','bagarre reelle','accident mortel',
  ];
  const HATE_CORPUS = [
    'raciste','antisemite','islamophobie','negrophobie','homophobie',
    'transphobe','supremaciste','nazi','fasciste','genocide',
    'fausse information','fake news','complot','propagande','hoax',
  ];
  const SPAM_PATTERNS = [
    /cliquez?\s*ici/i, /abonnez?[- ]vous/i, /lien en bio/i,
    /promo\s*cod/i, /discount\s*\d+/i, /bit\.ly/i, /t\.co\//i,
    /argent\s*facile/i, /gain\s*rapide/i, /buy\s*now/i,
    /follow\s*for\s*follow/i, /like\s*for\s*like/i, /sub4sub/i,
  ];
  const QUALITY_PATTERNS = [
    /^test$/i, /^essai$/i, /upload[-_]test/i, /^toto$/i,
    /^(aaa+|zzz+|123|abc)$/i, /^sans[-_ ]titre$/i, /^untitled$/i,
    /^video[-_]\d+$/i, /^film[-_]\d+$/i,
  ];
  
  // Normalise pour la détection (accents, ponctuation, casse)
  function normalizeText(s: string): string {
    return s.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_\-.,:!?;]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  
  // ★ CLASSIFIEUR PRINCIPAL — score 0→100 + flags pondérés + suggestion auto
  export function analyzeSafety(reel: AdminReel): SafetyResult {
    const raw = normalizeText(
      [reel.title, reel.synopsis, reel.genre, reel.director, reel.year]
        .filter(Boolean).join(' ')
    );
    const flags: SafetyFlag[] = [];
    let deduction = 0;
  
    // Vulgarité (25 pts/hit, cap 75)
    const vulgarHits = VULGAR_CORPUS.filter(t => raw.includes(t));
    if (vulgarHits.length) {
      const w = Math.min(75, vulgarHits.length * 25);
      flags.push({ type:'vulgar', label:'Contenu vulgaire / sexuel explicite',
        detail: vulgarHits.slice(0,4).join(', '), weight: w });
      deduction += w;
    }
  
    // Vie privée (22 pts/hit, cap 66)
    const privacyHits = PRIVACY_CORPUS.filter(t => raw.includes(t));
    if (privacyHits.length) {
      const w = Math.min(66, privacyHits.length * 22);
      flags.push({ type:'privacy', label:'Atteinte à la vie privée / non-consentement',
        detail: privacyHits.slice(0,3).join(', '), weight: w });
      deduction += w;
    }
  
    // Violence / danger (20 pts/hit, cap 60)
    const violenceHits = VIOLENCE_CORPUS.filter(t => raw.includes(t));
    if (violenceHits.length) {
      const w = Math.min(60, violenceHits.length * 20);
      flags.push({ type:'violence', label:'Violence / contenu dangereux',
        detail: violenceHits.slice(0,3).join(', '), weight: w });
      deduction += w;
    }
  
    // Discours haineux (18 pts/hit, cap 54)
    const hateHits = HATE_CORPUS.filter(t => raw.includes(t));
    if (hateHits.length) {
      const w = Math.min(54, hateHits.length * 18);
      flags.push({ type:'vulgar', label:'Discours haineux / discriminatoire',
        detail: hateHits.slice(0,3).join(', '), weight: w });
      deduction += w;
    }
  
    // Spam / promo (15 pts/pattern, cap 45)
    const spamHits = SPAM_PATTERNS.filter(p => p.test(raw));
    if (spamHits.length) {
      const w = Math.min(45, spamHits.length * 15);
      flags.push({ type:'spam', label:'Spam / contenu promotionnel',
        detail: `${spamHits.length} motif(s) détecté(s)`, weight: w });
      deduction += w;
    }
  
    // Qualité insuffisante (12 pts)
    const isLowQ = QUALITY_PATTERNS.some(p => p.test(normalizeText(reel.title ?? '')))
      || !reel.title?.trim() || reel.title.trim().length < 3
      || (reel.synopsis ?? '').trim().length < 10;
    if (isLowQ) {
      flags.push({ type:'quality', label:'Métadonnées insuffisantes',
        detail: 'Titre / synopsis trop courts ou génériques', weight: 12 });
      deduction += 12;
    }
  
    const score      = Math.max(0, 100 - deduction);
    const level      = score >= 65 ? 'safe' : score >= 35 ? 'warn' : 'danger';
    const suggestion = score >= 65 ? 'approve' : score >= 35 ? 'review' : 'reject';
  
    return { score, level, flags, suggestion };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DB + HELPERS
  // ─────────────────────────────────────────────────────────────────────────────
  const BUCKET = 'community-images';
  const COLS   = 'id,created_at,user_id,video_url,thumbnail_url,title,genre,director,' +
                 'year,synopsis,duration,likes_count,views_count,status,' +
                 'rejection_category,rejection_reason,moderated_at,moderated_by';
  
  function resolveUrl(raw:string|null): string {
    if (!raw?.trim()) return '';
    if (raw.startsWith('http')) return raw;
    try { return supabase.storage.from(BUCKET).getPublicUrl(raw).data.publicUrl; }
    catch { return ''; }
  }
  
  function fmtDate(iso:string|null,compact=false): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (compact) return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
    return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
  
  function fmtDuration(s:number|null): string {
    if (!s) return '';
    const m=Math.floor(s/60),sec=s%60;
    return `${m}:${String(sec).padStart(2,'0')}`;
  }
  
  function fmtNumber(n:number): string {
    if (n>=1000) return `${(n/1000).toFixed(1)}K`;
    return String(n);
  }
  
  async function fetchReels(status:Status): Promise<AdminReel[]> {
    const { data, error } = await supabase
      .from('reels').select(COLS)
      .eq('status',status).order('created_at',{ascending:false}).limit(150);
    if (error) { console.warn('[admin]',error.message); return []; }
    return (data??[]) as AdminReel[];
  }
  
  async function fetchCounts(): Promise<Record<Status,number>> {
    const [p,a,r] = await Promise.all([
      supabase.from('reels').select('id',{count:'exact',head:true}).eq('status','pending'),
      supabase.from('reels').select('id',{count:'exact',head:true}).eq('status','approved'),
      supabase.from('reels').select('id',{count:'exact',head:true}).eq('status','rejected'),
    ]);
    return { pending:p.count??0, approved:a.count??0, rejected:r.count??0 };
  }
  
  async function moderateReel(params:{
    id:string; status:Status; category?:RejCategory|null;
    reason?:string|null; moderatorId:string;
  }): Promise<void> {
    const payload:any = {
      status:params.status, moderated_by:params.moderatorId,
      moderated_at:new Date().toISOString(),
    };
    if (params.status==='rejected') {
      payload.rejection_category = params.category??null;
      payload.rejection_reason   = params.reason??null;
    } else {
      payload.rejection_category = null;
      payload.rejection_reason   = null;
    }
    const { error } = await supabase.from('reels').update(payload).eq('id',params.id);
    if (error) throw new Error(error.message);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REJECTION CATEGORIES
  // ─────────────────────────────────────────────────────────────────────────────
  const REJ_CATS: {key:RejCategory;label:string;icon:string;color:string;desc:string}[] = [
    { key:'inappropriate', label:'Contenu inapproprié', icon:'warning-outline',     color:'#EF4444', desc:'Violence, nudité ou contenu choquant' },
    { key:'privacy',       label:'Vie privée',          icon:'shield-outline',       color:'#EC4899', desc:'Divulgation de données personnelles' },
    { key:'violence',      label:'Violence',             icon:'flash-outline',        color:'#F97316', desc:'Scènes violentes ou dangereuses'    },
    { key:'copyright',     label:'Droits d\'auteur',    icon:'lock-closed-outline',  color:'#8B5CF6', desc:'Contenu soumis à copyright'          },
    { key:'quality',       label:'Qualité',              icon:'eye-off-outline',      color:'#F59E0B', desc:'Vidéo illisible ou métadonnées vides'},
    { key:'format',        label:'Mauvais format',       icon:'construct-outline',    color:'#6B7280', desc:'Format non supporté ou corrompu'     },
    { key:'spam',          label:'Spam',                 icon:'copy-outline',         color:'#64748B', desc:'Contenu répétitif ou promotionnel'   },
    { key:'other',         label:'Autre',                icon:'help-circle-outline',  color:'#9CA3AF', desc:'Autre motif (préciser)'              },
  ];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS CONFIG
  // ─────────────────────────────────────────────────────────────────────────────
  const STATUS_CFG: Record<Status,{label:string;icon:string;color:string;bg:string}> = {
    pending:  { label:'En attente', icon:'time-outline',             color:C.offWhite, bg:'rgba(255,255,255,0.07)' },
    approved: { label:'Validé',     icon:'checkmark-circle-outline', color:C.green,    bg:`${C.green}20`           },
    rejected: { label:'Rejeté',     icon:'close-circle-outline',     color:C.red,      bg:`${C.red}20`             },
  };
  
  const SORT_OPTIONS: {key:SortKey;label:string}[] = [
    {key:'date_desc',  label:'Date ↓'},
    {key:'date_asc',   label:'Date ↑'},
    {key:'score_asc',  label:'Score ↑'},
    {key:'score_desc', label:'Score ↓'},
    {key:'likes_desc', label:'Likes ↓'},
  ];
  
  const GENRES = ['Tous','Drame','Thriller','Sci-Fi','Documentaire','Animation','Court métrage','Expérimental','Biopic','Autre'];
  
  
  // ─────────────────────────────────────────────────────────────────────────────
  // SAFETY BADGE — score visuel de l'analyseur IA
  // ─────────────────────────────────────────────────────────────────────────────
  const SafetyBadge = memo(function SafetyBadge({result,compact=false}:{result:SafetyResult;compact?:boolean}) {
    // Palette binaire : vert (sûr) / rouge (warn ou danger)
    const color = result.level==='safe'?C.green:C.red;
    const icon  = result.level==='safe'?'shield-checkmark-outline':'shield-outline';
    const label = compact ? `${result.score}` : `Score ${result.score}`;
    return(
      <View style={[sb.wrap,{backgroundColor:`${color}18`,borderColor:`${color}40`}]}>
        <Ionicons name={icon as any} size={compact?9:11} color={color}/>
        <Text style={[sb.txt,{color}]}>{label}</Text>
      </View>
    );
  });
  const sb = StyleSheet.create({
    wrap:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,borderWidth:1},
    txt: {fontSize:9,fontWeight:'800'},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ANALYTICS BANNER
  // ─────────────────────────────────────────────────────────────────────────────
  const AnalyticsBanner = memo(function AnalyticsBanner({
    counts, dangerCount, warningCount,
  }:{counts:Record<Status,number>;dangerCount:number;warningCount:number}) {
    const total    = counts.pending+counts.approved+counts.rejected;
    const approvalRate = total>0 ? Math.round((counts.approved/total)*100) : 0;
    return(
      <View style={an.wrap}>
        <BlurView intensity={Platform.OS==='ios'?14:9} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={an.row}>
          <View style={an.item}>
            <Text style={[an.val,{color:C.offWhite}]}>{counts.pending}</Text>
            <Text style={an.lbl}>En attente</Text>
          </View>
          <View style={an.divider}/>
          <View style={an.item}>
            <Text style={[an.val,{color:C.green}]}>{counts.approved}</Text>
            <Text style={an.lbl}>Validées</Text>
          </View>
          <View style={an.divider}/>
          <View style={an.item}>
            <Text style={[an.val,{color:C.red}]}>{counts.rejected}</Text>
            <Text style={an.lbl}>Rejetées</Text>
          </View>
          <View style={an.divider}/>
          <View style={an.item}>
            <Text style={[an.val,{color:C.green}]}>{approvalRate}%</Text>
            <Text style={an.lbl}>Taux OK</Text>
          </View>
        </View>
        {(dangerCount>0||warningCount>0)&&(
          <View style={an.alertRow}>
            {dangerCount>0&&(
              <View style={[an.alert,{backgroundColor:`${C.red}18`,borderColor:`${C.red}40`}]}>
                <Ionicons name="shield-outline" size={10} color={C.red}/>
                <Text style={[an.alertTxt,{color:C.red}]}>{dangerCount} alerte{dangerCount>1?'s':''} critiques</Text>
              </View>
            )}
            {warningCount>0&&(
              <View style={[an.alert,{backgroundColor:'rgba(255,255,255,0.07)',borderColor:C.border}]}>
                <Ionicons name="warning-outline" size={10} color={C.muted}/>
                <Text style={[an.alertTxt,{color:C.muted}]}>{warningCount} à vérifier</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  });
  const an = StyleSheet.create({
    wrap:     {marginHorizontal:EDGE,marginBottom:14,borderRadius:16,overflow:'hidden',borderWidth:1,borderColor:C.border,backgroundColor:'transparent'},
    row:      {flexDirection:'row',paddingVertical:12,paddingHorizontal:16},
    item:     {flex:1,alignItems:'center',gap:2},
    val:      {fontSize:18,fontWeight:'900',letterSpacing:-0.5},
    lbl:      {color:C.muted,fontSize:9,fontWeight:'600',textTransform:'uppercase',letterSpacing:0.5},
    divider:  {width:1,backgroundColor:C.border,marginHorizontal:4},
    alertRow: {flexDirection:'row',gap:8,paddingHorizontal:14,paddingBottom:10,flexWrap:'wrap'},
    alert:    {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:4,borderRadius:10,borderWidth:1},
    alertTxt: {fontSize:10,fontWeight:'700'},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // STATUS TABS
  // ─────────────────────────────────────────────────────────────────────────────
  const StatusTabs = memo(function StatusTabs({
    active,counts,onChange,
  }:{active:Status;counts:Record<Status,number>;onChange:(s:Status)=>void}) {
    return(
      <View style={st.row}>
        {(['pending','approved','rejected'] as Status[]).map(s=>{
          const cfg=STATUS_CFG[s]; const on=active===s;
          return(
            <TouchableOpacity key={s} style={[st.tab,on&&{borderColor:cfg.color,backgroundColor:cfg.bg}]} onPress={()=>onChange(s)} activeOpacity={0.78}>
              <Ionicons name={cfg.icon as any} size={13} color={on?cfg.color:C.muted}/>
              <Text style={[st.label,on&&{color:cfg.color,fontWeight:'700'}]}>{cfg.label}</Text>
              {counts[s]>0&&(
                <View style={[st.badge,{backgroundColor:on?cfg.color:C.surface}]}>
                  <Text style={[st.bdgTxt,{color:on?C.bg:C.muted}]}>{counts[s]}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  });
  const st = StyleSheet.create({
    row:    {flexDirection:'row',paddingHorizontal:EDGE,gap:8,marginBottom:12},
    tab:    {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:5,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:C.border,backgroundColor:C.surface},
    label:  {color:C.muted,fontSize:10,fontWeight:'600'},
    badge:  {paddingHorizontal:5,paddingVertical:1,borderRadius:8,minWidth:18,alignItems:'center'},
    bdgTxt: {fontSize:9,fontWeight:'800'},
    bg:     {backgroundColor:C.bg},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // FILTER BAR
  // ─────────────────────────────────────────────────────────────────────────────
  const FilterBar = memo(function FilterBar({
    filters,onChange,onClear,
  }:{filters:Filters;onChange:(f:Partial<Filters>)=>void;onClear:()=>void}) {
    const [showSort,setShowSort]=useState(false);
    const [showGenre,setShowGenre]=useState(false);
    const hasActive = filters.search||filters.genre||filters.sort!=='date_desc'||filters.minScore>0||filters.dateFrom;
  
    return(
      <View style={fb.wrap}>
        {/* Barre de recherche */}
        <View style={fb.searchRow}>
          <Ionicons name="search" size={13} color={C.muted} style={{marginRight:6}}/>
          <TextInput
            style={fb.searchInput}
            placeholder="Titre, genre, réalisateur, user id…"
            placeholderTextColor="rgba(255,255,255,0.22)"
            value={filters.search}
            onChangeText={v=>onChange({search:v})}
            selectionColor={C.white}
            autoCorrect={false}
          />
          {filters.search.length>0&&(
            <TouchableOpacity onPress={()=>onChange({search:''})} hitSlop={8 as any}>
              <Ionicons name="close-circle" size={14} color={C.muted}/>
            </TouchableOpacity>
          )}
        </View>
  
        {/* Chips filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fb.chipsRow}>
  
          {/* Score minimum */}
          {[0,40,70].map(s=>(
            <TouchableOpacity key={s} style={[fb.chip,filters.minScore===s&&fb.chipOn]} onPress={()=>onChange({minScore:s})} activeOpacity={0.80}>
              <Ionicons name="shield-outline" size={10} color={filters.minScore===s?C.white:C.muted}/>
              <Text style={[fb.chipTxt,filters.minScore===s&&fb.chipTxtOn]}>{s===0?'Tous':s===40?'Sûr ≥40':'Fiable ≥70'}</Text>
            </TouchableOpacity>
          ))}
  
          <View style={fb.sep}/>
  
          {/* Tri */}
          <TouchableOpacity style={[fb.chip,showSort&&fb.chipOn]} onPress={()=>setShowSort(v=>!v)} activeOpacity={0.80}>
            <Ionicons name="funnel-outline" size={10} color={showSort?C.white:C.muted}/>
            <Text style={[fb.chipTxt,showSort&&fb.chipTxtOn]}>{SORT_OPTIONS.find(o=>o.key===filters.sort)?.label??'Tri'}</Text>
            <Ionicons name={showSort?'chevron-up':'chevron-down'} size={9} color={showSort?C.white:C.muted}/>
          </TouchableOpacity>
  
          {/* Genre */}
          <TouchableOpacity style={[fb.chip,filters.genre&&fb.chipOn]} onPress={()=>setShowGenre(v=>!v)} activeOpacity={0.80}>
            <Ionicons name="film-outline" size={10} color={filters.genre?C.white:C.muted}/>
            <Text style={[fb.chipTxt,!!filters.genre&&fb.chipTxtOn]}>{filters.genre||'Genre'}</Text>
            <Ionicons name={showGenre?'chevron-up':'chevron-down'} size={9} color={filters.genre?C.white:C.muted}/>
          </TouchableOpacity>
  
          {/* Clear */}
          {hasActive&&(
            <TouchableOpacity style={[fb.chip,{borderColor:`${C.red}50`,backgroundColor:`${C.red}14`}]} onPress={onClear} activeOpacity={0.80}>
              <Ionicons name="close" size={10} color={C.red}/>
              <Text style={[fb.chipTxt,{color:C.red}]}>Effacer</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
  
        {/* Dropdown tri */}
        {showSort&&(
          <View style={fb.dropdown}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject}/>
            {SORT_OPTIONS.map(o=>(
              <TouchableOpacity key={o.key} style={[fb.ddItem,filters.sort===o.key&&fb.ddItemOn]} onPress={()=>{onChange({sort:o.key});setShowSort(false);}} activeOpacity={0.80}>
                <Text style={[fb.ddTxt,filters.sort===o.key&&{color:C.white,fontWeight:'700'}]}>{o.label}</Text>
                {filters.sort===o.key&&<Ionicons name="checkmark" size={12} color={C.white}/>}
              </TouchableOpacity>
            ))}
          </View>
        )}
  
        {/* Dropdown genre */}
        {showGenre&&(
          <View style={fb.dropdown}>
            <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject}/>
            {GENRES.map(g=>(
              <TouchableOpacity key={g} style={[fb.ddItem,(filters.genre||'Tous')===g&&fb.ddItemOn]} onPress={()=>{onChange({genre:g==='Tous'?'':g});setShowGenre(false);}} activeOpacity={0.80}>
                <Text style={[fb.ddTxt,(filters.genre||'Tous')===g&&{color:C.white,fontWeight:'700'}]}>{g}</Text>
                {(filters.genre||'Tous')===g&&<Ionicons name="checkmark" size={12} color={C.white}/>}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  });
  const fb = StyleSheet.create({
    wrap:       {paddingHorizontal:EDGE,marginBottom:10,gap:8},
    searchRow:  {flexDirection:'row',alignItems:'center',backgroundColor:C.surface,borderRadius:12,borderWidth:1,borderColor:C.border,paddingHorizontal:12,paddingVertical:9},
    searchInput:{flex:1,color:C.white,fontSize:13},
    chipsRow:   {gap:7,paddingVertical:2},
    chip:       {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:6,borderRadius:18,borderWidth:1,borderColor:C.border,backgroundColor:C.surface},
    chipOn:     {backgroundColor:'rgba(13,34,64,0.80)',borderColor:C.borderHi},
    chipTxt:    {color:C.muted,fontSize:11,fontWeight:'600'},
    chipTxtOn:  {color:C.white,fontWeight:'700'},
    sep:        {width:1,backgroundColor:C.border,marginHorizontal:2},
    dropdown:   {borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:C.border,zIndex:99},
    ddItem:     {flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:14,paddingVertical:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
    ddItemOn:   {backgroundColor:'rgba(255,255,255,0.07)'},
    ddTxt:      {color:C.muted,fontSize:13,fontWeight:'600'},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BULK ACTION BAR
  // ─────────────────────────────────────────────────────────────────────────────
  const BulkBar = memo(function BulkBar({
    count,onApproveAll,onRejectAll,onClear,
  }:{count:number;onApproveAll:()=>void;onRejectAll:()=>void;onClear:()=>void}) {
    const slide=useRef(new Animated.Value(-60)).current;
    useEffect(()=>{Animated.spring(slide,{toValue:0,tension:80,friction:10,useNativeDriver:true}).start();},[]);
    return(
      <Animated.View style={[blk.wrap,{transform:[{translateY:slide}]}]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <TouchableOpacity style={blk.close} onPress={onClear} hitSlop={8}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
        <Text style={blk.count}>{count} sélectionnée{count>1?'s':''}</Text>
        <View style={{flex:1}}/>
        <TouchableOpacity style={[blk.btn,{backgroundColor:`${C.red}22`,borderColor:`${C.red}50`}]} onPress={onRejectAll} activeOpacity={0.82}>
          <Ionicons name="close-circle" size={14} color={C.red}/>
          <Text style={[blk.btnTxt,{color:C.red}]}>Rejeter</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[blk.btn,{backgroundColor:`${C.green}22`,borderColor:`${C.green}50`}]} onPress={onApproveAll} activeOpacity={0.82}>
          <Ionicons name="checkmark-circle" size={14} color={C.green}/>
          <Text style={[blk.btnTxt,{color:C.green}]}>Approuver</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  });
  const blk = StyleSheet.create({
    wrap:   {position:'absolute',bottom:0,left:0,right:0,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:16,paddingVertical:14,paddingBottom:Platform.OS==='ios'?30:14,borderTopWidth:1,borderTopColor:C.border,overflow:'hidden'},
    close:  {width:24,height:24,alignItems:'center',justifyContent:'center'},
    count:  {color:C.white,fontSize:13,fontWeight:'700'},
    btn:    {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:14,paddingVertical:9,borderRadius:12,borderWidth:1},
    btnTxt: {fontSize:12,fontWeight:'800'},
    bg:     {backgroundColor:C.bg},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REEL CARD
  // ─────────────────────────────────────────────────────────────────────────────
  interface ReelCardProps {
    reel:AdminReel; safety:SafetyResult; isActive:boolean;
    activeTab:Status; selected:boolean;
    onApprove:(id:string)=>void; onReject:(id:string)=>void;
    onReapprove:(id:string)=>void; onDetail:(r:AdminReel)=>void;
    onSelect:(id:string)=>void;
  }
  
  const ReelCard = memo(function ReelCard({
    reel,safety,isActive,activeTab,selected,
    onApprove,onReject,onReapprove,onDetail,onSelect,
  }:ReelCardProps) {
    const isWeb=Platform.OS==='web';
    const src  =resolveUrl(reel.video_url);
    const [muted, setMuted]=useState(true);
    const [acting,setActing]=useState<'approve'|'reject'|null>(null);
  
    const player=_hook(src||null,setupPlayer);
    const {isPlaying}=_useEvent(player,'playingChange',{isPlaying:false});
    const cardOp=useRef(new Animated.Value(1)).current;
    const selScale=useRef(new Animated.Value(1)).current;
  
    useEffect(()=>{
      if(isWeb||!player)return;
      try{isActive?player.play():player.pause();}catch{}
    },[isActive,player,isWeb]);
  
    useEffect(()=>{
      if(isWeb||!player)return;
      try{player.muted=muted;}catch{}
    },[muted,player,isWeb]);
  
    const animAndDo=(action:'approve'|'reject',cb:()=>void)=>{
      if(acting)return;
      setActing(action);
      if(Platform.OS!=='web') Haptics.notificationAsync(
        action==='approve'?Haptics.NotificationFeedbackType.Success:Haptics.NotificationFeedbackType.Error
      ).catch(()=>{});
      Animated.timing(cardOp,{toValue:0,duration:300,useNativeDriver:true}).start(cb);
    };
  
    const cat=REJ_CATS.find(c=>c.key===reel.rejection_category);
    const meta=[reel.genre,reel.year,reel.director].filter(Boolean).join(' · ');
  
    return(
      <Animated.View style={[rc.card,{opacity:cardOp},selected&&rc.cardSelected]}>
  
        {/* Video / thumbnail */}
        <TouchableOpacity style={rc.videoWrap} onPress={()=>onDetail(reel)} onLongPress={()=>onSelect(reel.id)} activeOpacity={0.92}>
          {/* Player vidéo — toujours monté, lecture si actif */}
          {!isWeb&&src&&_VideoView&&player&&(
            <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} allowsFullscreen={false}/>
          )}
          {isWeb&&src&&React.createElement('video',{
            src,autoPlay:isActive,loop:true,muted,playsInline:true,
            style:{width:'100%',height:'100%',objectFit:'cover',borderRadius:14},
          })}
  
          {!src&&!thumb&&(
            <View style={rc.noVideo}>
              <Ionicons name="videocam-off-outline" size={28} color={C.muted}/>
              <Text style={{color:C.muted,fontSize:10,marginTop:6}}>Aucune vidéo</Text>
            </View>
          )}
  
          <LinearGradient colors={['transparent','rgba(2,5,15,0.75)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.4}} end={{x:0,y:1}}/>
  
          {/* Badge sélection */}
          {selected&&(
            <View style={rc.selectDot}>
              <Ionicons name="checkmark-circle" size={22} color={C.green}/>
            </View>
          )}
  
          {/* Badge statut */}
          <View style={[rc.statusBadge,{backgroundColor:STATUS_CFG[reel.status].bg,borderColor:`${STATUS_CFG[reel.status].color}55`}]}>
            <Ionicons name={STATUS_CFG[reel.status].icon as any} size={9} color={STATUS_CFG[reel.status].color}/>
            <Text style={[rc.statusTxt,{color:STATUS_CFG[reel.status].color}]}>{STATUS_CFG[reel.status].label}</Text>
          </View>
  
          {/* Safety badge */}
          <View style={rc.safetyPos}>
            <SafetyBadge result={safety}/>
          </View>
  
          {/* Contrôles vidéo */}
          <View style={rc.videoControls}>
            <TouchableOpacity style={rc.iconBtn} onPress={()=>setMuted(m=>!m)} activeOpacity={0.80}>
              <Ionicons name={muted?'volume-mute':'volume-high'} size={12} color={C.white}/>
            </TouchableOpacity>
            <TouchableOpacity style={rc.iconBtn} onPress={()=>onDetail(reel)} activeOpacity={0.80}>
              <Ionicons name="expand-outline" size={12} color={C.white}/>
            </TouchableOpacity>
            <TouchableOpacity style={rc.iconBtn} onPress={()=>onSelect(reel.id)} activeOpacity={0.80}>
              <Ionicons name="checkbox-outline" size={12} color={C.white}/>
            </TouchableOpacity>
          </View>
  
          {/* Durée */}
          {reel.duration!=null&&(
            <View style={rc.durationBadge}>
              <Text style={rc.durationTxt}>{fmtDuration(reel.duration)}</Text>
            </View>
          )}
  
          {/* Recommandation IA */}
          {safety.suggestion!=='approve'&&(
            <View style={[rc.aiFlag,{backgroundColor:`${C.red}22`,borderColor:`${C.red}50`}]}>
              <Ionicons name="sparkles" size={8} color={C.red}/>
              <Text style={[rc.aiFlagTxt,{color:C.red}]}>
                IA : {safety.suggestion==='reject'?'À rejeter':'À vérifier'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
  
        {/* Metadata */}
        <View style={rc.meta}>
          <View style={{flexDirection:'row',alignItems:'flex-start',gap:8,marginBottom:4}}>
            <View style={{flex:1}}>
              <Text style={rc.title} numberOfLines={1}>{reel.title||'Sans titre'}</Text>
              {!!meta&&<Text style={rc.sub} numberOfLines={1}>{meta}</Text>}
            </View>
            <Text style={rc.date}>{fmtDate(reel.created_at,true)}</Text>
          </View>
  
          {/* Flags IA */}
          {safety.flags.length>0&&(
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:6,paddingBottom:4}}>
              {safety.flags.map(f=>{
                const flagColor=C.red;
                return(
                  <View key={f.type} style={[rc.flag,{backgroundColor:`${flagColor}14`,borderColor:`${flagColor}40`}]}>
                    <Ionicons name="warning-outline" size={8} color={flagColor}/>
                    <Text style={[rc.flagTxt,{color:flagColor}]}>{f.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
          )}
  
          {/* Synopsis extrait */}
          {!!reel.synopsis&&(
            <Text style={rc.synopsis} numberOfLines={2}>{reel.synopsis}</Text>
          )}
  
          {/* Raison de rejet */}
          {reel.status==='rejected'&&cat&&(
            <View style={[rc.rejBadge,{backgroundColor:`${cat.color}14`,borderColor:`${cat.color}40`}]}>
              <Ionicons name={cat.icon as any} size={10} color={cat.color}/>
              <Text style={[rc.rejTxt,{color:cat.color}]}>{cat.label}</Text>
              {!!reel.rejection_reason&&<Text style={rc.rejReason} numberOfLines={1}>— {reel.rejection_reason}</Text>}
            </View>
          )}
  
          {/* Stats */}
          <View style={rc.statsRow}>
            <View style={rc.stat}><Ionicons name="eye-outline" size={10} color={C.muted}/><Text style={rc.statTxt}>{fmtNumber(reel.views_count)}</Text></View>
            <View style={rc.stat}><Ionicons name="heart-outline" size={10} color={C.muted}/><Text style={rc.statTxt}>{fmtNumber(reel.likes_count)}</Text></View>
            <View style={{flex:1}}/>
            <Text style={rc.userId}>{reel.user_id.slice(0,10)}…</Text>
          </View>
        </View>
  
        {/* Action buttons */}
        {activeTab==='pending'&&(
          <View style={rc.actions}>
            <TouchableOpacity style={[rc.btn,rc.btnRej]} onPress={()=>animAndDo('reject',()=>onReject(reel.id))} disabled={!!acting} activeOpacity={0.85}>
              <Ionicons name="close" size={16} color={C.white}/><Text style={rc.btnTxt}>Rejeter</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[rc.btn,rc.btnApr]} onPress={()=>animAndDo('approve',()=>onApprove(reel.id))} disabled={!!acting} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={16} color={C.white}/><Text style={rc.btnTxt}>Approuver</Text>
            </TouchableOpacity>
          </View>
        )}
        {activeTab==='rejected'&&(
          <TouchableOpacity style={rc.reapproveRow} onPress={()=>onReapprove(reel.id)} activeOpacity={0.82}>
            <Ionicons name="refresh-circle-outline" size={14} color={C.green}/>
            <Text style={rc.reapproveTxt}>Approuver malgré le rejet</Text>
          </TouchableOpacity>
        )}
        {activeTab==='approved'&&(
          <View style={rc.approvedRow}>
            <Ionicons name="checkmark-circle" size={13} color={C.green}/>
            <Text style={rc.approvedTxt}>Visible · validé {fmtDate(reel.moderated_at,true)}</Text>
          </View>
        )}
      </Animated.View>
    );
  });
  
  const rc = StyleSheet.create({
    card:         {backgroundColor:'transparent',borderRadius:20,borderWidth:1,borderColor:C.border,marginBottom:18,overflow:'hidden'},
    cardSelected: {borderColor:C.green,backgroundColor:'rgba(34,197,94,0.06)'},
    videoWrap:    {height:VIDEO_H,margin:10,marginBottom:0,borderRadius:14,overflow:'hidden',position:'relative',backgroundColor:'#0D1828'},
    noVideo:      {flex:1,alignItems:'center',justifyContent:'center'},
    selectDot:    {position:'absolute',top:8,left:8},
    statusBadge:  {position:'absolute',top:8,left:8+28,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,borderWidth:1},
    statusTxt:    {fontSize:9,fontWeight:'800'},
    safetyPos:    {position:'absolute',top:8,right:8},
    videoControls:{position:'absolute',bottom:8,right:8,flexDirection:'row',gap:6},
    iconBtn:      {width:28,height:28,borderRadius:14,backgroundColor:'rgba(0,0,0,0.60)',alignItems:'center',justifyContent:'center'},
    durationBadge:{position:'absolute',bottom:8,left:10,backgroundColor:'rgba(0,0,0,0.65)',paddingHorizontal:7,paddingVertical:3,borderRadius:8},
    durationTxt:  {color:C.white,fontSize:9,fontWeight:'800'},
    aiFlag:       {position:'absolute',top:36,left:8,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,borderWidth:1},
    aiFlagTxt:    {fontSize:8,fontWeight:'800'},
    meta:         {padding:12,gap:5},
    title:        {color:C.white,fontSize:14,fontWeight:'800'},
    sub:          {color:C.muted,fontSize:10,fontStyle:'italic',marginTop:1},
    date:         {color:C.muted,fontSize:9,marginTop:2},
    flag:         {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:7,paddingVertical:3,borderRadius:9,borderWidth:1},
    flagTxt:      {fontSize:8,fontWeight:'700'},
    synopsis:     {color:'rgba(255,255,255,0.42)',fontSize:11,lineHeight:16,fontStyle:'italic'},
    rejBadge:     {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:5,borderRadius:10,borderWidth:1,flexWrap:'wrap'},
    rejTxt:       {fontSize:11,fontWeight:'700'},
    rejReason:    {color:'rgba(255,255,255,0.35)',fontSize:10,flex:1},
    statsRow:     {flexDirection:'row',alignItems:'center',gap:10},
    stat:         {flexDirection:'row',alignItems:'center',gap:3},
    statTxt:      {color:C.muted,fontSize:10,fontWeight:'600'},
    userId:       {color:'rgba(255,255,255,0.18)',fontSize:8},
    actions:      {flexDirection:'row',gap:9,padding:10,paddingTop:4},
    btn:          {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:12,borderRadius:13},
    btnApr:       {backgroundColor:C.greenDk,borderWidth:1,borderColor:C.green},
    btnRej:       {backgroundColor:C.redDk,borderWidth:1,borderColor:C.red},
    btnTxt:       {color:C.white,fontSize:13,fontWeight:'800'},
    reapproveRow: {flexDirection:'row',alignItems:'center',gap:8,padding:10,paddingTop:4},
    reapproveTxt: {color:C.green,fontSize:11,fontWeight:'600',flex:1},
    approvedRow:  {flexDirection:'row',alignItems:'center',gap:6,padding:10,paddingTop:4},
    approvedTxt:  {color:C.green,fontSize:11},
    bg:           {backgroundColor:C.bg},
  });
  
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ★ REJECTION MODAL — catégories + suggestion IA + raison libre
  // ─────────────────────────────────────────────────────────────────────────────
  interface RejModalProps {
    visible:    boolean;
    reelId:     string|null;
    aiResult:   SafetyResult|null;
    onConfirm:  (id:string, cat:RejCategory, reason:string) => void;
    onCancel:   () => void;
  }
  
  const RejectionModal = memo(function RejectionModal({
    visible, reelId, aiResult, onConfirm, onCancel,
  }:RejModalProps) {
    const [cat,    setCat]    = useState<RejCategory|null>(null);
    const [reason, setReason] = useState('');
    const slide = useRef(new Animated.Value(600)).current;
  
    // Pré-sélectionner la catégorie suggérée par l'IA
    useEffect(()=>{
      if (!visible) { setCat(null); setReason(''); return; }
      Animated.spring(slide,{toValue:0,tension:70,friction:12,useNativeDriver:true}).start();
      if (aiResult?.flags.length) {
        const dominant = aiResult.flags.sort((a,b)=>b.weight-a.weight)[0];
        const map:Record<string,RejCategory> = {
          vulgar:'inappropriate', privacy:'privacy',
          violence:'violence',    spam:'spam',
          quality:'quality',      copyright:'copyright',
        };
        setCat(map[dominant.type]??'other');
        setReason(dominant.detail);
      }
    },[visible,aiResult]);
  
    const handleConfirm = useCallback(()=>{
      if(!cat||!reelId) return;
      onConfirm(reelId, cat, reason.trim());
    },[cat,reelId,reason,onConfirm]);
  
    const handleCancel = useCallback(()=>{
      Animated.timing(slide,{toValue:600,duration:220,useNativeDriver:true}).start(onCancel);
    },[slide,onCancel]);
  
    return(
      <Modal visible={visible} transparent animationType="none" onRequestClose={handleCancel} statusBarTranslucent>
        <KeyboardAvoidingView style={{flex:1,justifyContent:'flex-end'}} behavior={Platform.OS==='ios'?'padding':undefined}>
          <Pressable style={{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(13,34,64,0.75)'}} onPress={Keyboard.dismiss}/>
          <Animated.View style={[rej.sheet,{transform:[{translateY:slide}]}]}>
            <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFillObject}/>
            <View style={{...StyleSheet.absoluteFillObject as any,backgroundColor:'rgba(8,4,26,0.75)'}} pointerEvents="none"/>
  
            <View style={rej.handle}/>
  
            {/* Header */}
            <View style={rej.header}>
              <View>
                <Text style={rej.title}>Motif du rejet</Text>
                <Text style={rej.sub}>Sélectionne la catégorie principale</Text>
              </View>
              <TouchableOpacity style={rej.closeBtn} onPress={handleCancel} hitSlop={10}>
                <Ionicons name="close" size={14} color={C.muted}/>
              </TouchableOpacity>
            </View>
  
            {/* Suggestion IA */}
            {aiResult&&aiResult.flags.length>0&&(
              <View style={rej.aiBox}>
                <View style={{flexDirection:'row',alignItems:'center',gap:7,marginBottom:8}}>
                  <Ionicons name="sparkles" size={12} color={C.muted}/>
                  <Text style={rej.aiTitle}>Suggestion IA · Score {aiResult.score}/100</Text>
                </View>
                {aiResult.flags.slice(0,2).map(f=>{
                  const flagColor=C.red;
                  return(
                    <View key={f.type} style={[rej.aiFlag,{borderColor:`${flagColor}50`}]}>
                      <Ionicons name="warning-outline" size={10} color={flagColor}/>
                      <View style={{flex:1}}>
                        <Text style={[rej.aiFlagLabel,{color:flagColor}]}>{f.label}</Text>
                        <Text style={rej.aiFlagDetail}>{f.detail}</Text>
                      </View>
                      <Text style={[rej.aiFlagWeight,{color:flagColor}]}>-{f.weight}</Text>
                    </View>
                  );
                })}
              </View>
            )}
  
            {/* Grille catégories */}
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={rej.grid}>
                {REJ_CATS.map(c=>{
                  const on=cat===c.key;
                  return(
                    <TouchableOpacity
                      key={c.key}
                      style={[rej.catCard,on&&{borderColor:c.color,backgroundColor:`${c.color}16`}]}
                      onPress={()=>setCat(c.key)} activeOpacity={0.80}
                    >
                      <Ionicons name={c.icon as any} size={18} color={on?c.color:C.muted}/>
                      <Text style={[rej.catLabel,on&&{color:c.color,fontWeight:'700'}]}>{c.label}</Text>
                      <Text style={rej.catDesc} numberOfLines={2}>{c.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
  
              {/* Raison libre */}
              <View style={rej.inputWrap}>
                <Text style={rej.inputLabel}>Précision (optionnelle)</Text>
                <TextInput
                  style={rej.input}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Décrivez le problème constaté…"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  multiline maxLength={300}
                  textAlignVertical="top"
                  selectionColor={C.white}
                />
                <Text style={rej.charCount}>{reason.length}/300</Text>
              </View>
  
              {/* Buttons */}
              <View style={rej.btnRow}>
                <TouchableOpacity style={rej.cancelBtn} onPress={handleCancel} activeOpacity={0.80}>
                  <Text style={rej.cancelTxt}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rej.confirmBtn,!cat&&rej.confirmDisabled]}
                  onPress={handleConfirm}
                  disabled={!cat}
                  activeOpacity={0.88}
                >
                  <Ionicons name="close-circle" size={16} color={cat?C.white:C.muted}/>
                  <Text style={[rej.confirmTxt,!cat&&{color:C.muted}]}>Confirmer le rejet</Text>
                </TouchableOpacity>
              </View>
              <View style={{height:20}}/>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    );
  });
  
  const rej = StyleSheet.create({
    sheet:         {maxHeight:'88%',borderTopLeftRadius:28,borderTopRightRadius:28,overflow:'hidden',borderWidth:1,borderColor:C.border},
    handle:        {width:40,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:12,marginBottom:4},
    header:        {flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:20,paddingTop:12,paddingBottom:14},
    title:         {color:C.white,fontSize:18,fontWeight:'800'},
    sub:           {color:C.muted,fontSize:11,marginTop:3},
    closeBtn:      {width:28,height:28,borderRadius:14,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    aiBox:         {marginHorizontal:20,marginBottom:14,padding:14,borderRadius:16,borderWidth:1,borderColor:C.border,backgroundColor:'rgba(13,34,64,0.60)'},
    aiTitle:       {color:C.muted,fontSize:11,fontWeight:'700'},
    aiFlag:        {flexDirection:'row',alignItems:'flex-start',gap:8,paddingVertical:6,paddingHorizontal:10,borderRadius:10,borderWidth:1,backgroundColor:'rgba(255,255,255,0.04)',marginTop:6},
    aiFlagLabel:   {fontSize:10,fontWeight:'700',marginBottom:2},
    aiFlagDetail:  {color:C.muted,fontSize:9},
    aiFlagWeight:  {fontSize:10,fontWeight:'900'},
    grid:          {flexDirection:'row',flexWrap:'wrap',gap:9,paddingHorizontal:20,marginBottom:16},
    catCard:       {width:'47%',flexGrow:1,padding:14,borderRadius:16,borderWidth:1,borderColor:C.border,backgroundColor:C.surface,gap:6,alignItems:'flex-start'},
    catLabel:      {color:C.muted,fontSize:12,fontWeight:'600'},
    catDesc:       {color:'rgba(255,255,255,0.25)',fontSize:9,lineHeight:13},
    inputWrap:     {paddingHorizontal:20,marginBottom:16},
    inputLabel:    {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8},
    input:         {backgroundColor:C.surface,borderRadius:14,borderWidth:1,borderColor:C.border,padding:14,color:C.white,fontSize:13,minHeight:80},
    charCount:     {color:'rgba(255,255,255,0.20)',fontSize:10,textAlign:'right',marginTop:4},
    btnRow:        {flexDirection:'row',gap:10,paddingHorizontal:20},
    cancelBtn:     {paddingHorizontal:18,paddingVertical:13,borderRadius:14,borderWidth:1,borderColor:C.border,backgroundColor:C.surface},
    cancelTxt:     {color:C.muted,fontSize:13,fontWeight:'600'},
    confirmBtn:    {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:13,borderRadius:14,backgroundColor:C.redDk,borderWidth:1,borderColor:C.red},
    confirmDisabled:{backgroundColor:C.surface,borderColor:C.border},
    confirmTxt:    {color:C.white,fontSize:14,fontWeight:'800'},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ★ DETAIL MODAL — vidéo plein écran + documentation complète + re-approbation
  // ─────────────────────────────────────────────────────────────────────────────
  interface DetailModalProps {
    reel:        AdminReel|null;
    safety:      SafetyResult|null;
    onClose:     () => void;
    onApprove:   (id:string) => void;
    onReject:    (id:string) => void;
    onReapprove: (id:string) => void;
  }
  
  const DetailModal = memo(function DetailModal({
    reel, safety, onClose, onApprove, onReject, onReapprove,
  }:DetailModalProps) {
    const isWeb = Platform.OS==='web';
    const src   = resolveUrl(reel?.video_url??null);
    const [reapproveNote,setReapproveNote]=useState('');
    const [showReapproveForm,setShowReapproveForm]=useState(false);
    const [muted,setMuted]=useState(false);
    const slide=useRef(new Animated.Value(900)).current;
  
    const player = _hook(reel&&src?src:null, setupPlayer);
    const {isPlaying} = _useEvent(player,'playingChange',{isPlaying:false});
  
    useEffect(()=>{
      if(reel){
        Animated.spring(slide,{toValue:0,tension:60,friction:12,useNativeDriver:true}).start();
        try{if(!isWeb&&player){player.muted=false;player.play();}}catch{}
      } else {
        Animated.timing(slide,{toValue:900,duration:220,useNativeDriver:true}).start();
        try{if(!isWeb&&player)player.pause();}catch{}
      }
    },[reel,player,isWeb]);
  
    useEffect(()=>{try{if(!isWeb&&player)player.muted=muted;}catch{}},[muted,player,isWeb]);
  
    if(!reel)return null;
  
    const cat    = REJ_CATS.find(c=>c.key===reel.rejection_category);
    const meta   = [reel.genre,reel.year,reel.director].filter(Boolean).join(' · ');
    return(
      <Modal visible animationType="none" transparent onRequestClose={onClose} statusBarTranslucent>
        <Animated.View style={[{flex:1,backgroundColor:C.bg},!Platform.OS||{transform:[{translateY:slide}]}]}>
          <StatusBar style="light"/>
  
          {/* VIDEO */}
          <View style={dm.videoWrap}>
            {!isWeb&&src&&_VideoView&&player&&(
              <_VideoView player={player} style={StyleSheet.absoluteFillObject} contentFit="cover" nativeControls={false} allowsFullscreen={false}/>
            )}
            {!src&&(
              <View style={{flex:1,alignItems:'center',justifyContent:'center'}}>
                <Ionicons name="videocam-off-outline" size={36} color={C.muted}/>
              </View>
            )}
            {isWeb&&src&&React.createElement('video',{src,autoPlay:true,loop:true,muted,playsInline:true,style:{width:'100%',height:'100%',objectFit:'cover'}})}
  
            <LinearGradient colors={['rgba(2,5,15,0.45)','transparent','rgba(2,5,15,0.85)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0}} end={{x:0,y:1}}/>
  
            {/* Top bar */}
            <SafeAreaView edges={['top']} style={dm.topBar}>
              <TouchableOpacity style={dm.closeBtn} onPress={onClose} activeOpacity={0.80}>
                <Ionicons name="chevron-down" size={20} color={C.white}/>
              </TouchableOpacity>
              <Text style={dm.topTitle} numberOfLines={1}>{reel.title??'Sans titre'}</Text>
              <TouchableOpacity style={dm.closeBtn} onPress={()=>setMuted(m=>!m)} activeOpacity={0.80}>
                <Ionicons name={muted?'volume-mute':'volume-high'} size={16} color={C.white}/>
              </TouchableOpacity>
            </SafeAreaView>
  
            {/* Safety badge sur vidéo */}
            {safety&&(
              <View style={dm.safetyPos}><SafetyBadge result={safety}/></View>
            )}
  
            {/* Duration */}
            {reel.duration!=null&&(
              <View style={dm.durBadge}>
                <Ionicons name="time-outline" size={9} color={C.white}/>
                <Text style={dm.durTxt}>{fmtDuration(reel.duration)}</Text>
              </View>
            )}
          </View>
  
          {/* CONTENT */}
          <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false} contentContainerStyle={{padding:20,paddingBottom:100}} keyboardShouldPersistTaps="handled">
  
            {/* Titre + meta */}
            <Text style={dm.infoTitle}>{reel.title??'Sans titre'}</Text>
            {!!meta&&<Text style={dm.infoMeta}>{meta}</Text>}
            {!!reel.synopsis&&<Text style={dm.infoDesc}>{reel.synopsis}</Text>}
  
            {/* Stats */}
            <View style={dm.statsRow}>
              {[
                {icon:'eye-outline',      val:fmtNumber(reel.views_count)},
                {icon:'heart-outline',    val:fmtNumber(reel.likes_count)},
                {icon:'person-outline',   val:reel.user_id.slice(0,8)+'…'},
                {icon:'calendar-outline', val:fmtDate(reel.created_at,true)},
              ].map(s=>(
                <View key={s.icon} style={dm.statPill}>
                  <Ionicons name={s.icon as any} size={10} color={C.muted}/>
                  <Text style={dm.statTxt}>{s.val}</Text>
                </View>
              ))}
            </View>
  
            <View style={dm.divider}/>
  
            {/* ★ Rapport de sécurité IA */}
            {safety&&(
              <View style={dm.safetySection}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:10}}>
                  <Ionicons name="sparkles" size={14} color={C.muted}/>
                  <Text style={dm.sectionTitle}>Rapport de sécurité IA</Text>
                  <SafetyBadge result={safety}/>
                </View>
  
                {/* Barre de score */}
                <View style={{gap:6,marginBottom:12}}>
                  <View style={{flexDirection:'row',justifyContent:'space-between'}}>
                    <Text style={{color:C.muted,fontSize:10}}>Score de sécurité</Text>
                    <Text style={{color:safety.level==='safe'?C.green:C.red,fontSize:10,fontWeight:'800'}}>{safety.score}/100</Text>
                  </View>
                  <View style={{height:6,borderRadius:3,backgroundColor:'rgba(255,255,255,0.08)',overflow:'hidden'}}>
                    <View style={{height:'100%',borderRadius:3,width:`${safety.score}%` as any,backgroundColor:safety.level==='safe'?C.green:C.red}}/>
                  </View>
                  <Text style={{color:C.muted,fontSize:9,textAlign:'right'}}>
                    Recommandation : <Text style={{fontWeight:'800',color:safety.suggestion==='approve'?C.green:C.red}}>
                      {safety.suggestion==='approve'?'Approuver':safety.suggestion==='review'?'Vérifier':'Rejeter'}
                    </Text>
                  </Text>
                </View>
  
                {/* Flags */}
                {safety.flags.length===0?(
                  <View style={dm.safeFlag}>
                    <Ionicons name="shield-checkmark" size={13} color={C.green}/>
                    <Text style={{color:C.green,fontSize:12,fontWeight:'600'}}>Aucun problème détecté</Text>
                  </View>
                ):(
                  <View style={{gap:7}}>
                    {safety.flags.map(f=>{
                      const fc=C.red;
                      return(
                        <View key={f.type} style={[dm.flagRow,{backgroundColor:'rgba(239,68,68,0.10)',borderColor:'rgba(239,68,68,0.35)'}]}>
                          <View style={[dm.flagIconWrap,{backgroundColor:'rgba(239,68,68,0.20)'}]}>
                            <Ionicons name="warning-outline" size={12} color={C.red}/>
                          </View>
                          <View style={{flex:1}}>
                            <Text style={[dm.flagLabel,{color:C.red}]}>{f.label}</Text>
                            <Text style={dm.flagDetail}>{f.detail}</Text>
                          </View>
                          <View style={[dm.flagWeightBadge,{backgroundColor:'rgba(239,68,68,0.20)'}]}>
                            <Text style={[dm.flagWeightTxt,{color:C.red}]}>-{f.weight}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
  
            <View style={dm.divider}/>
  
            {/* Timeline de modération */}
            <Text style={dm.sectionTitle}>Timeline</Text>
            <View style={{gap:0,marginTop:10}}>
              <View style={dm.timelineItem}>
                <View style={[dm.timelineDot,{backgroundColor:C.white}]}/>
                <View style={dm.timelineLine}/>
                <View style={{flex:1}}>
                  <Text style={dm.timelineLabel}>Soumission</Text>
                  <Text style={dm.timelineDate}>{fmtDate(reel.created_at)}</Text>
                </View>
              </View>
              {reel.moderated_at&&(
                <View style={dm.timelineItem}>
                  <View style={[dm.timelineDot,{backgroundColor:STATUS_CFG[reel.status].color}]}/>
                  <View style={{flex:1}}>
                    <Text style={dm.timelineLabel}>Modération → {STATUS_CFG[reel.status].label}</Text>
                    <Text style={dm.timelineDate}>{fmtDate(reel.moderated_at)}</Text>
                    {reel.moderated_by&&<Text style={dm.timelineModerator}>par {reel.moderated_by.slice(0,12)}…</Text>}
                  </View>
                </View>
              )}
            </View>
  
            {/* Raison de rejet */}
            {reel.status==='rejected'&&cat&&(
              <>
                <View style={dm.divider}/>
                <Text style={dm.sectionTitle}>Motif du rejet</Text>
                <View style={[dm.rejBox,{borderColor:cat.color,backgroundColor:`${cat.color}10`}]}>
                  <Ionicons name={cat.icon as any} size={16} color={cat.color}/>
                  <View style={{flex:1}}>
                    <Text style={[dm.rejLabel,{color:cat.color}]}>{cat.label}</Text>
                    {!!reel.rejection_reason&&<Text style={dm.rejReason}>{reel.rejection_reason}</Text>}
                  </View>
                </View>
              </>
            )}
  
            <View style={dm.divider}/>
  
            {/* ★ ACTIONS */}
            {reel.status==='pending'&&(
              <View style={{flexDirection:'row',gap:10}}>
                <TouchableOpacity style={dm.actionBtnRej} onPress={()=>{onClose();setTimeout(()=>onReject(reel.id),150);}} activeOpacity={0.85}>
                  <Ionicons name="close-circle" size={16} color={C.white}/>
                  <Text style={dm.actionTxt}>Rejeter</Text>
                </TouchableOpacity>
                <TouchableOpacity style={dm.actionBtnApr} onPress={()=>{onApprove(reel.id);onClose();}} activeOpacity={0.85}>
                  <Ionicons name="checkmark-circle" size={16} color={C.white}/>
                  <Text style={dm.actionTxt}>Approuver</Text>
                </TouchableOpacity>
              </View>
            )}
  
            {reel.status==='rejected'&&(
              <View>
                {!showReapproveForm?(
                  <TouchableOpacity style={dm.reapproveBtn} onPress={()=>setShowReapproveForm(true)} activeOpacity={0.85}>
                    <Ionicons name="refresh-circle-outline" size={16} color={C.white}/>
                    <Text style={dm.actionTxt}>Approuver après re-vérification</Text>
                  </TouchableOpacity>
                ):(
                  <View style={dm.reapproveForm}>
                    <Text style={dm.reapproveFormLabel}>Note de re-vérification</Text>
                    <TextInput
                      style={dm.reapproveInput}
                      value={reapproveNote}
                      onChangeText={setReapproveNote}
                      placeholder="Précisez pourquoi vous approuvez malgré le rejet…"
                      placeholderTextColor="rgba(255,255,255,0.22)"
                      multiline maxLength={200}
                      selectionColor={C.white}
                    />
                    <View style={{flexDirection:'row',gap:9,marginTop:10}}>
                      <TouchableOpacity style={dm.cancelSmall} onPress={()=>setShowReapproveForm(false)} activeOpacity={0.80}>
                        <Text style={{color:C.muted,fontSize:12,fontWeight:'600'}}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[dm.actionBtnApr,{flex:1,opacity:reapproveNote.trim().length<10?0.45:1}]}
                        onPress={()=>{if(reapproveNote.trim().length>=10){onReapprove(reel.id);onClose();}}}
                        activeOpacity={0.88}
                      >
                        <Ionicons name="checkmark-circle" size={14} color={C.white}/>
                        <Text style={[dm.actionTxt,{fontSize:12}]}>Confirmer l'approbation</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={{color:C.muted,fontSize:9,marginTop:4,textAlign:'center'}}>{reapproveNote.trim().length}/200 · 10 car. minimum</Text>
                  </View>
                )}
              </View>
            )}
  
            {reel.status==='approved'&&(
              <TouchableOpacity style={dm.actionBtnRej} onPress={()=>{onReject(reel.id);onClose();}} activeOpacity={0.85}>
                <Ionicons name="close-circle" size={16} color={C.white}/>
                <Text style={dm.actionTxt}>Rétracter la validation</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    );
  });
  
  const dm = StyleSheet.create({
    videoWrap:      {height:280,position:'relative',backgroundColor:'#0D1828'},
    topBar:         {position:'absolute',top:0,left:0,right:0,flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingBottom:12},
    closeBtn:       {width:36,height:36,borderRadius:18,backgroundColor:'rgba(0,0,0,0.55)',alignItems:'center',justifyContent:'center'},
    topTitle:       {color:C.white,fontSize:14,fontWeight:'700',flex:1,textAlign:'center'},
    safetyPos:      {position:'absolute',bottom:14,left:14},
    durBadge:       {position:'absolute',bottom:14,right:14,flexDirection:'row',alignItems:'center',gap:4,backgroundColor:'rgba(0,0,0,0.65)',paddingHorizontal:8,paddingVertical:4,borderRadius:9},
    durTxt:         {color:C.white,fontSize:10,fontWeight:'700'},
    infoTitle:      {color:C.white,fontSize:20,fontWeight:'900',letterSpacing:-0.4},
    infoMeta:       {color:C.muted,fontSize:12,fontStyle:'italic',marginTop:4,marginBottom:6},
    infoDesc:       {color:'rgba(255,255,255,0.50)',fontSize:13,lineHeight:19,marginBottom:12},
    statsRow:       {flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:4},
    statPill:       {flexDirection:'row',alignItems:'center',gap:5,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,paddingHorizontal:9,paddingVertical:5,borderRadius:10},
    statTxt:        {color:C.muted,fontSize:10,fontWeight:'600'},
    divider:        {height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:16},
    safetySection:  {backgroundColor:C.surface,borderRadius:16,borderWidth:1,borderColor:C.border,padding:16,marginBottom:4},
    sectionTitle:   {color:C.offWhite,fontSize:13,fontWeight:'800',marginBottom:2},
    safeFlag:       {flexDirection:'row',alignItems:'center',gap:8,backgroundColor:`${C.green}10`,borderWidth:1,borderColor:`${C.green}40`,padding:10,borderRadius:12},
    flagRow:        {flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:12,borderWidth:1},
    flagIconWrap:   {width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
    flagLabel:      {fontSize:11,fontWeight:'700'},
    flagDetail:     {color:C.muted,fontSize:9,marginTop:1},
    flagWeightBadge:{paddingHorizontal:7,paddingVertical:3,borderRadius:8},
    flagWeightTxt:  {fontSize:10,fontWeight:'900'},
    timelineItem:   {flexDirection:'row',alignItems:'flex-start',gap:12,marginBottom:12,position:'relative'},
    timelineDot:    {width:10,height:10,borderRadius:5,marginTop:3,flexShrink:0},
    timelineLine:   {position:'absolute',left:4,top:13,bottom:-12,width:2,backgroundColor:C.border},
    timelineLabel:  {color:C.offWhite,fontSize:12,fontWeight:'600'},
    timelineDate:   {color:C.muted,fontSize:10,marginTop:2},
    timelineModerator:{color:'rgba(255,255,255,0.25)',fontSize:9,marginTop:1},
    rejBox:         {flexDirection:'row',alignItems:'flex-start',gap:12,padding:14,borderRadius:14,borderWidth:1,marginTop:10},
    rejLabel:       {fontSize:13,fontWeight:'700'},
    rejReason:      {color:'rgba(255,255,255,0.45)',fontSize:11,marginTop:4,lineHeight:16},
    actionBtnApr:   {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:14,backgroundColor:C.greenDk,borderWidth:1,borderColor:C.green},
    actionBtnRej:   {flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:14,backgroundColor:C.redDk,borderWidth:1,borderColor:C.red},
    reapproveBtn:   {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,paddingVertical:14,borderRadius:14,backgroundColor:C.greenDk,borderWidth:1,borderColor:C.green},
    actionTxt:      {color:C.white,fontSize:14,fontWeight:'800'},
    reapproveForm:  {backgroundColor:C.surface,borderRadius:16,borderWidth:1,borderColor:C.border,padding:14},
    reapproveFormLabel:{color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:8},
    reapproveInput: {color:C.white,fontSize:13,minHeight:70,backgroundColor:'rgba(255,255,255,0.04)',borderRadius:10,padding:10,borderWidth:1,borderColor:C.border},
    cancelSmall:    {paddingHorizontal:16,paddingVertical:13,borderRadius:13,borderWidth:1,borderColor:C.border},
    fmtDuration:    {},
  });
  
  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN SCREEN
  // ─────────────────────────────────────────────────────────────────────────────
  export default function UniverseAdminScreen() {
    const router = useRouter();
  
    const [moderatorId, setModeratorId] = useState('');
    const [activeTab,   setActiveTab]   = useState<Status>('pending');
    const [reels,       setReels]       = useState<AdminReel[]>([]);
    const [loading,     setLoading]     = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [counts,      setCounts]      = useState<Record<Status,number>>({pending:0,approved:0,rejected:0});
    const [filters,     setFilters]     = useState<Filters>(FILTER_DEFAULTS);
    const [selected,    setSelected]    = useState<Set<string>>(new Set());
    const [rejTarget,   setRejTarget]   = useState<string|null>(null);
    const [detailReel,  setDetailReel]  = useState<AdminReel|null>(null);
  
    // Cache des scores de sécurité IA
    const [safetyCache, setSafetyCache] = useState<Map<string,SafetyResult>>(new Map());
  
    const getSafety = useCallback((reel:AdminReel):SafetyResult=>{
      if (safetyCache.has(reel.id)) return safetyCache.get(reel.id)!;
      const result = analyzeSafety(reel);
      setSafetyCache(m=>{const n=new Map(m);n.set(reel.id,result);return n;});
      return result;
    },[safetyCache]);
  
    // ── Auth ──────────────────────────────────────────────────────────────────
    useEffect(()=>{
      supabase.auth.getUser().then(({data:{user}})=>{ if(user) setModeratorId(user.id); });
    },[]);
  
    // ── Fetch + counts ────────────────────────────────────────────────────────
    const load = useCallback(async(tab:Status)=>{
      setLoading(true); setActiveIndex(0); setSelected(new Set());
      const data = await fetchReels(tab);
      setReels(data);
      // Pré-calcul des scores IA
      const m = new Map<string,SafetyResult>();
      data.forEach(r=>m.set(r.id,analyzeSafety(r)));
      setSafetyCache(m);
      setLoading(false);
    },[]);
  
    const refreshCounts = useCallback(async()=>{
      const c = await fetchCounts();
      setCounts(c);
    },[]);
  
    useEffect(()=>{ load(activeTab); refreshCounts(); },[]);
  
    // ── Realtime ──────────────────────────────────────────────────────────────
    useEffect(()=>{
      const ch = supabase.channel(`admin_rt_${Date.now()}`)
        .on('postgres_changes',{event:'INSERT',schema:'public',table:'reels'},
          ({new:row})=>{
            const r=row as AdminReel;
            if(activeTab==='pending') setReels(prev=>prev.some(x=>x.id===r.id)?prev:[r,...prev]);
            setCounts(prev=>({...prev,pending:prev.pending+1}));
          })
        .on('postgres_changes',{event:'UPDATE',schema:'public',table:'reels'},
          ({new:row})=>{
            const r=row as AdminReel;
            setReels(prev=>{
              if(r.status===activeTab) return prev.some(x=>x.id===r.id)?prev.map(x=>x.id===r.id?r:x):[r,...prev];
              return prev.filter(x=>x.id!==r.id);
            });
            refreshCounts();
          })
        .subscribe();
      return()=>{supabase.removeChannel(ch);};
    },[activeTab,refreshCounts]);
  
    // ── Tab change ────────────────────────────────────────────────────────────
    const handleTabChange = useCallback((tab:Status)=>{
      setActiveTab(tab);
      setFilters(FILTER_DEFAULTS);
      load(tab);
    },[load]);
  
    // ── Actions ───────────────────────────────────────────────────────────────
    const removeFromList = useCallback((ids:string[])=>{
      setReels(prev=>prev.filter(r=>!ids.includes(r.id)));
      setSelected(prev=>{const n=new Set(prev);ids.forEach(id=>n.delete(id));return n;});
      refreshCounts();
    },[refreshCounts]);
  
    const handleApprove = useCallback(async(id:string)=>{
      try{ await moderateReel({id,status:'approved',moderatorId}); removeFromList([id]); }
      catch(e:any){ console.error(e.message); }
    },[moderatorId,removeFromList]);
  
    const openRejectModal = useCallback((id:string)=>setRejTarget(id),[]);
  
    const confirmReject = useCallback(async(id:string, cat:RejCategory, reason:string)=>{
      setRejTarget(null);
      try{ await moderateReel({id,status:'rejected',category:cat,reason,moderatorId}); removeFromList([id]); }
      catch(e:any){ console.error(e.message); }
    },[moderatorId,removeFromList]);
  
    const handleReapprove = useCallback(async(id:string)=>{
      if(Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      try{ await moderateReel({id,status:'approved',moderatorId}); removeFromList([id]); }
      catch(e:any){ console.error(e.message); }
    },[moderatorId,removeFromList]);
  
    // Bulk actions
    const handleBulkApprove = useCallback(async()=>{
      const ids=[...selected];
      await Promise.allSettled(ids.map(id=>moderateReel({id,status:'approved',moderatorId})));
      removeFromList(ids);
    },[selected,moderatorId,removeFromList]);
  
    const handleBulkReject = useCallback(async()=>{
      const ids=[...selected];
      await Promise.allSettled(ids.map(id=>moderateReel({id,status:'rejected',category:'other',reason:'Rejet groupé',moderatorId})));
      removeFromList(ids);
    },[selected,moderatorId,removeFromList]);
  
    const toggleSelect = useCallback((id:string)=>{
      setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
    },[]);
  
    // ── Filtre + tri ──────────────────────────────────────────────────────────
    const filtered = useMemo(()=>{
      let list=[...reels];
      const q=filters.search.toLowerCase().trim();
      if(q) list=list.filter(r=>
        (r.title??'').toLowerCase().includes(q)||
        (r.genre??'').toLowerCase().includes(q)||
        (r.director??'').toLowerCase().includes(q)||
        r.user_id.includes(q)||(r.synopsis??'').toLowerCase().includes(q)
      );
      if(filters.genre) list=list.filter(r=>r.genre===filters.genre);
      if(filters.minScore>0) list=list.filter(r=>(safetyCache.get(r.id)?.score??100)>=filters.minScore);
      if(filters.dateFrom) list=list.filter(r=>new Date(r.created_at)>=new Date(filters.dateFrom));
      switch(filters.sort){
        case 'date_asc':   list.sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()); break;
        case 'score_asc':  list.sort((a,b)=>(safetyCache.get(a.id)?.score??100)-(safetyCache.get(b.id)?.score??100)); break;
        case 'score_desc': list.sort((a,b)=>(safetyCache.get(b.id)?.score??100)-(safetyCache.get(a.id)?.score??100)); break;
        case 'likes_desc': list.sort((a,b)=>b.likes_count-a.likes_count); break;
        default: break; // date_desc déjà triée par Supabase
      }
      return list;
    },[reels,filters,safetyCache]);
  
    // Compteurs alertes pour la banner
    const dangerCount  = useMemo(()=>[...safetyCache.values()].filter(s=>s.level==='danger').length,[safetyCache]);
    const warningCount = useMemo(()=>[...safetyCache.values()].filter(s=>s.level==='warn').length,[safetyCache]);
  
    // ── Viewability → autoplay ────────────────────────────────────────────────
    const viewCfg = useRef({itemVisiblePercentThreshold:55}).current;
    const onViewChange = useRef(({viewableItems}:{viewableItems:any[]})=>{
      const first=viewableItems[0];
      if(first?.index!=null) setActiveIndex(first.index);
    }).current;
  
    // ── Render ────────────────────────────────────────────────────────────────
    const renderItem = useCallback(({item,index}:{item:AdminReel;index:number})=>(
      <ReelCard
        reel={item}
        safety={safetyCache.get(item.id)??analyzeSafety(item)}
        isActive={index===activeIndex}
        activeTab={activeTab}
        selected={selected.has(item.id)}
        onApprove={handleApprove}
        onReject={openRejectModal}
        onReapprove={handleReapprove}
        onDetail={setDetailReel}
        onSelect={toggleSelect}
      />
    ),[activeIndex,activeTab,selected,safetyCache,handleApprove,openRejectModal,handleReapprove,toggleSelect]);
  
    const keyExtractor = useCallback((r:AdminReel)=>r.id,[]);
  
    const ListHeader = useMemo(()=>(
      <>
        <AnalyticsBanner counts={counts} dangerCount={dangerCount} warningCount={warningCount}/>
        <StatusTabs active={activeTab} counts={counts} onChange={handleTabChange}/>
        <FilterBar filters={filters} onChange={p=>setFilters(prev=>({...prev,...p}))} onClear={()=>setFilters(FILTER_DEFAULTS)}/>
        {filtered.length>0&&(
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,marginBottom:10}}>
            <Text style={{color:C.muted,fontSize:11}}>{filtered.length} vidéo{filtered.length>1?'s':''}</Text>
            {selected.size===0&&<TouchableOpacity onPress={()=>setSelected(new Set(filtered.map(r=>r.id)))} hitSlop={8}><Text style={{color:C.white,fontSize:11,fontWeight:'600',opacity:0.55}}>Tout sélectionner</Text></TouchableOpacity>}
          </View>
        )}
      </>
    ),[counts,dangerCount,warningCount,activeTab,handleTabChange,filters,filtered.length,selected.size]);
  
    const ListEmpty = useMemo(()=>{
      if(loading) return(
        <View style={{paddingVertical:80,alignItems:'center',gap:14}}>
          <ActivityIndicator color={C.muted} size="large"/>
          <Text style={{color:C.muted,fontSize:13}}>Chargement…</Text>
        </View>
      );
      return(
        <View style={{paddingVertical:80,alignItems:'center',gap:12}}>
          <Ionicons name={activeTab==='pending'?'checkmark-done-circle-outline':activeTab==='approved'?'film-outline':'trash-outline'} size={48} color={C.muted}/>
          <Text style={{color:C.offWhite,fontSize:16,fontWeight:'700'}}>
            {activeTab==='pending'?'Aucune vidéo en attente':activeTab==='approved'?'Aucune vidéo validée':'Aucune vidéo rejetée'}
          </Text>
          {filters.search.length>0&&<Text style={{color:C.muted,fontSize:12}}>Modifiez votre recherche</Text>}
        </View>
      );
    },[loading,activeTab,filters.search]);
  
    const detailSafety = detailReel ? (safetyCache.get(detailReel.id)??analyzeSafety(detailReel)) : null;
    const rejAiResult  = rejTarget  ? (safetyCache.get(rejTarget)??null) : null;
  
    return(
      <View style={sc.root}>
        <StatusBar style="light"/>
        <GalaxyBackground/>
  
        <SafeAreaView style={{flex:1}} edges={['top']}>
  
          {/* HEADER */}
          <View style={sc.header}>
            <TouchableOpacity style={sc.navBtn} onPress={()=>router.back()} activeOpacity={0.80}>
              <Ionicons name="chevron-back" size={18} color={C.white}/>
            </TouchableOpacity>
            <View style={{flex:1}}>
              <Text style={sc.title}>Universe Office</Text>
              <Text style={sc.sub}>Modération · {counts.pending} en attente</Text>
            </View>
            <TouchableOpacity style={sc.navBtn} onPress={()=>{load(activeTab);refreshCounts();}} activeOpacity={0.80}>
              <Ionicons name="refresh" size={16} color={C.muted}/>
            </TouchableOpacity>
          </View>
  
          {/* FEED */}
          <FlatList
            data={filtered}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={ListHeader}
            ListEmptyComponent={ListEmpty}
            viewabilityConfig={viewCfg}
            onViewableItemsChanged={onViewChange}
            contentContainerStyle={sc.list}
            showsVerticalScrollIndicator={false}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            removeClippedSubviews={false}
          />
  
          {/* Bulk bar */}
          {selected.size>0&&(
            <BulkBar
              count={selected.size}
              onApproveAll={handleBulkApprove}
              onRejectAll={handleBulkReject}
              onClear={()=>setSelected(new Set())}
            />
          )}
        </SafeAreaView>
  
        {/* Modals */}
        <RejectionModal
          visible={!!rejTarget}
          reelId={rejTarget}
          aiResult={rejAiResult}
          onConfirm={confirmReject}
          onCancel={()=>setRejTarget(null)}
        />
        <DetailModal
          reel={detailReel}
          safety={detailSafety}
          onClose={()=>setDetailReel(null)}
          onApprove={handleApprove}
          onReject={openRejectModal}
          onReapprove={handleReapprove}
        />
      </View>
    );
  }
  
  const sc = StyleSheet.create({
    root:   {flex:1,backgroundColor:C.bg},
    list:   {paddingHorizontal:EDGE,paddingBottom:100},
    header: {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:EDGE,paddingBottom:14,paddingTop:8},
    navBtn: {width:36,height:36,borderRadius:18,backgroundColor:C.surface,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
    title:  {color:C.white,fontSize:18,fontWeight:'900',letterSpacing:-0.4},
    sub:    {color:C.muted,fontSize:11,marginTop:2},
  });