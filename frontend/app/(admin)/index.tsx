import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Platform,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LogOut, TrendingUp, Users, Ticket, Calendar, ChevronRight, Zap, RotateCw, Send, X, Star } from 'lucide-react-native';
import BrandMark from '../../components/BrandMark';
import { api } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { rs } from '../../utils/responsive';
import { useDialog } from '../../components/AppDialog';
import { LinearGradient } from 'expo-linear-gradient';

interface Stats {
  total_events: number;
  total_users: number;
  total_tickets: number;
  total_revenue: number;
  todays_scans: number;
  revenue_change_pct: number | null;
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
  const { showDialog, DialogComponent } = useDialog();

  // Broadcast State
  const [broadcastVisible, setBroadcastVisible] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMessage, setBcMessage] = useState('');
  const [bcLoading, setBcLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data: any = await api.get('/admin/stats');
      setStats(data);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadStats(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadStats(); }, []);

  const handleLogout = () => {
    showDialog({
      title: 'Sign Out',
      message: 'Sign out of admin panel?',
      buttons: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Sign Out', style: 'destructive', onPress: async () => {
            await logout();
            router.replace('/onboarding');
          }
        },
      ],
    });
  };

  const handleBroadcast = async () => {
    if (!bcTitle || !bcMessage) return;
    setBcLoading(true);
    try {
      await api.post('/admin/broadcast', { title: bcTitle, message: bcMessage });
      showDialog({ title: 'Success', message: 'Broadcast sent to all users!' });
      setBroadcastVisible(false);
      setBcTitle('');
      setBcMessage('');
    } catch (err: any) {
      showDialog({ title: 'Error', message: err.message || 'Failed to send broadcast' });
    } finally {
      setBcLoading(false);
    }
  };

  const revenueChange = typeof stats?.revenue_change_pct === 'number'
    ? `${stats.revenue_change_pct > 0 ? '+' : ''}${stats.revenue_change_pct.toFixed(1)}%`
    : 'New';
  const revenueChangeLabel = typeof stats?.revenue_change_pct === 'number'
    ? 'vs previous month'
    : 'No prior month data';

  return (
    <SafeAreaView style={styles.safe} testID="admin-dashboard-screen">
      {DialogComponent}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image 
            source={require('../../assets/images/greyadz-logo-v3.png')}
            style={{ width: 44, height: 44 }}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSub}>Welcome, {user?.name?.split(' ')[0]}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity testID="admin-refresh-btn" style={styles.logoutBtn} onPress={onRefresh} disabled={refreshing}>
            <RotateCw size={18} color={refreshing ? COLORS.textTertiary : COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity testID="admin-logout-btn" style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
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
              <Text style={styles.growthText}>{revenueChange}</Text>
              <Text style={styles.growthSub}>{revenueChangeLabel}</Text>
            </View>
          </View>

          {/* Broadcast Banner */}
          <TouchableOpacity 
            style={styles.bcBanner}
            activeOpacity={0.9}
            onPress={() => setBroadcastVisible(true)}
          >
            <LinearGradient
              colors={['#7C3AED', '#5B21B6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bcInner}
            >
              <View style={styles.bcIconWrap}>
                <Send size={24} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.bcTitle}>Broadcast Message</Text>
                <Text style={styles.bcSub}>Send alerts or marketing to all users</Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

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
              onPress={() => router.push('/(admin)/events')}
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
            {(stats?.recent_events || []).length === 0 ? (
              <View style={styles.emptyRecent}>
                <Text style={styles.emptyRecentText}>No live event data yet.</Text>
              </View>
            ) : (
              (stats?.recent_events || []).map((event) => (
                <View key={event.id} style={styles.recentRow}>
                  <View style={[styles.recentDot, { backgroundColor: '#3B82F6' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentTitleText} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.recentSub}>{`Rs. ${event.price} · ${event.venue}`}</Text>
                  </View>
                  <Text style={styles.recentSeats}>{event.available_tickets} left</Text>
                </View>
              ))
            )}
          </View>

          {/* Latest Recommendation Panel */}
          <Text style={styles.sectionTitle}>Latest Recommendations</Text>
          <View style={styles.recentList}>
            {(stats?.recent_events || []).filter(e => e.is_recommended).length === 0 ? (
              <View style={styles.emptyRecent}>
                <Text style={styles.emptyRecentText}>No recommended events yet.</Text>
              </View>
            ) : (
              (stats?.recent_events || []).filter(e => e.is_recommended).map((event) => (
                <View key={event.id} style={styles.recentRow}>
                  <Star size={16} color="#F59E0B" fill="#F59E0B" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recentTitleText} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.recentSub}>{event.category} · {event.venue}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.removeRecBtn}
                    onPress={async () => {
                      try {
                        await api.patch(`/events/${event.id}`, { is_recommended: false });
                        loadStats();
                      } catch (err: any) {
                        showDialog({ title: 'Error', message: err.message });
                      }
                    }}
                  >
                    <X size={14} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))
            )}
            <TouchableOpacity 
              style={styles.addRecFooter}
              onPress={() => router.push('/(admin)/events')}
            >
              <Text style={styles.addRecText}>Manage all recommendations</Text>
              <ChevronRight size={14} color={COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={{ height: 110 }} />
        </ScrollView>
      )}

      {/* Broadcast Modal */}
      <Modal visible={broadcastVisible} transparent animationType="slide" onRequestClose={() => setBroadcastVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>New Broadcast</Text>
                <TouchableOpacity onPress={() => setBroadcastVisible(false)}>
                  <X size={20} color={COLORS.textTertiary} />
                </TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. New Event Live! 🎫"
                placeholderTextColor={COLORS.textDisabled}
                value={bcTitle}
                onChangeText={setBcTitle}
              />
              
              <Text style={styles.inputLabel}>Message Body</Text>
              <TextInput
                style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Details of the marketing or update..."
                placeholderTextColor={COLORS.textDisabled}
                multiline
                value={bcMessage}
                onChangeText={setBcMessage}
              />

              <TouchableOpacity 
                style={[styles.sendBtn, (!bcTitle || !bcMessage || bcLoading) && { opacity: 0.5 }]}
                disabled={!bcTitle || !bcMessage || bcLoading}
                onPress={handleBroadcast}
              >
                {bcLoading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Send size={18} color="#000" />
                    <Text style={styles.sendBtnText}>Send to All Users</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {DialogComponent}
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
  bcBanner: { marginBottom: 24, borderRadius: 20, overflow: 'hidden', elevation: 8, shadowColor: '#7C3AED', shadowOpacity: 0.3, shadowRadius: 12 },
  bcInner: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  bcIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  bcTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  bcSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: 12 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.border },
  actionLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  recentList: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  recentTitleText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  recentSub: { color: COLORS.textSecondary, fontSize: 12 },
  recentSeats: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '600' },
  emptyRecent: { padding: 18, alignItems: 'center' },
  emptyRecentText: { color: COLORS.textTertiary, fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bgCard, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 40, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  inputLabel: { color: COLORS.textTertiary, fontSize: 13, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: COLORS.bg, borderRadius: 16, padding: 16, color: COLORS.textPrimary, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  sendBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
  removeRecBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  addRecFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rs(6), paddingVertical: 14, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  addRecText: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '600' },
});
