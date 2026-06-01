/**
 * components/social/IndustrieScreen.tsx — UNIVERSE
 *
 * ★ Professionals depuis public.professionals classés par rôle/catégorie
 * ★ Demande de connexion enrichie (message, projet, budget, timeline, portfolio)
 * ★ Onglets : Annuaire / Reçues / Connexions
 * ★ Séparé de social.tsx pour alléger le bundle
 */
import React, {
    useMemo, memo, useCallback, useEffect, useRef, useState,
  } from 'react';
  import {
    View, Text, StyleSheet, Image, FlatList, ScrollView,
    TouchableOpacity, TextInput, ActivityIndicator, Modal,
    Pressable, KeyboardAvoidingView, Alert, Linking, Platform, Animated,
  } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { Ionicons }   from '@expo/vector-icons';
  import { BlurView }   from 'expo-blur';
  import * as Haptics   from 'expo-haptics';
  import { supabase }   from '@/lib/supabase';
  import GalaxyBackground from '@/components/social/GalaxyBackground';
  
  const EDGE = 18;
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
  
  const { width: W } = require('react-native').Dimensions.get('window');
  
  // ─── TYPES ────────────────────────────────────────────────────────────────────
  // Schéma exact de public.professionals
  interface Pro {
    id:string; user_id:string|null; name:string; role:string; avatar:string|null;
    bio:string|null; long_bio:string|null; films:string[]; location:string|null;
    contact_email:string|null; website:string|null; verified:boolean;
    open_to:string[]; specialties:string[]|null; years_experience:number|null;
    is_active:boolean|null; created_at:string;
  }
  interface ProConnection {
    id:string; pro_id:string; requester_id:string;
    status:'pending'|'accepted'|'rejected'|'withdrawn';
    message:string|null; project_type:string|null; looking_for:string|null;
    budget_range:string|null; timeline:string|null; portfolio_url:string|null;
    created_at:string; updated_at:string;
    requester?:{ display_name:string; avatar_url:string|null };
  }
  type ConnStatus = 'none'|'pending'|'accepted'|'rejected'|'withdrawn';
  type IndTab = 'Annuaire'|'Reçues'|'Connexions';
  
  const IND_TABS: IndTab[] = ['Annuaire','Reçues','Connexions'];
  const PRO_ROLES = ['Tous','Réalisateur·ice','Producteur·ice','Acteur·ice','Scénariste','Dir. photo','Compositeur·ice','Monteur·euse'] as const;
  const PROJECT_TYPES  = ['Court-métrage','Long-métrage','Série','Documentaire','Clip musical','Publicité','Websérie'];
  const BUDGET_RANGES  = ['< 5 000€','5 000–20 000€','20 000–100 000€','100 000–500 000€','> 500 000€','À définir'];
  const TIMELINE_OPTS  = ['Immédiat','1–3 mois','3–6 mois','6–12 mois','+1 an','À définir'];
  
  // ─── HELPERS ──────────────────────────────────────────────────────────────────
  const fmtK=(n:number)=>n>=1e3?`${(n/1e3).toFixed(1)}K`:`${n}`;
  function timeAgo(d:string){
    const m=Math.floor((Date.now()-new Date(d).getTime())/60000);
    if(m<1)return'à l\'instant';if(m<60)return`${m} min`;
    const h=Math.floor(m/60);if(h<24)return`${h}h`;
    return`${Math.floor(h/24)}j`;
  }
  const av=(uid:string,url?:string|null)=>url??`https://i.pravatar.cc/80?u=${uid}`;
  
  // ─── HOOKS ────────────────────────────────────────────────────────────────────
  function useProDirectory(search:string,role:string){
    const[pros,setPros]=useState<Pro[]>([]);
    const[byRole,setByRole]=useState<Record<string,Pro[]>>({});
    const[loading,setLoading]=useState(true);
    const[error,setError]=useState<string|null>(null);
  
    const load=useCallback(async()=>{
      setLoading(true);setError(null);
      try{
        // SELECT explicite sur colonnes existantes uniquement (évite 400 bad request)
        let q=supabase.from('professionals')
          .select('id,user_id,name,role,avatar,bio,long_bio,films,location,contact_email,website,verified,open_to,specialties,years_experience,is_active,created_at')
          .eq('is_active',true)
          .order('verified',{ascending:false})
          .order('name',{ascending:true})
          .limit(100);
        if(role&&role!=='Tous') q=q.eq('role',role);
        if(search.trim()) q=q.ilike('name',`%${search.trim()}%`);
        const{data,error:err}=await q;
        if(err) throw err;
        const list=(data??[]) as Pro[];
        setPros(list);
        // Grouper par rôle
        const grouped:Record<string,Pro[]>={};
        list.forEach(p=>{
          const r=p.role||'Autre';
          if(!grouped[r]) grouped[r]=[];
          grouped[r].push(p);
        });
        setByRole(grouped);
      }catch{ setError('Impossible de charger le répertoire.'); }
      finally{ setLoading(false); }
    },[search,role]);
  
    useEffect(()=>{load();},[load]);
    return{pros,byRole,loading,error,refresh:load};
  }
  
  function useConnections(userId:string){
    const[conns,setConns]=useState<Record<string,ConnStatus>>({});
    const[accepted,setAccepted]=useState<Pro[]>([]);
  
    useEffect(()=>{
      if(!userId||userId==='anonymous') return;
      supabase.from('pro_connections').select('pro_id,status').eq('requester_id',userId)
        .then(async({data})=>{
          const m:Record<string,ConnStatus>={};
          (data??[]).forEach((r:any)=>{m[r.pro_id]=r.status;});
          setConns(m);
          const ids=(data??[]).filter((r:any)=>r.status==='accepted').map((r:any)=>r.pro_id);
          if(ids.length){
            const{data:ps}=await supabase.from('professionals').select('id,user_id,name,role,avatar,bio,long_bio,films,location,contact_email,website,verified,open_to,specialties,years_experience,is_active,created_at').in('id',ids);
            setAccepted((ps??[]) as Pro[]);
          }
        });
      const ch=supabase.channel(`conn_${userId}_${Date.now()}`)
        .on('postgres_changes',{event:'*',schema:'public',table:'pro_connections'},({new:row})=>{
          const r=row as any;
          if(r.requester_id===userId) setConns(p=>({...p,[r.pro_id]:r.status}));
        }).subscribe();
      return()=>{supabase.removeChannel(ch);};
    },[userId]);
  
    const setStatus=useCallback((pid:string,s:ConnStatus)=>setConns(p=>({...p,[pid]:s})),[]);
    return{conns,setStatus,accepted};
  }
  
  function useIncoming(userId:string){
    const[reqs,setReqs]=useState<ProConnection[]>([]);
    const load=useCallback(async()=>{
      if(!userId||userId==='anonymous') return;
      const{data:myPro}=await supabase.from('professionals').select('id').eq('user_id',userId).maybeSingle();
      if(!myPro) return;
      const{data}=await supabase.from('pro_connections').select('*').eq('pro_id',myPro.id)
        .order('created_at',{ascending:false}).limit(50);
      if(data?.length){
        const enriched=await Promise.all((data as ProConnection[]).map(async c=>{
          const{data:p}=await supabase.from('profiles').select('display_name,avatar_url')
            .eq('id',c.requester_id).maybeSingle();
          return{...c,requester:p??undefined};
        }));
        setReqs(enriched);
      }
    },[userId]);
    useEffect(()=>{load();},[load]);
    return{reqs,reload:load};
  }
  
  // ─── PILL SELECTOR ────────────────────────────────────────────────────────────
  const Pills=memo(({opts,val,on}:{opts:string[];val:string;on:(v:string)=>void})=>(
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7,paddingVertical:4}}>
      {opts.map(o=>{const active=val===o;return(
        <TouchableOpacity key={o} style={[ps.pill,active&&ps.pillOn]} onPress={()=>on(o)} activeOpacity={0.8}>
          <Text style={[ps.pillTxt,active&&ps.pillTxtOn]}>{o}</Text>
        </TouchableOpacity>
      );})}
    </ScrollView>
  ));
  const ps=StyleSheet.create({
    pill:{paddingHorizontal:12,paddingVertical:6,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
    pillOn:{borderColor:C.blueBorder,backgroundColor:C.blueFaint},
    pillTxt:{color:C.muted,fontSize:12,fontWeight:'500'},
    pillTxtOn:{color:C.blue,fontWeight:'700'},
  });
  
  // ─── PRO CARD ────────────────────────────────────────────────────────────────
  const ProCard=memo(function ProCard({pro,status,onPress}:{pro:Pro;status:ConnStatus;onPress:()=>void}){
    const conn=status==='accepted';
    return(
      <TouchableOpacity style={[pc.wrap,conn&&pc.wrapConn]} onPress={onPress} activeOpacity={0.88}>
        <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={{flexDirection:'row',alignItems:'flex-start',gap:12}}>
          <View>
            <Image source={{uri:av(pro.id,pro.avatar)}} style={pc.avatar} resizeMode="cover"/>
            {pro.verified&&<View style={pc.vBadge}><Ionicons name="checkmark" size={8} color={C.white}/></View>}
          </View>
          <View style={{flex:1,gap:2}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={pc.name} numberOfLines={1}>{pro.name}</Text>
              {pro.verified&&<View style={pc.verPill}><Text style={{color:C.blue,fontSize:7,fontWeight:'800'}}>VÉRIFIÉ</Text></View>}
            </View>
            <Text style={{color:C.muted,fontSize:11}}>{pro.role}{pro.years_experience?` · ${pro.years_experience} ans`:''}</Text>
            {pro.location&&<View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="location-outline" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:10}}>{pro.location}</Text></View>}
            {/* connection_count absent du schéma */}
          </View>
          <View style={[pc.badge,conn&&pc.badgeConn,status==='pending'&&pc.badgePend]}>
            <Ionicons name={conn?'checkmark-circle':status==='pending'?'time-outline':'person-add-outline'} size={11} color={conn?C.green:status==='pending'?C.gold:C.muted}/>
            <Text style={[pc.badgeTxt,conn&&{color:C.green},status==='pending'&&{color:C.gold}]}>
              {conn?'Connecté':status==='pending'?'En attente':'Contacter'}
            </Text>
          </View>
        </View>
        {!!pro.bio&&<Text style={{color:C.muted,fontSize:11,lineHeight:16,marginTop:8}} numberOfLines={2}>{pro.bio}</Text>}
        {pro.open_to.length>0&&(
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:5,marginTop:7}}>
            {pro.open_to.slice(0,4).map(o=><View key={o} style={pc.openPill}><Text style={{color:C.muted,fontSize:9,fontWeight:'600'}}>{o}</Text></View>)}
          </ScrollView>
        )}
        {conn&&(pro.contact_email||pro.website)&&(
          <View style={{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:9}}>
            {pro.contact_email&&<TouchableOpacity style={pc.chip} onPress={()=>Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{})} activeOpacity={0.85}><Ionicons name="mail-outline" size={11} color={C.blue}/><Text style={{color:C.blue,fontSize:10,fontWeight:'600'}}>{pro.contact_email}</Text></TouchableOpacity>}
            {pro.website&&<TouchableOpacity style={pc.chip} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="globe-outline" size={11} color={C.blue}/><Text style={{color:C.blue,fontSize:10,fontWeight:'600'}}>Portfolio</Text></TouchableOpacity>}
  {/* instagram absent du schéma */}
          </View>
        )}
      </TouchableOpacity>
    );
  });
  const pc=StyleSheet.create({
    wrap:{borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,marginBottom:10},
    wrapConn:{borderColor:C.blueBorder},
    avatar:{width:46,height:46,borderRadius:23,borderWidth:1.5,borderColor:C.border},
    vBadge:{position:'absolute',bottom:-1,right:-1,width:16,height:16,borderRadius:8,backgroundColor:C.navyMid,borderWidth:1,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'},
    verPill:{paddingHorizontal:5,paddingVertical:1.5,borderRadius:5,backgroundColor:C.blueFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder},
    name:{color:C.white,fontSize:13,fontWeight:'800',flex:1,letterSpacing:-0.2},
    badge:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:4,borderRadius:10,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
    badgeConn:{borderColor:'rgba(46,204,138,0.30)',backgroundColor:C.greenFaint},
    badgePend:{borderColor:'rgba(245,200,66,0.25)',backgroundColor:'rgba(245,200,66,0.06)'},
    badgeTxt:{color:C.muted,fontSize:9,fontWeight:'700'},
    openPill:{paddingHorizontal:7,paddingVertical:3,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
    chip:{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:4,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint},
  });
  
  // ─── PRO DETAIL + FORM ───────────────────────────────────────────────────────
  const ProDetailSheet=memo(function ProDetailSheet({pro,status,userId,onClose,onSent}:{
    pro:Pro; status:ConnStatus; userId:string; onClose:()=>void; onSent:(pid:string)=>void;
  }){
    const[phase,setPhase]=useState<'profile'|'form'|'success'>('profile');
    const[note,setNote]=useState('');
    const[projType,setProjType]=useState('');
    const[lookFor,setLookFor]=useState('');
    const[budget,setBudget]=useState('');
    const[timeline,setTimeline]=useState('');
    const[portfolio,setPortfolio]=useState('');
    const[sending,setSending]=useState(false);
    const[filmStats,setFilmStats]=useState<{title:string;avg:number;count:number}[]>([]);
    const slideY=useRef(new Animated.Value(500)).current;
    const succSc=useRef(new Animated.Value(0)).current;
  
    useEffect(()=>{
      Animated.spring(slideY,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();
      if(pro.films?.length){
        supabase.from('critiques').select('film_title,rating').in('film_title',pro.films)
          .then(({data})=>{
            if(!data) return;
            const m:Record<string,{s:number;c:number}>={};
            (data as any[]).forEach(r=>{if(!m[r.film_title])m[r.film_title]={s:0,c:0};m[r.film_title].s+=(r.rating??0);m[r.film_title].c++;});
            setFilmStats(Object.entries(m).map(([title,{s,c}])=>({title,avg:s/c,count:c})));
          });
      }
    },[]);
  
    const send=useCallback(async()=>{
      if(note.trim().length<20||sending) return;
      setSending(true);
      if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
      try{
        const{data:ex}=await supabase.from('pro_connections').select('id').eq('requester_id',userId).eq('pro_id',pro.id).maybeSingle();
        const payload={requester_id:userId,pro_id:pro.id,status:'pending',message:note.trim(),project_type:projType||null,looking_for:lookFor||null,timeline:timeline||null,portfolio_url:portfolio.trim()||null};
        if(ex) await supabase.from('pro_connections').update({...payload,updated_at:new Date().toISOString()}).eq('id',ex.id);
        else await supabase.from('pro_connections').insert(payload);
        const{data:myP}=await supabase.from('profiles').select('display_name').eq('id',userId).maybeSingle();
        await supabase.from('notifications').insert({user_id:pro.user_id??pro.id,actor_id:userId,type:'connection_request',title:`Demande de ${myP?.display_name??'un créateur'}`,body:note.trim().slice(0,120),data:JSON.stringify({requester_id:userId,pro_id:pro.id})}).catch(()=>{});
        onSent(pro.id);setPhase('success');
        if(Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
        Animated.spring(succSc,{toValue:1,tension:80,friction:8,useNativeDriver:true}).start();
      }catch{ Alert.alert('Erreur','Impossible d\'envoyer.'); }
      finally{ setSending(false); }
    },[pro,note,projType,lookFor,timeline,portfolio,userId,sending,onSent]);
  
    const charOk=note.trim().length>=20;
  
    return(
      <Animated.View style={[pds.root,{transform:[{translateY:slideY}]}]}>
        <BlurView intensity={Platform.OS==='ios'?90:70} tint="dark" style={StyleSheet.absoluteFillObject}/>
        <View style={{width:36,height:4,borderRadius:2,backgroundColor:C.border,alignSelf:'center',marginTop:12}}/>
        {/* Header */}
        <View style={pds.hdr}>
          <Image source={{uri:av(pro.id,pro.avatar)}} style={pds.avatar} resizeMode="cover"/>
          <View style={{flex:1,gap:2}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
              <Text style={pds.name}>{pro.name}</Text>
              {pro.verified&&<View style={{paddingHorizontal:5,paddingVertical:1.5,borderRadius:5,backgroundColor:C.blueFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder}}><Text style={{color:C.blue,fontSize:7,fontWeight:'800'}}>VÉRIFIÉ</Text></View>}
            </View>
            <Text style={{color:C.muted,fontSize:11}}>{pro.role}{pro.location?` · ${pro.location}`:''}</Text>
            <View style={{flexDirection:'row',gap:10}}>
              {/* connection_count absent du schéma */}
  {/* views_count absent du schéma */}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={12}><Ionicons name="close" size={16} color={C.muted}/></TouchableOpacity>
        </View>
  
        {/* Profil */}
        {phase==='profile'&&(
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom:100}}>
            {(pro.long_bio||pro.bio)&&<View style={pds.sec}><Text style={pds.secLbl}>À PROPOS</Text><Text style={{color:'rgba(255,255,255,0.70)',fontSize:13,lineHeight:20}}>{pro.long_bio||pro.bio}</Text></View>}
            {pro.specialties?.length>0&&<View style={pds.sec}><Text style={pds.secLbl}>SPÉCIALITÉS</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{pro.specialties.map(s=><View key={s} style={{paddingHorizontal:9,paddingVertical:4,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}}><Text style={{color:C.mid,fontSize:11}}>{s}</Text></View>)}</View></View>}
            {pro.films?.length>0&&<View style={pds.sec}><Text style={pds.secLbl}>FILMOGRAPHIE</Text>{pro.films.map((f,i)=>{const st=filmStats.find(c=>c.title===f);return(<View key={i} style={pds.filmRow}><View style={{width:30,height:30,borderRadius:7,backgroundColor:C.navyMid,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.mid,fontSize:8,fontWeight:'900'}}>{(new Date().getFullYear()-i).toString().slice(-2)}</Text></View><Text style={{color:C.offWhite,fontSize:12,fontWeight:'700',flex:1}}>{f}</Text>{st&&<View style={{alignItems:'flex-end',gap:1}}><View style={{flexDirection:'row',alignItems:'center',gap:2}}><Ionicons name="star" size={9} color={C.gold}/><Text style={{color:C.gold,fontSize:10,fontWeight:'700'}}>{st.avg.toFixed(1)}</Text></View><Text style={{color:C.muted,fontSize:9}}>{st.count} avis</Text></View>}</View>);})}</View>}
  {/* festivals retiré — colonne absente de la table */}
            {pro.open_to?.length>0&&<View style={pds.sec}><Text style={pds.secLbl}>OUVERT À</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:6}}>{pro.open_to.map(o=><View key={o} style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:4,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,backgroundColor:C.blueFaint}}><Ionicons name="checkmark-circle-outline" size={10} color={C.blue}/><Text style={{color:C.blue,fontSize:11}}>{o}</Text></View>)}</View></View>}
            {filmStats.length>0&&<View style={pds.sec}><Text style={pds.secLbl}>RETOURS COMMUNAUTÉ</Text>{filmStats.map(c=><View key={c.title} style={{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.faint}}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={{color:C.mid,fontSize:11,flex:1}}>{c.title}</Text><View style={{flexDirection:'row',alignItems:'center',gap:3}}><Ionicons name="star" size={9} color={C.gold}/><Text style={{color:C.gold,fontSize:10,fontWeight:'700'}}>{c.avg.toFixed(1)}</Text></View><Text style={{color:C.muted,fontSize:9}}>{c.count} avis</Text></View>)}</View>}
            {status==='accepted'&&(pro.contact_email||pro.website)&&<View style={pds.sec}><Text style={pds.secLbl}>COORDONNÉES</Text><View style={{gap:7}}>{pro.contact_email&&<TouchableOpacity style={pds.contactRow} onPress={()=>Linking.openURL(`mailto:${pro.contact_email}`).catch(()=>{})} activeOpacity={0.85}><Ionicons name="mail-outline" size={14} color={C.blue}/><Text style={{color:C.white,fontSize:13,fontWeight:'700',flex:1}}>{pro.contact_email}</Text><Ionicons name="open-outline" size={11} color={C.muted}/></TouchableOpacity>}{pro.website&&<TouchableOpacity style={pds.contactRow} onPress={()=>Linking.openURL(pro.website!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="globe-outline" size={14} color={C.blue}/><Text style={{color:C.white,fontSize:13,fontWeight:'700',flex:1}}>Portfolio</Text><Ionicons name="open-outline" size={11} color={C.muted}/></TouchableOpacity>}</View></View>}
            <View style={{paddingHorizontal:EDGE,paddingTop:8}}>
              {status==='pending'
                ?<View style={{flexDirection:'row',alignItems:'center',gap:9,padding:13,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(245,200,66,0.25)',backgroundColor:'rgba(245,200,66,0.06)'}}><Ionicons name="time-outline" size={15} color={C.gold}/><Text style={{color:C.muted,fontSize:12,flex:1,lineHeight:17}}>Demande en attente de réponse.</Text></View>
                :status!=='accepted'&&<TouchableOpacity style={pds.connectBtn} onPress={()=>setPhase('form')} activeOpacity={0.88}><Ionicons name="person-add-outline" size={14} color={C.blue}/><Text style={{color:C.blue,fontSize:14,fontWeight:'800'}}>Demander une connexion</Text></TouchableOpacity>
              }
            </View>
          </ScrollView>
        )}
  
        {/* Formulaire */}
        {phase==='form'&&(
          <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:EDGE,paddingBottom:100,gap:16}}>
              <View style={{gap:4}}><Text style={pds.fLabel}>Message * (min. 20 car.)</Text><TextInput style={pds.textarea} value={note} onChangeText={setNote} multiline maxLength={500} placeholder={`Bonjour ${pro.name.split(' ')[0]}, je suis…`} placeholderTextColor="rgba(255,255,255,0.16)" selectionColor={C.blue} textAlignVertical="top"/><Text style={{color:charOk?C.blue:C.muted,fontSize:9,fontWeight:'700',textAlign:'right'}}>{note.trim().length}/500</Text></View>
              <View style={{gap:7}}><Text style={pds.fLabel}>Type de projet</Text><Pills opts={PROJECT_TYPES} val={projType} on={setProjType}/></View>
              <View style={{gap:7}}><Text style={pds.fLabel}>Ce que vous recherchez</Text><TextInput style={pds.input} value={lookFor} onChangeText={setLookFor} placeholder="Ex : réalisateur pour un court-métrage…" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.blue}/></View>
              <View style={{gap:7}}><Text style={pds.fLabel}>Calendrier</Text><Pills opts={TIMELINE_OPTS} val={timeline} on={setTimeline}/></View>
              <View style={{gap:7}}><Text style={pds.fLabel}>Portfolio (optionnel)</Text><TextInput style={pds.input} value={portfolio} onChangeText={setPortfolio} placeholder="https://…" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.blue} autoCapitalize="none" keyboardType="url"/></View>
              <View style={{flexDirection:'row',gap:9}}>
                <TouchableOpacity style={[pds.connectBtn,{flex:1,opacity:sending||!charOk?.45:1}]} onPress={send} disabled={!charOk||sending} activeOpacity={0.88}>{sending?<ActivityIndicator color={C.blue} size="small"/>:<><Ionicons name="paper-plane-outline" size={13} color={C.blue}/><Text style={{color:C.blue,fontSize:14,fontWeight:'800'}}>Envoyer</Text></>}</TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
  
        {/* Succès */}
        {phase==='success'&&(
          <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:14,padding:40}}>
            <Animated.View style={{width:72,height:72,borderRadius:36,backgroundColor:C.blueFaint,borderWidth:1.5,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center',transform:[{scale:succSc}]}}><Ionicons name="checkmark" size={32} color={C.blue}/></Animated.View>
            <Text style={{color:C.white,fontSize:20,fontWeight:'900',textAlign:'center'}}>Demande envoyée !</Text>
            <Text style={{color:C.muted,fontSize:12,textAlign:'center',lineHeight:19}}>{pro.name} vous répondra si votre profil correspond.</Text>
            <TouchableOpacity style={[pds.connectBtn,{borderColor:C.border,backgroundColor:C.faint}]} onPress={onClose} activeOpacity={0.80}><Text style={{color:C.muted,fontSize:13,fontWeight:'600'}}>Fermer</Text></TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  });
  const pds=StyleSheet.create({
    root:{position:'absolute',bottom:0,left:0,right:0,height:'93%',borderTopLeftRadius:26,borderTopRightRadius:26,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder},
    hdr:{flexDirection:'row',alignItems:'flex-start',gap:13,padding:EDGE,paddingTop:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
    avatar:{width:50,height:50,borderRadius:25,borderWidth:1.5,borderColor:C.border},
    name:{color:C.white,fontSize:16,fontWeight:'900',flex:1,letterSpacing:-0.3},
    sec:{paddingHorizontal:EDGE,paddingTop:16,gap:8},
    secLbl:{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:1.5,textTransform:'uppercase'},
    filmRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:6,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.faint},
    contactRow:{flexDirection:'row',alignItems:'center',gap:11,padding:13,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint},
    connectBtn:{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,paddingVertical:13,paddingHorizontal:20,borderRadius:15,borderWidth:1,borderColor:C.blueBorder,backgroundColor:C.blueFaint},
    fLabel:{color:C.offWhite,fontSize:12,fontWeight:'700'},
    input:{color:C.white,fontSize:13,paddingHorizontal:13,paddingVertical:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.04)'},
    textarea:{color:C.white,fontSize:13,lineHeight:20,paddingHorizontal:13,paddingVertical:11,borderRadius:11,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:'rgba(255,255,255,0.04)',minHeight:110,textAlignVertical:'top'},
  });
  
  // ─════════════════════════════════════════════════════════════════════════════
  // EXPORT — IndustrieScreen
  // ─════════════════════════════════════════════════════════════════════════════
  interface IndustrieScreenProps { userId:string; onBack:()=>void; }
  
  export default memo(function IndustrieScreen({userId,onBack}:IndustrieScreenProps){
    const insets=useSafeAreaInsets();
    const[tab,setTab]=useState<IndTab>('Annuaire');
    const[search,setSearch]=useState('');
    const[role,setRole]=useState('Tous');
    const[selPro,setSelPro]=useState<Pro|null>(null);
    const slideX=useRef(new Animated.Value(W)).current;
  
    useEffect(()=>{Animated.spring(slideX,{toValue:0,tension:65,friction:12,useNativeDriver:true}).start();},[]);
  
    const{pros,byRole,loading,error,refresh}=useProDirectory(search,role);
    const{conns,setStatus,accepted}=useConnections(userId);
    const{reqs,reload}=useIncoming(userId);
    const pending=reqs.filter(r=>r.status==='pending').length;
  
    const acceptReq=useCallback(async(req:ProConnection)=>{
      await supabase.from('pro_connections').update({status:'accepted',updated_at:new Date().toISOString()}).eq('id',req.id);
      if(Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      reload();
    },[reload]);
  
    const rejectReq=useCallback(async(id:string)=>{
      await supabase.from('pro_connections').update({status:'rejected',updated_at:new Date().toISOString()}).eq('id',id);
      reload();
    },[reload]);
  
    // Données Annuaire : par rôle si "Tous", liste filtrée sinon
    const listData=useMemo(()=>{
      if(role==='Tous' && !search.trim()){
        // Sections par rôle
        return Object.entries(byRole).sort(([a],[b])=>a.localeCompare(b,'fr'));
      }
      return null; // liste plate
    },[role,search,byRole]);
  
    return(
      <Animated.View style={{flex:1,transform:[{translateX:slideX}]}}>
        <GalaxyBackground/>
        {/* Header */}
        <View style={[ind.hdr,{paddingTop:insets.top+10}]}>
          <TouchableOpacity onPress={onBack} style={ind.backBtn} activeOpacity={0.80}><Ionicons name="arrow-back" size={17} color={C.white}/></TouchableOpacity>
          <View style={{flex:1,gap:1}}>
            <Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:2,textTransform:'uppercase'}}>UNIVERSE</Text>
            <Text style={{color:C.white,fontSize:19,fontWeight:'900',letterSpacing:-0.5}}>Industrie Cinéma</Text>
          </View>
          <View style={{width:32,height:32,borderRadius:16,backgroundColor:C.blueFaint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.blueBorder,alignItems:'center',justifyContent:'center'}}><Ionicons name="briefcase-outline" size={15} color={C.blue}/></View>
        </View>
  
        {/* Onglets */}
        <View style={ind.tabs}>
          {IND_TABS.map(t=>{const on=t===tab;return(
            <TouchableOpacity key={t} style={[ind.tab,on&&ind.tabOn]} onPress={()=>setTab(t)} activeOpacity={0.80}>
              <Text style={[ind.tabTxt,on&&ind.tabTxtOn]}>{t}</Text>
              {t==='Reçues'&&pending>0&&<View style={ind.badge}><Text style={{color:C.white,fontSize:7,fontWeight:'900'}}>{pending}</Text></View>}
              {t==='Connexions'&&accepted.length>0&&<View style={[ind.badge,{backgroundColor:C.green}]}><Text style={{color:C.white,fontSize:7,fontWeight:'900'}}>{accepted.length}</Text></View>}
            </TouchableOpacity>
          );})}
        </View>
  
        {/* ── Annuaire ── */}
        {tab==='Annuaire'&&(
          <View style={{flex:1}}>
            <View style={{padding:EDGE,gap:9,paddingBottom:6}}>
              <View style={{flexDirection:'row',alignItems:'center',gap:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,borderRadius:12,paddingHorizontal:13,height:42,backgroundColor:'rgba(255,255,255,0.03)'}}>
                <Ionicons name="search-outline" size={13} color={C.muted}/>
                <TextInput style={{flex:1,color:C.white,fontSize:13}} placeholder="Nom, spécialité…" placeholderTextColor="rgba(255,255,255,0.18)" value={search} onChangeText={setSearch} returnKeyType="search" autoCorrect={false}/>
                {search.length>0&&<TouchableOpacity onPress={()=>setSearch('')}><Ionicons name="close-circle" size={13} color={C.muted}/></TouchableOpacity>}
              </View>
              <Pills opts={['Tous',...PRO_ROLES.slice(1)]} val={role} on={setRole}/>
            </View>
            {loading
              ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><ActivityIndicator color={C.muted} size="large"/><Text style={{color:C.muted,fontSize:13}}>Chargement…</Text></View>
              :error
              ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="cloud-offline-outline" size={26} color={C.muted}/><Text style={{color:C.muted,fontSize:13}}>{error}</Text><TouchableOpacity onPress={refresh}><Text style={{color:C.blue,fontSize:13,fontWeight:'700'}}>Réessayer</Text></TouchableOpacity></View>
              :listData
              // Vue par catégories
              ?<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingHorizontal:EDGE,paddingBottom:120}}>
                {listData.map(([roleLabel,list])=>(
                  <View key={roleLabel} style={{marginTop:18}}>
                    <View style={{flexDirection:'row',alignItems:'center',gap:6,marginBottom:10}}>
                      <Ionicons name="people-outline" size={12} color={C.mid}/>
                      <Text style={{color:C.white,fontSize:13,fontWeight:'800'}}>{roleLabel}</Text>
                      <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.faint,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{list.length}</Text></View>
                    </View>
                    {list.map(pro=><ProCard key={pro.id} pro={pro} status={conns[pro.id]??'none'} onPress={()=>setSelPro(pro)}/>)}
                  </View>
                ))}
              </ScrollView>
              // Vue liste filtrée
              :<FlatList data={pros} keyExtractor={p=>p.id} contentContainerStyle={{padding:EDGE,paddingBottom:120}} showsVerticalScrollIndicator={false}
                renderItem={({item:pro})=><ProCard pro={pro} status={conns[pro.id]??'none'} onPress={()=>setSelPro(pro)}/>}
                ListEmptyComponent={<View style={{alignItems:'center',paddingVertical:60,gap:10}}><Ionicons name="people-outline" size={30} color={C.muted}/><Text style={{color:C.muted,fontSize:13}}>Aucun résultat</Text></View>}
              />
            }
          </View>
        )}
  
        {/* ── Demandes reçues ── */}
        {tab==='Reçues'&&(
          reqs.length===0
            ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="mail-outline" size={28} color={C.muted}/><Text style={{color:C.muted,fontSize:13,fontWeight:'700'}}>Aucune demande</Text></View>
            :<FlatList data={reqs} keyExtractor={r=>r.id} contentContainerStyle={{padding:EDGE,paddingBottom:120}} showsVerticalScrollIndicator={false}
              renderItem={({item:req})=>(
                <View style={ind.reqCard}>
                  <BlurView intensity={Platform.OS==='ios'?14:10} tint="dark" style={StyleSheet.absoluteFillObject}/>
                  <View style={{flexDirection:'row',alignItems:'flex-start',gap:11}}>
                    <Image source={{uri:av(req.requester_id,req.requester?.avatar_url)}} style={{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:C.border}} resizeMode="cover"/>
                    <View style={{flex:1,gap:1}}>
                      <Text style={{color:C.white,fontSize:13,fontWeight:'800'}}>{req.requester?.display_name??'Créateur·ice'}</Text>
                      <Text style={{color:C.muted,fontSize:9}}>{timeAgo(req.created_at)}</Text>
                      {req.project_type&&<View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}><Ionicons name="film-outline" size={9} color={C.blue}/><Text style={{color:C.blue,fontSize:10,fontWeight:'600'}}>{req.project_type}</Text></View>}
                    </View>
                    <View style={[pc.badge,req.status==='accepted'&&pc.badgeConn,req.status==='rejected'&&{borderColor:'rgba(255,59,92,0.25)',backgroundColor:'rgba(255,59,92,0.08)'}]}>
                      <Text style={{color:req.status==='accepted'?C.green:req.status==='rejected'?C.red:C.gold,fontSize:8,fontWeight:'800'}}>{req.status==='accepted'?'ACCEPTÉE':req.status==='rejected'?'REFUSÉE':'EN ATTENTE'}</Text>
                    </View>
                  </View>
                  {req.message&&<View style={{marginTop:9,padding:11,borderRadius:11,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.mid,fontSize:11,lineHeight:17,fontStyle:'italic'}}>«{req.message}»</Text></View>}
                  {req.looking_for&&<Text style={{color:C.muted,fontSize:10,marginTop:5}}><Text style={{fontWeight:'700'}}>Recherche : </Text>{req.looking_for}</Text>}
                  {req.budget_range&&<View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:3}}><Ionicons name="wallet-outline" size={10} color={C.muted}/><Text style={{color:C.muted,fontSize:10}}>{req.budget_range}</Text></View>}
                  {req.timeline&&<View style={{flexDirection:'row',alignItems:'center',gap:4,marginTop:2}}><Ionicons name="calendar-outline" size={10} color={C.muted}/><Text style={{color:C.muted,fontSize:10}}>{req.timeline}</Text></View>}
                  {req.portfolio_url&&<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:5,marginTop:7,alignSelf:'flex-start',paddingHorizontal:10,paddingVertical:6,borderRadius:9,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>Linking.openURL(req.portfolio_url!).catch(()=>{})} activeOpacity={0.85}><Ionicons name="open-outline" size={11} color={C.blue}/><Text style={{color:C.blue,fontSize:10,fontWeight:'700'}}>Portfolio</Text></TouchableOpacity>}
                  {req.status==='pending'&&<View style={{flexDirection:'row',gap:8,marginTop:11}}>
                    <TouchableOpacity style={{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:11,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(46,204,138,0.35)',backgroundColor:C.greenFaint}} onPress={()=>acceptReq(req)} activeOpacity={0.88}><Ionicons name="checkmark-circle-outline" size={13} color={C.green}/><Text style={{color:C.green,fontSize:13,fontWeight:'800'}}>Accepter</Text></TouchableOpacity>
                    <TouchableOpacity style={{paddingHorizontal:14,paddingVertical:11,borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint}} onPress={()=>rejectReq(req.id)} activeOpacity={0.80}><Text style={{color:C.muted,fontSize:12,fontWeight:'600'}}>Refuser</Text></TouchableOpacity>
                  </View>}
                </View>
              )}
            />
        )}
  
        {/* ── Mes connexions ── */}
        {tab==='Connexions'&&(
          accepted.length===0
            ?<View style={{flex:1,alignItems:'center',justifyContent:'center',gap:10}}><Ionicons name="people-outline" size={28} color={C.blue}/><Text style={{color:C.muted,fontSize:13,fontWeight:'700'}}>Aucune connexion</Text><Text style={{color:C.muted,fontSize:11,textAlign:'center',paddingHorizontal:40,lineHeight:17}}>Explorez l'annuaire pour vous connecter.</Text></View>
            :<FlatList data={accepted} keyExtractor={p=>p.id} contentContainerStyle={{padding:EDGE,paddingBottom:120}} showsVerticalScrollIndicator={false}
              renderItem={({item:pro})=><ProCard pro={pro} status="accepted" onPress={()=>setSelPro(pro)}/>}
            />
        )}
  
        {/* Profil détaillé */}
        {selPro&&(
          <Modal visible transparent animationType="none" onRequestClose={()=>setSelPro(null)} statusBarTranslucent>
            <GalaxyBackground/>
            <Pressable style={StyleSheet.absoluteFill} onPress={()=>setSelPro(null)}/>
            <ProDetailSheet pro={selPro} status={conns[selPro.id]??'none'} userId={userId} onClose={()=>setSelPro(null)} onSent={pid=>{setStatus(pid,'pending');setSelPro(null);}}/>
          </Modal>
        )}
      </Animated.View>
    );
  });
  
  const ind=StyleSheet.create({
    hdr:{flexDirection:'row',alignItems:'center',paddingHorizontal:EDGE,paddingBottom:12,gap:11},
    backBtn:{width:36,height:36,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,alignItems:'center',justifyContent:'center'},
    tabs:{flexDirection:'row',paddingHorizontal:EDGE,gap:6,marginBottom:4,flexWrap:'wrap'},
    tab:{paddingHorizontal:14,paddingVertical:8,borderRadius:18,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.faint,flexDirection:'row',alignItems:'center',gap:5},
    tabOn:{borderColor:C.blueBorder,backgroundColor:C.blueFaint},
    tabTxt:{color:C.muted,fontSize:11,fontWeight:'600'},
    tabTxtOn:{color:C.blue,fontWeight:'800'},
    badge:{minWidth:14,height:14,borderRadius:7,backgroundColor:C.blue,alignItems:'center',justifyContent:'center',paddingHorizontal:2},
    reqCard:{borderRadius:14,overflow:'hidden',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,padding:14,marginBottom:10},
  });