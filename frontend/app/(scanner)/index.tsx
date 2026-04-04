import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, ScrollView, Animated, Dimensions, Vibration, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScanLine, Zap, CheckCircle, XCircle, Clock, LogOut, AlertTriangle, RefreshCcw } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import BrandMark from '../../components/BrandMark';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

const { width } = Dimensions.get('window');

type ScanResult = {
  status: 'success' | 'already_used' | 'invalid' | 'requires_selection' | 'wrong_event';
  message: string;
  ticket?: any;
};

interface EventSummary {
  id: string;
  title: string;
  date: string;
  venue: string;
}

export default function ScannerHomeScreen() {
  const [todayScans, setTodayScans] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'entry' | 'exit'>('entry');
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [processingPartial, setProcessingPartial] = useState(false);
  
  // Event selection state
  const [activeEvents, setActiveEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(true);
  
  const { user, logout } = useAuth();
  const router = useRouter();
  const bannerAnim = useRef(new Animated.Value(-120)).current;
  const resultTimeout = useRef<any>(null);

  const loadStats = useCallback(async () => {
    try {
      const data: any = await api.get('/scanner/history');
      const logs = data.logs || [];
      const today = new Date().toDateString();
      const todayLogs = logs.filter((l: any) => new Date(l.timestamp).toDateString() === today);
      setTodayScans(todayLogs.length);
      setSuccessCount(todayLogs.filter((l: any) => l.status === 'success').length);
      setFailCount(todayLogs.filter((l: any) => l.status !== 'success').length);

      // Also load events for selection
      const eventData = await api.get('/events');
      setActiveEvents(eventData.events || []);
    } catch { }
    finally { setRefreshing(false); setLoadingEvents(false); }
  }, []);

  useFocusEffect(useCallback(() => { 
    loadStats();
    setCameraActive(true);
    return () => setCameraActive(false);
  }, [loadStats]));

  const onRefresh = useCallback(() => { 
    setRefreshing(true); 
    if (selectedEvent) {
      loadStats();
    } else {
      loadStats();
      setShowEventPicker(true);
    }
  }, [loadStats, selectedEvent]);

  const showBanner = useCallback(() => {
    Animated.spring(bannerAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 50,
      friction: 8
    }).start();
  }, [bannerAnim]);

  const hideBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: -140,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setLastResult(null));
  }, [bannerAnim]);

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (isScanning || lastResult) return;
    
    setIsScanning(true);
    Vibration.vibrate(50);
    
    try {
      const res = await api.post('/scanner/verify', { 
        qr_token: data, 
        mode: scanMode, 
        event_id: selectedEvent?.id 
      });
      
      if (res.status === 'requires_selection') {
        setLastResult(res);
        setSelectedIndices([]); // Start with empty selection or all?
        setShowGuestModal(true);
        return;
      }

      setLastResult(res);
      
      // Real-time stat update
      setTodayScans(prev => prev + 1);
      if (res.status === 'success') {
        setSuccessCount(prev => prev + 1);
        Vibration.vibrate([0, 100, 50, 100]);
      } else {
        setFailCount(prev => prev + 1);
        Vibration.vibrate(400);
      }
      
      showBanner();
      
      // Auto-reset after 5 seconds
      if (resultTimeout.current) clearTimeout(resultTimeout.current);
      resultTimeout.current = setTimeout(() => {
        hideBanner();
      }, 5000);

    } catch (err: any) {
      setLastResult({ status: 'invalid', message: err.message || 'Scan failed' });
      setFailCount(prev => prev + 1);
      showBanner();
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmSelection = async () => {
    if (selectedIndices.length === 0 || !lastResult?.ticket?.qr_token) return;
    
    setProcessingPartial(true);
    try {
      const res = await api.post('/scanner/verify', { 
        qr_token: lastResult.ticket.qr_token, 
        mode: scanMode, 
        guest_indices: selectedIndices,
        event_id: selectedEvent?.id
      });
      
      setLastResult(res);
      setShowGuestModal(false);
      showBanner();
      
      // Update stats
      setTodayScans(prev => prev + 1);
      if (res.status === 'success') {
        setSuccessCount(prev => prev + 1);
      } else {
        setFailCount(prev => prev + 1);
      }
    } catch (err: any) {
      setLastResult({ status: 'invalid', message: err.message || 'Partial update failed' });
      setShowGuestModal(false);
      showBanner();
    } finally {
      setProcessingPartial(false);
    }
  };

  const toggleSelectAll = () => {
    if (!lastResult?.ticket?.guests) return;
    if (selectedIndices.length === lastResult.ticket.guests.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(lastResult.ticket.guests.map((_: any, i: number) => i));
    }
  };

  const renderResultBanner = () => {
    if (!lastResult) return null;
    
    const isSuccess = lastResult.status === 'success';
    const isWarning = lastResult.status === 'already_used';
    
    const bgColor = isSuccess ? '#22C55E' : isWarning ? '#F59E0B' : '#EF4444';
    const Icon = isSuccess ? CheckCircle : isWarning ? AlertTriangle : XCircle;

    return (
      <Animated.View style={[styles.banner, { backgroundColor: bgColor, transform: [{ translateY: bannerAnim }] }]}>
        <SafeAreaView edges={['top']}>
          <View style={styles.bannerContent}>
            <Icon size={24} color="#000" strokeWidth={2.5} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerStatus}>
                {lastResult.status.replace('_', ' ').toUpperCase()}
              </Text>
              {lastResult.status !== 'invalid' && (
                <Text style={styles.bannerMsg} numberOfLines={1}>{lastResult.message}</Text>
              )}
            </View>
            <TouchableOpacity onPress={hideBanner} style={styles.bannerClose}>
              <XCircle size={20} color="#000" opacity={0.5} />
            </TouchableOpacity>
          </View>
          {lastResult.ticket && (
            <View style={styles.bannerTicket}>
              <Text style={styles.bannerTicketText}>
                Attendee: <Text style={{ fontWeight: '800' }}>{lastResult.ticket.user_name}</Text>
              </Text>
              <Text style={styles.bannerTicketSub}>{lastResult.ticket.event_title}</Text>
            </View>
          )}
        </SafeAreaView>
      </Animated.View>
    );
  };

  if (!permission) return (
    <View style={[styles.safe, styles.center]}>
      <ActivityIndicator color="#22C55E" />
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} testID="scanner-home-screen">
      {renderResultBanner()}
      
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.headerActionBtn} onPress={() => setShowEventPicker(true)}>
              <RefreshCcw size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity testID="scanner-logout-btn" style={styles.logoutBtn} onPress={async () => { await logout(); router.replace('/onboarding'); }}>
              <LogOut size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Selected Event Banner */}
        {selectedEvent && (
          <TouchableOpacity style={styles.selectedEventCard} onPress={() => setShowEventPicker(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.selectedEventLabel}>SCANNING FOR EVENT</Text>
              <Text style={styles.selectedEventTitle}>{selectedEvent.title}</Text>
              <Text style={styles.selectedEventMeta}>{new Date(selectedEvent.date).toDateString()} • {selectedEvent.venue}</Text>
            </View>
            <View style={styles.changeBadge}>
               <Text style={styles.changeBadgeText}>CHANGE</Text>
            </View>
          </TouchableOpacity>
        )}

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

        {/* Dynamic Scanner Area */}
        <View style={styles.scannerHero}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live Scanner</Text>
            <View style={styles.modeToggle}>
              <TouchableOpacity 
                style={[styles.modeBtn, scanMode === 'entry' && styles.modeBtnActiveEntry]} 
                onPress={() => setScanMode('entry')}
              >
                <Text style={[styles.modeBtnText, scanMode === 'entry' && styles.modeBtnTextActive]}>ENTRY</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modeBtn, scanMode === 'exit' && styles.modeBtnActiveExit]} 
                onPress={() => setScanMode('exit')}
              >
                <Text style={[styles.modeBtnText, scanMode === 'exit' && styles.modeBtnTextActive]}>EXIT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!permission.granted ? (
            <View style={styles.permissionCard}>
              <AlertTriangle size={32} color={COLORS.textTertiary} />
              <Text style={styles.permissionText}>Camera access is required to scan tickets</Text>
              <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                <Text style={styles.permissionBtnText}>Enable Camera</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.cameraContainer, { borderColor: scanMode === 'entry' ? '#22C55E60' : '#F59E0B60' }]}>
              <View style={styles.cameraFrame}>
                {cameraActive && (
                  <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                    onBarcodeScanned={lastResult ? undefined : handleBarcodeScan}
                  />
                )}
                {/* Scan Overlay */}
                <View style={styles.cameraOverlay}>
                  <View style={[styles.corner, styles.cornerTL, { borderColor: scanMode === 'entry' ? '#22C55E' : '#F59E0B' }]} />
                  <View style={[styles.corner, styles.cornerTR, { borderColor: scanMode === 'entry' ? '#22C55E' : '#F59E0B' }]} />
                  <View style={[styles.corner, styles.cornerBL, { borderColor: scanMode === 'entry' ? '#22C55E' : '#F59E0B' }]} />
                  <View style={[styles.corner, styles.cornerBR, { borderColor: scanMode === 'entry' ? '#22C55E' : '#F59E0B' }]} />
                  
                  {isScanning && (
                    <View style={styles.loadingOverlay}>
                      <ActivityIndicator color="#22C55E" size="large" />
                    </View>
                  )}
                  
                  {lastResult && (
                    <TouchableOpacity 
                      style={[styles.resumeBtn, { backgroundColor: scanMode === 'entry' ? '#22C55E' : '#F59E0B' }]} 
                      onPress={hideBanner}
                    >
                      <RefreshCcw size={20} color="#000" />
                      <Text style={styles.resumeBtnText}>TAP TO CONTINUE</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}
          <Text style={styles.scanHint}>Position QR code within the frame to scan</Text>
        </View>

        {/* Info */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Session Status</Text>
          <View style={styles.infoRow}>
            <View style={styles.statusDot} />
            <Text style={styles.infoText}>Scanner is active and ready</Text>
          </View>
          <View style={styles.infoRow}>
            <Clock size={16} color={COLORS.textTertiary} />
            <Text style={styles.infoText}>Auto-syncing results to cloud</Text>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Event Selection Modal */}
      <Modal visible={showEventPicker} animationType="fade" transparent={true}>
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Target Event</Text>
              <Text style={styles.pickerSub}>Konse event ki entry leni hai?</Text>
            </View>

            {loadingEvents ? (
              <ActivityIndicator color="#FFEE00" style={{ margin: 40 }} />
            ) : (
              <ScrollView style={styles.eventList}>
                {activeEvents.map(ev => (
                  <TouchableOpacity 
                    key={ev.id} 
                    style={[styles.eventItem, selectedEvent?.id === ev.id && styles.eventItemActive]}
                    onPress={() => {
                      setSelectedEvent(ev);
                      setShowEventPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eventItemTitle, selectedEvent?.id === ev.id && styles.eventItemTitleActive]}>{ev.title}</Text>
                      <Text style={styles.eventItemMeta}>{new Date(ev.date).toDateString()} • {ev.venue}</Text>
                    </View>
                    <View style={[styles.eventCheck, selectedEvent?.id === ev.id && styles.eventCheckActive]}>
                       {selectedEvent?.id === ev.id && <CheckCircle size={16} color="#000" />}
                    </View>
                  </TouchableOpacity>
                ))}
                {activeEvents.length === 0 && (
                  <Text style={styles.emptyEventsText}>No active events found.</Text>
                )}
              </ScrollView>
            )}

            <TouchableOpacity style={styles.pickerCloseBtn} onPress={() => {
              if (selectedEvent) setShowEventPicker(false);
              else alert('Please select an event to continue.');
            }}>
              <Text style={styles.pickerCloseBtnText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Guest Selection Modal */}
      <Modal visible={showGuestModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Attendees</Text>
                <Text style={styles.modalSub}>{scanMode.toUpperCase()} MODE — {lastResult?.ticket?.guests?.length} total</Text>
              </View>
              <TouchableOpacity onPress={() => setShowGuestModal(false)} style={styles.modalClose}>
                <XCircle size={24} color={COLORS.textTertiary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.guestScroll}>
              <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
                 <Text style={styles.selectAllText}>
                   {selectedIndices.length === lastResult?.ticket?.guests?.length ? 'Deselect All' : 'Select All'}
                 </Text>
              </TouchableOpacity>

              {lastResult?.ticket?.guests?.map((guest: any, idx: number) => {
                const isSelected = selectedIndices.includes(idx);
                const isInside = guest.status === 'inside';
                
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.guestItem, isSelected && styles.guestItemActive]} 
                    onPress={() => {
                      setSelectedIndices(prev => isSelected ? prev.filter(i => i !== idx) : [...prev, idx]);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.guestName, isSelected && styles.guestNameActive]}>{guest.name}</Text>
                      <View style={styles.guestMetaCompact}>
                        <Text style={styles.guestAgeText}>Age: {guest.age}</Text>
                        <Text style={[styles.guestStatusText, { color: isInside ? '#22C55E' : '#9CA3AF' }]}>
                          • {isInside ? 'Currently Inside' : 'Currently Outside'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                       {isSelected && <CheckCircle size={16} color="#000" />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={[styles.confirmBtn, (selectedIndices.length === 0 || processingPartial) && styles.confirmBtnDisabled]}
                disabled={selectedIndices.length === 0 || processingPartial}
                onPress={handleConfirmSelection}
              >
                {processingPartial ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.confirmBtnText}>CONFIRM {scanMode.toUpperCase()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: COLORS.textTertiary, fontSize: 13, marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1 },
  statNum: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLabel: { color: COLORS.textTertiary, fontSize: 11 },
  
  // Scanner
  scannerHero: { gap: 12, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },
  modeToggle: { flexDirection: 'row', backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, padding: 4, borderWidth: 1, borderColor: COLORS.border },
  modeBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: RADIUS.full },
  modeBtnActiveEntry: { backgroundColor: '#22C55E' },
  modeBtnActiveExit: { backgroundColor: '#F59E0B' },
  modeBtnText: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '800' },
  modeBtnTextActive: { color: '#000' },
  cameraContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#000', borderRadius: RADIUS.xl, overflow: 'hidden', borderWidth: 2 },
  cameraFrame: { flex: 1 },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#22C55E', borderWidth: 4 },
  cornerTL: { top: 40, left: 40, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 12 },
  cornerTR: { top: 40, right: 40, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 12 },
  cornerBL: { bottom: 40, left: 40, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 12 },
  cornerBR: { bottom: 40, right: 40, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 12 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  resumeBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 14, borderRadius: RADIUS.full, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  resumeBtnText: { color: '#000', fontWeight: '900', fontSize: 13 },
  scanHint: { color: COLORS.textTertiary, fontSize: 13, textAlign: 'center' },
  
  // Banner
  banner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 15 },
  bannerContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  bannerStatus: { color: '#000', fontSize: 20, fontWeight: '900', letterSpacing: 0.5 },
  bannerMsg: { color: 'rgba(0,0,0,0.8)', fontSize: 13, fontWeight: '700' },
  bannerClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  bannerTicket: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  bannerTicketText: { color: '#000', fontSize: 14 },
  bannerTicketSub: { color: 'rgba(0,0,0,0.6)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  
  // Permission
  permissionCard: { width: '100%', aspectRatio: 1, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40, borderWidth: 1, borderColor: COLORS.border },
  permissionText: { color: COLORS.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  permissionBtn: { backgroundColor: '#22C55E', paddingHorizontal: 24, paddingVertical: 12, borderRadius: RADIUS.full },
  permissionBtnText: { color: '#000', fontWeight: '700' },
  
  infoCard: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  infoTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 2 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  infoText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '75%', padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '900' },
  modalSub: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  modalClose: { padding: 5 },
  guestScroll: { gap: 10, paddingBottom: 20 },
  selectAllBtn: { paddingVertical: 10, alignItems: 'flex-end' },
  selectAllText: { color: '#3B82F6', fontSize: 13, fontWeight: '700' },
  guestItem: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 15, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: COLORS.border },
  guestItemActive: { borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.05)' },
  guestName: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '700' },
  guestNameActive: { color: '#3B82F6' },
  guestMetaCompact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  guestAgeText: { color: COLORS.textTertiary, fontSize: 11, fontWeight: '500' },
  guestStatusText: { fontSize: 11, fontWeight: '600' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { borderColor: '#3B82F6', backgroundColor: '#3B82F6' },
  modalFooter: { paddingTop: 20, borderTopWidth: 1, borderTopColor: COLORS.border },
  confirmBtn: { backgroundColor: '#FFEE00', paddingVertical: 16, borderRadius: RADIUS.full, alignItems: 'center' },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#000', fontSize: 15, fontWeight: '900' },

  // Event Picker Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  pickerContent: { backgroundColor: COLORS.bg, borderRadius: 28, padding: 20, maxHeight: '80%', borderWidth: 1, borderColor: COLORS.border },
  pickerHeader: { marginBottom: 20 },
  pickerTitle: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '900' },
  pickerSub: { color: COLORS.textTertiary, fontSize: 13, marginTop: 4 },
  eventList: { gap: 10 },
  eventItem: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 16, backgroundColor: COLORS.bgCard, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  eventItemActive: { borderColor: '#FFEE00', backgroundColor: 'rgba(255,238,0,0.05)' },
  eventItemTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  eventItemTitleActive: { color: '#FFEE00' },
  eventItemMeta: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  eventCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  eventCheckActive: { backgroundColor: '#FFEE00', borderColor: '#FFEE00' },
  pickerCloseBtn: { alignSelf: 'center', marginTop: 20, padding: 10 },
  pickerCloseBtnText: { color: COLORS.textTertiary, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  emptyEventsText: { color: COLORS.textTertiary, textAlign: 'center', margin: 20 },

  // Header helpers
  headerActionBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  selectedEventCard: { backgroundColor: COLORS.bgCard, borderRadius: 20, padding: 16, marginBottom: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#FFEE0030' },
  selectedEventLabel: { color: '#FFEE00', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  selectedEventTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  selectedEventMeta: { color: COLORS.textTertiary, fontSize: 11, marginTop: 2 },
  changeBadge: { backgroundColor: '#FFEE00', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  changeBadgeText: { color: '#000', fontSize: 9, fontWeight: '900' },
});
