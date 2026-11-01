import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Share2, Download, MapPin, Calendar, User } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import BrandMark from '../../components/BrandMark';
import { useDialog } from '../../components/AppDialog';
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
  guests?: Array<{ name: string, age: string }>;
}

const STATUS_CONFIG = {
  valid: { color: '#000000', bg: 'rgba(255,255,255,0.4)', label: 'VALID' },
  pending: { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', label: 'PENDING' },
  used: { color: '#374151', bg: 'rgba(55,65,81,0.15)', label: 'USED' },
  cancelled: { color: '#EF4444', bg: 'rgba(239,68,68,0.15)', label: 'CANCELLED' },
};

export default function DigitalTicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();
  const ticketRef = useRef<ViewShot>(null);
  const { showDialog, DialogComponent } = useDialog();

  useEffect(() => {
    if (!id) return;
    api.get(`/tickets/${id}`)
      .then(data => setTicket(data.ticket))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    try {
      if (!ticket || !ticketRef.current) return;
      
      // Capture the ticket as an image first
      const uri = await ticketRef.current.capture?.();
      if (!uri) throw new Error("Could not generate ticket image");

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        // Fallback to text sharing if image sharing is not available
        await Share.share({ 
          message: `My ticket for ${ticket.event_title}\nRef: ${ticket.booking_ref}\nBooked via GreyAdz.` 
        });
        return;
      }

      // Share the image file directly (Fixes WhatsApp QR visibility)
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Share Ticket: ${ticket.event_title}`,
        UTI: 'public.png'
      });

    } catch (err: any) {
      showDialog({ title: 'Share Failed', message: err?.message || 'Unable to share this ticket right now.' });
    }
  };

  const handleDownload = async () => {
    try {
      if (!ticket || !ticketRef.current) return;
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        showDialog({ title: 'Permission Required', message: 'Permission required to save ticket to gallery.' });
        return;
      }
      setDownloading(true);
      const uri = await ticketRef.current.capture?.();
      if (uri) {
        await MediaLibrary.saveToLibraryAsync(uri);
        showDialog({ title: 'Saved', message: 'Ticket saved to gallery successfully.' });
      }
    } catch (err: any) {
      showDialog({ title: 'Save Failed', message: err?.message || 'Error saving ticket.' });
    } finally {
      setDownloading(false);
    }
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
      {DialogComponent}
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
        {/* Grey Metallic Ticket */}
        <ViewShot ref={ticketRef} options={{ format: 'png', quality: 1 }}>
          <View style={styles.ticketOuter}>
          <LinearGradient
            colors={['#E5E7EB', '#D1D5DB', '#9CA3AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ticketCard}
          >
            {/* 45 Degree Branding Watermark */}
            <View style={styles.watermarkContainer}>
              <Text style={styles.watermarkText}>GREYADZ GREYADZ GREYADZ</Text>
              <Text style={styles.watermarkText}>GREYADZ GREYADZ GREYADZ</Text>
              <Text style={styles.watermarkText}>GREYADZ GREYADZ GREYADZ</Text>
              <Text style={styles.watermarkText}>GREYADZ GREYADZ GREYADZ</Text>
            </View>

            {/* Header */}
            <View style={styles.ticketHeader}>
              <View style={styles.logoRowSmall}>
                <View style={styles.logoCircleDark}>
                   <BrandMark size={32} imageScale={0.7} />
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
                <Calendar size={14} color="#374151" />
                <Text style={styles.ticketDetailText}>
                  {eventDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
              <View style={styles.ticketDetailRow}>
                <MapPin size={14} color="#374151" />
                <Text style={styles.ticketDetailText} numberOfLines={2}>{ticket.event_venue}</Text>
              </View>
              <View style={styles.ticketDetailRow}>
                <User size={14} color="#374151" />
                <Text style={styles.ticketDetailText}>{ticket.user_name}</Text>
              </View>
            </View>

            {/* Guest List - Security Requirement */}
            {ticket.guests && ticket.guests.length > 0 && (
              <View style={styles.guestsBadgeSection}>
                <Text style={styles.guestsHeader}>ATTENDEES / SECURITY VERIFIED</Text>
                <View style={styles.guestList}>
                  {ticket.guests.map((g, idx) => (
                    <View key={idx} style={styles.guestPill}>
                      <Text style={styles.guestPillText}>{g.name}</Text>
                      <View style={styles.ageBadge}><Text style={styles.ageText}>{g.age}</Text></View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Dashed separator */}
            <View style={styles.separator}>
              <View style={styles.holeLeft} />
              <View style={styles.dashLine} />
              <View style={styles.holeRight} />
            </View>

            {/* QR Code */}
            <View style={styles.qrWrap}>
              <View style={styles.qrInner}>
                <QRCode
                  value={ticket.qr_token}
                  size={width * 0.45}
                  color="#000000"
                  backgroundColor="transparent"
                />
              </View>
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
          </LinearGradient>
        </View>
        </ViewShot>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity testID="download-btn" style={styles.actionBtn} onPress={handleDownload} disabled={downloading}>
            {downloading ? <ActivityIndicator size="small" color="#000" /> : <Download size={18} color={COLORS.textPrimary} />}
            <Text style={styles.actionBtnText}>{downloading ? 'Saving...' : 'Save to Wallet'}</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="share-qr-btn" style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={handleShare}>
            <Share2 size={18} color="#000" />
            <Text style={styles.actionBtnTextPrimary}>Share Ticket</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: rs(40) }} />
      </ScrollView>
    </View>
  );
}

// Mocking rs for brevity if theme doesn't have it, but usually SPACING/COLORS are enough
const rs = (v: number) => v;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  loadWrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.textSecondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700' },
  scroll: { padding: 20 },
  ticketOuter: { borderRadius: RADIUS.xl, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 20, elevation: 12 },
  ticketCard: { padding: 24, minHeight: 480 },
  watermarkContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', opacity: 0.04, transform: [{ rotate: '-45deg' }, { scale: 1.5 }] },
  watermarkText: { color: '#000', fontSize: 32, fontWeight: '900', letterSpacing: 10, lineHeight: 60, flexWrap: 'nowrap' },
  logoCircleDark: { backgroundColor: '#000', borderRadius: 100, padding: 2 },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, zIndex: 10 },
  logoRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoSmall: { color: '#111827', fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  ticketEventTitle: { color: '#111827', fontSize: 24, fontWeight: '900', letterSpacing: -0.8, marginBottom: 16, lineHeight: 30, zIndex: 10 },
  ticketDetails: { gap: 10, marginBottom: 24, zIndex: 10 },
  ticketDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketDetailText: { color: '#374151', fontSize: 14, fontWeight: '600', flex: 1 },
  separator: { flexDirection: 'row', alignItems: 'center', marginHorizontal: -24, marginBottom: 24, position: 'relative' },
  holeLeft: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bg, position: 'absolute', left: -12, zIndex: 2 },
  holeRight: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bg, position: 'absolute', right: -12, zIndex: 2 },
  dashLine: { flex: 1, height: 1, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)', borderStyle: 'dashed' },
  qrWrap: { alignItems: 'center', gap: 16, marginBottom: 24, zIndex: 10 },
  qrInner: { padding: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  qrHint: { color: '#4B5563', fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  refRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: RADIUS.lg, padding: 16, zIndex: 10 },
  refItem: { alignItems: 'center', gap: 4 },
  refLabel: { color: '#6B7280', fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  refValue: { color: '#111827', fontSize: 13, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bgCard },
  actionBtnPrimary: { backgroundColor: COLORS.btnPrimary, borderColor: 'transparent' },
  actionBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600' },
  actionBtnTextPrimary: { color: '#000', fontSize: 14, fontWeight: '700' },
  guestsBadgeSection: { marginTop: 12, padding: 12, backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: RADIUS.lg, zIndex: 10 },
  guestsHeader: { fontSize: 8, fontWeight: '900', color: '#6B7280', letterSpacing: 1, marginBottom: 8 },
  guestList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  guestPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.6)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  guestPillText: { color: '#111827', fontSize: 11, fontWeight: '700' },
  ageBadge: { backgroundColor: '#000', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4 },
  ageText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
});
