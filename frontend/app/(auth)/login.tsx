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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import rnfbAuth from '@react-native-firebase/auth';
import BrandMark from '../../components/BrandMark';
import { useDialog } from '../../components/AppDialog';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { configureGoogleSignin, getGoogleIdToken, getGoogleSignInErrorMessage } from '../../utils/googleSignIn';

const { width } = Dimensions.get('window');
const TABS = ['USER', 'STAFF', 'ADMIN'] as const;
const USER_AUTH_TABS = ['EMAIL', 'OTP'] as const;
const ENABLE_DEMO_LOGIN = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === '1';
const ENABLE_TEST_PHONE_AUTH = __DEV__ || process.env.EXPO_PUBLIC_ENABLE_TEST_PHONE_AUTH === '1';
const ENABLE_OTP_RECAPTCHA_RETRY = Platform.OS === 'android' && !ENABLE_TEST_PHONE_AUTH;

type RoleType = 'user' | 'staff' | 'admin';
type UserAuthMode = 'email' | 'otp';

const DEMO_CREDENTIALS: Record<Exclude<RoleType, 'user'>, { email: string; password: string }> = {
  admin: { email: 'greyadz01@gmail.com', password: 'Barfi@4' },
  staff: { email: 'staff@greyadz.com', password: 'Staff@123' },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

configureGoogleSignin();

const isTransientProfileError = (error: any) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();

  return (
    code.includes('unavailable') ||
    message.includes('service is currently unavailable') ||
    message.includes("backend didn't respond") ||
    message.includes('network request failed') ||
    message.includes('timed out')
  );
};

const isAndroidOtpVerificationBootstrapError = (error: any) => {
  const rawMessage = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const combined = `${code} ${rawMessage}`;

  return (
    combined.includes('missing-client-identifier') ||
    combined.includes('play integrity') ||
    combined.includes('app verification') ||
    combined.includes('recaptcha')
  );
};

export default function LoginScreen() {
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [selectedRole, setSelectedRole] = useState<RoleType>('user');
  const [userAuthMode, setUserAuthMode] = useState<UserAuthMode>('email');
  const router = useRouter();
  const { login } = useAuth();
  const { showDialog, DialogComponent } = useDialog();
  const slideAnim = useRef(new Animated.Value(0)).current;

  const horizontalPadding = 32;
  const pillPadding = 8;
  const availableWidth = width - (horizontalPadding * 2) - pillPadding;
  const buttonWidth = availableWidth / 3;
  const postLoginRedirect = Array.isArray(redirect) ? redirect[0] : redirect;

  const redirectToRequestedScreen = (role: RoleType | string) => {
    if (role !== 'user') {
      return false;
    }

    if (!postLoginRedirect || !postLoginRedirect.startsWith('/') || postLoginRedirect.startsWith('//')) {
      return false;
    }

    router.replace(postLoginRedirect as any);
    return true;
  };

  useEffect(() => {
    let toValue = 0;
    if (selectedRole === 'staff') toValue = 1;
    if (selectedRole === 'admin') toValue = 2;

    Animated.timing(slideAnim, {
      toValue,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [selectedRole, slideAnim]);

  useEffect(() => {
    if (selectedRole === 'user' && userAuthMode === 'otp') {
      return;
    }

    setOtp('');
    setOtpSent(false);
    setSendingOtp(false);
    setVerifyingOtp(false);
    setOtpCountdown(0);
    setConfirmation(null);

    if (selectedRole !== 'user') {
      setUserAuthMode('email');
    }
  }, [selectedRole, userAuthMode]);

  useEffect(() => {
    if (otpCountdown <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      setOtpCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timer);
  }, [otpCountdown]);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      rnfbAuth().settings.appVerificationDisabledForTesting = ENABLE_TEST_PHONE_AUTH;
      rnfbAuth().settings.forceRecaptchaFlowForTesting = !ENABLE_TEST_PHONE_AUTH;
    } catch (error) {
      console.warn('[Auth] Unable to configure Android phone auth testing:', error);
    }
  }, []);

  const fillDemoCredentials = (role: Exclude<RoleType, 'user'>) => {
    const creds = DEMO_CREDENTIALS[role];
    setSelectedRole(role);
    setEmail(creds.email);
    setPassword(creds.password);
  };

  const getOtpFailureMessage = (error: any) => {
    const rawMessage = String(error?.message || '').trim();
    const normalized = rawMessage.toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const combined = `${code} ${normalized}`;

    if (ENABLE_TEST_PHONE_AUTH) {
      return rawMessage || 'Test phone auth is enabled. Use a Firebase-whitelisted test number and OTP from the Firebase console.';
    }

    if (
      combined.includes('session-expired') ||
      combined.includes('code:39') ||
      combined.includes('internal error has occurred')
    ) {
      return 'This OTP session expired. Tap Resend OTP, wait for the fresh code, and then verify again.';
    }

    if (
      combined.includes('invalid-verification-code') ||
      combined.includes('invalid code')
    ) {
      return 'The OTP you entered is invalid. Please check the latest SMS code and try again.';
    }

    if (
      Platform.OS === 'android' &&
      (
        normalized.includes('recaptcha') ||
        normalized.includes('captcha') ||
        normalized.includes('app verification') ||
        normalized.includes('missing initial state')
      )
    ) {
      return 'Android OTP is falling back to Google verification for this build. To avoid the browser challenge, add the app\'s release SHA-1 and SHA-256 in Firebase and test from a Play-distributed build.';
    }

    return rawMessage || 'Could not send OTP. Please try again.';
  };

  const finishRoleLogin = async (role: RoleType, firebaseUser: any, endpoint: '/auth/login' | '/auth/google' = '/auth/login') => {
    const data = await api.post(
      endpoint,
      { role },
      false,
    );

    const idToken = data?.token || await firebaseUser.getIdToken(true);
    await login(idToken, data.user);
    // RootRedirect owns role-based navigation so we do not dispatch overlapping replaces from auth screens.
    redirectToRequestedScreen(data.user.role);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      showDialog({
        title: 'Email Required',
        message: 'Please enter your email address to reset your password.',
      });
      return;
    }

    try {
      await rnfbAuth().sendPasswordResetEmail(email.trim().toLowerCase());
      showDialog({
        title: 'Password Reset',
        message: 'Password reset email sent. Check your inbox and spam folder.',
      });
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code.includes('invalid-email')) {
        showDialog({
          title: 'Invalid Email',
          message: 'Please enter a valid email address.',
        });
        return;
      }

      showDialog({
        title: 'Password Reset',
        message: 'If this email is registered, a reset link has been sent.',
      });
    }
  };

  const handleSendOtp = async () => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '').slice(0, 10);
    if (cleanedPhone.length !== 10) {
      showDialog({ title: 'Invalid Number', message: 'Please enter a valid 10-digit phone number.' });
      return;
    }

    if (otpCountdown > 0 && otpSent) {
      showDialog({
        title: 'Wait a Moment',
        message: `Please wait ${otpCountdown}s before requesting another OTP.`,
      });
      return;
    }

    setSendingOtp(true);
    setOtp('');
    setOtpSent(false);
    setConfirmation(null);
    try {
      if (Platform.OS === 'android') {
        rnfbAuth().settings.appVerificationDisabledForTesting = ENABLE_TEST_PHONE_AUTH;
        rnfbAuth().settings.forceRecaptchaFlowForTesting = !ENABLE_TEST_PHONE_AUTH;
      }

      const result = await rnfbAuth().signInWithPhoneNumber(`+91${cleanedPhone}`);
      setConfirmation(result);
      setOtpSent(true);
      setOtpCountdown(30);
      showDialog({ title: 'OTP Sent', message: 'A verification code has been sent to your phone.' });
    } catch (err: any) {
      if (ENABLE_OTP_RECAPTCHA_RETRY && !ENABLE_TEST_PHONE_AUTH && isAndroidOtpVerificationBootstrapError(err)) {
        try {
          rnfbAuth().settings.forceRecaptchaFlowForTesting = true;
          const retryResult = await rnfbAuth().signInWithPhoneNumber(`+91${cleanedPhone}`);
          setConfirmation(retryResult);
          setOtpSent(true);
          setOtpCountdown(30);
          showDialog({ title: 'OTP Sent', message: 'Verification switched to secure browser fallback. Enter the OTP to continue.' });
          return;
        } catch (retryError: any) {
          showDialog({
            title: 'OTP Failed',
            message: getOtpFailureMessage(retryError),
          });
          return;
        }
      }

      showDialog({
        title: 'OTP Failed',
        message: getOtpFailureMessage(err),
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!confirmation) {
      showDialog({ title: 'OTP Required', message: 'Please send the OTP first.' });
      return;
    }

    if (otp.trim().length !== 6) {
      showDialog({ title: 'Invalid OTP', message: 'Please enter the 6-digit code.' });
      return;
    }

    setVerifyingOtp(true);
    try {
      const userCred = await confirmation.confirm(otp.trim());
      await finishRoleLogin('user', userCred.user, '/auth/login');
    } catch (err: any) {
      const message = getOtpFailureMessage(err);
      if (message.toLowerCase().includes('expired')) {
        setConfirmation(null);
        setOtpSent(false);
        setOtp('');
        setOtpCountdown(0);
      }
      showDialog({
        title: 'OTP Verification Failed',
        message,
      });
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showDialog({ title: 'Missing Fields', message: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const credential = await rnfbAuth().signInWithEmailAndPassword(normalizedEmail, password);
      await credential.user.reload();
      const firebaseUser = rnfbAuth().currentUser || credential.user;
      const isEmailPasswordUser = firebaseUser.providerData?.some((provider) => provider?.providerId === 'password');

      if (selectedRole === 'user' && isEmailPasswordUser && !firebaseUser.emailVerified) {
        await rnfbAuth().signOut();
        showDialog({
          title: 'Email Not Verified',
          message: 'Please verify your email before signing in.',
        });
        return;
      }

      let data: any;
      try {
        data = await api.post(
          '/auth/login',
          {
            role: selectedRole,
          },
          false,
        );
      } catch (profileErr: any) {
        if (isTransientProfileError(profileErr)) {
          await sleep(1200);
          try {
            data = await api.post(
              '/auth/login',
              {
                role: selectedRole,
              },
              false,
            );
          } catch (retryErr: any) {
            if (selectedRole === 'user' && isTransientProfileError(retryErr)) {
              const fallbackToken = await firebaseUser.getIdToken();
              const fallbackUser = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || 'User',
                email: firebaseUser.email || normalizedEmail,
                role: 'user' as const,
                avatar_url: firebaseUser.photoURL || undefined,
                phone: firebaseUser.phoneNumber || undefined,
              };

              await login(fallbackToken, fallbackUser);
              redirectToRequestedScreen(fallbackUser.role);
              return;
            }

            throw retryErr;
          }
        } else {
          throw profileErr;
        }
      }

      if (selectedRole === 'admin' && data.user.role !== 'admin') {
        await rnfbAuth().signOut();
        showDialog({
          title: 'Access Denied',
          message: 'This account does not have Admin privileges.',
        });
        return;
      }
      if (selectedRole === 'staff' && data.user.role !== 'staff' && data.user.role !== 'admin') {
        await rnfbAuth().signOut();
        showDialog({
          title: 'Access Denied',
          message: 'This account does not have Staff privileges.',
        });
        return;
      }
      if (selectedRole === 'user' && data.user.role !== 'user') {
        await rnfbAuth().signOut();
        showDialog({
          title: 'Access Denied',
          message: 'Please switch to the correct role before signing in.',
        });
        return;
      }

      const idToken = data?.token || await firebaseUser.getIdToken(true);
      await login(idToken, data.user);
      redirectToRequestedScreen(data.user.role);
    } catch (err: any) {
      const code = err?.code || '';
      let message = err?.message || 'Invalid credentials';

      if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
        message = 'Invalid email or password.';
      } else if (code.includes('invalid-email')) {
        message = 'Please enter a valid email address.';
      } else if (code.includes('too-many-requests')) {
        message = 'Too many login attempts. Please wait a moment and try again.';
      }

      showDialog({ title: 'Login Failed', message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (selectedRole !== 'user') {
      showDialog({
        title: 'Google Sign-In',
        message: 'Continue with Google is available only for user accounts.',
      });
      return;
    }

    setGoogleLoading(true);
    try {
      const { cancelled, idToken } = await getGoogleIdToken();
      if (cancelled) {
        return;
      }

      const credential = rnfbAuth.GoogleAuthProvider.credential(idToken);
      const userCreds = await rnfbAuth().signInWithCredential(credential);
      const firebaseUser = userCreds.user;

      await finishRoleLogin('user', firebaseUser, '/auth/google');
    } catch (err: any) {
      const message = getGoogleSignInErrorMessage(err);
      if (!message) {
        return;
      }
      showDialog({ title: 'Google Sign-In Failed', message });
    } finally {
      setGoogleLoading(false);
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, buttonWidth, buttonWidth * 2],
  });
  const isUserOtpMode = selectedRole === 'user' && userAuthMode === 'otp';
  const shouldShowCredentialFields = selectedRole !== 'user' || userAuthMode === 'email';
  const otpSubText = ENABLE_TEST_PHONE_AUTH
    ? 'Testing mode is enabled. Use a Firebase-whitelisted test phone number and OTP.'
    : Platform.OS === 'android'
      ? 'Android may open Google verification in the browser on sideloaded builds.'
      : 'Use your mobile number to receive a secure one-time code.';

  return (
    <SafeAreaView style={styles.safe}>
      {DialogComponent}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.branding}>
              <BrandMark size={44} />
              <Text style={styles.logoText}>
                GREY<Text style={{ color: '#71717A' }}>ADZ</Text>
              </Text>
            </View>
          </View>

          <View style={styles.hero}>
            <Text style={styles.heading}>
              {selectedRole === 'user' ? 'Welcome Back' : 'Restricted Access'}
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

          {selectedRole === 'user' && (
            <View style={styles.userModeContainer}>
              <Text style={styles.roleLabel}>SIGN IN WITH</Text>
              <View style={styles.userModeTabs}>
                {USER_AUTH_TABS.map((tab) => {
                  const mode = tab.toLowerCase() as UserAuthMode;
                  const isActive = userAuthMode === mode;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.userModeTab, isActive && styles.userModeTabActive]}
                      onPress={() => setUserAuthMode(mode)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.userModeTabText, isActive && styles.userModeTabTextActive]}>
                        {tab}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          <View style={styles.form}>
            {shouldShowCredentialFields && (
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
                  autoComplete="email"
                />
              </View>
            )}

            {isUserOtpMode && (
              <View style={styles.inlineAuthCard}>
                <Text style={styles.otpTitle}>Sign in with OTP</Text>
                <Text style={styles.otpSub}>{otpSubText}</Text>
                <View style={styles.phoneRow}>
                  <TextInput
                    style={[styles.input, styles.phoneInput]}
                    value={phoneNumber}
                    onChangeText={(value) => {
                      setPhoneNumber(value.replace(/\D/g, '').slice(0, 10));
                      if (otpSent || confirmation) {
                        setOtp('');
                        setOtpSent(false);
                        setConfirmation(null);
                      }
                    }}
                    placeholder="9876543210"
                    placeholderTextColor="#3F3F46"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    maxLength={10}
                  />
                  <TouchableOpacity
                    style={[styles.otpActionBtn, (sendingOtp || verifyingOtp || otpCountdown > 0) && { opacity: 0.7 }]}
                    onPress={handleSendOtp}
                    disabled={sendingOtp || verifyingOtp || otpCountdown > 0}
                    activeOpacity={0.9}
                  >
                    {sendingOtp ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={styles.otpActionBtnText}>
                        {otpSent ? (otpCountdown > 0 ? `RESEND ${otpCountdown}s` : 'RESEND') : 'SEND OTP'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {Platform.OS === 'android' && !ENABLE_TEST_PHONE_AUTH && (
                  <Text style={styles.otpHint}>
                    Browser-free Android OTP requires the app&apos;s release SHA-1 and SHA-256 in Firebase and a Play-distributed build.
                  </Text>
                )}
                {Platform.OS === 'android' && ENABLE_TEST_PHONE_AUTH && (
                  <Text style={styles.otpHint}>
                    Test phone auth is enabled for this build. Use a Firebase test number so OTP stays inside the app and does not open the browser challenge.
                  </Text>
                )}
                {otpSent && (
                  <View style={styles.field}>
                    <Text style={styles.label}>ENTER OTP</Text>
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      placeholderTextColor="#3F3F46"
                      keyboardType="number-pad"
                      autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                      textContentType="oneTimeCode"
                      maxLength={6}
                    />
                  </View>
                )}
              </View>
            )}

            {shouldShowCredentialFields && (
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

              <TouchableOpacity onPress={() => { void handleForgotPassword(); }} style={styles.forgotPwBtn}>
                <Text style={styles.forgotPwText}>Forgot Password?</Text>
              </TouchableOpacity>
              </View>
            )}

            {(!isUserOtpMode || otpSent) && (
              <TouchableOpacity
                style={[styles.primaryBtn, (isUserOtpMode ? verifyingOtp : loading) && { opacity: 0.7 }]}
                onPress={isUserOtpMode ? handleVerifyOtp : handleLogin}
                disabled={isUserOtpMode ? verifyingOtp : loading}
                activeOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel={isUserOtpMode ? 'VERIFY OTP' : 'SIGN IN'}
              >
                {isUserOtpMode ? (
                  verifyingOtp ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>VERIFY OTP</Text>
                      <ArrowRight size={18} color="#000" strokeWidth={2.5} />
                    </>
                  )
                ) : loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>SIGN IN</Text>
                    <ArrowRight size={18} color="#000" strokeWidth={2.5} />
                  </>
                )}
              </TouchableOpacity>
            )}

            {selectedRole === 'user' && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, googleLoading && { opacity: 0.6 }]}
                  onPress={handleGoogleLogin}
                  disabled={googleLoading}
                  activeOpacity={0.9}
                >
                  {googleLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Image
                        source="https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png"
                        style={styles.googleIcon}
                        contentFit="contain"
                      />
                      <Text style={styles.googleBtnText}>Continue with Google</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000' },
  scroll: { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 40 },
  header: { marginTop: 40, marginBottom: 40, alignItems: 'center' },
  branding: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoText: { color: '#FFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  hero: { marginBottom: 32 },
  heading: { color: '#FFF', fontSize: 34, fontWeight: '900', letterSpacing: -1.5 },
  subheading: { color: '#71717A', fontSize: 16, marginTop: 4 },
  roleContainer: { marginBottom: 32 },
  userModeContainer: { marginBottom: 28 },
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
  userModeTabs: {
    flexDirection: 'row',
    backgroundColor: '#050505',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#18181B',
    padding: 4,
    gap: 4,
  },
  userModeTab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  userModeTabActive: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  userModeTabText: { color: '#71717A', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  userModeTabTextActive: { color: '#FFF' },
  form: { gap: 20 },
  field: { gap: 8 },
  label: { color: '#3F3F46', fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  input: { backgroundColor: '#0A0A0A', borderRadius: 16, padding: 16, color: '#FFF', fontSize: 15, borderWidth: 1, borderColor: '#18181B' },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 16, borderWidth: 1, borderColor: '#18181B', overflow: 'hidden' },
  passwordInput: { flex: 1, padding: 16, color: '#FFF', fontSize: 15 },
  eyeBtn: { paddingHorizontal: 16 },
  forgotPwBtn: { alignSelf: 'flex-end', marginTop: 8, paddingVertical: 4 },
  forgotPwText: { color: '#A1A1AA', fontSize: 12, fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#FFF', borderRadius: 100, paddingVertical: 18, marginTop: 12 },
  primaryBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
  inlineAuthCard: { backgroundColor: '#0A0A0A', borderRadius: 24, borderWidth: 1, borderColor: '#18181B', padding: 16, gap: 12 },
  otpTitle: { color: '#FFF', fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  otpSub: { color: '#71717A', fontSize: 13, lineHeight: 18 },
  otpHint: { color: '#52525B', fontSize: 11, lineHeight: 16 },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phoneInput: { flex: 1 },
  otpActionBtn: { backgroundColor: '#FFF', borderRadius: 16, minWidth: 110, paddingHorizontal: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  otpActionBtnText: { color: '#000', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#18181B' },
  dividerText: { color: '#52525B', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0A0A0A', borderRadius: 100, paddingVertical: 18, borderWidth: 1, borderColor: '#18181B' },
  googleIcon: { width: 20, height: 20 },
  googleBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
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
