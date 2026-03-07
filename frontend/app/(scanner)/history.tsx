import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface ScanLogItem {
  id: string;
  event_title: string;
  attendee_name: string;
  status: string;
  note?: string;
  timestamp: string;
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: '#22C55E', bg: '#22C55E15', label: 'Verified' },
  already_used: { icon: AlertTriangle, color: '#F59E0B', bg: '#F59E0B15', label: 'Already Used' },
  invalid: { icon: XCircle, color: '#EF4444', bg: '#EF444415', label: 'Invalid' },
};

export default function ScanHistoryScreen() {
  const [logs, setLogs] = useState<ScanLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      const data = await api.get('/scanner/history');
      setLogs(data.logs || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadHistory(); }, [loadHistory]));
  const onRefresh = useCallback(() => { setRefreshing(true); loadHistory(); }, []);

  const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === new Date().toDateString());
  const successRate = todayLogs.length > 0
    ? Math.round((todayLogs.filter(l => l.status === 'success').length / todayLogs.length) * 100)
    : 0;

  const renderLog = ({ item }: { item: ScanLogItem }) => {
    const conf = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.invalid;
    const time = new Date(item.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    return (
      <View testID={`scan-log-${item.id}`} style={styles.logCard}>
        <View style={[styles.logIcon, { backgroundColor: conf.bg }]}>
          <conf.icon size={18} color={conf.color} strokeWidth={1.8} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.logName}>{item.attendee_name}</Text>
          <Text style={styles.logEvent} numberOfLines={1}>{item.event_title}</Text>
          {item.note && <Text style={styles.logNote}>{item.note}</Text>}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.statusChip, { backgroundColor: conf.bg }]}>
            <Text style={[styles.statusText, { color: conf.color }]}>{conf.label}</Text>
          </View>
          <Text style={styles.logTime}>{time}</Text>
        </View>
      </View>
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
          data={logs}
          keyExtractor={item => item.id}
          renderItem={renderLog}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
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
  headerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 12, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: COLORS.border },
  summaryVal: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: COLORS.textTertiary, fontSize: 11 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  list: { paddingHorizontal: 20, paddingBottom: 110, gap: 8 },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  logIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  logName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  logEvent: { color: COLORS.textSecondary, fontSize: 12 },
  logNote: { color: COLORS.error, fontSize: 11 },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  logTime: { color: COLORS.textTertiary, fontSize: 11 },
});
