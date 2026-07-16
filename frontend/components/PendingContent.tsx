/**
 * components/PendingContent.tsx — UNIVERSE · Écran d'attente premium
 *
 * Identique à Loading.tsx dans l'ambiance (logo + GalaxyBackground + breathing),
 * mais conçu pour le contenu en cours de traitement (upload/transcodage).
 * Prend un message + subtitle optionnels et affiche une barre de progression
 * indéterminée pulsante.
 *
 * Usage :
 *   import PendingContent from '@/components/PendingContent';
 *   <PendingContent message="Votre vidéo est en cours de traitement" />
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GalaxyBackground from '@/components/shared/GalaxyBackground';

const { width } = Dimensions.get('window');

interface Props {
  message?: string;
  subtitle?: string;
}

export default function PendingContent({
  message  = 'Contenu en traitement',
  subtitle = 'Votre vidéo sera disponible très prochainement',
}: Props) {
  const logoScale = useRef(new Animated.Value(1)).current;
  const logoOp    = useRef(new Animated.Value(0)).current;
  const glowOp    = useRef(new Animated.Value(0.18)).current;
  const progressX = useRef(new Animated.Value(-width * 0.5)).current;
  const dot1      = useRef(new Animated.Value(0)).current;
  const dot2      = useRef(new Animated.Value(0)).current;
  const dot3      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade-in logo
    Animated.timing(logoOp, { toValue: 1, duration: 900, useNativeDriver: true }).start();

    // Breathing logo
    Animated.loop(Animated.sequence([
      Animated.timing(logoScale, { toValue: 1.05, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(logoScale, { toValue: 1,    duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    // Gold glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(glowOp, { toValue: 0.72, duration: 1800, useNativeDriver: true }),
      Animated.timing(glowOp, { toValue: 0.18, duration: 1800, useNativeDriver: true }),
    ])).start();

    // Slide-across progress
    Animated.loop(Animated.sequence([
      Animated.timing(progressX, {
        toValue: width,
        duration: 2000,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(progressX, { toValue: -width * 0.5, duration: 0, useNativeDriver: true }),
    ])).start();

    // Staggered dots
    const dotLoop = (anim: Animated.Value, delay: number) =>
      Animated.loop(Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 320, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.2, duration: 320, useNativeDriver: true }),
        Animated.delay(Math.max(0, 960 - delay)),
      ]));
    dotLoop(dot1, 0).start();
    dotLoop(dot2, 280).start();
    dotLoop(dot3, 560).start();
  }, []);

  const glowStyle: any = Platform.OS === 'web'
    ? { boxShadow: '0 0 60px 30px rgba(245,200,66,0.22)' }
    : { shadowColor: '#F5C842', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 60, elevation: 0 };

  return (
    <View style={s.root}>
      <LinearGradient colors={['#02020A', '#050514', '#0D0825']} style={StyleSheet.absoluteFillObject}/>
      <GalaxyBackground/>

      {/* Gold aura */}
      <Animated.View style={[s.glow, glowStyle, { opacity: glowOp }]} pointerEvents="none"/>

      {/* Logo */}
      <Animated.Image
        source={require('../assets/images/logouniverse2.png')}
        style={[s.logo, { opacity: logoOp, transform: [{ scale: logoScale }] }]}
        resizeMode="contain"
      />

      {/* Message + dots */}
      <View style={s.textWrap}>
        <View style={s.msgRow}>
          <Text style={s.msg}>{message}</Text>
          <View style={s.dotRow}>
            <Animated.Text style={[s.dot, { opacity: dot1 }]}>•</Animated.Text>
            <Animated.Text style={[s.dot, { opacity: dot2 }]}>•</Animated.Text>
            <Animated.Text style={[s.dot, { opacity: dot3 }]}>•</Animated.Text>
          </View>
        </View>
        <Text style={s.sub}>{subtitle}</Text>
      </View>

      {/* Indeterminate progress bar */}
      <View style={s.progressWrap}>
        <Animated.View
          style={[s.progressBar, { transform: [{ translateX: progressX }] }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: 'rgba(245,200,66,0.06)',
  },
  logo: { width: 290, height: 290, zIndex: 2 },
  textWrap: { marginTop: 18, alignItems: 'center', gap: 6 },
  msgRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  msg: { color: '#F5C842', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 1 },
  dot: { color: '#F5C842', fontSize: 14, fontWeight: '900', lineHeight: 16 },
  sub: { color: 'rgba(255,255,255,0.36)', fontSize: 12 },
  progressWrap: {
    marginTop: 28,
    width: width * 0.5,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    width: width * 0.45,
    height: '100%',
    borderRadius: 2,
    backgroundColor: '#F5C842',
  },
});
