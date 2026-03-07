import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ticket, Calendar, MapPin, QrCode, ArrowRight } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface TicketItem {
  id: string;
  event_title: string;
  event_date: string;
  event_venue: string;
  booking_ref: string;
  status: string;
  quantity: number;
  total_price: number;
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    valid: { bg: '#22C55E20', text: '#22C55E', label: 'Valid' },
    used: { bg: '#3F3F4660', text: '#71717A', label: 'Used' },
    cancelled: { bg: '#EF444420', text: '#EF4444', label: 'Cancelled' },
  }[status] || { bg: '#27272A', text: '#A1A1AA', label: status };

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
      <Text style={[styles.statusText, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

export default function TicketsScreen() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadTickets = useCallback(async () => {
    try {
      const data = await api.get('/tickets/my');
      setTickets(data.tickets || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadTickets(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadTickets(); }, []);

  const renderTicket = ({ item }: { item: TicketItem }) => (
    <TouchableOpacity
      testID={`ticket-card-${item.id}`}
      style={styles.ticketCard}
      onPress={() => router.push(`/ticket/${item.id}`)}
      activeOpacity={0.85}
    >
      {/* Ticket hole decorations */}
      <View style={styles.holeLeft} />
      <View style={styles.holeRight} />
      <View style={styles.dashedLine} />

      <View style={styles.ticketTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.ticketTitle} numberOfLines={2}>{item.event_title}</Text>
          <View style={styles.metaRow}>
            <Calendar size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText}>{new Date(item.event_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          </View>
          <View style={styles.metaRow}>
            <MapPin size={12} color={COLORS.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>{item.event_venue}</Text>
          </View>
        </View>
        <View style={styles.ticketRight}>
          <StatusBadge status={item.status} />
          <QrCode size={28} color={item.status === 'valid' ? COLORS.textPrimary : COLORS.textTertiary} />
        </View>
      </View>

      <View style={styles.ticketBottom}>
        <View>
          <Text style={styles.refLabel}>Booking Ref</Text>
          <Text style={styles.refValue}>{item.booking_ref}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.qtyLabel}>{item.quantity} × ticket</Text>
          <Text style={styles.priceValue}>₹{item.total_price.toLocaleString()}</Text>
        </View>
        <TouchableOpacity
          testID={`view-ticket-${item.id}`}
          style={styles.viewBtn}
          onPress={() => router.push(`/ticket/${item.id}`)}
        >
          <ArrowRight size={16} color="#000" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe} testID="tickets-screen">
      <View style={styles.header}>
        <Ticket size={22} color={COLORS.textPrimary} />
        <Text style={styles.headerTitle}>My Tickets</Text>
        <Text style={styles.headerCount}>{tickets.length}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : tickets.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ticket size={48} color={COLORS.textTertiary} strokeWidth={1} />
          <Text style={styles.emptyTitle}>No Tickets Yet</Text>
          <Text style={styles.emptySubtitle}>Book an event to see your tickets here</Text>
        </View>
      ) : (
        <FlatList
          data={tickets}
          keyExtractor={(item) => item.id}
          renderItem={renderTicket}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', flex: 1, letterSpacing: -0.5 },
  headerCount: { color: COLORS.textTertiary, fontSize: 14, fontWeight: '600', backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySubtitle: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  list: { padding: 20, gap: 12, paddingBottom: 110 },
  ticketCard: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border,
    overflow: 'hidden',
  },
  holeLeft: { position: 'absolute', left: -12, top: '58%', width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bg, zIndex: 2 },
  holeRight: { position: 'absolute', right: -12, top: '58%', width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.bg, zIndex: 2 },
  dashedLine: { position: 'absolute', left: 16, right: 16, top: '58%', height: 1, borderWidth: 0.5, borderColor: COLORS.border, borderStyle: 'dashed' },
  ticketTop: { flexDirection: 'row', gap: 12, padding: 16, paddingBottom: 32 },
  ticketTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6, letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  metaText: { color: COLORS.textSecondary, fontSize: 12, flex: 1 },
  ticketRight: { alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 },
  ticketBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 20 },
  refLabel: { color: COLORS.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  refValue: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', fontFamily: 'Menlo' },
  qtyLabel: { color: COLORS.textTertiary, fontSize: 11, marginBottom: 2 },
  priceValue: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  viewBtn: { marginLeft: 'auto', width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.btnPrimary, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full, marginBottom: 8 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
