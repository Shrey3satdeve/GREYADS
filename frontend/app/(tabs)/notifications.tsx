import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Ticket, Calendar, Tag, CheckCircle } from 'lucide-react-native';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const NOTIFS = [
  { id: '1', type: 'ticket', title: 'Booking Confirmed!', body: 'Your ticket for Neon Dreams Music Festival is ready.', time: '2 mins ago', read: false, icon: Ticket, accent: '#22C55E' },
  { id: '2', type: 'event', title: 'Event Tomorrow', body: 'Tech Summit 2026 starts tomorrow at 9:00 AM. Don\'t be late!', time: '1 hr ago', read: false, icon: Calendar, accent: '#3B82F6' },
  { id: '3', type: 'promo', title: 'Early Bird Offer 🎉', body: 'Get 20% off on Street Food Carnival tickets. Limited seats!', time: '2 hrs ago', read: true, icon: Tag, accent: '#F59E0B' },
  { id: '4', type: 'ticket', title: 'Ticket Scanned', body: 'Your ticket was successfully scanned at the event gate.', time: '1 day ago', read: true, icon: CheckCircle, accent: '#22C55E' },
  { id: '5', type: 'event', title: 'New Event Added', body: 'Midnight Rave has been added. Book early for the best price!', time: '2 days ago', read: true, icon: Bell, accent: '#7C3AED' },
];

export default function NotificationsScreen() {
  const unread = NOTIFS.filter(n => !n.read).length;

  return (
    <SafeAreaView style={styles.safe} testID="notifications-screen">
      <View style={styles.header}>
        <Bell size={22} color={COLORS.textPrimary} />
        <Text style={styles.headerTitle}>Notifications</Text>
        {unread > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {NOTIFS.map((n) => (
          <TouchableOpacity
            key={n.id}
            testID={`notification-${n.id}`}
            style={[styles.notifCard, !n.read && styles.notifUnread]}
            activeOpacity={0.8}
          >
            <View style={[styles.notifIcon, { backgroundColor: n.accent + '15' }]}>
              <n.icon size={20} color={n.accent} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.notifHeader}>
                <Text style={styles.notifTitle}>{n.title}</Text>
                {!n.read && <View style={[styles.dot, { backgroundColor: n.accent }]} />}
              </View>
              <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
              <Text style={styles.notifTime}>{n.time}</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800', flex: 1, letterSpacing: -0.5 },
  badge: { backgroundColor: COLORS.error, borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  scroll: { padding: 20, gap: 10 },
  notifCard: { flexDirection: 'row', gap: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  notifUnread: { borderColor: 'rgba(255,255,255,0.12)', backgroundColor: '#131313' },
  notifIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  notifHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  notifTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  notifBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19 },
  notifTime: { color: COLORS.textTertiary, fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
