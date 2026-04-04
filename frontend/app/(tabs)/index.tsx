import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Animated,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Calendar, TrendingUp, Zap, Sun, CloudSun, Moon } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BrandMark from '../../components/BrandMark';
import { api } from '../../utils/api';
import { COLORS, RADIUS, CATEGORY_COLORS, CATEGORY_BG, CATEGORIES, FONT_SIZE, getCategoryImage, getEventImage } from '../../constants/theme';
import { rw, rh, rf, rs, SCREEN_W, isSmallPhone, GRID_CARD } from '../../utils/responsive';
import { useAuth } from '../../context/AuthContext';

interface Event {
  id: string; title: string; date: string; venue: string;
  cover_image_url: string; price: number; category: string;
  available_tickets: number; total_tickets: number;
}

const FIRST_NAME_MAX = 10;

export default function HomeScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Responsive card sizes based on actual screen width
  const gridCard = (width - rs(48)) / 2;

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchEvents();
  }, [category]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [events]);

  const fetchEvents = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const q = category !== 'All' ? `category=${category}` : '';
      const s = search ? `&search=${encodeURIComponent(search)}` : '';
      const data = await api.get(`/events?limit=20${q ? '&' + q : ''}${s}`);
      const evts: Event[] = data.events || [];
      setEvents(evts);
    } catch { }
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  };

  const onRefresh = useCallback(() => fetchEvents(true), [category, search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchEvents(), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const firstName = (user?.name || 'Explorer').split(' ')[0].slice(0, FIRST_NAME_MAX);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const GreetingIcon = hour < 12 ? Sun : hour < 17 ? CloudSun : Moon;

  const gridEvents = events;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
        {/* Header Section */}
        <View style={styles.premiumHeader}>
          <View style={styles.headerTop}>
            <View style={styles.logoRow}>
              <View style={styles.minimalLogoPill}>
                <BrandMark size={rs(24)} imageScale={0.8} />
                <View style={styles.logoBrandText}>
                  <Text style={styles.brandGrey}>GREY</Text>
                  <Text style={styles.brandAdz}>ADZ</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/(tabs)/notifications')}>
              <Zap size={rf(16)} color="#FFF" strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <View style={styles.greetingSection}>
            <View style={styles.greetingTextGroup}>
              <View style={styles.timeOfDayRow}>
                <GreetingIcon size={rf(10)} color={COLORS.textTertiary} strokeWidth={2.5} />
                <Text style={styles.greetingSmall}>{greeting}</Text>
              </View>
              <Text style={styles.userNameHeader} numberOfLines={1}>Hello, {firstName}</Text>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchGlass}>
              <Search size={rf(15)} color={COLORS.textTertiary} strokeWidth={2.5} />
              <TextInput
                testID="search-input"
                style={styles.searchField}
                value={search}
                onChangeText={setSearch}
                placeholder="Search events, venues..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                returnKeyType="search"
              />
            </View>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
      >
        {/* Category Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              testID={`cat-${cat}`}
              style={[styles.catChip, category === cat && {
                backgroundColor: CATEGORY_BG[cat] || 'rgba(255,255,255,0.1)',
                borderColor: (CATEGORY_COLORS[cat] || '#FFF') + '60',
              }]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.catText, category === cat && { color: CATEGORY_COLORS[cat] || '#FFF', fontWeight: '700' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadWrap}>
            <ActivityIndicator color="#FFF" size="large" />
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim }}>


            {/* ─── ALL EVENTS GRID ─── */}
            {gridEvents.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  {category === 'All' ? 'All Events' : `${category} Events`}
                </Text>
                <View style={styles.grid}>
                  {gridEvents.map((evt, i) => (
                    <EventCard
                      key={evt.id}
                      evt={evt}
                      cardWidth={gridCard}
                      onPress={() => router.push(`/event/${evt.id}`)}
                      delay={i * 60}
                    />
                  ))}
                </View>
              </>
            )}

            {events.length === 0 && !loading && (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🎪</Text>
                <Text style={[styles.emptyTitle, { fontSize: rf(18) }]}>No events found</Text>
                <Text style={[styles.emptyText, { fontSize: rf(13) }]}>Try a different category or search</Text>
              </View>
            )}
          </Animated.View>
        )}
        <View style={{ height: rs(120) }} />
      </ScrollView>
    </View>
  );
}


// ─── Smart Event Image with category fallback ─────────────────────────────
function EventImage({ uri, category, title }: { uri?: string; category: string; title: string }) {
  // getEventImage always returns Firebase Storage URL (real uploads) or correct category image
  // This fixes events with wrong Unsplash URLs stored in Firestore
  const [imgUri, setImgUri] = useState(getEventImage(uri, category, title));
  
  return (
    <Image
      source={{ uri: imgUri }}
      style={styles.gridCardImg}
      contentFit="cover"
      transition={200}
      onError={() => {
        // If image fails, force a fresh random fallback from the pool
        setImgUri(getEventImage(undefined, category, title));
      }}
    />
  );
}

// ─── Grid Event Card ─────────────────────────────────────────────────────
function EventCard({ evt, cardWidth, onPress, delay }: { evt: Event; cardWidth: number; onPress: () => void; delay: number }) {
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const cardH = cardWidth * 1.35;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const handlePressIn = () => Animated.spring(scale, { toValue: 0.96, tension: 300, friction: 10, useNativeDriver: true }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1, tension: 150, friction: 8, useNativeDriver: true }).start();

  const catColor = CATEGORY_COLORS[evt.category] || '#FFF';
  const soldPct = Math.max(0, Math.min(100, ((evt.total_tickets - evt.available_tickets) / evt.total_tickets) * 100));

  return (
    <Animated.View style={{ width: cardWidth, opacity, transform: [{ scale }] }}>
      <TouchableOpacity
        testID={`event-card-${evt.id}`}
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[styles.gridCard, { width: cardWidth, height: cardH }]}
      >
        {/* Cover Image — falls back to category image on error */}
        <EventImage uri={evt.cover_image_url} category={evt.category} title={evt.title} />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          locations={[0.4, 1]}
          style={StyleSheet.absoluteFill}
        />
        {/* Category badge */}
        <View style={[styles.gridCatBadge, { borderColor: catColor + '50', backgroundColor: catColor + '18' }]}>
          <Text style={[styles.gridCatText, { color: catColor, fontSize: rf(10) }]}>{evt.category}</Text>
        </View>
        {/* Bottom info */}
        <View style={styles.gridBottom}>
          <Text style={[styles.gridTitle, { fontSize: rf(13) }]} numberOfLines={2}>{evt.title}</Text>
          <Text style={[styles.gridDate, { fontSize: rf(11) }]}>
            {new Date(evt.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </Text>
          {/* Sold progress */}
          <View style={styles.soldWrap}>
            <View style={[styles.soldBar, { width: `${soldPct}%` as any, backgroundColor: catColor }]} />
          </View>
          <Text style={[styles.gridPrice, { fontSize: rf(13) }]}>₹{evt.price.toLocaleString()}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: rs(16) },

  premiumHeader: { paddingHorizontal: rs(20), paddingTop: rs(10), paddingBottom: rs(8) },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(18) },
  logoRow: { flex: 1 },
  minimalLogoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    alignSelf: 'flex-start',
    padding: rs(4),
    paddingRight: rs(12),
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  logoBrandText: { flexDirection: 'row', marginLeft: rs(6) },
  brandGrey: { color: '#FFF', fontSize: rf(12), fontWeight: '900', letterSpacing: 0.5 },
  brandAdz: { color: '#71717A', fontSize: rf(12), fontWeight: '900', letterSpacing: 0.5 },
  iconButton: { width: rs(36), height: rs(36), borderRadius: 18, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  greetingSection: { marginBottom: rs(20) },
  greetingTextGroup: { gap: rs(4) },
  timeOfDayRow: { flexDirection: 'row', alignItems: 'center', gap: rs(5) },
  greetingSmall: { color: COLORS.textTertiary, fontSize: rf(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  userNameHeader: { color: '#FFF', fontSize: rf(28), fontWeight: '800', letterSpacing: -0.8 },

  searchContainer: { marginBottom: rs(6) },
  searchGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rs(12),
    backgroundColor: '#111',
    borderRadius: 16,
    paddingHorizontal: rs(16),
    height: rs(52),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)'
  },
  searchField: { flex: 1, color: '#FFF', fontSize: rf(14), fontWeight: '500' },

  catScroll: { marginBottom: rs(12) },
  catContent: { paddingHorizontal: rs(20), gap: rs(8), paddingBottom: rs(4) },
  catChip: { paddingHorizontal: rs(16), paddingVertical: rs(10), borderRadius: 14, backgroundColor: '#111', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  catText: { color: 'rgba(255,255,255,0.4)', fontSize: rf(13), fontWeight: '700' },

  sectionTitle: { color: 'rgba(255,255,255,0.3)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: rs(12), fontSize: rf(11) },

  loadWrap: { paddingVertical: rh(80), alignItems: 'center' },


  // Grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: rs(12), justifyContent: 'space-between' },
  gridCard: { borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: COLORS.bgCard },
  gridCardImg: { ...StyleSheet.absoluteFillObject },
  gridCatBadge: { position: 'absolute', top: rs(10), left: rs(10), borderRadius: RADIUS.full, paddingHorizontal: rs(8), paddingVertical: rs(3), borderWidth: 1 },
  gridCatText: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  gridBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: rs(12) },
  gridTitle: { color: '#FFF', fontWeight: '700', letterSpacing: -0.2, marginBottom: rs(4), lineHeight: rf(18) },
  gridDate: { color: 'rgba(255,255,255,0.65)', fontWeight: '500', marginBottom: rs(6) },
  soldWrap: { height: 3, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, marginBottom: rs(6), overflow: 'hidden' },
  soldBar: { height: 3, borderRadius: 2 },
  gridPrice: { color: '#FFF', fontWeight: '800' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: rh(60), gap: rs(10) },
  emptyIcon: { fontSize: rf(48) },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary },
});
