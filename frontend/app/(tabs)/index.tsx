import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  TextInput, ActivityIndicator, RefreshControl, Animated,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, MapPin, Calendar, TrendingUp, Zap, Star } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import { COLORS, RADIUS, CATEGORY_COLORS, CATEGORY_BG, CATEGORIES, FONT_SIZE } from '../../constants/theme';
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
  const [featured, setFeatured] = useState<Event | null>(null);
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
  const featuredH = Math.min(rh(220), width * 0.55);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    fetchEvents();
  }, [category]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(heroScale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }),
    ]).start();
  }, [featured]);

  const fetchEvents = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const q = category !== 'All' ? `category=${category}` : '';
      const s = search ? `&search=${encodeURIComponent(search)}` : '';
      const data = await api.get(`/events?limit=20${q ? '&' + q : ''}${s}`);
      const evts: Event[] = data.events || [];
      setFeatured(evts[0] || null);
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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.bg }}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { fontSize: rf(12) }]}>{greeting} 👋</Text>
            <Text style={[styles.name, { fontSize: rf(22) }]} numberOfLines={1}>Hello, {firstName}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/notifications')}>
            <Zap size={rf(18)} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Search size={rf(16)} color={COLORS.textTertiary} />
            <TextInput
              testID="search-input"
              style={[styles.searchInput, { fontSize: rf(14) }]}
              value={search}
              onChangeText={setSearch}
              placeholder="Search events, venues..."
              placeholderTextColor={COLORS.textTertiary}
              returnKeyType="search"
            />
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
          <>
            {/* Featured Event — 3D Hero Card */}
            {featured && (
              <Animated.View style={{ transform: [{ scale: heroScale }], opacity: fadeAnim }}>
                <Text style={[styles.sectionTitle, { fontSize: rf(13) }]}>✨ Featured</Text>
                <TouchableOpacity
                  testID={`featured-event-${featured.id}`}
                  activeOpacity={0.92}
                  onPress={() => router.push(`/event/${featured.id}`)}
                >
                  <View style={[styles.featuredCard, { height: featuredH }]}>
                    <Image source={{ uri: featured.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.95)']}
                      locations={[0, 0.45, 1]}
                      style={StyleSheet.absoluteFill}
                    />
                    {/* Category + Live Badge */}
                    <View style={styles.featuredTopRow}>
                      <View style={[styles.catBadge, { backgroundColor: (CATEGORY_COLORS[featured.category] || '#FFF') + '20', borderColor: (CATEGORY_COLORS[featured.category] || '#FFF') + '40' }]}>
                        <Text style={[styles.catBadgeText, { color: CATEGORY_COLORS[featured.category] || '#FFF' }]}>{featured.category}</Text>
                      </View>
                      {featured.available_tickets < featured.total_tickets * 0.2 && (
                        <View style={styles.hotBadge}>
                          <TrendingUp size={rf(10)} color="#FFF" />
                          <Text style={styles.hotText}>Selling Fast</Text>
                        </View>
                      )}
                    </View>
                    {/* Bottom Info */}
                    <View style={styles.featuredBottom}>
                      <Text style={[styles.featuredTitle, { fontSize: rf(18) }]} numberOfLines={2}>{featured.title}</Text>
                      <View style={styles.featuredMeta}>
                        <View style={styles.metaItem}>
                          <Calendar size={rf(12)} color="rgba(255,255,255,0.6)" />
                          <Text style={[styles.metaText, { fontSize: rf(12) }]}>
                            {new Date(featured.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <MapPin size={rf(12)} color="rgba(255,255,255,0.6)" />
                          <Text style={[styles.metaText, { fontSize: rf(12) }]} numberOfLines={1}>{featured.venue.split(',')[0]}</Text>
                        </View>
                        <View style={styles.pricePill}>
                          <Text style={[styles.pricePillText, { fontSize: rf(13) }]}>₹{featured.price.toLocaleString()}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* All Events Grid */}
            {events.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { fontSize: rf(13), marginTop: rs(20) }]}>
                  {category === 'All' ? '🔥 All Events' : `${category} Events`}
                </Text>
                <View style={styles.grid}>
                  {events.map((evt, i) => (
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
          </>
        )}
        <View style={{ height: rs(120) }} />
      </ScrollView>
    </View>
  );
}

// Animated event card with 3D press effect
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
        {/* Cover Image */}
        <Image source={{ uri: evt.cover_image_url }} style={styles.gridCardImg} resizeMode="cover" />
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

  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: rs(20), paddingTop: rs(4), paddingBottom: rs(8) },
  greeting: { color: COLORS.textTertiary, fontWeight: '500' },
  name: { color: COLORS.textPrimary, fontWeight: '800', letterSpacing: -0.5 },
  notifBtn: { width: rs(40), height: rs(40), borderRadius: rs(20), backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },

  searchRow: { paddingHorizontal: rs(20), paddingBottom: rs(12) },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: rs(10), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingHorizontal: rs(16), paddingVertical: rs(11), borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, color: COLORS.textPrimary },

  catScroll: { marginBottom: rs(16) },
  catContent: { paddingHorizontal: rs(16), gap: rs(8), paddingBottom: rs(4) },
  catChip: { paddingHorizontal: rs(14), paddingVertical: rs(8), borderRadius: RADIUS.full, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  catText: { color: COLORS.textSecondary, fontSize: rf(13), fontWeight: '600' },

  loadWrap: { paddingVertical: rh(80), alignItems: 'center' },

  sectionTitle: { color: COLORS.textTertiary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: rs(12) },

  // Featured Card
  featuredCard: { borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: rs(4) },
  featuredTopRow: { position: 'absolute', top: rs(14), left: rs(14), right: rs(14), flexDirection: 'row', alignItems: 'center', gap: rs(8) },
  catBadge: { borderRadius: RADIUS.full, paddingHorizontal: rs(10), paddingVertical: rs(4), borderWidth: 1 },
  catBadgeText: { fontSize: rf(11), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  hotBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EF4444', borderRadius: RADIUS.full, paddingHorizontal: rs(8), paddingVertical: rs(4) },
  hotText: { color: '#FFF', fontSize: rf(10), fontWeight: '700' },
  featuredBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: rs(16) },
  featuredTitle: { color: '#FFF', fontWeight: '800', letterSpacing: -0.3, marginBottom: rs(10), lineHeight: rf(24) },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: rs(10), flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  metaText: { color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  pricePill: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: rs(10), paddingVertical: rs(3), borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  pricePillText: { color: '#FFF', fontWeight: '800' },

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
