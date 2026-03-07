import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Shield, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function AdminLoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email: email.trim().toLowerCase(), password }, false);
      if (!['admin', 'staff'].includes(data.user.role)) {
        Alert.alert('Access Denied', 'This login is for Admin and Staff only.');
        return;
      }
      await login(data.token, data.user);
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity testID="back-to-user-btn" style={styles.backBtn} onPress={() => router.replace('/(auth)/login')}>
            <ArrowLeft size={18} color={COLORS.textSecondary} />
            <Text style={styles.backText}>Back to User Login</Text>
          </TouchableOpacity>

          {/* Shield Icon */}
          <View style={styles.shieldWrap}>
            <View style={styles.shieldIcon}>
              <Shield size={36} color="#7C3AED" strokeWidth={1.5} />
            </View>
            <Text style={styles.heading}>Admin & Staff</Text>
            <Text style={styles.subheading}>Restricted access — authorized personnel only</Text>
          </View>

          {/* Demo Quick Fill */}
          <View style={styles.demoBox}>
            <Text style={styles.demoLabel}>Quick Demo</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity testID="demo-admin-fill" style={[styles.demoChip, { borderColor: '#7C3AED60' }]} onPress={() => fillDemo('admin')}>
                <Text style={[styles.demoChipText, { color: '#7C3AED' }]}>Admin</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="demo-staff-fill" style={[styles.demoChip, { borderColor: '#22C55E60' }]} onPress={() => fillDemo('staff')}>
                <Text style={[styles.demoChipText, { color: '#22C55E' }]}>Staff</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="admin-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="admin@greyads.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />

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

          <TouchableOpacity
            testID="admin-login-submit-btn"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Access Dashboard</Text>}
          </TouchableOpacity>
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
  shieldWrap: { alignItems: 'center', marginBottom: SPACING.xl, gap: 8 },
  shieldIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#7C3AED20', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#7C3AED30', marginBottom: 8 },
  heading: { color: COLORS.textPrimary, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  subheading: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center' },
  demoBox: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  demoLabel: { color: COLORS.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1 },
  demoChipText: { fontSize: 13, fontWeight: '600' },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 14, color: COLORS.textPrimary, fontSize: 15, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  eyeBtn: { padding: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  primaryBtn: { backgroundColor: '#7C3AED', borderRadius: RADIUS.full, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
