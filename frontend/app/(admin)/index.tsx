import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, TrendingUp, Users, Ticket, Calendar, ChevronRight, Zap } from 'lucide-react-native';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface Stats {
  total_events: number;
  total_users: number;
  total_tickets: number;
  total_revenue: number;
  todays_scans: number;
  recent_events: any[];
}

function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <View style={[styles.statCard, { borderColor: color + '30' }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Icon size={20} color={color} strokeWidth={1.8} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const loadStats = useCallback(async () => {
    try {
      const data = await api.get('/admin/stats');
      setStats(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadStats(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadStats(); }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Sign out of admin panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} testID="admin-dashboard-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <Text style={styles.headerSub}>Welcome, {user?.name?.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity testID="admin-logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadWrap}><ActivityIndicator color="#FFF" /></View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Admin Badge */}
          <View style={styles.adminBadge}>
            <View style={styles.adminDot} />
            <Text style={styles.adminBadgeText}>ADMIN ACCESS — GREYADS PLATFORM</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <StatCard icon={Calendar} label="Events" value={stats?.total_events ?? 0} color="#3B82F6" />
            <StatCard icon={Users} label="Users" value={stats?.total_users ?? 0} color="#22C55E" />
            <StatCard icon={Ticket} label="Tickets" value={stats?.total_tickets ?? 0} color="#F59E0B" />
            <StatCard icon={Zap} label="Scans Today" value={stats?.todays_scans ?? 0} color="#7C3AED" />
          </View>

          {/* Revenue */}
          <View style={styles.revenueCard}>
            <View style={styles.revenueLeft}>
              <TrendingUp size={20} color="#22C55E" />
              <View>
                <Text style={styles.revenueLabel}>Total Revenue</Text>
                <Text style={styles.revenueValue}>₹{(stats?.total_revenue ?? 0).toLocaleString()}</Text>
              </View>
            </View>
            <View style={styles.revenueGrowth}>
              <Text style={styles.growthText}>+12.4%</Text>
              <Text style={styles.growthSub}>vs last month</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              testID="create-event-btn"
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/events/create')}
            >
              <Calendar size={22} color="#3B82F6" />
              <Text style={styles.actionLabel}>Create Event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="manage-events-btn"
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/events/')}
            >
              <Ticket size={22} color="#F59E0B" />
              <Text style={styles.actionLabel}>Manage Events</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="view-users-btn"
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/users')}
            >
              <Users size={22} color="#22C55E" />
              <Text style={styles.actionLabel}>View Users</Text>
            </TouchableOpacity>
          </View>

          {/* Recent Events */}
          <Text style={styles.sectionTitle}>Recent Events</Text>
          <View style={styles.recentList}>
            {(stats?.recent_events || []).map((event) => (
              <View key={event.id} style={styles.recentRow}>
                <View style={[styles.recentDot, { backgroundColor: '#3B82F6' }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentTitle} numberOfLines={1}>{event.title}</Text>
                  <Text style={styles.recentSub}>{event.venue} · ₹{event.price}</Text>
                </View>
                <Text style={styles.recentSeats}>{event.available_tickets} left</Text>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: COLORS.textTertiary, fontSize: 13, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 4 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#7C3AED15', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#7C3AED30', alignSelf: 'flex-start', marginBottom: 20 },
  adminDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C3AED' },
  adminBadgeText: { color: '#7C3AED', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  statValue: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: COLORS.textSecondary, fontSize: 12 },
  statSub: { color: COLORS.textTertiary, fontSize: 11 },
  revenueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 18, borderWidth: 1, borderColor: '#22C55E30', marginBottom: 24 },
  revenueLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  revenueLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4 },
  revenueValue: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  revenueGrowth: { alignItems: 'flex-end' },
  growthText: { color: '#22C55E', fontSize: 16, fontWeight: '800' },
  growthSub: { color: COLORS.textTertiary, fontSize: 11 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  actionLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  recentList: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recentSub: { color: COLORS.textSecondary, fontSize: 12 },
  recentSeats: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '600' },
});
