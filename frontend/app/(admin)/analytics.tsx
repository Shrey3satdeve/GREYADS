import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Ticket, Users, Calendar, Zap, X, ArrowUpRight, Wallet, User } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface Stats {
  total_events: number;
  total_users: number;
  total_tickets: number;
  total_revenue: number;
  todays_scans: number;
  inside_count: number;
  recent_events: any[];
}

const BAR_COLORS = ['#3B82F6', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CATEGORY_COLORS: any = {
  'Tech': '#3B82F6',
  'Music': '#EC4899',
  'Sports': '#10B981',
  'Fashion show': '#F59E0B',
  'Room': '#6366F1',
  'Vit haryo': '#EF4444',
  'default': '#27272A'
};

export default function AnalyticsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [weekly, setWeekly] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [weeklyCats, setWeeklyCats] = useState<(string | null)[]>([null, null, null, null, null, null, null]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail Modals
  const [revModal, setRevModal] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [revData, setRevData] = useState<any[]>([]);
  const [scanData, setScanData] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [statsData, weeklyData, insideData]: [any, any, any] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/weekly-stats'),
        api.get('/admin/inside-count')
      ]);
      setStats({ ...statsData, inside_count: insideData.count });
      setWeekly(weeklyData.weekly);
      setWeeklyCats(weeklyData.categories || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  const openRevenue = async () => {
    setRevModal(true);
    setModalLoading(true);
    try {
      const res = await api.get('/admin/detailed-revenue');
      setRevData(res.transactions || []);
    } catch { } finally { setModalLoading(false); }
  };

  const openScans = async () => {
    setScanModal(true);
    setModalLoading(true);
    try {
      const res = await api.get('/admin/detailed-scans');
      setScanData(res.scans || []);
    } catch { } finally { setModalLoading(false); }
  };

  useEffect(() => { load(); }, [load]);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const maxBar = Math.max(...weekly, 1);

  return (
    <SafeAreaView style={styles.safe} testID="admin-analytics-screen">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      {loading ? (
        <View style={styles.loadWrap}><ActivityIndicator color="#FFF" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* KPI Row */}
          <View style={styles.kpiRow}>
            <TouchableOpacity style={[styles.kpiCard, { borderColor: '#3B82F660' }]} onPress={openRevenue}>
              <Text style={styles.kpiValue}>₹{((stats?.total_revenue ?? 0) / 1000).toFixed(1)}K</Text>
              <View style={styles.kpiLabelRow}>
                <Text style={styles.kpiLabel}>Revenue</Text>
                <ArrowUpRight size={10} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
            <View style={[styles.kpiCard, { borderColor: '#22C55E60' }]}>
              <Text style={styles.kpiValue}>{stats?.total_tickets ?? 0}</Text>
              <Text style={styles.kpiLabel}>Tickets Sold</Text>
            </View>
            <TouchableOpacity style={[styles.kpiCard, { borderColor: '#7C3AED60' }]} onPress={openScans}>
              <Text style={styles.kpiValue}>{stats?.todays_scans ?? 0}</Text>
              <View style={styles.kpiLabelRow}>
                <Text style={styles.kpiLabel}>Scans Today</Text>
                <ArrowUpRight size={10} color={COLORS.textTertiary} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Weekly Sales Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <TrendingUp size={16} color="#3B82F6" />
              <Text style={styles.chartTitle}>Weekly Ticket Sales</Text>
            </View>
            <View style={styles.barChart}>
              {weekly.map((val, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barVal}>{val}</Text>
                  <View style={styles.barOuter}>
                    <View style={[
                      styles.barFill, 
                      { 
                        height: `${(val / maxBar) * 100}%`, 
                        backgroundColor: CATEGORY_COLORS[weeklyCats[i] || 'default'] || CATEGORY_COLORS.default 
                      }
                    ]} />
                  </View>
                  <Text style={styles.barDay}>{DAYS[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Category Breakdown */}
          <Text style={styles.sectionTitle}>Events by Category</Text>
          <View style={styles.categoryCard}>
            {(stats?.recent_events || []).length === 0 ? (
              <Text style={styles.emptyText}>No events available yet.</Text>
            ) : (
              (stats?.recent_events || []).map((ev, i) => (
                <View key={ev.id} style={styles.catRow}>
                  <View style={[styles.catBar, { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                  <Text style={styles.catName} numberOfLines={1}>{ev.title}</Text>
                  <Text style={styles.catVal}>{ev.available_tickets} left</Text>
                </View>
              ))
            )}
          </View>

          {/* Summary Metrics */}
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.metricsGrid}>
            {[
              { icon: Calendar, label: 'Total Events', value: stats?.total_events ?? 0, color: '#3B82F6' },
              { icon: Users, label: 'Inside Now', value: stats?.inside_count ?? 0, color: '#22C55E' },
              { icon: Ticket, label: 'Tickets Sold', value: stats?.total_tickets ?? 0, color: '#F59E0B' },
              { icon: Zap, label: 'Avg per Event', value: stats?.total_events ? Math.round((stats?.total_tickets ?? 0) / stats.total_events) : 0, color: '#7C3AED' },
            ].map((m, i) => (
              <View key={i} style={[styles.metricCard, { borderColor: m.color + '30' }]}>
                <m.icon size={18} color={m.color} strokeWidth={1.8} />
                <Text style={styles.metricVal}>{m.value}</Text>
                <Text style={styles.metricLabel}>{m.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* Revenue Details Modal */}
      <Modal visible={revModal} transparent animationType="slide" onRequestClose={() => setRevModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Wallet size={20} color="#3B82F6" />
                <Text style={styles.modalTitle}>Revenue Classification</Text>
              </View>
              <TouchableOpacity onPress={() => setRevModal(false)}>
                <X size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator color="#FFF" style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {revData.length === 0 ? <Text style={styles.emptyText}>No transactions found.</Text> : (
                  revData.map((item, i) => (
                    <View key={item.id} style={styles.detailRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailName}>{item.user_name}</Text>
                        <Text style={styles.detailSub}>{item.event_title} · {item.quantity} Tickets</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.detailVal}>₹{item.total_price}</Text>
                        <Text style={styles.detailTime}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Scan Details Modal */}
      <Modal visible={scanModal} transparent animationType="slide" onRequestClose={() => setScanModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Zap size={20} color="#7C3AED" />
                <Text style={styles.modalTitle}>Today's Scanning Activity</Text>
              </View>
              <TouchableOpacity onPress={() => setScanModal(false)}>
                <X size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator color="#FFF" style={{ marginVertical: 40 }} />
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {scanData.length === 0 ? <Text style={styles.emptyText}>No scans today yet.</Text> : (
                  scanData.map((item, i) => (
                    <View key={item.id} style={styles.detailRow}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <User size={12} color={COLORS.textTertiary} />
                          <Text style={styles.detailName}>{item.user_name}</Text>
                        </View>
                        <Text style={styles.detailSub}>{item.event_title}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#22C55E' }} />
                          <Text style={styles.detailStaff}>By: {item.staff_name || 'System'}</Text>
                        </View>
                        <Text style={styles.detailTime}>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                      </View>
                    </View>
                  ))
                )}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20 },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  kpiCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, alignItems: 'center', gap: 2 },
  kpiValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  kpiLabel: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center' },
  kpiLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chartCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  chartTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 100, gap: 4 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barVal: { color: COLORS.textTertiary, fontSize: 9 },
  barOuter: { flex: 1, width: '100%', backgroundColor: COLORS.bgTertiary, borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 4 },
  barDay: { color: COLORS.textTertiary, fontSize: 9 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  categoryCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20, gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catBar: { width: 4, height: 36, borderRadius: 2 },
  catName: { color: COLORS.textSecondary, fontSize: 13, flex: 1 },
  catVal: { color: COLORS.textTertiary, fontSize: 12 },
  emptyText: { color: COLORS.textTertiary, fontSize: 13, textAlign: 'center', marginTop: 20 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  metricVal: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center' },
  
  // Modal Styles
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%', borderTopWidth: 1, borderTopColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  detailName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  detailSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  detailVal: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800' },
  detailTime: { color: COLORS.textTertiary, fontSize: 11, marginTop: 4 },
  detailStaff: { color: '#22C55E', fontSize: 11, fontWeight: '600' },
});
