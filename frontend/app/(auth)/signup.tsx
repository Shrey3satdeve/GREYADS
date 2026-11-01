import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, ArrowLeft, ArrowRight } from 'lucide-react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import BrandMark from '../../components/BrandMark';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';
import { COLORS, RADIUS, SPACING } from '../../constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDialog } from '../../components/AppDialog';
import rnfbAuth from '@react-native-firebase/auth';
import { configureGoogleSignin, getGoogleIdToken, getGoogleSignInErrorMessage } from '../../utils/googleSignIn';

configureGoogleSignin();

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const { showDialog, DialogComponent } = useDialog();

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { cancelled, idToken } = await getGoogleIdToken();
      if (cancelled) {
        return;
      }

      const credential = rnfbAuth.GoogleAuthProvider.credential(idToken);
      const userCreds = await rnfbAuth().signInWithCredential(credential);
      const fbIdToken = await userCreds.user.getIdToken(true);
      const data = await api.post('/auth/google', { role: 'user' }, false);
      const authUser = data?.user || {
        id: userCreds.user.uid,
        name: userCreds.user.displayName || 'User',
        email: userCreds.user.email || '',
        role: 'user',
        avatar_url: userCreds.user.photoURL || undefined,
        phone: userCreds.user.phoneNumber || undefined,
      };

      await AsyncStorage.setItem('greyads_token', data?.token || fbIdToken);

      await login(data?.token || fbIdToken, authUser);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.log('Google Sign-In Error:', err);
      const message = getGoogleSignInErrorMessage(err);
      if (message) {
        showDialog({ title: 'Google Sign-In Failed', message });
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      showDialog({ title: 'Missing Fields', message: 'Please fill in all required fields.' });
      return;
    }

    // --- Password strength validation ---
    if (password.length < 8) {
      showDialog({ title: 'Weak Password', message: 'Password must be at least 8 characters long.' });
      return;
    }
    if (!/[A-Z]/.test(password)) {
      showDialog({ title: 'Weak Password', message: 'Password must contain at least one uppercase letter.' });
      return;
    }
    if (!/[0-9]/.test(password)) {
      showDialog({ title: 'Weak Password', message: 'Password must contain at least one number.' });
      return;
    }

    setLoading(true);
    try {
      const userCreds = await rnfbAuth().createUserWithEmailAndPassword(
        email.trim().toLowerCase(),
        password
      );
      await userCreds.user.updateProfile({ displayName: name.trim() });

      // Send email verification — user cannot log in until verified
      await userCreds.user.sendEmailVerification();

      // Provision the Firestore user document with safe fields only.
      // Role is always 'user' for self-signup — never trust client-supplied role.
      const payload: any = { name: name.trim(), role: 'user' };
      if (phone.trim()) payload.phone = phone.trim();
      await api.patch('/auth/me', payload);

      // Sign out immediately — account must be verified before first login.
      await rnfbAuth().signOut();

      showDialog({
        title: 'Verify Your Email',
        message: `A verification link has been sent to ${email.trim().toLowerCase()}. Please check your inbox and verify your email before logging in.`,
        buttons: [{ label: 'Go to Login', style: 'default', onPress: () => router.replace('/(auth)/login' as any) }],
      });
    } catch (err: any) {
      console.error('[Signup]', err.code, err.message);
      let errorMsg = 'Something went wrong. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'An account with this email already exists.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'The password is too weak. Use at least 8 characters.';
      } else if (err.code === 'auth/invalid-email') {
        errorMsg = 'Please enter a valid email address.';
      }
      showDialog({ title: 'Signup Failed', message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {DialogComponent}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft size={20} color={COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={{ flex: 1, alignItems: 'center', marginRight: 40 }}>
              <Image 
                source={require('../../assets/images/greyadz-logo-v3.png')}
                style={{ width: 140, height: 140, marginTop: -10 }}
                contentFit="contain"
              />
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
            placeholder="e.g. Rahul Sharma"
            placeholderTextColor={COLORS.textTertiary}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email *</Text>
          <TextInput
            testID="signup-email-input"
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="e.g. rahul@example.com"
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
            placeholder="e.g. 9876543210"
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
              placeholder="Enter a strong password"
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

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

            <TouchableOpacity
              style={[styles.googleBtn, googleLoading && { opacity: 0.4 }]}
              onPress={handleGoogleSignIn}
              disabled={googleLoading}
              activeOpacity={0.85}
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

          <TouchableOpacity testID="go-to-login-btn" onPress={() => router.replace('/(auth)/login' as any)} style={styles.linkRow}>
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  googleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: COLORS.bgCard, borderRadius: RADIUS.full, paddingVertical: 17, borderWidth: 1, borderColor: COLORS.border },
  googleIcon: { width: 22, height: 22 },
  googleBtnText: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
});
