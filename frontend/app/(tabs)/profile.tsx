import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User, Mail, Phone, ChevronRight, LogOut, Bell, Shield,
  HelpCircle, Settings, Star, Ticket, Clock, Edit3, X
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useDialog } from '../../components/AppDialog';

function StatsItem({ icon: Icon, value, label }: any) {
  return (
    <View style={styles.statsItem}>
      <View style={styles.statsIconWrap}>
        <Icon size={16} color={COLORS.textPrimary} />
      </View>
      <View>
        <Text style={styles.statsValue}>{value}</Text>
        <Text style={styles.statsLabel}>{label}</Text>
      </View>
    </View>
  );
}

function MenuRow({ icon: Icon, label, onPress, danger, rightText }: any) {
  return (
    <TouchableOpacity
      testID={`menu-${label.replace(/\s/g, '-').toLowerCase()}`}
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
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
  const { user, updateUser, logout } = useAuth();
  const [stats, setStats] = useState({ tickets: 0, notifications: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { showDialog, DialogComponent } = useDialog();

  const fetchStats = useCallback(async () => {
    try {
      const [ticketsRes, notifsRes] = await Promise.all([
        api.get('/tickets/my'),
        api.get('/notifications/my')
      ]);
      setStats({
        tickets: ticketsRes.tickets?.length || 0,
        notifications: notifsRes.notifications?.filter((n: any) => !n.is_read).length || 0
      });
    } catch (err) {
      console.error('Fetch Stats Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Sync edit fields when user data changes or modal opens
  useEffect(() => {
    if (editModal) {
      setEditName(user?.name || '');
      setEditPhone(user?.phone || '');
    }
  }, [editModal, user]);

  const handleUpdate = async () => {
    if (!editName.trim()) {
      showDialog({ title: 'Error', message: 'Name cannot be empty' });
      return;
    }
    setSaving(true);
    try {
      await updateUser({ name: editName.trim(), phone: editPhone.trim() });
      setEditModal(false);
      showDialog({ title: 'Success ✅', message: 'Profile updated successfully' });
    } catch (err) {
      showDialog({ title: 'Error', message: 'Failed to update profile' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    showDialog({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      buttons: [
        { label: 'Cancel', style: 'cancel' },
        {
          label: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/onboarding');
          },
        },
      ],
    });
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'New Member';

  const roleConfig = {
    user: { label: 'User', color: '#3B82F6' },
    staff: { label: 'Staff', color: '#22C55E' },
    admin: { label: 'Admin', color: '#7C3AED' }
  }[user?.role || 'user'];

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen">
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setEditModal(true)}>
            <Edit3 size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName} numberOfLines={1}>{user?.name}</Text>
            <View style={styles.roleRow}>
              <View style={[styles.roleBadge, { backgroundColor: roleConfig.color + '20' }]}>
                <Text style={[styles.roleText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dynamic Stats */}
        <View style={styles.statsCard}>
          <StatsItem icon={Ticket} value={stats.tickets} label="Tickets" />
          <View style={styles.statsDivider} />
          <StatsItem icon={Bell} value={stats.notifications} label="Pending" />
          <View style={styles.statsDivider} />
          <StatsItem icon={Clock} value={memberSince} label="Joined" />
        </View>

        {/* Info rows */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Mail size={15} color={COLORS.textTertiary} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          {(user?.phone || editModal) && (
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
              <Phone size={15} color={COLORS.textTertiary} />
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Not set'}</Text>
            </View>
          )}
        </View>

        {/* Menu Groups */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={Bell} label="Notifications" onPress={() => { }} rightText={stats.notifications > 0 ? 'On' : 'Off'} />
          <MenuRow icon={Settings} label="App Settings" onPress={() => { }} />
        </View>

        <Text style={styles.sectionLabel}>Support</Text>
        <View style={styles.menuCard}>
          <MenuRow icon={HelpCircle} label="Help & FAQ" onPress={() => showDialog({ title: 'Help & Support', message: 'Contact us at support@greyads.com' })} />
          <MenuRow icon={Star} label="Rate the App" onPress={() => { }} />
          <MenuRow icon={Shield} label="Privacy Policy" onPress={() => { }} />
        </View>

        <View style={styles.menuCard}>
          <MenuRow icon={LogOut} label="Sign Out" onPress={handleLogout} danger />
        </View>

        <Text style={styles.versionText}>GreyAdz v1.0.3 Premium</Text>
        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <X size={20} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="Enter your name"
                  placeholderTextColor={COLORS.textTertiary}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>PHONE NUMBER</Text>
                <TextInput
                  style={styles.fieldInput}
                  value={editPhone}
                  onChangeText={setEditPhone}
                  placeholder="+91 00000 00000"
                  placeholderTextColor={COLORS.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleUpdate}
                disabled={saving}
              >
                {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE CHANGES</Text>}
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
  scroll: { padding: SPACING.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.lg },
  headerTitle: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  editBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  avatarCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: COLORS.border, marginBottom: 20 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#27272A', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  avatarInitial: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800' },
  userName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  roleRow: { flexDirection: 'row' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  statsCard: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 24, justifyContent: 'space-between' },
  statsItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  statsIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: COLORS.bgTertiary, alignItems: 'center', justifyContent: 'center' },
  statsValue: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700' },
  statsLabel: { color: COLORS.textTertiary, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statsDivider: { width: 1, height: 24, backgroundColor: COLORS.border },

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

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 24, borderTopWidth: 1, borderTopColor: COLORS.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '800' },
  modalBody: { gap: 20 },
  field: { gap: 8 },
  fieldLabel: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  fieldInput: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 14, color: COLORS.textPrimary, fontSize: 16, borderWidth: 1, borderColor: COLORS.border },
  saveBtn: { backgroundColor: COLORS.textPrimary, borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: COLORS.bg, fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
