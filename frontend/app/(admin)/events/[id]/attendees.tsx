import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Users, Mail, Ticket, RotateCw } from 'lucide-react-native';
import { api } from '../../../../utils/api';
import { useDialog } from '../../../../components/AppDialog';

interface Attendee {
  id: string;
  user_name: string;
  user_email: string;
  quantity: number;
  status: string;
  created_at: string;
}

const COLORS = {
  background: '#000',
  surface: '#0A0A0A',
  surfaceLight: '#18181B',
  primary: '#FFF',
  secondary: '#71717A',
  accent: '#22C55E',
  border: '#18181B',
  text: '#FFF',
  textSecondary: '#A1A1AA',
  textTertiary: '#3F3F46',
};

export default function AttendeesScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();
  
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAttendees = async () => {
    try {
      const data = await api.get(`/admin/events/${id}/attendees`);
      setAttendees(data.attendees || []);
    } catch (error: any) {
      showDialog({ title: 'Error', message: error.message || 'Failed to fetch attendees' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAttendees();
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAttendees();
  };

  const renderAttendee = ({ item }: { item: Attendee }) => (
    <View style={styles.attendeeCard}>
      <View style={styles.attendeeInfo}>
        <Text style={styles.attendeeName}>{item.user_name}</Text>
        <View style={styles.metaRow}>
          <Mail size={12} color={COLORS.textSecondary} />
          <Text style={styles.attendeeEmail}>{item.user_email}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ticket size={12} color={COLORS.textSecondary} />
          <Text style={styles.attendeeEmail}>{item.quantity} Tickets</Text>
        </View>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: item.status === 'valid' ? '#14532D' : '#452222' }]}>
        <Text style={[styles.statusText, { color: item.status === 'valid' ? '#4ADE80' : '#F87171' }]}>
          {item.status.toUpperCase()}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={COLORS.text} size={24} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Attendees</Text>
          <Text style={styles.headerSub}>{attendees.length} total</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <RotateCw color={COLORS.text} size={20} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={attendees}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendee}
          contentContainerStyle={styles.list}
          onRefresh={onRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Users size={48} color={COLORS.textTertiary} />
              <Text style={styles.emptyText}>No attendees yet</Text>
            </View>
          }
        />
      )}

      {DialogComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  headerTitleContainer: { flex: 1, marginLeft: 12 },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: '800' },
  headerSub: { color: COLORS.textSecondary, fontSize: 12 },
  refreshBtn: { padding: 8 },
  list: { padding: 20 },
  attendeeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeeInfo: { flex: 1, gap: 4 },
  attendeeName: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  attendeeEmail: { color: COLORS.textSecondary, fontSize: 12, marginLeft: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  statusText: { fontSize: 10, fontWeight: '800' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, gap: 16 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '500' },
});
