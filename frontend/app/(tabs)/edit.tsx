/**
 * app/edit.tsx — UNIVERSE
 * ★ getDeviceId() — ZERO supabase.auth.* → fonctionne sans session
 * ★ persistProfile → upsert onConflict:'id' (plus de save silencieux)
 * ★ Storage avatars — bucket public, anon autorisé (via universe_setup.sql)
 * ★ Text node fix : template literals `${val}` partout, pas de mixing JSX
 * ★ Post-save → SecureStore 'profile_dirty' → CustomNavBar se rafraîchit
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image,
  KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { StatusBar }    from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics     from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { supabase }     from '@/lib/supabase';
import GalaxyBackground from '@/components/social/GalaxyBackground';
import { getDeviceId }  from '@/services/api';
import { useGamification } from '@/contexts/GamificationSystem';

// SecureStore — natif seulement
const SecureStore: any = Platform.select({
  native: () => { try { return require('expo-secure-store'); } catch { return null; } },
  default: () => null,
})?.() ?? null;

const FileSystem: any = Platform.select({
  native: () => { try { return require('expo-file-system'); } catch { return null; } },
  default: () => null,
})?.() ?? null;

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:'#03000A', navyMid:'#0D2040', navyLow:'#0A1830',
  white:'#FFFFFF', offWhite:'rgba(255,255,255,0.82)',
  mid:'rgba(255,255,255,0.55)', muted:'rgba(255,255,255,0.36)',
  faint:'rgba(255,255,255,0.07)', border:'rgba(255,255,255,0.10)',
  borderHi:'rgba(255,255,255,0.28)', borderFocus:'rgba(255,255,255,0.55)',
  glass:'rgba(255,255,255,0.04)', glassHi:'rgba(255,255,255,0.11)',
  success:'#22C55E', error:'#EF4444',
} as const;
const PAD = 20;

// ─── Référentiels ─────────────────────────────────────────────────────────────
const ROLES = [
  {key:'director', label:'Réalisateur·rice', icon:'film-outline'                       as const},
  {key:'producer', label:'Producteur·rice',  icon:'briefcase-outline'                  as const},
  {key:'writer',   label:'Scénariste',        icon:'create-outline'                     as const},
  {key:'actor',    label:'Acteur·rice',        icon:'people-outline'                     as const},
  {key:'dp',       label:'Dir. photo',         icon:'camera-outline'                     as const},
  {key:'editor',   label:'Monteur·euse',       icon:'cut-outline'                        as const},
  {key:'sound',    label:'Son',                icon:'musical-notes-outline'              as const},
  {key:'critic',   label:'Critique',           icon:'newspaper-outline'                  as const},
  {key:'creator',  label:'Créateur·rice',      icon:'sparkles-outline'                   as const},
  {key:'other',    label:'Autre',              icon:'ellipsis-horizontal-circle-outline' as const},
];
const PROFILE_SELECT = 'display_name,username,bio,role,location,equipment,specialties,open_to,festivals,notable_works,is_industry_contact,is_pro,contact_email,website,social_instagram,social_vimeo,social_youtube,social_imdb,avatar_url';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotableWork { id:string; title:string; year:string; role:string; url:string }
interface ProfileForm {
  display_name:string; username:string; bio:string; role:string; location:string;
  equipment:string; specialties:string[]; open_to:string[]; festivals:string[];
  notable_works:NotableWork[]; is_industry_contact:boolean; is_pro:boolean;
  contact_email:string; website:string; social_instagram:string;
  social_vimeo:string; social_youtube:string; social_imdb:string;
  avatar_url?:string; // ★ FIX: avatar_url must be part of the form to persist on save
}
const EMPTY: ProfileForm = {
  display_name:'', username:'', bio:'', role:'creator', location:'',
  equipment:'', specialties:[], open_to:[], festivals:[], notable_works:[],
  is_industry_contact:false, is_pro:false, contact_email:'', website:'',
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
  avatar_url:'', // ★ FIX: must be in EMPTY so fetchProfile patches it into form state
};
type Section = 'identity'|'network';


// ─── DB ───────────────────────────────────────────────────────────────────────
const validUrl   = (u:string) => !u || /^https?:\/\/.+/.test(u);
const validEmail = (e:string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function validateUsername(u:string):string|null {
  if (!u.trim()) return 'Champ obligatoire';
  if (u.length < 3) return '3 caractères minimum';
  if (!/^[a-z0-9._-]+$/i.test(u)) return 'Lettres, chiffres, . _ -';
  return null;
}

async function fetchProfile(uid:string): Promise<any> {
  const { data } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id',uid).maybeSingle();
  return data ?? {};
}

// ★ UPSERT — crée ou met à jour, jamais bloqué par la FK supprimée
async function persistProfile(uid:string, form:ProfileForm): Promise<void> {
  // ★ FIX: Never send empty avatar_url — it would overwrite the existing avatar in DB
  const payload: Record<string, any> = { id:uid, ...form, updated_at:new Date().toISOString() };
  if (!payload.avatar_url) delete payload.avatar_url;
  const { error } = await supabase.from('profiles').upsert(payload, { onConflict:'id' });
  if (error) {
    console.error('[edit] upsert error:', error.code, error.message);
    throw new Error(error.message);
  }
  // Signale aux autres composants (CustomNavBar)
  if (SecureStore) {
    SecureStore.setItemAsync('profile_dirty', String(Date.now())).catch(()=>{});
  }
}

// ─── Avatar upload ────────────────────────────────────────────────────────────
/**
 * ★ FIX CSP — data:URI parsé sans fetch() (bloqué par connect-src CSP sur web).
 *
 * Cas par cas :
 *  data:…   → atob() direct          (web + natif, jamais de fetch)
 *  blob:…   → fetch() OK             (blob: autorisé par CSP)
 *  http(s): → fetch() OK             (HTTPS autorisé par CSP)
 *  fichier natif → expo-file-system  (iOS/Android)
 */
function dataUriToBlob(dataUri: string): Blob {
  // data:[mime][;base64],[données]
  const comma   = dataUri.indexOf(',');
  const header  = dataUri.slice(0, comma);       // "data:image/jpeg;base64"
  const b64     = dataUri.slice(comma + 1);       // données base64
  const mime    = header.split(':')[1]?.split(';')[0] ?? 'image/jpeg';
  const byteStr = atob(b64);
  const bytes   = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadAvatar(uri: string, userId: string): Promise<string|null> {
  try {
    const path = `${userId}/avatar.jpg`;
    let blob: Blob;

    if (uri.startsWith('data:')) {
      // ★ Pas de fetch() → parse manuel pour respecter la CSP connect-src
      blob = dataUriToBlob(uri);
    } else if (uri.startsWith('blob:') || uri.startsWith('http')) {
      // blob: et https: sont autorisés par la CSP
      blob = await fetch(uri).then(r => r.blob());
    } else if (FileSystem) {
      // Natif iOS / Android — lecture base64 via expo-file-system
      const b64   = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const bytes = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      blob = await fetch(uri).then(r => r.blob());
    }

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
    return `${publicUrl}?t=${Date.now()}`;
  } catch (e) {
    console.error('[edit] avatar:', e);
    return null;
  }
}

// ─── MICRO UI ─────────────────────────────────────────────────────────────────
const Divider = memo(({mt=24,mb=8}:{mt?:number;mb?:number}) => (
  <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginHorizontal:PAD,marginTop:mt,marginBottom:mb}}/>
));

// Tous les labels/badges/hints : jamais de mixing JSX number+string dans View
const SHead = memo(({label,desc,badge}:{label:string;desc?:string;badge?:string}) => (
  <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:PAD,paddingTop:28,paddingBottom:14}}>
    <View style={{flex:1}}>
      <Text style={{color:C.white,fontSize:12,fontWeight:'700',letterSpacing:1.6,textTransform:'uppercase'}}>{label}</Text>
      {!!desc && <Text style={{color:C.muted,fontSize:12,marginTop:4,lineHeight:17}}>{desc}</Text>}
    </View>
    {!!badge && (
      <View style={{paddingHorizontal:9,paddingVertical:3,borderRadius:18,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
        <Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{badge}</Text>
      </View>
    )}
  </View>
));

const Field = memo(function Field({
  label, value, onChange, placeholder, multiline,
  maxLength, keyboardType='default', error, icon, hint,
}:{
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string;
  multiline?:boolean; maxLength?:number; keyboardType?:'default'|'email-address'|'url'|'numeric';
  error?:string|null; icon?:keyof typeof Ionicons.glyphMap; hint?:string;
}) {
  const fa  = useRef(new Animated.Value(0)).current;
  const onF = () => Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start();
  const onB = () => Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start();
  const bc  = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.border, error?C.error:C.borderFocus]});
  const lc  = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.muted,  error?C.error:C.offWhite]});
  // ★ Compteur : template literal pour éviter text node JSX mixte
  const counterLabel = maxLength != null && value.length > maxLength * 0.75
    ? `${value.length}/${maxLength}` : null;
  return (
    <View style={{paddingHorizontal:PAD,marginBottom:20}}>
      <Animated.Text style={{fontSize:9.5,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase',marginBottom:10,color:lc}}>{label}</Animated.Text>
      <View style={{flexDirection:'row',alignItems:'flex-end',gap:10}}>
        {!!icon && <Ionicons name={icon} size={15} color={C.muted} style={{paddingBottom:12}}/>}
        <TextInput
          style={[{flex:1,color:C.white,fontSize:15,paddingVertical:10,lineHeight:21},
                  multiline&&{minHeight:90,textAlignVertical:'top',paddingTop:8}]}
          value={value} onChangeText={onChange} placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.18)" multiline={multiline}
          maxLength={maxLength} keyboardType={keyboardType}
          autoCapitalize={keyboardType==='email-address'||keyboardType==='url'?'none':'sentences'}
          autoCorrect={false} selectionColor={C.white} onFocus={onF} onBlur={onB}
        />
        {!!counterLabel && (
          <Text style={{color:C.muted,fontSize:10,paddingBottom:12}}>{counterLabel}</Text>
        )}
      </View>
      <Animated.View style={{height:StyleSheet.hairlineWidth,marginTop:2,backgroundColor:bc}}/>
      {!!error && <Text style={{color:C.error,fontSize:11,marginTop:6}}>{error}</Text>}
      {!!hint && !error && <Text style={{color:C.muted,fontSize:11,marginTop:6,lineHeight:16}}>{hint}</Text>}
    </View>
  );
});

const Toggle = memo(function Toggle({label,subtitle,value,onChange}:{label:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}) {
  const a = useRef(new Animated.Value(value?1:0)).current;
  useEffect(() => {
    Animated.spring(a,{toValue:value?1:0,tension:120,friction:9,useNativeDriver:false}).start();
  }, [value]);
  const trackBg   = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.10)','rgba(255,255,255,0.80)']});
  const thumbBg   = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.55)','#03000A']});
  const thumbMove = a.interpolate({inputRange:[0,1],outputRange:[2,22]});
  return (
    <TouchableOpacity
      style={{flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:PAD,paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}
      onPress={() => { if(Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{}); onChange(!value); }}
      activeOpacity={0.80}
    >
      <View style={{flex:1,gap:3}}>
        <Text style={{color:C.offWhite,fontSize:14,fontWeight:'600'}}>{label}</Text>
        {!!subtitle && <Text style={{color:C.muted,fontSize:12,lineHeight:17}}>{subtitle}</Text>}
      </View>
      <Animated.View style={{width:46,height:26,borderRadius:13,justifyContent:'center',borderWidth:1,borderColor:C.border,backgroundColor:trackBg}}>
        <Animated.View style={{width:22,height:22,borderRadius:11,transform:[{translateX:thumbMove}],backgroundColor:thumbBg}}/>
      </Animated.View>
    </TouchableOpacity>
  );
});



const RoleGrid = memo(({selected,onChange}:{selected:string;onChange:(v:string)=>void}) => (
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:PAD}}>
    {ROLES.map(r => {
      const on = selected===r.key;
      return (
        <TouchableOpacity key={r.key} style={[rg.cell,on&&rg.cellOn]} onPress={()=>onChange(r.key)} activeOpacity={0.80}>
          <Ionicons name={r.icon} size={17} color={on?C.bg:C.muted}/>
          <Text style={[rg.lbl,on&&rg.lblOn]} numberOfLines={2}>{r.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
));
const rg = StyleSheet.create({
  cell:  {width:'30%',flexGrow:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  cellOn:{backgroundColor:C.white,borderColor:C.white},
  lbl:   {color:C.muted,fontSize:10,fontWeight:'500',textAlign:'center'},
  lblOn: {color:C.bg,fontWeight:'700'},
});


const SocRow = memo(({icon,label,value,onChange,placeholder}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;onChange:(v:string)=>void;placeholder:string}) => {
  const fa = useRef(new Animated.Value(0)).current;
  const bc = fa.interpolate({inputRange:[0,1],outputRange:[C.border,C.borderFocus]});
  return (
    <View style={{flexDirection:'row',alignItems:'flex-end',gap:12,paddingHorizontal:PAD,paddingVertical:4,marginBottom:14}}>
      <View style={{width:34,height:34,borderRadius:11,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:10}}>
        <Ionicons name={icon} size={14} color={C.muted}/>
      </View>
      <View style={{flex:1}}>
        <Text style={{color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:8}}>{label}</Text>
        <TextInput style={{color:C.white,fontSize:13,paddingVertical:7}} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="url" autoCapitalize="none" autoCorrect={false} selectionColor={C.white} onFocus={()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start()} onBlur={()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start()}/>
        <Animated.View style={{height:StyleSheet.hairlineWidth,backgroundColor:bc}}/>
      </View>
    </View>
  );
});

const TabNav = memo(({active,onChange}:{active:Section;onChange:(s:Section)=>void}) => {
  const LABELS: Record<Section,string> = {identity:'Identité',network:'Réseaux'};
  return (
    <View style={{flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
      {(['identity','network'] as Section[]).map(k => {
        const on = active===k;
        return (
          <TouchableOpacity key={k} style={{flex:1,alignItems:'center',paddingVertical:13,position:'relative'}} onPress={()=>onChange(k)} activeOpacity={0.80}>
            <Text style={{color:on?C.white:C.muted,fontSize:12,fontWeight:on?'700':'600',letterSpacing:0.2}}>{LABELS[k]}</Text>
            {on && <View style={{position:'absolute',bottom:0,left:'20%',right:'20%',height:1,backgroundColor:C.white}}/>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─── Avatar Preview ───────────────────────────────────────────────────────────
const AvatarPreview = memo(({name,url,isPro,loading,onPress,onWebChange}:{name:string;url:string;isPro:boolean;loading:boolean;onPress:()=>void;onWebChange?:(e:any)=>void}) => {
  const init = useMemo(() => (name||'?').trim().split(/\s+/).filter(Boolean).map((n:string)=>n[0]||'').join('').toUpperCase().slice(0,2)||'?',[name]);
  const [err,setErr] = useState(false);
  useEffect(() => setErr(false),[url]);
  const hasAvatar = !!(url&&!err);
  const photoLabel  = hasAvatar ? 'Photo de profil active' : 'Monogramme — ajoutez une photo';
  const actionLabel = hasAvatar ? 'Changer la photo' : 'Ajouter une photo';
  return (
    <View style={{flexDirection:'row',alignItems:'center',gap:20,paddingHorizontal:PAD,paddingVertical:22}}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{position:'relative'}}>
        <View style={{width:80,height:80,borderRadius:40,overflow:'hidden',borderWidth:1.5,borderColor:'rgba(255,255,255,0.22)',backgroundColor:C.navyMid}}>
          {hasAvatar
            ? <Image source={{uri:url}} style={{width:80,height:80}} resizeMode="cover" onError={()=>setErr(true)}/>
            : <View style={{flex:1,alignItems:'center',justifyContent:'center'}}><Text style={{color:C.white,fontSize:26,fontWeight:'900',letterSpacing:-0.5}}>{init}</Text></View>
          }
        </View>
        {isPro && (
          <View style={{position:'absolute',bottom:0,right:0,width:20,height:20,borderRadius:10,backgroundColor:C.navyMid,borderWidth:1.5,borderColor:'rgba(255,255,255,0.28)',alignItems:'center',justifyContent:'center'}}>
            <Ionicons name="checkmark" size={9} color={C.white}/>
          </View>
        )}
        <View style={{position:'absolute',bottom:0,left:0,width:26,height:26,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.bg}}>
          {loading
            ? <ActivityIndicator color={C.bg} size="small"/>
            : <Ionicons name="camera-outline" size={13} color={C.bg}/>
          }
        </View>
        {Platform.OS==='web'&&onWebChange&&React.createElement('input',{type:'file',accept:'image/*',onChange:onWebChange,style:{position:'absolute',top:0,left:0,width:80,height:80,opacity:0,cursor:'pointer',zIndex:10}})}
      </TouchableOpacity>
      <View style={{flex:1,gap:6}}>
        <Text style={{color:C.white,fontSize:15,fontWeight:'700'}}>{name||'Votre nom'}</Text>
        <Text style={{color:C.muted,fontSize:11,lineHeight:16}}>{photoLabel}</Text>
        <TouchableOpacity onPress={Platform.OS==='web'?()=>{}:onPress} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.22)',alignSelf:'flex-start',marginTop:2,position:'relative'}} activeOpacity={0.80}>
          <Text style={{color:C.offWhite,fontSize:12,fontWeight:'600'}}>{actionLabel}</Text>
          {Platform.OS==='web'&&onWebChange&&React.createElement('input',{type:'file',accept:'image/*',onChange:onWebChange,style:{position:'absolute',top:0,left:0,right:0,bottom:0,opacity:0,cursor:'pointer',zIndex:10}})}
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Gamification Banner ──────────────────────────────────────────────────────
const GamiBanner = memo(({level,score}:{level:{n:number;label:string;pct:number;nextAt:number};score:number}) => {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:level.pct,duration:900,useNativeDriver:false}).start();},[level.pct]);
  const barWidth = prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
  // ★ Toutes les valeurs numériques pré-calculées comme strings (fix text node)
  const levelStr   = `Niveau ${level.n}`;
  const scoreStr   = `${score} pts`;
  const ptsToNext  = Math.max(0, level.nextAt - score);
  const nextLabel  = `${ptsToNext} pts pour le niveau suivant`;
  return (
    <View style={{marginHorizontal:PAD,marginBottom:20,padding:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,backgroundColor:C.glass}}>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <View style={{width:42,height:42,borderRadius:21,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'}}>
          <Text style={{color:C.white,fontSize:14,fontWeight:'900'}}>{level.n}</Text>
        </View>
        <View style={{flex:1,gap:5}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
            <Text style={{color:C.white,fontSize:12,fontWeight:'700',flex:1}}>{level.label}</Text>
            <View style={{paddingHorizontal:8,paddingVertical:2,borderRadius:8,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
              <Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{scoreStr}</Text>
            </View>
          </View>
          <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
            <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{levelStr}</Text>
          </View>
          <View style={{height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.07)',overflow:'hidden'}}>
            <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:barWidth}}/>
          </View>
          {level.n < 10 && level.nextAt > score && (
            <Text style={{color:C.muted,fontSize:10}}>{nextLabel}</Text>
          )}
        </View>
      </View>
    </View>
  );
});

// ─── SCREEN ───────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router       = useRouter();
  const [userId,     setUserId]   = useState('');
  const [form,       setForm]     = useState<ProfileForm>(EMPTY);
  const [avatarUrl,  setAvUrl]    = useState('');
  const [avLoading,  setAVL]      = useState(false);
  const [loadingInit,setLI]       = useState(true);
  const [saving,     setSaving]   = useState(false);
  const [errors,     setErrors]   = useState<Partial<Record<keyof ProfileForm,string>>>({});
  const [section,    setSection]  = useState<Section>('identity');
  const [savedOk,    setSavedOk]  = useState(false);

  const shakeX      = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const debounce    = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef   = useRef<ScrollView>(null);
  const formRef     = useRef<ProfileForm>(EMPTY);
  const uidRef      = useRef('');
  formRef.current   = form;
  uidRef.current    = userId;

  const { profile: gamiProfile } = useGamification(userId, [], { skipBadges: true });
  const score = gamiProfile.xp;
  const level = { n: gamiProfile.level, label: gamiProfile.title, pct: gamiProfile.pct, nextAt: gamiProfile.xp + gamiProfile.xpToNext };

  // ── Init UUID device ──────────────────────────────────────────────────────
  useEffect(() => {
    getDeviceId().then(deviceId => { setUserId(deviceId); uidRef.current = deviceId; });
    return () => clearTimeout(debounce.current);
  }, []);

  // ── Fetch initial ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchProfile(userId).then(p => {
      if (!alive) return;
      const patch: Partial<ProfileForm> = {};
      (Object.keys(EMPTY) as (keyof ProfileForm)[]).forEach(k => { if (p[k] != null) (patch as any)[k]=p[k]; });
      setForm(prev => ({ ...prev, ...patch }));
      if (p.avatar_url) setAvUrl(p.avatar_url);
    }).catch(e => console.warn('[edit] fetch:', e))
      .finally(() => { if (alive) setLI(false); });
    return () => { alive = false; };
  }, [userId]);

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const autoSave = useCallback(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const uid = uidRef.current; if (!uid) return;
      try { await persistProfile(uid, formRef.current); } catch {}
    }, 2500);
  }, []);

  const patch = useCallback(<K extends keyof ProfileForm>(key:K, val:ProfileForm[K]) => {
    setForm(p => ({ ...p, [key]:val }));
    setErrors(p => ({ ...p, [key]:undefined }));
    autoSave();
  }, [autoSave]);


  // ── Avatar ────────────────────────────────────────────────────────────────
  const handlePickAvatar = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise',"Autorisez l'accès à votre galerie."); return; }
    const res = await ImagePicker.launchImageLibraryAsync({mediaTypes:ImagePicker.MediaTypeOptions.Images,quality:0.88,allowsEditing:true,aspect:[1,1]});
    if (res.canceled||!res.assets?.[0]) return;
    setAVL(true);
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try {
      const url = await uploadAvatar(res.assets[0].uri, userId);
      if (!url) {
        Alert.alert('Erreur upload',"Exécutez universe_setup.sql dans Supabase SQL Editor d'abord.");
        return;
      }
      setAvUrl(url);
      await supabase.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',userId);
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    } catch { Alert.alert('Erreur',"Impossible d'uploader la photo."); }
    finally { setAVL(false); }
  }, [userId]);

  // iOS Safari: programmatic input.click() est bloqué par la contrainte user-gesture.
  // L'overlay <input> dans AvatarPreview déclenche ce callback directement via un vrai tap.
  const handleWebAvatarChange = useCallback((e: any) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAVL(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (!dataUrl) { setAVL(false); return; }
      uploadAvatar(dataUrl, userId).then(
        (url) => {
          setAVL(false);
          if (url) {
            setAvUrl(url);
            supabase.from('profiles').update({avatar_url:url,updated_at:new Date().toISOString()}).eq('id',userId)
              .then(()=>{}, (err:any)=>console.warn('[edit] avatar db:',err?.message));
            try { SecureStore?.setItemAsync('profile_dirty', String(Date.now())); } catch {}
          } else {
            Alert.alert('Erreur upload',"Exécutez universe_setup.sql dans Supabase SQL Editor d'abord.");
          }
        },
        () => { setAVL(false); Alert.alert('Erreur',"Impossible d'uploader la photo."); }
      );
    };
    reader.onerror = () => { setAVL(false); Alert.alert('Erreur',"Impossible de lire le fichier."); };
    reader.readAsDataURL(file);
  }, [userId]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(():boolean => {
    const e:Partial<Record<keyof ProfileForm,string>> = {};
    const ue = validateUsername(form.username); if (ue) e.username=ue;
    if (!form.username.trim()) e.username = 'Nom d\'utilisateur obligatoire';
    if (!form.display_name.trim()) e.display_name = 'Nom d\'affichage obligatoire';
    if (!avatarUrl) e.display_name = e.display_name || 'Photo de profil obligatoire — ajoutez une image';
    if (!validUrl(form.website))       e.website='URL invalide (https://…)';
    if (!validEmail(form.contact_email)) e.contact_email='Email invalide';
    setErrors(e);
    if (e.username||e.display_name)   setSection('identity');
    else if (e.website||e.contact_email) setSection('network');
    return Object.keys(e).length===0;
  }, [form, avatarUrl]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!userId||saving) return;
    if (!validate()) {
      Animated.sequence([
        Animated.timing(shakeX,{toValue:8,duration:55,useNativeDriver:true}),
        Animated.timing(shakeX,{toValue:-8,duration:55,useNativeDriver:true}),
        Animated.timing(shakeX,{toValue:0,duration:45,useNativeDriver:true}),
      ]).start();
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
      return;
    }
    setSaving(true);
    setSavedOk(false);
    try {
      clearTimeout(debounce.current);
      // ★ FIX: Only include avatar_url if it's actually set — never clear it on save
      const formWithAvatar: ProfileForm = { ...form };
      if (avatarUrl) formWithAvatar.avatar_url = avatarUrl;
      await persistProfile(userId, formWithAvatar);
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      setSavedOk(true);
      Animated.sequence([
        Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.delay(1800),
        Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start(() => setSavedOk(false));
      // ★ FIX: Don't navigate back immediately — let the user see the success feedback.
      // The profile screen will reload via useFocusEffect when they navigate back.
      setTimeout(() => router.back(), 400);
    } catch (e:any) {
      Alert.alert('Erreur de sauvegarde',
        `${e?.message ?? 'Erreur inconnue'}\n\nAssurez-vous d'avoir exécuté universe_setup.sql dans Supabase SQL Editor.`
      );
    } finally { setSaving(false); }
  }, [userId,form,avatarUrl,validate,saving,shakeX,successFade,router]);

  // ── Sections ──────────────────────────────────────────────────────────────
  // Labels pré-calculés comme strings (évite mixing JSX number+text dans View)
  const roleLabel   = ROLES.find(r=>r.key===form.role)?.label;

  const renderIdentity = () => (
    <View>
      <AvatarPreview name={form.display_name||form.username||'?'} url={avatarUrl} isPro={form.is_pro} loading={avLoading} onPress={Platform.OS==='web'?()=>{}:handlePickAvatar} onWebChange={handleWebAvatarChange}/>
      <GamiBanner level={level} score={score}/>
      <Field label="Nom d'affichage"   value={form.display_name}     onChange={v=>patch('display_name',v)}       placeholder="Cinéaste Anonyme"          maxLength={60}  icon="person-outline"/>
      <Field label="Nom d'utilisateur" value={form.username}         onChange={v=>patch('username',v.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="monprofil" maxLength={30} icon="at-outline" error={errors.username} hint="Lettres, chiffres, . _ -"/>
      <Field label="Biographie"        value={form.bio}              onChange={v=>patch('bio',v)}                placeholder="Votre démarche artistique…" maxLength={300} icon="create-outline" multiline/>
      <Divider/>
      <SHead label="Rôle principal" badge={roleLabel}/>
      <RoleGrid selected={form.role} onChange={v=>patch('role',v)}/>
      <Divider/>
      <Field label="Localisation" value={form.location} onChange={v=>patch('location',v)} placeholder="Paris, France" icon="location-outline"/>
    </View>
  );

  const renderNetwork = () => (
    <View>
      <SHead label="Site web & portfolio"/>
      <Field label="URL du portfolio" value={form.website} onChange={v=>patch('website',v)} placeholder="https://monportfolio.com" keyboardType="url" icon="globe-outline" error={errors.website}/>
      <Divider/>
      <SHead label="Réseaux sociaux"/>
      <SocRow icon="logo-instagram"   label="Instagram" value={form.social_instagram} onChange={v=>patch('social_instagram',v)} placeholder="https://instagram.com/moi"/>
      <SocRow icon="videocam-outline" label="Vimeo"     value={form.social_vimeo}     onChange={v=>patch('social_vimeo',v)}     placeholder="https://vimeo.com/moi"/>
      <SocRow icon="logo-youtube"     label="YouTube"   value={form.social_youtube}   onChange={v=>patch('social_youtube',v)}   placeholder="https://youtube.com/@machaîne"/>
      <SocRow icon="film-outline"     label="IMDb"      value={form.social_imdb}       onChange={v=>patch('social_imdb',v)}      placeholder="https://imdb.com/name/nm..."/>
      <Divider mt={24} mb={0}/>
      <Toggle label="Professionnel du secteur" subtitle="Activité dans l'industrie cinématographique" value={form.is_pro} onChange={v=>patch('is_pro',v)}/>
      <Toggle label="Contact professionnel" subtitle="Visible par vos connexions Universe" value={form.is_industry_contact} onChange={v=>patch('is_industry_contact',v)}/>
      {form.is_industry_contact && (
        <View>
          <Divider mt={8} mb={8}/>
          <Field label="Email professionnel" value={form.contact_email} onChange={v=>patch('contact_email',v)} placeholder="contact@exemple.com" keyboardType="email-address" icon="mail-outline" error={errors.contact_email}/>
        </View>
      )}
    </View>
  );

  if (loadingInit) return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <GalaxyBackground/>
      <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:16}}>
        <ActivityIndicator color={C.white} size="large"/>
        <Text style={{color:C.muted,fontSize:14}}>Chargement du profil…</Text>
      </View>
    </View>
  );

  return (
    <View style={{flex:1,backgroundColor:C.bg}}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={{flex:1}} edges={['top']}>
        <Animated.View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12,transform:[{translateX:shakeX}]}}>
          <TouchableOpacity onPress={()=>router.back()} style={{width:36,height:36,borderRadius:18,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'}} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={18} color={C.white}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={{color:C.muted,fontSize:8,fontWeight:'800',letterSpacing:2,textTransform:'uppercase'}}>UNIVERSE</Text>
            <Text style={{color:C.white,fontSize:15,fontWeight:'800',letterSpacing:-0.2,marginTop:1}}>Mon profil cinéma</Text>
          </View>
          <TouchableOpacity
            style={[{paddingHorizontal:16,paddingVertical:9,borderRadius:22,backgroundColor:C.white,minWidth:110,alignItems:'center'},saving&&{opacity:0.55}]}
            onPress={handleSave} disabled={saving} activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color={C.bg} size="small" style={{width:88}}/>
              : <Text style={{color:C.bg,fontSize:13,fontWeight:'700'}}>Sauvegarder</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        <TabNav active={section} onChange={sec=>{setSection(sec);scrollRef.current?.scrollTo({y:0,animated:true});}}/>

        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={96}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:100}}>
            {section==='identity' && renderIdentity()}
            {section==='network'  && renderNetwork()}

            {/* ★ Success — Animated.View séparé pour éviter text node */}
            <Animated.View style={{flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:18,opacity:successFade}}>
              {savedOk && (
                <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={C.success}/>
                  <Text style={{color:C.success,fontSize:13,fontWeight:'600'}}>Profil mis à jour</Text>
                </View>
              )}
            </Animated.View>

            <Text style={{color:'rgba(255,255,255,0.16)',fontSize:11,textAlign:'center',marginTop:8}}>
              Sauvegarde automatique activée
            </Text>
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}