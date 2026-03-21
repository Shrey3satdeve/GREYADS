import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Calendar, CheckCircle, Info, Tag, Ticket } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS } from '../../constants/theme';

interface Notif {
  id: string;
  type: string;
  title: string;
  body: string;
  created_at: string;
  read: boolean;
}

const getIcon = (type: string) => {
  switch (type) {
    case 'ticket':
      return Ticket;
    case 'event':
      return Calendar;
    case 'promo':
      return Tag;
    case 'scan':
      return CheckCircle;
    default:
      return Info;
  }
};

const getAccent = (type: string) => {
  switch (type) {
    case 'ticket':
      return '#22C55E';
    case 'event':
      return '#3B82F6';
    case 'promo':
      return '#F59E0B';
    case 'scan':
      return '#22C55E';
    default:
      return '#7C3AED';
  }
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/notifications/my');
      const nextNotifications = (data.notifications || []).map((notification: any) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.message,
        created_at: notification.created_at,
        read: notification.is_read,
      }));
      setNotifications(nextNotifications);
    } catch (err) {
      console.error('Notifications load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications]),
  );

  const markAsRead = async (id: string) => {
    const target = notifications.find((notification) => notification.id === id);
    if (!target || target.read) {
      return;
    }

    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id ? { ...notification, read: true } : notification,
        ),
      );
    } catch (err) {
      console.error('Mark notification as read error:', err);
    }
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Bell size={22} color={COLORS.textPrimary} />
        <Text style={styles.headerTitle}>Notifications</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator color="#FFF" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor="#FFF" />}
        >
          {notifications.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Bell size={48} color={COLORS.textTertiary} strokeWidth={1} />
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptyText}>You&apos;ll see booking and event updates here.</Text>
            </View>
          ) : (
            notifications.map((notification) => {
              const Icon = getIcon(notification.type);
              const accent = getAccent(notification.type);
              const createdAt = notification.created_at ? new Date(notification.created_at) : null;
              const timeStr = createdAt
                ? createdAt.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Just now';

              return (
                <TouchableOpacity
                  key={notification.id}
                  testID={`notification-${notification.id}`}
                  style={[styles.notifCard, !notification.read && styles.notifUnread]}
                  activeOpacity={0.8}
                  onPress={() => markAsRead(notification.id)}
                >
                  <View style={[styles.notifIcon, { backgroundColor: accent + '15' }]}>
                    <Icon size={20} color={accent} strokeWidth={1.8} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={styles.notifHeader}>
                      <Text style={styles.notifTitle}>{notification.title}</Text>
                      {!notification.read && <View style={[styles.dot, { backgroundColor: accent }]} />}
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {notification.body}
                    </Text>
                    <Text style={styles.notifTime}>{timeStr}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 110 }} />
        </ScrollView>
      )}
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
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 180, paddingBottom: 100, gap: 12 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
});
