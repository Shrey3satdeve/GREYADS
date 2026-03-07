import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  FlatList, Animated, ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Compass, Ticket, QrCode, ArrowRight, ChevronRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, RADIUS } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: Compass,
    iconColor: '#7C3AED',
    bg1: '#0D0010',
    bg2: '#1A0030',
    accent: '#7C3AED',
    title: 'Discover\nAmazing Events',
    subtitle: 'Explore curated events near you — music festivals, tech summits, food carnivals and more.',
    pill: 'Explore',
  },
  {
    id: '2',
    icon: Ticket,
    iconColor: '#2563EB',
    bg1: '#000A1A',
    bg2: '#001830',
    accent: '#2563EB',
    title: 'Book Tickets\nInstantly',
    subtitle: 'Seamless checkout in seconds. Secure payments, instant confirmation, zero hassle.',
    pill: 'Book',
  },
  {
    id: '3',
    icon: QrCode,
    iconColor: '#22C55E',
    bg1: '#001208',
    bg2: '#002010',
    accent: '#22C55E',
    title: 'Enter With\nYour QR Code',
    subtitle: 'Your digital ticket lives on your phone. Scan at the gate and walk right in.',
    pill: 'Enter',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]) setActiveIndex(viewableItems[0].index ?? 0);
  }).current;

  const goNext = () => {
    if (activeIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      router.replace('/(auth)/login');
    }
  };

  const skip = () => router.replace('/(auth)/login');

  const slide = SLIDES[activeIndex];

  return (
    <View style={styles.container} testID="onboarding-screen">
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <LinearGradient colors={[item.bg2, '#000000']} style={StyleSheet.absoluteFillObject} />
            {/* Decorative circle */}
            <View style={[styles.decorCircle, { borderColor: item.accent + '30' }]} />
            <View style={[styles.decorCircleInner, { backgroundColor: item.accent + '08' }]} />
            {/* Icon card */}
            <View style={[styles.iconCard, { borderColor: item.accent + '40' }]}>
              <View style={[styles.iconBg, { backgroundColor: item.accent + '15' }]}>
                <item.icon size={52} color={item.accent} strokeWidth={1.5} />
              </View>
              <View style={[styles.iconPill, { backgroundColor: item.accent + '20' }]}>
                <Text style={[styles.iconPillText, { color: item.accent }]}>{item.pill}</Text>
              </View>
            </View>
          </View>
        )}
      />

      {/* Content overlay */}
      <View style={styles.content}>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive,
                i === activeIndex && { backgroundColor: slide.accent }]}
            />
          ))}
        </View>

        {/* Actions */}
        <TouchableOpacity
          testID="onboarding-next-btn"
          style={styles.nextBtn}
          onPress={goNext}
          activeOpacity={0.85}
        >
          <Text style={styles.nextBtnText}>
            {activeIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
          </Text>
          <ArrowRight size={20} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>

        <TouchableOpacity testID="onboarding-skip-btn" onPress={skip} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  slide: { width, height: height * 0.55, alignItems: 'center', justifyContent: 'center' },
  decorCircle: {
    position: 'absolute', width: 320, height: 320, borderRadius: 160, borderWidth: 1,
    top: '10%', alignSelf: 'center',
  },
  decorCircleInner: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    top: '20%', alignSelf: 'center',
  },
  iconCard: {
    width: 180, height: 180, borderRadius: RADIUS.xl, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', gap: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconBg: {
    width: 96, height: 96, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center',
  },
  iconPill: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full,
  },
  iconPillText: { fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  content: { flex: 1, paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40 },
  title: { color: '#FFFFFF', fontSize: 36, fontWeight: '800', letterSpacing: -1, lineHeight: 42, marginBottom: 12 },
  subtitle: { color: '#A1A1AA', fontSize: 16, lineHeight: 24 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 28 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#27272A' },
  dotActive: { width: 24, height: 8, borderRadius: 4 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.full, paddingVertical: 16,
    shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5,
  },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  skipBtn: { alignItems: 'center', paddingVertical: 16 },
  skipText: { color: '#52525B', fontSize: 14, fontWeight: '500' },
});
