import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator,
  TouchableOpacity, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Clock, CheckCircle, XCircle, AlertTriangle, ChevronRight, ArrowUpRight, ArrowDownLeft, X } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, FLOATING_TAB_BAR, RADIUS, SPACING } from '../../constants/theme';

interface ScanLogItem {
  id: string;
  ticket_id: string; // Linking to the main ticket
  event_title: string;
  user_name: string; // Booker's name
  attendee_name?: string; // Legacy support
  booking_ref: string;
  status: string;
  type?: string; // Entrance/Exit
  guest_count?: number;
  note?: string;
  timestamp: any;
}

interface GroupedBooking {
  booking_ref: string;
  user_name: string;
  event_title: string;
  logs: ScanLogItem[];
  latest: ScanLogItem;
}

const NameAvatar = ({ name }: { name: string }) => {
  const initials = (name || "GUE").substring(0, 3).toUpperCase();
  const colors = ['#3B82F6', '#7C3AED', '#EC4899', '#22C55E', '#F59E0B'];
  const charCodeSum = initials.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const bgColor = colors[charCodeSum % colors.length];

  return (
    <View style={[styles.avatar, { backgroundColor: bgColor }]}>
      <Text style={styles.avatarText}>{initials}</Text>
      <View style={styles.avatarGlow} />
    </View>
  );
};

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: '#22C55E', bg: '#22C55E15', label: 'Verified' },
  already_used: { icon: AlertTriangle, color: '#F59E0B', bg: '#F59E0B15', label: 'Already Used' },
  invalid: { icon: XCircle, color: '#EF4444', bg: '#EF444415', label: 'Invalid' },
};

export default function ScanHistoryScreen() {
  const [logs, setLogs] = useState<ScanLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<GroupedBooking | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const insets = useSafeAreaInsets();
  const listBottomPadding =
    FLOATING_TAB_BAR.height +
    FLOATING_TAB_BAR.bottomOffset +
    insets.bottom +
    FLOATING_TAB_BAR.contentInset;

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.get('/scanner/history');
      setLogs(data.logs || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));
  const onRefresh = useCallback(() => { setRefreshing(true); loadHistory(); }, [loadHistory]);

  useEffect(() => {
    if (selectedBooking?.latest.ticket_id) {
      const fetchTicket = async () => {
        setLoadingTicket(true);
        try {
          const res = await api.get(`/tickets/${selectedBooking.latest.ticket_id}`);
          setSelectedTicket(res.ticket);
        } catch (e) {
          console.error("Failed to fetch ticket info", e);
        } finally {
          setLoadingTicket(false);
        }
      };
      fetchTicket();
    } else {
      setSelectedTicket(null);
    }
  }, [selectedBooking]);

  const groupedBookings = useMemo(() => {
    const grouped: Record<string, ScanLogItem[]> = {};
    logs.forEach(log => {
      // Group by booking_ref ONLY (Ensures one row per booking)
      const ref = log.booking_ref || 'N/A';
      if (!grouped[ref]) grouped[ref] = [];
      grouped[ref].push(log);
    });

    return Object.entries(grouped).map(([ref, items]) => {
      // Sort items within group by timestamp (latest first)
      const sorted = [...items].sort((a, b) => {
        const timeA = a.timestamp?.seconds || new Date(a.timestamp).getTime();
        const timeB = b.timestamp?.seconds || new Date(b.timestamp).getTime();
        return timeB - timeA;
      });
      
      return {
        booking_ref: ref,
        user_name: sorted[0].user_name,
        event_title: sorted[0].event_title,
        logs: sorted,
        latest: sorted[0]
      };
    }).sort((a, b) => {
      // Sort the main list by the latest movement overall
      const timeA = a.latest.timestamp?.seconds || new Date(a.latest.timestamp).getTime();
      const timeB = b.latest.timestamp?.seconds || new Date(b.latest.timestamp).getTime();
      return timeB - timeA;
    });
  }, [logs]);

  const todayLogs = logs.filter(l => {
    const d = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : new Date(l.timestamp);
    return d.toDateString() === new Date().toDateString();
  });

  const successRate = todayLogs.length > 0
    ? Math.round((todayLogs.filter(l => l.status === 'success').length / todayLogs.length) * 100)
    : 0;

  const renderBookingRow = ({ item }: { item: GroupedBooking }) => {
    const lastTime = item.latest.timestamp?.seconds
      ? new Date(item.latest.timestamp.seconds * 1000)
      : new Date(item.latest.timestamp);
    
    return (
      <TouchableOpacity 
        style={styles.logCard} 
        onPress={() => setSelectedBooking(item)}
        activeOpacity={0.7}
      >
        <NameAvatar name={item.user_name} />
        
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.nameRow}>
            <Text style={styles.logName}>{item.user_name}</Text>
            <Text style={styles.bookingRef}>{item.booking_ref}</Text>
          </View>
          <Text style={styles.logEvent} numberOfLines={1}>{item.event_title}</Text>
          
          <View style={styles.summaryBadgeRow}>
             <View style={[styles.movementBadge, { backgroundColor: item.logs.length > 1 ? '#3B82F615' : '#9CA3AF15' }]}>
                <Text style={[styles.movementBadgeText, { color: item.logs.length > 1 ? '#3B82F6' : '#6B7280' }]}>
                  {item.logs.length} Scans Total
                </Text>
             </View>
             <View style={styles.typeRow}>
               <View style={[styles.typeDot, { backgroundColor: item.latest.type === 'Exit' ? '#F59E0B' : '#22C55E' }]} />
               <Text style={styles.typeText}>Latest: {item.latest.type || 'Entrance'}</Text>
               <Text style={styles.timeLabel}> • {lastTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
             </View>
          </View>
        </View>

        <ChevronRight size={18} color={COLORS.textTertiary} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="scan-history-screen">
      <View style={styles.header}>
        <Clock size={20} color={COLORS.textPrimary} />
        <Text style={styles.headerTitle}>Scan History</Text>
      </View>

      {/* Today's summary */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{todayLogs.length}</Text>
          <Text style={styles.summaryLabel}>Today</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#22C55E30' }]}>
          <Text style={[styles.summaryVal, { color: '#22C55E' }]}>{successRate}%</Text>
          <Text style={styles.summaryLabel}>Success Rate</Text>
        </View>
        <View style={[styles.summaryCard, { borderColor: '#7C3AED30' }]}>
          <Text style={[styles.summaryVal, { color: '#7C3AED' }]}>{logs.length}</Text>
          <Text style={styles.summaryLabel}>All Time</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadWrap}><ActivityIndicator color="#22C55E" /></View>
      ) : logs.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Clock size={40} color={COLORS.textTertiary} strokeWidth={1} />
          <Text style={styles.emptyText}>No scan history yet</Text>
        </View>
      ) : (
      <FlatList
        data={groupedBookings}
        keyExtractor={item => item.booking_ref}
        renderItem={renderBookingRow}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={[styles.list, { paddingBottom: listBottomPadding }]}
        showsVerticalScrollIndicator={false}
      />
    )}

    {/* Detailed Movement (Aana Jaana) Modal */}
    <Modal visible={!!selectedBooking} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{selectedBooking?.user_name}'s Family</Text>
              <Text style={styles.modalSub}>Booking Ref: {selectedBooking?.booking_ref}</Text>
            </View>
            <TouchableOpacity onPress={() => { setSelectedBooking(null); setSelectedTicket(null); }} style={styles.modalClose}>
              <X size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {loadingTicket ? (
            <ActivityIndicator color="#22C55E" style={{ marginVertical: 30 }} />
          ) : selectedTicket && (
            <View style={styles.guestStatusSection}>
              <Text style={styles.sectionHeaderModal}>Guest Status (Family Status)</Text>
              <View style={styles.guestGrid}>
                {selectedTicket.guests?.map((guest: any, idx: number) => {
                  const isInside = guest.status === 'inside';
                  return (
                    <View key={idx} style={[styles.guestMiniCard, { borderColor: isInside ? '#22C55E' : COLORS.border }]}>
                      <Text style={styles.guestMiniName} numberOfLines={1}>{guest.name}</Text>
                      <View style={styles.miniStatusRow}>
                         <View style={[styles.statusDotSmall, { backgroundColor: isInside ? '#22C55E' : '#9CA3AF' }]} />
                         <Text style={[styles.miniStatusText, { color: isInside ? '#22C55E' : COLORS.textTertiary }]}>
                           {isInside ? 'INSIDE' : 'OUTSIDE'}
                         </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <Text style={styles.sectionHeaderModal}>Movement Timeline (Aana-Jaana)</Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.timelineList}>
            {selectedBooking?.logs.map((log, idx) => {
              const isExit = log.type === 'Exit';
              const date = log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000) : new Date(log.timestamp);
              const time = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              
              return (
                <View key={log.id} style={styles.timelineItem}>
                  <View style={styles.timelineLine}>
                     <View style={[styles.timelineDot, { backgroundColor: isExit ? '#F59E0B' : '#22C55E' }]} />
                     {idx !== (selectedBooking?.logs.length - 1) && <View style={styles.verticalLink} />}
                  </View>
                  <View style={styles.timelineCard}>
                    <View style={styles.timelineHeader}>
                      <View style={[styles.iconBox, { backgroundColor: isExit ? '#F59E0B15' : '#22C55E15' }]}>
                        {isExit ? <ArrowDownLeft size={14} color="#F59E0B" /> : <ArrowUpRight size={14} color="#22C55E" />}
                        <Text style={[styles.typeLabel, { color: isExit ? '#F59E0B' : '#22C55E' }]}>
                          {log.type?.toUpperCase() || 'ENTRANCE'}
                        </Text>
                      </View>
                      <Text style={styles.timelineTime}>{time}</Text>
                    </View>
                    <Text style={styles.timelineDesc}>
                      {log.guest_count && log.guest_count > 1 
                        ? `${log.guest_count} family members ${isExit ? 'exited' : 'entered'}` 
                        : `Successfully ${isExit ? 'exited' : 'entered'}`
                      }
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 12, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.border },
  summaryVal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: COLORS.textTertiary, fontSize: 11 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  list: { paddingHorizontal: 20, gap: 10 },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  avatar: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarText: { color: '#FFF', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  avatarGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.15)' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  logName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  bookingRef: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '600', backgroundColor: COLORS.bgTertiary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  logEvent: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 2 },
  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  typeDot: { width: 6, height: 6, borderRadius: 3 },
  typeText: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '600' },
  logNote: { color: COLORS.error, fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
  statusBadgeText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.3 },
  timeLabel: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '500' },
  sectionHeaderModal: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  guestStatusSection: { marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  guestGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  guestMiniCard: { width: '31%', backgroundColor: COLORS.bgCard, padding: 8, borderRadius: 12, borderWidth: 1, gap: 4 },
  guestMiniName: { color: COLORS.textPrimary, fontSize: 11, fontWeight: '700' },
  miniStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDotSmall: { width: 5, height: 5, borderRadius: 2.5 },
  miniStatusText: { fontSize: 8, fontWeight: '800' },
  summaryBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  movementBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  movementBadgeText: { fontSize: 9, fontWeight: '700' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '85%', padding: 20, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900' },
  modalSub: { color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  modalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: COLORS.bgCard },
  timelineList: { gap: 0, paddingBottom: 40 },
  timelineItem: { flexDirection: 'row', gap: 16 },
  timelineLine: { alignItems: 'center', width: 20 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, zIndex: 2 },
  verticalLink: { width: 2, flex: 1, backgroundColor: COLORS.border, marginVertical: -2 },
  timelineCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  iconBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.md },
  typeLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  timelineTime: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600' },
  timelineDesc: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 18 },
});
