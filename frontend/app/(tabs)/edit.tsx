import React, {
  memo, useCallback, useEffect,
  useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated,
  KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { Image }          from 'expo-image';
import { BlurView }       from 'expo-blur';
import { Ionicons }       from '@expo/vector-icons';
import { useRouter }      from 'expo-router';
import { StatusBar }      from 'expo-status-bar';
import { SafeAreaView }   from 'react-native-safe-area-context';
import * as ImagePicker   from 'expo-image-picker';
import * as FileSystem    from 'expo-file-system';
import * as Haptics       from 'expo-haptics';
import { decode }         from 'base64-arraybuffer';

import { supabase }       from '@/lib/supabase';
import GalaxyBackground   from '@/components/social/GalaxyBackground';

// ─────────────────────────────────────────────────────────────────────────────
// TOKENS — blanc/transparent uniquement, aucune couleur
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  white:      '#FFFFFF',
  offWhite:   'rgba(255,255,255,0.82)',
  muted:      'rgba(255,255,255,0.36)',
  faint:      'rgba(255,255,255,0.10)',
  border:     'rgba(255,255,255,0.10)',
  borderHi:   'rgba(255,255,255,0.28)',
  borderFocus:'rgba(255,255,255,0.55)',
  glass:      'rgba(255,255,255,0.04)',
  glassMd:    'rgba(255,255,255,0.07)',
  glassHi:    'rgba(255,255,255,0.11)',
  success:    '#22C55E',
  error:      '#EF4444',
  bg:         '#03000A',
} as const;

const PAD = 20;

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES MÉTIER
// ─────────────────────────────────────────────────────────────────────────────
const ROLES: { key:string; label:string; icon:keyof typeof Ionicons.glyphMap }[] = [
  { key:'director', label:'Réalisateur·rice',     icon:'film-outline'          },
  { key:'producer', label:'Producteur·rice',       icon:'briefcase-outline'     },
  { key:'writer',   label:'Scénariste',            icon:'create-outline'        },
  { key:'actor',    label:'Acteur·rice',           icon:'people-outline'        },
  { key:'dp',       label:'Dir. photo',            icon:'camera-outline'        },
  { key:'editor',   label:'Monteur·euse',          icon:'cut-outline'           },
  { key:'critic',   label:'Critique',              icon:'newspaper-outline'     },
  { key:'creator',  label:'Créateur·rice',         icon:'sparkles-outline'      },
  { key:'other',    label:'Autre',                 icon:'ellipsis-horizontal-circle-outline' },
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


// ── CONSTANTES POUR ÉTAT NEUTRE ──────────────────────────────────────────────
const DEFAULT_AVATAR = 'https://i.pravatar.cc/150?u=guest';
const DEFAULT_DISPLAY_NAME = 'Cinéaste Anonyme';
const DEFAULT_USERNAME = 'utilisateur';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function genId() { return Math.random().toString(36).slice(2,9); }
function validUrl(u:string)      { return !u || /^https?:\/\/.+/.test(u); }
function validEmail(e:string)    { return !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
function validateUsername(u:string): string|null {
  if (!u.trim())          return 'Champ obligatoire';
  if (u.length < 3)       return '3 caractères minimum';
  if (!/^[a-z0-9._-]+$/i.test(u)) return 'Lettres, chiffres et . _ - uniquement';
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ★ DB — UPDATE + INSERT SÉPARÉS (pas d'upsert → plus de 400)
// ─────────────────────────────────────────────────────────────────────────────
async function fetchProfile(uid:string): Promise<Partial<ProfileForm> & {avatar_url?:string}> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', uid)
    .maybeSingle();                      // maybeSingle : pas d'erreur si absent
  if (error) throw new Error(error.message);
  return (data ?? {}) as any;
}

async function persistProfile(uid:string, form:ProfileForm): Promise<void> {
  const payload = {
    ...form,
    // S'assurer que les arrays ne sont jamais null
    specialties:    form.specialties    ?? [],
    open_to:        form.open_to        ?? [],
    festivals:      form.festivals      ?? [],
    notable_works:  form.notable_works  ?? [],
    updated_at: new Date().toISOString(),
  };

  // ★ FIX : UPDATE d'abord (évite le 400 du upsert avec RLS)
  const { error: updateErr, count } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', uid)
    .select('id', { count:'exact', head:true });

  if (updateErr) {
    // Si UPDATE échoue (erreur réelle, pas "0 lignes"), on essaie INSERT
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: uid, ...payload });
    if (insertErr) throw new Error(insertErr.message);
    return;
  }

  // Si UPDATE a affecté 0 ligne (profil inexistant), INSERT
  if (count === 0) {
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: uid, ...payload });
    if (insertErr) throw new Error(insertErr.message);
  }
}

async function persistAvatar(uid:string, localUri:string): Promise<string> {
  const isBlob = localUri.startsWith('blob:');
  const ext    = isBlob ? 'jpg' : (localUri.split('.').pop()?.toLowerCase() ?? 'jpg');
  const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path   = `${uid}/avatar_${Date.now()}.${ext}`;

  let payload: ArrayBuffer;
  if (Platform.OS === 'web' || isBlob) {
    payload = await (await fetch(localUri)).arrayBuffer();
  } else {
    payload = decode(await FileSystem.readAsStringAsync(localUri, { encoding:'base64' }));
  }

  const { data, error } = await supabase.storage
    .from('avatars').upload(path, payload, { contentType:mime, upsert:true });
  if (error) throw new Error(error.message);

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
  const url = urlData.publicUrl;

  // Met à jour avatar_url séparément (UPDATE simple, pas d'upsert)
  await supabase.from('profiles')
    .update({ avatar_url:url, updated_at:new Date().toISOString() })
    .eq('id', uid);

  return url;
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANTS UI — glass + blanc, aucune couleur
// ─────────────────────────────────────────────────────────────────────────────
const Divider = memo(function Divider({mt=24,mb=8}:{mt?:number;mb?:number}) {
  return (
    <View style={{height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginHorizontal:PAD,marginTop:mt,marginBottom:mb}}/>
  );
});

const SectionHead = memo(({label,desc,badge}:{label:string;desc?:string;badge?:string}) => (
  <View style={sh.wrap}>
    <View style={{flex:1}}>
      <Text style={sh.label}>{label}</Text>
      {desc && <Text style={sh.desc}>{desc}</Text>}
    </View>
    {badge && <View style={sh.badge}><Text style={sh.badgeTxt}>{badge}</Text></View>}
  </View>
));
const sh = StyleSheet.create({
  wrap:     {flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',paddingHorizontal:PAD,paddingTop:32,paddingBottom:16},
  label:    {color:C.white,fontSize:13,fontWeight:'700',letterSpacing:1.4,textTransform:'uppercase'},
  desc:     {color:C.muted,fontSize:12,marginTop:4,lineHeight:17},
  badge:    {paddingHorizontal:10,paddingVertical:3,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  badgeTxt: {color:C.muted,fontSize:10,fontWeight:'700'},
});

const Field = memo(function Field({
  label,value,onChange,placeholder,multiline,maxLength,
  keyboardType='default',error,icon,hint,
}:{
  label:string; value:string; onChange:(v:string)=>void; placeholder?:string;
  multiline?:boolean; maxLength?:number; keyboardType?:'default'|'email-address'|'url'|'numeric';
  error?:string|null; icon?:keyof typeof Ionicons.glyphMap; hint?:string;
}) {
  const fa = useRef(new Animated.Value(0)).current;
  const onFocus = useCallback(() => Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start(),[fa]);
  const onBlur  = useCallback(() => Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start(),[fa]);
  const lineColor = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.border,error?C.error:C.borderFocus]});
  const lblColor  = fa.interpolate({inputRange:[0,1],outputRange:[error?C.error:C.muted,error?C.error:C.offWhite]});
  return (
    <View style={fi.wrap}>
      <Animated.Text style={[fi.label,{color:lblColor}]}>{label}</Animated.Text>
      <View style={fi.row}>
        {icon && <Ionicons name={icon} size={15} color={C.muted} style={fi.icon}/>}
        <TextInput
          style={[fi.input, multiline && fi.multi]}
          value={value} onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.18)"
          multiline={multiline} maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType==='email-address'||keyboardType==='url'?'none':'sentences'}
          autoCorrect={false}
          selectionColor={C.white}
          onFocus={onFocus} onBlur={onBlur}
          returnKeyType={multiline?'default':'next'}
          numberOfLines={multiline?4:1}
        />
        {maxLength && value.length > maxLength*0.75 && (
          <Text style={fi.counter}>{value.length}/{maxLength}</Text>
        )}
      </View>
      <Animated.View style={[fi.line,{backgroundColor:lineColor}]}/>
      {error && <Text style={fi.error}>{error}</Text>}
      {hint  && !error && <Text style={fi.hint}>{hint}</Text>}
    </View>
  );
});
const fi = StyleSheet.create({
  wrap:   {paddingHorizontal:PAD,marginBottom:20},
  label:  {fontSize:10,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:10},
  row:    {flexDirection:'row',alignItems:'flex-end',gap:10},
  icon:   {paddingBottom:12},
  input:  {flex:1,color:C.white,fontSize:15,paddingVertical:10,lineHeight:21},
  multi:  {minHeight:90,textAlignVertical:'top',paddingTop:8},
  counter:{color:C.muted,fontSize:10,paddingBottom:12},
  line:   {height:StyleSheet.hairlineWidth,marginTop:2},
  error:  {color:C.error,fontSize:11,marginTop:6},
  hint:   {color:C.muted,fontSize:11,marginTop:6,lineHeight:16},
});

const Toggle = memo(function Toggle({label,subtitle,value,onChange}:{label:string;subtitle?:string;value:boolean;onChange:(v:boolean)=>void}) {
  const a = useRef(new Animated.Value(value?1:0)).current;
  useEffect(() => {
    Animated.spring(a,{toValue:value?1:0,tension:120,friction:9,useNativeDriver:false}).start();
  },[value,a]);
  const trackBg = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.10)','rgba(255,255,255,0.80)']});
  const thumbX  = a.interpolate({inputRange:[0,1],outputRange:[2,22]});
  const thumbC  = a.interpolate({inputRange:[0,1],outputRange:['rgba(255,255,255,0.55)','#03000A']});
  return (
    <TouchableOpacity style={tg.row} onPress={()=>{if(Platform.OS!=='web')Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});onChange(!value);}} activeOpacity={0.80}>
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
            {on && <Ionicons name="checkmark" size={10} color={C.bg}/>}
            <Text style={[cg.txt,on&&cg.txtOn]}>{item}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});
const cg = StyleSheet.create({
  grid: {flexDirection:'row',flexWrap:'wrap',gap:8,paddingHorizontal:PAD},
  chip: {flexDirection:'row',alignItems:'center',gap:5,paddingHorizontal:13,paddingVertical:8,borderRadius:24,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  on:   {backgroundColor:C.white,borderColor:C.white},
  txt:  {color:C.muted,fontSize:12,fontWeight:'500'},
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
  grid:    {flexDirection:'row',flexWrap:'wrap',gap:10,paddingHorizontal:PAD},
  item:    {width:'30%',flexGrow:1,alignItems:'center',justifyContent:'center',gap:6,paddingVertical:14,paddingHorizontal:8,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  on:      {backgroundColor:C.white,borderColor:C.white},
  label:   {color:C.muted,fontSize:10,fontWeight:'500',textAlign:'center'},
  labelOn: {color:C.bg,fontWeight:'700'},
});

const WorkCard = memo(function WorkCard({work,onUpdate,onDelete}:{work:NotableWork;onUpdate:(w:NotableWork)=>void;onDelete:(id:string)=>void}) {
  return (
    <View style={wc.wrap}>
      <View style={wc.head}>
        <View style={wc.dot}/>
        <Text style={wc.headTxt} numberOfLines={1}>{work.title||'Titre de l\'œuvre'}</Text>
        <TouchableOpacity onPress={()=>onDelete(work.id)} hitSlop={10} style={wc.del}>
          <Ionicons name="close" size={14} color={C.muted}/>
        </TouchableOpacity>
      </View>
      <View style={wc.row}>
        <TextInput style={[wc.inp,{flex:1}]} value={work.title} onChangeText={v=>onUpdate({...work,title:v})} placeholder="Titre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
        <TextInput style={[wc.inp,{width:68,textAlign:'center'}]} value={work.year} onChangeText={v=>onUpdate({...work,year:v})} placeholder="Année" placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="numeric" maxLength={4} selectionColor={C.white}/>
      </View>
      <View style={wc.sep}/>
      <TextInput style={wc.inp} value={work.role} onChangeText={v=>onUpdate({...work,role:v})} placeholder="Votre rôle sur cette œuvre" placeholderTextColor="rgba(255,255,255,0.18)" selectionColor={C.white}/>
      <View style={wc.sep}/>
      <TextInput style={[wc.inp,{fontSize:12}]} value={work.url} onChangeText={v=>onUpdate({...work,url:v})} placeholder="Lien optionnel" placeholderTextColor="rgba(255,255,255,0.14)" keyboardType="url" autoCapitalize="none" selectionColor={C.white}/>
    </View>
  );
});
const wc = StyleSheet.create({
  wrap: {marginHorizontal:PAD,marginBottom:12,borderRadius:16,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,backgroundColor:C.glass,padding:16},
  head: {flexDirection:'row',alignItems:'center',gap:10,marginBottom:14},
  dot:  {width:4,height:4,borderRadius:2,backgroundColor:C.white},
  headTxt:{flex:1,color:C.offWhite,fontSize:12,fontWeight:'600'},
  del:  {width:24,height:24,alignItems:'center',justifyContent:'center'},
  row:  {flexDirection:'row',gap:10},
  inp:  {color:C.white,fontSize:13,paddingVertical:6},
  sep:  {height:StyleSheet.hairlineWidth,backgroundColor:C.border,marginVertical:10},
});

const SocialRow = memo(function SocialRow({icon,label,value,onChange,placeholder}:{icon:keyof typeof Ionicons.glyphMap;label:string;value:string;onChange:(v:string)=>void;placeholder:string}) {
  const fa = useRef(new Animated.Value(0)).current;
  const lineC = fa.interpolate({inputRange:[0,1],outputRange:[C.border,C.borderFocus]});
  return (
    <View style={socRow.wrap}>
      <View style={socRow.iconBox}><Ionicons name={icon} size={15} color={C.muted}/></View>
      <View style={{flex:1}}>
        <Text style={socRow.label}>{label}</Text>
        <TextInput style={socRow.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="rgba(255,255,255,0.18)" keyboardType="url" autoCapitalize="none" autoCorrect={false} selectionColor={C.white}
          onFocus={()=>Animated.timing(fa,{toValue:1,duration:180,useNativeDriver:false}).start()}
          onBlur={()=>Animated.timing(fa,{toValue:0,duration:180,useNativeDriver:false}).start()}/>
        <Animated.View style={{height:StyleSheet.hairlineWidth,backgroundColor:lineC}}/>
      </View>
    </View>
  );
});
const socRow = StyleSheet.create({
  wrap:    {flexDirection:'row',alignItems:'flex-end',gap:14,paddingHorizontal:PAD,paddingVertical:6,marginBottom:14},
  iconBox: {width:36,height:36,borderRadius:12,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center',marginBottom:10},
  label:   {color:C.muted,fontSize:9,fontWeight:'700',letterSpacing:1.0,textTransform:'uppercase',marginBottom:8},
  input:   {color:C.white,fontSize:13,paddingVertical:8},
});

const TABS: {key:Section;label:string}[] = [
  {key:'identity',label:'Identité'},
  {key:'cinema',  label:'Cinéma'  },
  {key:'network', label:'Réseaux' },
];
const TabNav = memo(function TabNav({active,onChange}:{active:Section;onChange:(s:Section)=>void}) {
  return (
    <View style={tn.wrap}>
      {TABS.map(s=>{
        const on=active===s.key;
        return (
          <TouchableOpacity key={s.key} style={tn.tab} onPress={()=>onChange(s.key)} activeOpacity={0.80}>
            <Text style={[tn.label,on&&tn.labelOn]}>{s.label}</Text>
            {on && <View style={tn.bar}/>}
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

// ─────────────────────────────────────────────────────────────────────────────
// ÉCRAN
// ─────────────────────────────────────────────────────────────────────────────
export default function EditProfileScreen() {
  const router = useRouter();

  const [userId,        setUserId]        = useState('');
  const [form,          setForm]          = useState<ProfileForm>(EMPTY);
  const [avatarUrl,     setAvatarUrl]     = useState('');
  const [loadingInit,   setLoadingInit]   = useState(true);
  const [saveStatus,    setSaveStatus]    = useState<SaveStatus>('idle');
  const [errors,        setErrors]        = useState<Partial<Record<keyof ProfileForm,string>>>({});
  const [section,       setSection]       = useState<Section>('identity');
  const [avatarLoading, setAvatarLoading] = useState(false);

  const saveScale   = useRef(new Animated.Value(1)).current;
  const shakeX      = useRef(new Animated.Value(0)).current;
  const successFade = useRef(new Animated.Value(0)).current;
  const debounce    = useRef<ReturnType<typeof setTimeout>>();
  const scrollRef   = useRef<ScrollView>(null);
  // Ref pour accéder au form courant dans le debounce sans capturer une vieille closure
  const formRef     = useRef<ProfileForm>(EMPTY);
  const userIdRef   = useRef('');
  formRef.current   = form;
  userIdRef.current = userId;

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data:{ user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/'); return; }
      setUserId(user.id);
      userIdRef.current = user.id;

      try {
        const p = await fetchProfile(user.id);
        setForm(prev => ({
          ...prev,
          display_name:        p.display_name       ?? '',
          username:            p.username           ?? '',
          bio:                 p.bio                ?? '',
          role:                p.role               ?? 'creator',
          location:            p.location           ?? '',
          equipment:           p.equipment          ?? '',
          specialties:         p.specialties        ?? [],
          open_to:             p.open_to            ?? [],
          festivals:           p.festivals          ?? [],
          notable_works:       (p.notable_works as NotableWork[]) ?? [],
          is_industry_contact: p.is_industry_contact ?? false,
          is_pro:              p.is_pro             ?? false,
          contact_email:       p.contact_email      ?? '',
          website:             p.website            ?? '',
          social_instagram:    p.social_instagram   ?? '',
          social_vimeo:        p.social_vimeo       ?? '',
          social_youtube:      p.social_youtube     ?? '',
          social_imdb:         p.social_imdb        ?? '',
        }));
        if (p.avatar_url) setAvatarUrl(p.avatar_url);
      } catch (e) { console.warn('[edit] fetchProfile:', e); }
      finally     { setLoadingInit(false); }
    })();
    return () => clearTimeout(debounce.current);
  }, []);

  // ── Patch + auto-save ─────────────────────────────────────────────────────
  const patch = useCallback(<K extends keyof ProfileForm>(key:K, value:ProfileForm[K]) => {
    setForm(prev => ({ ...prev, [key]:value }));
    setErrors(prev => ({ ...prev, [key]:undefined }));
    // Auto-save silencieux après 2.5 s d'inactivité
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const uid = userIdRef.current;
      if (!uid) return;
      try { await persistProfile(uid, formRef.current); }
      catch (e) { console.warn('[edit] auto-save:', e); }
    }, 2500);
  }, []);

  const toggleArr = useCallback((key:'specialties'|'open_to'|'festivals', item:string) => {
    setForm(prev => {
      const arr = prev[key] as string[];
      const next = arr.includes(item) ? arr.filter(x=>x!==item) : [...arr,item];
      return { ...prev, [key]:next };
    });
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const uid = userIdRef.current;
      if (!uid) return;
      try { await persistProfile(uid, formRef.current); }
      catch {}
    }, 2500);
  }, []);

  const addWork    = useCallback(() => setForm(p=>({...p,notable_works:[...p.notable_works,{id:genId(),title:'',year:'',role:'',url:''}]})),[]);
  const updateWork = useCallback((w:NotableWork) => setForm(p=>({...p,notable_works:p.notable_works.map(x=>x.id===w.id?w:x)})),[]);
  const deleteWork = useCallback((id:string) => setForm(p=>({...p,notable_works:p.notable_works.filter(x=>x.id!==id)})),[]);

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errs: Partial<Record<keyof ProfileForm,string>> = {};
    const unErr = validateUsername(form.username);
    if (unErr)                            errs.username      = unErr;
    if (!validUrl(form.website))          errs.website       = 'URL invalide (commencer par https://)';
    if (!validEmail(form.contact_email))  errs.contact_email = 'Email invalide';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.username || errs.display_name) setSection('identity');
      else if (errs.contact_email)            setSection('cinema');
      else                                     setSection('network');
    }
    return Object.keys(errs).length === 0;
  }, [form]);

  // ── Save manuel ───────────────────────────────────────────────────────────
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
    Animated.spring(saveScale,{toValue:0.94,tension:200,friction:7,useNativeDriver:true}).start();

    try {
      clearTimeout(debounce.current);           // annule l'auto-save en attente
      await persistProfile(userId, form);
      setSaveStatus('saved');
      if (Platform.OS!=='web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
      Animated.sequence([
        Animated.spring(saveScale,  {toValue:1,tension:200,friction:7,useNativeDriver:true}),
        Animated.timing(successFade,{toValue:1,duration:250,useNativeDriver:true}),
        Animated.delay(1600),
        Animated.timing(successFade,{toValue:0,duration:250,useNativeDriver:true}),
      ]).start(()=>setSaveStatus('idle'));
      setTimeout(()=>router.back(),120);
    } catch (e:any) {
      setSaveStatus('error');
      Animated.spring(saveScale,{toValue:1,tension:200,friction:7,useNativeDriver:true}).start();
      Alert.alert('Erreur de sauvegarde', e?.message ?? 'Vérifiez votre connexion et réessayez.');
      setTimeout(()=>setSaveStatus('idle'),2000);
    }
  }, [userId, form, validate, saveStatus, saveScale, shakeX, successFade, router]);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatar = useCallback(async () => {
    const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!granted) { Alert.alert('Permission requise','Autorisez l\'accès à la galerie.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:ImagePicker.MediaTypeOptions.Images,
      quality:0.88, allowsEditing:true, aspect:[1,1],
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

  // ── Rendu sections ────────────────────────────────────────────────────────
  const renderIdentity = () => (
    <>
      {/* Avatar */}
      <View style={s.avatarBlock}>
        <TouchableOpacity onPress={handleAvatar} activeOpacity={0.88} style={s.avatarWrap}>
          {/* Affiche l'avatar de l'utilisateur, ou un avatar neutre par défaut */}
          <Image 
            source={{ uri: avatarUrl || 'https://i.pravatar.cc/150?u=guest' }} 
            style={s.avatar} 
            contentFit="cover"
          />
          <View style={s.avatarCam}>
            {avatarLoading
              ? <ActivityIndicator color={C.white} size="small"/>
              : <Ionicons name="camera-outline" size={14} color={C.white}/>
            }
          </View>
        </TouchableOpacity>
        <View style={{flex:1,gap:6}}>
          <Text style={s.avatarLabel}>Photo de profil</Text>
          <Text style={s.avatarSub}>Format carré · JPEG ou PNG · Max 5 Mo</Text>
          <TouchableOpacity onPress={handleAvatar} style={s.avatarCta} activeOpacity={0.80}>
            <Text style={s.avatarCtaTxt}>{avatarUrl ? 'Modifier la photo' : 'Ajouter une photo'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Champs d'identité (Ajustez les variables selon vos noms d'états réels) */}
      <View style={{ marginTop: 24, gap: 16 }}>
        <View>
          <Text style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Nom d'affichage</Text>
          <TextInput
            style={{ backgroundColor: '#1A1A1A', color: 'white', padding: 12, borderRadius: 8 }}
            placeholder="Cinéaste Anonyme"
            placeholderTextColor="#555"
            // value={displayName}
            // onChangeText={setDisplayName}
          />
        </View>
        <View>
          <Text style={{ color: '#888', fontSize: 12, marginBottom: 6 }}>Nom d'utilisateur</Text>
          <TextInput
            style={{ backgroundColor: '#1A1A1A', color: 'white', padding: 12, borderRadius: 8 }}
            placeholder="@utilisateur"
            placeholderTextColor="#555"
            // value={username}
            // onChangeText={setUsername}
          />
        </View>
      </View>
    </>
  );

  const renderCinema = () => (
    <>
      <SectionHead label="Genres maîtrisés"
        desc="Genres cinématographiques dans lesquels vous travaillez"
        badge={form.specialties.length>0?`${form.specialties.length} sélectionné${form.specialties.length>1?'s':''}`:undefined}/>
      <ChipGrid items={GENRES_CINEMA} selected={form.specialties} onToggle={item=>toggleArr('specialties',item)}/>
      <Divider/>
      <Field label="Équipement et outils" value={form.equipment} onChange={v=>patch('equipment',v)}
        placeholder="Caméras, logiciels de montage, outils de post-production…"
        multiline maxLength={220} icon="camera-outline"
        hint="Ex : Sony FX6, DaVinci Resolve 18, ProRes RAW…"/>
      <Divider/>
      <SectionHead label="Festivals"
        desc="Festivals auxquels vous avez participé ou été sélectionné"
        badge={form.festivals.length>0?`${form.festivals.length}`:undefined}/>
      <ChipGrid items={FESTIVALS_LIST} selected={form.festivals} onToggle={item=>toggleArr('festivals',item)}/>
      <Divider/>
      <SectionHead label="Œuvres notables"
        desc="Vos réalisations les plus importantes"
        badge={form.notable_works.length>0?`${form.notable_works.length}`:undefined}/>
      {form.notable_works.map(w=><WorkCard key={w.id} work={w} onUpdate={updateWork} onDelete={deleteWork}/>)}
      <TouchableOpacity style={s.addBtn} onPress={addWork} activeOpacity={0.80}>
        <Ionicons name="add" size={14} color={C.muted}/>
        <Text style={s.addBtnTxt}>Ajouter une œuvre</Text>
      </TouchableOpacity>
      <Divider/>
      <SectionHead label="Disponibilités"
        desc="Types de collaborations recherchés"
        badge={form.open_to.length>0?`${form.open_to.length}`:undefined}/>
      <ChipGrid items={COLLABORATIONS} selected={form.open_to} onToggle={item=>toggleArr('open_to',item)}/>
      <Divider mt={24} mb={0}/>
      <Toggle label="Professionnel du secteur"
        subtitle="Vous exercez une activité dans l'industrie cinématographique"
        value={form.is_pro} onChange={v=>patch('is_pro',v)}/>
      <Toggle label="Disponible pour contact professionnel"
        subtitle="Votre email sera visible par vos connexions Universe"
        value={form.is_industry_contact} onChange={v=>patch('is_industry_contact',v)}/>
      {form.is_industry_contact&&(
        <><Divider mt={8} mb={8}/>
        <Field label="Email professionnel" value={form.contact_email}
          onChange={v=>patch('contact_email',v)}
          placeholder="contact@exemple.com" keyboardType="email-address"
          icon="mail-outline" error={errors.contact_email}/></>
      )}
    </>
  );

  const renderNetwork = () => (
    <>
      <SectionHead label="Site web et portfolio" desc="Votre présence en ligne principale"/>
      <Field label="URL du portfolio" value={form.website} onChange={v=>patch('website',v)}
        placeholder="https://monportfolio.com" keyboardType="url"
        icon="globe-outline" error={errors.website}/>
      <Divider/>
      <SectionHead label="Réseaux sociaux" desc="Liens vers vos profils professionnels"/>
      <SocialRow icon="logo-instagram" label="Instagram"
        value={form.social_instagram} onChange={v=>patch('social_instagram',v)}
        placeholder="https://instagram.com/monprofil"/>
      <SocialRow icon="videocam-outline" label="Vimeo"
        value={form.social_vimeo} onChange={v=>patch('social_vimeo',v)}
        placeholder="https://vimeo.com/monprofil"/>
      <SocialRow icon="logo-youtube" label="YouTube"
        value={form.social_youtube} onChange={v=>patch('social_youtube',v)}
        placeholder="https://youtube.com/@machaîne"/>
      <SocialRow icon="film-outline" label="IMDb"
        value={form.social_imdb} onChange={v=>patch('social_imdb',v)}
        placeholder="https://imdb.com/name/nm..."/>
      {[form.social_instagram,form.social_vimeo,form.social_youtube,form.social_imdb,form.website].filter(Boolean).length>0&&(
        <View style={s.linksPreview}>
          <Text style={s.linksLabel}>Liens renseignés sur votre profil</Text>
          <View style={s.linksRow}>
            {form.website          &&<View style={s.linkPill}><Ionicons name="globe-outline"   size={11} color={C.muted}/><Text style={s.linkPillTxt}>Portfolio</Text></View>}
            {form.social_instagram &&<View style={s.linkPill}><Ionicons name="logo-instagram"  size={11} color={C.muted}/><Text style={s.linkPillTxt}>Instagram</Text></View>}
            {form.social_vimeo     &&<View style={s.linkPill}><Ionicons name="videocam-outline" size={11} color={C.muted}/><Text style={s.linkPillTxt}>Vimeo</Text></View>}
            {form.social_youtube   &&<View style={s.linkPill}><Ionicons name="logo-youtube"    size={11} color={C.muted}/><Text style={s.linkPillTxt}>YouTube</Text></View>}
            {form.social_imdb      &&<View style={s.linkPill}><Ionicons name="film-outline"    size={11} color={C.muted}/><Text style={s.linkPillTxt}>IMDb</Text></View>}
          </View>
        </View>
      )}
    </>
  );

  return (
    <View style={s.root}>
      <StatusBar style="light"/>
      <GalaxyBackground/>
      <SafeAreaView style={s.safe} edges={['top']}>

        {/* NAVBAR */}
        <View style={s.nav}>
          <TouchableOpacity onPress={()=>router.back()} style={s.navBack} activeOpacity={0.80}>
            <Ionicons name="chevron-back" size={18} color={C.white}/>
          </TouchableOpacity>
          <View style={{flex:1}}>
            <Text style={s.navTitle}>Modifier le profil</Text>
            {form.display_name&&<Text style={s.navSub}>{form.display_name}</Text>}
          </View>
         
        </View>

        {/* TABS */}
        <TabNav active={section} onChange={s=>{setSection(s);scrollRef.current?.scrollTo({y:0,animated:true});}}/>

        {/* CONTENT */}
        <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={96}>
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:80}}>
            {section==='identity' && renderIdentity()}
            {section==='cinema'   && renderCinema()}
            {section==='network'  && renderNetwork()}

            {/* CTA bas */}
            <View style={s.cta}>
              <TouchableOpacity
                style={[s.ctaBtn,saveStatus==='saving'&&{opacity:0.65}]}
                onPress={handleSave} disabled={saveStatus==='saving'} activeOpacity={0.86}
              >
                {saveStatus==='saving'
                  ? <ActivityIndicator color={C.bg} size="small"/>
                  : <Text style={s.ctaTxt}>Enregistrer</Text>
                }
              </TouchableOpacity>
              <Animated.View style={[s.savedRow,{opacity:successFade}]}>
                <Ionicons name="checkmark-circle-outline" size={14} color={C.success}/>
                <Text style={s.savedTxt}>Profil mis à jour avec succès</Text>
              </Animated.View>
              <Text style={s.autoTxt}>Sauvegarde automatique activée · modifications préservées</Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:  {flex:1,backgroundColor:C.bg},
  safe:  {flex:1},
  loadWrap:{flex:1,alignItems:'center',justifyContent:'center',gap:16},
  loadTxt: {color:C.muted,fontSize:14},

  nav:     {flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:16,paddingVertical:12},
  navBack: {width:36,height:36,borderRadius:18,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  navTitle:{color:C.white,fontSize:17,fontWeight:'700',letterSpacing:-0.2},
  navSub:  {color:C.muted,fontSize:11,marginTop:1},

  saveBtn:    {paddingHorizontal:16,paddingVertical:9,borderRadius:22,backgroundColor:C.white,minWidth:100,alignItems:'center'},
  saveBtnTxt: {color:C.bg,fontSize:13,fontWeight:'700'},

  avatarBlock:{flexDirection:'row',alignItems:'center',gap:20,paddingHorizontal:PAD,paddingVertical:24},
  avatarWrap: {position:'relative'},
  avatar:     {width:80,height:80,borderRadius:40,borderWidth:1,borderColor:C.borderHi},
  avatarEmpty:{width:80,height:80,borderRadius:40,backgroundColor:C.glass,borderWidth:1,borderColor:C.border,alignItems:'center',justifyContent:'center'},
  avatarCam:  {position:'absolute',bottom:0,right:0,width:26,height:26,borderRadius:13,backgroundColor:C.white,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:C.bg},
  avatarLabel:{color:C.white,fontSize:14,fontWeight:'600'},
  avatarSub:  {color:C.muted,fontSize:11,lineHeight:16},
  avatarCta:  {paddingHorizontal:14,paddingVertical:6,borderRadius:20,borderWidth:StyleSheet.hairlineWidth,borderColor:C.borderHi,alignSelf:'flex-start',marginTop:4},
  avatarCtaTxt:{color:C.offWhite,fontSize:12,fontWeight:'600'},

  addBtn:    {flexDirection:'row',alignItems:'center',gap:8,marginHorizontal:PAD,marginTop:4,marginBottom:8,paddingVertical:13,borderRadius:14,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border,justifyContent:'center',backgroundColor:C.glass},
  addBtnTxt: {color:C.muted,fontSize:12,fontWeight:'600'},

  linksPreview:{marginHorizontal:PAD,marginTop:20,padding:16,borderRadius:14,backgroundColor:C.glass,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  linksLabel:  {color:C.muted,fontSize:10,fontWeight:'700',letterSpacing:0.8,textTransform:'uppercase',marginBottom:12},
  linksRow:    {flexDirection:'row',flexWrap:'wrap',gap:8},
  linkPill:    {flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:C.glassHi,borderWidth:StyleSheet.hairlineWidth,borderColor:C.border},
  linkPillTxt: {color:C.muted,fontSize:11,fontWeight:'500'},

  cta:     {marginTop:40,paddingHorizontal:PAD,gap:14,alignItems:'center'},
  ctaBtn:  {width:'100%',backgroundColor:C.white,borderRadius:24,paddingVertical:16,alignItems:'center'},
  ctaTxt:  {color:C.bg,fontSize:15,fontWeight:'700',letterSpacing:0.2},
  savedRow:{flexDirection:'row',alignItems:'center',gap:7},
  savedTxt:{color:C.success,fontSize:13,fontWeight:'600'},
  autoTxt: {color:'rgba(255,255,255,0.18)',fontSize:11,textAlign:'center'},
});