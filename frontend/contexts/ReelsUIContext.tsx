/**
 * contexts/ReelsUIContext.tsx — UNIVERSE
 *
 * Source de vérité unique pour la visibilité du chrome (NavBar + TopHeader).
 * Exposé via useReelsUI() depuis :
 *   · _layout.tsx   → NavBarWrapper (opacity + pointerEvents)
 *   · index.tsx     → TopHeader (opacity + pointerEvents)
 *   · FeedItem.tsx  → appelle setUIVisible(false/true)
 *
 * Comportement :
 *   · Sur /reels uniquement — la NavBar peut disparaître (opacity 0)
 *   · Sur toutes les autres pages — _layout rend une View normale (opacity 1 fixe)
 *   · setUIVisible(false) → animation 260 ms, pointerEvents="none"
 *   · setUIVisible(true)  → animation 180 ms, pointerEvents="box-none"
 *   · restoreNavBar()     → setValue(1) instantané sans animation (quand on quitte /reels)
 */
import React, {
    createContext,
    useCallback,
    useContext,
    useRef,
    useState,
  } from 'react';
  import { Animated } from 'react-native';
  
  interface ReelsUICtx {
    /** true = chrome visible, false = fullscreen */
    uiVisible:    boolean;
    /** Animated.Value 0↔1 — brancher sur opacity de NavBar + TopHeader */
    navBarOpacity: Animated.Value;
    /** Cacher/montrer tout le chrome simultanément */
    setUIVisible:  (v: boolean) => void;
    /** Restore instantanée sans animation (appelé en quittant /reels) */
    restoreNavBar: () => void;
  }
  
  const ReelsUIContext = createContext<ReelsUICtx>({
    uiVisible:    true,
    navBarOpacity: new Animated.Value(1),
    setUIVisible:  () => {},
    restoreNavBar: () => {},
  });
  
  export function ReelsUIProvider({ children }: { children: React.ReactNode }) {
    const [uiVisible, _setVisible] = useState(true);
    const navBarOpacity = useRef(new Animated.Value(1)).current;
    const animRef = useRef<Animated.CompositeAnimation | null>(null);
  
    const setUIVisible = useCallback((v: boolean) => {
      _setVisible(v);
      animRef.current?.stop();
      animRef.current = Animated.timing(navBarOpacity, {
        toValue:         v ? 1 : 0,
        // Apparition plus rapide (180 ms) que disparition (260 ms) → fluide
        duration:        v ? 180 : 260,
        useNativeDriver: true,
      });
      animRef.current.start();
    }, [navBarOpacity]);
  
    /** Restore instantané — appelé quand on navigue hors de /reels */
    const restoreNavBar = useCallback(() => {
      animRef.current?.stop();
      navBarOpacity.setValue(1);
      _setVisible(true);
    }, [navBarOpacity]);
  
    return (
      <ReelsUIContext.Provider value={{ uiVisible, navBarOpacity, setUIVisible, restoreNavBar }}>
        {children}
      </ReelsUIContext.Provider>
    );
  }
  
  export function useReelsUI(): ReelsUICtx {
    return useContext(ReelsUIContext);
  }