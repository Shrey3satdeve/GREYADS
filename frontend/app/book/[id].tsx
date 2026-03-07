import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Image, Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Plus, Minus, Calendar, MapPin, CheckCircle, CreditCard, Shield } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { api } from '../../utils/api';
import { COLORS, RADIUS } from '../../constants/theme';
import { rw, rh, rf, rs, SCREEN_W } from '../../utils/responsive';

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
  const [payingPhonePe, setPayingPhonePe] = useState(false);
  const [booked, setBooked] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`)
      .then(data => setEvent(data.event))
      .catch(() => Alert.alert('Error', 'Failed to load event'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.02, duration: 800, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Direct book (legacy/fallback)
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

  // PhonePe payment flow
  const handlePhonePePayment = async () => {
    if (!event) return;
    setPayingPhonePe(true);
    try {
      const data = await api.post('/payments/initiate', {
        event_id: id,
        quantity,
        mobile: '9999999999',
      });
      const { payment_url, txn_id, ticket_id } = data;

      // Open PhonePe in-app browser
      const result = await WebBrowser.openBrowserAsync(payment_url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        showTitle: true,
        enableBarCollapsing: false,
      });

      // After browser closes, poll for payment status
      if (result.type === 'cancel' || result.type === 'dismiss') {
        // Check payment status
        await pollPaymentStatus(txn_id, ticket_id);
      } else {
        await pollPaymentStatus(txn_id, ticket_id);
      }
    } catch (err: any) {
      Alert.alert('Payment Error', err.message || 'Payment initiation failed');
    } finally {
      setPayingPhonePe(false);
    }
  };

  const pollPaymentStatus = async (txn_id: string, ticket_id: string, attempts = 0) => {
    if (attempts > 5) {
      Alert.alert('Payment Pending', 'Your payment is being processed. Check My Tickets in a few minutes.', [
        { text: 'Go to Tickets', onPress: () => router.replace('/(tabs)/tickets') },
      ]);
      return;
    }
    try {
      const statusData = await api.get(`/payments/status/${txn_id}`);
      if (statusData.status === 'COMPLETED') {
        setTicketId(statusData.ticket_id);
        setBooked(true);
      } else if (statusData.status === 'FAILED') {
        Alert.alert('Payment Failed', 'Your payment was not successful. Please try again.');
      } else {
        // Still pending — wait and retry
        setTimeout(() => pollPaymentStatus(txn_id, ticket_id, attempts + 1), 2000);
      }
    } catch {
      setTimeout(() => pollPaymentStatus(txn_id, ticket_id, attempts + 1), 2000);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  if (booked) {
    return (
      <View style={styles.successWrap} testID="booking-success-screen">
        <View style={styles.successBg}>
          <View style={styles.successIcon}>
            <CheckCircle size={rf(52)} color={COLORS.success} strokeWidth={1.5} />
          </View>
        </View>
        <Text style={styles.successTitle}>Booking Confirmed! 🎉</Text>
        <Text style={styles.successSubtitle}>Your ticket is ready. Show QR code at the entrance.</Text>
        <TouchableOpacity testID="view-ticket-btn" style={styles.primaryBtn} onPress={() => router.replace(`/ticket/${ticketId}`)}>
          <Text style={styles.primaryBtnText}>View My Ticket & QR</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="go-home-btn" onPress={() => router.replace('/(tabs)/')} style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = (event?.price || 0) * quantity;
  const fees = Math.round(total * 0.05);
  const grand = total + fees;

  return (
    <View style={styles.container} testID="book-ticket-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Book Ticket</Text>
          <TouchableOpacity testID="close-btn" style={styles.closeBtn} onPress={() => router.back()}>
            <X size={rf(20)} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Event Preview */}
        {event && (
          <View style={styles.eventCard}>
            <Image source={{ uri: event.cover_image_url }} style={styles.eventThumb} />
            <View style={{ flex: 1, gap: rs(6) }}>
              <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
              <View style={styles.metaRow}>
                <Calendar size={rf(12)} color={COLORS.textTertiary} />
                <Text style={styles.metaText}>{new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <View style={styles.metaRow}>
                <MapPin size={rf(12)} color={COLORS.textTertiary} />
                <Text style={styles.metaText} numberOfLines={1}>{event.venue}</Text>
              </View>
              <Text style={styles.eventPrice}>₹{event.price.toLocaleString()} / ticket</Text>
            </View>
          </View>
        )}

        {/* Quantity */}
        <Text style={styles.sectionLabel}>Tickets</Text>
        <View style={styles.qtyCard}>
          <TouchableOpacity
            testID="qty-decrease-btn"
            style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
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
            testID="qty-increase-btn"
            style={[styles.qtyBtn, quantity >= 5 && styles.qtyBtnDisabled]}
            onPress={() => setQuantity(Math.min(5, quantity + 1))}
            disabled={quantity >= 5}
          >
            <Plus size={rf(18)} color={quantity >= 5 ? COLORS.textDisabled : COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Price Breakdown */}
        <Text style={styles.sectionLabel}>Order Summary</Text>
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Ticket × {quantity}</Text>
            <Text style={styles.priceValue}>₹{total.toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Convenience Fee (5%)</Text>
            <Text style={styles.priceValue}>₹{fees.toLocaleString()}</Text>
          </View>
          <View style={styles.priceDivider} />
          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>₹{grand.toLocaleString()}</Text>
          </View>
        </View>

        {/* Payment Options */}
        <Text style={styles.sectionLabel}>Payment Method</Text>

        {/* PhonePe Payment - PRIMARY */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            testID="phonepe-pay-btn"
            style={[styles.phonePeBtn, payingPhonePe && { opacity: 0.8 }]}
            onPress={handlePhonePePayment}
            disabled={payingPhonePe || booking}
            activeOpacity={0.88}
          >
            <View style={styles.phonePeInner}>
              {payingPhonePe ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <View style={styles.phonePeLogo}>
                  <Text style={styles.phonePeLogoP}>P</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.phonePeTitle}>Pay with PhonePe</Text>
                <Text style={styles.phonePeSub}>UPI · Cards · Net Banking · Wallets</Text>
              </View>
              <View style={styles.phonePeAmount}>
                <Text style={styles.phonePeAmtText}>₹{grand.toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.phonePeFooter}>
              <Shield size={rf(11)} color="rgba(255,255,255,0.6)" />
              <Text style={styles.phonePeSecure}>Secured by PhonePe · 100% Safe</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Divider */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        {/* Direct Book (Free/Demo) */}
        <TouchableOpacity
          testID="confirm-booking-btn"
          style={[styles.directBtn, (booking || payingPhonePe) && { opacity: 0.6 }]}
          onPress={handleBook}
          disabled={booking || payingPhonePe}
          activeOpacity={0.8}
        >
          {booking ? <ActivityIndicator color="#FFF" size="small" /> : <>
            <CreditCard size={rf(16)} color="#FFF" />
            <Text style={styles.directBtnText}>Reserve Without Payment (Demo)</Text>
          </>}
        </TouchableOpacity>

        <View style={{ height: rs(120) }} />
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

  // PhonePe Button
  phonePeBtn: {
    backgroundColor: '#5F259F',
    borderRadius: RADIUS.xl, padding: rs(16),
    marginBottom: rs(12),
    overflow: 'hidden',
  },
  phonePeInner: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginBottom: rs(10) },
  phonePeLogo: {
    width: rs(40), height: rs(40), borderRadius: rs(20),
    backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center',
  },
  phonePeLogoP: { color: '#5F259F', fontSize: rf(20), fontWeight: '900' },
  phonePeTitle: { color: '#FFF', fontSize: rf(16), fontWeight: '800' },
  phonePeSub: { color: 'rgba(255,255,255,0.65)', fontSize: rf(11), marginTop: 2 },
  phonePeAmount: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: RADIUS.full, paddingHorizontal: rs(12), paddingVertical: rs(6) },
  phonePeAmtText: { color: '#FFF', fontSize: rf(15), fontWeight: '800' },
  phonePeFooter: { flexDirection: 'row', alignItems: 'center', gap: rs(5), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.15)', paddingTop: rs(10) },
  phonePeSecure: { color: 'rgba(255,255,255,0.6)', fontSize: rf(11) },

  orRow: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginVertical: rs(8) },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.textTertiary, fontSize: rf(12) },

  directBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingVertical: rs(14), borderWidth: 1, borderColor: COLORS.border },
  directBtnText: { color: COLORS.textSecondary, fontSize: rf(14), fontWeight: '600' },

  // Success
  successWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: rs(32), gap: rs(12) },
  successBg: { width: rs(100), height: rs(100), borderRadius: rs(50), backgroundColor: COLORS.success + '12', alignItems: 'center', justifyContent: 'center', marginBottom: rs(8) },
  successIcon: { width: rs(80), height: rs(80), borderRadius: rs(40), backgroundColor: COLORS.success + '20', alignItems: 'center', justifyContent: 'center' },
  successTitle: { color: COLORS.textPrimary, fontSize: rf(24), fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  successSubtitle: { color: COLORS.textSecondary, fontSize: rf(14), textAlign: 'center', lineHeight: rf(22) },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: rs(32), paddingVertical: rs(14), width: '100%', alignItems: 'center', marginTop: rs(8) },
  primaryBtnText: { color: COLORS.btnPrimaryText, fontSize: rf(16), fontWeight: '700' },
  ghostBtn: { paddingVertical: rs(12) },
  ghostBtnText: { color: COLORS.textSecondary, fontSize: rf(14) },
});
