import { Platform } from 'react-native';

export type QualityKey = 'auto' | '360p' | '720p' | '1080p' | '4K';

export interface ABRConfig {
  preferredQuality: QualityKey;
  maxBandwidthBps: number;
  adaptiveEnabled: boolean;
}

const DEFAULT_CONFIG: ABRConfig = {
  preferredQuality: 'auto',
  maxBandwidthBps: 0, // 0 = no cap
  adaptiveEnabled: true,
};

// Bandwidth → quality mapping (conservative thresholds)
const BANDWIDTH_THRESHOLDS: Record<QualityKey, number> = {
  '360p':  800_000,
  '720p':  2_500_000,
  '1080p': 5_000_000,
  '4K':    15_000_000,
  'auto':  0,
};

class StreamingService {
  private config: ABRConfig = { ...DEFAULT_CONFIG };
  private measuredBandwidth = 0;

  configure(overrides: Partial<ABRConfig>) {
    this.config = { ...this.config, ...overrides };
  }

  // Feed measured bandwidth (bps) from network metrics
  updateBandwidth(bps: number) {
    // Exponential moving average
    this.measuredBandwidth = this.measuredBandwidth === 0
      ? bps
      : this.measuredBandwidth * 0.7 + bps * 0.3;
  }

  // Pick best quality playlist URL from available levels
  selectPlaylistUrl(qualities: { label: string; bandwidth: number; playlistUrl: string }[]): string {
    if (!qualities?.length) return '';

    if (this.config.preferredQuality !== 'auto') {
      const preferred = qualities.find(q => q.label === this.config.preferredQuality);
      if (preferred) return preferred.playlistUrl;
    }

    // ABR: pick highest quality that fits measured bandwidth
    const cap = this.config.maxBandwidthBps > 0
      ? this.config.maxBandwidthBps
      : this.measuredBandwidth * 0.8; // 80% safety margin

    const affordable = qualities
      .filter(q => cap === 0 || q.bandwidth <= cap)
      .sort((a, b) => b.bandwidth - a.bandwidth);

    return affordable[0]?.playlistUrl ?? qualities[0].playlistUrl;
  }

  // Build secure headers for HLS segment requests
  buildRequestHeaders(token: string): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'X-Universe-Client': `rn-${Platform.OS}`,
    };
  }

  // Validate that a signed URL hasn't expired locally
  isTokenExpired(expiresAt: number): boolean {
    return Date.now() >= expiresAt - 30_000; // 30s early expiry
  }
}

export const streamingService = new StreamingService();
