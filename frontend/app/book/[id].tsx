import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  TextInput,
  Image as RNImage,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, CheckCircle, CreditCard, MapPin, Minus, Plus, Shield, X } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../../utils/api';
import { COLORS, RADIUS, getEventImage } from '../../constants/theme';
import { rf, rs } from '../../utils/responsive';
import { useAuth } from '../../context/AuthContext';
import { useDialog } from '../../components/AppDialog';
import RazorpayCheckout from 'react-native-razorpay';
import { ensureProtectedFirebaseServicesReady, functions } from '../../utils/firebase';

interface EventInfo {
  id: string;
  title: string;
  date: string;
  venue: string;
  cover_image_url: string;
  category: string;
  price: number;
  available_tickets: number;
}

const ENABLE_MANUAL_BOOKING = process.env.EXPO_PUBLIC_ENABLE_MANUAL_BOOKING === '1';
const ENABLE_PAYMENT_QA = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_PAYMENT_QA === '1';
const ALLOW_APPCHECK_FAILURE_FOR_BOOKING = true;
const GREYADZ_RAZORPAY_LOGO = RNImage.resolveAssetSource(
  require('../../assets/images/icon.png')
).uri;

export default function BookTicketScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const [event, setEvent] = useState<EventInfo | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [paying, setPaying] = useState(false);
  const [processingLabel, setProcessingLabel] = useState('');
  const [booked, setBooked] = useState(false);
  const [ticketId, setTicketId] = useState('');
  // removed redundant razorpayData and showRazorpay states
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const { showDialog, DialogComponent } = useDialog();
  const [guests, setGuests] = useState<Array<{ name: string, age: string }>>([{ name: user?.name || '', age: '' }]);
  const eventId = Array.isArray(id) ? String(id[0] || '').trim() : String(id || '').trim();

  // Sync guests array with quantity
  useEffect(() => {
    setGuests(prev => {
      const next = [...prev];
      if (next.length < quantity) {
        for (let i = next.length; i < quantity; i++) {
          next.push({ name: '', age: '' });
        }
      } else if (next.length > quantity) {
        return next.slice(0, quantity);
      }
      return next;
    });
  }, [quantity]);

  const updateGuest = (index: number, field: 'name' | 'age', value: string) => {
    const next = [...guests];
    next[index] = { ...next[index], [field]: value };
    setGuests(next);
  };

  const isFormValid = ENABLE_PAYMENT_QA
    ? guests.every(g => g.name.trim().length > 2)
    : guests.every(g => g.name.trim().length > 2 && g.age.trim().length > 0);

  const isPlayStoreUpdateRequiredError = (error: any) => {
    const combined = `${String(error?.code || '')} ${String(error?.message || '')}`.toLowerCase();

    return (
      combined.includes('play-store-outdated') ||
      combined.includes('play_store_version_outdated') ||
      combined.includes('integrity api error (-14)') ||
      combined.includes('integrityserviceexception: -14') ||
      combined.includes('play store is outdated') ||
      combined.includes('play store needs to be updated')
    );
  };

  const isUpiAppMissingError = (error: any) => {
    const combined = `${String(error?.code || '')} ${String(error?.message || '')} ${String(error?.description || '')}`.toLowerCase();

    return (
      combined.includes('app not installed') ||
      combined.includes('application not installed') ||
      combined.includes('activity not found') ||
      combined.includes('no activity found') ||
      combined.includes('no app found') ||
      combined.includes('could not find') ||
      combined.includes('installed app') ||
      combined.includes('upi app')
    );
  };

  const normalizeContact = (value?: string | null) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return '';
  };

  const openPlayStoreUpdate = async () => {
    const marketUrl = 'market://details?id=com.android.vending';
    const webUrl = 'https://support.google.com/googleplay/answer/15747876?hl=en';

    try {
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
    } catch {
      try {
        await Linking.openURL(webUrl);
      } catch {
        showDialog({
          title: 'Update Required',
          message: 'Please open Google Play Store manually, update it, and then retry your payment.',
        });
      }
    }
  };

  useEffect(() => {
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      setEvent(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const decodedEventId = decodeURIComponent(eventId);
    const candidateIds = Array.from(new Set([eventId, decodedEventId].filter(Boolean)));

    (async () => {
      try {
        for (const candidateId of candidateIds) {
          const data: any = await api.get(`/events/${candidateId}`);
          if (data?.event?.id) {
            setEvent(data.event);
            return;
          }
        }

        setEvent(null);
        showDialog({
          title: 'Event Not Found',
          message: 'This event link looks outdated. Please reopen the event from Home and try again.',
        });
      } catch {
        setEvent(null);
        showDialog({ title: 'Error', message: 'Failed to load event' });
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId, showDialog]);

  useEffect(() => {
    if (__DEV__) {
      return;
    }

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
    if (!event || !isFormValid) return;
    setBooking(true);
    setProcessingLabel('Creating your booking...');
    try {
      const data: any = await api.post('/tickets/book', { event_id: eventId, quantity, guests });
      setTicketId(data.ticket.id);
      setBooked(true);
    } catch (err: any) {
      showDialog({ title: 'Booking Failed', message: err.message || 'Something went wrong' });
    } finally {
      setBooking(false);
      setProcessingLabel('');
    }
  };

  const getPaymentErrorMessage = (error: any) => {
    const code = String(error?.code || '').toLowerCase();
    const rawMessage = String(error?.message || '').trim();
    const combined = `${code} ${rawMessage}`.toLowerCase();

    if (isPlayStoreUpdateRequiredError(error)) {
      return 'Google Play Store is outdated on this device. Update Play Store, reopen the app, and retry your payment.';
    }

    if (combined.includes('unauthenticated') || combined.includes('sign in again')) {
      return 'Your session expired before payment started. Please sign in again and retry.';
    }

    if (
      combined.includes('app check') ||
      combined.includes('appcheck') ||
      combined.includes('attestation') ||
      combined.includes('play integrity') ||
      combined.includes('app verification') ||
      combined.includes('integrityserviceexception')
    ) {
      return __DEV__
        ? 'This debug build is not trusted by Firebase App Check yet. Add the App Check debug token, restart the app, and retry payment.'
        : 'This app build could not be verified. Please install the latest official build and try again.';
    }

    if (isUpiAppMissingError(error)) {
      return 'Selected UPI app is not available on this phone. Retry and choose another payment method or another installed UPI app.';
    }

    return rawMessage || 'Payment initiation failed';
  };

  const redirectToLogin = () => {
    const redirect = encodeURIComponent(`/book/${String(eventId || '')}`);
    router.replace(`/(auth)/login?redirect=${redirect}` as any);
  };

  const handlePayment = async () => {
    if (!event) return;
    if (authLoading) {
      showDialog({ title: 'Please Wait', message: 'We are still restoring your secure session. Try payment again in a moment.' });
      return;
    }

    if (!token) {
      showDialog({ title: 'Login Required', message: 'Please sign in again before making a payment.' });
      redirectToLogin();
      return;
    }

    setPaying(true);
    setProcessingLabel('Preparing secure payment...');
    let activeOrderId: string | null = null;
    try {
      console.log('[handlePayment] Starting payment initiation:', {
        event_id: eventId,
        quantity,
        guest_count: guests.length,
      });

      await ensureProtectedFirebaseServicesReady({ allowAppCheckFailure: ALLOW_APPCHECK_FAILURE_FOR_BOOKING || ENABLE_PAYMENT_QA });

      let data: any;
      try {
        data = await Promise.race([
          api.post('/payments/initiate', {
            event_id: eventId,
            quantity,
            guests,
          }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Payment initiation timed out. Please retry.')), 20000);
          }),
        ]) as any;
      } catch (initError: any) {
        console.error('[handlePayment] Payment initiate failed:', initError);
        throw initError;
      }

      console.log('[handlePayment] Payment initiation response received');
      activeOrderId = data?.order_id || null;

      if (!data?.order_id) {
        throw new Error('Payment order was not created. Please try again.');
      }

      console.log('[handlePayment] Order initiated:', data);
      setProcessingLabel('Opening Razorpay checkout...');

      const options: any = {
        description: `Booking for ${event.title}`,
        image: GREYADZ_RAZORPAY_LOGO,
        currency: (data as any).currency || 'INR',
        key: (data as any).key_id,
        amount: (data as any).amount,
        name: 'GreyAdz',
        prefill: {
          email: user?.email || '',
          contact: normalizeContact(user?.phone),
          name: user?.name || '',
        },
        retry: { enabled: true, max_count: 1 },
        send_sms_hash: true,
        theme: { color: '#000000' }
      };

      if ((data as any).order_id) {
        options.order_id = (data as any).order_id;
      }

      console.log('[handlePayment] Opening Razorpay with options:', JSON.stringify(options, null, 2));

      const result: any = await RazorpayCheckout.open(options);
      console.log('[handlePayment] Razorpay SUCCESS:', result);
      setProcessingLabel('Verifying payment and generating ticket...');

      try {
        const res = await api.post('/payments/verify', {
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_signature: result.razorpay_signature,
        });

        console.log('[handlePayment] Verification result:', res);

        if ((res as any).success && (res as any).ticket_id) {
          router.replace(`/ticket/${(res as any).ticket_id}`);
        } else if ((res as any).status === 'PENDING') {
          router.replace(`/payment-result?txn_id=${result.razorpay_order_id}`);
        } else {
          throw new Error('Verification failed');
        }
      } catch (error: any) {
        console.error('[handlePayment] Verification ERROR:', error);
        router.replace(`/payment-result?txn_id=${result.razorpay_order_id}`);
      }
    } catch (err: any) {
      if (err?.razorpay_payment_id || err?.razorpay_order_id || err?.razorpay_signature) {
        console.error('[handlePayment] Unexpected success payload reached outer catch:', err);
        router.replace(`/payment-result?txn_id=${err.razorpay_order_id}`);
        return;
      }

      const isCheckoutError = activeOrderId && (typeof err?.code !== 'undefined' || typeof err?.description !== 'undefined');
      if (isCheckoutError) {
        const error = err;
        console.error('[handlePayment] Razorpay ERROR:', error);
        const isCancelled = error?.code === 0 || String(error?.description || '').toLowerCase().includes('cancel');
        const message = error.description || 'Payment was not completed';

        const handleCancelledOrder = async () => {
          if (!activeOrderId) {
            return false;
          }

          try {
            const cancelFn = functions.httpsCallable('cancelPaymentOrder');
            const cancelResult: any = await cancelFn({ reference_id: activeOrderId });
            const cancelData = cancelResult?.data || {};

            if (cancelData.status === 'COMPLETED' && cancelData.ticket_id) {
              router.replace(`/ticket/${cancelData.ticket_id}`);
              return true;
            }

            if (cancelData.status === 'PENDING') {
              router.replace(`/payment-result?txn_id=${activeOrderId}`);
              return true;
            }
          } catch (cancelError) {
            console.error('[handlePayment] cancelPaymentOrder ERROR:', cancelError);
          }

          return false;
        };

        const handled = await handleCancelledOrder();
        if (!handled) {
          const paymentMessage = getPaymentErrorMessage({ ...error, message });
          showDialog({
            title: isCancelled ? 'Payment Cancelled' : isUpiAppMissingError(error) ? 'UPI App Not Available' : 'Payment Failed',
            message: paymentMessage,
            buttons: isPlayStoreUpdateRequiredError(error)
              ? [
                { label: 'Cancel', style: 'cancel' },
                { label: 'Update Play Store', onPress: () => { void openPlayStoreUpdate(); } },
              ]
              : undefined,
          });
        }
      } else {
        const message = getPaymentErrorMessage(err);
        const isSessionIssue = message.toLowerCase().includes('sign in again');
        showDialog({
          title: isSessionIssue ? 'Session Expired' : 'Payment Error',
          message,
          buttons: isPlayStoreUpdateRequiredError(err)
            ? [
              { label: 'Cancel', style: 'cancel' },
              { label: 'Update Play Store', onPress: () => { void openPlayStoreUpdate(); } },
            ]
            : undefined,
        });
        if (isSessionIssue) {
          redirectToLogin();
        }
      }
    } finally {
      setPaying(false);
      setProcessingLabel('');
    }
  };

  // Removed onRazorpayMessage and razorpayHtml strings

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
  const allowManualBooking = !!event && (event.price <= 0 || (ENABLE_MANUAL_BOOKING && user?.role === 'admin'));

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
            <ExpoImage
              source={{ uri: getEventImage(event.cover_image_url, event.category, event.title) }}
              style={styles.eventThumb}
              contentFit="cover"
              transition={200}
            />
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

        <Text style={styles.sectionLabel}>Guest Security Details</Text>
        <View style={styles.guestsContainer}>
          {guests.map((guest, index) => (
            <View key={index} style={styles.guestCard}>
              <View style={styles.guestHeader}>
                <Shield size={rf(14)} color={COLORS.textTertiary} />
                <Text style={styles.guestTitle}>Guest {index + 1} {index === 0 ? '(Primary)' : ''}</Text>
              </View>
              <View style={styles.guestInputs}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Full Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter name"
                    placeholderTextColor={COLORS.textDisabled}
                    value={guest.name}
                    onChangeText={(val) => updateGuest(index, 'name', val)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Age</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="21"
                    placeholderTextColor={COLORS.textDisabled}
                    keyboardType="numeric"
                    maxLength={2}
                    value={guest.age}
                    onChangeText={(val) => updateGuest(index, 'age', val)}
                  />
                </View>
              </View>
            </View>
          ))}
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
            style={[styles.paymentBtn, (paying || !isFormValid) && { opacity: 0.6 }]}
            disabled={paying || booking || !isFormValid}
            onPress={handlePayment}
            activeOpacity={0.9}
            testID="razorpay-pay-btn"
          >
            <LinearGradient
              colors={['#000000', '#1A1A1A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.paymentGradient}
            >
              <View style={styles.paymentRow}>
                <View style={styles.paymentLogoWrap}>
                  <ExpoImage
                    source={require('../../assets/images/razorpay-app-icon-hd.png')}
                    style={styles.paymentLogo}
                    contentFit="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>Pay with Razorpay</Text>
                  <Text style={styles.paymentSub}>Secure Payment Gateway</Text>
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
      {(paying || booking) && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator color="#FFF" size="large" />
            <Text style={styles.processingTitle}>Processing</Text>
            <Text style={styles.processingText}>{processingLabel || 'Please wait while we complete this step.'}</Text>
          </View>
        </View>
      )}
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
  guestsContainer: { gap: rs(10), marginBottom: rs(20) },
  guestCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.lg, padding: rs(14), borderWidth: 1, borderColor: COLORS.border, gap: rs(10) },
  guestHeader: { flexDirection: 'row', alignItems: 'center', gap: rs(6) },
  guestTitle: { color: COLORS.textSecondary, fontSize: rf(12), fontWeight: '700' },
  guestInputs: { flexDirection: 'row', gap: rs(12) },
  inputLabel: { color: COLORS.textTertiary, fontSize: rf(10), marginBottom: rs(4), textTransform: 'uppercase' },
  input: { backgroundColor: COLORS.bgTertiary, borderRadius: RADIUS.md, paddingHorizontal: rs(12), paddingVertical: rs(10), color: COLORS.textPrimary, fontSize: rf(14), borderWidth: 1, borderColor: COLORS.border },
  priceCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(16), borderWidth: 1, borderColor: COLORS.border, marginBottom: rs(20), gap: rs(10) },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: COLORS.textSecondary, fontSize: rf(14) },
  priceValue: { color: COLORS.textPrimary, fontSize: rf(14) },
  priceDivider: { height: 1, backgroundColor: COLORS.border },
  totalLabel: { color: COLORS.textPrimary, fontSize: rf(15), fontWeight: '700' },
  totalValue: { color: '#FFF', fontSize: rf(20), fontWeight: '800' },
  paymentBtn: { borderRadius: RADIUS.xl, overflow: 'hidden', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  paymentGradient: { padding: rs(18) },
  paymentRow: { flexDirection: 'row', alignItems: 'center', gap: rs(14) },
  paymentLogoWrap: { width: rs(44), height: rs(44), borderRadius: rs(12), backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', padding: rs(5) },
  paymentLogo: { width: '100%', height: '100%' },
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
  processingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: rs(24) },
  processingCard: { width: '100%', maxWidth: rs(280), backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: rs(22), borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', gap: rs(10) },
  processingTitle: { color: COLORS.textPrimary, fontSize: rf(18), fontWeight: '800' },
  processingText: { color: COLORS.textSecondary, fontSize: rf(13), lineHeight: rf(20), textAlign: 'center' },
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
