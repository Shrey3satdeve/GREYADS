import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, CheckCircle, CreditCard, MapPin, Minus, Plus, Shield, X } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import { COLORS, RADIUS } from '../../constants/theme';
import { rf, rs } from '../../utils/responsive';
import { useDialog } from '../../components/AppDialog';

interface EventInfo {
  id: string;
  title: string;
  date: string;
  venue: string;
  cover_image_url: string;
  price: number;
  available_tickets: number;
}

const ENABLE_MANUAL_BOOKING = process.env.EXPO_PUBLIC_ENABLE_MANUAL_BOOKING === '1';

export default function BookTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [booked, setBooked] = useState(false);
  const [ticketId, setTicketId] = useState('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();

  useEffect(() => {
    if (!id) return;
    api.get(`/events/${id}`)
      .then((data: any) => setEvent(data.event))
      .catch(() => showDialog({ title: 'Error', message: 'Failed to load event' }))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 850, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 850, useNativeDriver: true }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const handleManualBooking = async () => {
    if (!event) return;
    setBooking(true);
    try {
      const data: any = await api.post('/tickets/book', { event_id: id, quantity });
      setTicketId(data.ticket.id);
      setBooked(true);
    } catch (err: any) {
      showDialog({ title: 'Booking Failed', message: err.message || 'Something went wrong' });
    } finally {
      setBooking(false);
    }
  };

  const pollPaymentStatus = async (txnId: string, attempts = 0) => {
    if (attempts > 6) {
      showDialog({
        title: 'Payment Pending',
        message: 'Your payment is still processing. Open My Tickets in a few minutes to confirm.',
        buttons: [{ label: 'Go to Tickets', style: 'default', onPress: () => router.replace('/(tabs)/tickets') }],
      });
      return;
    }

    try {
      const statusData: any = await api.get(`/payments/status/${txnId}`);
      if (statusData.status === 'COMPLETED') {
        setTicketId(statusData.ticket_id);
        setBooked(true);
        return;
      }
      if (statusData.status === 'FAILED') {
        showDialog({ title: 'Payment Failed', message: 'Your payment was not successful. Please try again.' });
        return;
      }
    } catch {
      // Retry below.
    }

    setTimeout(() => {
      pollPaymentStatus(txnId, attempts + 1);
    }, 2500);
  };

  const handlePayment = async () => {
    if (!event) return;
    setPaying(true);
    try {
      const data: any = await api.post('/payments/initiate', {
        event_id: id,
        quantity,
        mobile: '9999999999',
        amount: grand,
      });

      // Construct the redirect URL for PhonePe Web Flow
      // Note: Real production often requires a POST, but we'll try to use UAT/Prod URL with params if supported
      const paymentUrl = data._is_real 
        ? `${data.payment_url}?request=${data.base64_request}&checksum=${data.checksum}`
        : data.payment_url;

      const result = await WebBrowser.openBrowserAsync(paymentUrl, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        showTitle: true,
        enableBarCollapsing: false,
      });

      if (result.type === 'cancel' || result.type === 'dismiss' || Platform.OS !== 'web') {
        await pollPaymentStatus(data.txn_id);
      }
    } catch (err: any) {
      showDialog({ title: 'Payment Error', message: err.message || 'Payment initiation failed' });
    } finally {
      setPaying(false);
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
        <Text style={styles.successTitle}>Booking Confirmed</Text>
        <Text style={styles.successSubtitle}>Your ticket is ready. Show the QR code at the entrance.</Text>
        <TouchableOpacity style={styles.primaryBtn} testID="view-ticket-btn" onPress={() => router.replace(`/ticket/${ticketId}`)}>
          <Text style={styles.primaryBtnText}>View My Ticket</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ghostBtn} testID="go-home-btn" onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.ghostBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const total = (event?.price || 0) * quantity;
  const fees = total > 0 ? Math.round(total * 0.05) : 0;
  const grand = total + fees;
  const allowManualBooking = !!event && (event.price <= 0 || ENABLE_MANUAL_BOOKING);

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
            <Image source={{ uri: event.cover_image_url }} style={styles.eventThumb} />
            <View style={styles.eventMeta}>
              <Text style={styles.eventName} numberOfLines={2}>{event.title}</Text>
              <View style={styles.metaRow}>
                <Calendar size={rf(12)} color={COLORS.textTertiary} />
                <Text style={styles.metaText}>
                  {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
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

        <Text style={styles.sectionLabel}>Payment Method</Text>
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.paymentBtn, paying && { opacity: 0.8 }]}
            disabled={paying || booking}
            onPress={handlePayment}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#6739B7', '#542A99']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.paymentGradient}
            >
              <View style={styles.paymentRow}>
                <View style={styles.paymentLogoWrap}>
                  <Image 
                    source={require('../../assets/images/phonepe-logo.png')} 
                    style={styles.phonepeLogo}
                    contentFit="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>Pay with PhonePe</Text>
                  <Text style={styles.paymentSub}>Safe & Secure Digital Payment</Text>
                </View>
                <View style={styles.amountBadge}>
                  <Text style={styles.amountText}>RS. {grand.toLocaleString()}</Text>
                </View>
              </View>
              
              <View style={styles.paymentDivider} />
              
              <View style={styles.paymentFooter}>
                <Shield size={rf(13)} color="rgba(255,255,255,0.7)" />
                <Text style={styles.paymentTrustText}>Encryption verified server-side</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {allowManualBooking && (
          <>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <TouchableOpacity
              style={[styles.directBtn, (booking || paying) && { opacity: 0.6 }]}
              testID="confirm-booking-btn"
              onPress={handleManualBooking}
              disabled={booking || paying}
              activeOpacity={0.85}
            >
              {booking ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <>
                  <CheckCircle size={rf(16)} color="#FFF" />
                  <Text style={styles.directBtnText}>
                    {event?.price === 0 ? 'Confirm Free Ticket' : 'Manual Booking Enabled'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        {!allowManualBooking && (
          <Text style={styles.releaseNote}>
            Direct booking is disabled for paid events in release mode.
          </Text>
        )}

        <View style={{ height: rs(120) }} />
      </ScrollView>
      {DialogComponent}
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
  paymentBtn: { borderRadius: RADIUS.xl, overflow: 'hidden', elevation: 8, shadowColor: '#542A99', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  paymentGradient: { padding: rs(18) },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  paymentLogoWrap: { width: rs(44), height: rs(44), borderRadius: rs(12), backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', padding: rs(5) },
  phonepeLogo: { width: '100%', height: '100%' },
  paymentTitle: { color: '#FFF', fontSize: rf(16), fontWeight: '800', letterSpacing: -0.2 },
  paymentSub: { color: 'rgba(255,255,255,0.7)', fontSize: rf(11), marginTop: 2, fontWeight: '500' },
  amountBadge: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: rs(12), paddingVertical: rs(6), borderRadius: RADIUS.lg },
  amountText: { color: '#FFF', fontSize: rf(15), fontWeight: '900' },
  paymentDivider: { height: 1.5, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: rs(14) },
  paymentFooter: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  paymentTrustText: { color: 'rgba(255,255,255,0.7)', fontSize: rf(11), fontWeight: '600' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: rs(12), marginVertical: rs(12) },
  orLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.textTertiary, fontSize: rf(12) },
  directBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(8), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingVertical: rs(14), borderWidth: 1, borderColor: COLORS.border },
  directBtnText: { color: COLORS.textPrimary, fontSize: rf(14), fontWeight: '700' },
  releaseNote: { color: COLORS.textTertiary, fontSize: rf(12), lineHeight: rf(18), marginTop: rs(14), textAlign: 'center' },
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
