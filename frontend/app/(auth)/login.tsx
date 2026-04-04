import { useEffect, useRef, useState } from 'react';
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
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import rnfbAuth, { sendPasswordResetEmail } from '@react-native-firebase/auth';
import { auth } from '../../utils/firebase';
import BrandMark from '../../components/BrandMark';
import { useDialog } from '../../components/AppDialog';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
});


const { width } = Dimensions.get('window');
const TABS = ['USER', 'STAFF', 'ADMIN'] as const;
const ENABLE_DEMO_LOGIN = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === '1';
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';

type RoleType = 'user' | 'staff' | 'admin';

// Demo mode: only pre-fills the email address, never the password.
// Credentials are never hardcoded in the bundle.
const DEMO_EMAILS: Record<Exclude<RoleType, 'user'>, string> = {
  admin: 'admin@greyads.com',
  staff: 'staff@greyads.com',
};

// Client-side rate limiting — 5 failures triggers a 30-second lockout.
const MAX_ATTEMPTS  = 5;
const LOCKOUT_MS    = 30_000;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleType>('user');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpBanner, setOtpBanner] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [loginLocked, setLoginLocked] = useState(false);
  const [lockCountdown, setLockCountdown] = useState(0);
  const failedAttemptsRef = useRef(0);
  const lockTimerRef      = useRef<any>(null);
  const lockIntervalRef   = useRef<any>(null);
  const confirmationResult = useRef<any>(null);
  const otpTimeout = useRef<any>(null);
  const otpInputRef = useRef<TextInput>(null);
  const resendInterval = useRef<any>(null);
  const router = useRouter();
  const { login } = useAuth();
  const { showDialog, DialogComponent } = useDialog();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      // Store the desired role so AuthContext can provision it correctly if the user is new
      await AsyncStorage.setItem('pending_role', selectedRole);
      
      await GoogleSignin.hasPlayServices();
      const { data: responseData } = await GoogleSignin.signIn();
      
      const idToken = responseData?.idToken;
      if (!idToken) throw new Error("No ID Token found");

      const credential = rnfbAuth.GoogleAuthProvider.credential(idToken);
      const userCreds = await rnfbAuth().signInWithCredential(credential);
      const fbIdToken = await userCreds.user.getIdToken(true);

      const data: any = await api.post('/auth/google', { access_token: fbIdToken, role: selectedRole });
      await login(fbIdToken, data.user);

      if (data.user.role === 'admin') {
        router.replace('/(admin)');
      } else if (data.user.role === 'staff') {
        router.replace('/(scanner)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      if (err.code !== 'SIGN_IN_CANCELLED') {
        showDialog({ title: 'Google Sign-In Failed', message: err.message || 'Could not sign in with Google' });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  // -------------------------------------------------------
  // Phone OTP — uses @react-native-firebase/auth natively.
  // Android handles attestation via Play Integrity;
  // no reCAPTCHA or WebView required.
  // -------------------------------------------------------
  const startResendCountdown = () => {
    setResendCooldown(60);
    if (resendInterval.current) clearInterval(resendInterval.current);
    resendInterval.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(resendInterval.current);
          resendInterval.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async (isResend = false) => {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (!cleaned) {
      showDialog({ title: 'Missing Field', message: 'Please enter your phone number.' });
      return;
    }
    if (cleaned.length !== 10) {
      showDialog({ title: 'Invalid Format', message: 'Please enter a 10-digit number.' });
      return;
    }

    setLoading(true);
    setOtpBanner('');
    if (isResend) setOtp('');
    await AsyncStorage.setItem('pending_role', selectedRole);

    // 30-second guard so the button never freezes forever
    otpTimeout.current = setTimeout(() => {
      setLoading(false);
      showDialog({ title: 'Timeout', message: 'OTP request timed out. Please check your connection and try again.' });
    }, 30000);

    try {
      const result = await rnfbAuth().signInWithPhoneNumber('+91' + cleaned);
      clearTimeout(otpTimeout.current!);
      otpTimeout.current = null;
      confirmationResult.current = result;
      // Flip to OTP screen immediately — no dialog to dismiss
      setOtpSent(true);
      setLoading(false);
      setOtpBanner(`OTP sent to +91 xxxxxxxx${cleaned.slice(-2)} ✓`);
      startResendCountdown();
      // Auto-focus OTP input quickly
      setTimeout(() => { otpInputRef.current?.focus(); }, 100);
    } catch (err: any) {
      clearTimeout(otpTimeout.current!);
      otpTimeout.current = null;
      setLoading(false);
      showDialog({ title: 'Failed to Send OTP', message: err.message || 'Please try again.' });
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showDialog({ title: 'Missing Field', message: 'Please enter the OTP.' });
      return;
    }
    if (!confirmationResult.current) {
      showDialog({ title: 'Session Expired', message: 'Please request a new OTP.' });
      return;
    }
    setLoading(true);
    try {
      // Confirm with native SDK
      const result = await confirmationResult.current.confirm(otp);
      
      // Get an ID token from the native auth result
      const idToken = await result?.user?.getIdToken();
      if (!idToken) throw new Error("Could not retrieve authentication token.");
      const res: any = await api.post('/auth/login', { access_token: idToken, role: selectedRole });
      await login(idToken, res.user);
    } catch (err: any) {
      setLoading(false);
      const msg = err.code === 'auth/invalid-verification-code'
        ? 'Incorrect OTP. Please check and try again.'
        : (err.message || 'Verification failed. Please try again.');
      showDialog({ title: 'Invalid OTP', message: msg });
    }
  };




  const horizontalPadding = 32;
  const pillPadding = 8;
  const availableWidth = width - (horizontalPadding * 2) - pillPadding;
  const buttonWidth = availableWidth / TABS.length;

  useEffect(() => {
    let toValue = 0;
    if (selectedRole === 'staff') toValue = 1;
    if (selectedRole === 'admin') toValue = 2;
    if (selectedRole === 'admin') toValue = 2;

    Animated.timing(slideAnim, {
      toValue,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [selectedRole, slideAnim]);

  // Rate limiter — called after each failed email/password attempt
  const recordFailedAttempt = () => {
    failedAttemptsRef.current += 1;
    if (failedAttemptsRef.current >= MAX_ATTEMPTS) {
      setLoginLocked(true);
      setLockCountdown(LOCKOUT_MS / 1000);
      if (lockIntervalRef.current) clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = setInterval(() => {
        setLockCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(lockIntervalRef.current);
            setLoginLocked(false);
            failedAttemptsRef.current = 0;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  };

  // Demo mode: pre-fills only the email, never the password
  const fillDemoCredentials = (role: Exclude<RoleType, 'user'>) => {
    setSelectedRole(role);
    setEmail(DEMO_EMAILS[role]);
    setPassword(''); // Never pre-fill passwords
  };

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      showDialog({ title: 'Email Required', message: 'Enter your email address above, then tap Forgot Password.' });
      return;
    }
    setLoading(true);
    try {
      // Firebase sends a time-limited reset link (expires in 1 hour)
      await sendPasswordResetEmail(rnfbAuth(), trimmedEmail);
      showDialog({
        title: 'Reset Email Sent',
        // Deliberately vague — do not confirm whether the email exists.
        message: 'If an account exists for that email, a password reset link has been sent. Check your inbox (and spam folder).',
      });
    } catch (err: any) {
      // Same generic message regardless of error — prevents email enumeration.
      showDialog({
        title: 'Reset Email Sent',
        message: 'If an account exists for that email, a password reset link has been sent.',
      });
    } finally {
      setLoading(false);
    }
  };



  const handleLogin = async () => {
    if (loginLocked) {
      showDialog({
        title: 'Too Many Attempts',
        message: `Too many failed login attempts. Please wait ${lockCountdown} seconds and try again.`,
      });
      return;
    }
    if (!email.trim() || !password.trim()) {
      showDialog({ title: 'Missing Fields', message: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);
    try {
      const userCreds = await rnfbAuth().signInWithEmailAndPassword(
        email.trim().toLowerCase(),
        password
      );

      // Enforce email verification for email/password accounts
      if (!userCreds.user.emailVerified) {
        await rnfbAuth().signOut();
        showDialog({
          title: 'Email Not Verified',
          message: 'Please verify your email address before logging in. Check your inbox for a verification link or request a new one.',
          buttons: [
            {
              label: 'Resend Email',
              style: 'default',
              onPress: async () => {
                try {
                  await userCreds.user.sendEmailVerification();
                  showDialog({ title: 'Sent', message: 'Verification email resent. Check your inbox.' });
                } catch { /* ignore */ }
              },
            },
          ],
        });
        return;
      }

      const fbIdToken = await userCreds.user.getIdToken(true);
      const data: any = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        role: selectedRole,
      });

      // Successful login — reset failure counter
      failedAttemptsRef.current = 0;
      await login(fbIdToken, data.user);

      if (data.user.role === 'admin') {
        router.replace('/(admin)');
      } else if (data.user.role === 'staff') {
        router.replace('/(scanner)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      recordFailedAttempt();
      const remaining = MAX_ATTEMPTS - failedAttemptsRef.current;
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        showDialog({
          title: 'Login Failed',
          message: remaining > 0
            ? `Invalid email or password. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
            : 'Account temporarily locked due to repeated failures.',
        });
      } else if (err.code === 'auth/too-many-requests') {
        showDialog({ title: 'Blocked by Firebase', message: 'Too many requests. Please wait a few minutes before trying again.' });
      } else {
        showDialog({ title: 'Login Failed', message: err.message || 'Something went wrong.' });
      }
    } finally {
      setLoading(false);
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, buttonWidth, buttonWidth * 2],
  });

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
            <Text style={styles.heading}>
              {selectedRole === 'user' ? 'Welcome' : 'Restricted Access'}
            </Text>
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
                    activeOpacity={0.8}
                    testID={`role-tab-${roleKey}`}
                  >
                    <Text style={[styles.roleTabText, isActive && styles.roleTabTextActive]}>
                      {tab}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.form}>
            {(selectedRole === 'admin' || selectedRole === 'staff') ? (
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
                      placeholder="••••••••"
                      placeholderTextColor="#3F3F46"
                      secureTextEntry={!showPw}
                    />
                    <TouchableOpacity onPress={() => setShowPw(!showPw)} style={styles.eyeBtn}>
                      {showPw ? <Eye size={18} color="#71717A" /> : <EyeOff size={18} color="#71717A" />}
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotPwBtn}>
                    <Text style={styles.forgotPwText}>Forgot Password?</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="SIGN IN"
                >
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
            ) : null}

            {(selectedRole === 'user') ? (
              <>
                {!otpSent ? (
                  <View style={styles.field}>
                    <Text style={styles.label}>PHONE NUMBER</Text>
                    <View style={styles.phoneInputContainer}>
                      <View style={styles.countryCode}>
                        <Text style={styles.flagEmoji}>🇮🇳</Text>
                        <Text style={styles.codeText}>+91</Text>
                      </View>
                      <TextInput
                        style={[styles.input, styles.phoneNumberInput]}
                        value={phoneNumber}
                        onChangeText={(val) => setPhoneNumber(val.replace(/\D/g, '').slice(0, 10))}
                        placeholder="9876543210"
                        placeholderTextColor="#3F3F46"
                        keyboardType="phone-pad"
                        maxLength={10}
                      />
                    </View>
                    <TouchableOpacity
                      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                      onPress={() => { handleSendOTP(); }}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>SEND OTP</Text>}
                    </TouchableOpacity>
                  </View>

                ) : (
                  <View style={styles.field}>
                    {!!otpBanner && (
                      <View style={styles.otpBanner}>
                        <Text style={styles.otpBannerText}>{otpBanner}</Text>
                      </View>
                    )}
                    <Text style={styles.label}>ENTER OTP</Text>
                    <TextInput
                      ref={otpInputRef}
                      style={styles.input}
                      value={otp}
                      onChangeText={(val) => {
                        const cleaned = val.replace(/\D/g, '').slice(0, 6);
                        setOtp(cleaned);
                        if (cleaned.length === 6) {
                          handleVerifyOTP();
                        }
                      }}
                      placeholder="6-digit code"
                      placeholderTextColor="#3F3F46"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                    <TouchableOpacity
                      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                      onPress={handleVerifyOTP}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>VERIFY OTP</Text>}
                    </TouchableOpacity>
                    <View style={styles.resendRow}>
                      {resendCooldown > 0 ? (
                        <Text style={styles.resendTimer}>Resend in {resendCooldown}s</Text>
                      ) : (
                        <TouchableOpacity onPress={() => { handleSendOTP(true); }} disabled={loading}>
                          <Text style={styles.resendLink}>Resend OTP</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.resendSep}> · </Text>
                      <TouchableOpacity onPress={() => {
                        setOtpSent(false);
                        confirmationResult.current = null;
                        setOtp('');
                        setOtpBanner('');
                        if (resendInterval.current) clearInterval(resendInterval.current);
                        setResendCooldown(0);
                      }}>
                        <Text style={styles.resendLink}>Change number</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
            ) : null}


            {selectedRole !== 'user' && ENABLE_DEMO_LOGIN && (
              <View style={styles.demoCard}>
                <Text style={styles.demoLabel}>QUICK DEMO</Text>
                <Text style={styles.demoCopy}>Pre-fill demo credentials for restricted-access testing.</Text>
                <View style={styles.demoActions}>
                  <TouchableOpacity
                    testID="demo-admin-fill"
                    style={[styles.demoBtn, selectedRole === 'admin' && styles.demoBtnActive]}
                    onPress={() => fillDemoCredentials('admin')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.demoBtnText, selectedRole === 'admin' && styles.demoBtnTextActive]}>
                      Fill Admin Credits
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="demo-staff-fill"
                    style={[styles.demoBtn, selectedRole === 'staff' && styles.demoBtnActive]}
                    onPress={() => fillDemoCredentials('staff')}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.demoBtnText, selectedRole === 'staff' && styles.demoBtnTextActive]}>
                      Fill Staff Credits
                    </Text>
                  </TouchableOpacity>

                </View>
              </View>
            )}

            {selectedRole !== 'admin' && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, (googleLoading || !GOOGLE_CLIENT_ID) && { opacity: 0.4 }]}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading || !GOOGLE_CLIENT_ID}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Svg width={20} height={20} viewBox="0 0 48 48">
                        <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.33 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.67 14.62 48 24 48z"/>
                        <Path fill="none" d="M0 0h48v48H0z"/>
                      </Svg>
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

            {selectedRole === 'user' && (
              <TouchableOpacity onPress={() => router.push('/(auth)/signup' as any)} style={styles.footerLink}>
                <Text style={styles.footerLinkText}>
                  No account? <Text style={styles.footerLinkAccent}>Join GreyAdz</Text>
                </Text>
              </TouchableOpacity>
            )}
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
  logoPillTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  logoPillTextWhite: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  logoPillTextGrey: {
    color: '#71717A',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  branding: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
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
  otpBanner: { backgroundColor: '#052e16', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: '#166534' },
  otpBannerText: { color: '#4ade80', fontSize: 13, fontWeight: '600', textAlign: 'center' },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  resendTimer: { color: '#52525B', fontSize: 13, fontWeight: '500' },
  resendLink: { color: '#A1A1AA', fontSize: 13, fontWeight: '600' },
  resendSep: { color: '#3F3F46', fontSize: 13 },
  label: { color: '#3F3F46', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  input: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#18181B' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: '#18181B', overflow: 'hidden' },
  passwordInput: { flex: 1, padding: 16, color: '#FFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 16 },
  forgotPwBtn: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  forgotPwText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#18181B' },
  dividerText: { color: '#3F3F46', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0A0A0A', borderRadius: 100, paddingVertical: 17, borderWidth: 1, borderColor: '#27272A' },
  googleBtnG: { color: '#FFF', fontSize: 15, fontWeight: '900', fontStyle: 'italic' },
  googleBtnText: { color: '#E4E4E7', fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#18181B',
  },
  flagEmoji: {
    fontSize: 20,
  },
  codeText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  phoneNumberInput: {
    flex: 1,
    marginBottom: 0,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 20,
  },
  recaptchaContainer: {
    backgroundColor: '#0A0A0A',
    borderRadius: 24,
    height: 450,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#18181B',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#18181B',
  },
  modalTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '600',
  },
});

