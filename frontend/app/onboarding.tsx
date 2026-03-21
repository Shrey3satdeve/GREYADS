import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  FlatList, Animated, ViewToken, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Compass, Ticket, QrCode, ArrowRight, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: Compass,
    iconColor: '#FFFFFF',
    bg1: '#000000',
    bg2: '#0A0A0A',
    accent: '#FFFFFF',
    title: 'Discover\nElite Events',
    subtitle: 'Access the most exclusive gatherings, from underground music festivals to high-stakes tech summits.',
    pill: 'ELITE',
  },
  {
    id: '2',
    icon: Ticket,
    iconColor: '#FFFFFF',
    bg1: '#000000',
    bg2: '#0A0A0A',
    accent: '#FFFFFF',
    title: 'Effortless\nReservations',
    subtitle: 'Secure your place in seconds with our refined booking experience. Instant confirmation, absolute security.',
    pill: 'SECURE',
  },
  {
    id: '3',
    icon: QrCode,
    iconColor: '#FFFFFF',
    bg1: '#000000',
    bg2: '#0A0A0A',
    accent: '#FFFFFF',
    title: 'Seamless\nEntry',
    subtitle: 'Walk past the lines. Your digital identity is your key. Professional, fast, and entirely digital.',
    pill: 'PASS',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const activeIndexRef = useRef(0);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (!viewableItems[0]) return;
    const nextIndex = viewableItems[0].index ?? 0;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
  }).current;

  const goNext = () => {
    const currentIndex = activeIndexRef.current;
    if (currentIndex < SLIDES.length - 1) {
      const nextIndex = currentIndex + 1;
      activeIndexRef.current = nextIndex;
      setActiveIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: Platform.OS !== 'web',
      });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const skip = () => {
    router.replace('/(auth)/login');
  };

  const slide = SLIDES[activeIndex];

  return (
    <View style={styles.container} testID="onboarding-screen">
      <View style={{ height: height * 0.45 }}>
        <FlatList
          ref={flatListRef}
          data={SLIDES}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          scrollEnabled={Platform.OS !== 'web'}
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
          onViewableItemsChanged={Platform.OS === 'web' ? undefined : onViewableItemsChanged}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
          renderItem={({ item }) => (
            <View style={styles.slide}>
              <View style={styles.glow} />
              <View style={styles.iconContainer}>
                <View style={styles.orbit}>
                  <View style={styles.orbitInner}>
                    <item.icon size={44} color="#FFF" strokeWidth={1.5} />
                  </View>
                </View>
                <View style={styles.pillContainer}>
                  <Text style={styles.pillText}>{item.pill}</Text>
                </View>
              </View>
            </View>
          )}
        />
      </View>

      <View style={[styles.content, { paddingBottom: Math.max(insets.bottom + 20, 60) }]}>
        <View style={styles.textStack}>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.subtitle}</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={goNext}
            activeOpacity={0.9}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {activeIndex === SLIDES.length - 1 ? 'BEGIN JOURNEY' : 'NEXT'}
            </Text>
            <ArrowRight size={18} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>

          <TouchableOpacity onPress={skip} style={styles.skipLink}>
            <Text style={styles.skipLinkText}>Skip Overview</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { width, height: height * 0.45, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbit: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFF',
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  pillContainer: {
    position: 'absolute',
    bottom: -10,
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  pillText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  content: { flex: 1, paddingHorizontal: 40, justifyContent: 'space-between' },
  textStack: { gap: 12 },
  title: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 44,
  },
  subtitle: {
    color: '#71717A',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  footer: { gap: 24 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#27272A' },
  dotActive: { width: 24, height: 6, borderRadius: 3, backgroundColor: '#FFF' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 100,
    paddingVertical: 18,
  },
  buttonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  skipLink: { alignItems: 'center' },
  skipLinkText: {
    color: '#3F3F46',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
