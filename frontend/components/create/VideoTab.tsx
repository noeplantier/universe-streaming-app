/**
 * components/create/VideoTab.tsx — UNIVERSE
 *
 * Flow : Vidéo → Miniature (galerie, toujours dispo) → Infos → Upload → Backoffice
 *
 * ★★ CHANGEMENTS (sur demande) ★★
 * 1. ★ UPLOAD NETTEMENT PLUS RAPIDE :
 *    a) Compression vidéo côté client avant envoi (react-native-compressor,
 *       natif uniquement) — la durée d'upload est directement proportionnelle
 *       à la taille du fichier, donc réduire un master téléphone (souvent
 *       40-60 Mbps H.264) à un débit raisonnable divise le temps de
 *       transfert d'autant. C'est le seul levier honnête pour un vrai gain
 *       d'ordre de grandeur — le multiplicateur réel dépend du fichier
 *       source (peut largement dépasser 10x sur une vidéo 4K non compressée,
 *       moins sur un export déjà optimisé).
 *    b) Miniature + vidéo envoyées EN PARALLÈLE (Promise.all) au lieu de
 *       façon séquentielle — supprime le temps mort d'attente de la
 *       miniature avant que la vidéo ne commence à partir.
 * 2. ★ FIX sélection depuis la pellicule mobile :
 *    a) Compatibilité `mediaTypes` multi-versions expo-image-picker (l'API a
 *       changé entre les SDK — l'ancien enum `MediaTypeOptions.Videos` vs le
 *       nouveau tableau `['videos']`). Utiliser la mauvaise forme fait
 *       parfois apparaître une pellicule vide silencieusement.
 *    b) Détection de l'accès limité iOS (`accessPrivileges: 'limited'`) : si
 *       l'utilisateur n'a partagé que des photos (pas de vidéos) avec
 *       l'app, la pellicule semble vide dans le picker — c'est la cause la
 *       plus fréquente du bug remonté. On propose d'élargir l'accès via
 *       `presentPermissionsPickerAsync()` (ou un message clair sinon).
 * 3. ★ Autocomplétion du synopsis : un bouton "Suggérer" à côté du champ
 *    génère un brouillon de synopsis à partir du titre + genre sélectionné
 *    (+ réalisateur si renseigné), entièrement local (aucun appel réseau),
 *    éditable ensuite comme n'importe quel texte.
 *
 * Miniature :
 *   • Sélection manuelle depuis la galerie (JAMAIS bloquante)
 *   • Tentative auto via expo-video-thumbnails (bonus non-bloquant)
 *   • L'utilisateur peut changer à tout moment
 *
 * Upload :
 *   • XHR avec vraie progression (miniature ∥ vidéo → INSERT DB)
 *   • Tous les champs reels matchent le schéma Supabase exactement
 *   • Triggers DB (tg_notif_reel_submitted, tg_reel_pending) → backoffice
 */

import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Alert, Animated,
  Image, KeyboardAvoidingView, Modal, Platform,
  ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { BlurView }      from 'expo-blur';
import { Ionicons }      from '@expo/vector-icons';
import * as ImagePicker  from 'expo-image-picker';
import * as Haptics      from 'expo-haptics';
import { supabase, SUPABASE_ANON } from '@/lib/supabase';
import { getDeviceId }   from '@/services/api';

// ─── expo-video-thumbnails : bonus non-bloquant ───────────────────────────────
let VideoThumbnails: any = null;
if (Platform.OS !== 'web') {
  try { VideoThumbnails = require('expo-video-thumbnails'); } catch {}
}

// ─── react-native-compressor : bonus non-bloquant — accélère l'upload ───────
// Absent ou en échec → on envoie le fichier original, jamais bloquant.
let VideoCompressor: any = null;
if (Platform.OS !== 'web') {
  try { VideoCompressor = require('react-native-compressor').Video; } catch {}
}

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const BUCKET       = 'community-images';
const SUPABASE_URL = 'https://knrzbdqfflobfjdmqyte.supabase.co';
const BANNER_TTL   = 7_000;
const MAX_DUR_S    = 180;
// Au-delà, l'endpoint d'upload standard Supabase (non-resumable) rejette la
// requête — limite plateforme, pas configurable depuis le frontend. Mieux
// vaut prévenir avant un upload voué à échouer que laisser un 400 muet.
const MAX_FILE_MB  = 90;

// ★ Compat multi-versions expo-image-picker — l'API `mediaTypes` a changé
// entre SDK (ancien enum `MediaTypeOptions.Videos` vs nouveau tableau de
// chaînes `['videos']`). Se tromper de forme peut faire apparaître une
// pellicule vide sans aucune erreur visible — c'est la cause la plus
// probable du bug "impossible de charger une vidéo depuis la pellicule".
const LEGACY_MEDIA_TYPES = !!(ImagePicker as any).MediaTypeOptions;
const VIDEO_MEDIA_TYPES: any = LEGACY_MEDIA_TYPES
  ? (ImagePicker as any).MediaTypeOptions.Videos
  : ['videos'];
const IMAGE_MEDIA_TYPES: any = LEGACY_MEDIA_TYPES
  ? (ImagePicker as any).MediaTypeOptions.Images
  : ['images'];

// ─────────────────────────────────────────────────────────────────────────────
// PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#070C17',
  navy:     'rgba(13,34,64,0.60)',
  navyLow:  'rgba(13,34,64,0.30)',
  navyHi:   'rgba(13,34,64,0.88)',
  border:   'rgba(255,255,255,0.09)',
  borderBr: 'rgba(255,255,255,0.20)',
  white:    '#FFFFFF',
  offWhite: 'rgba(255,255,255,0.82)',
  mid:      'rgba(255,255,255,0.55)',
  muted:    'rgba(255,255,255,0.36)',
  faint:    'rgba(255,255,255,0.10)',
  accent:   '#FFFFFF',
  amber:    '#F59E0B',
  success:  '#22C55E',
  error:    '#EF4444',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// 15 GENRES — valeurs DB identiques à genres.sql
// ─────────────────────────────────────────────────────────────────────────────
const GENRES: { value: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value:'drame_intimiste',        label:'Drame intimiste',             icon:'heart-half-outline'     },
  { value:'documentaire_social',    label:'Documentaire social',         icon:'people-outline'         },
  { value:'court_experimental',     label:'Court-métrage expérimental',  icon:'flask-outline'          },
  { value:'film_auteur',            label:"Film d'auteur",               icon:'eye-outline'            },
  { value:'comedie_independante',   label:'Comédie indépendante',        icon:'happy-outline'          },
  { value:'thriller_psychologique', label:'Thriller psychologique',      icon:'pulse-outline'          },
  { value:'film_noir_contemporain', label:'Film noir contemporain',      icon:'moon-outline'           },
  { value:'cinema_du_reel',         label:'Cinéma du réel',              icon:'camera-outline'         },
  { value:'horreur_atmospherique',  label:'Horreur atmosphérique',       icon:'cloud-offline-outline'  },
  { value:'sf_lo_fi',               label:'Science-fiction lo-fi',       icon:'planet-outline'         },
  { value:'romance_naturaliste',    label:'Romance naturaliste',         icon:'leaf-outline'           },
  { value:'biopic_alternatif',      label:'Biopic alternatif',           icon:'person-outline'         },
  { value:'animation_independante', label:'Animation indépendante',      icon:'sparkles-outline'       },
  { value:'road_movie',             label:'Road movie',                  icon:'car-outline'            },
  { value:'portrait_territoire',    label:'Portrait de territoire',      icon:'map-outline'            },
];

// ─────────────────────────────────────────────────────────────────────────────
// ★ SYNOPSIS — templates d'autocomplétion par genre (100% local, éditable)
// ─────────────────────────────────────────────────────────────────────────────
const SYNOPSIS_TEMPLATES: Record<string, (title: string, director: string) => string> = {
  drame_intimiste: (t, d) => `${t}${d ? `, ${d.trim() === '' ? '' : `de ${d},`}` : ','} suit un personnage confronté à une rupture silencieuse — un deuil, un secret, une absence — et explore avec pudeur ce que le quotidien ne dit jamais tout haut.`,
  documentaire_social: (t) => `${t} pose sa caméra au plus près d'une réalité qu'on préfère ne pas regarder, et donne la parole à celles et ceux que l'on n'écoute jamais assez.`,
  court_experimental: (t) => `${t} déconstruit les codes du récit classique pour proposer une expérience sensorielle avant tout — image, son et rythme s'y répondent hors des sentiers battus.`,
  film_auteur: (t) => `${t} porte un regard singulier et assumé sur le monde, où chaque plan est une prise de position autant qu'une image.`,
  comedie_independante: (t) => `${t} détourne les petites absurdités du quotidien pour en tirer une comédie mordante, portée par des personnages aussi maladroits qu'attachants.`,
  thriller_psychologique: (t) => `${t} installe une tension qui ne repose sur aucun artifice — juste un esprit qui vacille, une vérité qu'on devine trop tard.`,
  film_noir_contemporain: (t) => `${t} plonge dans une nuit urbaine où les apparences mentent et où chaque personnage porte une part d'ombre qu'il finira par payer.`,
  cinema_du_reel: (t) => `${t} capte le réel sans artifice, à hauteur d'humain, pour révéler ce que la vie ordinaire a de profondément cinématographique.`,
  horreur_atmospherique: (t) => `${t} distille une peur lente, faite de silences et de non-dits, où la menace se ressent bien avant de se voir.`,
  sf_lo_fi: (t) => `${t} imagine un futur proche et fauché, où la science-fiction se joue avec des moyens de bord — et n'en est que plus troublante.`,
  romance_naturaliste: (t) => `${t} observe la naissance d'un lien avec une sincérité rare, loin des artifices du genre, au plus près des silences et des gestes qui comptent.`,
  biopic_alternatif: (t) => `${t} retrace un parcours réel en refusant la chronologie sage du biopic classique, pour mieux en révéler les zones d'ombre.`,
  animation_independante: (t) => `${t} donne vie à un univers dessiné à la main (ou presque), porté par une esthétique qui assume pleinement ses choix.`,
  road_movie: (t) => `${t} embarque son personnage sur une route sans retour possible, où chaque kilomètre le rapproche un peu plus de lui-même.`,
  portrait_territoire: (t) => `${t} dresse le portrait sensible d'un lieu et de ceux qui l'habitent, entre attachement et fatalité.`,
};

function suggestSynopsis(title: string, genreValue: string, director: string): string {
  const safeTitle = title.trim() || 'Ce film';
  const tpl = SYNOPSIS_TEMPLATES[genreValue];
  if (tpl) return tpl(safeTitle, director);
  return `${safeTitle} raconte une histoire singulière portée par un regard de cinéaste indépendant, entre intime et universel.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CALENDRIER — helpers (aucune dépendance externe)
// ─────────────────────────────────────────────────────────────────────────────
const MONTHS_FR   = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const WEEKDAYS_FR = ['L','M','M','J','V','S','D'];

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDateFR(d: Date): string {
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()].slice(0,3)}. ${d.getFullYear()}`;
}
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // lundi = colonne 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface VideoAsset {
  uri:       string;
  fileName?: string | null;
  fileSize?: number | null;
  duration?: number | null;   // ms (expo-image-picker)
  mimeType?: string | null;
  // ★ Web uniquement — le File réel, gardé tel quel (déjà un Blob) pour
  // l'upload. Évite tout re-fetch('blob:…') qui peut échouer en silence
  // selon le navigateur (cf. l'erreur FileReader historique de ce flux).
  webBlob?:  Blob | null;
}
interface Form {
  title:        string;
  genre:        string;
  director:     string;
  year:         string; // ISO "YYYY-MM-DD" — sélectionné via calendrier
  synopsis:     string;
  participants: string; // noms séparés par des virgules
}
const EMPTY: Form = { title:'', genre:'', director:'', year:'', synopsis:'', participants:'' };

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS — module-level
// ─────────────────────────────────────────────────────────────────────────────
const fmtSize = (b?: number | null) =>
  !b ? '—' : b < 1e6 ? `${(b/1e3).toFixed(0)} Ko` : `${(b/1e6).toFixed(1)} Mo`;

const fmtDur = (ms?: number | null) => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;
};

// ★ Refuse un fichier trop lourd pour l'endpoint d'upload non-resumable.
function oversizeMsg(bytes?: number | null): string | null {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb > MAX_FILE_MB
    ? `Fichier trop volumineux (${mb.toFixed(0)} Mo). Limite : ${MAX_FILE_MB} Mo.`
    : null;
}

// ★ Fallback MIME par extension — file.type est souvent vide pour .mov côté
// navigateur (aucune entrée native dans la table de types web).
const VIDEO_MIME_BY_EXT: Record<string,string> = {
  mp4:'video/mp4', mov:'video/quicktime', webm:'video/webm',
  mkv:'video/x-matroska', avi:'video/x-msvideo', m4v:'video/x-m4v',
};
const mimeFromExt = (fileName: string) =>
  VIDEO_MIME_BY_EXT[fileName.split('.').pop()?.toLowerCase() ?? ''] ?? 'video/mp4';


// Fallback uniquement pour les URI natives (file://) — jamais utilisé sur web
// quand un Blob a déjà été capturé à la sélection.
async function resolveBlob(uri: string): Promise<Blob> {
  const r = await fetch(uri);
  return r.blob();
}

// ★ Gère l'accès limité à la photothèque iOS (`accessPrivileges: 'limited'`)
// — cause la plus fréquente d'une pellicule qui semble vide côté vidéos :
// l'utilisateur n'a partagé que des photos, pas de vidéos, avec l'app.
async function ensureFullLibraryAccess(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    Alert.alert('Permission requise', "Active l'accès à ta galerie dans les réglages pour importer une vidéo.");
    return false;
  }
  if ((perm as any).accessPrivileges === 'limited') {
    if (typeof (ImagePicker as any).presentPermissionsPickerAsync === 'function') {
      // ★ Laisse l'utilisateur ajouter des vidéos à sa sélection limitée
      // sans quitter l'app.
      await (ImagePicker as any).presentPermissionsPickerAsync();
    } else {
      Alert.alert(
        'Accès limité à la galerie',
        "Seules certaines photos sont partagées avec Universe. Si ta vidéo n'apparaît pas dans la liste, va dans Réglages > Universe > Photos et choisis « Toutes les photos ».",
      );
    }
  }
  return true;
}

async function uploadXHR(
  path: string, blob: Blob, mime: string,
  onProgress: (p: number) => void,
): Promise<void> {
  // ★ ZERO supabase.auth.* — la clé anon (RLS-protégée côté storage, déjà
  // utilisée avec succès par ComposeModal::uploadImage sur ce même bucket
  // community-images) sert de Bearer, jamais un token de session inexistant.
  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON);
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON}`);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total * 100); };

    xhr.onload  = () => {
      if (xhr.status < 300) { res(); return; }
      let detail = xhr.responseText || `HTTP ${xhr.status}`;
      try { detail = JSON.parse(xhr.responseText)?.message ?? detail; } catch {}
      rej(new Error(detail));
    };
    xhr.onerror = () => rej(new Error('Erreur réseau'));
    xhr.send(blob);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMP TEXTE
// ─────────────────────────────────────────────────────────────────────────────
const Field = memo(function Field({
  label, value, onChange, placeholder, multiline, maxLength, keyboardType='default', rightAccessory,
}: {
  label:string; value:string; onChange:(v:string)=>void;
  placeholder?:string; multiline?:boolean; maxLength?:number;
  keyboardType?:'default'|'numeric'|'email-address';
  rightAccessory?: React.ReactNode;
}) {
  return (
    <View style={fi.wrap}>
      <View style={fi.labelRow}>
        <Text style={[fi.label, { marginBottom:0 }]}>{label}</Text>
        {rightAccessory}
      </View>
      <TextInput
        style={[fi.input, multiline && fi.multi]}
        value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={C.muted} multiline={multiline} maxLength={maxLength}
        keyboardType={keyboardType} returnKeyType={multiline?'default':'next'}
        selectionColor={C.accent} numberOfLines={multiline?4:1}
        autoCapitalize={keyboardType==='numeric'?'none':'sentences'}
      />
      {!!maxLength && value.length > maxLength * 0.75 && (
        <Text style={fi.count}>{value.length}/{maxLength}</Text>
      )}
    </View>
  );
});
const fi = StyleSheet.create({
  wrap:  { marginBottom:12 },
  labelRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:6 },
  label: { color:C.muted, fontSize:10, fontWeight:'700', letterSpacing:0.8, textTransform:'uppercase', marginBottom:6 },
  input: { backgroundColor:C.navy, borderRadius:12, paddingHorizontal:14, paddingVertical:12, color:C.white, fontSize:14, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  multi: { height:90, textAlignVertical:'top', paddingTop:12 },
  count: { color:C.muted, fontSize:9, textAlign:'right', marginTop:2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ Bouton "Suggérer" — autocomplétion du synopsis
// ─────────────────────────────────────────────────────────────────────────────
const syn = StyleSheet.create({
  btn:   { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:9, paddingVertical:4, borderRadius:9, backgroundColor:'rgba(167,139,250,0.14)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.32)' },
  btnOff:{ opacity:0.35 },
  btnTxt:{ color:'#C4B5FD', fontSize:10.5, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// GENRE DROPDOWN — ★ overlay Modal, hauteur fixe, scroll interne
// Ne pousse plus jamais le reste du formulaire : la liste s'affiche dans un
// Modal transparent positionné juste sous le champ, avec un scroll propre.
// ─────────────────────────────────────────────────────────────────────────────
const GenreDropdown = memo(function GenreDropdown({
  value, onSelect,
}: { value:string; onSelect:(v:string)=>void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x:number; y:number; width:number; height:number } | null>(null);
  const triggerRef = useRef<View>(null);

  const openList = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const select = useCallback((v: string) => {
    onSelect(v);
    setOpen(false);
  }, [onSelect]);

  const sel = GENRES.find(g => g.value === value);

  return (
    <View style={gd.wrap}>
      <Text style={fi.label}>GENRE</Text>

      <View ref={triggerRef} collapsable={false}>
        <TouchableOpacity style={gd.trigger} onPress={openList} activeOpacity={0.80}>
          <View style={gd.left}>
            {sel && <Ionicons name={sel.icon} size={15} color={C.accent} style={{marginRight:9}}/>}
            <Text style={[gd.trigTxt, !value && {color:C.muted}]} numberOfLines={1}>
              {sel?.label ?? 'Sélectionne un genre…'}
            </Text>
          </View>
          <Ionicons name={open?'chevron-up':'chevron-down'} size={14} color={C.muted}/>
        </TouchableOpacity>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
        {anchor && (
          <View style={[gd.floatWrap, { top: anchor.y + anchor.height + 4, left: anchor.x, width: anchor.width }]}>
            <View style={gd.list}>
              <ScrollView style={gd.scroll} showsVerticalScrollIndicator nestedScrollEnabled>
                {GENRES.map((g, i) => {
                  const on = value === g.value;
                  return (
                    <TouchableOpacity
                      key={g.value}
                      style={[gd.item, on && gd.itemOn, i < GENRES.length-1 && gd.itemBorder]}
                      onPress={() => select(g.value)} activeOpacity={0.75}
                    >
                      <Ionicons name={g.icon} size={15} color={on?C.accent:C.muted} style={{marginRight:12}}/>
                      <Text style={[gd.itemTxt, on && gd.itemTxtOn]}>{g.label}</Text>
                      {on && <Ionicons name="checkmark-circle" size={15} color={C.accent} style={{marginLeft:'auto'}}/>}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}
      </Modal>
    </View>
  );
});
const gd = StyleSheet.create({
  wrap:      { marginBottom:12 },
  trigger:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:C.navy, borderRadius:12, paddingHorizontal:14, paddingVertical:13, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  left:      { flexDirection:'row', alignItems:'center', flex:1 },
  trigTxt:   { color:C.white, fontSize:14, flexShrink:1 },
  floatWrap: { position:'absolute' },
  list:      { backgroundColor:C.navyHi, borderRadius:12, borderWidth:StyleSheet.hairlineWidth, borderColor:C.borderBr, overflow:'hidden', elevation:12, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.35, shadowRadius:14 },
  scroll:    { maxHeight:260 },
  item:      { flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:13 },
  itemOn:    { backgroundColor:'rgba(167,139,250,0.12)' },
  itemBorder:{ borderBottomWidth:StyleSheet.hairlineWidth, borderBottomColor:C.border },
  itemTxt:   { color:C.mid, fontSize:13, fontWeight:'500', flex:1 },
  itemTxtOn: { color:C.white, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ SÉLECTEUR DE DATE — calendrier mensuel maison (remplace le champ Année)
// ─────────────────────────────────────────────────────────────────────────────
const DateField = memo(function DateField({
  value, onChange,
}: { value: string; onChange: (iso: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => (value ? new Date(`${value}T00:00:00`) : null), [value]);
  const [viewDate, setViewDate] = useState<Date>(parsed ?? new Date());

  const openCal = useCallback(() => {
    setViewDate(parsed ?? new Date());
    setOpen(true);
  }, [parsed]);

  const selectDay = useCallback((d: Date) => {
    onChange(isoDate(d));
    setOpen(false);
  }, [onChange]);

  const prevMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1)), []);
  const nextMonth = useCallback(() => setViewDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1)), []);

  const grid  = useMemo(() => buildMonthGrid(viewDate.getFullYear(), viewDate.getMonth()), [viewDate]);
  const today = useMemo(() => new Date(), []);
  const todayIso = isoDate(today);
  const selectedIso = parsed ? isoDate(parsed) : null;

  return (
    <View>
      <Text style={fi.label}>DATE DE SORTIE</Text>
      <TouchableOpacity style={gd.trigger} onPress={openCal} activeOpacity={0.80}>
        <View style={gd.left}>
          <Ionicons name="calendar-outline" size={15} color={C.accent} style={{marginRight:9}}/>
          <Text style={[gd.trigTxt, !value && {color:C.muted}]} numberOfLines={1}>
            {parsed ? fmtDateFR(parsed) : 'Sélectionner une date'}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={14} color={C.muted}/>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={cal.overlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={cal.card}>
            <View style={cal.header}>
              <TouchableOpacity onPress={prevMonth} hitSlop={10} style={cal.navBtn}>
                <Ionicons name="chevron-back" size={17} color={C.white}/>
              </TouchableOpacity>
              <Text style={cal.headerTxt}>{MONTHS_FR[viewDate.getMonth()]} {viewDate.getFullYear()}</Text>
              <TouchableOpacity onPress={nextMonth} hitSlop={10} style={cal.navBtn}>
                <Ionicons name="chevron-forward" size={17} color={C.white}/>
              </TouchableOpacity>
            </View>

            <View style={cal.weekRow}>
              {WEEKDAYS_FR.map((w, i) => <Text key={i} style={cal.weekTxt}>{w}</Text>)}
            </View>

            <View style={cal.grid}>
              {grid.map((d, i) => {
                if (!d) return <View key={i} style={cal.cell} />;
                const dIso = isoDate(d);
                const isSelected = dIso === selectedIso;
                const isToday = dIso === todayIso;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[cal.cell, cal.day, isSelected && cal.daySelected, isToday && !isSelected && cal.dayToday]}
                    onPress={() => selectDay(d)} activeOpacity={0.75}
                  >
                    <Text style={[cal.dayTxt, isSelected && cal.dayTxtSelected]}>{d.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={cal.todayBtn} onPress={() => selectDay(new Date())} activeOpacity={0.82}>
              <Ionicons name="today-outline" size={13} color={C.accent} />
              <Text style={cal.todayTxt}>Aujourd'hui</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
});
const cal = StyleSheet.create({
  overlay:    { flex:1, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(3,5,12,0.72)', padding:24 },
  card:       { width:'100%', maxWidth:340, backgroundColor:C.navyHi, borderRadius:18, padding:16, borderWidth:1, borderColor:C.borderBr },
  header:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  navBtn:     { width:30, height:30, borderRadius:15, alignItems:'center', justifyContent:'center', backgroundColor:C.navy, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  headerTxt:  { color:C.white, fontSize:14, fontWeight:'800' },
  weekRow:    { flexDirection:'row', marginBottom:4 },
  weekTxt:    { flex:1, textAlign:'center', color:C.muted, fontSize:10, fontWeight:'700' },
  grid:       { flexDirection:'row', flexWrap:'wrap' },
  cell:       { width:`${100/7}%`, aspectRatio:1, alignItems:'center', justifyContent:'center', padding:2 },
  day:        { borderRadius:999 },
  daySelected:{ backgroundColor:C.accent },
  dayToday:   { borderWidth:1, borderColor:C.accent },
  dayTxt:     { color:C.offWhite, fontSize:13, fontWeight:'600' },
  dayTxtSelected:{ color:C.bg, fontWeight:'900' },
  todayBtn:   { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:6, marginTop:12, paddingVertical:10, borderRadius:12, backgroundColor:'rgba(167,139,250,0.12)', borderWidth:StyleSheet.hairlineWidth, borderColor:'rgba(167,139,250,0.30)' },
  todayTxt:   { color:C.accent, fontSize:12.5, fontWeight:'700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★ SECTION MINIATURE — sélection galerie (toujours opérationnelle)
// ─────────────────────────────────────────────────────────────────────────────
interface ThumbSectionProps {
  thumbUri:      string | null;
  autoLoading:   boolean;
  onPickGallery: () => void;
}
const ThumbSection = memo(function ThumbSection({
  thumbUri, autoLoading, onPickGallery,
}: ThumbSectionProps) {
  return (
    <View style={th.wrap}>
      {/* En-tête */}
      <View style={th.header}>
        <Text style={fi.label}>MINIATURE</Text>
        {thumbUri && (
          <TouchableOpacity style={th.changeBtn} onPress={onPickGallery} activeOpacity={0.78}>
            <Ionicons name="image-outline" size={12} color={C.muted}/>
            <Text style={th.changeTxt}>Changer</Text>
          </TouchableOpacity>
        )}
      </View>

      {autoLoading && !thumbUri ? (
        /* Génération auto en cours */
        <View style={th.loading}>
          <ActivityIndicator size="small" color={C.accent}/>
          <Text style={th.loadingTxt}>Génération automatique…</Text>
        </View>
      ) : thumbUri ? (
        /* Aperçu miniature */
        <View style={th.preview}>
          <Image source={{ uri:thumbUri }} style={th.img} resizeMode="cover"/>
          <View style={th.badge}>
            <Ionicons name="checkmark-circle" size={14} color={C.success}/>
            <Text style={th.badgeTxt}>Miniature prête</Text>
          </View>
        </View>
      ) : (
        /* Bouton de sélection */
        <TouchableOpacity style={th.pick} onPress={onPickGallery} activeOpacity={0.80}>
          <View style={th.pickIcon}>
            <Ionicons name="image-outline" size={28} color={C.accent}/>
          </View>
          <Text style={th.pickTitle}>Choisir une miniature</Text>
          <Text style={th.pickSub}>Sélectionne une image depuis ta galerie</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});
const th = StyleSheet.create({
  wrap:      { marginBottom:16 },
  header:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 },
  changeBtn: { flexDirection:'row', alignItems:'center', gap:5, paddingHorizontal:10, paddingVertical:5, borderRadius:10, backgroundColor:C.navy, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  changeTxt: { color:C.muted, fontSize:11 },
  loading:   { flexDirection:'row', alignItems:'center', gap:10, padding:16, borderRadius:14, backgroundColor:C.navyLow, borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  loadingTxt:{ color:C.muted, fontSize:12 },
  preview:   { borderRadius:14, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  img:       { width:'100%', height:180, resizeMode:'cover' },
  badge:     { position:'absolute', bottom:10, left:10, flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'rgba(7,12,23,0.82)', paddingHorizontal:10, paddingVertical:5, borderRadius:10 },
  badgeTxt:  { color:C.success, fontSize:11, fontWeight:'700' },
  pick:      { alignItems:'center', gap:8, padding:24, borderRadius:14, backgroundColor:C.navyLow, borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed' },
  pickIcon:  { width:56, height:56, borderRadius:14, backgroundColor:C.navy, alignItems:'center', justifyContent:'center', borderWidth:StyleSheet.hairlineWidth, borderColor:C.border },
  pickTitle: { color:C.offWhite, fontSize:14, fontWeight:'700' },
  pickSub:   { color:C.muted, fontSize:11 },
});

// ─────────────────────────────────────────────────────────────────────────────
// BARRE PROGRESSION
// ─────────────────────────────────────────────────────────────────────────────
const ProgressBar = memo(function ProgressBar({
  anim, label,
}: { anim: Animated.Value; label: string }) {
  const width = anim.interpolate({ inputRange:[0,100], outputRange:['0%','100%'] });
  return (
    <View style={pb.wrap}>
      <View style={pb.track}>
        <Animated.View style={[pb.fill, {width}]}/>
      </View>
      <Text style={pb.label}>{label}</Text>
    </View>
  );
});
const pb = StyleSheet.create({
  wrap:  { gap:6, marginBottom:14 },
  track: { height:4, borderRadius:2, backgroundColor:C.navy, overflow:'hidden' },
  fill:  { height:'100%', borderRadius:2, backgroundColor:C.accent },
  label: { color:C.muted, fontSize:11, textAlign:'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
// ★★★ VIDEO TAB ★★★
// ─────────────────────────────────────────────────────────────────────────────
const VideoTab = memo(function VideoTab() {

  // ── State ─────────────────────────────────────────────────────────────────
  const [video,       setVideo]       = useState<VideoAsset | null>(null);
  const [thumbUri,    setThumbUri]    = useState<string | null>(null);
  const [thumbBlob,   setThumbBlob]   = useState<Blob | null>(null); // web uniquement
  const [autoLoading, setAutoLoading] = useState(false);
  const [form,        setForm]        = useState<Form>(EMPTY);
  const [uploading,   setUploading]   = useState(false);
  const [phase,       setPhase]       = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false); // ★ message inline (ex-Banner)

  // ── Refs ──────────────────────────────────────────────────────────────────
  const progAnim    = useRef(new Animated.Value(0)).current;
  const scrollRef   = useRef<ScrollView>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(successTimer.current), []);

  // ── Animation progression ─────────────────────────────────────────────────
  const animProg = useCallback((val: number) => {
    Animated.timing(progAnim, { toValue:val, duration:200, useNativeDriver:false }).start();
  }, [progAnim]);

  // ── Form setters ──────────────────────────────────────────────────────────
  const setTitle        = useCallback((v:string) => setForm(p=>({...p,title:v})),        []);
  const setGenre        = useCallback((v:string) => setForm(p=>({...p,genre:v})),        []);
  const setDirector     = useCallback((v:string) => setForm(p=>({...p,director:v})),     []);
  const setYear         = useCallback((v:string) => setForm(p=>({...p,year:v})),         []);
  const setSynopsis     = useCallback((v:string) => setForm(p=>({...p,synopsis:v})),     []);
  const setParticipants = useCallback((v:string) => setForm(p=>({...p,participants:v})), []);

  // ── ★ Autocomplétion synopsis — 100% locale, à partir de titre + genre ────
  const handleSuggestSynopsis = useCallback(() => {
    if (!form.title.trim()) return;
    const suggestion = suggestSynopsis(form.title, form.genre, form.director);
    if (form.synopsis.trim().length > 0) {
      Alert.alert(
        'Remplacer le synopsis ?',
        'Un synopsis est déjà rédigé. Le remplacer par la suggestion ?',
        [
          { text:'Annuler', style:'cancel' },
          { text:'Remplacer', onPress: () => setSynopsis(suggestion) },
        ],
      );
    } else {
      setSynopsis(suggestion);
    }
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  }, [form.title, form.genre, form.director, form.synopsis, setSynopsis]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setVideo(null); setThumbUri(null); setThumbBlob(null); setForm(EMPTY);
    setError(null); setPhase(''); progAnim.setValue(0);
    scrollRef.current?.scrollTo({ y:0, animated:true });
  }, [progAnim]);

  // ── Confirmation de soumission — ★ inline uniquement, plus de notification
  const triggerSuccessMsg = useCallback(() => {
    clearTimeout(successTimer.current);
    setShowSuccess(true);
    successTimer.current = setTimeout(() => setShowSuccess(false), BANNER_TTL);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ GÉNÉRATION AUTO — non-bloquante, bonus uniquement
  // ─────────────────────────────────────────────────────────────────────────
  const tryAutoThumb = useCallback(async (uri: string, durationMs?: number | null) => {
    if (!VideoThumbnails) return; // web ou module absent → skip silencieusement
    setAutoLoading(true);
    try {
      const seekMs = Math.min(1500, Math.round((durationMs ?? 3000) * 0.1));
      const { uri: tUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: seekMs, quality: 0.85,
      });
      setThumbUri(tUri);
    } catch {
      // Échec silencieux → l'utilisateur choisira manuellement
    } finally {
      setAutoLoading(false);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ SÉLECTION MINIATURE DEPUIS LA GALERIE (toujours opérationnelle, IMAGES)
  // ─────────────────────────────────────────────────────────────────────────
  const pickThumbnail = useCallback(async () => {
    // ★ FIX FileReader — expo-image-picker passe par FileReader.readAsDataURL()
    // sur web, qui échoue de façon imprévisible sur certains fichiers (HEIC,
    // photos iCloud non téléchargées localement…) avec "Failed to read the
    // selected media". Même bypass que app/(tabs)/edit.tsx::handlePickAvatar —
    // <input type="file"> + URL.createObjectURL(), jamais de FileReader.
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file'; input.accept = 'image/*';
      // Appended to DOM before click — required on iOS Safari mobile (programmatic
      // click on a detached input element is blocked by the browser security policy)
      input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if (document.body.contains(input)) document.body.removeChild(input);
        const file = e.target.files?.[0]; if (!file) return;
        setThumbUri(URL.createObjectURL(file));
        setThumbBlob(file);
      };
      input.click();
      return;
    }
    const ok = await ensureFullLibraryAccess();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:    IMAGE_MEDIA_TYPES,
      allowsEditing: true,
      aspect:        [16, 9],
      quality:       0.90,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setThumbUri(result.assets[0].uri);
    setThumbBlob(null); // natif — pas de Blob web, submit() refera un fetch(file://…)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ SÉLECTION VIDÉO — GALERIE (pellicule) UNIQUEMENT, uniquement des vidéos
  // ─────────────────────────────────────────────────────────────────────────
  const pickGallery = useCallback(async () => {
    // ★ FIX FileReader — même bypass que pickThumbnail/edit.tsx : ImagePicker
    // sur web lit le fichier via FileReader.readAsDataURL(), qui échoue
    // ("Failed to read the selected media") sur des vidéos volumineuses ou
    // certains formats. Un <input type="file"> + URL.createObjectURL() lit
    // le fichier directement, sans jamais passer par FileReader.
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      // Explicit MIME types improve mobile browser compatibility over bare 'video/*'
      input.accept = 'video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*';
      input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if (document.body.contains(input)) document.body.removeChild(input);
        const file = e.target.files?.[0]; if (!file) return;
        const uri = URL.createObjectURL(file);
        const fileName = file.name || 'video.mp4';
        const asset: VideoAsset = {
          uri,
          fileName,
          fileSize: file.size,
          duration: null,
          mimeType: file.type || mimeFromExt(fileName),
          webBlob: file,
        };
        setVideo(asset); setError(null);
        tryAutoThumb(uri, null);
        setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
      };
      input.click();
      return;
    }
    // ★ Fix pellicule vide : accès complet vérifié + forme de mediaTypes
    // compatible avec la version installée d'expo-image-picker.
    const ok = await ensureFullLibraryAccess();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes:       VIDEO_MEDIA_TYPES, // ★ uniquement vidéos, jamais d'image
      videoMaxDuration: MAX_DUR_S,
      quality:          1,
      selectionLimit:   1,
      allowsEditing:    false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const a = result.assets[0];
    const sizeErr = oversizeMsg(a.fileSize);
    if (sizeErr) { setError(sizeErr); return; }
    const asset: VideoAsset = {
      uri:      a.uri,
      fileName: a.fileName ?? a.uri.split('/').pop() ?? 'video.mp4',
      fileSize: a.fileSize,
      duration: a.duration,
      mimeType: a.mimeType ?? 'video/mp4',
    };
    setVideo(asset); setError(null);
    // Tente la génération auto en arrière-plan (non-bloquant)
    tryAutoThumb(a.uri, a.duration);
    setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
  }, [tryAutoThumb]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ CAMÉRA — allume réellement la caméra et enregistre une vidéo
  // (natif : expo-image-picker camera ; web mobile : capture="environment"
  // déclenche l'appli caméra native du téléphone, pas la galerie)
  // ─────────────────────────────────────────────────────────────────────────
  const pickCamera = useCallback(async () => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/mp4,video/quicktime,video/x-msvideo,video/webm,video/*';
      (input as any).capture = 'environment';
      input.style.cssText = 'position:fixed;top:-100px;left:-100px;width:0;height:0;opacity:0;';
      document.body.appendChild(input);
      input.onchange = (e: any) => {
        if (document.body.contains(input)) document.body.removeChild(input);
        const file = e.target.files?.[0]; if (!file) return;
        const uri = URL.createObjectURL(file);
        const fileName = file.name || `record_${Date.now()}.mp4`;
        const asset: VideoAsset = {
          uri,
          fileName,
          fileSize: file.size,
          duration: null,
          mimeType: file.type || mimeFromExt(fileName),
          webBlob: file,
        };
        setVideo(asset); setError(null);
        tryAutoThumb(uri, null);
        setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Caméra inaccessible', 'Active la permission Caméra dans les réglages.'); return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes:       VIDEO_MEDIA_TYPES,
        videoMaxDuration: MAX_DUR_S,
        videoQuality:     1,
        allowsEditing:    false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      const sizeErr = oversizeMsg(a.fileSize);
      if (sizeErr) { setError(sizeErr); return; }
      const asset: VideoAsset = {
        uri:      a.uri,
        fileName: a.fileName ?? `record_${Date.now()}.mp4`,
        fileSize: a.fileSize,
        duration: a.duration,
        mimeType: a.mimeType ?? 'video/mp4',
      };
      setVideo(asset); setError(null);
      tryAutoThumb(a.uri, a.duration);
      setTimeout(() => scrollRef.current?.scrollTo({ y:280, animated:true }), 350);
    } catch (e: any) {
      if (e?.message?.includes('simulat') || e?.message?.includes('unavailable')) {
        Alert.alert('Caméra indisponible', 'La caméra n\'est pas disponible sur cet appareil.');
      } else {
        Alert.alert('Erreur', e?.message ?? 'Impossible d\'ouvrir la caméra.');
      }
    }
  }, [tryAutoThumb]);

  // ─────────────────────────────────────────────────────────────────────────
  // ★ UPLOAD COMPLET — compression + miniature ∥ vidéo (parallèle) + INSERT DB
  // Tous les champs correspondent au schéma public.reels exactement.
  // Les triggers tg_notif_reel_submitted + tg_reel_pending notifient le backoffice.
  // ─────────────────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    // Validation
    if (!video)              { setError('Sélectionne une vidéo.');      return; }
    if (!thumbUri)           { setError('Ajoute une miniature.');       return; }
    if (!form.title.trim())  { setError('Le titre est obligatoire.');   return; }
    if (!form.genre)         { setError('Sélectionne un genre.');       return; }

    setUploading(true); setError(null); animProg(2);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(()=>{});

    try {
      // ★ ZERO supabase.auth.* — identité via getDeviceId(), comme partout
      // ailleurs dans l'app (CritiqueTab, profile, edit…). L'import vidéo ne
      // doit jamais exiger une connexion.
      const userId = await getDeviceId();

      const ts       = Date.now();
      const ext      = (video.fileName ?? 'video.mp4').split('.').pop() ?? 'mp4';
      // ★ Préfixe "posts/" — c'est le seul préfixe de community-images confirmé
      // accepter des écritures anonymes (ComposeModal::uploadImage l'utilise
      // avec succès, zéro session). "reels/" exigeait jusqu'ici une vraie
      // session (supabase.auth.getUser()) — la policy storage associée n'a
      // probablement jamais été ouverte à l'anon, d'où le 400 systématique
      // une fois l'auth retirée côté frontend.
      const vidPath  = `posts/${userId}_reel_${ts}.${ext}`;
      const thPath   = `posts/${userId}_reel_${ts}_thumb.jpg`;

      // ── A. Compression vidéo (natif uniquement) — ★ le vrai levier de
      // vitesse : réduire la taille du fichier réduit d'autant le temps
      // d'upload. Échec ou absence du module → fichier original, jamais
      // bloquant.
      setPhase('Optimisation de la vidéo…');
      let vidUri = video.uri;
      if (Platform.OS !== 'web' && VideoCompressor) {
        try {
          const compressedUri = await VideoCompressor.compress(
            video.uri,
            {
              compressionMethod: 'manual',
              maxSize: 1920,
              bitrate: 6_000_000,
              quality: 0.9,
              minimumFileSizeForCompress: 10 * 1024 * 1024,
            },
            (progress: number) => animProg(2 + Math.min(progress, 1) * 6), // 2 → 8 %
          );
          if (compressedUri) vidUri = compressedUri;
        } catch {
          // Compression indisponible/échouée → on continue avec l'original
        }
      }
      animProg(8);

      // ── B. Résolution des Blobs (miniature + vidéo) ─────────────────────
      // ★ Préfère le Blob déjà en main (web) — un fetch('blob:…') peut être
      // lu en interne via FileReader selon le runtime et échouer en silence.
      setPhase('Préparation…');
      const [thBlob, vidBlob] = await Promise.all([
        thumbBlob ? Promise.resolve(thumbBlob) : resolveBlob(thumbUri),
        video.webBlob ? Promise.resolve(video.webBlob) : resolveBlob(vidUri),
      ]);
      animProg(12);

      // ── C. Upload miniature ∥ vidéo EN PARALLÈLE — ★ supprime le temps
      // mort d'attente séquentielle : les deux transferts partagent la même
      // fenêtre de temps au lieu de s'additionner.
      setPhase('Envoi en cours…');
      let thPct = 0, vidPct = 0;
      const pushProgress = () => animProg(12 + thPct * 0.08 + vidPct * 0.80);

      await Promise.all([
        uploadXHR(thPath, thBlob, thBlob.type || 'image/jpeg', p => { thPct = p; pushProgress(); }),
        uploadXHR(vidPath, vidBlob, video.mimeType || mimeFromExt(vidPath), p => { vidPct = p; pushProgress(); }),
      ]);

      animProg(93);
      setPhase('Enregistrement…');

      const { data:thUrl }  = supabase.storage.from(BUCKET).getPublicUrl(thPath);
      const { data:vidUrl } = supabase.storage.from(BUCKET).getPublicUrl(vidPath);
      if (!thUrl?.publicUrl)  throw new Error('URL miniature introuvable — vérifie que le bucket est public.');
      if (!vidUrl?.publicUrl) throw new Error('URL vidéo introuvable — vérifie que le bucket est public.');

      // ── D. INSERT reels (schéma exact) ─────────────────────────────────
      // Les triggers tg_notif_reel_submitted et tg_reel_pending se déclenchent
      // automatiquement et notifient le backoffice universe-admin.
      const { error:insErr } = await supabase.from('reels').insert({
        user_id:       userId,
        video_url:     vidUrl.publicUrl,
        thumbnail_url: thUrl.publicUrl,
        title:         form.title.trim()        || null,
        genre:         form.genre               || null,
        director:      form.director.trim()     || null,
        year:          form.year.trim()         || null,
        synopsis:      form.synopsis.trim()     || null,
        participants:  form.participants.trim() || null,
        duration:      video.duration ? Math.round(video.duration / 1000) : null,
        likes_count:   0,
        views_count:   0,
        // status:     'pending'  ← valeur DEFAULT SQL, inutile de l'envoyer
        // rejection_category, rejection_reason, moderated_by, moderated_at
        //             ← null par défaut, remplis par le backoffice lors de la modération
      });
      if (insErr) throw new Error(insErr.message);

      // ── E. Succès — ★ confirmation inline uniquement (plus de notification)
      animProg(100);
      setPhase('');
      triggerSuccessMsg();
      setTimeout(reset, 1_800);

    } catch (e: any) {
      setError(e?.message ?? 'Une erreur est survenue. Réessaie.');
      animProg(0); setPhase('');
    } finally {
      setUploading(false);
    }
  }, [video, thumbUri, thumbBlob, form, animProg, triggerSuccessMsg, reset]);

  // ── Booleans dérivés ──────────────────────────────────────────────────────
  const canSubmit = useMemo(
    () => !!video && !!thumbUri && !uploading,
    [video, thumbUri, uploading],
  );

  const progressLabel = useMemo(() => {
    if (phase) return phase;
    const v = Math.round((progAnim as any)._value ?? 0);
    return v > 0 && v < 100 ? `${v}%` : '';
  }, [phase, progAnim]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex:1 }}>
      <KeyboardAvoidingView style={{ flex:1 }}
        behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={140}>
        <ScrollView ref={scrollRef}
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ────── ÉTAPE 1 : SÉLECTION VIDÉO (galerie = vidéos uniquement) ── */}
          {!video ? (
            <View style={s.dropZone}>
              <View style={s.dropIconWrap}>
                <Ionicons name="cloud-upload-outline" size={36} color={C.white}/>
              </View>
              <Text style={s.dropTitle}>Importe ta vidéo</Text>
              <Text style={s.dropSub}>MP4 · MOV · MKV — {MAX_DUR_S/60} min maximum</Text>
              <View style={s.dropBtns}>
                <TouchableOpacity style={s.btnPrimary} onPress={pickGallery} activeOpacity={0.82}>
                  <Ionicons name="images-outline" size={16} color={C.white}/>
                  <Text style={s.btnPrimaryTxt}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnSecondary} onPress={pickCamera} activeOpacity={0.82}>
                  <Ionicons name="camera-outline" size={16} color={C.offWhite}/>
                  <Text style={s.btnSecondaryTxt}>Caméra</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.dropHint}>
                Chaque vidéo est vérifiée par l'équipe Universe avant publication.
              </Text>
            </View>

          ) : (
            <>
              {/* ── Aperçu vidéo sélectionnée ─────────────────────────── */}
              <View style={s.videoPreview}>
                <BlurView intensity={16} tint="dark" style={s.videoBlur}>
                  <View style={s.videoIcon}>
                    <Ionicons name="videocam" size={22} color={C.white}/>
                  </View>
                  <View style={{flex:1,gap:3}}>
                    <Text style={s.videoName} numberOfLines={1}>{video.fileName ?? 'vidéo'}</Text>
                    <View style={{flexDirection:'row',gap:14}}>
                      <Text style={s.videoMeta}>{fmtDur(video.duration)}</Text>
                      <Text style={s.videoMeta}>{fmtSize(video.fileSize)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={reset} hitSlop={12}>
                    <Ionicons name="close-circle" size={22} color={C.muted}/>
                  </TouchableOpacity>
                </BlurView>
              </View>

              {/* ── ★ MINIATURE ──────────────────────────────────────── */}
              <ThumbSection
                thumbUri={thumbUri}
                autoLoading={autoLoading}
                onPickGallery={pickThumbnail}
              />
            </>
          )}

          {/* ────── ÉTAPE 2 : FORMULAIRE ────────────────────────────── */}
          <View style={s.form}>
            <Text style={s.formTitle}>Informations</Text>

            <Field label="TITRE *" value={form.title} onChange={setTitle}
              placeholder="Titre de ta vidéo" maxLength={120}/>

            <GenreDropdown value={form.genre} onSelect={setGenre}/>

            <View style={{flexDirection:'row',gap:10}}>
              <View style={{flex:1}}>
                <Field label="RÉALISATEUR" value={form.director} onChange={setDirector} placeholder="Nom"/>
              </View>
              <View style={{width:150}}>
                <DateField value={form.year} onChange={setYear}/>
              </View>
            </View>

            <Field
              label="PARTICIPANTS" value={form.participants} onChange={setParticipants}
              placeholder="Alice, Bob, Charlie…" maxLength={200}/>

            <Field
              label="SYNOPSIS" value={form.synopsis} onChange={setSynopsis}
              placeholder="Décris ta vidéo…" multiline maxLength={400}
              rightAccessory={
                <TouchableOpacity
                  onPress={handleSuggestSynopsis}
                  disabled={!form.title.trim()}
                  activeOpacity={0.80}
                  style={[syn.btn, !form.title.trim() && syn.btnOff]}
                >
                  <Ionicons name="sparkles-outline" size={11} color="#C4B5FD"/>
                  <Text style={syn.btnTxt}>Suggérer</Text>
                </TouchableOpacity>
              }
            />
          </View>

          {/* ────── PROGRESSION ─────────────────────────────────────── */}
          {uploading && <ProgressBar anim={progAnim} label={progressLabel}/>}

          {/* ────── ERREUR ───────────────────────────────────────────── */}
          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="warning-outline" size={15} color={C.error}/>
              <Text style={s.errorTxt}>{error}</Text>
            </View>
          )}

          {/* ────── INFO MODÉRATION (avant soumission) ──────────────── */}
          {!!video && !uploading && !error && !showSuccess && (
            <View style={s.infoBox}>
              <Ionicons name="shield-checkmark-outline" size={14} color={C.amber}/>
              <Text style={s.infoTxt}>
                Ta vidéo sera transmise à l'équipe Universe (backoffice) dès soumission.
                Tu seras notifié de la décision de modération.
              </Text>
            </View>
          )}

          {/* ────── ★ CONFIRMATION — inline, juste au-dessus du bouton ── */}
          {showSuccess && (
            <View style={s.successBox}>
              <Ionicons name="checkmark-circle" size={16} color={C.success}/>
              <View style={{flex:1}}>
                <Text style={s.successTitle}>Vidéo envoyée au backoffice</Text>
                <Text style={s.successBody}>Tu seras notifié dès qu'elle sera approuvée et visible dans les Reels.</Text>
              </View>
            </View>
          )}

          {/* ────── BOUTON SOUMETTRE ─────────────────────────────────── */}
          <TouchableOpacity
            style={[s.submitBtn, !canSubmit && s.submitOff]}
            onPress={submit} activeOpacity={0.84} disabled={!canSubmit}>
            {uploading
              ? <ActivityIndicator color={C.white} size="small"/>
              : <Ionicons name="cloud-upload" size={17} color={C.white}/>}
            <Text style={s.submitTxt}>
              {uploading ? phase || 'Upload en cours…' : 'Soumettre la vidéo'}
            </Text>
          </TouchableOpacity>


          <View style={{height:80}}/>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
});

export default VideoTab;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scroll:        { paddingHorizontal:16, paddingTop:4 },

  // Drop zone
  dropZone:      { alignItems:'center', borderRadius:20, padding:32, marginBottom:20, gap:10, borderWidth:1, borderColor:C.borderBr, borderStyle:'dashed', backgroundColor:C.navyLow },
  dropIconWrap:  { width:70, height:70, borderRadius:35, backgroundColor:C.navy, alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:C.borderBr, marginBottom:4 },
  dropTitle:     { color:C.white, fontSize:18, fontWeight:'800' },
  dropSub:       { color:C.muted, fontSize:12 },
  dropBtns:      { flexDirection:'row', gap:12, marginTop:8 },
  btnPrimary:    { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navy, paddingHorizontal:24, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnPrimaryTxt: { color:C.white, fontSize:14, fontWeight:'800' },
  btnSecondary:  { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:C.navy, paddingHorizontal:22, paddingVertical:12, borderRadius:24, borderWidth:1, borderColor:C.borderBr },
  btnSecondaryTxt:{ color:C.offWhite, fontSize:14, fontWeight:'700' },
  dropHint:      { color:C.muted, fontSize:10, textAlign:'center', lineHeight:15, paddingHorizontal:20, marginTop:4 },

  // Video preview
  videoPreview:  { marginBottom:14 },
  videoBlur:     { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:16, overflow:'hidden', borderWidth:1, borderColor:C.borderBr },
  videoIcon:     { width:48, height:48, borderRadius:12, backgroundColor:C.navy, alignItems:'center', justifyContent:'center' },
  videoName:     { color:C.white, fontSize:13, fontWeight:'700' },
  videoMeta:     { color:C.muted, fontSize:11 },

  // Form
  form:          { marginBottom:16 },
  formTitle:     { color:C.offWhite, fontSize:13, fontWeight:'700', letterSpacing:0.4, marginBottom:14 },

  // Error
  errorBox:      { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'rgba(239,68,68,0.12)', borderRadius:12, padding:12, marginBottom:12, borderWidth:1, borderColor:'rgba(239,68,68,0.25)' },
  errorTxt:      { flex:1, color:'#FCA5A5', fontSize:12 },

  // Info (pré-soumission)
  infoBox:       { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'rgba(245,158,11,0.08)', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'rgba(245,158,11,0.20)' },
  infoTxt:       { flex:1, color:C.muted, fontSize:11, lineHeight:16 },

  // ★ Confirmation inline (post-soumission) — remplace l'ancienne notification
  successBox:    { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'rgba(34,197,94,0.10)', borderRadius:12, padding:12, marginBottom:14, borderWidth:1, borderColor:'rgba(34,197,94,0.28)' },
  successTitle:  { color:C.white, fontSize:12.5, fontWeight:'800', marginBottom:2 },
  successBody:   { color:C.muted, fontSize:11, lineHeight:16 },

  // Submit
  submitBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:C.navy, borderRadius:16, paddingVertical:15, marginBottom:8, borderWidth:1, borderColor:C.borderBr },
  submitOff:     { opacity:0.38 },
  submitTxt:     { color:C.white, fontSize:15, fontWeight:'800' },
  hint:          { color:C.muted, fontSize:11, textAlign:'center' },
});