import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Ticket, Users, Calendar, Zap } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface Stats {
  total_events: number;
  total_users: number;
  total_tickets: number;
  total_revenue: number;
  todays_scans: number;
  recent_events: any[];
}

const BAR_COLORS = ['#3B82F6', '#7C3AED', '#22C55E', '#F59E0B', '#EF4444'];
const MOCK_WEEKLY = [22, 45, 31, 68, 42, 88, 54];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AnalyticsScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.get('/admin/stats');
      setStats(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const maxBar = Math.max(...MOCK_WEEKLY);

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
            <View style={[styles.kpiCard, { borderColor: '#3B82F660' }]}>
              <Text style={styles.kpiValue}>₹{((stats?.total_revenue ?? 0) / 1000).toFixed(1)}K</Text>
              <Text style={styles.kpiLabel}>Revenue</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: '#22C55E60' }]}>
              <Text style={styles.kpiValue}>{stats?.total_tickets ?? 0}</Text>
              <Text style={styles.kpiLabel}>Tickets Sold</Text>
            </View>
            <View style={[styles.kpiCard, { borderColor: '#7C3AED60' }]}>
              <Text style={styles.kpiValue}>{stats?.todays_scans ?? 0}</Text>
              <Text style={styles.kpiLabel}>Scans Today</Text>
            </View>
          </View>

          {/* Weekly Sales Chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <TrendingUp size={16} color="#3B82F6" />
              <Text style={styles.chartTitle}>Weekly Ticket Sales</Text>
            </View>
            <View style={styles.barChart}>
              {MOCK_WEEKLY.map((val, i) => (
                <View key={i} style={styles.barCol}>
                  <Text style={styles.barVal}>{val}</Text>
                  <View style={styles.barOuter}>
                    <View style={[styles.barFill, { height: `${(val / maxBar) * 100}%`, backgroundColor: i === 6 ? '#3B82F6' : '#27272A' }]} />
                  </View>
                  <Text style={styles.barDay}>{DAYS[i]}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Category Breakdown */}
          <Text style={styles.sectionTitle}>Events by Category</Text>
          <View style={styles.categoryCard}>
            {(stats?.recent_events || []).map((ev, i) => (
              <View key={ev.id} style={styles.catRow}>
                <View style={[styles.catBar, { backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }]} />
                <Text style={styles.catName} numberOfLines={1}>{ev.title}</Text>
                <Text style={styles.catVal}>{ev.available_tickets} left</Text>
              </View>
            ))}
          </View>

          {/* Summary Metrics */}
          <Text style={styles.sectionTitle}>Platform Overview</Text>
          <View style={styles.metricsGrid}>
            {[
              { icon: Calendar, label: 'Total Events', value: stats?.total_events ?? 0, color: '#3B82F6' },
              { icon: Users, label: 'Total Users', value: stats?.total_users ?? 0, color: '#22C55E' },
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
  kpiCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, borderWidth: 1, alignItems: 'center', gap: 4 },
  kpiValue: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  kpiLabel: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center' },
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
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metricCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  metricVal: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center' },
});
