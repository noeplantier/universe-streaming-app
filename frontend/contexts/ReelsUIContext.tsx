/**
 * contexts/ReelsUIContext.tsx — UNIVERSE · v3 OPTIMISÉ
 *
 * ★ Source de vérité unique : NavBar + TopHeader + Sidebar + BottomCard
 * ★ Timer auto-hide 4 s intégré ici (plus dans FeedItem)
 *   → une seule source de vérité pour le timing
 * ★ pauseAutoHide() / resumeAutoHide() : pause quand la vidéo est en pause
 * ★ resetTimer() : appelé par toute interaction (tap, skip, like, seek…)
 * ★ restoreNavBar() : setValue(1) instantané, 0 animation (quitter /reels)
 * ★ 0 re-render inutile : navBarOpacity est une Animated.Value, pas du state
 */
import React, {
    createContext, useCallback, useContext, useRef, useState,
  } from 'react';
  import { Animated } from 'react-native';
  
  const AUTO_HIDE_MS = 4000; // 4 secondes sans interaction → fullscreen
  
  interface ReelsUICtx {
    /** true = chrome visible, false = fullscreen pur */
    uiVisible:     boolean;
    /** Animated.Value 0↔1 — brancher sur opacity de NavBar + TopHeader */
    navBarOpacity: Animated.Value;
    /** Cacher/montrer tout le chrome — appelé par FeedItem / index */
    setUIVisible:  (v: boolean) => void;
    /** Reset le timer 4 s — appelé à chaque interaction utilisateur */
    resetTimer:    () => void;
    /** Suspend l'auto-hide (ex: vidéo en pause → overlay doit rester) */
    pauseAutoHide: () => void;
    /** Reprend l'auto-hide (ex: vidéo reprend) */
    resumeAutoHide: () => void;
    /** Restore instantané sans animation (on quitte /reels) */
    restoreNavBar: () => void;
  }
  
  const ReelsUIContext = createContext<ReelsUICtx>({
    uiVisible:      true,
    navBarOpacity:  new Animated.Value(1),
    setUIVisible:   () => {},
    resetTimer:     () => {},
    pauseAutoHide:  () => {},
    resumeAutoHide: () => {},
    restoreNavBar:  () => {},
  });
  
  export function ReelsUIProvider({ children }: { children: React.ReactNode }) {
    const [uiVisible, _setVisible]  = useState(true);
    const navBarOpacity             = useRef(new Animated.Value(1)).current;
    const animRef                   = useRef<Animated.CompositeAnimation | null>(null);
    const timerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pausedRef                 = useRef(false); // vidéo en pause → pas d'auto-hide
    const visibleRef                = useRef(true);  // miroir sync de uiVisible
  
    // ── Animation fluide ────────────────────────────────────────────────────────
    const animate = useCallback((toValue: number) => {
      animRef.current?.stop();
      animRef.current = Animated.timing(navBarOpacity, {
        toValue,
        duration:        toValue === 1 ? 180 : 260,
        useNativeDriver: true,
      });
      animRef.current.start();
    }, [navBarOpacity]);
  
    // ── Annuler le timer en cours ───────────────────────────────────────────────
    const clearTimer = useCallback(() => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    }, []);
  
    // ── Lancer / relancer le timer 4 s ─────────────────────────────────────────
    const startTimer = useCallback(() => {
      clearTimer();
      if (pausedRef.current) return; // vidéo en pause → on garde l'overlay
      timerRef.current = setTimeout(() => {
        visibleRef.current = false;
        _setVisible(false);
        animate(0);
      }, AUTO_HIDE_MS);
    }, [clearTimer, animate]);
  
    // ── setUIVisible : show/hide immédiat + (re)lance le timer si show ──────────
    const setUIVisible = useCallback((v: boolean) => {
      visibleRef.current = v;
      _setVisible(v);
      animate(v ? 1 : 0);
      if (v) startTimer();   // montrer → relancer le timer
      else   clearTimer();   // cacher → annuler le timer
    }, [animate, startTimer, clearTimer]);
  
    // ── resetTimer : toute interaction utilisateur ──────────────────────────────
    // Si l'overlay était caché → le remonter aussi
    const resetTimer = useCallback(() => {
      if (!visibleRef.current) {
        visibleRef.current = true;
        _setVisible(true);
        animate(1);
      }
      startTimer();
    }, [animate, startTimer]);
  
    // ── pauseAutoHide : vidéo en pause → l'overlay reste visible ───────────────
    const pauseAutoHide = useCallback(() => {
      pausedRef.current = true;
      clearTimer();
      // S'assurer que l'overlay est visible pendant la pause
      if (!visibleRef.current) {
        visibleRef.current = true;
        _setVisible(true);
        animate(1);
      }
    }, [clearTimer, animate]);
  
    // ── resumeAutoHide : reprise de la vidéo → relancer le timer ───────────────
    const resumeAutoHide = useCallback(() => {
      pausedRef.current = false;
      startTimer();
    }, [startTimer]);
  
    // ── restoreNavBar : quitter /reels → restore instantané sans animation ──────
    const restoreNavBar = useCallback(() => {
      clearTimer();
      pausedRef.current  = false;
      visibleRef.current = true;
      animRef.current?.stop();
      navBarOpacity.setValue(1);
      _setVisible(true);
    }, [clearTimer, navBarOpacity]);
  
    return (
      <ReelsUIContext.Provider value={{
        uiVisible, navBarOpacity,
        setUIVisible, resetTimer,
        pauseAutoHide, resumeAutoHide,
        restoreNavBar,
      }}>
        {children}
      </ReelsUIContext.Provider>
    );
  }
  
  export function useReelsUI(): ReelsUICtx {
    return useContext(ReelsUIContext);
  }