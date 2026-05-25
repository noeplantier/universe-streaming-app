/**
 * app/edit.tsx — UNIVERSE · ÉDITION PROFIL
 *
 * ★ renderIdentity câblé sur form.display_name / username / bio / role / location
 * ★ Avatar : ImageWithFallback + upload storage → avatar_url en DB
 * ★ persistProfile : UPDATE puis INSERT si 0 ligne (évite le 400 upsert/RLS)
 * ★ Auto-save silencieux 2.5s après dernière frappe
 */

import React, {
  memo, useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Image }        from 'expo-image';
import { Ionicons }     from '@expo/vector-icons';
import { useRouter }    from 'expo-router';
import { StatusBar }    from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
const FileSystem: any = Platform.select({
  native: () => { try { return require('expo-file-system'); } catch { return null; } },
  default: () => null,
})?.() ?? null;
import * as Haptics     from 'expo-haptics';
let decode: ((s:string)=>ArrayBuffer)|null = null;
try { decode = require('base64-arraybuffer').decode; } catch {}

import { supabase }      from '@/lib/supabase';
import GalaxyBackground  from '@/components/social/GalaxyBackground';

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#03000A',
  white:       '#FFFFFF',
  offWhite:    'rgba(255,255,255,0.82)',
  muted:       'rgba(255,255,255,0.36)',
  faint:       'rgba(255,255,255,0.10)',
  border:      'rgba(255,255,255,0.10)',
  borderHi:    'rgba(255,255,255,0.28)',
  borderFocus: 'rgba(255,255,255,0.55)',
  glass:       'rgba(255,255,255,0.04)',
  glassMd:     'rgba(255,255,255,0.07)',
  glassHi:     'rgba(255,255,255,0.11)',
  success:     '#22C55E',
  error:       '#EF4444',
} as const;

const PAD = 20;

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const ROLES: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap }[] = [
  { key:'director', label:'Réalisateur·rice', icon:'film-outline'          },
  { key:'producer', label:'Producteur·rice',  icon:'briefcase-outline'     },
  { key:'writer',   label:'Scénariste',       icon:'create-outline'        },
  { key:'actor',    label:'Acteur·rice',      icon:'people-outline'        },
  { key:'dp',       label:'Dir. photo',       icon:'camera-outline'        },
  { key:'editor',   label:'Monteur·euse',     icon:'cut-outline'           },
  { key:'critic',   label:'Critique',         icon:'newspaper-outline'     },
  { key:'creator',  label:'Créateur·rice',    icon:'sparkles-outline'      },
  { key:'other',    label:'Autre',            icon:'ellipsis-horizontal-circle-outline' },
];

const GENRES_CINEMA = [
  'Drame','Thriller','Science-Fiction','Documentaire','Animation',
  'Court-métrage','Expérimental','Biopic','Horreur','Comédie',
  'Romance','Action','Fantastique','Policier','Musical',
];

const COLLABORATIONS = [
  'Co-réalisation','Casting','Co-production','Scénarisation',
  'Montage','Composition musicale','Direction photo','Distribution',
  'Mentorat','Projection festival',
];

const FESTIVALS_LIST = [
  'Cannes','Sundance','Berlin','Tribeca','SXSW','Toronto (TIFF)',
  'Venise','Annecy','Hot Docs','Clermont-Ferrand','Oberhausen',
  'Rotterdam (IFFR)','AFI Fest','New York (NYFF)',
];

const PROFILE_SELECT = [
  'display_name','username','bio','role','location','equipment',
  'specialties','open_to','festivals','notable_works',
  'is_industry_contact','is_pro','contact_email','website',
  'social_instagram','social_vimeo','social_youtube','social_imdb','avatar_url',
].join(',');

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface NotableWork { id:string; title:string; year:string; role:string; url:string }

interface ProfileForm {
  display_name:string; username:string; bio:string; role:string; location:string;
  equipment:string; specialties:string[]; open_to:string[]; festivals:string[];
  notable_works:NotableWork[]; is_industry_contact:boolean; is_pro:boolean;
  contact_email:string; website:string;
  social_instagram:string; social_vimeo:string; social_youtube:string; social_imdb:string;
}

const EMPTY: ProfileForm = {
  display_name:'', username:'', bio:'', role:'creator', location:'', equipment:'',
  specialties:[], open_to:[], festivals:[], notable_works:[],
  is_industry_contact:false, is_pro:false,
  contact_email:'', website:'',
  social_instagram:'', social_vimeo:'', social_youtube:'', social_imdb:'',
};

type SaveStatus = 'idle'|'saving'|'saved'|'error';
type Section    = 'identity'|'cinema'|'network';

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const genId   = () => Math.random().toString(36).slice(2,9);
const validUrl   = (u:string) => !u || /^https?:\/\/.+/.test(u);
const validEmail = (e:string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function validateUsername(u:string): string|null {
  if (!u.trim())               return 'Champ obligatoire';
  if (u.length < 3)            return '3 caractères minimum';
  if (!/^[a-z0-9._-]+$/i.test(u)) return 'Lettres, chiffres et . _ - uniquement';
  return null;
}

// ─── DB ───────────────────────────────────────────────────────────────────────
async function fetchProfile(uid:string): Promise<Partial<ProfileForm> & {avatar_url?:string}> {
  const { data, error } = await supabase
    .from('profiles').select(PROFILE_SELECT).eq('id', uid).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {}) as any;
}

/** UPDATE d'abord; INSERT seulement si 0 ligne modifiée */
async function persistProfile(uid:string, form:ProfileForm): Promise<void> {
  const payload = {
    ...form,
    specialties:   form.specialties   ?? [],
    open_to:       form.open_to       ?? [],
    festivals:     form.festivals     ?? [],
    notable_works: form.notable_works ?? [],
    updated_at:    new Date().toISOString(),
  };
  const { error:upErr, count } = await supabase
    .from('profiles').update(payload).eq('id', uid)
    .select('id', { count:'exact', head:true });
  if (upErr) {
    const { error:inErr } = await supabase.from('profiles').insert({ id:uid, ...payload });
    if (inErr) throw new Error(inErr.message);
    return;
  }
  if (count === 0) {
    const { error:inErr } = await supabase.from('profiles').insert({ id:uid, ...payload });
    if (inErr) throw new Error(inErr.message);
  }
}

async function persistAvatar(uid:string, uri:string): Promise<string> {
  // Détecte l'extension depuis blob:, data: ou chemin fichier
  const ext = (() => {
    if (uri.startsWith('blob:'))  return 'jpg';
    if (uri.startsWith('data:'))  return uri.match(/data:image\/(\w+);/)?.[1] ?? 'jpg';
    return uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  })();
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${uid}/avatar_${Date.now()}.${ext}`;

  // Web  → Blob (Supabase storage gère Blob correctement ; ArrayBuffer pose problème)
  // iOS/Android → FileSystem base64 → ArrayBuffer via decode
  let body: Blob | ArrayBuffer;
  if (Platform.OS === 'web') {
    body = await fetch(uri).then(r => r.blob());
  } else {
    const b64 = await FileSystem!.readAsStringAsync(uri, { encoding:'base64' });
    body = decode!(b64);
  }

  const { data, error } = await supabase.storage
    .from('avatars').upload(path, body, { contentType:mime, upsert:true });
  if (error) throw new Error(error.message);

  const { data:{ publicUrl } } = supabase.storage.from('avatars').getPublicUrl(data.path);
  await supabase.from('profiles')
    .update({ avatar_url:publicUrl, updated_at:new Date().toISOString() }).eq('id', uid);
  return publicUrl;
}

// ─── UI COMPONENTS ────────────────────────────────────────────────────────────
const Divider = memo(({mt=24,mb=8}:{mt?:number;mb?:number}) => (
  <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginHorizontal:PAD,marginTop:mt,marginBottom:mb}}/>
));

const SectionHead = memo(({label,desc,badge}:{label:string;desc?:string;badge?:string}) => (
  <View style={sh.wrap}>
    <View style={{flex:1}}>
      <Text style={sh.label}>{label}</Text>
      {desc&&<Text style={sh.desc}>{desc}</Text>}
    </View>
    {badge&&<View style={sh.badge}><Text style={sh.badgeTxt}>{badge}</Text></View>}
  </View>
));
const sh = StyleSheet.create({
  wrap:    {flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:PAD,paddingTop:32,paddingBottom:16},
  label:   {color:C.white,fontSize:13,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
  desc:    {color:C.muted,fontSize:12,marginTop:4,lineHeight:17},
  badge:   {paddingHorizontal:10,paddingVertical:3,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  badgeTxt:{color:C.muted,fontSize:10,fontWeight:'700'},
});

const Field = memo(function Field({
  label,value,onChange,placeholder,multiline,maxLength,
  keyboardType='default',error,icon,hint,
}:{
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string;
  multiline?:boolean; maxLength?:number;
  keyboardType?:'default'|'email-address'|'url'|'numeric';
  error?:string|null; icon?:keyof typeof Ionicons.glyphMap; hint?:string;
}) {
  const fa = useRef(new Animated.Value(0)).current;
  const onFocus = useCallback(() => Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start(),[fa]);
  const onBlur  = useCallback(() => Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start(),[fa]);
  const lineC = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.border, error?C.error:C.borderFocus]});
  const lblC  = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.muted,  error?C.error:C.offWhite  ]});
  return (
    <View style={fi.wrap}>
      <Animated.Text style={[fi.label,{color:lblC}]}>{label}</Animated.Text>
      <View style={fi.row}>
        {icon&&<Ionicons name={icon} size={15} color={C.muted} style={fi.icon}/>}
        <TextInput
          style={[fi.input, multiline&&fi.multi]}
          value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)"
          multiline={multiline} maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType==='email-address'||keyboardType==='url'?'none':'sentences'}
          autoCorrect={false} selectionColor={C.white}
          onFocus={onFocus} onBlur={onBlur}
          returnKeyType={multiline?'default':'next'}
          numberOfLines={multiline?4:1}
        />
        {!!maxLength&&value.length>maxLength*0.75&&(
          <Text style={fi.counter}>{value.length}/{maxLength}</Text>
        )}
      </View>
      <Animated.View style={[fi.line,{backgroundColor:lineC}]}/>
      {error&&<Text style={fi.errorTxt}>{error}</Text>}
      {hint&&!error&&<Text style={fi.hint}>{hint}</Text>}
    </View>
  );
});
const fi = StyleSheet.create({
  wrap:    {paddingHorizontal:PAD,marginBottom:20},
  label:   {fontSize:10,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:10},
  row:     {flexDirection:'row',alignItems:'flex-end',gap:10},
  icon:    {paddingBottom:12},
  input:   {flex:1,color:C.white,fontSize:15,paddingVertical:10,lineHeight:21},
  multi:   {minHeight:90,textAlignVertical:'top',paddingTop:8},
  counter: {color:C.muted,fontSize:10,paddingBottom:12},
  line:    {height:StyleSheet.hairlineWidth,marginTop:2},
  errorTxt:{color:C.error,fontSize:11,marginTop:6},
  hint:    {color:C.muted,fontSize:11,marginTop:6,lineHeight:16},
});

const Toggle = memo(function Toggle({label,subtitle,value,onChange}:{label:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}) {
  const a = useRef(new Animated.Value(value?1:0)).current;
  useEffect(() => {
    Animated.spring(a,{toValue:value?1:0,tension:120,friction:9,useNativeDriver:false}).start();
  },[value,a]);
  const trackBg = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.10)','rgba(255,255,255,0.80)']});
  const thumbX  = a.interpolate({inputRange:[0,1],outputRange:[2,22]});
  const thumbC  = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.55)','#03000A']});
  const toggle  = useCallback(() => {
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    onChange(!value);
  },[value,onChange]);
  return (
    <TouchableOpacity style={tg.row} onPress={toggle} activeOpacity={0.80}>
      <View style={{flex:1,gap:3}}>
        <Text style={tg.label}>{label}</Text>
        {subtitle&&<Text style={tg.sub}>{subtitle}</Text>}
      </View>
      <Animated.View style={[tg.track,{backgroundColor:trackBg}]}>
        <Animated.View style={[tg.thumb,{transform:[{translateX:thumbX}],backgroundColor:thumbC}]}/>
      </Animated.View>
    </TouchableOpacity>
  );
});
const tg = StyleSheet.create({
  row:   {flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:PAD,paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  label: {color:C.offWhite,fontSize:14,fontWeight:'600'},
  sub:   {color:C.muted,fontSize:12,lineHeight:17},
  track: {width:46,height:26,borderRadius:13,justifyContent:'center',borderWidth:1,borderColor:C.border},
  thumb: {width:22,height:22,borderRadius:11,shadowColor:'#000',shadowOpacity:0.20,shadowRadius:3,shadowOffset:{width:0,height:1}},
});

const ChipGrid = memo(function ChipGrid({items,selected,onToggle}:{items:string[];selected:string[];onToggle:(v:string)=>void}) {
  return (
    <View style={cg.grid}>
      {items.map(item => {
        const on = selected.includes(item);
        return (
          <TouchableOpacity key={item} style={[cg.chip,on&&cg.on]} onPress={()=>onToggle(item)} activeOpacity={0.75}>
            {on&&<Ionicons name="checkmark" size={10} color={C.bg}/>}
            <Text style={[cg.txt,on&&cg.txtOn]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const cg = StyleSheet.create({
  grid:{flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:PAD},
  chip:{flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:24,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  on:  {backgroundColor:C.white,borderColor:C.white},
  txt: {color:C.muted,fontSize:12,fontWeight:'500'},
  txtOn:{color:C.bg,fontWeight:'700'},
});

const RoleGrid = memo(function RoleGrid({selected,onChange}:{selected:string;onChange:(v:string)=>void}) {
  return (
    <View style={rg.grid}>
      {ROLES.map(r => {
        const on = selected===r.key;
        return (
          <TouchableOpacity key={r.key} style={[rg.item,on&&rg.on]} onPress={()=>onChange(r.key)} activeOpacity={0.80}>
            <Ionicons name={r.icon} size={17} color={on?C.bg:C.muted}/>
            <Text style={[rg.label,on&&rg.labelOn]} numberOfLines={2}>{r.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const rg = StyleSheet.create({
  grid: {flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:PAD},
  item: {width:'30%',flexGrow:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  on:   {backgroundColor:C.white,borderColor:C.white},
  label:{color:C.muted,fontSize:10,fontWeight:'500',textAlign:'center'},
  labelOn:{color:C.bg,fontWeight:'700'},
});

const WorkCard = memo(function WorkCard({work,onUpdate,onDelete}:{work:NotableWork;onUpdate:(w:NotableWork)=>void;onDelete:(id:string)=>void}) {
  return (
    <View style={wc.wrap}>
      <View style={wc.head}>
        <View style={wc.dot}/>
        <Text style={wc.headTxt} numberOfLines={1}>{work.title||'Titre de l\'œuvre'}</Text>
        <TouchableOpacity onPress={()=>onDelete(work.id)} hitSlop={10}><Ionicons name="close" size={14} color={C.muted}/></TouchableOpacity>
      </View>
      <View style={wc.row}>
        <TextInput style={[wc.inp,{flex:1}]} value={work.title} onChangeText={v=>onUpdate({...work,title:v})} placeholder="Titre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
        <TextInput style={[wc.inp,{width:68,textAlign:'center'}]} value={work.year} onChangeText={v=>onUpdate({...work,year:v})} placeholder="Année" placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="numeric" maxLength={4} selectionColor={C.white}/>
      </View>
      <View style={wc.sep}/>
      <TextInput style={wc.inp} value={work.role} onChangeText={v=>onUpdate({...work,role:v})} placeholder="Votre rôle sur cette œuvre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
      <View style={wc.sep}/>
      <TextInput style={[wc.inp,{fontSize:12}]} value={work.url} onChangeText={v=>onUpdate({...work,url:v})} placeholder="Lien optionnel (https://…)" placeholderTextColor="rgba(255,255,255,0.14)" keyboardType="url" autoCapitalize="none" selectionColor={C.white}/>
    </View>
  );
});
const wc = StyleSheet.create({
  wrap:{marginHorizontal:PAD,marginBottom:12,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.glass,padding:16},
  head:{flexDirection:'row',alignItems:'center',gap:10,marginBottom:14},
  dot: {width:4,height:4,borderRadius:2,backgroundColor:C.white},
  headTxt:{flex:1,color:C.offWhite,fontSize:12,fontWeight:'600'},
  row: {flexDirection:'row',gap:10},
  inp: {color:C.white,fontSize:13,paddingVertical:6},
  sep: {height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:10},
});

const SocialRow = memo(function SocialRow({icon,label,value,onChange,placeholder}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;onChange:(v:string)=>void;placeholder:string}) {
  const fa = useRef(new Animated.Value(0)).current;
  const lineC = fa.interpolate({inputRange:[0,1],outputRange:[C.border,C.borderFocus]});
  return (
    <View style={sr.wrap}>
      <View style={sr.iconBox}><Ionicons name={icon} size={15} color={C.muted}/></View>
      <View style={{flex:1}}>
        <Text style={sr.label}>{label}</Text>
        <TextInput style={sr.input} value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)"
          keyboardType="url" autoCapitalize="none" autoCorrect={false} selectionColor={C.white}
          onFocus={()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start()}
          onBlur={()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start()}/>
        <Animated.View style={{height:StyleSheet.hairlineWidth,backgroundColor:lineC}}/>
      </View>
    </View>
  );
});
const sr = StyleSheet.create({
  wrap:   {flexDirection:'row',alignItems:'flex-end',gap:14,paddingHorizontal:PAD,paddingVertical:6,marginBottom:14},
  iconBox:{width:36,height:36,borderRadius:12,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:10},
  label:  {color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:8},
  input:  {color:C.white,fontSize:13,paddingVertical:8},
});

const TABS: {key:Section;label:string}[] = [
  {key:'identity',label:'Identité'},
  {key:'cinema',  label:'Cinéma'},
  {key:'network', label:'Réseaux'},
];
const TabNav = memo(function TabNav({active,onChange}:{active:Section;onChange:(s:Section)=>void}) {
  return (
    <View style={tn.wrap}>
      {TABS.map(t => {
        const on = active===t.key;
        return (
          <TouchableOpacity key={t.key} style={tn.tab} onPress={()=>onChange(t.key)} activeOpacity={0.80}>
            <Text style={[tn.label,on&&tn.labelOn]}>{t.label}</Text>
            {on&&<View style={tn.bar}/>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const tn = StyleSheet.create({
  wrap:    {flexDirection:'row',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:C.border},
  tab:     {flex:1,alignItems:'center',paddingVertical:14,position:'relative'},
  label:   {color:C.muted,fontSize:12,fontWeight:'600',letterSpacing:0.3},
  labelOn: {color:C.white,fontWeight:'700'},
  bar:     {position:'absolute',bottom:0,left:'20%',right:'20%',height:1,backgroundColor:C.white},
});

// ─── AVATAR COMPONENT ─────────────────────────────────────────────────────────
/** Affiche l'avatar de l'utilisateur. Si vide → avatar neutre (pravatar) */
const AvatarPicker = memo(function AvatarPicker({
  avatarUrl, loading, username, onPress,
}:{avatarUrl:string; loading:boolean; username:string; onPress:()=>void}) {
  const fallback = `https://i.pravatar.cc/150?u=${username || 'anon'}`;
  const src      = avatarUrl || fallback;
  return (
    <View style={av.block}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={av.wrap}>
        <Image source={{ uri:src }} style={av.img} contentFit="cover"/>
        <View style={av.cam}>
          {loading
            ? <ActivityIndicator color={C.white} size="small"/>
            : <Ionicons name="camera-outline" size={14} color={C.white}/>}
        </View>
      </TouchableOpacity>
      <View style={{flex:1,gap:6}}>
        <Text style={av.label}>Photo de profil</Text>
        <Text style={av.sub}>Format carré · JPEG ou PNG · Max 5 Mo</Text>
        <TouchableOpacity onPress={onPress} style={av.cta} activeOpacity={0.80}>
          <Text style={av.ctaTxt}>{avatarUrl ? 'Modifier la photo' : 'Ajouter une photo'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});
const av = StyleSheet.create({
  block:{flexDirection:'row',alignItems:'center',gap:20,paddingHorizontal:PAD,paddingVertical:24},
  wrap: {position:'relative'},
  img:  {width:80,height:80,borderRadius:40,borderWidth:1,borderColor:C.borderHi},
  cam:  {position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.bg},
  label:{color:C.white,fontSize:14,fontWeight:'600'},
  sub:  {color:C.muted,fontSize:11,lineHeight:16},
  cta:  {paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,alignSelf:'flex-start',marginTop:4},
  ctaTxt:{color:C.offWhite,fontSize:12,fontWeight:'600'},
});

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();

  const [userId,       setUserId]       = useState('');
  const [form,         setForm]         = useState<ProfileForm>(EMPTY);
  const [avatarUrl,    setAvatarUrl]    = useState('');
  const [loadingInit,  setLoadingInit]  = useState(true);
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>('idle');
  const [errors,       setErrors]       = useState<Partial<Record<keyof ProfileForm,string>>>({});
  const [section,      setSection]      = useState<Section>('identity');
  const [avatarLoading,setAvatarLoading]= useState(false);

  const shakeX      = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const debounce    = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef   = useRef<ScrollView>(null);
  const formRef     = useRef<ProfileForm>(EMPTY);
  const uidRef      = useRef('');
  formRef.current   = form;
  uidRef.current    = userId;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }
      setUserId(user.id); uidRef.current = user.id;
      try {
        const p = await fetchProfile(user.id);
        setForm(prev => ({
          ...prev,
          display_name:       p.display_name        ?? '',
          username:           p.username            ?? '',
          bio:                p.bio                 ?? '',
          role:               p.role                ?? 'creator',
          location:           (p as any).location   ?? '',
          equipment:          (p as any).equipment  ?? '',
          specialties:        (p as any).specialties ?? [],
          open_to:            (p as any).open_to    ?? [],
          festivals:          (p as any).festivals  ?? [],
          notable_works:      ((p as any).notable_works as NotableWork[]) ?? [],
          is_industry_contact:p.is_industry_contact ?? false,
          is_pro:             p.is_pro              ?? false,
          contact_email:      (p as any).contact_email ?? '',
          website:            (p as any).website    ?? '',
          social_instagram:   (p as any).social_instagram ?? '',
          social_vimeo:       (p as any).social_vimeo     ?? '',
          social_youtube:     (p as any).social_youtube   ?? '',
          social_imdb:        (p as any).social_imdb      ?? '',
        }));
        if (p.avatar_url) setAvatarUrl(p.avatar_url);
      } catch (e) { if (__DEV__) console.warn('[edit] fetchProfile:', e); }
      finally     { setLoadingInit(false); }
    })();
    return () => clearTimeout(debounce.current);
  }, []);

  // ── patch + auto-save ─────────────────────────────────────────────────────
  const patch = useCallback(<K extends keyof ProfileForm>(key:K, val:ProfileForm[K]) => {
    setForm(p => ({ ...p, [key]:val }));
    setErrors(p => ({ ...p, [key]:undefined }));
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const uid = uidRef.current; if (!uid) return;
      try { await persistProfile(uid, formRef.current); } catch {}
    }, 2500);
  }, []);

  const toggleArr = useCallback((key:'specialties'|'open_to'|'festivals', item:string) => {
    setForm(p => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter(x=>x!==item) : [...arr,item] };
    });
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const uid = uidRef.current; if (!uid) return;
      try { await persistProfile(uid, formRef.current); } catch {}
    }, 2500);
  }, []);

  const addWork    = useCallback(() => setForm(p=>({...p,notable_works:[...p.notable_works,{id:genId(),title:'',year:'',role:'',url:''}]})),[]);
  const updateWork = useCallback((w:NotableWork) => setForm(p=>({...p,notable_works:p.notable_works.map(x=>x.id===w.id?w:x)})),[]);
  const deleteWork = useCallback((id:string) => setForm(p=>({...p,notable_works:p.notable_works.filter(x=>x.id!==id)})),[]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof ProfileForm,string>> = {};
    const unErr = validateUsername(form.username);
    if (unErr)                           errs.username      = unErr;
    if (!validUrl(form.website))         errs.website       = 'URL invalide (https://…)';
    if (!validEmail(form.contact_email)) errs.contact_email = 'Email invalide';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.username || errs.display_name) setSection('identity');
      else setSection('network');
    }
    return Object.keys(errs).length === 0;
  }, [form]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!userId || saveStatus==='saving') return;
    if (!validate()) {
      Animated.sequence([
        Animated.timing(shakeX,{toValue:8, duration:55,useNativeDriver:true}),
        Animated.timing(shakeX,{toValue:-8,duration:55,useNativeDriver:true}),
        Animated.timing(shakeX,{toValue:5, duration:45,useNativeDriver:true}),
        Animated.timing(shakeX,{toValue:0, duration:45,useNativeDriver:true}),
      ]).start();
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
      return;
    }
    setSaveStatus('saving');
    try {
      clearTimeout(debounce.current);
      await persistProfile(userId, form);
      setSaveStatus('saved');
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      Animated.sequence([
        Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.delay(1600),
        Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start(() => setSaveStatus('idle'));
      setTimeout(() => router.back(), 120);
    } catch (e:any) {
      setSaveStatus('error');
      Alert.alert('Erreur', e?.message ?? 'Vérifiez votre connexion.');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  }, [userId, form, validate, saveStatus, shakeX, successFade, router]);

  // ── Avatar ────────────────────────────────────────────────────────────────
  const handleAvatar = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.88, allowsEditing: true, aspect: [1,1],
    });
    if (res.canceled || !res.assets?.[0]) return;
    setAvatarLoading(true);
    if (Platform.OS!=='web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});
    try {
      const url = await persistAvatar(userId, res.assets[0].uri);
      setAvatarUrl(url);
    } catch (e:any) {
      Alert.alert('Erreur upload', e?.message ?? 'Impossible d\'uploader la photo.');
    } finally {
      setAvatarLoading(false);
    }
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────
  if (loadingInit) {
    return (
      <View style={s.root}>
        <GalaxyBackground/>
        <View style={s.loadWrap}>
          <ActivityIndicator color={C.white} size="large"/>
          <Text style={s.loadTxt}>Chargement du profil…</Text>
        </View>
      </View>
    );
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  // ★ renderIdentity — câblé sur form.* avec Field + RoleGrid
  const renderIdentity = () => (
    <>
      {/* ★ Avatar — affiche l'avatar réel ou un avatar neutre */}
      <AvatarPicker
        avatarUrl={avatarUrl}
        loading={avatarLoading}
        username={form.username}
        onPress={handleAvatar}
      />

      {/* Nom d'affichage */}
      <Field
        label="Nom d'affichage"
        value={form.display_name}
        onChange={v => patch('display_name', v)}
        placeholder="Cinéaste Anonyme"
        maxLength={60}
        icon="person-outline"
      />

      {/* Nom d'utilisateur */}
      <Field
        label="Nom d'utilisateur"
        value={form.username}
        onChange={v => patch('username', v.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
        placeholder="monprofil"
        maxLength={30}
        icon="at-outline"
        error={errors.username}
        hint="Lettres, chiffres, points et tirets uniquement"
      />

      {/* Bio */}
      <Field
        label="Biographie"
        value={form.bio}
        onChange={v => patch('bio', v)}
        placeholder="Décrivez votre parcours, votre démarche artistique…"
        multiline
        maxLength={300}
        icon="create-outline"
      />

      <Divider/>

      {/* Rôle principal */}
      <SectionHead
        label="Rôle principal"
        desc="Votre activité principale dans le cinéma"
        badge={ROLES.find(r => r.key === form.role)?.label}
      />
      <RoleGrid selected={form.role} onChange={v => patch('role', v)}/>

      <Divider/>

      {/* Localisation */}
      <Field
        label="Localisation"
        value={form.location}
        onChange={v => patch('location', v)}
        placeholder="Paris, France"
        icon="location-outline"
      />
    </>
  );

  const renderCinema = () => (
    <>
      <SectionHead
        label="Genres maîtrisés"
        desc="Genres cinématographiques dans lesquels vous travaillez"
        badge={form.specialties.length > 0 ? `${form.specialties.length}` : undefined}
      />
      <ChipGrid items={GENRES_CINEMA} selected={form.specialties} onToggle={item => toggleArr('specialties', item)}/>
      <Divider/>
      <Field
        label="Équipement et outils"
        value={form.equipment}
        onChange={v => patch('equipment', v)}
        placeholder="Caméras, logiciels de montage, post-production…"
        multiline maxLength={220} icon="camera-outline"
        hint="Ex : Sony FX6, DaVinci Resolve 18, ProRes RAW…"
      />
      <Divider/>
      <SectionHead label="Festivals" desc="Festivals auxquels vous avez participé ou été sélectionné"
        badge={form.festivals.length > 0 ? `${form.festivals.length}` : undefined}/>
      <ChipGrid items={FESTIVALS_LIST} selected={form.festivals} onToggle={item => toggleArr('festivals', item)}/>
      <Divider/>
      <SectionHead label="Œuvres notables" desc="Vos réalisations les plus importantes"
        badge={form.notable_works.length > 0 ? `${form.notable_works.length}` : undefined}/>
      {form.notable_works.map(w => (
        <WorkCard key={w.id} work={w} onUpdate={updateWork} onDelete={deleteWork}/>
      ))}
      <TouchableOpacity style={s.addBtn} onPress={addWork} activeOpacity={0.80}>
        <Ionicons name="add" size={14} color={C.muted}/>
        <Text style={s.addBtnTxt}>Ajouter une œuvre</Text>
      </TouchableOpacity>
      <Divider/>
      <SectionHead label="Disponibilités" desc="Types de collaborations recherchés"
        badge={form.open_to.length > 0 ? `${form.open_to.length}` : undefined}/>
      <ChipGrid items={COLLABORATIONS} selected={form.open_to} onToggle={item => toggleArr('open_to', item)}/>
      <Divider mt={24} mb={0}/>
      <Toggle label="Professionnel du secteur"
        subtitle="Vous exercez une activité dans l'industrie cinématographique"
        value={form.is_pro} onChange={v => patch('is_pro', v)}/>
      <Toggle label="Disponible pour contact professionnel"
        subtitle="Votre email sera visible par vos connexions Universe"
        value={form.is_industry_contact} onChange={v => patch('is_industry_contact', v)}/>
      {form.is_industry_contact && (
        <>
          <Divider mt={8} mb={8}/>
          <Field label="Email professionnel" value={form.contact_email}
            onChange={v => patch('contact_email', v)}
            placeholder="contact@exemple.com" keyboardType="email-address"
            icon="mail-outline" error={errors.contact_email}/>
        </>
      )}
    </>
  );

  const renderNetwork = () => (
    <>
      <SectionHead label="Site web et portfolio" desc="Votre présence en ligne principale"/>
      <Field label="URL du portfolio" value={form.website} onChange={v => patch('website', v)}
        placeholder="https://monportfolio.com" keyboardType="url"
        icon="globe-outline" error={errors.website}/>
      <Divider/>
      <SectionHead label="Réseaux sociaux" desc="Liens vers vos profils professionnels"/>
      <SocialRow icon="logo-instagram" label="Instagram"
        value={form.social_instagram} onChange={v => patch('social_instagram', v)}
        placeholder="https://instagram.com/monprofil"/>
      <SocialRow icon="videocam-outline" label="Vimeo"
        value={form.social_vimeo} onChange={v => patch('social_vimeo', v)}
        placeholder="https://vimeo.com/monprofil"/>
      <SocialRow icon="logo-youtube" label="YouTube"
        value={form.social_youtube} onChange={v => patch('social_youtube', v)}
        placeholder="https://youtube.com/@machaîne"/>
      <SocialRow icon="film-outline" label="IMDb"
        value={form.social_imdb} onChange={v => patch('social_imdb', v)}
        placeholder="https://imdb.com/name/nm..."/>
      {[form.social_instagram, form.social_vimeo, form.social_youtube, form.social_imdb, form.website]
        .filter(Boolean).length > 0 && (
        <View style={s.linksPreview}>
          <Text style={s.linksLabel}>Liens renseignés</Text>
          <View style={s.linksRow}>
            {form.website          && <View style={s.pill}><Ionicons name="globe-outline"    size={11} color={C.muted}/><Text style={s.pillTxt}>Portfolio</Text></View>}
            {form.social_instagram && <View style={s.pill}><Ionicons name="logo-instagram"   size={11} color={C.muted}/><Text style={s.pillTxt}>Instagram</Text></View>}
            {form.social_vimeo     && <View style={s.pill}><Ionicons name="videocam-outline" size={11} color={C.muted}/><Text style={s.pillTxt}>Vimeo</Text></View>}
            {form.social_youtube   && <View style={s.pill}><Ionicons name="logo-youtube"     size={11} color={C.muted}/><Text style={s.pillTxt}>YouTube</Text></View>}
            {form.social_imdb      && <View style={s.pill}><Ionicons name="film-outline"     size={11} color={C.muted}/><Text style={s.pillTxt}>IMDb</Text></View>}
          </View>
        </View>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* NAV */}
        <Animated.View style={[s.nav, {transform:[{translateX:shakeX}]}]}>
          <TouchableOpacity onPress={() => router.back()} style={s.navBack} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={18} color={C.white}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={s.navTitle}>Modifier le profil</Text>
            {form.display_name && <Text style={s.navSub}>{form.display_name}</Text>}
          </View>
          {/* Bouton sauvegarder */}
          <TouchableOpacity
            style={[s.saveBtn, saveStatus==='saving' && {opacity:0.55}]}
            onPress={handleSave} disabled={saveStatus==='saving'} activeOpacity={0.85}
          >
            {saveStatus==='saving'
              ? <ActivityIndicator color={C.bg} size="small" style={{width:60}}/>
              : <Text style={s.saveBtnTxt}>Sauvegarder</Text>
            }
          </TouchableOpacity>
        </Animated.View>

        {/* TABS */}
        <TabNav active={section} onChange={s => {
          setSection(s);
          scrollRef.current?.scrollTo({ y:0, animated:true });
        }}/>

        {/* CONTENT */}
        <KeyboardAvoidingView style={{flex:1}}
          behavior={Platform.OS==='ios'?'padding':undefined}
          keyboardVerticalOffset={96}>
          <ScrollView ref={scrollRef}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{paddingBottom:100}}>

            {section==='identity' && renderIdentity()}
            {section==='cinema'   && renderCinema()}
            {section==='network'  && renderNetwork()}

            {/* Feedback succès */}
            <Animated.View style={[s.savedRow, {opacity:successFade}]}>
              <Ionicons name="checkmark-circle-outline" size={14} color={C.success}/>
              <Text style={s.savedTxt}>Profil mis à jour avec succès</Text>
            </Animated.View>

            <Text style={s.autoTxt}>Sauvegarde automatique activée</Text>
            <View style={{height:40}}/>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:     {flex:1,backgroundColor:C.bg},
  safe:     {flex:1},
  loadWrap: {flex:1,alignItems:'center',justifyContent:'center',gap:16},
  loadTxt:  {color:C.muted,fontSize:14},
  nav:      {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12},
  navBack:  {width:36,height:36,borderRadius:18,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  navTitle: {color:C.white,fontSize:17,fontWeight:'700',letterSpacing:-0.2},
  navSub:   {color:C.muted,fontSize:11,marginTop:1},
  saveBtn:  {paddingHorizontal:16,paddingVertical:9,borderRadius:22,backgroundColor:C.white,minWidth:110,alignItems:'center'},
  saveBtnTxt:{color:C.bg,fontSize:13,fontWeight:'700'},
  addBtn:   {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:PAD,marginTop:4,marginBottom:8,paddingVertical:13,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',backgroundColor:C.glass},
  addBtnTxt:{color:C.muted,fontSize:12,fontWeight:'600'},
  linksPreview:{marginHorizontal:PAD,marginTop:20,padding:16,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  linksLabel:  {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:12},
  linksRow:    {flexDirection:'row',flexWrap:'wrap',gap:8},
  pill:        {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  pillTxt:     {color:C.muted,fontSize:11,fontWeight:'500'},
  savedRow:    {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,marginTop:16},
  savedTxt:    {color:C.success,fontSize:13,fontWeight:'600'},
  autoTxt:     {color:'rgba(255,255,255,0.18)',fontSize:11,textAlign:'center',marginTop:8},
});