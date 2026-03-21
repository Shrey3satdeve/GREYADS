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
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
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
const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '420509611534-7km6iakrkkte4e43ht6pktr3uc1au1vh.apps.googleusercontent.com';

const FIREBASE_CONFIG = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCsfJkq8iPKiRMPxDUCKaQA1cpc6BCxoNo',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'greyadz-ff727.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'greyadz-ff727',
};

type RoleType = 'user' | 'staff' | 'admin';

const DEMO_CREDENTIALS: Record<Exclude<RoleType, 'user'>, { email: string; password: string }> = {
  admin: { email: 'admin@greyads.com', password: 'Admin@123' },
  staff: { email: 'staff@greyads.com', password: 'Staff@123' },
};

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleType>('user');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [recaptchaVisible, setRecaptchaVisible] = useState(false);
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

      const credential = GoogleAuthProvider.credential(idToken);
      const userCreds = await signInWithCredential(auth, credential);
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

  const handleSendOTP = async () => {
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone) {
      showDialog({ title: 'Missing Field', message: 'Please enter your phone number.' });
      return;
    }
    
    // Clean any non-digit chars
    const cleaned = formattedPhone.replace(/\D/g, '');
    
    // We already have +91 in the UI label, so we keep the state as 10 digits.
    // The prefixing for Firebase will happen inside the WebView now.

    if (cleaned.length !== 10) {
       showDialog({ title: 'Invalid Format', message: 'Please enter a 10-digit number.' });
       return;
    }

    await AsyncStorage.setItem('pending_role', selectedRole);
    setRecaptchaVisible(true);
  };


  const onRecaptchaVerify = async (data: string) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === 'VERIFICATION_ID') {
        setRecaptchaVisible(false);
        setVerificationId(msg.id);
        showDialog({ title: 'OTP Sent ✅', message: 'Please check your messages for the verification code.' });
      } else if (msg.type === 'AUTH_SUCCESS') {
        const { idToken } = msg;
        const res: any = await api.post('/auth/login', { access_token: idToken, role: selectedRole });
        await login(idToken, res.user);
        
        if (res.user.role === 'admin') router.replace('/(admin)');
        else if (res.user.role === 'staff') router.replace('/(scanner)');
        else router.replace('/(tabs)');
      } else if (msg.type === 'DEBUG') {
        console.log('[WebView Auth Debug]:', msg.msg);
      } else if (msg.type === 'ERROR') {
        throw new Error(msg.error);
      }
    } catch (err: any) {
      setRecaptchaVisible(false);
      showDialog({ title: 'Error', message: err.message || 'Verification failed' });
    } finally {
      setLoading(false);
    }
  };

  const webViewRef = useRef<WebView>(null);

  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      showDialog({ title: 'Missing Field', message: 'Please enter the OTP.' });
      return;
    }
    setLoading(true);
    // Send the OTP to the WebView to confirm
    webViewRef.current?.postMessage(JSON.stringify({ type: 'CONFIRM_OTP', otp }));
  };




  const horizontalPadding = 32;
  const pillPadding = 8;
  const availableWidth = width - (horizontalPadding * 2) - pillPadding;
  const buttonWidth = availableWidth / 3;

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

  const fillDemoCredentials = (role: Exclude<RoleType, 'user'>) => {
    const creds = DEMO_CREDENTIALS[role];
    setSelectedRole(role);
    setEmail(creds.email);
    setPassword(creds.password);
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      showDialog({ title: 'Email Required', message: 'Please enter your email address to reset your password.' });
      return;
    }

    showDialog({
      title: 'Password Reset',
      message: selectedRole === 'staff'
        ? 'Please contact your administrator to reset your temporary password.'
        : 'Password reset email delivery is not configured yet.',
    });
  };



  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showDialog({ title: 'Missing Fields', message: 'Please enter your email and password.' });
      return;
    }

    setLoading(true);
    try {
      // Store the desired role so AuthContext can provision it correctly
      await AsyncStorage.setItem('pending_role', selectedRole);
      
      // Sign in to Firebase first
      const userCreds = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const fbIdToken = await userCreds.user.getIdToken(true);

      const data: any = await api.post(
        '/auth/login',
        {
          email: email.trim().toLowerCase(),
          password,
          role: selectedRole,
        }
      );


      await login(data.token, data.user);

      if (data.user.role === 'admin') {
        router.replace('/(admin)');
      } else if (data.user.role === 'staff') {
        router.replace('/(scanner)');
      } else {
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        showDialog({ title: 'Login Failed', message: 'Invalid email or password.\n\nAdmins: Please create admin@greyads.com in the Firebase Console.' });
      } else {
        showDialog({ title: 'Login Failed', message: err.message || 'Invalid credentials' });
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
                {!verificationId ? (
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
                      onPress={handleSendOTP}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>SEND OTP</Text>}
                    </TouchableOpacity>
                  </View>

                ) : (
                  <View style={styles.field}>
                    <Text style={styles.label}>ENTER OTP</Text>
                    <TextInput
                      style={styles.input}
                      value={otp}
                      onChangeText={setOtp}
                      placeholder="6-digit code"
                      placeholderTextColor="#3F3F46"
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
                      onPress={handleVerifyOTP}
                      disabled={loading}
                    >
                      {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryBtnText}>VERIFY OTP</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setVerificationId(null)} style={{ marginTop: 10 }}>
                      <Text style={{ color: '#71717A', textAlign: 'center', fontSize: 13 }}>Resend to a different number?</Text>
                    </TouchableOpacity>
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

      {recaptchaVisible && (
        <View style={{ height: 1, width: 1, opacity: 0.01, position: 'absolute', top: -100, left: -100 }}>
          <WebView
            ref={webViewRef}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={['*']}
            mixedContentMode="always"
            thirdPartyCookiesEnabled={true}
            sharedCookiesEnabled={true}
            allowFileAccessFromFileURLs={true}
            allowUniversalAccessFromFileURLs={true}
            source={{
                html: `
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js"></script>
                    <script src="https://www.gstatic.com/firebasejs/10.8.0/firebase-auth-compat.js"></script>
                  </head>
                  <body style="margin: 0; background-color: transparent;">
                    <div id="recaptcha-container" style="display: flex; justify-content: center; align-items: center; height: 100vh;"></div>
                    
                    <script>
                      const firebaseConfig = {
                        apiKey: "${FIREBASE_CONFIG.apiKey}",
                        authDomain: "${FIREBASE_CONFIG.authDomain}",
                        projectId: "${FIREBASE_CONFIG.projectId}",
                        appId: "${process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:420509611534:android:1f2b139e20cf4db77bee5f'}",
                      };
                      firebase.initializeApp(firebaseConfig);
                      
                      let confirmationResult;

                      window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                        'size': 'invisible'
                      });

                      const rawPhone = "${phoneNumber}".replace(/\s/g, '');
                      const formattedPhone = (rawPhone.startsWith('+') ? rawPhone : '+91' + rawPhone);

                      window.recaptchaVerifier.render().then(() => {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ 
                          type: 'DEBUG', 
                          msg: 'Verifier rendered. Sending OTP to +91' + rawPhone
                        }));
                        firebase.auth().signInWithPhoneNumber(formattedPhone, window.recaptchaVerifier)
                          .then((result) => {
                            confirmationResult = result;
                            window.ReactNativeWebView.postMessage(JSON.stringify({ 
                              type: 'VERIFICATION_ID', 
                              id: result.verificationId 
                            }));
                          }).catch((error) => {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ 
                              type: 'ERROR', 
                              error: error.message + ' (Host: ' + window.location.hostname + ')'
                            }));
                          });
                      }).catch(err => {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ 
                          type: 'ERROR', 
                          error: 'Recaptcha failed: ' + err.message 
                        }));
                      });

                      window.addEventListener('message', (event) => {
                        try {
                          const msg = JSON.parse(event.data);
                          if (msg.type === 'CONFIRM_OTP') {
                            confirmationResult.confirm(msg.otp)
                              .then((result) => {
                                result.user.getIdToken().then(idToken => {
                                  window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                    type: 'AUTH_SUCCESS', 
                                    idToken 
                                  }));
                                });
                              }).catch((error) => {
                                window.ReactNativeWebView.postMessage(JSON.stringify({ 
                                  type: 'ERROR', 
                                  error: error.message 
                                }));
                              });
                          }
                        } catch (e) {}
                      });
                    </script>
                  </body>
                </html>
                `,
                baseUrl: `https://${FIREBASE_CONFIG.authDomain}`
              }}
              onMessage={(event) => onRecaptchaVerify(event.nativeEvent.data)}
            />
        </View>
      )}
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
});

