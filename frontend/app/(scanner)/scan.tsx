import { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { X, Zap, ZapOff, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import { api } from '../../utils/api';
import { COLORS, RADIUS } from '../../constants/theme';

const { width, height } = Dimensions.get('window');
const FRAME_SIZE = width * 0.7;

type ScanResult = {
  status: 'success' | 'already_used' | 'invalid';
  message: string;
  ticket?: any;
};

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const router = useRouter();
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const scanLineY = scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, FRAME_SIZE - 4] });

  const handleBarcodeScan = async ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    setScanned(true);
    setScanning(true);
    try {
      const res = await api.post('/scanner/verify', { qr_token: data });
      setResult(res);
    } catch (err: any) {
      setResult({ status: 'invalid', message: err.message || 'Verification failed' });
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => {
    setScanned(false);
    setResult(null);
  };

  if (!permission) {
    return (
      <View style={styles.centerWrap}>
        <ActivityIndicator color="#22C55E" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerWrap} testID="camera-permission-screen">
        <Text style={styles.permText}>Camera access required</Text>
        <TouchableOpacity testID="grant-permission-btn" style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Grant Camera Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show result overlay
  if (result) {
    const isSuccess = result.status === 'success';
    const isWarning = result.status === 'already_used';

    return (
      <View style={styles.resultWrap} testID="scan-result-screen">
        <SafeAreaView edges={['top', 'bottom']} style={styles.resultInner}>
          <View style={[styles.resultIcon, { backgroundColor: isSuccess ? '#22C55E20' : isWarning ? '#F59E0B20' : '#EF444420' }]}>
            {isSuccess && <CheckCircle size={64} color="#22C55E" strokeWidth={1.5} />}
            {isWarning && <AlertTriangle size={64} color="#F59E0B" strokeWidth={1.5} />}
            {!isSuccess && !isWarning && <XCircle size={64} color="#EF4444" strokeWidth={1.5} />}
          </View>

          <Text style={[styles.resultStatus, { color: isSuccess ? '#22C55E' : isWarning ? '#F59E0B' : '#EF4444' }]}>
            {isSuccess ? 'VERIFIED' : isWarning ? 'ALREADY USED' : 'INVALID'}
          </Text>
          <Text style={styles.resultMessage}>{result.message}</Text>

          {result.ticket && (
            <View style={styles.ticketPreview}>
              <Text style={styles.ticketName}>{result.ticket.user_name}</Text>
              <Text style={styles.ticketEvent}>{result.ticket.event_title}</Text>
              <Text style={styles.ticketRef}>Ref: {result.ticket.booking_ref}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="scan-again-btn"
            style={[styles.scanAgainBtn, { backgroundColor: isSuccess ? '#22C55E' : isWarning ? '#F59E0B' : '#EF4444' }]}
            onPress={resetScan}
          >
            <Text style={styles.scanAgainText}>Scan Next</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="close-scan-btn" onPress={() => router.back()} style={styles.closeLink}>
            <Text style={styles.closeLinkText}>Done</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="qr-scan-screen">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScan}
      />

      {/* Dark overlay with transparent center */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          {/* Scan Frame */}
          <View style={styles.scanFrame}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            {/* Animated scan line */}
            {!scanning && (
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineY }] }]} />
            )}
            {scanning && (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator color="#22C55E" size="large" />
              </View>
            )}
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* UI Controls */}
      <SafeAreaView edges={['top']} style={styles.topControls}>
        <TouchableOpacity testID="close-scan-top-btn" style={styles.controlBtn} onPress={() => router.back()}>
          <X size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.scanTitle}>Scan QR Code</Text>
        <TouchableOpacity testID="flash-toggle-btn" style={[styles.controlBtn, flashOn && styles.controlBtnActive]} onPress={() => setFlashOn(!flashOn)}>
          {flashOn ? <Zap size={20} color="#000" fill="#000" /> : <ZapOff size={20} color="#FFF" />}
        </TouchableOpacity>
      </SafeAreaView>

      <View style={styles.bottomControls}>
        <Text style={styles.bottomHint}>Position QR code within the frame</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centerWrap: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  permText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  permBtn: { backgroundColor: '#22C55E', borderRadius: RADIUS.full, paddingHorizontal: 28, paddingVertical: 14 },
  permBtnText: { color: '#000', fontSize: 15, fontWeight: '700' },
  backLink: { paddingVertical: 12 },
  backLinkText: { color: COLORS.textSecondary, fontSize: 14 },
  overlay: { ...StyleSheet.absoluteFillObject },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  middleRow: { flexDirection: 'row', height: FRAME_SIZE },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  bottomOverlay: { flex: 1.5, backgroundColor: 'rgba(0,0,0,0.7)' },
  scanFrame: { width: FRAME_SIZE, height: FRAME_SIZE, overflow: 'hidden' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#22C55E', borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 4 },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: '#22C55E', shadowColor: '#22C55E', shadowOpacity: 0.8, shadowRadius: 6, elevation: 5 },
  scanningIndicator: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  topControls: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 10 },
  controlBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  controlBtnActive: { backgroundColor: '#FFFFFF' },
  scanTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  bottomControls: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center' },
  bottomHint: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },
  // Result screen
  resultWrap: { flex: 1, backgroundColor: '#000' },
  resultInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  resultIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  resultStatus: { fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  resultMessage: { color: COLORS.textSecondary, fontSize: 16, textAlign: 'center' },
  ticketPreview: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.xl, padding: 20, borderWidth: 1, borderColor: COLORS.border, width: '100%', gap: 4, marginTop: 8, alignItems: 'center' },
  ticketName: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '700' },
  ticketEvent: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  ticketRef: { color: COLORS.textTertiary, fontSize: 12, marginTop: 4 },
  scanAgainBtn: { borderRadius: RADIUS.full, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 },
  scanAgainText: { color: '#000', fontSize: 16, fontWeight: '800' },
  closeLink: { paddingVertical: 12 },
  closeLinkText: { color: COLORS.textSecondary, fontSize: 14 },
});
