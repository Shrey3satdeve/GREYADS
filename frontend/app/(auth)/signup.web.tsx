import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return;
    }

    setLoading(true);
    try {
      await login(`web-signup-${Date.now()}`, {
        id: `web-user-${Date.now()}`,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        role: 'user',
        createdAt: new Date().toISOString(),
      });
      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
          </View>

          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            testID="signup-name-input"
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Rahul Sharma"
            placeholderTextColor="#71717A"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            testID="signup-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. rahul@example.com"
            placeholderTextColor="#71717A"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Phone (optional)</Text>
          <TextInput
            testID="signup-phone-input"
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. 9876543210"
            placeholderTextColor="#71717A"
          />

          <Text style={styles.label}>Password *</Text>
          <View style={styles.inputRow}>
            <TextInput
              testID="signup-password-input"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter a strong password"
              placeholderTextColor="#71717A"
              secureTextEntry={!showPw}
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(!showPw)}>
              {showPw ? <Eye size={18} color="#A1A1AA" /> : <EyeOff size={18} color="#A1A1AA" />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            testID="signup-submit-btn"
            style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
            onPress={handleSignup}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Create Account</Text>
                <ArrowRight size={18} color="#000" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="go-to-login-btn" onPress={() => router.back()} style={styles.linkRow}>
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkAccent}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272A' },
  headerTitle: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  label: { color: '#A1A1AA', fontSize: 13, fontWeight: '600', marginBottom: 6, letterSpacing: 0.3 },
  input: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 14,
    color: '#FFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 14,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  eyeBtn: { padding: 14, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: '#27272A' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF',
    borderRadius: 9999,
    paddingVertical: 16,
    marginTop: 4,
  },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '700' },
  linkRow: { alignItems: 'center', paddingVertical: 16 },
  linkText: { color: '#A1A1AA', fontSize: 14 },
  linkAccent: { color: '#FFF', fontWeight: '700' },
});
