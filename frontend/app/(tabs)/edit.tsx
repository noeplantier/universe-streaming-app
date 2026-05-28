/**
 * app/edit.tsx — UNIVERSE · ÉDITION PROFIL v5
 *
 * ★ FIX NETLIFY : onAuthStateChange + retry auth
 * ★ Upload photo de profil → Supabase storage → profiles.avatar_url
 * ★ Preview live en temps réel dans le header
 * ★ Avatar propagé via realtime vers profile.tsx + CustomNavBar
 * ★ Gamification mini-banner dynamique
 * ★ Web-safe : pas d'expo-image, upload via fetch(blob) sur web
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Ionicons }      from '@expo/vector-icons';
import { useRouter }     from 'expo-router';
import { StatusBar }     from 'expo-status-bar';
import { SafeAreaView }  from 'react-native-safe-area-context';
import * as Haptics      from 'expo-haptics';
import * as ImagePicker  from 'expo-image-picker';
import { supabase }      from '@/lib/supabase';
import GalaxyBackground  from '@/components/social/GalaxyBackground';

// FileSystem web-safe
const FileSystem:any=Platform.select({native:()=>{try{return require('expo-file-system');}catch{return null;}},default:()=>null})?.()??null;
let decode:((s:string)=>ArrayBuffer)|null=null;
try{decode=require('base64-arraybuffer').decode;}catch{}

const C={bg:'#03000A',navyMid:'#0D2040',navyLow:'#0A1830',white:'#FFFFFF',offWhite:'rgba(255,255,255,0.82)',mid:'rgba(255,255,255,0.55)',muted:'rgba(255,255,255,0.36)',subtle:'rgba(255,255,255,0.14)',faint:'rgba(255,255,255,0.07)',border:'rgba(255,255,255,0.10)',borderHi:'rgba(255,255,255,0.28)',borderFocus:'rgba(255,255,255,0.55)',glass:'rgba(255,255,255,0.04)',glassHi:'rgba(255,255,255,0.11)',success:'#22C55E',error:'#EF4444'} as const;
const PAD=20;
const ROLES=[{key:'director',label:'Réalisateur·rice',icon:'film-outline' as const},{key:'producer',label:'Producteur·rice',icon:'briefcase-outline' as const},{key:'writer',label:'Scénariste',icon:'create-outline' as const},{key:'actor',label:'Acteur·rice',icon:'people-outline' as const},{key:'dp',label:'Dir. photo',icon:'camera-outline' as const},{key:'editor',label:'Monteur·euse',icon:'cut-outline' as const},{key:'critic',label:'Critique',icon:'newspaper-outline' as const},{key:'creator',label:'Créateur·rice',icon:'sparkles-outline' as const},{key:'other',label:'Autre',icon:'ellipsis-horizontal-circle-outline' as const}];
const GENRES=['Drame','Thriller','Science-Fiction','Documentaire','Animation','Court-métrage','Expérimental','Biopic','Horreur','Comédie','Romance','Action','Fantastique','Policier','Musical'];
const COLLABS=['Co-réalisation','Casting','Co-production','Scénarisation','Montage','Composition musicale','Direction photo','Distribution','Mentorat','Projection festival'];
const FESTIVALS=['Cannes','Sundance','Berlin','Tribeca','SXSW','Toronto (TIFF)','Venise','Annecy','Hot Docs','Clermont-Ferrand','Rotterdam (IFFR)','AFI Fest','New York (NYFF)'];
const PROFILE_SELECT='display_name,username,bio,role,location,equipment,specialties,open_to,festivals,notable_works,is_industry_contact,is_pro,contact_email,website,social_instagram,social_vimeo,social_youtube,social_imdb,avatar_url';

interface NotableWork{id:string;title:string;year:string;role:string;url:string}
interface ProfileForm{display_name:string;username:string;bio:string;role:string;location:string;equipment:string;specialties:string[];open_to:string[];festivals:string[];notable_works:NotableWork[];is_industry_contact:boolean;is_pro:boolean;contact_email:string;website:string;social_instagram:string;social_vimeo:string;social_youtube:string;social_imdb:string}
const EMPTY:ProfileForm={display_name:'',username:'',bio:'',role:'creator',location:'',equipment:'',specialties:[],open_to:[],festivals:[],notable_works:[],is_industry_contact:false,is_pro:false,contact_email:'',website:'',social_instagram:'',social_vimeo:'',social_youtube:'',social_imdb:''};
type Section='identity'|'cinema'|'network';

// Gamification mini
interface UserStats{watchCount:number;critiqueCount:number;favCount:number;isNight:boolean}
interface Badge{id:string;label:string;icon:keyof typeof Ionicons.glyphMap;earned:boolean}
function buildBadges(s:UserStats):Badge[]{return[{id:'explorer',label:'Explorateur indé',icon:'compass-outline',earned:s.watchCount>=5},{id:'nocturne',label:'Cinéphile nocturne',icon:'moon-outline',earned:s.isNight},{id:'critique',label:'Critique en herbe',icon:'create-outline',earned:s.critiqueCount>=5},{id:'curateur',label:'Curateur',icon:'bookmark-outline',earned:s.favCount>=10}];}
function cinephileLevel(score:number):{n:number;label:string;pct:number}{const L=[{at:0,n:1,l:'Spectateur curieux'},{at:50,n:2,l:'Explorateur indé'},{at:150,n:3,l:'Critique amateur'},{at:400,n:4,l:'Curateur underground'},{at:900,n:5,l:'Ambassadeur cinéma'}];const c=[...L].reverse().find(x=>score>=x.at)??L[0];const ni=L.findIndex(x=>x.n===c.n)+1;const nx=L[ni]??L[L.length-1];return{n:c.n,label:c.l,pct:c.n===5?1:Math.min(1,(score-c.at)/(nx.at-c.at))};}
function useGamification(userId:string){const[stats,setStats]=useState<UserStats>({watchCount:0,critiqueCount:0,favCount:0,isNight:false});useEffect(()=>{if(!userId)return;const isNight=new Date().getHours()>=22||new Date().getHours()<4;Promise.all([supabase.from('user_history').select('work_id').eq('user_id',userId),supabase.from('critiques').select('id').eq('user_id',userId),supabase.from('user_favorites').select('work_id').eq('user_id',userId)]).then(([h,c,f])=>setStats({watchCount:(h.data??[]).length,critiqueCount:(c.data??[]).length,favCount:(f.data??[]).length,isNight})).catch(()=>{});},[userId]);const score=useMemo(()=>stats.watchCount*3+stats.critiqueCount*8+stats.favCount*2+(stats.isNight?5:0),[stats]);const level=useMemo(()=>cinephileLevel(score),[score]);const badges=useMemo(()=>buildBadges(stats),[stats]);return{score,level,badges};}

const genId=()=>Math.random().toString(36).slice(2,9);
const validUrl=(u:string)=>!u||/^https?:\/\/.+/.test(u);
const validEmail=(e:string)=>!e||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function validateUsername(u:string):string|null{if(!u.trim())return'Champ obligatoire';if(u.length<3)return'3 caractères minimum';if(!/^[a-z0-9._-]+$/i.test(u))return'Lettres, chiffres, . _ - uniquement';return null;}

async function fetchProfile(uid:string):Promise<Partial<ProfileForm>&{avatar_url?:string}>{const{data,error}=await supabase.from('profiles').select(PROFILE_SELECT).eq('id',uid).maybeSingle();if(error)throw new Error(error.message);return(data??{}) as any;}
async function persistProfile(uid:string,form:ProfileForm):Promise<void>{const p={...form,updated_at:new Date().toISOString()};const{error:upErr,count}=await supabase.from('profiles').update(p).eq('id',uid).select('id',{count:'exact',head:true});if(upErr||(count===0)){const{error:inErr}=await supabase.from('profiles').insert({id:uid,...p});if(inErr)throw new Error(inErr.message);}}

// ─── ★ UPLOAD AVATAR ──────────────────────────────────────────────────────────
async function uploadAvatarToStorage(uri:string,userId:string):Promise<string|null>{
  try{
    const ext=uri.split('.').pop()?.toLowerCase()??'jpg';
    const mime=ext==='png'?'image/png':'image/jpeg';
    const path=`${userId}/avatar.${ext}`;
    let payload:Blob|ArrayBuffer;
    if(Platform.OS==='web'||uri.startsWith('blob:')||uri.startsWith('http')){
      payload=await fetch(uri).then(r=>r.blob());
    }else if(FileSystem&&decode){
      const b64=await FileSystem.readAsStringAsync(uri,{encoding:'base64'});
      payload=decode(b64);
    }else{
      payload=await fetch(uri).then(r=>r.blob());
    }
    const{data,error}=await supabase.storage.from('avatars').upload(path,payload,{contentType:mime,upsert:true});
    if(error)throw error;
    const{data:{publicUrl}}=supabase.storage.from('avatars').getPublicUrl(data.path);
    // Cache-busting
    return`${publicUrl}?t=${Date.now()}`;
  }catch(e){console.error('[edit] avatar upload:',e);return null;}
}

// ─── ★ AVATAR PREVIEW ─────────────────────────────────────────────────────────
const AvatarPreview=memo(({name,avatarUrl,level,isPro,loading,onPress}:{name:string;avatarUrl:string;level:number;isPro:boolean;loading:boolean;onPress:()=>void})=>{
  const initials=useMemo(()=>(name||'?').trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2),[name]);
  const[imgErr,setImgErr]=useState(false);
  useEffect(()=>{setImgErr(false);},[avatarUrl]);
  const hasAvatar=!!avatarUrl&&!imgErr;
  return(
    <View style={{flexDirection:'row',alignItems:'center',gap:20,paddingHorizontal:PAD,paddingVertical:22}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{position:'relative'}}>
        <View style={{width:80,height:80,borderRadius:40,overflow:'hidden',borderWidth:1.5,borderColor:C.borderHi,backgroundColor:C.navyMid}}>
          {hasAvatar?<Image source={{uri:avatarUrl}} style={{width:80,height:80}} resizeMode="cover" onError={()=>setImgErr(true)}/>:<View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:26,fontWeight:'900',letterSpacing:-0.5}}>{initials}</Text></View>}
        </View>
        <View style={{position:'absolute',top:-4,right:-4,width:22,height:22,borderRadius:11,backgroundColor:C.navyMid,borderWidth:1.5,borderColor:C.border,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:9,fontWeight:'900'}}>{level}</Text></View>
        {isPro&&<View style={{position:'absolute',bottom:0,right:0,width:20,height:20,borderRadius:10,backgroundColor:C.navyMid,borderWidth:1.5,borderColor:C.borderHi,alignItems:'center',justifyContent:'center'}}><Ionicons name="checkmark" size={9} color={C.white}/></View>}
        <View style={{position:'absolute',bottom:0,left:0,width:26,height:26,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.bg}}>
          {loading?<ActivityIndicator color={C.bg} size="small"/>:<Ionicons name="camera-outline" size={14} color={C.bg}/>}
        </View>
      </TouchableOpacity>
      <View style={{flex:1,gap:6}}>
        <Text style={{color:C.white,fontSize:15,fontWeight:'700'}}>{name||'Votre nom'}</Text>
        <Text style={{color:C.muted,fontSize:11,lineHeight:16}}>{hasAvatar?'Photo uploadée — visible sur votre profil et la navigation':'Ajoutez une photo ou gardez votre monogramme'}</Text>
        <TouchableOpacity onPress={onPress} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,alignSelf:'flex-start',marginTop:2}} activeOpacity={0.80}>
          <Text style={{color:C.offWhite,fontSize:12,fontWeight:'600'}}>{hasAvatar?'Changer la photo':'Ajouter une photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── GAMIFICATION MINI BANNER ─────────────────────────────────────────────────
const GamiBanner=memo(({level,score,badges}:{level:{n:number;label:string;pct:number};score:number;badges:Badge[]})=>{
  const earned=badges.filter(b=>b.earned).length;
  const prog=useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:900,useNativeDriver:false}).start();},[level.pct]);
  return(
    <View style={{marginHorizontal:PAD,marginBottom:24,padding:16,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.glass}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12,marginBottom:12}}>
        <View style={{width:46,height:46,borderRadius:23,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:16,fontWeight:'900',letterSpacing:-0.5}}>{level.n}</Text><Text style={{color:C.muted,fontSize:7,fontWeight:'800',letterSpacing:1.5,marginTop:-2}}>NIV</Text></View>
        <View style={{flex:1,gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:C.white,fontSize:13,fontWeight:'700',flex:1}}>{level.label}</Text><View style={{flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="star" size={9} color={C.muted}/><Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{score} pts</Text></View></View>
          <View style={{height:3,borderRadius:2,backgroundColor:C.faint,overflow:'hidden'}}><Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']})}}/></View>
          <Text style={{color:C.muted,fontSize:10}}>{earned}/{badges.length} badges débloqués</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:7}}>
        {[...badges.filter(b=>b.earned),...badges.filter(b=>!b.earned)].map(b=>(<View key={b.id} style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:10,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.glass,opacity:b.earned?1:0.5}}><Ionicons name={b.icon} size={12} color={b.earned?C.white:C.muted}/><Text style={{color:b.earned?C.white:C.muted,fontSize:9,fontWeight:'600'}}>{b.label}</Text></View>))}
      </ScrollView>
      <Text style={{color:C.muted,fontSize:10,lineHeight:15,marginTop:12}}>Remplissez votre profil · Explorez le catalogue · Publiez des avis pour progresser.</Text>
    </View>
  );
});

// ─── UI HELPERS ───────────────────────────────────────────────────────────────
const Divider=memo(({mt=24,mb=8}:{mt?:number;mb?:number})=>(<View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginHorizontal:PAD,marginTop:mt,marginBottom:mb}}/>));
const SHead=memo(({label,desc,badge}:{label:string;desc?:string;badge?:string})=>(<View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:PAD,paddingTop:28,paddingBottom:14}}><View style={{flex:1}}><Text style={{color:C.white,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'}}>{label}</Text>{desc&&<Text style={{color:C.muted,fontSize:12,marginTop:4,lineHeight:17}}>{desc}</Text>}</View>{badge&&<View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:18,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{badge}</Text></View>}</View>));

const Field=memo(function Field({label,value,onChange,placeholder,multiline,maxLength,keyboardType='default',error,icon,hint}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean;maxLength?:number;keyboardType?:'default'|'email-address'|'url'|'numeric';error?:string|null;icon?:keyof typeof Ionicons.glyphMap;hint?:string}){const fa=useRef(new Animated.Value(0)).current;const onF=useCallback(()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start(),[fa]);const onB=useCallback(()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start(),[fa]);const lC=fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.border,error?C.error:C.borderFocus]});const lbC=fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.muted,error?C.error:C.offWhite]});return(<View style={{paddingHorizontal:PAD,marginBottom:20}}><Animated.Text style={{fontSize:9.5,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase',marginBottom:10,color:lbC}}>{label}</Animated.Text><View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>{icon&&<Ionicons name={icon} size={15} color={C.muted} style={{paddingBottom:12}}/>}<TextInput style={[{flex:1,color:C.white,fontSize:15,paddingVertical:10,lineHeight:21},multiline&&{minHeight:90,textAlignVertical:'top',paddingTop:8}]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" multiline={multiline} maxLength={maxLength} keyboardType={keyboardType} autoCapitalize={keyboardType==='email-address'||keyboardType==='url'?'none':'sentences'} autoCorrect={false} selectionColor={C.white} onFocus={onF} onBlur={onB} returnKeyType={multiline?'default':'next'} numberOfLines={multiline?4:1}/>{!!maxLength&&value.length>maxLength*0.75&&<Text style={{color:C.muted,fontSize:10,paddingBottom:12}}>{value.length}/{maxLength}</Text>}</View><Animated.View style={{height:StyleSheet.hairlineWidth,marginTop:2,backgroundColor:lC}}/>{error&&<Text style={{color:C.error,fontSize:11,marginTop:6}}>{error}</Text>}{hint&&!error&&<Text style={{color:C.muted,fontSize:11,marginTop:6,lineHeight:16}}>{hint}</Text>}</View>);});

const Toggle=memo(function Toggle({label,subtitle,value,onChange}:{label:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}){const a=useRef(new Animated.Value(value?1:0)).current;useEffect(()=>{Animated.spring(a,{toValue:value?1:0,tension:120,friction:9,useNativeDriver:false}).start();},[value,a]);return(<TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:PAD,paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}} onPress={()=>{if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onChange(!value);}} activeOpacity={0.80}><View style={{flex:1,gap:3}}><Text style={{color:C.offWhite,fontSize:14,fontWeight:'600'}}>{label}</Text>{subtitle&&<Text style={{color:C.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text>}</View><Animated.View style={{width:46,height:26,borderRadius:13,justifyContent:'center',borderWidth:1,borderColor:C.border,backgroundColor:a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.10)','rgba(255,255,255,0.80)']}),}}><Animated.View style={{width:22,height:22,borderRadius:11,transform:[{translateX:a.interpolate({inputRange:[0,1],outputRange:[2,22]})}],backgroundColor:a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.55)','#03000A']})}}/></Animated.View></TouchableOpacity>);});

const Chips=memo(({items,selected,onToggle}:{items:string[];selected:string[];onToggle:(v:string)=>void})=>(<View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:PAD}}>{items.map(item=>{const on=selected.includes(item);return(<TouchableOpacity key={item} style={[{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:24,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},on&&{backgroundColor:C.white,borderColor:C.white}]} onPress={()=>onToggle(item)} activeOpacity={0.75}>{on&&<Ionicons name="checkmark" size={10} color={C.bg}/>}<Text style={[{color:C.muted,fontSize:12,fontWeight:'500'},on&&{color:C.bg,fontWeight:'700'}]}>{item}</Text></TouchableOpacity>);})}></View>));

const RoleGrid=memo(({selected,onChange}:{selected:string;onChange:(v:string)=>void})=>(<View style={{flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:PAD}}>{ROLES.map(r=>{const on=selected===r.key;return(<TouchableOpacity key={r.key} style={[{width:'30%',flexGrow:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},on&&{backgroundColor:C.white,borderColor:C.white}]} onPress={()=>onChange(r.key)} activeOpacity={0.80}><Ionicons name={r.icon} size={17} color={on?C.bg:C.muted}/><Text style={[{color:C.muted,fontSize:10,fontWeight:'500',textAlign:'center'},on&&{color:C.bg,fontWeight:'700'}]} numberOfLines={2}>{r.label}</Text></TouchableOpacity>);})}</View>));

const WorkCard=memo(({work,onUpdate,onDelete}:{work:NotableWork;onUpdate:(w:NotableWork)=>void;onDelete:(id:string)=>void})=>(<View style={{marginHorizontal:PAD,marginBottom:12,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.glass,padding:14}}><View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}><View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.white}}/><Text style={{flex:1,color:C.offWhite,fontSize:12,fontWeight:'600'}} numberOfLines={1}>{work.title||"Titre de l'œuvre"}</Text><TouchableOpacity onPress={()=>onDelete(work.id)} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity></View><View style={{flexDirection:'row',gap:10}}><TextInput style={[{color:C.white,fontSize:13,paddingVertical:5},{flex:1}]} value={work.title} onChangeText={v=>onUpdate({...work,title:v})} placeholder="Titre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/><TextInput style={[{color:C.white,fontSize:13,paddingVertical:5},{width:68,textAlign:'center'}]} value={work.year} onChangeText={v=>onUpdate({...work,year:v})} placeholder="Année" placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="numeric" maxLength={4} selectionColor={C.white}/></View><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:9}}/><TextInput style={{color:C.white,fontSize:13,paddingVertical:5}} value={work.role} onChangeText={v=>onUpdate({...work,role:v})} placeholder="Votre rôle" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/><View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:9}}/><TextInput style={{color:C.white,fontSize:12,paddingVertical:5}} value={work.url} onChangeText={v=>onUpdate({...work,url:v})} placeholder="Lien optionnel" placeholderTextColor="rgba(255,255,255,0.14)" keyboardType="url" autoCapitalize="none" selectionColor={C.white}/></View>));

const SocRow=memo(({icon,label,value,onChange,placeholder}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;onChange:(v:string)=>void;placeholder:string})=>{const fa=useRef(new Animated.Value(0)).current;return(<View style={{flexDirection:'row',alignItems:'flex-end',gap:12,paddingHorizontal:PAD,paddingVertical:4,marginBottom:14}}><View style={{width:34,height:34,borderRadius:11,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:10}}><Ionicons name={icon} size={14} color={C.muted}/></View><View style={{flex:1}}><Text style={{color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:8}}>{label}</Text><TextInput style={{color:C.white,fontSize:13,paddingVertical:7}} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="url" autoCapitalize="none" autoCorrect={false} selectionColor={C.white} onFocus={()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start()} onBlur={()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start()}/><Animated.View style={{height:StyleSheet.hairlineWidth,backgroundColor:fa.interpolate({inputRange:[0,1],outputRange:[C.border,C.borderFocus]})}}/></View></View>);});

const TabNav=memo(({active,onChange}:{active:Section;onChange:(s:Section)=>void})=>(<View style={{flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>{(['identity','cinema','network'] as Section[]).map((k,i)=>{const on=active===k;const labels=['Identité','Cinéma','Réseaux'];return(<TouchableOpacity key={k} style={{flex:1,alignItems:'center',paddingVertical:13,position:'relative'}} onPress={()=>onChange(k)} activeOpacity={0.80}><Text style={{color:on?C.white:C.muted,fontSize:12,fontWeight:on?'700':'600',letterSpacing:0.2}}>{labels[i]}</Text>{on&&<View style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:1,backgroundColor:C.white}}/>}</TouchableOpacity>);})}></View>));

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function EditProfileScreen(){
  const router=useRouter();
  const[userId,setUserId]=useState('');
  const[form,setForm]=useState<ProfileForm>(EMPTY);
  const[avatarUrl,setAvatarUrl]=useState('');
  const[avatarLoading,setAvatarLoading]=useState(false);
  const[loadingInit,setLoadingInit]=useState(true);
  const[saving,setSaving]=useState(false);
  const[errors,setErrors]=useState<Partial<Record<keyof ProfileForm,string>>>({});
  const[section,setSection]=useState<Section>('identity');
  const shakeX=useRef(new Animated.Value(0)).current;
  const successFade=useRef(new Animated.Value(0)).current;
  const debounce=useRef<ReturnType<typeof setTimeout>>();
  const scrollRef=useRef<ScrollView>(null);
  const formRef=useRef<ProfileForm>(EMPTY);
  const uidRef=useRef('');
  formRef.current=form;uidRef.current=userId;

  const{score,level,badges}=useGamification(userId);

  // ★ FIX NETLIFY — auth robuste
  useEffect(()=>{
    let mounted=true;
    const init=async()=>{
      try{
        const{data:{session}}=await supabase.auth.getSession();
        if(mounted&&session?.user?.id){setUserId(session.user.id);uidRef.current=session.user.id;return;}
        await new Promise(r=>setTimeout(r,600));
        const{data:{session:s2}}=await supabase.auth.getSession();
        if(!mounted)return;
        if(s2?.user?.id){setUserId(s2.user.id);uidRef.current=s2.user.id;}
        else{router.replace('/');return;}
      }catch(e){console.error('[edit] auth:',e);if(mounted){router.replace('/');}}
    };
    init();
    const{data:{subscription}}=supabase.auth.onAuthStateChange((_,s)=>{if(!mounted)return;if(s?.user?.id){setUserId(s.user.id);uidRef.current=s.user.id;}});
    return()=>{mounted=false;subscription.unsubscribe();clearTimeout(debounce.current);};
  },[]);

  useEffect(()=>{
    if(!userId)return;
    (async()=>{
      try{
        const p=await fetchProfile(userId);
        setForm(prev=>({...prev,...Object.fromEntries(Object.entries(p).filter(([k,v])=>k!=='avatar_url'&&v!=null))}));
        if(p.avatar_url)setAvatarUrl(p.avatar_url);
      }catch(e){console.error('[edit] fetch:',e);}
      finally{setLoadingInit(false);}
    })();
  },[userId]);

  const autoSave=useCallback(()=>{clearTimeout(debounce.current);debounce.current=setTimeout(async()=>{const uid=uidRef.current;if(!uid)return;try{await persistProfile(uid,formRef.current);}catch{}},2500);},[]);
  const patch=useCallback(<K extends keyof ProfileForm>(key:K,val:ProfileForm[K])=>{setForm(p=>({...p,[key]:val}));setErrors(p=>({...p,[key]:undefined}));autoSave();},[autoSave]);
  const toggleArr=useCallback((key:'specialties'|'open_to'|'festivals',item:string)=>{setForm(p=>{const arr=p[key] as string[];return{...p,[key]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]};});autoSave();},[autoSave]);
  const addWork=useCallback(()=>setForm(p=>({...p,notable_works:[...p.notable_works,{id:genId(),title:'',year:'',role:'',url:''}]})),[]);
  const updateWork=useCallback((w:NotableWork)=>setForm(p=>({...p,notable_works:p.notable_works.map(x=>x.id===w.id?w:x)})),[]);
  const deleteWork=useCallback((id:string)=>setForm(p=>({...p,notable_works:p.notable_works.filter(x=>x.id!==id)})),[]);

  // ★ UPLOAD AVATAR
  const handlePickAvatar=useCallback(async()=>{
    const{granted}=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!granted){Alert.alert('Permission requise','Autorisez l\'accès à votre galerie.');return;}
    const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.88,allowsEditing:true,aspect:[1,1]});
    if(res.canceled||!res.assets?.[0])return;
    setAvatarLoading(true);
    if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try{
      const url=await uploadAvatarToStorage(res.assets[0].uri,userId);
      if(!url){Alert.alert('Erreur','Upload impossible. Vérifiez le bucket "avatars" dans Supabase Storage.');setAvatarLoading(false);return;}
      setAvatarUrl(url);
      // UPDATE profiles.avatar_url → propagé vers profile.tsx + CustomNavBar via realtime
      await supabase.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',userId);
      if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    }catch(e){console.error('[edit] avatar:',e);Alert.alert('Erreur','Impossible d\'uploader la photo.');}
    finally{setAvatarLoading(false);}
  },[userId]);

  const validate=useCallback(():boolean=>{const e:Partial<Record<keyof ProfileForm,string>>={};const ue=validateUsername(form.username);if(ue)e.username=ue;if(!validUrl(form.website))e.website='URL invalide (https://…)';if(!validEmail(form.contact_email))e.contact_email='Email invalide';setErrors(e);if(e.username||e.display_name)setSection('identity');else if(e.website||e.contact_email)setSection('network');return Object.keys(e).length===0;},[form]);

  const handleSave=useCallback(async()=>{
    if(!userId||saving)return;
    if(!validate()){Animated.sequence([Animated.timing(shakeX,{toValue:8,duration:55,useNativeDriver:true}),Animated.timing(shakeX,{toValue:-8,duration:55,useNativeDriver:true}),Animated.timing(shakeX,{toValue:0,duration:45,useNativeDriver:true})]).start();if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});return;}
    setSaving(true);
    try{clearTimeout(debounce.current);await persistProfile(userId,form);if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});Animated.sequence([Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),Animated.delay(1600),Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true})]).start();setTimeout(()=>router.back(),120);}
    catch(e:any){Alert.alert('Erreur',e?.message??'Vérifiez votre connexion.');}
    finally{setSaving(false);}
  },[userId,form,validate,saving,shakeX,successFade,router]);

  if(loadingInit)return(<View style={{flex:1,backgroundColor:C.bg}}><GalaxyBackground/><View style={{flex:1,alignItems:'center',justifyContent:'center',gap:16}}><ActivityIndicator color={C.white} size="large"/><Text style={{color:C.muted,fontSize:14}}>Chargement du profil…</Text></View></View>);

  const renderIdentity=()=>(<>
    <AvatarPreview name={form.display_name||form.username||'?'} avatarUrl={avatarUrl} level={level.n} isPro={form.is_pro} loading={avatarLoading} onPress={handlePickAvatar}/>
    <GamiBanner level={level} score={score} badges={badges}/>
    <Field label="Nom d'affichage" value={form.display_name} onChange={v=>patch('display_name',v)} placeholder="Cinéaste Anonyme" maxLength={60} icon="person-outline"/>
    <Field label="Nom d'utilisateur" value={form.username} onChange={v=>patch('username',v.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="monprofil" maxLength={30} icon="at-outline" error={errors.username} hint="Lettres, chiffres, . _ - uniquement"/>
    <Field label="Biographie" value={form.bio} onChange={v=>patch('bio',v)} placeholder="Votre démarche artistique, inspirations, parcours…" multiline maxLength={300} icon="create-outline"/>
    <Divider/>
    <SHead label="Rôle principal" desc="Votre activité dans le cinéma indépendant" badge={ROLES.find(r=>r.key===form.role)?.label}/>
    <RoleGrid selected={form.role} onChange={v=>patch('role',v)}/>
    <Divider/>
    <Field label="Localisation" value={form.location} onChange={v=>patch('location',v)} placeholder="Paris, France" icon="location-outline"/>
  </>);

  const renderCinema=()=>(<>
    <SHead label="Genres maîtrisés" badge={form.specialties.length>0?`${form.specialties.length}`:undefined}/>
    <Chips items={GENRES} selected={form.specialties} onToggle={item=>toggleArr('specialties',item)}/>
    <Divider/>
    <Field label="Équipement & outils" value={form.equipment} onChange={v=>patch('equipment',v)} placeholder="Caméras, logiciels de montage…" multiline maxLength={220} icon="camera-outline"/>
    <Divider/>
    <SHead label="Festivals" badge={form.festivals.length>0?`${form.festivals.length}`:undefined}/>
    <Chips items={FESTIVALS} selected={form.festivals} onToggle={item=>toggleArr('festivals',item)}/>
    <Divider/>
    <SHead label="Œuvres notables" badge={form.notable_works.length>0?`${form.notable_works.length}`:undefined}/>
    {form.notable_works.map(w=><WorkCard key={w.id} work={w} onUpdate={updateWork} onDelete={deleteWork}/>)}
    <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:PAD,marginTop:4,marginBottom:8,paddingVertical:13,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',backgroundColor:C.glass}} onPress={addWork} activeOpacity={0.80}><Ionicons name="add" size={14} color={C.muted}/><Text style={{color:C.muted,fontSize:12,fontWeight:'600'}}>Ajouter une œuvre</Text></TouchableOpacity>
    <Divider/>
    <SHead label="Disponibilités" badge={form.open_to.length>0?`${form.open_to.length}`:undefined}/>
    <Chips items={COLLABS} selected={form.open_to} onToggle={item=>toggleArr('open_to',item)}/>
    <Divider mt={24} mb={0}/>
    <Toggle label="Professionnel du secteur" subtitle="Activité dans l'industrie cinématographique" value={form.is_pro} onChange={v=>patch('is_pro',v)}/>
    <Toggle label="Contact professionnel" subtitle="Visible par vos connexions Universe" value={form.is_industry_contact} onChange={v=>patch('is_industry_contact',v)}/>
    {form.is_industry_contact&&(<><Divider mt={8} mb={8}/><Field label="Email professionnel" value={form.contact_email} onChange={v=>patch('contact_email',v)} placeholder="contact@exemple.com" keyboardType="email-address" icon="mail-outline" error={errors.contact_email}/></>)}
  </>);

  const renderNetwork=()=>(<>
    <SHead label="Site web & portfolio"/>
    <Field label="URL du portfolio" value={form.website} onChange={v=>patch('website',v)} placeholder="https://monportfolio.com" keyboardType="url" icon="globe-outline" error={errors.website}/>
    <Divider/>
    <SHead label="Réseaux sociaux" desc="Liens vers vos profils professionnels"/>
    <SocRow icon="logo-instagram" label="Instagram" value={form.social_instagram} onChange={v=>patch('social_instagram',v)} placeholder="https://instagram.com/monprofil"/>
    <SocRow icon="videocam-outline" label="Vimeo" value={form.social_vimeo} onChange={v=>patch('social_vimeo',v)} placeholder="https://vimeo.com/monprofil"/>
    <SocRow icon="logo-youtube" label="YouTube" value={form.social_youtube} onChange={v=>patch('social_youtube',v)} placeholder="https://youtube.com/@machaîne"/>
    <SocRow icon="film-outline" label="IMDb" value={form.social_imdb} onChange={v=>patch('social_imdb',v)} placeholder="https://imdb.com/name/nm..."/>
    {[form.social_instagram,form.social_vimeo,form.social_youtube,form.social_imdb,form.website].filter(Boolean).length>0&&(
      <View style={{marginHorizontal:PAD,marginTop:20,padding:14,borderRadius:13,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
        <Text style={{color:C.muted,fontSize:9.5,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:10}}>Liens renseignés</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{form.website&&<View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:18,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="globe-outline" size={10} color={C.muted}/><Text style={{color:C.muted,fontSize:10,fontWeight:'500'}}>Portfolio</Text></View>}{form.social_instagram&&<View style={{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:11,paddingVertical:5,borderRadius:18,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Ionicons name="logo-instagram" size={10} color={C.muted}/><Text style={{color:C.muted,fontSize:10,fontWeight:'500'}}>Instagram</Text></View>}</View>
      </View>
    )}
  </>);

  return(
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <Animated.View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12,transform:[{translateX:shakeX}]}}>
          <TouchableOpacity onPress={()=>router.back()} style={{width:36,height:36,borderRadius:18,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}} activeOpacity={0.80}><Ionicons name="chevron-back" size={18} color={C.white}/></TouchableOpacity>
          <View style={{flex:1}}>
            <View style={{flexDirection:'row',alignItems:'center',gap:7}}>
              <Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:2,textTransform:'uppercase'}}>UNIVERSE</Text>
              <View style={{width:1,height:9,backgroundColor:C.border}}/>
              <Text style={{color:C.white,fontSize:16,fontWeight:'800',letterSpacing:-0.2}}>Mon profil</Text>
            </View>
            <Text style={{color:C.muted,fontSize:11,marginTop:1,fontStyle:'italic'}}>Cinéma indépendant</Text>
          </View>
          <TouchableOpacity style={[{paddingHorizontal:16,paddingVertical:9,borderRadius:22,backgroundColor:C.white,minWidth:110,alignItems:'center'},saving&&{opacity:0.55}]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving?<ActivityIndicator color={C.bg} size="small" style={{width:88}}/>:<Text style={{color:C.bg,fontSize:13,fontWeight:'700'}}>Sauvegarder</Text>}
          </TouchableOpacity>
        </Animated.View>
        <TabNav active={section} onChange={sec=>{setSection(sec);scrollRef.current?.scrollTo({y:0,animated:true});}}/>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={96}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:100}}>
            {section==='identity'&&renderIdentity()}
            {section==='cinema'&&renderCinema()}
            {section==='network'&&renderNetwork()}
            <Animated.View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:18,opacity:successFade}}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.success}/>
              <Text style={{color:C.success,fontSize:13,fontWeight:'600'}}>Profil mis à jour</Text>
            </Animated.View>
            <Text style={{color:'rgba(255,255,255,0.16)',fontSize:11,textAlign:'center',marginTop:8}}>Sauvegarde automatique activée</Text>
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}