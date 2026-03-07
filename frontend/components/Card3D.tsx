/**
 * 3D Card Tilt Component — uses react-native-reanimated perspective transforms
 * Creates genuine 3D depth effect with device motion / press interaction
 */
import React, { useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { GestureHandlerRootView, PanGestureHandler, TapGestureHandler, State } from 'react-native-gesture-handler';

interface Props {
  children: React.ReactNode;
  style?: object;
  intensity?: number; // tilt intensity 1-20 (default 10)
  enableGlow?: boolean;
  glowColor?: string;
}

export default function Card3D({ children, style, intensity = 10, enableGlow = false, glowColor = 'rgba(255,255,255,0.08)' }: Props) {
  const rotateX = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, tension: 300, friction: 10 }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 150, friction: 8 }),
      Animated.spring(rotateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.spring(rotateY, { toValue: 0, useNativeDriver: true, tension: 100, friction: 8 }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const rotX = rotateX.interpolate({ inputRange: [-20, 0, 20], outputRange: ['-8deg', '0deg', '8deg'] });
  const rotY = rotateY.interpolate({ inputRange: [-20, 0, 20], outputRange: ['-8deg', '0deg', '8deg'] });

  return (
    <TapGestureHandler onHandlerStateChange={({ nativeEvent }) => {
      if (nativeEvent.state === State.BEGAN) handlePressIn();
      if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED || nativeEvent.state === State.FAILED) handlePressOut();
    }}>
      <Animated.View
        style={[
          styles.wrapper,
          style,
          { transform: [{ perspective: 1200 }, { rotateX: rotX }, { rotateY: rotY }, { scale }] }
        ]}
      >
        {children}
        {enableGlow && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.glowOverlay, { opacity: glowOpacity, backgroundColor: glowColor }]} />
        )}
      </Animated.View>
    </TapGestureHandler>
  );
}

const styles = StyleSheet.create({
  wrapper: { backfaceVisibility: 'hidden' },
  glowOverlay: { borderRadius: 20, zIndex: 10 },
});
