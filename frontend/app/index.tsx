import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import BrandMark from '../components/BrandMark';
import { Image } from 'expo-image';
import { useAuth } from '../context/AuthContext';
import { seedFirestore } from '../utils/seed';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function SplashScreen() {
  const { token, user, isLoading } = useAuth();
  const router = useRouter();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, friction: 6, tension: 50, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    console.log('[SplashScreen] Routing Check:', { token: !!token, role: user?.role, isLoading });
    if (isLoading) return;
    const timer = setTimeout(() => {
      if (!token) {
        router.replace('/onboarding');
      } else if (user?.role === 'admin') {
        router.replace('/(admin)');
      } else if (user?.role === 'staff') {
        router.replace('/(scanner)');
      } else {
        router.replace('/(tabs)');
      }
    }, 0); // Redirect immediately but AuthContext will handle state
    return () => clearTimeout(timer);
  }, [isLoading, token, user]);

  return (
    <View style={styles.container} testID="splash-screen">
      <View style={styles.glow} />

      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <View style={styles.logoSquircle}>
          <Image
            source={require('../assets/images/greyadz-logo-v3.png')}
            style={styles.logoImage}
            contentFit="contain"
          />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.logoTitle}>
            GREY<Text style={{ color: '#A1A1AA' }}>ADZ</Text>
          </Text>
          <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
            Elevating Your Event Experience
          </Animated.Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.footer, { opacity: taglineOpacity }]}>
        <Text style={styles.version}>PREMIUM EDITION v1.0</Text>
      </Animated.View>
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
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: (width * 1.5) / 2,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  logoSquircle: {
    width: 140,
    height: 140,
    backgroundColor: '#0A0A0A',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 10,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  textContainer: {
    alignItems: 'center',
  },
  logoTitle: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
  },
  tagline: {
    color: '#71717A',
    fontSize: 11,
    letterSpacing: 4.5,
    marginTop: 16,
    textTransform: 'uppercase',
    fontWeight: '600',
    opacity: 0.8,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  version: {
    color: '#3F3F46',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
});
