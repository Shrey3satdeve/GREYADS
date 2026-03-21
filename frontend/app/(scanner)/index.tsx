import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScanLine, Zap, CheckCircle, XCircle, Clock, LogOut } from 'lucide-react-native';
import BrandMark from '../../components/BrandMark';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import { useFocusEffect } from 'expo-router';

export default function ScannerHomeScreen() {
  const [todayScans, setTodayScans] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const loadStats = useCallback(async () => {
    try {
      const data: any = await api.get('/scanner/history');
      const logs = data.logs || [];
      const today = new Date().toDateString();
      const todayLogs = logs.filter((l: any) => new Date(l.timestamp).toDateString() === today);
      setTodayScans(todayLogs.length);
      setSuccessCount(todayLogs.filter((l: any) => l.status === 'success').length);
      setFailCount(todayLogs.filter((l: any) => l.status !== 'success').length);
    } catch { }
    finally { setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadStats(); }, [loadStats]));
  const onRefresh = useCallback(() => { setRefreshing(true); loadStats(); }, [loadStats]);

  return (
    <SafeAreaView style={styles.safe} testID="scanner-home-screen">
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <BrandMark size={32} imageScale={0.68} />
            <View>
              <Text style={styles.headerTitle}>Scanner Mode</Text>
              <Text style={styles.headerSub}>Staff: {user?.name}</Text>
            </View>
          </View>
          <TouchableOpacity testID="scanner-logout-btn" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/onboarding'); }}>
            <LogOut size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Status indicator */}
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>SCANNER ACTIVE</Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderColor: '#22C55E30' }]}>
            <Zap size={18} color="#22C55E" />
            <Text style={[styles.statNum, { color: '#22C55E' }]}>{todayScans}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#3B82F630' }]}>
            <CheckCircle size={18} color="#3B82F6" />
            <Text style={[styles.statNum, { color: '#3B82F6' }]}>{successCount}</Text>
            <Text style={styles.statLabel}>Valid</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#EF444430' }]}>
            <XCircle size={18} color="#EF4444" />
            <Text style={[styles.statNum, { color: '#EF4444' }]}>{failCount}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>

        {/* Big scan button */}
        <View style={styles.scanBtnWrap}>
          <View style={styles.scanRingOuter}>
            <View style={styles.scanRingInner}>
              <TouchableOpacity
                testID="start-scan-btn"
                style={styles.scanBtn}
                onPress={() => router.push('/(scanner)/scan')}
                activeOpacity={0.85}
              >
                <ScanLine size={36} color="#000" strokeWidth={2} />
                <Text style={styles.scanBtnText}>TAP TO SCAN</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.scanHint}>Point camera at ticket QR code</Text>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>How it works</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Tap the button above to open the camera scanner</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Point the camera at the attendee&apos;s QR code</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Green = valid ticket, Red = invalid or already used</Text>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: COLORS.textTertiary, fontSize: 13, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#22C55E15', borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 20, borderWidth: 1, borderColor: '#22C55E30' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  statusText: { color: '#22C55E', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 32 },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  statNum: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: COLORS.textTertiary, fontSize: 11 },
  scanBtnWrap: { alignItems: 'center', marginBottom: 32 },
  scanRingOuter: { width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: '#22C55E20', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  scanRingInner: { width: 168, height: 168, borderRadius: 84, borderWidth: 1.5, borderColor: '#22C55E50', alignItems: 'center', justifyContent: 'center' },
  scanBtn: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', gap: 6, shadowColor: '#22C55E', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  scanBtnText: { color: '#000', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  scanHint: { color: COLORS.textTertiary, fontSize: 13 },
  infoCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  infoTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  infoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginTop: 6 },
  infoText: { color: COLORS.textSecondary, fontSize: 13, flex: 1, lineHeight: 19 },
});
