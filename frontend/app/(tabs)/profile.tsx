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
import { rs, rf } from '../../utils/responsive';



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

  const roleConfig = ({
    user: { label: 'User', color: '#3B82F6' },
    staff: { label: 'Staff', color: '#22C55E' },
    admin: { label: 'Admin', color: '#7C3AED' },
    superuser: { label: 'Superuser', color: '#7C3AED' }
  } as any)[user?.role || 'user'] || { label: 'User', color: '#3B82F6' };

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen">
      <ScrollView 
        contentContainerStyle={styles.scroll} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.textPrimary} />
        }
      >
        {/* Premium Profile Header */}
        <View style={styles.profileHeader}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.headerEditBtn} onPress={() => setEditModal(true)}>
            <Edit3 size={rf(18)} color="#FFF" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        {/* User Identity Card */}
        <View style={styles.userIdCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
          </View>
          <View style={styles.userMeta}>
            <Text style={styles.displayName}>{user?.name}</Text>
            <View style={[styles.roleLabelPill, { backgroundColor: roleConfig.color + '15' }]}>
              <Text style={[styles.roleLabelText, { color: roleConfig.color }]}>{roleConfig.label}</Text>
            </View>
          </View>
        </View>

        {/* Systematic Stats Row */}
        <View style={styles.statsGlassCard}>
          <View style={styles.statUnit}>
            <Ticket size={rf(14)} color={COLORS.textTertiary} strokeWidth={2.2} />
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{stats.tickets}</Text>
              <Text style={styles.statLabel}>Tickets</Text>
            </View>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.statUnit}>
            <Bell size={rf(14)} color={COLORS.textTertiary} strokeWidth={2.2} />
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{stats.notifications}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
          <View style={styles.vDivider} />
          <View style={styles.statUnit}>
            <Clock size={rf(14)} color={COLORS.textTertiary} strokeWidth={2.2} />
            <View style={styles.statInfo}>
              <Text style={styles.statValue}>{memberSince.split(' ')[0]}</Text>
              <Text style={styles.statLabel}>{memberSince.split(' ')[1] || 'Joined'}</Text>
            </View>
          </View>
        </View>

        {/* Account Details */}
        <View style={styles.detailsBox}>
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Mail size={rf(14)} color={COLORS.textTertiary} strokeWidth={2} />
              <Text style={styles.detailLabel}>Email</Text>
            </View>
            <Text style={styles.detailValue} numberOfLines={1}>{user?.email}</Text>
          </View>
          
          <View style={styles.hDivider} />
          
          <View style={styles.detailRow}>
            <View style={styles.detailLeft}>
              <Phone size={rf(14)} color={COLORS.textTertiary} strokeWidth={2} />
              <Text style={styles.detailLabel}>Phone</Text>
            </View>
            <Text style={styles.detailValue}>{user?.phone || 'Not linked'}</Text>
          </View>
        </View>

        {/* Actions & Settings */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Preferences</Text>
        </View>
        <View style={styles.actionCard}>
          <MenuRow icon={Bell} label="Notifications" onPress={() => { }} rightText={stats.notifications > 0 ? 'On' : 'Off'} />
          <MenuRow icon={Settings} label="App Settings" onPress={() => { }} />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>Support</Text>
        </View>
        <View style={styles.actionCard}>
          <MenuRow icon={HelpCircle} label="Help & FAQ" onPress={() => showDialog({ title: 'Help & Support', message: 'Contact us at support@greyads.com' })} />
          <MenuRow icon={Star} label="Rate the App" onPress={() => { }} />
          <MenuRow icon={Shield} label="Privacy Policy" onPress={() => { }} />
        </View>

        <TouchableOpacity style={styles.logoutCard} onPress={handleLogout}>
          <View style={styles.logoutIconWrap}>
            <LogOut size={rf(16)} color={COLORS.error} strokeWidth={2.2} />
          </View>
          <Text style={styles.logoutLabel}>Sign Out</Text>
          <ChevronRight size={rf(14)} color={COLORS.textTertiary} />
        </TouchableOpacity>

        <Text style={styles.footerVersion}>GreyAdz v1.0.35 Premium Edition</Text>
        <View style={{ height: rs(100) }} />
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
  scroll: { paddingHorizontal: rs(20), paddingTop: rs(10) },
  
  profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(24) },
  headerTitle: { color: '#FFF', fontSize: rf(28), fontWeight: '800', letterSpacing: -0.8 },
  headerEditBtn: { width: rs(38), height: rs(38), borderRadius: 12, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },

  userIdCard: { flexDirection: 'row', alignItems: 'center', gap: rs(18), backgroundColor: '#111', borderRadius: 24, padding: rs(20), borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: rs(20) },
  avatarContainer: { width: rs(64), height: rs(64), borderRadius: 32, backgroundColor: '#18181B', padding: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  avatarInner: { flex: 1, borderRadius: 32, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFF', fontSize: rf(24), fontWeight: '800' },
  userMeta: { flex: 1, gap: rs(4) },
  displayName: { color: '#FFF', fontSize: rf(20), fontWeight: '800', letterSpacing: -0.4 },
  roleLabelPill: { alignSelf: 'flex-start', paddingHorizontal: rs(10), paddingVertical: rs(4), borderRadius: 100 },
  roleLabelText: { fontSize: rf(10), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },

  statsGlassCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 24, paddingVertical: rs(20), borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: rs(20) },
  statUnit: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: rs(12) },
  statInfo: { gap: rs(2) },
  statValue: { color: '#FFF', fontSize: rf(16), fontWeight: '800' },
  statLabel: { color: COLORS.textTertiary, fontSize: rf(10), fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  vDivider: { width: 1, height: rs(24), backgroundColor: 'rgba(255,255,255,0.06)' },

  detailsBox: { backgroundColor: '#111', borderRadius: 24, padding: rs(6), borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: rs(24) },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: rs(14) },
  detailLeft: { flexDirection: 'row', alignItems: 'center', gap: rs(12) },
  detailLabel: { color: COLORS.textSecondary, fontSize: rf(13), fontWeight: '600' },
  detailValue: { color: '#FFF', fontSize: rf(13), fontWeight: '700', opacity: 0.9 },
  hDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: rs(14) },

  sectionHeader: { marginBottom: rs(12), paddingLeft: rs(4) },
  sectionHeaderText: { color: 'rgba(255,255,255,0.3)', fontSize: rf(11), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5 },
  
  actionCard: { backgroundColor: '#111', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', marginBottom: rs(20), overflow: 'hidden' },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: rs(14), padding: rs(16), borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.04)' },
  menuIcon: { width: rs(34), height: rs(34), borderRadius: 10, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' },
  menuLabel: { color: '#FFF', fontSize: rf(15), fontWeight: '600', flex: 1 },
  menuRight: { color: COLORS.textTertiary, fontSize: rf(13), fontWeight: '700', marginRight: rs(4) },

  logoutCard: { flexDirection: 'row', alignItems: 'center', gap: rs(14), backgroundColor: '#111', borderRadius: 24, padding: rs(16), borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.1)' },
  logoutIconWrap: { width: rs(34), height: rs(34), borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.08)', alignItems: 'center', justifyContent: 'center' },
  logoutLabel: { color: COLORS.error, fontSize: rf(15), fontWeight: '700', flex: 1 },

  footerVersion: { color: COLORS.textTertiary, fontSize: rf(11), fontWeight: '600', textAlign: 'center', marginTop: rs(12), letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: rs(24), borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: rs(30) },
  modalTitle: { color: '#FFF', fontSize: rf(22), fontWeight: '800', letterSpacing: -0.5 },
  modalBody: { gap: rs(20) },
  field: { gap: rs(10) },
  fieldLabel: { color: COLORS.textTertiary, fontSize: rf(11), fontWeight: '800', letterSpacing: 1 },
  fieldInput: { backgroundColor: '#111', borderRadius: 16, padding: rs(16), color: '#FFF', fontSize: rf(16), fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  saveBtn: { backgroundColor: '#FFF', borderRadius: 100, paddingVertical: rs(18), alignItems: 'center', marginTop: rs(10) },
  saveBtnText: { color: '#000', fontSize: rf(14), fontWeight: '800', letterSpacing: 1 },
});
