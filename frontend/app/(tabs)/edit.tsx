/**
 * app/edit.tsx — UNIVERSE · ÉDITION PROFIL
 * ★ persistAvatar → UPDATE profiles → realtime profile.tsx reçoit avatar instantanément
 * ★ persistProfile : UPDATE puis INSERT si 0 ligne (RLS-safe)
 * ★ Auto-save 2.5s · Validation inline · Sections Identité / Cinéma / Réseaux
 */
import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, KeyboardAvoidingView,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Image }        from 'expo-image';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { StatusBar }    from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics     from 'expo-haptics';
import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';

const FileSystem: any = Platform.select({
  native: () => { try { return require('expo-file-system'); } catch { return null; } },
  default: () => null,
})?.() ?? null;
let decode: ((s:string)=>ArrayBuffer)|null = null;
try { decode = require('base64-arraybuffer').decode; } catch {}

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#03000A', white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  muted:'rgba(255,255,255,0.36)', border:'rgba(255,255,255,0.10)',
  borderHi:'rgba(255,255,255,0.28)', borderFocus:'rgba(255,255,255,0.55)',
  glass:'rgba(255,255,255,0.04)', glassHi:'rgba(255,255,255,0.11)',
  success:'#22C55E', error:'#EF4444',
} as const;
const PAD = 20;

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ROLES = [
  {key:'director',label:'Réalisateur·rice',icon:'film-outline'},{key:'producer',label:'Producteur·rice',icon:'briefcase-outline'},
  {key:'writer',label:'Scénariste',icon:'create-outline'},{key:'actor',label:'Acteur·rice',icon:'people-outline'},
  {key:'dp',label:'Dir. photo',icon:'camera-outline'},{key:'editor',label:'Monteur·euse',icon:'cut-outline'},
  {key:'critic',label:'Critique',icon:'newspaper-outline'},{key:'creator',label:'Créateur·rice',icon:'sparkles-outline'},
  {key:'other',label:'Autre',icon:'ellipsis-horizontal-circle-outline'},
] as const;
const GENRES  = ['Drame','Thriller','Science-Fiction','Documentaire','Animation','Court-métrage','Expérimental','Biopic','Horreur','Comédie','Romance','Action','Fantastique','Policier','Musical'];
const COLLABS = ['Co-réalisation','Casting','Co-production','Scénarisation','Montage','Composition musicale','Direction photo','Distribution','Mentorat','Projection festival'];
const FESTIVALS = ['Cannes','Sundance','Berlin','Tribeca','SXSW','Toronto (TIFF)','Venise','Annecy','Hot Docs','Clermont-Ferrand','Rotterdam (IFFR)','AFI Fest','New York (NYFF)'];
const PROFILE_SELECT = 'display_name,username,bio,role,location,equipment,specialties,open_to,festivals,notable_works,is_industry_contact,is_pro,contact_email,website,social_instagram,social_vimeo,social_youtube,social_imdb,avatar_url';

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface NotableWork { id:string; title:string; year:string; role:string; url:string }
interface ProfileForm {
  display_name:string; username:string; bio:string; role:string; location:string; equipment:string;
  specialties:string[]; open_to:string[]; festivals:string[]; notable_works:NotableWork[];
  is_industry_contact:boolean; is_pro:boolean; contact_email:string; website:string;
  social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string;
}
const EMPTY: ProfileForm = { display_name:'',username:'',bio:'',role:'creator',location:'',equipment:'',specialties:[],open_to:[],festivals:[],notable_works:[],is_industry_contact:false,is_pro:false,contact_email:'',website:'',social_instagram:'',social_vimeo:'',social_youtube:'',social_imdb:'' };
type Section = 'identity'|'cinema'|'network';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const genId    = () => Math.random().toString(36).slice(2,9);
const validUrl = (u:string) => !u||/^https?:\/\/.+/.test(u);
const validEmail = (e:string) => !e||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function validateUsername(u:string): string|null {
  if(!u.trim()) return 'Champ obligatoire';
  if(u.length<3) return '3 caractères minimum';
  if(!/^[a-z0-9._-]+$/i.test(u)) return 'Lettres, chiffres, . _ - uniquement';
  return null;
}

// ─── DB ───────────────────────────────────────────────────────────────────────
async function fetchProfile(uid:string) {
  const {data,error} = await supabase.from('profiles').select(PROFILE_SELECT).eq('id',uid).maybeSingle();
  if(error) throw new Error(error.message);
  return (data??{}) as any;
}

async function persistProfile(uid:string, form:ProfileForm) {
  const p = { ...form, specialties:form.specialties??[], open_to:form.open_to??[], festivals:form.festivals??[], notable_works:form.notable_works??[], updated_at:new Date().toISOString() };
  const {error:upErr,count} = await supabase.from('profiles').update(p).eq('id',uid).select('id',{count:'exact',head:true});
  if(upErr||(count===0)) {
    const {error:inErr} = await supabase.from('profiles').insert({id:uid,...p});
    if(inErr) throw new Error(inErr.message);
  }
}


// ─── UI ───────────────────────────────────────────────────────────────────────
const Divider = memo(({mt=24,mb=8}:{mt?:number;mb?:number}) => (
  <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginHorizontal:PAD,marginTop:mt,marginBottom:mb}}/>
));

const SHead = memo(({label,desc,badge}:{label:string;desc?:string;badge?:string}) => (
  <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:PAD,paddingTop:32,paddingBottom:16}}>
    <View style={{flex:1}}>
      <Text style={{color:C.white,fontSize:13,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'}}>{label}</Text>
      {desc&&<Text style={{color:C.muted,fontSize:12,marginTop:4,lineHeight:17}}>{desc}</Text>}
    </View>
    {badge&&<View style={{paddingHorizontal:10,paddingVertical:3,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}><Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{badge}</Text></View>}
  </View>
));

const Field = memo(function Field({label,value,onChange,placeholder,multiline,maxLength,keyboardType='default',error,icon,hint}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;multiline?:boolean;maxLength?:number;keyboardType?:'default'|'email-address'|'url'|'numeric';error?:string|null;icon?:keyof typeof Ionicons.glyphMap;hint?:string}) {
  const fa = useRef(new Animated.Value(0)).current;
  const onF = useCallback(()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start(),[fa]);
  const onB = useCallback(()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start(),[fa]);
  const lC = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.border,error?C.error:C.borderFocus]});
  const lbC = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.muted,error?C.error:C.offWhite]});
  return (
    <View style={{paddingHorizontal:PAD,marginBottom:20}}>
      <Animated.Text style={{fontSize:10,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:10,color:lbC}}>{label}</Animated.Text>
      <View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
        {icon&&<Ionicons name={icon} size={15} color={C.muted} style={{paddingBottom:12}}/>}
        <TextInput style={[{flex:1,color:C.white,fontSize:15,paddingVertical:10,lineHeight:21},multiline&&{minHeight:90,textAlignVertical:'top',paddingTop:8}]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" multiline={multiline} maxLength={maxLength} keyboardType={keyboardType} autoCapitalize={keyboardType==='email-address'||keyboardType==='url'?'none':'sentences'} autoCorrect={false} selectionColor={C.white} onFocus={onF} onBlur={onB} returnKeyType={multiline?'default':'next'} numberOfLines={multiline?4:1}/>
        {!!maxLength&&value.length>maxLength*0.75&&<Text style={{color:C.muted,fontSize:10,paddingBottom:12}}>{value.length}/{maxLength}</Text>}
      </View>
      <Animated.View style={{height:StyleSheet.hairlineWidth,marginTop:2,backgroundColor:lC}}/>
      {error&&<Text style={{color:C.error,fontSize:11,marginTop:6}}>{error}</Text>}
      {hint&&!error&&<Text style={{color:C.muted,fontSize:11,marginTop:6,lineHeight:16}}>{hint}</Text>}
    </View>
  );
});

const Toggle = memo(function Toggle({label,subtitle,value,onChange}:{label:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}) {
  const a = useRef(new Animated.Value(value?1:0)).current;
  useEffect(()=>{ Animated.spring(a,{toValue:value?1:0,tension:120,friction:9,useNativeDriver:false}).start(); },[value,a]);
  return (
    <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:PAD,paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}} onPress={()=>{if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onChange(!value);}} activeOpacity={0.80}>
      <View style={{flex:1,gap:3}}><Text style={{color:C.offWhite,fontSize:14,fontWeight:'600'}}>{label}</Text>{subtitle&&<Text style={{color:C.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text>}</View>
      <Animated.View style={{width:46,height:26,borderRadius:13,justifyContent:'center',borderWidth:1,borderColor:C.border,backgroundColor:a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.10)','rgba(255,255,255,0.80)']})}}>
        <Animated.View style={{width:22,height:22,borderRadius:11,transform:[{translateX:a.interpolate({inputRange:[0,1],outputRange:[2,22]})}],backgroundColor:a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.55)','#03000A']})}}/>
      </Animated.View>
    </TouchableOpacity>
  );
});

const Chips = memo(({items,selected,onToggle}:{items:string[];selected:string[];onToggle:(v:string)=>void}) => (
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:PAD}}>
    {items.map(item=>{ const on=selected.includes(item); return (
      <TouchableOpacity key={item} style={[ch.chip,on&&ch.on]} onPress={()=>onToggle(item)} activeOpacity={0.75}>
        {on&&<Ionicons name="checkmark" size={10} color={C.bg}/>}
        <Text style={[{color:C.muted,fontSize:12,fontWeight:'500'},on&&{color:C.bg,fontWeight:'700'}]}>{item}</Text>
      </TouchableOpacity>
    );})}
  </View>
));
const ch = StyleSheet.create({ chip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:24,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}, on:{backgroundColor:C.white,borderColor:C.white} });

const RoleGrid = memo(({selected,onChange}:{selected:string;onChange:(v:string)=>void}) => (
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:PAD}}>
    {ROLES.map(r=>{ const on=selected===r.key; return (
      <TouchableOpacity key={r.key} style={[rg.item,on&&rg.on]} onPress={()=>onChange(r.key)} activeOpacity={0.80}>
        <Ionicons name={r.icon} size={17} color={on?C.bg:C.muted}/>
        <Text style={[{color:C.muted,fontSize:10,fontWeight:'500',textAlign:'center'},on&&{color:C.bg,fontWeight:'700'}]} numberOfLines={2}>{r.label}</Text>
      </TouchableOpacity>
    );})}
  </View>
));
const rg = StyleSheet.create({ item:{width:'30%',flexGrow:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}, on:{backgroundColor:C.white,borderColor:C.white} });

const WorkCard = memo(({work,onUpdate,onDelete}:{work:NotableWork;onUpdate:(w:NotableWork)=>void;onDelete:(id:string)=>void}) => (
  <View style={wc.wrap}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14}}>
      <View style={{width:4,height:4,borderRadius:2,backgroundColor:C.white}}/>
      <Text style={{flex:1,color:C.offWhite,fontSize:12,fontWeight:'600'}} numberOfLines={1}>{work.title||'Titre'}</Text>
      <TouchableOpacity onPress={()=>onDelete(work.id)} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
    </View>
    <View style={{flexDirection:'row',gap:10}}>
      <TextInput style={[wc.inp,{flex:1}]} value={work.title} onChangeText={v=>onUpdate({...work,title:v})} placeholder="Titre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
      <TextInput style={[wc.inp,{width:68,textAlign:'center'}]} value={work.year} onChangeText={v=>onUpdate({...work,year:v})} placeholder="Année" placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="numeric" maxLength={4} selectionColor={C.white}/>
    </View>
    <View style={wc.sep}/>
    <TextInput style={wc.inp} value={work.role} onChangeText={v=>onUpdate({...work,role:v})} placeholder="Votre rôle sur cette œuvre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
    <View style={wc.sep}/>
    <TextInput style={[wc.inp,{fontSize:12}]} value={work.url} onChangeText={v=>onUpdate({...work,url:v})} placeholder="Lien optionnel (https://…)" placeholderTextColor="rgba(255,255,255,0.14)" keyboardType="url" autoCapitalize="none" selectionColor={C.white}/>
  </View>
));
const wc = StyleSheet.create({ wrap:{marginHorizontal:PAD,marginBottom:12,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.glass,padding:16}, inp:{color:C.white,fontSize:13,paddingVertical:6}, sep:{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:10} });

const SocRow = memo(({icon,label,value,onChange,placeholder}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;onChange:(v:string)=>void;placeholder:string}) => {
  const fa=useRef(new Animated.Value(0)).current;
  const lC=fa.interpolate({inputRange:[0,1],outputRange:[C.border,C.borderFocus]});
  return (
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:14,paddingHorizontal:PAD,paddingVertical:6,marginBottom:14}}>
      <View style={{width:36,height:36,borderRadius:12,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:10}}><Ionicons name={icon} size={15} color={C.muted}/></View>
      <View style={{flex:1}}>
        <Text style={{color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:8}}>{label}</Text>
        <TextInput style={{color:C.white,fontSize:13,paddingVertical:8}} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="url" autoCapitalize="none" autoCorrect={false} selectionColor={C.white} onFocus={()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start()} onBlur={()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start()}/>
        <Animated.View style={{height:StyleSheet.hairlineWidth,backgroundColor:lC}}/>
      </View>
    </View>
  );
});

const TabNav = memo(({active,onChange}:{active:Section;onChange:(s:Section)=>void}) => (
  <View style={{flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
    {(['identity','cinema','network'] as Section[]).map((k,i)=>{ const on=active===k; const labels=['Identité','Cinéma','Réseaux']; return (
      <TouchableOpacity key={k} style={{flex:1,alignItems:'center',paddingVertical:14,position:'relative'}} onPress={()=>onChange(k)} activeOpacity={0.80}>
        <Text style={{color:on?C.white:C.muted,fontSize:12,fontWeight:on?'700':'600',letterSpacing:0.3}}>{labels[i]}</Text>
        {on&&<View style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:1,backgroundColor:C.white}}/>}
      </TouchableOpacity>
    );})}
  </View>
));

// ★ AvatarPicker — affiche l'avatar sélectionné ou un placeholder neutre
const AvatarPicker = memo(({avatarUrl,loading,username,onPress}:{avatarUrl:string;loading:boolean;username:string;onPress:()=>void}) => {
  const src = avatarUrl;
  return (
    <View style={{flexDirection:'row',alignItems:'center',gap:20,paddingHorizontal:PAD,paddingVertical:24}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{position:'relative'}}>
        <Image source={{uri:src}} style={{width:80,height:80,borderRadius:40,borderWidth:1,borderColor:C.borderHi}} contentFit="cover"/>
        <View style={{position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.bg}}>
          {loading?<ActivityIndicator color={C.bg} size="small"/>:<Ionicons name="camera-outline" size={14} color={C.bg}/>}
        </View>
      </TouchableOpacity>
      <View style={{flex:1,gap:6}}>
        <Text style={{color:C.white,fontSize:14,fontWeight:'600'}}>Photo de profil</Text>
        <Text style={{color:C.muted,fontSize:11,lineHeight:16}}>Format carré · JPEG ou PNG</Text>
        <TouchableOpacity onPress={onPress} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,alignSelf:'flex-start',marginTop:4}} activeOpacity={0.80}>
          <Text style={{color:C.offWhite,fontSize:12,fontWeight:'600'}}>{avatarUrl?'Modifier':'Ajouter une photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();
  const [userId,setUserId]             = useState('');
  const [form,setForm]                 = useState<ProfileForm>(EMPTY);
  const [avatarUrl,setAvatarUrl]       = useState('');
  const [loadingInit,setLoadingInit]   = useState(true);
  const [saving,setSaving]             = useState(false);
  const [errors,setErrors]             = useState<Partial<Record<keyof ProfileForm,string>>>({});
  const [section,setSection]           = useState<Section>('identity');
  const [avatarLoading,setAvatarLoading] = useState(false);
  const shakeX      = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const debounce    = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef   = useRef<ScrollView>(null);
  const formRef     = useRef<ProfileForm>(EMPTY);
  const uidRef      = useRef('');
  formRef.current   = form;
  uidRef.current    = userId;

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser();
      if(!user){router.replace('/');return;}
      setUserId(user.id); uidRef.current=user.id;
      try {
        const p = await fetchProfile(user.id);
        setForm(prev=>({...prev,...Object.fromEntries(Object.entries(p).filter(([,v])=>v!=null))}));
        if(p.avatar_url) setAvatarUrl(p.avatar_url);
      } catch(e){if(__DEV__)console.warn('[edit]',e);}
      finally{setLoadingInit(false);}
    })();
    return()=>clearTimeout(debounce.current);
  },[]);

  const autoSave = useCallback(()=>{
    clearTimeout(debounce.current);
    debounce.current=setTimeout(async()=>{ const uid=uidRef.current; if(!uid)return; try{await persistProfile(uid,formRef.current);}catch{} },2500);
  },[]);

  const patch = useCallback(<K extends keyof ProfileForm>(key:K, val:ProfileForm[K])=>{
    setForm(p=>({...p,[key]:val})); setErrors(p=>({...p,[key]:undefined})); autoSave();
  },[autoSave]);

  const toggleArr = useCallback((key:'specialties'|'open_to'|'festivals', item:string)=>{
    setForm(p=>{ const arr=p[key] as string[]; return {...p,[key]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]}; }); autoSave();
  },[autoSave]);

  const addWork    = useCallback(()=>setForm(p=>({...p,notable_works:[...p.notable_works,{id:genId(),title:'',year:'',role:'',url:''}]})),[]);
  const updateWork = useCallback((w:NotableWork)=>setForm(p=>({...p,notable_works:p.notable_works.map(x=>x.id===w.id?w:x)})),[]);
  const deleteWork = useCallback((id:string)=>setForm(p=>({...p,notable_works:p.notable_works.filter(x=>x.id!==id)})),[]);

  const validate = useCallback(():boolean=>{
    const e:Partial<Record<keyof ProfileForm,string>>={};
    const ue=validateUsername(form.username); if(ue)e.username=ue;
    if(!validUrl(form.website))e.website='URL invalide (https://…)';
    if(!validEmail(form.contact_email))e.contact_email='Email invalide';
    setErrors(e);
    if(e.username||e.display_name)setSection('identity'); else if(e.website||e.contact_email)setSection('network');
    return Object.keys(e).length===0;
  },[form]);

  const handleSave = useCallback(async()=>{
    if(!userId||saving) return;
    if(!validate()){
      Animated.sequence([Animated.timing(shakeX,{toValue:8,duration:55,useNativeDriver:true}),Animated.timing(shakeX,{toValue:-8,duration:55,useNativeDriver:true}),Animated.timing(shakeX,{toValue:0,duration:45,useNativeDriver:true})]).start();
      if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
      return;
    }
    setSaving(true);
    try {
      clearTimeout(debounce.current);
      await persistProfile(userId,form);
      if(Platform.OS!=='web')Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      Animated.sequence([Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),Animated.delay(1600),Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true})]).start();
      setTimeout(()=>router.back(),120);
    } catch(e:any){ Alert.alert('Erreur',e?.message??'Vérifiez votre connexion.'); }
    finally{setSaving(false);}
  },[userId,form,validate,saving,shakeX,successFade,router]);

  // ★ handleAvatar : upload → persistAvatar → setAvatarUrl
  // → UPDATE profiles.avatar_url → realtime profile.tsx reçoit le nouvel avatar
  const handleAvatar = useCallback(async()=>{
    const {granted}=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if(!granted){Alert.alert('Permission requise','Autorisez la galerie.');return;}
    const res=await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.88,allowsEditing:true,aspect:[1,1]});
    if(res.canceled||!res.assets?.[0]) return;
    setAvatarLoading(true);
    if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try {
      const url=await persistAvatar(userId,res.assets[0].uri);
      setAvatarUrl(url); // ★ Profile.tsx reçoit la MAJ via realtime UPDATE profiles
    } catch(e:any){ Alert.alert('Erreur upload',e?.message??'Impossible d\'uploader.'); }
    finally{setAvatarLoading(false);}
  },[userId]);

  if(loadingInit) return (
    <View style={s.root}><GalaxyBackground/>
      <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:16}}>
        <ActivityIndicator color={C.white} size="large"/>
        <Text style={{color:C.muted,fontSize:14}}>Chargement du profil…</Text>
      </View>
    </View>
  );

  const renderIdentity = () => (<>
    <AvatarPicker avatarUrl={avatarUrl} loading={avatarLoading} username={form.username} onPress={handleAvatar}/>
    <Field label="Nom d'affichage" value={form.display_name} onChange={v=>patch('display_name',v)} placeholder="Cinéaste Anonyme" maxLength={60} icon="person-outline"/>
    <Field label="Nom d'utilisateur" value={form.username} onChange={v=>patch('username',v.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="monprofil" maxLength={30} icon="at-outline" error={errors.username} hint="Lettres, chiffres, . _ - uniquement"/>
    <Field label="Biographie" value={form.bio} onChange={v=>patch('bio',v)} placeholder="Décrivez votre parcours, votre démarche artistique…" multiline maxLength={300} icon="create-outline"/>
    <Divider/>
    <SHead label="Rôle principal" desc="Votre activité principale dans le cinéma" badge={ROLES.find(r=>r.key===form.role)?.label}/>
    <RoleGrid selected={form.role} onChange={v=>patch('role',v)}/>
    <Divider/>
    <Field label="Localisation" value={form.location} onChange={v=>patch('location',v)} placeholder="Paris, France" icon="location-outline"/>
  </>);

  const renderCinema = () => (<>
    <SHead label="Genres maîtrisés" badge={form.specialties.length>0?`${form.specialties.length}`:undefined}/>
    <Chips items={GENRES} selected={form.specialties} onToggle={item=>toggleArr('specialties',item)}/>
    <Divider/>
    <Field label="Équipement et outils" value={form.equipment} onChange={v=>patch('equipment',v)} placeholder="Caméras, logiciels, post-production…" multiline maxLength={220} icon="camera-outline" hint="Ex : Sony FX6, DaVinci Resolve, ProRes RAW…"/>
    <Divider/>
    <SHead label="Festivals" badge={form.festivals.length>0?`${form.festivals.length}`:undefined}/>
    <Chips items={FESTIVALS} selected={form.festivals} onToggle={item=>toggleArr('festivals',item)}/>
    <Divider/>
    <SHead label="Œuvres notables" badge={form.notable_works.length>0?`${form.notable_works.length}`:undefined}/>
    {form.notable_works.map(w=><WorkCard key={w.id} work={w} onUpdate={updateWork} onDelete={deleteWork}/>)}
    <TouchableOpacity style={s.addBtn} onPress={addWork} activeOpacity={0.80}>
      <Ionicons name="add" size={14} color={C.muted}/>
      <Text style={s.addBtnTxt}>Ajouter une œuvre</Text>
    </TouchableOpacity>
    <Divider/>
    <SHead label="Disponibilités" badge={form.open_to.length>0?`${form.open_to.length}`:undefined}/>
    <Chips items={COLLABS} selected={form.open_to} onToggle={item=>toggleArr('open_to',item)}/>
    <Divider mt={24} mb={0}/>
    <Toggle label="Professionnel du secteur" subtitle="Activité dans l'industrie cinéma" value={form.is_pro} onChange={v=>patch('is_pro',v)}/>
    <Toggle label="Disponible pour contact pro" subtitle="Email visible par vos connexions Universe" value={form.is_industry_contact} onChange={v=>patch('is_industry_contact',v)}/>
    {form.is_industry_contact&&<><Divider mt={8} mb={8}/><Field label="Email professionnel" value={form.contact_email} onChange={v=>patch('contact_email',v)} placeholder="contact@exemple.com" keyboardType="email-address" icon="mail-outline" error={errors.contact_email}/></>}
  </>);

  const renderNetwork = () => (<>
    <SHead label="Site web et portfolio"/>
    <Field label="URL du portfolio" value={form.website} onChange={v=>patch('website',v)} placeholder="https://monportfolio.com" keyboardType="url" icon="globe-outline" error={errors.website}/>
    <Divider/>
    <SHead label="Réseaux sociaux" desc="Liens vers vos profils professionnels"/>
    <SocRow icon="logo-instagram" label="Instagram" value={form.social_instagram} onChange={v=>patch('social_instagram',v)} placeholder="https://instagram.com/monprofil"/>
    <SocRow icon="videocam-outline" label="Vimeo" value={form.social_vimeo} onChange={v=>patch('social_vimeo',v)} placeholder="https://vimeo.com/monprofil"/>
    <SocRow icon="logo-youtube" label="YouTube" value={form.social_youtube} onChange={v=>patch('social_youtube',v)} placeholder="https://youtube.com/@machaîne"/>
    <SocRow icon="film-outline" label="IMDb" value={form.social_imdb} onChange={v=>patch('social_imdb',v)} placeholder="https://imdb.com/name/nm..."/>
    {[form.social_instagram,form.social_vimeo,form.social_youtube,form.social_imdb,form.website].filter(Boolean).length>0&&(
      <View style={s.links}>
        <Text style={s.linksLbl}>Liens renseignés</Text>
        <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
          {form.website&&<View style={s.pill}><Ionicons name="globe-outline" size={11} color={C.muted}/><Text style={s.pillTxt}>Portfolio</Text></View>}
          {form.social_instagram&&<View style={s.pill}><Ionicons name="logo-instagram" size={11} color={C.muted}/><Text style={s.pillTxt}>Instagram</Text></View>}
          {form.social_vimeo&&<View style={s.pill}><Ionicons name="videocam-outline" size={11} color={C.muted}/><Text style={s.pillTxt}>Vimeo</Text></View>}
          {form.social_youtube&&<View style={s.pill}><Ionicons name="logo-youtube" size={11} color={C.muted}/><Text style={s.pillTxt}>YouTube</Text></View>}
          {form.social_imdb&&<View style={s.pill}><Ionicons name="film-outline" size={11} color={C.muted}/><Text style={s.pillTxt}>IMDb</Text></View>}
        </View>
      </View>
    )}
  </>);

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <Animated.View style={[s.nav,{transform:[{translateX:shakeX}]}]}>
          <TouchableOpacity onPress={()=>router.back()} style={s.navBack} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={18} color={C.white}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={s.navTitle}>Modifier le profil</Text>
            {form.display_name&&<Text style={{color:C.muted,fontSize:11,marginTop:1}}>{form.display_name}</Text>}
          </View>
          <TouchableOpacity style={[s.saveBtn,saving&&{opacity:0.55}]} onPress={handleSave} disabled={saving} activeOpacity={0.85}>
            {saving?<ActivityIndicator color={C.bg} size="small" style={{width:80}}/>:<Text style={s.saveBtnTxt}>Sauvegarder</Text>}
          </TouchableOpacity>
        </Animated.View>
        <TabNav active={section} onChange={s=>{setSection(s);scrollRef.current?.scrollTo({y:0,animated:true});}}/>
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={96}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:100}}>
            {section==='identity'&&renderIdentity()}
            {section==='cinema'&&renderCinema()}
            {section==='network'&&renderNetwork()}
            <Animated.View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:16,opacity:successFade}}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.success}/>
              <Text style={{color:C.success,fontSize:13,fontWeight:'600'}}>Profil mis à jour</Text>
            </Animated.View>
            <Text style={{color:'rgba(255,255,255,0.18)',fontSize:11,textAlign:'center',marginTop:8}}>Sauvegarde automatique activée</Text>
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root:      {flex:1,backgroundColor:C.bg},
  nav:       {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12},
  navBack:   {width:36,height:36,borderRadius:18,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  navTitle:  {color:C.white,fontSize:17,fontWeight:'700',letterSpacing:-0.2},
  saveBtn:   {paddingHorizontal:16,paddingVertical:9,borderRadius:22,backgroundColor:C.white,minWidth:110,alignItems:'center'},
  saveBtnTxt:{color:C.bg,fontSize:13,fontWeight:'700'},
  addBtn:    {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:PAD,marginTop:4,marginBottom:8,paddingVertical:13,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',backgroundColor:C.glass},
  addBtnTxt: {color:C.muted,fontSize:12,fontWeight:'600'},
  links:     {marginHorizontal:PAD,marginTop:20,padding:16,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  linksLbl:  {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:12},
  pill:      {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  pillTxt:   {color:C.muted,fontSize:11,fontWeight:'500'},
});