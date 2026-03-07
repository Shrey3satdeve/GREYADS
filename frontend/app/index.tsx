import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Megaphone } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.85)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 7, tension: 50, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, delay: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (!token) {
        router.replace('/onboarding');
      } else if (user?.role === 'admin') {
        router.replace('/(admin)/');
      } else if (user?.role === 'staff') {
        router.replace('/(scanner)/');
      } else {
        router.replace('/(tabs)/');
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [isLoading, token, user]);

  return (
    <View style={styles.container} testID="splash-screen">
      {/* Background subtle glow */}
      <View style={styles.glow} />

      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        {/* Icon Ring */}
        <View style={styles.iconRing}>
          <Megaphone size={32} color="#FFFFFF" strokeWidth={2} />
        </View>
        {/* Wordmark */}
        <View style={styles.wordmark}>
          <Text style={styles.logoGrey}>Grey</Text>
          <Text style={styles.logoAdz}>Adz</Text>
          <Text style={styles.logoDot}>.</Text>
        </View>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        YOUR EVENT · YOUR TICKET
      </Animated.Text>

      {/* Bottom version */}
      <Animated.Text style={[styles.version, { opacity: taglineOpacity }]}>
        v1.0
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(255,255,255,0.02)',
    top: '35%',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  wordmark: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  logoGrey: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoAdz: {
    color: '#A1A1AA',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  logoDot: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  tagline: {
    color: '#3F3F46',
    fontSize: 11,
    letterSpacing: 3,
    marginTop: 24,
    textTransform: 'uppercase',
  },
  version: {
    position: 'absolute',
    bottom: 48,
    color: '#27272A',
    fontSize: 12,
    letterSpacing: 1,
  },
});
