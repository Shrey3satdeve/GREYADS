import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, Download, MapPin, Calendar, Hash, User } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface TicketData {
  id: string;
  event_title: string;
  event_date: string;
  event_venue: string;
  booking_ref: string;
  qr_token: string;
  status: string;
  quantity: number;
  total_price: number;
  user_name: string;
  user_email: string;
}

const STATUS_CONFIG = {
  valid: { color: '#22C55E', bg: '#22C55E15', label: 'VALID' },
  used: { color: '#71717A', bg: '#71717A15', label: 'USED' },
  cancelled: { color: '#EF4444', bg: '#EF444415', label: 'CANCELLED' },
};

export default function DigitalTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    api.get(`/tickets/${id}`)
      .then(data => setTicket(data.ticket))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    if (!ticket) return;
    await Share.share({ message: `My ticket for ${ticket.event_title}\nRef: ${ticket.booking_ref}\nBooked via GreyAdz.` });
  };

  if (loading) {
    return (
      <View style={styles.loadWrap}>
        <ActivityIndicator color="#FFF" size="large" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <View style={styles.loadWrap}>
        <Text style={styles.errorText}>Ticket not found</Text>
      </View>
    );
  }

  const status = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.valid;
  const eventDate = new Date(ticket.event_date);

  return (
    <View style={styles.container} testID="digital-ticket-screen">
      <SafeAreaView edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity testID="back-btn" style={styles.headerBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Ticket</Text>
          <TouchableOpacity testID="share-ticket-btn" style={styles.headerBtn} onPress={handleShare}>
            <Share2 size={18} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Ticket Card (white) */}
        <View style={styles.ticketOuter}>
          <View style={styles.ticketCard}>
            {/* Header */}
            <View style={styles.ticketHeader}>
              <View style={styles.logoRowSmall}>
                <View style={styles.logoCircle}>
                  <Text style={styles.logoG}>G</Text>
                </View>
                <Text style={styles.logoSmall}>GreyAdz.</Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>

            {/* Event Title */}
            <Text style={styles.ticketEventTitle}>{ticket.event_title}</Text>

            {/* Details */}
            <View style={styles.ticketDetails}>
              <View style={styles.ticketDetailRow}>
                <Calendar size={14} color="#71717A" />
                <Text style={styles.ticketDetailText}>
                  {eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.ticketDetailRow}>
                <MapPin size={14} color="#71717A" />
                <Text style={styles.ticketDetailText} numberOfLines={2}>{ticket.event_venue}</Text>
              </View>
              <View style={styles.ticketDetailRow}>
                <User size={14} color="#71717A" />
                <Text style={styles.ticketDetailText}>{ticket.user_name}</Text>
              </View>
            </View>

            {/* Dashed separator */}
            <View style={styles.separator}>
              <View style={styles.holeLeft} />
              <Text style={styles.dashes}>- - - - - - - - - - - - - - - - -</Text>
              <View style={styles.holeRight} />
            </View>

            {/* QR Code */}
            <View style={styles.qrWrap}>
              <QRCode
                value={ticket.qr_token}
                size={width * 0.5}
                color="#000000"
                backgroundColor="#FFFFFF"
              />
              <Text style={styles.qrHint}>Scan at event entrance</Text>
            </View>

            {/* Booking Ref */}
            <View style={styles.refRow}>
              <View style={styles.refItem}>
                <Text style={styles.refLabel}>BOOKING REF</Text>
                <Text style={styles.refValue}>{ticket.booking_ref}</Text>
              </View>
              <View style={styles.refItem}>
                <Text style={styles.refLabel}>QTY</Text>
                <Text style={styles.refValue}>{ticket.quantity} × ticket</Text>
              </View>
              <View style={styles.refItem}>
                <Text style={styles.refLabel}>AMOUNT</Text>
                <Text style={styles.refValue}>₹{ticket.total_price.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Ticket Bottom Tear */}
          <View style={styles.tearBottom} />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity testID="download-btn" style={styles.actionBtn} onPress={() => {}}>
            <Download size={18} color={COLORS.textPrimary} />
            <Text style={styles.actionBtnText}>Save to Wallet</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="share-qr-btn" style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare}>
            <Share2 size={18} color="#000" />
            <Text style={styles.actionBtnTextPrimary}>Share Ticket</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  ticketOuter: { borderRadius: RADIUS.xl, overflow: 'hidden', shadowColor: '#FFF', shadowOpacity: 0.08, shadowRadius: 30, elevation: 10 },
  ticketCard: { backgroundColor: '#FFFFFF', padding: 24 },
  tearBottom: { height: 16, backgroundColor: '#FFFFFF', borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  logoRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  logoG: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  logoSmall: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  ticketEventTitle: { color: '#000', fontSize: 20, fontWeight: '800', letterSpacing: -0.5, marginBottom: 16, lineHeight: 26 },
  ticketDetails: { gap: 8, marginBottom: 20 },
  ticketDetailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  ticketDetailText: { color: '#3F3F46', fontSize: 13, flex: 1, lineHeight: 20 },
  separator: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -24, marginBottom: 20, position: 'relative' },
  holeLeft: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.bg, position: 'absolute', left: -10, zIndex: 2 },
  holeRight: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.bg, position: 'absolute', right: -10, zIndex: 2 },
  dashes: { color: '#E4E4E7', fontSize: 14, flex: 1, textAlign: 'center', letterSpacing: 2 },
  qrWrap: { alignItems: 'center', gap: 12, marginBottom: 20 },
  qrHint: { color: '#A1A1AA', fontSize: 12, letterSpacing: 0.5 },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F4F4F5', borderRadius: RADIUS.md, padding: 12 },
  refItem: { alignItems: 'center', gap: 4 },
  refLabel: { color: '#A1A1AA', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 },
  refValue: { color: '#000', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  actionBtnPrimary: { backgroundColor: COLORS.btnPrimary, borderColor: 'transparent' },
  actionBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  actionBtnTextPrimary: { color: '#000', fontSize: 14, fontWeight: '700' },
});
