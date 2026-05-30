/**
 * contexts/ReelsUIContext.tsx — UNIVERSE
 *
 * Contexte qui expose une seule Animated.Value (navBarOpacity)
 * partagée entre :
 *   · _layout.tsx  → anime la CustomNavBar
 *   · index.tsx    → anime le TopHeader
 *   · FeedItem     → déclenche hide/show
 *
 * La NavBar ne disparaît QUE si isOnReels === true.
 * Quand on quitte l'écran reels → la NavBar est IMMÉDIATEMENT restaurée.
 */
import React, {
    createContext, useCallback, useContext, useRef, useState,
  } from 'react';
  import { Animated } from 'react-native';
  
  interface ReelsUICtx {
    /** Opacity partagée NavBar + TopHeader */
    navBarOpacity: Animated.Value;
    /** true = overlay visible, false = fullscreen */
    uiVisible: boolean;
    /** Appelé depuis FeedItem — cache NavBar + TopHeader simultanément */
    setUIVisible: (v: boolean) => void;
    /** Appelé depuis _layout quand on QUITTE l'écran reels → restore immédiat */
    restoreNavBar: () => void;
  }
  
  const Ctx = createContext<ReelsUICtx>({
    navBarOpacity: new Animated.Value(1),
    uiVisible: true,
    setUIVisible: () => {},
    restoreNavBar: () => {},
  });
  
  export function ReelsUIProvider({ children }: { children: React.ReactNode }) {
    const navBarOpacity = useRef(new Animated.Value(1)).current;
    const [uiVisible, setVisible] = useState(true);
    const animRef = useRef<Animated.CompositeAnimation | null>(null);
  
    const animate = useCallback((toValue: number, duration: number) => {
      animRef.current?.stop();
      animRef.current = Animated.timing(navBarOpacity, {
        toValue,
        duration,
        useNativeDriver: true,
      });
      animRef.current.start();
    }, [navBarOpacity]);
  
    const setUIVisible = useCallback((v: boolean) => {
      setVisible(v);
      animate(v ? 1 : 0, v ? 180 : 260);
    }, [animate]);
  
    /** Restore instantané (sans animation) quand on quitte reels */
    const restoreNavBar = useCallback(() => {
      animRef.current?.stop();
      navBarOpacity.setValue(1);
      setVisible(true);
    }, [navBarOpacity]);
  
    return (
      <Ctx.Provider value={{ navBarOpacity, uiVisible, setUIVisible, restoreNavBar }}>
        {children}
      </Ctx.Provider>
    );
  }
  
  export function useReelsUI() {
    return useContext(Ctx);
  }