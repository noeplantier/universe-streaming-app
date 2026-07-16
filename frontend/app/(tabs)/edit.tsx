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
import { supabase, SUPABASE_ANON, SUPABASE_URL } from '@/lib/supabase';
import GalaxyBackground from '@/components/shared/GalaxyBackground';
import { getDeviceId }  from '@/services/api';
import { useGamification, type GamiProfile } from '@/contexts/GamificationSystem';

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
const GENRES    = ['Drame','Thriller','Science-Fiction','Documentaire','Animation','Court-métrage','Expérimental','Biopic','Horreur','Comédie','Romance','Action','Fantastique','Policier','Musical','Essai'];
const COLLABS   = ['Co-réalisation','Casting','Co-production','Scénarisation','Montage','Composition musicale','Direction photo','Distribution','Mentorat','Projection festival','Écriture'];
const PROFILE_SELECT = 'display_name,username,bio,role,location,equipment,specialties,open_to,notable_works,is_industry_contact,is_pro,contact_email,website,social_instagram,social_vimeo,social_youtube,social_imdb,avatar_url';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotableWork { id:string; title:string; year:string; role:string; url:string }
interface ProfileForm {
  display_name:string; username:string; bio:string; role:string; location:string;
  equipment:string; specialties:string[]; open_to:string[];
  notable_works:NotableWork[]; is_industry_contact:boolean; is_pro:boolean;
  contact_email:string; website:string; social_instagram:string;
  social_vimeo:string; social_youtube:string; social_imdb:string;
}
const EMPTY: ProfileForm = {
  display_name:'', username:'', bio:'', role:'', location:'',
  equipment:'', specialties:[], open_to:[], notable_works:[],
  is_industry_contact:false, is_pro:false, contact_email:'', website:'',
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};
type Section = 'identity'|'cinema'|'network';

// ─── DB ───────────────────────────────────────────────────────────────────────
const genId      = () => Math.random().toString(36).slice(2,9);
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
  const { error } = await supabase.from('profiles').upsert(
    { id:uid, ...form, updated_at:new Date().toISOString() },
    { onConflict:'id' }
  );
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

// XHR upload sans supabase.auth — même pattern que VideoTab.tsx (SUPABASE_ANON bearer)
function uploadAvatarXHR(path: string, blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/community-images/${path}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON}`);
    xhr.setRequestHeader('Content-Type', 'image/jpeg');
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.onload  = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`${xhr.status}`));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(blob);
  });
}

async function uploadAvatar(uri: string, userId: string): Promise<string|null> {
  try {
    // posts/ prefix — seul préfixe ouvert aux écritures anon dans community-images
    const path = `posts/avatars/${userId}_avatar.jpg`;
    let blob: Blob;

    if (uri.startsWith('data:')) {
      blob = dataUriToBlob(uri);
    } else if (uri.startsWith('blob:') || uri.startsWith('http')) {
      blob = await fetch(uri).then(r => r.blob());
    } else if (FileSystem) {
      const b64   = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const bytes = new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)));
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      blob = await fetch(uri).then(r => r.blob());
    }

    await uploadAvatarXHR(path, blob);
    return `${SUPABASE_URL}/storage/v1/object/public/community-images/${path}?t=${Date.now()}`;
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

const Chips = memo(({items,selected,onToggle,px=PAD}:{items:string[];selected:string[];onToggle:(v:string)=>void;px?:number}) => (
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:px}}>
    {items.map(item => {
      const on = selected.includes(item);
      return (
        <TouchableOpacity key={item} style={[chp.pill, on&&chp.pillOn]} onPress={()=>onToggle(item)} activeOpacity={0.75}>
          {on && <Ionicons name="checkmark" size={10} color={C.bg}/>}
          <Text style={[chp.txt, on&&chp.txtOn]}>{item}</Text>
        </TouchableOpacity>
      );
    })}
    {items.length===0 && <Text style={{color:C.muted,fontSize:11,paddingVertical:6}}>Aucun résultat</Text>}
  </View>
));
const chp = StyleSheet.create({
  pill:  {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:24,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  pillOn:{backgroundColor:C.white,borderColor:C.white},
  txt:   {color:C.muted,fontSize:12,fontWeight:'500'},
  txtOn: {color:C.bg,fontWeight:'700'},
});

// ─── Smart Select — liste déroulante au click, recherche si liste longue ──────
const SmartSelect = memo(function SmartSelect({label,items,selected,onToggle,required,error}:{
  label:string; items:string[]; selected:string[]; onToggle:(v:string)=>void;
  required?:boolean; error?:string|null;
}) {
  const [open, setOpen] = useState(false);
  const [q,    setQ]    = useState('');
  const rot = useRef(new Animated.Value(0)).current;
  const toggleOpen = () => {
    Animated.spring(rot,{toValue:open?0:1,tension:80,friction:10,useNativeDriver:true}).start();
    if (open) setQ('');
    setOpen(v=>!v);
  };
  const filtered = useMemo(() => q.trim() ? items.filter(i=>i.toLowerCase().includes(q.trim().toLowerCase())) : items, [items,q]);
  const summary  = selected.length===0 ? 'Aucun sélectionné'
    : selected.length<=2 ? selected.join(', ')
    : `${selected[0]}, ${selected[1]} +${selected.length-2}`;
  const borderColor = error ? C.error : open ? C.borderHi : C.border;
  return (
    <View style={{marginHorizontal:PAD,marginBottom:14,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor,backgroundColor:C.glass,overflow:'hidden'}}>
      <TouchableOpacity onPress={toggleOpen} activeOpacity={0.80} style={{flexDirection:'row',alignItems:'center',gap:11,padding:14}}>
        <View style={{flex:1,gap:3}}>
          <View style={{flexDirection:'row',alignItems:'center',gap:5}}>
            <Text style={{color:C.white,fontSize:11,fontWeight:'700',letterSpacing:1.2,textTransform:'uppercase'}}>{label}</Text>
            {!!required && <Text style={{color:C.error,fontSize:12,fontWeight:'700'}}>*</Text>}
          </View>
          <Text style={{color:selected.length?C.offWhite:C.muted,fontSize:12.5}} numberOfLines={1}>{summary}</Text>
        </View>
        {selected.length>0 && (
          <View style={{paddingHorizontal:7,paddingVertical:2,borderRadius:7,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
            <Text style={{color:C.muted,fontSize:10,fontWeight:'700'}}>{selected.length}</Text>
          </View>
        )}
        <Animated.View style={{transform:[{rotate:rot.interpolate({inputRange:[0,1],outputRange:['0deg','180deg']})}]}}>
          <Ionicons name="chevron-down" size={15} color={C.muted}/>
        </Animated.View>
      </TouchableOpacity>
      {open && (
        <View style={{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:C.border,paddingTop:12,paddingBottom:6}}>
          {items.length>8 && (
            <View style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:12,marginBottom:10,paddingHorizontal:11,height:36,borderRadius:10,backgroundColor:'rgba(255,255,255,0.04)',borderWidth:StyleSheet.hairlineWidth,borderColor:C.border}}>
              <Ionicons name="search-outline" size={12} color={C.muted}/>
              <TextInput style={{flex:1,color:C.white,fontSize:12}} value={q} onChangeText={setQ} placeholder="Filtrer…" placeholderTextColor="rgba(255,255,255,0.20)" autoCorrect={false} autoCapitalize="none"/>
              {q.length>0 && <TouchableOpacity onPress={()=>setQ('')}><Ionicons name="close-circle" size={13} color={C.muted}/></TouchableOpacity>}
            </View>
          )}
          <Chips items={filtered} selected={selected} onToggle={onToggle} px={12}/>
        </View>
      )}
      {!!error && <Text style={{color:C.error,fontSize:11,paddingHorizontal:14,paddingBottom:12}}>{error}</Text>}
    </View>
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

const WorkCard = memo(({work,onUpdate,onDelete}:{work:NotableWork;onUpdate:(w:NotableWork)=>void;onDelete:(id:string)=>void}) => (
  <View style={{marginHorizontal:PAD,marginBottom:12,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.glass,padding:14}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:10,marginBottom:12}}>
      <View style={{width:3,height:3,borderRadius:1.5,backgroundColor:C.white}}/>
      <Text style={{flex:1,color:C.offWhite,fontSize:12,fontWeight:'600'}} numberOfLines={1}>{work.title||"Titre de l'œuvre"}</Text>
      <TouchableOpacity onPress={()=>onDelete(work.id)} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
    </View>
    <View style={{flexDirection:'row',gap:10}}>
      <TextInput style={{flex:1,color:C.white,fontSize:13,paddingVertical:5}} value={work.title} onChangeText={v=>onUpdate({...work,title:v})} placeholder="Titre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
      <TextInput style={{width:68,color:C.white,fontSize:13,paddingVertical:5,textAlign:'center'}} value={work.year} onChangeText={v=>onUpdate({...work,year:v})} placeholder="Année" placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="numeric" maxLength={4} selectionColor={C.white}/>
    </View>
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:9}}/>
    <TextInput style={{color:C.white,fontSize:13,paddingVertical:5}} value={work.role} onChangeText={v=>onUpdate({...work,role:v})} placeholder="Votre rôle" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:9}}/>
    <TextInput style={{color:C.white,fontSize:12,paddingVertical:5}} value={work.url} onChangeText={v=>onUpdate({...work,url:v})} placeholder="Lien (https://…)" placeholderTextColor="rgba(255,255,255,0.14)" keyboardType="url" autoCapitalize="none" selectionColor={C.white}/>
  </View>
));

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
  const LABELS: Record<Section,string> = {identity:'Identité',cinema:'Cinéma',network:'Réseaux'};
  return (
    <View style={{flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border}}>
      {(['identity','cinema','network'] as Section[]).map(k => {
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
const AvatarPreview = memo(({name,url,isPro,loading,onPress}:{name:string;url:string;isPro:boolean;loading:boolean;onPress:()=>void}) => {
  const init = useMemo(() => (name||'?').trim().split(/\s+/).map(n=>n[0]).join('').toUpperCase().slice(0,2),[name]);
  const [err,setErr] = useState(false);
  useEffect(() => setErr(false),[url]);
  const hasAvatar = !!(url&&!err);
  // ★ Textes définis avant le JSX — pas de mixing dans View
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
      </TouchableOpacity>
      <View style={{flex:1,gap:6}}>
        <Text style={{color:C.white,fontSize:15,fontWeight:'700'}}>{name||'Votre nom'}</Text>
        <Text style={{color:C.muted,fontSize:11,lineHeight:16}}>{photoLabel}</Text>
        <TouchableOpacity onPress={onPress} style={{paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(255,255,255,0.22)',alignSelf:'flex-start',marginTop:2}} activeOpacity={0.80}>
          <Text style={{color:C.offWhite,fontSize:12,fontWeight:'600'}}>{actionLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

// ─── Level Preview — lecture seule, intrinsèquement liée à GamificationSystem ─
const LevelPreview = memo(({profile}:{profile:GamiProfile}) => {
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(()=>{Animated.timing(prog,{toValue:profile.pct,duration:900,useNativeDriver:false}).start();},[profile.pct]);
  const barWidth = prog.interpolate({inputRange:[0,1],outputRange:['0%','100%']});
  const levelStr = `Niveau ${profile.level}`;
  return (
    <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:PAD,paddingVertical:14}}>
      <View style={{width:38,height:38,borderRadius:19,borderWidth:1.5,borderColor:C.border,backgroundColor:C.navyMid,alignItems:'center',justifyContent:'center'}}>
        <Text style={{color:C.white,fontSize:13,fontWeight:'900'}}>{profile.level}</Text>
      </View>
      <View style={{flex:1,gap:4}}>
        <Text style={{color:C.white,fontSize:12,fontWeight:'700'}} numberOfLines={1}>{profile.title}</Text>
        <View style={{height:3,borderRadius:2,backgroundColor:'rgba(255,255,255,0.07)',overflow:'hidden'}}>
          <Animated.View style={{height:'100%',borderRadius:2,backgroundColor:C.white,width:barWidth}}/>
        </View>
      </View>
      <Text style={{color:C.muted,fontSize:9,fontWeight:'700'}}>{levelStr}</Text>
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
  const [showLevelOnProfile, setShowLevelOnProfile] = useState(true);

  const shakeX      = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const debounce    = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef   = useRef<ScrollView>(null);
  const formRef     = useRef<ProfileForm>(EMPTY);
  const uidRef      = useRef('');
  formRef.current   = form;
  uidRef.current    = userId;

  // ★ Niveau réel — intrinsèquement lié à GamificationSystem (cinephile_profiles)
  const { profile: gamiProfile } = useGamification(userId, [], { skipBadges:true });

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

  // ── Préférence "Afficher mon niveau sur mon profil" ──────────────────────
  useEffect(() => {
    if (!userId) return;
    supabase.from('user_preferences').select('show_level_on_profile').eq('user_id',userId).maybeSingle()
      .then(
        ({data,error}) => {
          if (error) { console.error('[edit] lecture show_level_on_profile:', error.message); return; }
          setShowLevelOnProfile(data?.show_level_on_profile ?? true);
        },
        (e) => console.error('[edit] lecture show_level_on_profile:', e),
      );
  }, [userId]);

  const toggleShowLevel = useCallback((v:boolean) => {
    setShowLevelOnProfile(v);
    if (!userId) return;
    supabase.from('user_preferences').upsert({user_id:userId, show_level_on_profile:v}, {onConflict:'user_id'}).then(
      ({error}) => { if (error) console.error('[edit] écriture show_level_on_profile:', error.message); },
      (e) => console.error('[edit] écriture show_level_on_profile:', e),
    );
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

  const toggleArr = useCallback((key:'specialties'|'open_to', item:string) => {
    setForm(p => { const arr=p[key] as string[]; return {...p,[key]:arr.includes(item)?arr.filter(x=>x!==item):[...arr,item]}; });
    autoSave();
  }, [autoSave]);

  const addWork    = useCallback(()=>setForm(p=>({...p,notable_works:[...p.notable_works,{id:genId(),title:'',year:'',role:'',url:''}]})),[]);
  const updateWork = useCallback((w:NotableWork)=>setForm(p=>({...p,notable_works:p.notable_works.map(x=>x.id===w.id?w:x)})),[]);
  const deleteWork = useCallback((id:string)=>setForm(p=>({...p,notable_works:p.notable_works.filter(x=>x.id!==id)})),[]);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const finishAvatarUpload = useCallback(async (uri: string) => {
    setAVL(true);
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try {
      const url = await uploadAvatar(uri, userId);
      if (!url) {
        Alert.alert('Erreur upload', "L'upload vers le storage a échoué. Vérifiez la connexion ou les permissions Supabase.");
        return;
      }
      setAvUrl(url);
      // upsert guarantees the row is created if it doesn't exist yet
      const { error: dbErr } = await supabase.from('profiles')
        .upsert({ id: userId, avatar_url: url, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      if (dbErr) console.warn('[edit] avatar db:', dbErr.message);
      // Mark profile as dirty so NavBar and profile.tsx re-fetch the avatar
      try { SecureStore?.setItemAsync('profile_dirty', '1'); } catch {}
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
    } catch(e:any) { Alert.alert('Erreur', e?.message ?? "Impossible d'uploader la photo."); }
    finally { setAVL(false); }
  }, [userId]);

  const handlePickAvatar = useCallback(async () => {
    // expo-image-picker passe par FileReader.readAsDataURL() sur web, qui
    // échoue sans message exploitable sur certains fichiers (ex: photos
    // iCloud non encore téléchargées en local, HEIC). On bypass entièrement
    // ImagePicker sur web — même <input type="file"> + blob: URI que
    // app/settings.tsx, qui n'a jamais ce problème.
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      input.onchange = (e: any) => {
        const file = e.target.files?.[0]; if (!file) return;
        finishAvatarUpload(URL.createObjectURL(file));
      };
      input.click();
      return;
    }
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise',"Autorisez l'accès à votre galerie."); return; }
    const legacyTypes = !!(ImagePicker as any).MediaTypeOptions;
    const imageTypes: any = legacyTypes ? (ImagePicker as any).MediaTypeOptions.Images : ['images'];
    const res = await ImagePicker.launchImageLibraryAsync({mediaTypes:imageTypes,quality:0.88,allowsEditing:true,aspect:[1,1]});
    if (res.canceled||!res.assets?.[0]) return;
    await finishAvatarUpload(res.assets[0].uri);
  }, [finishAvatarUpload]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback(():boolean => {
    const e:Partial<Record<keyof ProfileForm,string>> = {};
    const ue = validateUsername(form.username); if (ue) e.username=ue;
    if (!form.role)                      e.role='Choisissez votre rôle principal';
    if (form.specialties.length===0)     e.specialties='Sélectionnez au moins un genre';
    if (!validUrl(form.website))         e.website='URL invalide (https://…)';
    if (!validEmail(form.contact_email)) e.contact_email='Email invalide';
    setErrors(e);
    if (e.username||e.role)              setSection('identity');
    else if (e.specialties)              setSection('cinema');
    else if (e.website||e.contact_email) setSection('network');
    return Object.keys(e).length===0;
  }, [form]);

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
      const{error:prefErr}=await supabase.from('user_preferences').upsert({user_id:userId,show_level_on_profile:showLevelOnProfile},{onConflict:'user_id'});
      if (prefErr) console.error('[edit] sauvegarde show_level_on_profile:', prefErr.message);
      await persistProfile(userId, form);
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      setSavedOk(true);
      Animated.sequence([
        Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.delay(1800),
        Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start(() => setSavedOk(false));
      setTimeout(() => router.back(), 200);
    } catch (e:any) {
      Alert.alert('Erreur de sauvegarde',
        `${e?.message ?? 'Erreur inconnue'}\n\nAssurez-vous d'avoir exécuté universe_setup.sql dans Supabase SQL Editor.`
      );
    } finally { setSaving(false); }
  }, [userId,form,validate,saving,shakeX,successFade,router,showLevelOnProfile]);

  // ── Sections ──────────────────────────────────────────────────────────────
  // Labels pré-calculés comme strings (évite mixing JSX number+text dans View)
  const roleLabel   = ROLES.find(r=>r.key===form.role)?.label;
  const worksBadge  = form.notable_works.length > 0  ? `${form.notable_works.length}` : undefined;

  const renderIdentity = () => (
    <View>
      <AvatarPreview name={form.display_name||form.username||'?'} url={avatarUrl} isPro={form.is_pro} loading={avLoading} onPress={handlePickAvatar}/>
      <LevelPreview profile={gamiProfile}/>
      <Toggle label="Afficher mon niveau sur mon profil" subtitle="Visible publiquement sur votre profil, sinon réservé à vous" value={showLevelOnProfile} onChange={toggleShowLevel}/>
      <Divider/>
      <Field label="Nom d'affichage"   value={form.display_name}     onChange={v=>patch('display_name',v)}       placeholder="Cinéaste Anonyme"          maxLength={60}  icon="person-outline"/>
      <Field label="Nom d'utilisateur" value={form.username}         onChange={v=>patch('username',v.toLowerCase().replace(/[^a-z0-9._-]/g,''))} placeholder="monprofil" maxLength={30} icon="at-outline" error={errors.username} hint="Lettres, chiffres, . _ -"/>
      <Field label="Biographie"        value={form.bio}              onChange={v=>patch('bio',v)}                placeholder="Votre démarche artistique…" maxLength={300} icon="create-outline" multiline/>
      <Divider/>
      <SHead label="Rôle principal *" badge={roleLabel}/>
      <RoleGrid selected={form.role} onChange={v=>patch('role',v)}/>
      {!!errors.role && <Text style={{color:C.error,fontSize:11,marginTop:8,marginHorizontal:PAD}}>{errors.role}</Text>}
      <Divider/>
      <Field label="Localisation" value={form.location} onChange={v=>patch('location',v)} placeholder="Paris, France" icon="location-outline"/>
    </View>
  );

  const renderCinema = () => (
    <View>
      <SmartSelect label="Genres maîtrisés *" items={GENRES} selected={form.specialties} onToggle={item=>toggleArr('specialties',item)} required error={errors.specialties}/>
      <Field label="Équipement & outils" value={form.equipment} onChange={v=>patch('equipment',v)} placeholder="Sony FX6, DaVinci Resolve…" multiline maxLength={220} icon="camera-outline"/>
      <Divider/>
      <SHead label="Œuvres notables" badge={worksBadge}/>
      {form.notable_works.map(w => <WorkCard key={w.id} work={w} onUpdate={updateWork} onDelete={deleteWork}/>)}
      <TouchableOpacity style={{flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:PAD,marginTop:4,marginBottom:8,paddingVertical:13,borderRadius:13,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',backgroundColor:C.glass}} onPress={addWork} activeOpacity={0.80}>
        <Ionicons name="add" size={14} color={C.muted}/>
        <Text style={{color:C.muted,fontSize:12,fontWeight:'600'}}>Ajouter une œuvre</Text>
      </TouchableOpacity>
      <Divider/>
      <SmartSelect label="Disponibilités" items={COLLABS} selected={form.open_to} onToggle={item=>toggleArr('open_to',item)}/>
      <Divider mt={16} mb={0}/>
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
            {section==='cinema'   && renderCinema()}
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