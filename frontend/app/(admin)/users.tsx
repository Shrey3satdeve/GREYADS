import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Crown, Shield, User } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  created_at: string;
}

const ROLE_CONFIG = {
  admin: { icon: Crown, color: '#7C3AED', label: 'Admin', bg: '#7C3AED20' },
  staff: { icon: Shield, color: '#22C55E', label: 'Staff', bg: '#22C55E20' },
  user: { icon: User, color: '#3B82F6', label: 'User', bg: '#3B82F620' },
};

export default function UsersScreen() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.get('/admin/users');
      setUsers(data.users || []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadUsers(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); loadUsers(); }, []);

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const renderUser = ({ item }: { item: UserItem }) => {
    const roleConf = ROLE_CONFIG[item.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.user;
    return (
      <View testID={`user-row-${item.id}`} style={styles.userRow}>
        <View style={[styles.avatar, { backgroundColor: roleConf.bg }]}>
          <Text style={[styles.avatarText, { color: roleConf.color }]}>{item.name[0]?.toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.userPhone}>{item.phone}</Text>}
        </View>
        <View style={[styles.roleBadge, { backgroundColor: roleConf.bg }]}>
          <roleConf.icon size={10} color={roleConf.color} />
          <Text style={[styles.roleText, { color: roleConf.color }]}>{roleConf.label}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="admin-users-screen">
      <View style={styles.header}>
        <Users size={22} color={COLORS.textPrimary} />
        <Text style={styles.headerTitle}>Users</Text>
        <Text style={styles.headerCount}>{users.length}</Text>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        {Object.entries(ROLE_CONFIG).map(([role, conf]) => (
          <View key={role} style={[styles.summaryCard, { borderColor: conf.color + '30' }]}>
            <conf.icon size={16} color={conf.color} strokeWidth={1.8} />
            <Text style={[styles.summaryCount, { color: conf.color }]}>{roleCounts[role] || 0}</Text>
            <Text style={styles.summaryLabel}>{conf.label}s</Text>
          </View>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadWrap}><ActivityIndicator color="#FFF" /></View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={item => item.id}
          renderItem={renderUser}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', flex: 1, letterSpacing: -0.5 },
  headerCount: { color: COLORS.textTertiary, fontSize: 13, backgroundColor: COLORS.bgCard, paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  summaryRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 12, alignItems: 'center', gap: 4, borderWidth: 1 },
  summaryCount: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { color: COLORS.textTertiary, fontSize: 11 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingBottom: 110, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, marginHorizontal: 20, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '800' },
  userName: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  userEmail: { color: COLORS.textSecondary, fontSize: 12 },
  userPhone: { color: COLORS.textTertiary, fontSize: 11 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: RADIUS.full },
  roleText: { fontSize: 10, fontWeight: '700' },
  separator: { height: 0.5, backgroundColor: COLORS.border },
});
