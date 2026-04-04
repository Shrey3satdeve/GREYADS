import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, TrendingUp, Users, Ticket, Zap, Calendar, MapPin, ChevronRight, Clock } from 'lucide-react-native';
import { api } from '../../../../utils/api';
import { COLORS, RADIUS } from '../../../../constants/theme';
import { useDialog } from '../../../../components/AppDialog';

const { width } = Dimensions.get('window');

interface EventAnalytics {
  event: any;
  tickets: any[];
  logs: any[];
  stats: {
    totalRevenue: number;
    soldCount: number;
    insideCount: number;
    exitedCount: number;
    pendingCount: number;
  };
}

export default function EventAnalyticsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();

  const [data, setData] = useState<EventAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const [evRes, ticketRes, logRes] = await Promise.all([
        api.get(`/events/${id}`),
        api.get(`/admin/events/${id}/attendees`),
        api.get(`/scanner/history?event_id=${id}`)
      ]);

      const tickets = ticketRes.attendees || [];
      const logs = logRes.logs || [];
      
      const stats = {
        totalRevenue: tickets.reduce((acc: number, t: any) => acc + (t.total_price || 0), 0),
        soldCount: tickets.reduce((acc: number, t: any) => acc + (t.quantity || 1), 0),
        insideCount: tickets.filter((t: any) => t.status === 'inside').reduce((acc: number, t: any) => acc + (t.quantity || 1), 0),
        exitedCount: tickets.filter((t: any) => t.status === 'exited').reduce((acc: number, t: any) => acc + (t.quantity || 1), 0),
        pendingCount: tickets.filter((t: any) => t.status === 'valid').reduce((acc: number, t: any) => acc + (t.quantity || 1), 0),
      };

      setData({
        event: evRes.event,
        tickets,
        logs,
        stats
      });
    } catch (error: any) {
      showDialog({ title: 'Error', message: error.message || 'Failed to fetch analytics' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, showDialog]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFEE00" size="large" />
      </View>
    );
  }

  const { event, stats, logs } = data;
  const soldPct = Math.min(100, Math.round((stats.soldCount / event.total_tickets) * 100));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={COLORS.textPrimary} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
          <Text style={styles.headerSub}>EVENT ANALYTICS & INSIGHTS</Text>
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFEE00" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Event Quick Info */}
        <View style={styles.eventInfoCard}>
           <View style={styles.infoRow}>
              <Calendar size={14} color={COLORS.textTertiary} />
              <Text style={styles.infoText}>{new Date(event.date).toDateString()}</Text>
              <View style={styles.dot} />
              <MapPin size={14} color={COLORS.textTertiary} />
              <Text style={styles.infoText} numberOfLines={1}>{event.venue}</Text>
           </View>
        </View>

        {/* Revenue Card */}
        <View style={styles.revenueCard}>
           <View style={styles.revLeft}>
              <TrendingUp size={24} color="#22C55E" />
              <View>
                 <Text style={styles.cardLabel}>TOTAL REVENUE</Text>
                 <Text style={styles.cardValue}>₹{stats.totalRevenue.toLocaleString()}</Text>
              </View>
           </View>
           <View style={styles.revRight}>
              <Text style={styles.revSub}>Price: ₹{event.price}</Text>
           </View>
        </View>

        {/* Attendance Summary */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
             <Ticket size={20} color="#3B82F6" />
             <Text style={styles.statNum}>{stats.soldCount}</Text>
             <Text style={styles.statLabel}>Tickets Sold</Text>
          </View>
          <View style={styles.statBox}>
             <Zap size={20} color="#FFEE00" />
             <Text style={styles.statNum}>{stats.insideCount}</Text>
             <Text style={styles.statLabel}>Currently Inside</Text>
          </View>
          <View style={styles.statBox}>
             <Clock size={20} color="#7C3AED" />
             <Text style={styles.statNum}>{stats.exitedCount}</Text>
             <Text style={styles.statLabel}>Already Exited</Text>
          </View>
        </View>

        {/* Capacity Progress */}
        <View style={styles.sectionCard}>
           <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Sales Performance</Text>
              <Text style={styles.sectionValue}>{soldPct}%</Text>
           </View>
           <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${soldPct}%`, backgroundColor: soldPct > 90 ? '#EF4444' : '#22C55E' }]} />
           </View>
           <Text style={styles.progressSub}>{event.available_tickets} tickets remaining out of {event.total_tickets}</Text>
        </View>

        {/* Attendance Status List */}
        <View style={styles.sectionCard}>
           <Text style={styles.sectionTitle}>Attendee Breakdown</Text>
           <View style={styles.breakdownRow}>
              <View style={styles.breakdownItem}>
                 <View style={[styles.statusDot, { backgroundColor: '#FFEE00' }]} />
                 <Text style={styles.breakdownText}>Checked In: <Text style={{fontWeight:'800'}}>{stats.insideCount}</Text></Text>
              </View>
              <View style={styles.breakdownItem}>
                 <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
                 <Text style={styles.breakdownText}>Pending: <Text style={{fontWeight:'800'}}>{stats.pendingCount}</Text></Text>
              </View>
           </View>
           
           <TouchableOpacity 
             style={styles.viewAllBtn}
             onPress={() => router.push(`/(admin)/events/${id}/attendees` as any)}
           >
              <Text style={styles.viewAllText}>View Full Attendee List</Text>
              <ChevronRight size={16} color="#FFEE00" />
           </TouchableOpacity>
        </View>

        {/* Recent Scans */}
        <Text style={styles.listHeader}>Recent Scan Activity</Text>
        {logs.length === 0 ? (
           <View style={styles.emptyLogs}>
              <Text style={styles.emptyLogsText}>No scans recorded for this event yet.</Text>
           </View>
        ) : (
          <View style={styles.logList}>
            {logs.slice(0, 10).map((log, idx) => (
              <View key={log.id} style={[styles.logItem, idx === logs.slice(0, 10).length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[styles.logIcon, { backgroundColor: log.type === 'Entrance' ? '#22C55E20' : '#EF444420' }]}>
                   <Zap size={14} color={log.type === 'Entrance' ? '#22C55E' : '#EF4444'} />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.logTitle}>{log.user_name}</Text>
                   <Text style={styles.logSub}>{log.type} • {log.guest_count} Guest(s) • Staff: {log.staff_name}</Text>
                </View>
                <Text style={styles.logTime}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
      {DialogComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backBtn: { padding: 4 },
  headerTitleContainer: { flex: 1, marginLeft: 15 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' },
  headerSub: { color: COLORS.textTertiary, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: 2 },
  scroll: { padding: 20 },
  eventInfoCard: { marginBottom: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
  dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: COLORS.textTertiary, marginHorizontal: 4 },
  
  revenueCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#22C55E30', marginBottom: 20 },
  revLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cardLabel: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  cardValue: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  revRight: { alignItems: 'flex-end' },
  revSub: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600' },
  
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.border },
  statNum: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: COLORS.textTertiary, fontSize: 10, fontWeight: '600' },
  
  sectionCard: { backgroundColor: COLORS.bgCard, borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  sectionValue: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  progressBg: { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: 'hidden', marginBottom: 10 },
  progressFill: { height: '100%', borderRadius: 4 },
  progressSub: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '500' },
  
  breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, marginBottom: 20 },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownText: { color: COLORS.textSecondary, fontSize: 12 },
  
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 5 },
  viewAllText: { color: '#FFEE00', fontSize: 13, fontWeight: '700' },
  
  listHeader: { color: COLORS.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 15 },
  logList: { backgroundColor: COLORS.bgCard, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  logItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 15 },
  logIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  logSub: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  logTime: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '600' },
  emptyLogs: { padding: 40, alignItems: 'center', backgroundColor: COLORS.bgCard, borderRadius: 24, borderWidth: 1, borderColor: COLORS.border },
  emptyLogsText: { color: COLORS.textTertiary, fontSize: 13 },
});
