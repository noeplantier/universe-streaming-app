import { Platform } from 'react-native';

export interface VideoSource {
  type: 'youtube' | 'vimeo' | 'direct' | 'cdn';
  id: string;
  url?: string;
  quality?: 'sd' | 'hd' | '4k';
  subtitles?: SubtitleTrack[];
}

export interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
}

export interface StreamingConfig {
  adaptiveBitrate: boolean;
  preferredQuality: 'auto' | 'sd' | 'hd' | '4k';
  preloadNext: boolean;
  offlineEnabled: boolean;
}

const DEFAULT_CONFIG: StreamingConfig = {
  adaptiveBitrate: true,
  preferredQuality: 'auto',
  preloadNext: true,
  offlineEnabled: false,
};

// CDN Configuration (ready for production)
export const CDN_CONFIG = {
  baseUrl: 'https://cdn.universe-app.com', // Replace with actual CDN
  fallbackUrl: 'https://storage.googleapis.com/universe-films',
  thumbnailPath: '/thumbnails',
  videoPath: '/videos',
  subtitlePath: '/subtitles',
};

// Generate YouTube embed URL with optimal parameters
export function getYouTubeEmbedUrl(videoId: string, options: {
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  start?: number;
} = {}): string {
  const params = new URLSearchParams({
    autoplay: options.autoplay ? '1' : '0',
    mute: options.muted ? '1' : '0',
    controls: options.controls !== false ? '1' : '0',
    loop: options.loop ? '1' : '0',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
    ...(options.start ? { start: options.start.toString() } : {}),
  });
  
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// Generate YouTube thumbnail URL
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'): string {
  const qualityMap = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

// Generate Vimeo embed URL
export function getVimeoEmbedUrl(videoId: string, options: {
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
} = {}): string {
  const params = new URLSearchParams({
    autoplay: options.autoplay ? '1' : '0',
    muted: options.muted ? '1' : '0',
    loop: options.loop ? '1' : '0',
    byline: '0',
    portrait: '0',
    title: '0',
  });
  
  return `https://player.vimeo.com/video/${videoId}?${params.toString()}`;
}

// Build video source object from film data
export function buildVideoSource(film: {
  video_id?: string;
  trailer_url?: string;
  cdn_url?: string;
}): VideoSource {
  // Priority: CDN > Direct URL > YouTube
  if (film.cdn_url) {
    return {
      type: 'cdn',
      id: film.cdn_url,
      url: film.cdn_url,
    };
  }
  
  if (film.trailer_url) {
    if (film.trailer_url.includes('youtube.com') || film.trailer_url.includes('youtu.be')) {
      const videoId = extractYouTubeId(film.trailer_url);
      return {
        type: 'youtube',
        id: videoId || film.video_id || '',
      };
    }
    if (film.trailer_url.includes('vimeo.com')) {
      const videoId = extractVimeoId(film.trailer_url);
      return {
        type: 'vimeo',
        id: videoId || '',
      };
    }
    return {
      type: 'direct',
      id: film.trailer_url,
      url: film.trailer_url,
    };
  }
  
  return {
    type: 'youtube',
    id: film.video_id || 'dQw4w9WgXcQ', // Fallback
  };
}

// Extract YouTube video ID from various URL formats
export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Extract Vimeo video ID
export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  return match ? match[1] : null;
}

// Generate HTML for embedded video player
export function generateVideoPlayerHTML(source: VideoSource, options: {
  width?: string;
  height?: string;
  autoplay?: boolean;
} = {}): string {
  const { width = '100%', height = '100%', autoplay = true } = options;
  
  let embedUrl = '';
  switch (source.type) {
    case 'youtube':
      embedUrl = getYouTubeEmbedUrl(source.id, { autoplay, controls: true });
      break;
    case 'vimeo':
      embedUrl = getVimeoEmbedUrl(source.id, { autoplay });
      break;
    case 'cdn':
    case 'direct':
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { margin: 0; padding: 0; }
            html, body { width: 100%; height: 100%; background: #000; }
            video { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <video ${autoplay ? 'autoplay' : ''} controls playsinline>
            <source src="${source.url}" type="video/mp4">
          </video>
        </body>
        </html>
      `;
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; background: #000; overflow: hidden; }
        iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
      </style>
    </head>
    <body>
      <iframe
        src="${embedUrl}"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      ></iframe>
    </body>
    </html>
  `;
}

// Estimate video quality based on connection
export async function detectOptimalQuality(): Promise<'sd' | 'hd' | '4k'> {
  if (Platform.OS === 'web') {
    // @ts-ignore - Navigator API
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      if (effectiveType === '4g') return 'hd';
      if (effectiveType === '3g') return 'sd';
      return 'sd';
    }
  }
  return 'hd'; // Default to HD for native apps
}
