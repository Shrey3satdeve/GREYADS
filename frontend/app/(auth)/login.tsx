import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, Megaphone, ArrowRight, Shield } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email: email.trim().toLowerCase(), password }, false);
      await login(data.token, data.user);
    } catch (err: any) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type: 'user' | 'staff' | 'admin') => {
    const creds = {
      user: { email: 'user@test.com', password: 'Test@123' },
      staff: { email: 'staff@greyads.com', password: 'Staff@123' },
      admin: { email: 'admin@greyads.com', password: 'Admin@123' },
    };
    setEmail(creds[type].email);
    setPassword(creds[type].password);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoRow}>
            <View style={styles.iconRing}>
              <Megaphone size={24} color="#FFF" strokeWidth={2} />
            </View>
            <Text style={styles.logoText}>Grey<Text style={{ color: '#A1A1AA' }}>Adz</Text>.</Text>
          </View>

          <Text style={styles.heading}>Welcome back</Text>
          <Text style={styles.subheading}>Sign in to discover & book events</Text>

          {/* Demo hint */}
          <View style={styles.demoBox}>
            <Text style={styles.demoLabel}>Quick Demo Login</Text>
            <View style={styles.demoRow}>
              <TouchableOpacity testID="demo-user-btn" style={styles.demoChip} onPress={() => fillDemo('user')}>
                <Text style={styles.demoChipText}>User</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="demo-staff-btn" style={[styles.demoChip, { borderColor: '#22C55E' }]} onPress={() => fillDemo('staff')}>
                <Text style={[styles.demoChipText, { color: '#22C55E' }]}>Staff</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="demo-admin-btn" style={[styles.demoChip, { borderColor: '#7C3AED' }]} onPress={() => fillDemo('admin')}>
                <Text style={[styles.demoChipText, { color: '#7C3AED' }]}>Admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="login-password-input"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity testID="toggle-password-btn" style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
              {showPw ? <Eye size={18} color={COLORS.textSecondary} /> : <EyeOff size={18} color={COLORS.textSecondary} />}
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            testID="login-submit-btn"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#000" /> : (
              <>
                <Text style={styles.primaryBtnText}>Sign In</Text>
                <ArrowRight size={18} color="#000" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          {/* Signup Link */}
          <TouchableOpacity testID="go-to-signup-btn" onPress={() => router.push('/(auth)/signup')} style={styles.linkRow}>
            <Text style={styles.linkText}>Don't have an account? <Text style={styles.linkAccent}>Sign Up</Text></Text>
          </TouchableOpacity>

          {/* Admin/Staff Login Link */}
          <TouchableOpacity testID="admin-login-btn" onPress={() => router.push('/(admin)/login')} style={styles.adminRow}>
            <Shield size={14} color={COLORS.textTertiary} />
            <Text style={styles.adminText}>Admin & Staff Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.xl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: SPACING['2xl'] },
  iconRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 22, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  heading: { color: COLORS.textPrimary, fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  subheading: { color: COLORS.textSecondary, fontSize: 15, marginBottom: SPACING.lg },
  demoBox: { backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 12, marginBottom: SPACING.lg, borderWidth: 1, borderColor: COLORS.border },
  demoLabel: { color: COLORS.textTertiary, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.border },
  demoChipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  label: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, padding: 14,
    color: COLORS.textPrimary, fontSize: 15, borderWidth: 1, borderColor: COLORS.border, marginBottom: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  eyeBtn: { padding: 14, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.btnPrimary, borderRadius: RADIUS.full, paddingVertical: 16, marginTop: 4,
    shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 20, elevation: 5,
  },
  primaryBtnText: { color: COLORS.btnPrimaryText, fontSize: 16, fontWeight: '700' },
  linkRow: { alignItems: 'center', paddingVertical: 16 },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  linkAccent: { color: COLORS.textPrimary, fontWeight: '700' },
  adminRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  adminText: { color: COLORS.textTertiary, fontSize: 13 },
});
