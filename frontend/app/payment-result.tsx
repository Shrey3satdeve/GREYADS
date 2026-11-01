import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle, XCircle, Clock } from 'lucide-react-native';
import { api } from '../utils/api';
import { COLORS, RADIUS } from '../constants/theme';
import { rf, rs } from '../utils/responsive';

export default function PaymentResultScreen() {
  const { txn_id } = useLocalSearchParams<{ txn_id: string | string[] }>();
  const txnId = Array.isArray(txn_id) ? txn_id[0] : txn_id;
  const [status, setStatus] = useState<'loading' | 'COMPLETED' | 'FAILED' | 'PENDING'>('loading');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const router = useRouter();
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!txnId) { setStatus('FAILED'); return; }
    checkStatus(0);
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [txnId]);

  useEffect(() => {
    if (status !== 'COMPLETED' || !ticketId) return;
    const timer = setTimeout(() => {
      router.replace(`/ticket/${ticketId}`);
    }, 700);
    return () => clearTimeout(timer);
  }, [status, ticketId, router]);

  const checkStatus = async (attempt: number) => {
    if (attempt > 20) {
      setStatus('PENDING');
      retryTimerRef.current = setTimeout(() => checkStatus(0), 5000);
      return;
    }
    try {
      const data = await api.get(`/payments/status/${txnId}`);
      if (data.status === 'COMPLETED') {
        setTicketId(data.ticket_id);
        setStatus('COMPLETED');
      } else if (data.status === 'FAILED') {
        setFailureReason(data.reason || null);
        setStatus('FAILED');
      } else {
        retryTimerRef.current = setTimeout(() => checkStatus(attempt + 1), 2000);
      }
    } catch {
      retryTimerRef.current = setTimeout(() => checkStatus(attempt + 1), 3000);
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
        <Text style={styles.title}>Ticket Booked Successfully</Text>
        <Text style={styles.sub}>
          Your payment has been confirmed and your ticket is ready in My Tickets.
        </Text>
        {ticketId ? (
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace(`/ticket/${ticketId}`)}>
            <Text style={styles.primaryBtnText}>View My Ticket</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.replace('/(tabs)/tickets')}>
          <Text style={styles.secondaryBtnText}>Go to My Tickets</Text>
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
        <Text style={styles.sub}>
          {failureReason === 'inventory_conflict'
            ? 'Payment succeeded but inventory changed before the ticket could be confirmed. A refund should be started automatically. Contact support if it does not reflect soon.'
            : failureReason === 'reservation_released' || failureReason === 'reservation_expired'
            ? 'Your booking hold expired before payment confirmation completed. If money was debited, the refund flow should start automatically.'
            : 'Your payment could not be confirmed. If money was debited, wait a moment and check My Tickets or contact support.'}
        </Text>
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
      <Text style={styles.title}>Confirming Ticket</Text>
      <Text style={styles.sub}>Your payment went through. We are still generating the ticket, so keep this screen open for a moment.</Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => checkStatus(0)}>
        <Text style={styles.primaryBtnText}>Check Again</Text>
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
  secondaryBtn: { backgroundColor: 'transparent', borderRadius: RADIUS.full, paddingHorizontal: rs(32), paddingVertical: rs(14), width: '100%', alignItems: 'center', marginTop: rs(4), borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  secondaryBtnText: { color: COLORS.textPrimary, fontSize: rf(16), fontWeight: '700' },
});
