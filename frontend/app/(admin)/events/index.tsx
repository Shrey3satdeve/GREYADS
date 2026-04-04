import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Calendar, MapPin, Trash2, Users, RotateCw, TrendingUp } from 'lucide-react-native';
import { api } from '../../../utils/api';
import { COLORS, CATEGORY_COLORS, RADIUS, SPACING } from '../../../constants/theme';
import { useDialog } from '../../../components/AppDialog';

interface EventItem {
  id: string;
  title: string;
  date: string;
  venue: string;
  category: string;
  price: number;
  total_tickets: number;
  available_tickets: number;
  status: string;
}

export default function AdminEventsScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();

  const loadEvents = useCallback(async () => {
    try {
      const data = await api.get('/events?limit=50');
      setEvents(data.events || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadEvents(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadEvents(); }, []);

  const deleteEvent = (id: string, title: string) => {
    showDialog({
      title: 'Delete Event',
      message: `Are you sure you want to delete "${title}"? This cannot be undone.`,
      buttons: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await api.delete(`/events/${id}`);
              setEvents(ev => ev.filter(e => e.id !== id));
            } catch { showDialog({ title: 'Error', message: 'Failed to delete event' }); }
          }
        },
      ],
    });
  };

  const renderEvent = ({ item }: { item: EventItem }) => {
    const catColor = CATEGORY_COLORS[item.category] || '#FFF';
    const soldPct = Math.round(((item.total_tickets - item.available_tickets) / item.total_tickets) * 100);

    return (
      <View testID={`admin-event-${item.id}`} style={styles.eventCard}>
        <View style={styles.eventTop}>
          <View style={[styles.catDot, { backgroundColor: catColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={[styles.catLabel, { color: catColor }]}>{item.category}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>₹{item.price.toLocaleString()}</Text>
          </View>
          <TouchableOpacity
            testID={`delete-event-${item.id}`}
            style={styles.deleteBtn}
            onPress={() => deleteEvent(item.id, item.title)}
          >
            <Trash2 size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <Calendar size={12} color={COLORS.textTertiary} />
          <Text style={styles.metaText}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
          <MapPin size={12} color={COLORS.textTertiary} style={{ marginLeft: 8 }} />
          <Text style={styles.metaText} numberOfLines={1}>{item.venue}</Text>
        </View>

        {/* Capacity bar - Clickable to view attendees */}
        <View style={styles.eventFooter}>
          <TouchableOpacity 
            style={styles.capacityRow}
            onPress={() => router.push(`/(admin)/events/${item.id}/attendees` as any)}
            activeOpacity={0.7}
          >
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${soldPct}%`, backgroundColor: soldPct > 80 ? COLORS.error : '#22C55E' }]} />
            </View>
            <View style={styles.capacityMeta}>
              <Users size={10} color={COLORS.textTertiary} />
              <Text style={styles.capacityText}>{item.available_tickets}/{item.total_tickets}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.analyticsBtn}
            onPress={() => router.push(`/(admin)/events/${item.id}/analytics` as any)}
          >
             <TrendingUp size={14} color="#FFEE00" />
             <Text style={styles.analyticsBtnText}>ANALYTICS</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="admin-events-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Events</Text>
          <Text style={styles.headerSub}>{events.length} total</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity 
            testID="admin-refresh-events-btn"
            style={[styles.fab, { backgroundColor: 'transparent', borderWidth: 1, borderColor: COLORS.border }]}
            onPress={onRefresh}
            disabled={refreshing}
          >
            <RotateCw size={20} color={refreshing ? COLORS.textTertiary : COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="create-event-fab"
            style={styles.fab}
            onPress={() => router.push('/(admin)/events/create')}
          >
            <Plus size={20} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadWrap}><ActivityIndicator color="#FFF" /></View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.id}
          renderItem={renderEvent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Calendar size={40} color={COLORS.textTertiary} strokeWidth={1} />
              <Text style={styles.emptyText}>No events yet</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(admin)/events/create')}>
                <Text style={styles.createBtnText}>Create First Event</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
      {DialogComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: COLORS.textTertiary, fontSize: 13, marginTop: 2 },
  fab: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.btnPrimary, alignItems: 'center', justifyContent: 'center', shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, gap: 10, paddingBottom: 110 },
  eventCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  eventTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  catDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  catLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  priceTag: { backgroundColor: COLORS.bgTertiary, borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4 },
  priceText: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  metaText: { color: COLORS.textSecondary, fontSize: 11, flex: 1 },
  capacityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBg: { flex: 1, height: 4, backgroundColor: COLORS.bgTertiary, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  capacityMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  capacityText: { color: COLORS.textTertiary, fontSize: 11 },
  deleteBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.error + '15', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 48, gap: 12 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16 },
  createBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: 24, paddingVertical: 12 },
  createBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  analyticsBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFEE0015', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FFEE0030' },
  analyticsBtnText: { color: '#FFEE00', fontSize: 10, fontWeight: '800' },
});
