import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, Phone, ChevronRight, LogOut, Bell, Shield, HelpCircle, Settings, Star } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

function MenuRow({ icon: Icon, label, onPress, danger, rightText }: any) {
  return (
    <TouchableOpacity testID={`menu-${label.replace(/\s/g, '-').toLowerCase()}`} style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && { backgroundColor: '#7F1D1D20' }]}>
        <Icon size={18} color={danger ? COLORS.error : COLORS.textSecondary} strokeWidth={1.8} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: COLORS.error }]}>{label}</Text>
      {rightText && <Text style={styles.menuRight}>{rightText}</Text>}
      <ChevronRight size={16} color={COLORS.textTertiary} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const roleBadge = { user: { label: 'User', color: '#3B82F6' }, staff: { label: 'Staff', color: '#22C55E' }, admin: { label: 'Admin', color: '#7C3AED' } }[user?.role || 'user'];

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.name}</Text>
            <View style={styles.roleRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleBadge.color + '20' }]}>
                <Text style={[styles.roleText, { color: roleBadge.color }]}>{roleBadge.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Mail size={15} color={COLORS.textTertiary} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          {user?.phone && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
              <Phone size={15} color={COLORS.textTertiary} />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          )}
        </View>

        {/* Menu Groups */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={Bell} label="Notifications" onPress={() => {}} rightText="On" />
          <MenuRow icon={Settings} label="App Settings" onPress={() => {}} />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={HelpCircle} label="Help & FAQ" onPress={() => {}} />
          <MenuRow icon={Star} label="Rate the App" onPress={() => {}} />
          <MenuRow icon={Shield} label="Privacy Policy" onPress={() => {}} />
        </View>

        <View style={styles.menuCard}>
          <MenuRow icon={LogOut} label="Sign Out" onPress={handleLogout} danger />
        </View>

        <Text style={styles.versionText}>GreyAdz v1.0</Text>
        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg },
  header: { marginBottom: SPACING.lg },
  headerTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  avatarCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  avatarInitial: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  userName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  roleRow: { flexDirection: 'row' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  infoLabel: { color: COLORS.textSecondary, fontSize: 13, width: 50 },
  infoValue: { color: COLORS.textPrimary, fontSize: 13, flex: 1, textAlign: 'right' },
  sectionLabel: { color: COLORS.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8, marginTop: 4 },
  menuCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border, marginBottom: 16, overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderBottomWidth: 0.5, borderBottomColor: COLORS.border },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: COLORS.textPrimary, fontSize: 15, flex: 1 },
  menuRight: { color: COLORS.textTertiary, fontSize: 13 },
  versionText: { color: COLORS.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
