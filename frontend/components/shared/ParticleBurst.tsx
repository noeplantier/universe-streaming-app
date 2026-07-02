/**
 * ParticleBurst — explosion de particules à 8 directions.
 * Extrait de contexts/GamificationSystem.tsx (déblocage de badge, usage rare)
 * pour être réutilisé sur des cibles à taps fréquents (boutons like) —
 * d'où le garde anti-empilement absent de la version d'origine.
 */
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export interface ParticleBurstProps {
  /** Incrémenter pour déclencher une nouvelle explosion. */
  trigger: number;
  color?: string;
  count?: number;
  /** Distance de projection en px. */
  radius?: number;
}

export const ParticleBurst = memo(function ParticleBurst({
  trigger, color = '#F5C842', count = ANGLES.length, radius = 36,
}: ParticleBurstProps) {
  const angles = count === ANGLES.length ? ANGLES : Array.from({ length: count }, (_, i) => (360 / count) * i);
  const anims = useRef(angles.map(() => new Animated.Value(0))).current;
  const opacs = useRef(angles.map(() => new Animated.Value(0))).current;
  // Un burst en cours ignore les triggers suivants jusqu'à sa fin — sans ça,
  // des taps rapides (like-button) réinitialisent les particules en plein vol.
  const running = useRef(false);

  useEffect(() => {
    if (trigger === 0 || running.current) return;
    running.current = true;
    anims.forEach(a => a.setValue(0));
    opacs.forEach(o => o.setValue(1));
    Animated.stagger(15, angles.map((_, i) => Animated.parallel([
      Animated.timing(anims[i], { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([Animated.delay(300), Animated.timing(opacs[i], { toValue: 0, duration: 300, useNativeDriver: true })]),
    ]))).start(() => { running.current = false; });
  }, [trigger]);

  return (
    <View style={{ position: 'absolute', width: 0, height: 0, alignSelf: 'center', top: '50%' }} pointerEvents="none">
      {angles.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const tx = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(rad) * radius] });
        const ty = anims[i].interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * radius] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', width: 5, height: 5, borderRadius: 2.5,
              backgroundColor: color, transform: [{ translateX: tx }, { translateY: ty }], opacity: opacs[i],
            }}
          />
        );
      })}
    </View>
  );
});

export default ParticleBurst;
