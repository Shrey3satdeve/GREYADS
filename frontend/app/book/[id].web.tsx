import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Minus, Plus, X } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, getEventImage } from '../../constants/theme';
import { rf, rs } from '../../utils/responsive';

export default function BookTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [event, setEvent] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    api
      .get(`/events/${id}`)
      .then((data) => {
        if (mounted) setEvent(data.event);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  const total = useMemo(() => (event?.price || 0) * quantity, [event?.price, quantity]);
  const fees = total > 0 ? Math.round(total * 0.05) : 0;
  const grand = total + fees;

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="book-ticket-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Ticket</Text>
          <TouchableOpacity style={styles.closeBtn} testID="close-btn" onPress={() => router.back()}>
            <X size={rf(20)} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {event && (
          <View style={styles.eventCard}>
            <Image
              source={{ uri: getEventImage(event.cover_image_url, event.category, event.title) }}
              style={styles.eventThumb}
              contentFit="cover"
            />
            <View style={styles.eventMeta}>
              <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
              <View style={styles.metaRow}>
                <Calendar size={rf(12)} color={COLORS.textTertiary} />
                <Text style={styles.metaText}>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={styles.metaRow}>
                <MapPin size={rf(12)} color={COLORS.textTertiary} />
                <Text style={styles.metaText} numberOfLines={1}>{event.venue}</Text>
              </View>
              <Text style={styles.eventPrice}>Rs. {event.price.toLocaleString()} / ticket</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionLabel}>Tickets</Text>
        <View style={styles.qtyCard}>
          <TouchableOpacity
            style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
            testID="qty-decrease-btn"
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus size={rf(18)} color={quantity <= 1 ? COLORS.textDisabled : COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.qtyCenter}>
            <Text style={styles.qtyNum}>{quantity}</Text>
            <Text style={styles.qtyLabel}>ticket{quantity > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            style={[styles.qtyBtn, quantity >= 5 && styles.qtyBtnDisabled]}
            testID="qty-increase-btn"
            onPress={() => setQuantity(Math.min(5, quantity + 1))}
            disabled={quantity >= 5}
          >
            <Plus size={rf(18)} color={quantity >= 5 ? COLORS.textDisabled : COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>Order Summary</Text>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Ticket x {quantity}</Text>
            <Text style={styles.priceValue}>Rs. {total.toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Convenience Fee</Text>
            <Text style={styles.priceValue}>Rs. {fees.toLocaleString()}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>Rs. {grand.toLocaleString()}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} testID="confirm-booking-btn">
          <Text style={styles.primaryBtnText}>Continue to Payment</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rs(20), paddingVertical: rs(14) },
  headerTitle: { color: COLORS.textPrimary, fontSize: rf(20), fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: rs(36), height: rs(36), borderRadius: rs(18), backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  scrollContent: { padding: rs(20), paddingBottom: rs(40) },
  eventCard: { flexDirection: 'row', gap: rs(12), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(14), borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(20) },
  eventThumb: { width: rs(80), height: rs(80), borderRadius: RADIUS.md, backgroundColor: COLORS.bgTertiary },
  eventMeta: { flex: 1, gap: rs(6) },
  eventName: { color: COLORS.textPrimary, fontSize: rf(14), fontWeight: '700', letterSpacing: -0.2, flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: rs(4) },
  metaText: { color: COLORS.textSecondary, fontSize: rf(12), flex: 1 },
  eventPrice: { color: '#22C55E', fontSize: rf(13), fontWeight: '700' },
  sectionLabel: { color: COLORS.textTertiary, fontSize: rf(11), textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: rs(10), fontWeight: '700' },
  qtyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(8), borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(20) },
  qtyBtn: { width: rs(48), height: rs(48), borderRadius: rs(24), backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  qtyBtnDisabled: { opacity: 0.35 },
  qtyCenter: { alignItems: 'center', gap: rs(2) },
  qtyNum: { color: COLORS.textPrimary, fontSize: rf(30), fontWeight: '800' },
  qtyLabel: { color: COLORS.textTertiary, fontSize: rf(12) },
  priceCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(16), borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(20), gap: rs(10) },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: COLORS.textSecondary, fontSize: rf(14) },
  priceValue: { color: COLORS.textPrimary, fontSize: rf(14) },
  priceDivider: { height: 1, backgroundColor: COLORS.border },
  totalLabel: { color: COLORS.textPrimary, fontSize: rf(15), fontWeight: '700' },
  totalValue: { color: '#FFF', fontSize: rf(20), fontWeight: '800' },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingVertical: rs(16), alignItems: 'center' },
  primaryBtnText: { color: COLORS.btnPrimaryText, fontSize: rf(15), fontWeight: '700' },
});
