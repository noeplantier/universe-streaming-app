import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';

// Android FLAG_SECURE via react-native-flag-secure-android
let FlagSecure: { activate: () => void; deactivate: () => void } | null = null;
try {
  FlagSecure = require('react-native-flag-secure-android');
} catch {}

export function useScreenProtection(active: boolean) {
  const lock = useCallback(() => {
    if (Platform.OS === 'android' && FlagSecure) {
      FlagSecure.activate();
    }
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
  }, []);

  const unlock = useCallback(() => {
    if (Platform.OS === 'android' && FlagSecure) {
      FlagSecure.deactivate();
    }
    ScreenCapture.allowScreenCaptureAsync().catch(() => {});
  }, []);

  useEffect(() => {
    if (active) {
      lock();
    } else {
      unlock();
    }
    return () => { unlock(); };
  }, [active, lock, unlock]);

  return { lock, unlock };
}
