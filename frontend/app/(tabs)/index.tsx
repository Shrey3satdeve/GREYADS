import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  FlatList, Image, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Bell, MapPin, Calendar, Megaphone } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, CATEGORY_COLORS, CATEGORY_BG, CATEGORIES, RADIUS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');
const CARD_W = width - 40;

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  venue: string;
  cover_image_url: string;
  category: string;
  price: number;
  currency: string;
  available_tickets: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function EventCard({ event, onPress, featured }: { event: Event; onPress: () => void; featured?: boolean }) {
  const catColor = CATEGORY_COLORS[event.category] || '#FFF';
  if (featured) {
    return (
      <TouchableOpacity testID={`featured-event-${event.id}`} onPress={onPress} activeOpacity={0.9} style={styles.featuredCard}>
        <Image source={{ uri: event.cover_image_url }} style={styles.featuredImg} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.featuredGrad} />
        <View style={styles.featuredContent}>
          <View style={[styles.catChip, { backgroundColor: catColor + '25', borderColor: catColor + '60' }]}>
            <Text style={[styles.catChipText, { color: catColor }]}>{event.category}</Text>
          </View>
          <Text style={styles.featuredTitle} numberOfLines={2}>{event.title}</Text>
          <View style={styles.featuredMeta}>
            <MapPin size={12} color={COLORS.textSecondary} />
            <Text style={styles.featuredMetaText} numberOfLines={1}>{event.venue}</Text>
          </View>
          <View style={styles.featuredBottom}>
            <View style={styles.featuredMeta}>
              <Calendar size={12} color={COLORS.textSecondary} />
              <Text style={styles.featuredMetaText}>{formatDate(event.date)}</Text>
            </View>
            <View style={styles.priceChip}>
              <Text style={styles.priceText}>₹{event.price.toLocaleString()}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity testID={`event-card-${event.id}`} onPress={onPress} activeOpacity={0.9} style={styles.card}>
      <Image source={{ uri: event.cover_image_url }} style={styles.cardImg} />
      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.cardGrad} />
      <View style={[styles.catBadge, { backgroundColor: catColor + '20', borderColor: catColor + '50' }]}>
        <Text style={[styles.catBadgeText, { color: catColor }]}>{event.category}</Text>
      </View>
      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        <View style={styles.cardMeta}>
          <MapPin size={11} color={COLORS.textSecondary} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{event.venue}</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{formatDate(event.date)}</Text>
          <Text style={styles.cardPrice}>₹{event.price.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filtered, setFiltered] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const { user } = useAuth();
  const router = useRouter();

  const loadEvents = useCallback(async () => {
    try {
      // Seed if needed
      await api.post('/seed', {}, false).catch(() => {});
      const data = await api.get('/events?limit=20');
      setEvents(data.events || []);
      setFiltered(data.events || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadEvents(); }, []);

  useEffect(() => {
    let list = events;
    if (activeCategory !== 'All') list = list.filter(e => e.category === activeCategory);
    if (search) list = list.filter(e => e.title.toLowerCase().includes(search.toLowerCase()) || e.venue.toLowerCase().includes(search.toLowerCase()));
    setFiltered(list);
  }, [search, activeCategory, events]);

  const onRefresh = useCallback(() => { setRefreshing(true); loadEvents(); }, []);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="home-screen">
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={styles.iconRing}><Megaphone size={18} color="#FFF" strokeWidth={2} /></View>
            <View>
              <Text style={styles.logoText}>Grey<Text style={{ color: '#A1A1AA' }}>Adz</Text>.</Text>
              <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'there'} 👋</Text>
            </View>
          </View>
          <TouchableOpacity testID="notifications-btn" onPress={() => router.push('/(tabs)/notifications')} style={styles.bellBtn}>
            <Bell size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <Search size={16} color={COLORS.textTertiary} style={{ marginLeft: 12 }} />
          <TextInput
            testID="event-search-input"
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search events, venues..."
            placeholderTextColor={COLORS.textTertiary}
          />
        </View>
      </SafeAreaView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              testID={`category-${cat}`}
              style={[styles.catBtn, activeCategory === cat && styles.catBtnActive,
                activeCategory === cat && { backgroundColor: CATEGORY_COLORS[cat] || '#FFF', borderColor: CATEGORY_COLORS[cat] || '#FFF' }]}
              onPress={() => setActiveCategory(cat)}
              activeOpacity={0.8}
            >
              <Text style={[styles.catBtnText, activeCategory === cat && { color: cat === 'All' ? '#000' : '#FFF', fontWeight: '700' }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No events found</Text>
          </View>
        ) : (
          <>
            {/* Featured Event */}
            {filtered.length > 0 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Featured</Text>
                </View>
                <View style={{ paddingHorizontal: 20 }}>
                  <EventCard
                    event={filtered[0]}
                    onPress={() => router.push(`/event/${filtered[0].id}`)}
                    featured
                  />
                </View>
              </>
            )}

            {/* All Events */}
            {filtered.length > 1 && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>All Events</Text>
                  <Text style={styles.sectionCount}>{filtered.length - 1}</Text>
                </View>
                <View style={styles.cardGrid}>
                  {filtered.slice(1).map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onPress={() => router.push(`/event/${event.id}`)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
        {/* Bottom padding for tab bar */}
        <View style={{ height: 110 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  safeTop: { backgroundColor: COLORS.bg },
  loadingWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  greeting: { color: COLORS.textTertiary, fontSize: 12, marginTop: 1 },
  bellBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14, paddingVertical: 12, paddingRight: 12 },
  scrollContent: { paddingTop: 4 },
  catScroll: { marginBottom: 4 },
  catBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  catBtnActive: { borderColor: 'transparent' },
  catBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  sectionCount: { color: COLORS.textTertiary, fontSize: 13 },
  featuredCard: { height: 260, borderRadius: RADIUS.xl, overflow: 'hidden', marginBottom: 4 },
  featuredImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  featuredGrad: { ...StyleSheet.absoluteFillObject },
  featuredContent: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, gap: 6 },
  featuredTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredMetaText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  featuredBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  priceChip: { backgroundColor: '#FFF', borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  priceText: { color: '#000', fontSize: 13, fontWeight: '800' },
  catChip: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1, marginBottom: 4 },
  catChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardGrid: { paddingHorizontal: 20, gap: 12 },
  card: { height: 200, borderRadius: RADIUS.xl, overflow: 'hidden' },
  cardImg: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  cardGrad: { ...StyleSheet.absoluteFillObject },
  catBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, borderWidth: 1 },
  catBadgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12, gap: 3 },
  cardTitle: { color: '#FFF', fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardMetaText: { color: COLORS.textSecondary, fontSize: 11, flex: 1 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  cardDate: { color: COLORS.textTertiary, fontSize: 11 },
  cardPrice: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48 },
  emptyText: { color: COLORS.textTertiary, fontSize: 16 },
});
