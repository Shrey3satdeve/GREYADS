import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Shield, ArrowLeft, Lock } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import { COLORS, RADIUS, SPACING } from '../constants/theme';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your credentials.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email: email.trim().toLowerCase(), password }, false);
      if (!['admin', 'staff'].includes(data.user.role)) {
        Alert.alert('Access Denied', 'This panel is for Admin and Staff only.');
        return;
      }
      await login(data.token, data.user);
      // Redirect based on role
      if (data.user.role === 'admin') {
        router.replace('/(admin)/');
      } else {
        router.replace('/(scanner)/');
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type: 'staff' | 'admin') => {
    const creds = {
      admin: { email: 'admin@greyads.com', password: 'Admin@123' },
      staff: { email: 'staff@greyads.com', password: 'Staff@123' },
    };
    setEmail(creds[type].email);
    setPassword(creds[type].password);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <TouchableOpacity testID="back-to-user-btn" style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <ArrowLeft size={18} color={COLORS.textSecondary} />
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          {/* Shield Icon + Branding */}
          <View style={styles.centerSection}>
            <View style={styles.shieldOuter}>
              <View style={styles.shieldInner}>
                <Shield size={40} color="#7C3AED" strokeWidth={1.5} />
              </View>
            </View>
            <Text style={styles.heading}>Admin & Staff</Text>
            <Text style={styles.subheading}>Restricted access — authorized personnel only</Text>

            {/* Secure badge */}
            <View style={styles.secureBadge}>
              <Lock size={11} color="#22C55E" />
              <Text style={styles.secureText}>Secured & Encrypted</Text>
            </View>
          </View>

          {/* Quick Demo Fill */}
          <View style={styles.demoBox}>
            <Text style={styles.demoLabel}>Quick Demo Access</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity
                testID="demo-admin-fill"
                style={[styles.demoChip, { borderColor: '#7C3AED60', backgroundColor: '#7C3AED10' }]}
                onPress={() => fillDemo('admin')}
              >
                <Shield size={12} color="#7C3AED" />
                <Text style={[styles.demoChipText, { color: '#7C3AED' }]}>Admin Demo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="demo-staff-fill"
                style={[styles.demoChip, { borderColor: '#22C55E60', backgroundColor: '#22C55E10' }]}
                onPress={() => fillDemo('staff')}
              >
                <Shield size={12} color="#22C55E" />
                <Text style={[styles.demoChipText, { color: '#22C55E' }]}>Staff Demo</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            testID="admin-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@greyads.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="admin-password-input"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
              {showPw ? <Eye size={18} color={COLORS.textSecondary} /> : <EyeOff size={18} color={COLORS.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* Submit */}
          <TouchableOpacity
            testID="admin-login-submit-btn"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.primaryBtnText}>Access Dashboard</Text>
            }
          </TouchableOpacity>

          {/* Footer Note */}
          <Text style={styles.footerNote}>
            Unauthorized access attempts are logged and monitored
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.md },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.xl },
  backText: { color: COLORS.textSecondary, fontSize: 14 },

  centerSection: { alignItems: 'center', marginBottom: SPACING.xl, paddingTop: SPACING.lg },
  shieldOuter: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(124,58,237,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.15)',
    marginBottom: SPACING.md,
  },
  shieldInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(124,58,237,0.14)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)',
  },
  heading: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginBottom: 6 },
  subheading: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 12 },
  secureBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)',
  },
  secureText: { color: '#22C55E', fontSize: 11, fontWeight: '600' },

  demoBox: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: 14, marginBottom: SPACING.lg,
    borderWidth: 1, borderColor: COLORS.border,
  },
  demoLabel: { color: COLORS.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full, borderWidth: 1 },
  demoChipText: { fontSize: 13, fontWeight: '600' },

  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, letterSpacing: 0.2 },
  input: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md,
    padding: 14, color: COLORS.textPrimary, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  eyeBtn: { padding: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },

  primaryBtn: {
    backgroundColor: '#7C3AED', borderRadius: RADIUS.full,
    paddingVertical: 16, alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  footerNote: {
    color: COLORS.textTertiary, fontSize: 12, textAlign: 'center',
    marginTop: SPACING.lg, lineHeight: 18,
  },
});
