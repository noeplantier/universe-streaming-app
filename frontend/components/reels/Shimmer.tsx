
import React, { memo, useRef, useEffect } from 'react';
import { View, Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { P } from './types';

interface ShimmerProps {
  width:  number;
  height: number;
}

const Shimmer = memo(function Shimmer({ width, height }: ShimmerProps) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue:         1,
        duration:        1600,
        easing:          Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange:  [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={[s.root, { width, height }]}>
      {/* Poster blur placeholder */}
      <View style={s.pulse} />

      {/* Shimmer sweep */}
      <Animated.View
        style={[StyleSheet.absoluteFillObject, { transform: [{ translateX }] }]}
        pointerEvents="none"
      >
        <LinearGradient
          colors={['transparent', 'rgba(192,96,255,0.22)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>

      {/* Vignette cinématique */}
      <LinearGradient
        colors={['rgba(7,0,15,0.55)', 'transparent', 'rgba(7,0,15,0.75)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
    </View>
  );
});

export default Shimmer;

const s = StyleSheet.create({
  root:  { overflow: 'hidden', backgroundColor: '#0D0020' },
  pulse: { ...StyleSheet.absoluteFillObject, backgroundColor: '#130025' },
});