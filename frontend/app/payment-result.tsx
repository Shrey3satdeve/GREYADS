import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { api } from '../utils/api';
import { COLORS, RADIUS } from '../constants/theme';
import { rf, rs } from '../utils/responsive';

export default function PaymentResultScreen() {
  const { txn_id } = useLocalSearchParams<{ txn_id: string }>();
  const [status, setStatus] = useState<'loading' | 'COMPLETED' | 'FAILED' | 'PENDING'>('loading');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!txn_id) { setStatus('FAILED'); return; }
    checkStatus(0);
  }, [txn_id]);

  const checkStatus = async (attempt: number) => {
    if (attempt > 8) { setStatus('PENDING'); return; }
    try {
      const data = await api.get(`/payments/status/${txn_id}`);
      if (data.status === 'COMPLETED') {
        setTicketId(data.ticket_id);
        setStatus('COMPLETED');
      } else if (data.status === 'FAILED') {
        setStatus('FAILED');
      } else {
        setTimeout(() => checkStatus(attempt + 1), 2000);
      }
    } catch {
      setTimeout(() => checkStatus(attempt + 1), 3000);
    }
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFF" size="large" />
        <Text style={styles.loadText}>Verifying payment...</Text>
      </View>
    );
  }

  if (status === 'COMPLETED') {
    return (
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: COLORS.success + '15' }]}>
          <CheckCircle size={rf(52)} color={COLORS.success} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Payment Successful!</Text>
        <Text style={styles.sub}>Your ticket has been confirmed. Enjoy the event!</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace(`/ticket/${ticketId}`)}>
          <Text style={styles.primaryBtnText}>View My Ticket</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'FAILED') {
    return (
      <View style={styles.center}>
        <View style={[styles.iconWrap, { backgroundColor: COLORS.error + '15' }]}>
          <XCircle size={rf(52)} color={COLORS.error} strokeWidth={1.5} />
        </View>
        <Text style={styles.title}>Payment Failed</Text>
        <Text style={styles.sub}>Your payment could not be processed. No charges made.</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <View style={[styles.iconWrap, { backgroundColor: COLORS.warning + '15' }]}>
        <Clock size={rf(52)} color={COLORS.warning} strokeWidth={1.5} />
      </View>
      <Text style={styles.title}>Payment Pending</Text>
      <Text style={styles.sub}>Your payment is being processed. Check My Tickets in a few minutes.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(tabs)/tickets')}>
        <Text style={styles.primaryBtnText}>Go to My Tickets</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center', padding: rs(32), gap: rs(14) },
  iconWrap: { width: rs(100), height: rs(100), borderRadius: rs(50), alignItems: 'center', justifyContent: 'center', marginBottom: rs(8) },
  loadText: { color: COLORS.textSecondary, fontSize: rf(15), marginTop: rs(16) },
  title: { color: COLORS.textPrimary, fontSize: rf(26), fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  sub: { color: COLORS.textSecondary, fontSize: rf(14), textAlign: 'center', lineHeight: rf(22) },
  primaryBtn: { backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingHorizontal: rs(32), paddingVertical: rs(14), width: '100%', alignItems: 'center', marginTop: rs(8) },
  primaryBtnText: { color: COLORS.btnPrimaryText, fontSize: rf(16), fontWeight: '700' },
});
