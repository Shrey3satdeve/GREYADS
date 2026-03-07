import { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ArrowLeft, ArrowRight, Megaphone } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      // Seed data first if not done
      await api.post('/seed', {}, false).catch(() => {});
      const data = await api.post('/auth/register', { name: name.trim(), email: email.trim().toLowerCase(), password, phone }, false);
      await login(data.token, data.user);
    } catch (err: any) {
      Alert.alert('Signup Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.logoRow}>
              <View style={styles.iconRing}>
                <Megaphone size={20} color="#FFF" strokeWidth={2} />
              </View>
              <Text style={styles.logoText}>Grey<Text style={{ color: '#A1A1AA' }}>Adz</Text>.</Text>
            </View>
          </View>

          <Text style={styles.heading}>Create Account</Text>
          <Text style={styles.subheading}>Join GreyAdz to start booking events</Text>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            testID="signup-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Alex Johnson"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            testID="signup-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            testID="signup-phone-input"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+91 98765 43210"
            placeholderTextColor={COLORS.textTertiary}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="signup-password-input"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              placeholderTextColor={COLORS.textTertiary}
              secureTextEntry={!showPw}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
              {showPw ? <Eye size={18} color={COLORS.textSecondary} /> : <EyeOff size={18} color={COLORS.textSecondary} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="signup-submit-btn"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator color="#000" /> : (
              <>
                <Text style={styles.primaryBtnText}>Create Account</Text>
                <ArrowRight size={18} color="#000" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="go-to-login-btn" onPress={() => router.back()} style={styles.linkRow}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: SPACING.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconRing: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '800', color: '#FFF', letterSpacing: -0.5 },
  heading: { color: COLORS.textPrimary, fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginBottom: 6 },
  subheading: { color: COLORS.textSecondary, fontSize: 15, marginBottom: SPACING.lg },
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
});
