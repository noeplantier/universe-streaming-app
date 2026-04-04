
import { Dimensions } from 'react-native';

// ─── Dimensions ───────────────────────────────────────────────────
export const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// ─── Palette ──────────────────────────────────────────────────────
export const G = {
  bg0: '#060010', bg1: '#0A001E', bg2: '#070014',
  neb0: 'rgba(108,16,195,0.32)', neb1: 'rgba(172,24,160,0.20)',
  sW: '#F3EDFF', sB: '#B2CCFF', sG: '#FFE270', sP: '#CF98FF', sCy: '#86EEFF',
  glass:       'rgba(255,255,255,0.056)',
  glassBorder: 'rgba(255,255,255,0.09)',
  primary:  '#C060FF',
  accent:   '#A855F7',
  textSub:  '#BCB8C2',
  gold:     '#FFE270',
  cyan:     '#86EEFF',
  danger:   '#FF4D6A',
  success:  '#1ED760',
  info:     '#60A5FA',
  orange:   '#FB923C',
} as const;

// ─── Types ────────────────────────────────────────────────────────
export type AppMode    = 'video' | 'critique';
export type WizardStep = 0 | 1 | 2 | 3 | 4;

export interface SubtitleTrack {
  id:      string;
  startMs: number;
  endMs:   number;
  text:    string;
  edited:  boolean;
  lang:    string;
}

export interface ExportFormat {
  id:      string;
  label:   string;
  codec:   string;
  res:     string;
  bitrate: string;
  ext:     string;
  icon:    string;
  badge?:  string;
  color:   string;
  sizeMb:  string;
  ffCodec: string;   // FFmpegKit codec flag
  ffPreset: string;  // FFmpegKit preset
  crf:     number;
}

export interface ThumbnailFrame {
  id:   string;
  uri:  string;
  time: number;
}

export interface CastMember {
  name: string;
  role: string;
}

export interface ExportedFile {
  name:  string;
  path:  string;
  type:  string;
  bytes: number;
  icon:  string;
  color: string;
}

// ── Video edit parameters ──────────────────────────────────────────
export interface VideoEditParams {
  trimStart:  number;   // seconds
  trimEnd:    number;   // seconds (= full duration if no trim)
  speed:      number;   // 0.25 | 0.5 | 1 | 1.5 | 2 | 4
  zoom:       number;   // 1.0 – 2.5
  brightness: number;   // -0.5 – 0.5
  contrast:   number;   // 0.5 – 2.0
  saturation: number;   // 0.0 – 3.0
  applied:    boolean;  // true once FFmpeg has processed
}

export const DEFAULT_EDIT_PARAMS: VideoEditParams = {
  trimStart:  0,
  trimEnd:    0,         // set to videoDuration after load
  speed:      1,
  zoom:       1,
  brightness: 0,
  contrast:   1,
  saturation: 1,
  applied:    false,
};

// ─── Product constants ────────────────────────────────────────────
export const WIZARD_STEPS = ['Import', 'Métadonnées', 'Sous-titres', 'Thumbnail', 'Export'] as const;

export const GENRES_CINEMA = [
  'Drame', 'Thriller', 'Documentaire', 'Expérimental', 'Animation',
  'Horreur', 'Comédie', 'Sci-Fi', 'Néo-Noir', 'Essai visuel',
  'Romance', 'Biopic', 'Musical', 'Western', 'Fantastique',
] as const;

export const LANGUAGES     = ['Français', 'English', 'Español', 'Deutsch', 'Italiano', '日本語', 'العربية', 'Português'] as const;
export const COLOR_SPACES  = ['Rec.709', 'DCI-P3', 'Rec.2020', 'sRGB', 'ACES'] as const;
export const ASPECT_RATIOS = ['16:9', '2.39:1', '1.85:1', '4:3', '1:1', '2:1'] as const;

export const EXPORT_FORMATS: ExportFormat[] = [
  {
    id: '4k_prores',  label: '4K ProRes 422',  codec: 'ProRes 422 HQ', res: '3840×2160', bitrate: '707 Mb/s',
    ext: 'mov',  icon: 'diamond',      badge: 'FESTIVAL', color: G.gold,
    sizeMb: '~18 Go/h',  ffCodec: 'prores_ks',      ffPreset: '-profile:v 3',  crf: 0,
  },
  {
    id: '2k_prores',  label: '2K ProRes 4444', codec: 'ProRes 4444',   res: '2048×1080', bitrate: '330 Mb/s',
    ext: 'mov',  icon: 'film',         badge: 'CINÉMA',   color: G.orange,
    sizeMb: '~8 Go/h',   ffCodec: 'prores_ks',      ffPreset: '-profile:v 4',  crf: 0,
  },
  {
    id: '1080_h264',  label: '1080p H.264',    codec: 'H.264 / AAC',   res: '1920×1080', bitrate: '16 Mb/s',
    ext: 'mp4',  icon: 'play-circle',  badge: 'STANDARD', color: G.primary,
    sizeMb: '~7 Go/h',   ffCodec: 'libx264',        ffPreset: '-preset fast',  crf: 23,
  },
  {
    id: '1080_h265',  label: '1080p H.265',    codec: 'HEVC / AAC',    res: '1920×1080', bitrate: '8 Mb/s',
    ext: 'mp4',  icon: 'cube',         badge: 'COMPACT',  color: G.cyan,
    sizeMb: '~3.5 Go/h', ffCodec: 'libx265',        ffPreset: '-preset fast',  crf: 28,
  },
  {
    id: '720_web',    label: 'Web 720p',       codec: 'H.264 / AAC',   res: '1280×720',  bitrate: '4 Mb/s',
    ext: 'mp4',  icon: 'globe-outline', badge: 'WEB',      color: G.textSub,
    sizeMb: '~1.8 Go/h', ffCodec: 'libx264',        ffPreset: '-preset veryfast', crf: 26,
  },
];

export const CRITIQUE_ASPECTS = ['Scénario', 'Photographie', 'Jeu d\'acteur', 'BO / Son', 'Montage', 'Mise en scène'] as const;

export const SPEED_OPTIONS: { label: string; value: number }[] = [
  { label: '0.25×', value: 0.25 },
  { label: '0.5×',  value: 0.5  },
  { label: '1×',    value: 1    },
  { label: '1.5×',  value: 1.5  },
  { label: '2×',    value: 2    },
  { label: '4×',    value: 4    },
];

// ─── Helpers ──────────────────────────────────────────────────────

export function msToTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m   = Math.floor(totalSec / 60);
  const s   = (totalSec % 60).toString().padStart(2, '0');
  const ms2 = (ms % 1000).toString().padStart(3, '0').slice(0, 2);
  return `${m.toString().padStart(2, '0')}:${s}.${ms2}`;
}

export function secToTimecode(sec: number): string {
  return msToTimecode(Math.floor(sec) * 1000);
}

export function msToSrtTimecode(ms: number): string {
  const h   = Math.floor(ms / 3600000);
  const m   = Math.floor((ms % 3600000) / 60000);
  const s   = Math.floor((ms % 60000) / 1000);
  const ms3 = (ms % 1000).toString().padStart(3, '0');
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')},${ms3}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024)            return `${bytes} o`;
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 ** 3)       return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  return `${(bytes / (1024 ** 3)).toFixed(2)} Go`;
}

export function generateSRT(tracks: SubtitleTrack[]): string {
  return tracks
    .map((t, i) => `${i + 1}\n${msToSrtTimecode(t.startMs)} --> ${msToSrtTimecode(t.endMs)}\n${t.text}`)
    .join('\n\n') + '\n';
}

export function generateXMP(meta: { title: string; director: string; year: string; genre: string; synopsis: string }): string {
  return `<?xpacket begin='' id='W5M0MpCehiHzreSzNTczkc9d'?>
<x:xmpmeta xmlns:x='adobe:ns:meta/'>
  <rdf:RDF xmlns:rdf='http://www.w3.org/1999/02/22-rdf-syntax-ns#'>
    <rdf:Description rdf:about=''
      xmlns:dc='http://purl.org/dc/elements/1.1/'
      xmlns:xmp='http://ns.adobe.com/xap/1.0/'
      xmlns:universe='http://ns.universe.app/1.0/'>
      <dc:title><rdf:Alt><rdf:li xml:lang='x-default'>${meta.title || 'Sans titre'}</rdf:li></rdf:Alt></dc:title>
      <dc:creator><rdf:Seq><rdf:li>${meta.director || ''}</rdf:li></rdf:Seq></dc:creator>
      <dc:description><rdf:Alt><rdf:li xml:lang='x-default'>${meta.synopsis || ''}</rdf:li></rdf:Alt></dc:description>
      <dc:subject><rdf:Bag><rdf:li>${meta.genre || ''}</rdf:li></rdf:Bag></dc:subject>
      <xmp:CreateDate>${meta.year}-01-01</xmp:CreateDate>
      <universe:App>UNIVERSE Studio</universe:App>
      <universe:Version>2.0</universe:Version>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end='w'?>`;
}

export function generatePressKit(meta: {
  title: string; director: string; year: string; genre: string; synopsis: string;
  dirNote: string; runtime: string; language: string; cast: CastMember[];
  dop: string; composer: string; production: string; colorSpace: string;
  aspectRatio: string; festival: string;
}): string {
  const line     = '─'.repeat(60);
  const castStr  = meta.cast.filter(c => c.name)
    .map(c => `  • ${c.name}${c.role ? ` (${c.role})` : ''}`).join('\n') || '  Non renseigné';
  return [
    `UNIVERSE — DOSSIER DE PRESSE`, line, ``,
    `TITRE         : ${meta.title || 'Sans titre'}`,
    `RÉALISATEUR   : ${meta.director || 'Non renseigné'}`,
    `ANNÉE         : ${meta.year}`,
    `GENRE         : ${meta.genre || 'Non renseigné'}`,
    `DURÉE         : ${meta.runtime || 'Non renseignée'}`,
    `LANGUE        : ${meta.language || 'Non renseignée'}`,
    `ASPECT RATIO  : ${meta.aspectRatio}`,
    `COLOR SPACE   : ${meta.colorSpace}`,
    ``, line, `ÉQUIPE TECHNIQUE`, line,
    `CHEF OP.      : ${meta.dop || 'Non renseigné'}`,
    `MUSIQUE       : ${meta.composer || 'Non renseignée'}`,
    `PRODUCTION    : ${meta.production || 'Non renseignée'}`,
    ``, line, `DISTRIBUTION`, line, castStr,
    ``, line, `SYNOPSIS`, line, meta.synopsis || 'Non renseigné',
    ``, line, `NOTE DU RÉALISATEUR`, line, meta.dirNote || 'Non renseignée',
    ``, line, `FESTIVALS / SÉLECTIONS`, line, meta.festival || 'Non renseigné',
    ``, line,
    `Généré par UNIVERSE Studio — ${new Date().toLocaleDateString('fr-FR', { dateStyle: 'long' })}`,
    line,
  ].join('\n');
}

/** Build FFmpegKit command from edit params + format */
export function buildFFmpegCommand(params: {
  inputPath:  string;
  outputPath: string;
  edit:       VideoEditParams;
  format:     ExportFormat;
}): string {
  const { inputPath, outputPath, edit, format } = params;
  const vf: string[]  = [];
  const af: string[]  = [];

  // Trim (input seeking — fast)
  const seekPart = edit.trimStart > 0 ? `-ss ${edit.trimStart.toFixed(3)}` : '';
  const durPart  = edit.trimEnd > edit.trimStart
    ? `-t ${(edit.trimEnd - edit.trimStart).toFixed(3)}`
    : '';

  // Speed
  if (edit.speed !== 1) {
    vf.push(`setpts=${(1 / edit.speed).toFixed(4)}*PTS`);
    const clampedSpeed = Math.max(0.5, Math.min(2.0, edit.speed));
    af.push(`atempo=${clampedSpeed}`);
    // For 4× speed: chain two atempo=2.0
    if (edit.speed === 4) {
      af.pop();
      af.push('atempo=2.0', 'atempo=2.0');
    }
  }

  // Zoom (scale up then crop back to original resolution)
  if (edit.zoom > 1.001) {
    const z = edit.zoom.toFixed(4);
    vf.push(`scale=iw*${z}:ih*${z},crop=iw/${z}:ih/${z}`);
  }

  // Brightness / contrast / saturation via eq filter
  const bNorm = edit.brightness !== 0 ? `,brightness=${edit.brightness.toFixed(3)}` : '';
  const cNorm = edit.contrast !== 1   ? `,contrast=${edit.contrast.toFixed(3)}`     : '';
  const sNorm = edit.saturation !== 1 ? `,saturation=${edit.saturation.toFixed(3)}` : '';
  if (bNorm || cNorm || sNorm) {
    vf.push(`eq=1${bNorm}${cNorm}${sNorm}`);
  }

  const vfStr = vf.length > 0 ? `-vf "${vf.join(',')}"` : '';
  const afStr = af.length > 0 ? `-af "${af.join(',')}"` : '';

  // Codec flags
  let codecFlags = `-c:v ${format.ffCodec}`;
  if (format.ffPreset) codecFlags += ` ${format.ffPreset}`;
  if (format.crf > 0)  codecFlags += ` -crf ${format.crf}`;
  codecFlags += ' -c:a aac -b:a 192k';

  return [
    `-y`,
    seekPart,
    `-i "${inputPath}"`,
    durPart,
    vfStr,
    afStr,
    codecFlags,
    `"${outputPath}"`,
  ].filter(Boolean).join(' ');
}

export function generateFakeSubtitles(durationSec: number): SubtitleTrack[] {
  const lines = [
    'Un plan fixe.', 'La lumière décline lentement.',
    'On entend des pas au loin.', 'Elle s\'arrête. Hésite.',
    '— Tu crois que ça change quelque chose ?',
    'Le silence répond pour lui.', 'Fondu au noir.',
    '[ Musique : cordes — pianissimo ]',
    'Extérieur nuit — rue déserte.',
    'Un néon clignote, rouge sang.',
    'Il ramasse la lettre. La repose.',
    '— Rien n\'est perdu.', '— Tout est perdu.',
    'Contre-plongée sur le ciel vide.',
    'Un dernier souffle.', 'FIN.',
  ];
  const tracks: SubtitleTrack[] = [];
  let cursor = 2000;
  for (let i = 0; i < lines.length && cursor < durationSec * 1000 - 3000; i++) {
    const dur = 1800 + Math.random() * 2200;
    tracks.push({ id: `sub_${i}`, startMs: cursor, endMs: cursor + dur, text: lines[i], edited: false, lang: 'fr' });
    cursor += dur + 400 + Math.random() * 1200;
  }
  return tracks;
}

export function generateFakeThumbnails(durationSec: number): ThumbnailFrame[] {
  const count = Math.min(10, Math.max(4, Math.floor(durationSec / 10)));
  return Array.from({ length: count }, (_, i) => ({
    id: `frame_${i}`,
    uri: `https://picsum.photos/seed/frame${i + Math.floor(Math.random() * 999)}/320/180`,
    time: Math.floor((durationSec / count) * i) + Math.floor(Math.random() * 5),
  }));
}