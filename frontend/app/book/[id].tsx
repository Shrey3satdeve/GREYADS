import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Minus, Calendar, MapPin, CheckCircle } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface EventInfo {
  id: string;
  title: string;
  date: string;
  venue: string;
  cover_image_url: string;
  price: number;
  available_tickets: number;
}

export default function BookTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`)
      .then(data => setEvent(data.event))
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBook = async () => {
    if (!event) return;
    setBooking(true);
    try {
      const data = await api.post('/tickets/book', { event_id: id, quantity });
      setTicketId(data.ticket.id);
      setBooked(true);
    } catch (err: any) {
      Alert.alert('Booking Failed', err.message || 'Something went wrong');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#FFF" />
      </View>
    );
  }

  if (booked) {
    return (
      <View style={styles.successWrap} testID="booking-success-screen">
        <View style={styles.successIcon}>
          <CheckCircle size={56} color={COLORS.success} strokeWidth={1.5} />
        </View>
        <Text style={styles.successTitle}>Booking Confirmed!</Text>
        <Text style={styles.successSubtitle}>Your ticket is ready. Show QR code at entry.</Text>
        <TouchableOpacity
          testID="view-ticket-btn"
          style={styles.primaryBtn}
          onPress={() => router.replace(`/ticket/${ticketId}`)}
        >
          <Text style={styles.primaryBtnText}>View My Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="go-home-btn" onPress={() => router.replace('/(tabs)/')} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = (event?.price || 0) * quantity;
  const fees = Math.round(total * 0.05);

  return (
    <View style={styles.container} testID="book-ticket-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Ticket</Text>
          <TouchableOpacity testID="close-btn" style={styles.closeBtn} onPress={() => router.back()}>
            <X size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 140 }}>
        {/* Event Preview */}
        {event && (
          <View style={styles.eventCard}>
            <Image source={{ uri: event.cover_image_url }} style={styles.eventThumb} />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
              <View style={styles.metaRow}>
                <Calendar size={12} color={COLORS.textTertiary} />
                <Text style={styles.metaText}>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={styles.metaRow}>
                <MapPin size={12} color={COLORS.textTertiary} />
                <Text style={styles.metaText} numberOfLines={1}>{event.venue}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Quantity */}
        <Text style={styles.sectionLabel}>Number of Tickets</Text>
        <View style={styles.qtyCard}>
          <TouchableOpacity
            testID="qty-decrease-btn"
            style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
          >
            <Minus size={18} color={quantity <= 1 ? COLORS.textDisabled : COLORS.textPrimary} />
          </TouchableOpacity>
          <View style={styles.qtyValue}>
            <Text style={styles.qtyNum}>{quantity}</Text>
            <Text style={styles.qtyLabel}>ticket{quantity > 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity
            testID="qty-increase-btn"
            style={[styles.qtyBtn, quantity >= 5 && styles.qtyBtnDisabled]}
            onPress={() => setQuantity(Math.min(5, quantity + 1))}
            disabled={quantity >= 5}
          >
            <Plus size={18} color={quantity >= 5 ? COLORS.textDisabled : COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Price Breakdown */}
        <Text style={styles.sectionLabel}>Price Breakdown</Text>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Ticket × {quantity}</Text>
            <Text style={styles.priceValue}>₹{total.toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Convenience Fee</Text>
            <Text style={styles.priceValue}>₹{fees.toLocaleString()}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{(total + fees).toLocaleString()}</Text>
          </View>
        </View>

        {/* Payment note */}
        <View style={styles.noteCard}>
          <Text style={styles.noteText}>🔒  Demo mode — no real payment required</Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerLabel}>Total Amount</Text>
          <Text style={styles.footerTotal}>₹{(total + fees).toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          testID="confirm-booking-btn"
          style={[styles.confirmBtn, booking && { opacity: 0.7 }]}
          onPress={handleBook}
          disabled={booking}
          activeOpacity={0.85}
        >
          {booking ? <ActivityIndicator color="#000" /> : <Text style={styles.confirmBtnText}>Confirm Booking</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  eventCard: { flexDirection: 'row', gap: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  eventThumb: { width: 70, height: 70, borderRadius: RADIUS.md, backgroundColor: COLORS.bgTertiary },
  eventName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  sectionLabel: { color: COLORS.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, fontWeight: '600' },
  qtyCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 8, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24 },
  qtyBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  qtyBtnDisabled: { opacity: 0.4 },
  qtyValue: { alignItems: 'center', gap: 2 },
  qtyNum: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800' },
  qtyLabel: { color: COLORS.textTertiary, fontSize: 12 },
  priceCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14, gap: 10 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: COLORS.textSecondary, fontSize: 14 },
  priceValue: { color: COLORS.textPrimary, fontSize: 14 },
  priceDivider: { height: 1, backgroundColor: COLORS.border },
  totalLabel: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  totalValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  noteCard: { backgroundColor: '#1A2500', borderRadius: RADIUS.md, padding: 12, borderWidth: 1, borderColor: '#2A3800' },
  noteText: { color: '#7CBF00', fontSize: 13 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 36, backgroundColor: COLORS.bgSecondary, borderTopWidth: 1, borderTopColor: COLORS.border },
  footerLabel: { color: COLORS.textTertiary, fontSize: 11, marginBottom: 2 },
  footerTotal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  confirmBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 14, shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 15, elevation: 5 },
  confirmBtnText: { color: COLORS.btnPrimaryText, fontSize: 15, fontWeight: '700' },
  successWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.success + '15', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  successSubtitle: { color: COLORS.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: 32, paddingVertical: 14, width: '100%', alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: COLORS.btnPrimaryText, fontSize: 16, fontWeight: '700' },
  ghostBtn: { paddingVertical: 12 },
  ghostBtnText: { color: COLORS.textSecondary, fontSize: 14 },
});
