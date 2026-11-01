import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, MapPin } from 'lucide-react-native';
import { api } from '../utils/api';
import { COLORS, RADIUS, getEventImage } from '../constants/theme';
import { rf, rs } from '../utils/responsive';

export default function WishlistScreen() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadWishlist = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await api.get('/wishlist/my');
      setEvents(data.events || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
          <ArrowLeft size={rf(18)} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Wishlist</Text>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{events.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadWishlist(true)} tintColor="#FFF" />}
          showsVerticalScrollIndicator={false}
        >
          {events.length === 0 ? (
            <View style={styles.center}>
              <Heart size={48} color={COLORS.textTertiary} strokeWidth={1.2} />
              <Text style={styles.emptyTitle}>No wishlist events yet</Text>
              <Text style={styles.emptyText}>Tap the heart on any event to save it here.</Text>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.card}
                onPress={() => router.push(`/event/${event.id}` as any)}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: getEventImage(event.cover_image_url, event.category, event.title) }}
                  style={styles.image}
                  contentFit="cover"
                  transition={150}
                />
                <View style={styles.meta}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
                  <Text style={styles.cardDate}>
                    {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </Text>
                  <View style={styles.venueRow}>
                    <MapPin size={12} color={COLORS.textTertiary} />
                    <Text style={styles.venue} numberOfLines={1}>{event.venue}</Text>
                  </View>
                  <Text style={styles.price}>Rs. {Number(event.price || 0).toLocaleString()}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: rs(20), paddingVertical: rs(16) },
  iconBtn: { width: rs(36), height: rs(36), borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border },
  title: { flex: 1, color: COLORS.textPrimary, fontSize: rf(22), fontWeight: '800' },
  countPill: { minWidth: rs(34), paddingHorizontal: rs(10), paddingVertical: rs(6), borderRadius: 999, backgroundColor: COLORS.bgCard, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  countText: { color: COLORS.textPrimary, fontSize: rf(12), fontWeight: '700' },
  scroll: { padding: rs(20), gap: rs(12), paddingBottom: rs(110) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: rs(12), padding: rs(32) },
  emptyTitle: { color: COLORS.textPrimary, fontSize: rf(18), fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontSize: rf(14), textAlign: 'center' },
  card: { flexDirection: 'row', gap: rs(14), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(14), borderWidth: 1, borderColor: COLORS.border },
  image: { width: rs(88), height: rs(104), borderRadius: 16, backgroundColor: COLORS.bgTertiary },
  meta: { flex: 1, justifyContent: 'space-between' },
  cardTitle: { color: COLORS.textPrimary, fontSize: rf(15), fontWeight: '700', lineHeight: rf(22) },
  cardDate: { color: COLORS.textSecondary, fontSize: rf(12), fontWeight: '600' },
  venueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  venue: { color: COLORS.textTertiary, fontSize: rf(12), flex: 1 },
  price: { color: COLORS.textPrimary, fontSize: rf(16), fontWeight: '800' },
});
