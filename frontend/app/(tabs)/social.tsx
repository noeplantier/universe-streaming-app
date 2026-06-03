/**
 * app/(tabs)/social.tsx — UNIVERSE
 *
 * ★ getDeviceId() — ZERO supabase.auth.* → likes/comments marchent sans login
 * ★ Likes optimistes — upsert critique_likes (UUID device, pas 'anonymous')
 * ★ Commentaires — persistants par device UUID, visible par tous
 * ★ Share — Share.share() natif (WhatsApp/Gmail/SMS) + Web Share API / clipboard
 * ★ Commentaires "Voir plus" — state React correct (pas de mutation directe)
 * ★ NIV supprimé — header épuré
 * ★ paddingBottom réduit → plus de grand vide au-dessus de la CustomNavBar
 */
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Platform,
  ScrollView, TextInput, Alert, Share, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { router, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { supabase }       from '@/lib/supabase';
import { getDeviceId }    from '@/services/api';
import GalaxyBackground   from '@/components/social/GalaxyBackground';
import IndustrieScreen    from '@/components/social/IndustrieScreen';

let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
const hapticLight  = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(()=>{});
const hapticMedium = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Medium).catch(()=>{});

const { width: W } = Dimensions.get('window');
const EDGE = 18;

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#070C17', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.88)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  subtle:'rgba(255,255,255,0.14)', faint:'rgba(255,255,255,0.07)',
  border:'rgba(255,255,255,0.09)', borderHi:'rgba(255,255,255,0.22)',
  blue:'#5A96E6', blueFaint:'rgba(90,150,230,0.10)', blueBorder:'rgba(90,150,230,0.25)',
  green:'#2ECC8A', greenFaint:'rgba(46,204,138,0.10)',
  gold:'#F5C842', goldDim:'rgba(245,200,66,0.12)',
  red:'#FF3B5C',
} as const;

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Critique {
  id:string; user_id:string; reel_id:string|null;
  title:string; film_title:string; content:string;
  rating:number|null; tags:string[]|null;
  likes_count:number; created_at:string; author:string|null;
  profile?:{ display_name:string; avatar_url:string|null };
  is_liked?:boolean; comments?:Comment[]; show_comments?:boolean;
  shares_count?:number;
}
interface Comment {
  id:string; critique_id:string; user_id:string;
  content:string; created_at:string; likes_count:number;
  profile?:{ display_name:string; avatar_url:string|null };
  expanded?:boolean;
}
interface NetworkPro {
  id:string; name:string; role:string; avatar:string|null;
  verified:boolean;
}
type FeedTab = 'Pour vous'|'Tendances';
const FEED_TABS: FeedTab[] = ['Pour vous','Tendances'];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtK = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
function timeAgo(d:string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000);
  if(m<1)return"à l'instant"; if(m<60)return`il y a ${m} min`;
  const h=Math.floor(m/60); if(h<24)return`il y a ${h}h`;
  const dd=Math.floor(h/24); if(dd<7)return`il y a ${dd}j`;
  return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}
const av = (uid:string, url?:string|null) => url ?? `https://i.pravatar.cc/80?u=${uid}`;

// ─── ★ HOOK CRITIQUES — getDeviceId(), plus d'anonymous ──────────────────────
function useCritiques(tab: FeedTab, userId: string) {
  const [items,   setItems]   = useState<Critique[]>([]);
  const [loading, setLoading] = useState(true);
  const [rk,      setRk]      = useState(0);
  const refresh = useCallback(()=>setRk(k=>k+1),[]);

  // Fetch principal
  useEffect(()=>{
    if (!userId) return;
    let dead = false;
    setLoading(true);
    const order = tab==='Tendances' ? 'likes_count' : 'created_at';
    supabase.from('critiques')
      .select('id,user_id,reel_id,title,film_title,content,rating,tags,likes_count,created_at,author')
      .order(order,{ascending:false}).limit(60)
      .then(async ({data,error})=>{
        if(dead||error){setLoading(false);return;}
        const rows=(data??[]) as Critique[];
        // Profils enrichis
        const uids=[...new Set(rows.map(r=>r.user_id))];
        const{data:profiles}=await supabase.from('profiles').select('id,display_name,avatar_url').in('id',uids);
        const pm:Record<string,any>={};(profiles??[]).forEach((p:any)=>{pm[p.id]=p;});
        // Likes de cet utilisateur — ★ userId est maintenant un UUID valide (pas 'anonymous')
        const{data:liked}=await supabase.from('critique_likes').select('critique_id').eq('user_id',userId);
        const likedSet=new Set((liked??[]).map((r:any)=>r.critique_id));
        if(!dead){
          setItems(rows.map(r=>({
            ...r,
            profile:    pm[r.user_id],
            is_liked:   likedSet.has(r.id),
            comments:   [],
            show_comments:false,
            shares_count:0,
          })));
          setLoading(false);
        }
      }).catch(()=>{if(!dead)setLoading(false);});
    return()=>{dead=true;};
  },[tab,userId,rk]);

  // Realtime — nouvelles critiques et mises à jour de likes
  useEffect(()=>{
    const ch = supabase.channel(`critiques_rt_${Date.now()}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'critiques'},async({new:row})=>{
        const r=row as Critique;
        const{data:p}=await supabase.from('profiles').select('id,display_name,avatar_url').eq('id',r.user_id).maybeSingle();
        setItems(prev=>[{...r,profile:p??undefined,is_liked:false,comments:[],show_comments:false,shares_count:0},...prev]);
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'critiques'},({new:row})=>{
        const r=row as Critique;
        setItems(prev=>prev.map(c=>c.id===r.id?{...c,likes_count:r.likes_count}:c));
      })
      .subscribe();
    return()=>{supabase.removeChannel(ch);};
  },[]);

  // ★ Like optimiste — UID valide, plus de garde 'anonymous'
  const toggleLike = useCallback(async(id:string)=>{
    hapticLight();
    setItems(prev=>prev.map(c=>{
      if(c.id!==id) return c;
      const liked = !c.is_liked;
      if(liked){
        // upsert évite les doublons même en cas de double-tap rapide
        supabase.from('critique_likes')
          .upsert({user_id:userId,critique_id:id},{onConflict:'user_id,critique_id'}).then(()=>{});
        supabase.from('critiques').update({likes_count:c.likes_count+1}).eq('id',id).then(()=>{});
      } else {
        supabase.from('critique_likes').delete().eq('user_id',userId).eq('critique_id',id).then(()=>{});
        supabase.from('critiques').update({likes_count:Math.max(0,c.likes_count-1)}).eq('id',id).then(()=>{});
      }
      return{...c,is_liked:liked,likes_count:c.likes_count+(liked?1:-1)};
    }));
  },[userId]);

  // Toggle section commentaires — fetch public.critique_comments
  const toggleComments = useCallback(async(id:string)=>{
    setItems(prev=>prev.map(c=>{
      if(c.id!==id) return c;
      const open = !c.show_comments;
      if(open && (!c.comments || c.comments.length===0)){
        supabase.from('critique_comments')
          .select('id,critique_id,user_id,content,created_at')
          .eq('critique_id',id).order('created_at',{ascending:true}).limit(30)
          .then(async({data})=>{
            if(!data) return;
            const uids=[...new Set((data as Comment[]).map(cm=>cm.user_id))];
            const{data:profs}=await supabase.from('profiles').select('id,display_name,avatar_url').in('id',uids);
            const pm:Record<string,any>={};(profs??[]).forEach((p:any)=>{pm[p.id]=p;});
            setItems(prev2=>prev2.map(c2=>c2.id===id
              ?{...c2,comments:(data as Comment[]).map(cm=>({...cm,likes_count:0,profile:pm[cm.user_id],expanded:false}))}
              :c2,
            ));
          });
      }
      return{...c,show_comments:open};
    }));
  },[]);

  // ★ Toggle "Voir plus" d'un commentaire — via setState (pas de mutation directe)
  const expandComment = useCallback((critiqueId:string, commentId:string)=>{
    setItems(prev=>prev.map(c=>{
      if(c.id!==critiqueId) return c;
      return{...c,comments:(c.comments??[]).map(cm=>cm.id===commentId?{...cm,expanded:!cm.expanded}:cm)};
    }));
  },[]);

  // ★ Partage — Share.share() natif → WhatsApp/Gmail/SMS/etc.
  //             Web Share API si dispo, sinon clipboard
  const shareCritique = useCallback(async(critique:Critique)=>{
    const msg = `"${critique.title}" — ${critique.film_title}\n\n${critique.content.slice(0,160)}…\n\nUniverse · Cinéma indépendant`;
    try {
      if(Platform.OS!=='web'){
        // iOS/Android : ouvre la feuille de partage native (WhatsApp, Gmail, SMS, etc.)
        await Share.share({message:msg,title:critique.title});
      } else if(typeof navigator!=='undefined' && (navigator as any).share){
        // Web Share API (mobile Chrome / Safari)
        await (navigator as any).share({title:critique.title,text:msg});
      } else {
        // Fallback clipboard (navigateur desktop)
        await (navigator as any).clipboard.writeText(msg);
        Alert.alert('Copié !','Critique copiée dans le presse-papier.');
      }
      supabase.from('critique_shares').insert({
        critique_id:critique.id, user_id:userId,
        platform:Platform.OS==='web'?'web':'native',
      }).catch(()=>{});
      setItems(prev=>prev.map(c=>c.id===critique.id?{...c,shares_count:(c.shares_count??0)+1}:c));
    } catch(e:any){
      // L'utilisateur a annulé le partage — pas d'alerte d'erreur
      if(e?.message?.includes('cancel')) return;
      console.warn('[Social] share:', e?.message);
    }
  },[userId]);

  // Partage commentaire
  const shareComment = useCallback(async(critique:Critique, comment:Comment)=>{
    const msg = `${comment.profile?.display_name??'Un cinéphile'} sur "${critique.film_title}" :\n\n"${comment.content}"\n\nUniverse · Cinéma indépendant`;
    try {
      if(Platform.OS!=='web') await Share.share({message:msg});
      else if(typeof navigator!=='undefined'&&(navigator as any).share) await (navigator as any).share({text:msg});
      else { await (navigator as any).clipboard.writeText(msg); Alert.alert('Copié !','Commentaire copié.'); }
    } catch{}
  },[]);

  // ★ Ajout commentaire — UID device valide, persistant sans login obligatoire
  const addComment = useCallback(async(critiqueId:string,text:string)=>{
    if(!text.trim()) return;
    hapticMedium();
    const{data,error}=await supabase.from('critique_comments')
      .insert({critique_id:critiqueId,user_id:userId,content:text.trim()})
      .select('id,critique_id,user_id,content,created_at').single();
    if(error||!data){
      console.error('[Social] addComment:', error?.message);
      Alert.alert('Erreur','Impossible d\'ajouter le commentaire. Vérifie que universe_setup.sql a été exécuté.');
      return;
    }
    const{data:p}=await supabase.from('profiles').select('id,display_name,avatar_url').eq('id',userId).maybeSingle();
    const newCm:Comment={...(data as Comment),profile:p??undefined,expanded:false};
    setItems(prev=>prev.map(c=>c.id===critiqueId?{...c,comments:[...(c.comments??[]),newCm]}:c));
  },[userId]);

  return{items,loading,refresh,toggleLike,toggleComments,expandComment,shareCritique,shareComment,addComment};
}

// ─── HOOK NETWORK ─────────────────────────────────────────────────────────────
function useNetworkActivity(){
  const[pros,setPros]=useState<NetworkPro[]>([]);
  const[loading,setLoading]=useState(true);
  useEffect(()=>{
    supabase.from('professionals').select('id,name,role,avatar_url,verified')
      .eq('is_active',true).order('verified',{ascending:false}).limit(16)
      .then(({data})=>{
        if(data) setPros(data.map((p:any)=>({id:p.id,name:p.name,role:p.role??'Pro',avatar:p.avatar_url??p.avatar??null,verified:p.verified??false})));
        setLoading(false);
      }).catch(()=>setLoading(false));
  },[]);
  return{pros,loading};
}

// ─── STAR RATING ──────────────────────────────────────────────────────────────
const Stars = memo(({r}:{r:number|null})=>{
  if(!r) return null;
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
      {[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=Math.round(r)?'star':'star-outline'} size={10} color={i<=r?C.gold:C.muted}/>)}
      <Text style={{color:C.gold,fontSize:10,fontWeight:'700',marginLeft:2}}>{r.toFixed(1)}</Text>
    </View>
  );
});

// ─── COMMENT INPUT ────────────────────────────────────────────────────────────
const CommentInput = memo(function CommentInput({onSent}:{onSent:(text:string)=>void}){
  const[text,setText]=useState('');
  const[sending,setSending]=useState(false);
  const send = useCallback(async()=>{
    if(!text.trim()||sending) return;
    setSending(true);
    onSent(text.trim());
    setText('');
    setSending(false);
  },[text,sending,onSent]);
  return(
    <View style={ci.row}>
      <TextInput
        style={ci.input}
        placeholder="Ajouter un commentaire…"
        placeholderTextColor="rgba(255,255,255,0.22)"
        value={text}
        onChangeText={setText}
        multiline
        maxLength={500}
        selectionColor={C.blue}
        onSubmitEditing={send}
        blurOnSubmit={false}
      />
      <TouchableOpacity
        onPress={send}
        disabled={!text.trim()||sending}
        style={[ci.btn,(!text.trim()||sending)&&{opacity:0.35}]}
      >
        {sending
          ? <ActivityIndicator color={C.blue} size="small"/>
          : <Ionicons name="send" size={14} color={C.blue}/>
        }
      </TouchableOpacity>
    </View>
  );
});
const ci=StyleSheet.create({
  row:   {flexDirection:'row',alignItems:'flex-end',gap:7,paddingHorizontal:13,paddingVertical:10,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  input: {flex:1,color:C.white,fontSize:12,lineHeight:17,maxHeight:65,backgroundColor:'rgba(255,255,255,0.05)',borderRadius:11,paddingHorizontal:11,paddingVertical:7},
  btn:   {width:32,height:32,borderRadius:16,backgroundColor:C.blueFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
});

// ─── CRITIQUE CARD ────────────────────────────────────────────────────────────
const CritiqueCard = memo(function CritiqueCard({
  item, userId,
  onLike, onComments, onExpandComment, onTag, onShare, onShareComment, onAddComment,
}:{
  item:Critique; userId:string;
  onLike:(id:string)=>void;
  onComments:(id:string)=>void;
  onExpandComment:(critiqueId:string,commentId:string)=>void;
  onTag:(t:string)=>void;
  onShare:(c:Critique)=>void;
  onShareComment:(c:Critique,cm:Comment)=>void;
  onAddComment:(id:string,text:string)=>void;
}) {
  const likeAnim  = useRef(new Animated.Value(1)).current;
  const[expanded, setExpanded]=useState(false);

  const handleLike = useCallback(()=>{
    Animated.sequence([
      Animated.spring(likeAnim,{toValue:1.4,tension:300,friction:7,useNativeDriver:true}),
      Animated.spring(likeAnim,{toValue:1,tension:200,friction:8,useNativeDriver:true}),
    ]).start();
    onLike(item.id);
  },[onLike,item.id,likeAnim]);

  const dn      = item.profile?.display_name ?? item.author ?? 'Cinéphile';
  const avUri   = av(item.user_id,item.profile?.avatar_url);
  const isLong  = item.content.length>180;
  const txt     = isLong&&!expanded ? item.content.slice(0,180)+'…' : item.content;
  const cmCount = item.comments?.length ?? 0;
  const shareCount = item.shares_count ?? 0;

  return(
    <View style={crd.wrap}>
      <BlurView intensity={Platform.OS==='ios'?18:12} tint="dark" style={StyleSheet.absoluteFillObject}/>

      {/* Header */}
      <View style={crd.header}>
        <TouchableOpacity
          style={crd.authorRow}
          activeOpacity={0.80}
        >
          <Image source={{uri:avUri}} style={crd.avatar}/>
          <View style={{flex:1,gap:1}}>
            <Text style={crd.authorName} numberOfLines={1}>{dn}</Text>
            <Text style={crd.date}>{timeAgo(item.created_at)}</Text>
          </View>
        </TouchableOpacity>
        <Stars r={item.rating}/>
      </View>

      {/* Film */}
      <View style={crd.filmRow}>
        <Ionicons name="film-outline" size={10} color={C.blue}/>
        <Text style={crd.filmTitle} numberOfLines={1}>{item.film_title}</Text>
      </View>

      {/* Titre */}
      <Text style={crd.title}>{item.title}</Text>

      {/* Contenu + voir plus */}
      <Text style={crd.content}>{txt}</Text>
      {isLong&&(
        <TouchableOpacity onPress={()=>setExpanded(v=>!v)} hitSlop={6}>
          <Text style={{color:C.blue,fontSize:11,fontWeight:'700',marginTop:3,paddingHorizontal:14}}>
            {expanded?'Voir moins ↑':'Voir plus ↓'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Tags */}
      {item.tags&&item.tags.length>0&&(
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={crd.tags} style={{marginTop:9}}>
          {item.tags.map(t=>(
            <TouchableOpacity key={t} onPress={()=>onTag(t)} style={crd.tag}>
              <Text style={crd.tagTxt}>#{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ★ Actions — likes/comments/share tous fonctionnels */}
      <View style={crd.actions}>
        {/* Like */}
        <TouchableOpacity onPress={handleLike} style={[crd.actionBtn, item.is_liked&&crd.actionBtnLiked]} activeOpacity={0.80}>
          <Animated.View style={{transform:[{scale:likeAnim}]}}>
            <Ionicons name={item.is_liked?'heart':'heart-outline'} size={16} color={item.is_liked?C.red:C.muted}/>
          </Animated.View>
          <Text style={[crd.actionTxt,item.is_liked&&{color:C.red,fontWeight:'700'}]}>
            {fmtK(item.likes_count??0)}
          </Text>
        </TouchableOpacity>

        {/* Commentaire */}
        <TouchableOpacity onPress={()=>onComments(item.id)} style={[crd.actionBtn,item.show_comments&&crd.actionBtnActive]} activeOpacity={0.80}>
          <Ionicons name={item.show_comments?'chatbubble':'chatbubble-outline'} size={15} color={item.show_comments?C.blue:C.muted}/>
          <Text style={[crd.actionTxt,item.show_comments&&{color:C.blue,fontWeight:'700'}]}>
            {cmCount>0?fmtK(cmCount):'Commenter'}
          </Text>
        </TouchableOpacity>

        {/* ★ Partage natif — WhatsApp / Gmail / SMS */}
        <TouchableOpacity onPress={()=>onShare(item)} style={crd.actionBtn} activeOpacity={0.80}>
          <Ionicons name="share-social-outline" size={15} color={C.muted}/>
          <Text style={crd.actionTxt}>{shareCount>0?fmtK(shareCount)+' ':''}</Text>
          <Text style={crd.actionTxt}>Partager</Text>
        </TouchableOpacity>

      </View>

      {/* ★ Section commentaires — accessible sans login */}
      {item.show_comments&&(
        <View style={crd.commentsWrap}>
          {(item.comments??[]).length===0&&(
            <Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingVertical:12}}>
              Soyez le premier à commenter
            </Text>
          )}
          {(item.comments??[]).map(cm=>(
            <View key={cm.id} style={crd.cmRow}>
              <Image source={{uri:av(cm.user_id,cm.profile?.avatar_url)}} style={crd.cmAvatar}/>
              <View style={crd.cmBody}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Text style={crd.cmAuthor}>{cm.profile?.display_name??'Cinéphile'}</Text>
                  <Text style={crd.cmDate}>{timeAgo(cm.created_at)}</Text>
                  <TouchableOpacity onPress={()=>onShareComment(item,cm)} hitSlop={6} style={{marginLeft:'auto' as any}}>
                    <Ionicons name="share-outline" size={11} color="rgba(255,255,255,0.25)"/>
                  </TouchableOpacity>
                </View>
                {/* ★ "Voir plus" via setState, pas de mutation directe */}
                <Text style={crd.cmContent} numberOfLines={cm.expanded?undefined:3}>{cm.content}</Text>
                {cm.content.length>120&&(
                  <TouchableOpacity onPress={()=>onExpandComment(item.id,cm.id)} hitSlop={4}>
                    <Text style={{color:C.blue,fontSize:10,fontWeight:'600',marginTop:2}}>
                      {cm.expanded?'Voir moins ↑':'Voir plus ↓'}
                    </Text>
                  </TouchableOpacity>
                )}
                {cm.likes_count>0&&(
                  <View style={{flexDirection:'row',alignItems:'center',gap:2,marginTop:2}}>
                    <Ionicons name="heart" size={8} color={C.red}/>
                    <Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{cm.likes_count}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
          {/* ★ CommentInput toujours visible — pas de garde 'anonymous' */}
          <CommentInput onSent={text=>onAddComment(item.id,text)}/>
        </View>
      )}
    </View>
  );
});

const crd=StyleSheet.create({
  wrap:           {marginHorizontal:EDGE,marginBottom:13,borderRadius:17,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  header:         {flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:13,paddingBottom:7},
  authorRow:      {flexDirection:'row',alignItems:'center',gap:9,flex:1},
  avatar:         {width:34,height:34,borderRadius:17,borderWidth:1.5,borderColor:C.border},
  authorName:     {color:C.white,fontSize:12,fontWeight:'800',letterSpacing:-0.2},
  date:           {color:C.muted,fontSize:9},
  filmRow:        {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,marginBottom:5},
  filmTitle:      {color:C.blue,fontSize:11,fontWeight:'700',flex:1},
  title:          {color:C.white,fontSize:15,fontWeight:'900',letterSpacing:-0.3,lineHeight:21,paddingHorizontal:13,marginBottom:5},
  content:        {color:'rgba(255,255,255,0.70)',fontSize:13,lineHeight:20,paddingHorizontal:13},
  tags:           {paddingHorizontal:13,gap:5},
  tag:            {paddingHorizontal:8,paddingVertical:3,borderRadius:9,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  tagTxt:         {color:C.muted,fontSize:10,fontWeight:'600'},
  actions:        {flexDirection:'row',alignItems:'center',gap:5,padding:11,paddingTop:11,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,marginTop:9,flexWrap:'wrap'},
  actionBtn:      {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:6,borderRadius:9,backgroundColor:C.faint},
  actionBtnLiked: {backgroundColor:'rgba(255,59,92,0.10)',borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,59,92,0.25)'},
  actionBtnActive:{backgroundColor:C.blueFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder},
  actionTxt:      {color:C.muted,fontSize:10,fontWeight:'600'},
  commentsWrap:   {borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border},
  cmRow:          {flexDirection:'row',gap:9,padding:11,paddingBottom:5},
  cmAvatar:       {width:26,height:26,borderRadius:13,borderWidth:1,borderColor:C.border,flexShrink:0},
  cmBody:         {flex:1,gap:2},
  cmAuthor:       {color:C.white,fontSize:11,fontWeight:'700'},
  cmDate:         {color:C.muted,fontSize:9},
  cmContent:      {color:'rgba(255,255,255,0.62)',fontSize:11,lineHeight:16},
});

// ─── TOP CRITIQUE BANNER ──────────────────────────────────────────────────────
const TopBanner = memo(({critique}:{critique:Critique|null})=>{
  if(!critique) return null;
  return(
    <View style={tb.wrap}>
      <LinearGradient colors={['rgba(90,150,230,0.15)','rgba(7,12,23,0.95)']} style={StyleSheet.absoluteFillObject}/>
      <View style={tb.badge}>
        <Ionicons name="trophy-outline" size={9} color={C.gold}/>
        <Text style={tb.badgeTxt}>CRITIQUE N°1 · {fmtK(critique.likes_count)} ♥</Text>
      </View>
      <View style={{flexDirection:'row',gap:12,alignItems:'flex-start'}}>
        <Image source={{uri:av(critique.user_id,critique.profile?.avatar_url)}} style={tb.avatar}/>
        <View style={{flex:1,gap:2}}>
          <Text style={{color:C.blue,fontSize:10,fontWeight:'700'}}>{critique.film_title}</Text>
          <Text style={{color:C.white,fontSize:17,fontWeight:'900',letterSpacing:-0.4,lineHeight:22}} numberOfLines={2}>{critique.title}</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:C.muted,fontSize:10}}>{critique.profile?.display_name??critique.author??'Anonyme'}</Text>
            <Stars r={critique.rating}/>
          </View>
        </View>
      </View>
    </View>
  );
});
const tb=StyleSheet.create({
  wrap:     {marginHorizontal:EDGE,marginBottom:15,borderRadius:17,overflow:'hidden',padding:15,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder},
  badge:    {flexDirection:'row',alignItems:'center',gap:4,alignSelf:'flex-start',paddingHorizontal:8,paddingVertical:3,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.goldDim,backgroundColor:'rgba(7,12,23,0.72)',marginBottom:9},
  badgeTxt: {color:C.gold,fontSize:7.5,fontWeight:'800',letterSpacing:0.8},
  avatar:   {width:48,height:48,borderRadius:24,borderWidth:2,borderColor:C.blueBorder},
});

// ─── NETWORK ROW ─────────────────────────────────────────────────────────────
const NetworkRow = memo(({pros,loading,onIndustry}:{pros:NetworkPro[];loading:boolean;onIndustry:()=>void})=>{
  if(!loading&&!pros.length) return null;
  return(
    <View style={{marginBottom:16}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:EDGE,marginBottom:11}}>
        <Ionicons name="briefcase-outline" size={12} color={C.mid}/>
        <Text style={{color:C.offWhite,fontSize:14,fontWeight:'800'}}>Industrie cinéma</Text>
        <TouchableOpacity
          onPress={onIndustry}
          hitSlop={8}
          style={{marginLeft:'auto' as any,flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:4,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint}}
        >
          <Text style={{color:C.blue,fontSize:10,fontWeight:'700'}}>Tout voir</Text>
          <Ionicons name="chevron-forward" size={10} color={C.blue}/>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,gap:9}}>
        {loading
          ? [0,1,2,3].map(i=><View key={i} style={{width:122,height:152,borderRadius:13,backgroundColor:C.navyMid}}/>)
          : pros.map(p=>(
            <TouchableOpacity key={p.id} style={nr.card} onPress={onIndustry} activeOpacity={0.88}>
              <Image source={{uri:av(p.id,p.avatar)}} style={nr.img} resizeMode="cover"/>
              <LinearGradient colors={['transparent','rgba(7,12,23,0.96)']} style={StyleSheet.absoluteFillObject} start={{x:0,y:0.5}} end={{x:0,y:1}}/>
              {p.verified&&<View style={nr.vBadge}><Ionicons name="checkmark" size={7} color={C.white}/></View>}
              <View style={nr.info}>
                <Text style={nr.name} numberOfLines={1}>{p.name}</Text>
                <Text style={nr.role} numberOfLines={1}>{p.role}</Text>
              </View>
            </TouchableOpacity>
          ))
        }
      </ScrollView>
    </View>
  );
});
const nr=StyleSheet.create({
  card:   {width:122,height:152,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  img:    {width:'100%',height:'100%',position:'absolute'},
  vBadge: {position:'absolute',top:7,right:7,width:16,height:16,borderRadius:8,backgroundColor:'rgba(7,12,23,0.75)',borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
  info:   {position:'absolute',bottom:0,left:0,right:0,padding:9,gap:1},
  name:   {color:C.white,fontSize:10,fontWeight:'800'},
  role:   {color:C.muted,fontSize:8.5},
});

// ═════════════════════════════════════════════════════════════════════════════
// ★★★ SCREEN
// ═════════════════════════════════════════════════════════════════════════════
export default function SocialScreen() {
  const router        = useRouter();
  const[tab,setTab]   = useState<FeedTab>('Pour vous');
  const[showIndustry, setShowIndustry] = useState(false);
  const[userId,       setUserId]       = useState('');
  const[refreshing,   setRefreshing]   = useState(false);
  const[filterTag,    setFilterTag]    = useState<string|null>(null);
  const listRef = useRef<FlatList<Critique>>(null);

  // ★ Init — getDeviceId() au lieu de supabase.auth.getSession()
  useEffect(()=>{
    getDeviceId().then(id => setUserId(id));
  },[]);

  const {items,loading,refresh,toggleLike,toggleComments,expandComment,shareCritique,shareComment,addComment} =
    useCritiques(tab, userId);
  const {pros, loading:prosLoading} = useNetworkActivity();

  const displayed = useMemo(()=>
    !filterTag ? items : items.filter(c=>c.tags?.includes(filterTag)),
    [items,filterTag]
  );
  const top  = displayed[0] ?? null;
  const feed = displayed.slice(1);

  const onRefresh = useCallback(()=>{
    setRefreshing(true);
    setFilterTag(null);
    refresh();
    setTimeout(()=>setRefreshing(false),900);
  },[refresh]);

  const handleTag = useCallback((t:string)=>{
    setFilterTag(p=>p===t?null:t);
    hapticLight();
    listRef.current?.scrollToOffset({offset:0,animated:true});
  },[]);

  const handleAddComment = useCallback((id:string,text:string)=>{
    addComment(id,text);
  },[addComment]);

  const renderItem = useCallback(({item}:{item:Critique})=>(
    <CritiqueCard
      item={item}
      userId={userId}
      onLike={toggleLike}
      onComments={toggleComments}
      onExpandComment={expandComment}
      onTag={handleTag}
      onShare={shareCritique}
      onShareComment={shareComment}
      onAddComment={handleAddComment}
    />
  ),[userId,toggleLike,toggleComments,expandComment,handleTag,shareCritique,shareComment,handleAddComment]);

  const keyExtractor = useCallback((item:Critique)=>item.id,[]);

  const ListHeader = (
    <View>
      {/* ★ Header épuré — "NIV" supprimé */}
      <View style={sc.header}>
        <View style={{gap:1}}>
          <Text style={sc.eyebrow}>UNIVERSE · CINÉMA</Text>
          <Text style={sc.title}>Communauté</Text>
        </View>
        <View style={{flexDirection:'row',gap:7,alignItems:'center'}}>
          <TouchableOpacity
            style={[sc.iconBtn,{borderColor:C.blueBorder,backgroundColor:C.blueFaint}]}
            onPress={()=>setShowIndustry(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="briefcase-outline" size={16} color={C.blue}/>
          </TouchableOpacity>
          <TouchableOpacity style={sc.iconBtn} onPress={()=>router.push('/notifications' as any)} activeOpacity={0.80}>
            <Ionicons name="notifications-outline" size={16} color={C.mid}/>
            <View style={sc.notifDot}/>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={sc.tabs}>
        {FEED_TABS.map(t=>{
          const on=t===tab;
          return(
            <TouchableOpacity
              key={t}
              onPress={()=>{setTab(t);setFilterTag(null);listRef.current?.scrollToOffset({offset:0,animated:true});}}
              style={sc.tab} activeOpacity={0.80}
            >
              <Text style={[sc.tabTxt,on&&sc.tabTxtOn]}>{t}</Text>
              {on&&<View style={sc.tabLine}/>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tag actif */}
      {filterTag&&(
        <TouchableOpacity onPress={()=>setFilterTag(null)} style={sc.tagBanner} activeOpacity={0.80}>
          <Ionicons name="pricetag-outline" size={10} color={C.blue}/>
          <Text style={{color:C.blue,fontSize:11,fontWeight:'700'}}>#{filterTag}</Text>
          <Ionicons name="close-circle" size={12} color={C.blue}/>
        </TouchableOpacity>
      )}

      {tab==='Pour vous'&&<NetworkRow pros={pros} loading={prosLoading} onIndustry={()=>setShowIndustry(true)}/>}
      <TopBanner critique={top}/>

      <View style={{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:EDGE,marginBottom:11}}>
        <Ionicons name={tab==='Tendances'?'flame-outline':'create-outline'} size={12} color={C.mid}/>
        <Text style={{color:C.offWhite,fontSize:14,fontWeight:'800'}}>
          {tab==='Tendances'?'Critiques les plus appréciées':'Critiques récentes'}
        </Text>
        <View style={{paddingHorizontal:6,paddingVertical:1.5,borderRadius:6,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
          <Text style={{color:C.muted,fontSize:8,fontWeight:'700'}}>{displayed.length}</Text>
        </View>
      </View>
    </View>
  );

  if(showIndustry){
    return(
      <View style={{flex:1,backgroundColor:C.bg}}>
        <StatusBar style="light"/>
        <SafeAreaView style={{flex:1}} edges={['top']}>
          <IndustrieScreen userId={userId} onBack={()=>setShowIndustry(false)}/>
        </SafeAreaView>
      </View>
    );
  }

  return(
    <View style={sc.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          // ★ paddingBottom réduit — plus de grand vide au-dessus de la CustomNavBar
          contentContainerStyle={{paddingBottom:86}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.mid}/>}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            loading
              ? <View style={{alignItems:'center',paddingVertical:50,gap:12}}>
                  <ActivityIndicator color={C.mid} size="large"/>
                  <Text style={{color:C.muted,fontSize:12}}>Chargement des critiques…</Text>
                </View>
              : <View style={{alignItems:'center',paddingVertical:44,gap:10}}>
                  <View style={{width:54,height:54,borderRadius:27,backgroundColor:C.faint,alignItems:'center',justifyContent:'center',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
                    <Ionicons name="create-outline" size={25} color={C.muted}/>
                  </View>
                  <Text style={{color:C.muted,fontSize:13,fontWeight:'700'}}>Aucune critique</Text>
                  <Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingHorizontal:40,lineHeight:16}}>
                    {filterTag ? `Aucune critique pour #${filterTag}` : 'Soyez le premier !'}
                  </Text>
                  {filterTag&&(
                    <TouchableOpacity
                      onPress={()=>setFilterTag(null)}
                      style={{paddingHorizontal:14,paddingVertical:7,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint}}
                    >
                      <Text style={{color:C.blue,fontSize:12,fontWeight:'700'}}>Toutes les critiques</Text>
                    </TouchableOpacity>
                  )}
                </View>
          }
          removeClippedSubviews
          windowSize={7}
          maxToRenderPerBatch={5}
          initialNumToRender={5}
        />
      </SafeAreaView>
    </View>
  );
}

const sc=StyleSheet.create({
  root:       {flex:1,backgroundColor:C.bg},
  header:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:EDGE,paddingTop:9,paddingBottom:13},
  eyebrow:    {fontSize:8,fontWeight:'700',color:C.muted,letterSpacing:1.8},
  title:      {fontSize:22,fontWeight:'900',color:C.white,letterSpacing:-0.5},
  iconBtn:    {width:36,height:36,borderRadius:18,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',position:'relative'},
  notifDot:   {position:'absolute',top:7,right:7,width:5,height:5,borderRadius:2.5,backgroundColor:C.white,borderWidth:1,borderColor:C.bg},
  tabs:       {flexDirection:'row',paddingHorizontal:EDGE,gap:18,marginBottom:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  tab:        {paddingBottom:11,alignItems:'center',position:'relative'},
  tabTxt:     {color:C.muted,fontSize:12,fontWeight:'600'},
  tabTxtOn:   {color:C.white,fontWeight:'800'},
  tabLine:    {position:'absolute',bottom:0,left:0,right:0,height:2,borderRadius:1,backgroundColor:C.white},
  tagBanner:  {flexDirection:'row',alignItems:'center',gap:5,alignSelf:'flex-start',marginHorizontal:EDGE,marginBottom:11,paddingHorizontal:11,paddingVertical:5,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint},
});