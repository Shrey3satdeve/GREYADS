import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
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
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import BrandMark from '../../components/BrandMark';
import { useDialog } from '../../components/AppDialog';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');
const TABS = ['USER', 'STAFF', 'ADMIN'] as const;
const ENABLE_DEMO_LOGIN = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === '1';

type RoleType = 'user' | 'staff' | 'admin';

const DEMO_CREDENTIALS = {
  admin: {
    email: 'admin@greyads.com',
    password: 'Admin@123',
    user: { id: 'admin-1', name: 'Sarah Admin', email: 'admin@greyads.com', role: 'admin' as const },
  },
  staff: {
    email: 'staff@greyads.com',
    password: 'Staff@123',
    user: { id: 'staff-1', name: 'Rohan Staff', email: 'staff@greyads.com', role: 'staff' as const },
  },
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleType>('user');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const { login } = useAuth();
  const { showDialog, DialogComponent } = useDialog();

  const buttonWidth = useMemo(() => {
    const horizontalPadding = 32;
    const pillPadding = 8;
    const availableWidth = width - horizontalPadding * 2 - pillPadding;
    return availableWidth / TABS.length;
  }, []);

  useEffect(() => {
    const toValue = selectedRole === 'staff' ? 1 : selectedRole === 'admin' ? 2 : 0;
    Animated.timing(slideAnim, {
      toValue,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [selectedRole, slideAnim]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, buttonWidth, buttonWidth * 2],
  });

  const fillDemoCredentials = (role: 'admin' | 'staff') => {
    const preset = DEMO_CREDENTIALS[role];
    setSelectedRole(role);
    setEmail(preset.email);
    setPassword(preset.password);
  };

  const handleRestrictedLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showDialog({ title: 'Missing Fields', message: 'Email aur password dono enter karo.' });
      return;
    }

    setLoading(true);
    try {
      const preset = DEMO_CREDENTIALS[selectedRole as 'admin' | 'staff'];
      if (!preset || email.trim().toLowerCase() !== preset.email || password !== preset.password) {
        throw new Error('Web E2E mode me restricted demo credentials hi allow hain.');
      }

      await login(`web-demo-${selectedRole}`, {
        ...preset.user,
        createdAt: new Date().toISOString(),
      });

      if (selectedRole === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(scanner)');
      }
    } catch (error: any) {
      showDialog({ title: 'Login Failed', message: error.message || 'Restricted access login failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = () => {
    if (phoneNumber.trim().length !== 10) {
      showDialog({ title: 'Invalid Number', message: '10-digit phone number enter karo.' });
      return;
    }
    setOtpSent(true);
    setOtp('123456');
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length !== 6) {
      showDialog({ title: 'Invalid OTP', message: '6-digit OTP enter karo.' });
      return;
    }

    setLoading(true);
    try {
      await login('web-demo-user', {
        id: 'web-user',
        name: 'Web Explorer',
        email: '',
        phone: `+91${phoneNumber}`,
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoPill}>
              <BrandMark size={36} imageScale={0.65} />
              <View style={styles.logoPillTextContainer}>
                <Text style={styles.logoPillTextWhite}>GREY</Text>
                <Text style={styles.logoPillTextGrey}>ADZ</Text>
              </View>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heading}>{selectedRole === 'user' ? 'Welcome' : 'Restricted Access'}</Text>
            <Text style={styles.subheading}>
              {selectedRole === 'user'
                ? 'Sign in to your GreyAdz account'
                : `${selectedRole.toUpperCase()} Login - authorized personnel only`}
            </Text>
          </View>

          <View style={styles.roleContainer}>
            <Text style={styles.roleLabel}>ACCESS AS</Text>
            <View style={styles.roleTabs}>
              <Animated.View style={[styles.slidingPill, { width: buttonWidth, transform: [{ translateX }] }]} />
              {TABS.map((tab) => {
                const roleKey = tab.toLowerCase() as RoleType;
                const isActive = selectedRole === roleKey;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={styles.roleTab}
                    onPress={() => setSelectedRole(roleKey)}
                    activeOpacity={0.85}
                    testID={`role-tab-${roleKey}`}
                  >
                    <Text style={[styles.roleTabText, isActive && styles.roleTabTextActive]}>{tab}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.form}>
            {selectedRole === 'user' ? (
              <>
                {!otpSent ? (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>PHONE NUMBER</Text>
                      <TextInput
                        style={styles.input}
                        value={phoneNumber}
                        onChangeText={(value) => setPhoneNumber(value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        placeholderTextColor="#3F3F46"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleSendOtp}>
                      <Text style={styles.primaryBtnText}>SEND OTP</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <View style={styles.field}>
                      <Text style={styles.label}>ENTER OTP</Text>
                      <TextInput
                        style={styles.input}
                        value={otp}
                        onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit code"
                        placeholderTextColor="#3F3F46"
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                    </View>
                    <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyOtp} disabled={loading}>
                      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>VERIFY OTP</Text>}
                    </TouchableOpacity>
                  </>
                )}
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>EMAIL ADDRESS</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="yours@example.com"
                    placeholderTextColor="#3F3F46"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>PASSWORD</Text>
                  <View style={styles.passwordWrap}>
                    <TextInput
                      style={styles.passwordInput}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                      placeholderTextColor="#3F3F46"
                      secureTextEntry={!showPw}
                    />
                    <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                      {showPw ? <Eye size={18} color="#71717A" /> : <EyeOff size={18} color="#71717A" />}
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.7 }]} onPress={handleRestrictedLogin} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>SIGN IN</Text>
                      <ArrowRight size={18} color="#000" strokeWidth={2.5} />
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {selectedRole !== 'user' && ENABLE_DEMO_LOGIN && (
              <View style={styles.demoCard}>
                <Text style={styles.demoLabel}>QUICK DEMO</Text>
                <Text style={styles.demoCopy}>Restricted roles ke liye ready-to-use credentials.</Text>
                <View style={styles.demoActions}>
                  <TouchableOpacity
                    testID="demo-admin-fill"
                    style={[styles.demoBtn, selectedRole === 'admin' && styles.demoBtnActive]}
                    onPress={() => fillDemoCredentials('admin')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.demoBtnText, selectedRole === 'admin' && styles.demoBtnTextActive]}>Fill Admin Credits</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="demo-staff-fill"
                    style={[styles.demoBtn, selectedRole === 'staff' && styles.demoBtnActive]}
                    onPress={() => fillDemoCredentials('staff')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.demoBtnText, selectedRole === 'staff' && styles.demoBtnTextActive]}>Fill Staff Credits</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)} style={styles.footerLink}>
              <Text style={styles.footerLinkText}>
                No account? <Text style={styles.footerLinkAccent}>Join GreyAdz</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      {DialogComponent}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 40 },
  header: { marginTop: 40, marginBottom: 40, alignItems: 'center' },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 100,
    padding: 6,
    paddingRight: 20,
    borderWidth: 1,
    borderColor: '#18181B',
  },
  logoPillTextContainer: { flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  logoPillTextWhite: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  logoPillTextGrey: { color: '#71717A', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  hero: { marginBottom: 32 },
  heading: { color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  subheading: { color: '#71717A', fontSize: 16, marginTop: 4 },
  roleContainer: { marginBottom: 32 },
  roleLabel: { color: '#3F3F46', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 12 },
  roleTabs: {
    flexDirection: 'row',
    backgroundColor: '#0A0A0A',
    padding: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#18181B',
    position: 'relative',
  },
  slidingPill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: '#FFF',
    borderRadius: 100,
  },
  roleTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 100, zIndex: 1 },
  roleTabText: { color: '#71717A', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  roleTabTextActive: { color: '#000' },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { color: '#3F3F46', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  input: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#18181B' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: '#18181B', overflow: 'hidden' },
  passwordInput: { flex: 1, padding: 16, color: '#FFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 16 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 100, paddingVertical: 18, marginTop: 12 },
  primaryBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  demoCard: { backgroundColor: '#0A0A0A', borderRadius: 24, borderWidth: 1, borderColor: '#18181B', padding: 16, gap: 10 },
  demoLabel: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 },
  demoCopy: { color: '#71717A', fontSize: 13, lineHeight: 18 },
  demoActions: { gap: 10 },
  demoBtn: { backgroundColor: '#111111', borderRadius: 16, borderWidth: 1, borderColor: '#27272A', paddingVertical: 12, paddingHorizontal: 14 },
  demoBtnActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  demoBtnText: { color: '#E4E4E7', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  demoBtnTextActive: { color: '#000000' },
  footerLink: { alignItems: 'center', marginTop: 12 },
  footerLinkText: { color: '#71717A', fontSize: 14 },
  footerLinkAccent: { color: '#FFF', fontWeight: '800' },
});
