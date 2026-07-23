import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  View, Text, StyleSheet, Image, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Platform,
  ScrollView, TextInput, Alert, Share, Animated, Dimensions,
  Easing, Linking,
} from 'react-native';
import { SafeAreaView }   from 'react-native-safe-area-context';
import { StatusBar }      from 'expo-status-bar';
import { Ionicons }       from '@expo/vector-icons';
import { router, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView }       from 'expo-blur';
import { supabase }       from '@/lib/supabase';
import { getDeviceId }    from '@/services/api';
import GalaxyBackground   from '@/components/shared/GalaxyBackground';
import IndustrieScreen    from '@/components/social/IndustrieScreen';

let _Haptics: any = null;
if (Platform.OS !== 'web') { try { _Haptics = require('expo-haptics'); } catch {} }
const hapticLight  = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Light).catch(()=>{});
const hapticMedium = () => _Haptics?.impactAsync?.(_Haptics.ImpactFeedbackStyle?.Medium).catch(()=>{});

const { width: W } = Dimensions.get('window');
const EDGE = 18;
const H_PAD = 20;

// ─── PALETTE (identique au fichier original) ──────────────────────────────────
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
  // AJOUT couleur level badge uniquement
  violet:'#A78BFA', violetFt:'rgba(167,139,250,0.10)', violetBd:'rgba(167,139,250,0.25)',
} as const;

// ─── TYPES (identiques au fichier original) ───────────────────────────────────
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

// AJOUT types réseau social
interface SocialUser {
  device_id:string; pseudo:string; avatar_url:string|null;
  level:number; xp:number;
  followers_count:number; following_count:number; works_count:number;
  is_following?:boolean; last_active?:string;
}
interface ActivityItem {
  id:string; type:'like'|'follow'|'critique'|'achievement';
  actor_device_id:string; actor_pseudo:string; actor_avatar:string|null;
  actor_level:number; target_title?:string; created_at:string;
}

const LEVEL_NAMES:Record<number,string> = {
  1:'Météorite',2:'Étoile Filante',3:'Nébuleuse',4:'Géante Rouge',
  5:'Supernova',6:'Trou Noir',7:'Quasar',8:'Singularité',
};

// ─── HELPERS (identiques au fichier original) ─────────────────────────────────
const fmtK = (n:number) => n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
function timeAgo(d:string) {
  const m = Math.floor((Date.now()-new Date(d).getTime())/60000);
  if(m<1)return"à l'instant"; if(m<60)return`il y a ${m} min`;
  const h=Math.floor(m/60); if(h<24)return`il y a ${h}h`;
  const dd=Math.floor(h/24); if(dd<7)return`il y a ${dd}j`;
  return new Date(d).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'});
}
// ★ FIX: Never fall back to external random avatars — use consistent initials-based placeholder
// ★ FIX: Consistent avatar helper — never use external random avatars
const av = (uid:string, url?:string|null): string|undefined => url ?? undefined;

// ─── ★ HOOK CRITIQUES — identique au fichier original ────────────────────────
function useCritiques(tab: FeedTab, userId: string) {
  const [items,   setItems]   = useState<Critique[]>([]);
  const [loading, setLoading] = useState(true);
  const [rk,      setRk]      = useState(0);
  const refresh = useCallback(()=>setRk(k=>k+1),[]);

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
  
        // ✅ enlève null/undefined avant le .in(...) pour éviter le 400
        const uids=[...new Set(rows.map(r=>r.user_id).filter((id): id is string => !!id))];
  
        const pm:Record<string,any>={};
        if (uids.length > 0) {
          const { data:profiles } = await supabase
            .from('profiles')
            .select('id,display_name,avatar_url')
            .in('id',uids);
  
          (profiles??[]).forEach((p:any)=>{pm[p.id]=p;});
        }
  
        const{data:liked}=await supabase.from('critique_likes').select('critique_id').eq('user_id',userId);
        const likedSet=new Set((liked??[]).map((r:any)=>r.critique_id));
  
        if(!dead){
          setItems(rows.map(r=>({
            ...r,
            profile:pm[r.user_id as string],
            is_liked:likedSet.has(r.id),
            comments:[],
            show_comments:false,
            shares_count:0,
          })));
          setLoading(false);
        }
      })
      .catch(()=>{if(!dead)setLoading(false);});
  
    return()=>{dead=true;};
  },[tab,userId,rk]);

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

  const toggleLike = useCallback(async(id:string)=>{
    hapticLight();
    setItems(prev=>prev.map(c=>{
      if(c.id!==id) return c;
      const liked = !c.is_liked;
      if(liked){
        supabase.from('critique_likes').upsert({user_id:userId,critique_id:id},{onConflict:'user_id,critique_id'}).then(()=>{},()=>{});
        supabase.from('critiques').update({likes_count:c.likes_count+1}).eq('id',id).then(()=>{},()=>{});
      } else {
        supabase.from('critique_likes').delete().eq('user_id',userId).eq('critique_id',id).then(()=>{},()=>{});
        supabase.from('critiques').update({likes_count:Math.max(0,c.likes_count-1)}).eq('id',id).then(()=>{},()=>{});
      }
      return{...c,is_liked:liked,likes_count:c.likes_count+(liked?1:-1)};
    }));
  },[userId]);

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

  const expandComment = useCallback((critiqueId:string, commentId:string)=>{
    setItems(prev=>prev.map(c=>{
      if(c.id!==critiqueId) return c;
      return{...c,comments:(c.comments??[]).map(cm=>cm.id===commentId?{...cm,expanded:!cm.expanded}:cm)};
    }));
  },[]);

  const shareCritique = useCallback((critique:Critique)=>{
    const msg = `"${critique.title}" — ${critique.film_title}\n\n${critique.content.slice(0,160)}…\n\nUniverse · Cinéma indépendant`;
    const doShare = async () => {
      try {
        if(Platform.OS!=='web'){
          await Share.share({message:msg,title:critique.title});
        } else if(typeof navigator!=='undefined'&&(navigator as any).share){
          await (navigator as any).share({title:critique.title,text:msg});
        } else {
          await (navigator as any).clipboard.writeText(msg);
          Alert.alert('Copié !','Critique copiée dans le presse-papier.');
        }
        supabase.from('critique_shares').insert({
          critique_id:critique.id, user_id:userId,
          platform:Platform.OS==='web'?'web':'native',
        }).then(()=>{},()=>{});
        setItems(prev=>prev.map(c=>c.id===critique.id?{...c,shares_count:(c.shares_count??0)+1}:c));
      } catch(e:any){
        if(e?.message?.includes('cancel')) return;
        console.warn('[Social] share:', e?.message);
      }
    };
    const doInstagram = () => {
      if(Platform.OS==='web'){
        if(typeof navigator!=='undefined'&&(navigator as any).clipboard){
          (navigator as any).clipboard.writeText(msg).then(
            ()=>Alert.alert('Copié !','Ouvrez Instagram et collez dans votre Story.'),
            ()=>{},
          );
        }
      } else {
        Linking.canOpenURL('instagram://app').then(
          (can)=>{
            if(can){
              Linking.openURL('instagram://app').then(()=>{},()=>{});
              setTimeout(()=>Alert.alert('Instagram ouvert 📸','Collez dans votre Story :\n\n'+msg.slice(0,100)+'…'),800);
            } else {
              Share.share({message:msg,title:critique.title}).then(()=>{},()=>{});
            }
          },
          ()=>Share.share({message:msg}).then(()=>{},()=>{}),
        );
      }
    };
    Alert.alert(
      'Partager la critique',
      `"${critique.title}"`,
      [
        {text:'Partager',onPress:doShare},
        {text:'Story Instagram 📸',onPress:doInstagram},
        {text:'Annuler',style:'cancel'},
      ],
    );
  },[userId]);

  const shareComment = useCallback(async(critique:Critique, comment:Comment)=>{
    const msg = `${comment.profile?.display_name??'Un cinéphile'} sur "${critique.film_title}" :\n\n"${comment.content}"\n\nUniverse · Cinéma indépendant`;
    try {
      if(Platform.OS!=='web') await Share.share({message:msg});
      else if(typeof navigator!=='undefined'&&(navigator as any).share) await (navigator as any).share({text:msg});
      else { await (navigator as any).clipboard.writeText(msg); Alert.alert('Copié !','Commentaire copié.'); }
    } catch{}
  },[]);

  const addComment = useCallback(async(critiqueId:string,text:string)=>{
    if(!text.trim()) return;
    // ★ FIX: Block comment if user has no avatar (identity verification)
    const{data:profileCheck}=await supabase.from('profiles').select('avatar_url').eq('id',userId).maybeSingle();
    if(!profileCheck?.avatar_url){
      Alert.alert('Photo requise','Ajoutez une photo de profil pour commenter — votre identité visuelle est essentielle à la communauté.');
      return;
    }
    hapticMedium();
    const{data,error}=await supabase.from('critique_comments')
      .insert({critique_id:critiqueId,user_id:userId,content:text.trim()})
      .select('id,critique_id,user_id,content,created_at').single();
    if(error||!data){
      console.error('[Social] addComment:', error?.message);
      Alert.alert('Erreur','Impossible d\'ajouter le commentaire. Vérifie que universe_setup.sql a été exécuté.');
      return;
    }
    // ★ FIX: Always fetch fresh profile data for the comment author
    const{data:p}=await supabase.from('profiles').select('id,display_name,avatar_url').eq('id',userId).maybeSingle();
    const newCm:Comment={...(data as Comment),profile:p??undefined,expanded:false};
    setItems(prev=>prev.map(c=>c.id===critiqueId?{...c,comments:[...(c.comments??[]),newCm]}:c));
    // ★ FIX: Also refresh the critique author's profile in case it changed
    setItems(prev=>prev.map(c=>{
      if(c.id!==critiqueId) return c;
      // If the commenter is also the critique author, update the profile
      if(c.user_id===userId && p) {
        return {...c, profile: { display_name: p.display_name, avatar_url: p.avatar_url }};
      }
      return c;
    }));
  },[userId]);

  return{items,loading,refresh,toggleLike,toggleComments,expandComment,shareCritique,shareComment,addComment};
}

// ─── HOOK NETWORK (identique au fichier original) ─────────────────────────────
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

// AJOUT hook réseau social (membres actifs + suggestions + activité)
function useSocialNetwork(myId:string){
  const[members,setMembers]=useState<SocialUser[]>([]);
  const[suggestions,setSuggestions]=useState<SocialUser[]>([]);
  const[activity,setActivity]=useState<ActivityItem[]>([]);
  useEffect(()=>{
    if(!myId) return;
    // ★ FIX: Query 'profiles' table instead of 'users'
    supabase.from('profiles')
      .select('id,display_name,avatar_url,username,location,website,is_pro,is_industry_contact,specialties,open_to,notable_works,equipment,social_instagram,social_vimeo,social_youtube,social_imdb,films_seen_count,following_count')
      .neq('id',myId).order('id',{ascending:false}).limit(18)
      .then(({data})=>{
        const mapped = (data ?? []).map((p: any) => ({
          device_id: p.id,
          pseudo: p.display_name || p.username || 'Cinéphile',
          avatar_url: p.avatar_url,
          level: 1,
          xp: 0,
          followers_count: p.following_count ?? 0,
          following_count: 0,
          works_count: p.films_seen_count ?? 0,
        })) as SocialUser[];
        setMembers(mapped);
      });
    supabase.rpc('get_user_suggestions',{viewer_id:myId}).limit(8)
      .then(({data})=>setSuggestions((data??[]) as SocialUser[]));
    supabase.from('social_activity').select('*')
      .order('created_at',{ascending:false}).limit(30)
      .then(({data})=>setActivity((data??[]) as ActivityItem[]));
  },[myId]);
  return{members,suggestions,activity};
}

// ─── STAR RATING (identique) ─────────────────────────────────────────────────
const Stars = memo(({r}:{r:number|null})=>{
  if(!r) return null;
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:2}}>
      {[1,2,3,4,5].map(i=><Ionicons key={i} name={i<=Math.round(r)?'star':'star-outline'} size={10} color={i<=r?C.gold:C.muted}/>)}
      <Text style={{color:C.gold,fontSize:10,fontWeight:'700',marginLeft:2}}>{r.toFixed(1)}</Text>
    </View>
  );
});

// ─── COMMENT INPUT (identique) ────────────────────────────────────────────────
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
// ★★★ SEULE MODIFICATION PAR RAPPORT AU FICHIER ORIGINAL :
//      onAvatarPress prop ajouté — l'avatar ET le pseudo sont maintenant cliquables
const CritiqueCard = memo(function CritiqueCard({
  item, userId,
  onLike, onComments, onExpandComment, onTag, onShare, onShareComment, onAddComment,
  onAvatarPress, // ← AJOUT
}:{
  item:Critique; userId:string;
  onLike:(id:string)=>void;
  onComments:(id:string)=>void;
  onExpandComment:(critiqueId:string,commentId:string)=>void;
  onTag:(t:string)=>void;
  onShare:(c:Critique)=>void;
  onShareComment:(c:Critique,cm:Comment)=>void;
  onAddComment:(id:string,text:string)=>void;
  onAvatarPress:(userId:string, displayName:string)=>void; // ← AJOUT
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

      {/* Header — avatar + pseudo maintenant cliquables */}
      <View style={crd.header}>
        {/* ★ AJOUT : TouchableOpacity wrappant l'avatar + nom d'auteur */}
        <TouchableOpacity
          style={crd.authorRow}
          activeOpacity={0.80}
          onPress={()=>onAvatarPress(item.user_id, dn)}
        >
          {avUri
            ? <Image source={{uri:avUri}} style={crd.avatar}/>
            : <View style={[crd.avatar,{backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'}]}><Text style={{color:C.mid,fontSize:12,fontWeight:'800'}}>{dn.slice(0,2).toUpperCase()}</Text></View>
          }
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

      {/* Actions */}
      <View style={crd.actions}>
        <TouchableOpacity onPress={handleLike} style={[crd.actionBtn, item.is_liked&&crd.actionBtnLiked]} activeOpacity={0.80}>
          <Animated.View style={{transform:[{scale:likeAnim}]}}>
            <Ionicons name={item.is_liked?'heart':'heart-outline'} size={16} color={item.is_liked?C.red:C.muted}/>
          </Animated.View>
          <Text style={[crd.actionTxt,item.is_liked&&{color:C.red,fontWeight:'700'}]}>
            {fmtK(item.likes_count??0)}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={()=>onComments(item.id)} style={[crd.actionBtn,item.show_comments&&crd.actionBtnActive]} activeOpacity={0.80}>
          <Ionicons name={item.show_comments?'chatbubble':'chatbubble-outline'} size={15} color={item.show_comments?C.blue:C.muted}/>
          <Text style={[crd.actionTxt,item.show_comments&&{color:C.blue,fontWeight:'700'}]}>
            {cmCount>0?fmtK(cmCount):'Commenter'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={()=>onShare(item)} style={crd.actionBtn} activeOpacity={0.80}>
          <Ionicons name="share-social-outline" size={15} color={C.muted}/>
          <Text style={crd.actionTxt}>{shareCount>0?fmtK(shareCount)+' ':''}</Text>
          <Text style={crd.actionTxt}>Partager</Text>
        </TouchableOpacity>
      </View>

      {/* Section commentaires */}
      {item.show_comments&&(
        <View style={crd.commentsWrap}>
          {(item.comments??[]).length===0&&(
            <Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingVertical:12}}>
              Soyez le premier à commenter
            </Text>
          )}
          {(item.comments??[]).map(cm=>(
            <View key={cm.id} style={crd.cmRow}>
              {/* ★ AJOUT : avatar du commentateur cliquable */}
              <TouchableOpacity onPress={()=>onAvatarPress(cm.user_id, cm.profile?.display_name??'Cinéphile')}>
                {av(cm.user_id,cm.profile?.avatar_url)
                  ? <Image source={{uri:av(cm.user_id,cm.profile?.avatar_url)}} style={crd.cmAvatar}/>
                  : <View style={[crd.cmAvatar,{backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'}]}><Text style={{color:C.mid,fontSize:9,fontWeight:'800'}}>{(cm.profile?.display_name??'?').slice(0,1).toUpperCase()}</Text></View>
                }
              </TouchableOpacity>
              <View style={crd.cmBody}>
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  {/* ★ AJOUT : pseudo cliquable */}
                  <TouchableOpacity onPress={()=>onAvatarPress(cm.user_id, cm.profile?.display_name??'Cinéphile')}>
                    <Text style={crd.cmAuthor}>{cm.profile?.display_name??'Cinéphile'}</Text>
                  </TouchableOpacity>
                  <Text style={crd.cmDate}>{timeAgo(cm.created_at)}</Text>
                  <TouchableOpacity onPress={()=>onShareComment(item,cm)} hitSlop={6} style={{marginLeft:'auto' as any}}>
                    <Ionicons name="share-outline" size={11} color="rgba(255,255,255,0.25)"/>
                  </TouchableOpacity>
                </View>
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

// ─── TOP CRITIQUE BANNER (identique au fichier original) ─────────────────────
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


const nr=StyleSheet.create({
  card:   {width:122,height:152,borderRadius:13,overflow:'hidden',backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  img:    {width:'100%',height:'100%',position:'absolute'},
  vBadge: {position:'absolute',top:7,right:7,width:16,height:16,borderRadius:8,backgroundColor:'rgba(7,12,23,0.75)',borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
  info:   {position:'absolute',bottom:0,left:0,right:0,padding:9,gap:1},
  name:   {color:C.white,fontSize:10,fontWeight:'800'},
  role:   {color:C.muted,fontSize:8.5},
});

// ─── Strip membres actifs — aura dorée animée ─────────────────────────────────
const AvatarWithAura = memo(function AvatarWithAura({u,onPress}:{u:SocialUser;onPress:()=>void}) {
  const glowOp = useRef(new Animated.Value(0.26)).current;
  useEffect(()=>{
    const l = Animated.loop(Animated.sequence([
      Animated.timing(glowOp,{toValue:0.95,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
      Animated.timing(glowOp,{toValue:0.26,duration:2600,easing:Easing.inOut(Easing.ease),useNativeDriver:true}),
    ]));
    l.start();
    return ()=>l.stop();
  },[glowOp]);
  const glowStyle:any = {
    position:'absolute',top:-4,bottom:-4,left:-4,right:-4,borderRadius:30,
    ...(Platform.OS==='web'
      ?{boxShadow:'0 0 18px 6px rgba(245, 200, 66, 0), 0 0 7px 2px rgba(245, 200, 66, 0)'}
      :{shadowColor:C.gold,shadowOffset:{width:0,height:0},shadowOpacity:0.82,shadowRadius:14,elevation:8}),
  };
  return(
    <TouchableOpacity style={{alignItems:'center',gap:4,width:60}} onPress={onPress} activeOpacity={0.75}>
      <View style={{position:'relative',width:52,height:52}}>
        <Animated.View style={[glowStyle,{opacity:glowOp}]} pointerEvents="none"/>
        <Image source={{uri:u.avatar_url??undefined}} style={{width:52,height:52,borderRadius:26,borderWidth:2,borderColor:C.gold}}/>
      </View>
      <Text style={strip.pseudo} numberOfLines={1}>{u.pseudo}</Text>
    </TouchableOpacity>
  );
});
const ActiveStrip = memo(({users,onPress}:{users:SocialUser[];onPress:(u:SocialUser)=>void})=>(
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={{paddingHorizontal:EDGE,gap:14}}
    style={{marginBottom:4}}>
    {users.map(u=>(
      <AvatarWithAura key={u.device_id} u={u} onPress={()=>onPress(u)}/>
    ))}
  </ScrollView>
));
const strip=StyleSheet.create({
  pseudo:{fontSize:10,color:C.mid,textAlign:'center',maxWidth:60},
});

// ─── AJOUT: Suggestion card ───────────────────────────────────────────────────
const SuggestionCard = memo(({user,onFollow,onPress}:{user:SocialUser;onFollow:(u:SocialUser)=>void;onPress:(u:SocialUser)=>void})=>{
  const[following,setFollowing]=useState(user.is_following??false);
  return(
    <TouchableOpacity style={sg.card} onPress={()=>onPress(user)} activeOpacity={0.80}>
      <Image source={{uri:user.avatar_url ?? undefined}} style={sg.avatar}/>
      <View style={sg.lvBadge}><Text style={sg.lvTxt}>{user.level}</Text></View>
      <Text style={sg.pseudo} numberOfLines={1}>{user.pseudo}</Text>
      <Text style={sg.levelName} numberOfLines={1}>{LEVEL_NAMES[user.level]??'Explorateur'}</Text>
      <Text style={sg.stat}>{user.works_count} œuvres</Text>
      <TouchableOpacity
        style={[sg.followBtn,following&&sg.followBtnOn]}
        onPress={()=>{hapticLight();setFollowing(f=>!f);onFollow(user);}}
      >
        <Text style={[sg.followTxt,following&&sg.followTxtOn]}>{following?'Suivi ✓':'Suivre'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});
const sg=StyleSheet.create({
  card:       {width:124,backgroundColor:C.faint,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:12,alignItems:'center',gap:3,position:'relative'},
  avatar:     {width:52,height:52,borderRadius:26,marginBottom:3},
  lvBadge:    {position:'absolute',top:8,right:8,paddingHorizontal:5,paddingVertical:2,borderRadius:7,backgroundColor:C.navyLow,borderWidth:1,borderColor:C.violetBd},
  lvTxt:      {fontSize:8,fontWeight:'800',color:C.violet},
  pseudo:     {fontSize:12,fontWeight:'700',color:C.offWhite,textAlign:'center'},
  levelName:  {fontSize:9,color:C.muted,textAlign:'center'},
  stat:       {fontSize:9,color:C.subtle},
  followBtn:  {marginTop:5,paddingHorizontal:14,paddingVertical:5,borderRadius:50,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder},
  followBtnOn:{backgroundColor:C.blueFaint},
  followTxt:  {fontSize:10,fontWeight:'600',color:C.blue},
  followTxtOn:{color:C.blue},
});

// ─── AJOUT: Activity row ──────────────────────────────────────────────────────
const ActivityRow = memo(({item,onAvatarPress}:{item:ActivityItem;onAvatarPress:(id:string,pseudo:string)=>void})=>{
  const iconMap={like:{n:'heart',c:C.red},follow:{n:'person-add',c:C.blue},critique:{n:'star',c:C.gold},achievement:{n:'trophy',c:C.gold}};
  const ic=iconMap[item.type]??{n:'ellipse',c:C.muted};
  const labels={like:`a aimé ${item.target_title??'une œuvre'}`,follow:'vous suit',critique:`a critiqué ${item.target_title??'une œuvre'}`,achievement:'a débloqué un badge'};
  return(
    <View style={acRow.row}>
      <TouchableOpacity onPress={()=>onAvatarPress(item.actor_device_id,item.actor_pseudo)} activeOpacity={0.75}>
        <Image source={{uri:item.actor_avatar ?? undefined}} style={acRow.avatar}/>
      </TouchableOpacity>
      <View style={{flex:1}}>
        <Text style={acRow.text} numberOfLines={2}>
          <Text style={{fontWeight:'700',color:C.offWhite}}>{item.actor_pseudo} </Text>
          {labels[item.type]}
        </Text>
        <Text style={acRow.time}>{timeAgo(item.created_at)}</Text>
      </View>
      <View style={[acRow.icon,{backgroundColor:ic.c+'18'}]}>
        <Ionicons name={ic.n as any} size={13} color={ic.c}/>
      </View>
    </View>
  );
});
const acRow=StyleSheet.create({
  row:    {flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:EDGE,paddingVertical:11,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  avatar: {width:38,height:38,borderRadius:19},
  text:   {fontSize:12,color:C.mid,lineHeight:17},
  time:   {fontSize:10,color:C.muted,marginTop:2},
  icon:   {width:28,height:28,borderRadius:14,alignItems:'center',justifyContent:'center'},
});

// ═════════════════════════════════════════════════════════════════════════════
// ★★★ SCREEN — identique au fichier original + goToUserProfile injecté
// ═════════════════════════════════════════════════════════════════════════════
export default function SocialScreen() {
  const router        = useRouter();
  const[tab,setTab]   = useState<FeedTab>('Pour vous');
  const[showIndustry, setShowIndustry] = useState(false);
  const[userId,       setUserId]       = useState('');
  const[refreshing,   setRefreshing]   = useState(false);
  const[filterTag,    setFilterTag]    = useState<string|null>(null);
  const listRef = useRef<FlatList<Critique>>(null);

  useEffect(()=>{
    getDeviceId().then(id => setUserId(id));
  },[]);

  const {items,loading,refresh,toggleLike,toggleComments,expandComment,shareCritique,shareComment,addComment} =
    useCritiques(tab, userId);
  const {pros, loading:prosLoading} = useNetworkActivity();
  // AJOUT réseau social
  const {members,suggestions,activity} = useSocialNetwork(userId);

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

  // ★ AJOUT: navigation vers UserProfile
  const goToUserProfile = useCallback((targetUserId:string, displayName:string)=>{
    hapticLight();
    router.push({
      pathname:'/(tabs)/UserProfile',
      params:{ deviceId:targetUserId, pseudo:displayName },
    });
  },[router]);

  // AJOUT follow handler
  const handleFollow = useCallback(async(u:SocialUser)=>{
    const alr=u.is_following;
    if(alr){
      await supabase.from('follows').delete().eq('follower_id',userId).eq('following_id',u.device_id);
    } else {
      await supabase.from('follows').upsert({follower_id:userId,following_id:u.device_id});
    }
  },[userId]);

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
      onAvatarPress={goToUserProfile}  // ← AJOUT
    />
  ),[userId,toggleLike,toggleComments,expandComment,handleTag,shareCritique,shareComment,handleAddComment,goToUserProfile]);

  const keyExtractor = useCallback((item:Critique)=>item.id,[]);

  const ListHeader = (
    <View>
      {/* ── Header UNIVERSE · CINÉMA INDÉPENDANT (identique au fichier original) ── */}
      <View style={sc.header}>
        <View style={{gap:1}}>
          <Text style={sc.eyebrow}>UNIVERSE · CINÉMA INDÉPENDANT</Text>
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

      {/* AJOUT: Strip membres actifs */}
      {members.length>0&&(
        <View style={{marginBottom:14}}>
          <Text style={sc.sectionLbl}>Membres actifs</Text>
          <ActiveStrip users={members} onPress={u=>goToUserProfile(u.device_id,u.pseudo)}/>
        </View>
      )}

      {/* AJOUT: Suggestions */}
      {suggestions.length>0&&(
        <View style={{marginBottom:14}}>
          <Text style={sc.sectionLbl}>Découvrir</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{paddingHorizontal:EDGE,gap:9}}>
            {suggestions.map(u=>(
              <SuggestionCard key={u.device_id} user={u}
                onFollow={handleFollow}
                onPress={u2=>goToUserProfile(u2.device_id,u2.pseudo)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Tabs (identiques au fichier original + tab Activité) */}
      <View style={sc.tabs}>
        {(['Pour vous','Tendances'] as FeedTab[]).map(t=>{
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
  header:     {flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingHorizontal:H_PAD,paddingTop:6,paddingBottom:12},
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
  sectionLbl: {fontSize:12,fontWeight:'700',color:C.offWhite,paddingHorizontal:EDGE,marginBottom:9},
});