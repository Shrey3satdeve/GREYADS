import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LogBox } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import '@react-native-firebase/functions';
import messaging from '@react-native-firebase/messaging';
import { Linking, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useDialog } from '../components/AppDialog';

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const globalParams = useGlobalSearchParams<{ redirect?: string | string[] }>();
  const { showDialog, DialogComponent } = useDialog();

  const requestedRedirect = Array.isArray(globalParams.redirect)
    ? globalParams.redirect[0]
    : globalParams.redirect;

  const isSafeRedirectPath = (value?: string) =>
    Boolean(value && value.startsWith('/') && !value.startsWith('//'));

  useEffect(() => {
    // Keep the booking CTA tappable in emulator QA builds by hiding the LogBox banner.
    if (__DEV__) {
      LogBox.ignoreLogs(['Open debugger to view warnings.']);
    }
  }, []);

  useEffect(() => {
    console.log('[RootLayout] Routing Check:', { token: !!token, segments, isLoading });
    if (isLoading) return;
    
    const inAuth = segments.some(s => s === '(auth)' || s === 'login' || s === 'signup');
    const inAdmin = segments.some(s => s === '(admin)');
    const inScanner = segments.some(s => s === '(scanner)');
    const inTabs = segments.some(s => s === '(tabs)');
    const inOnboarding = segments.some(s => s === 'onboarding');
    const inRestrictedUserTab = segments.some(s => s === 'tickets' || s === 'notifications' || s === 'profile');
    const inPublicTabs = inTabs && !inRestrictedUserTab;
    const inPublicBrowse = inPublicTabs || segments.some(s => s === 'event');
    const inBooking = segments.some(s => s === 'book');
    const inProtectedArea = inAdmin || inScanner || inRestrictedUserTab || inBooking;

    if (!token) {
      if (inProtectedArea && !inAuth) {
        if (inBooking && segments[1]) {
          router.replace({
            pathname: '/(auth)/login',
            params: { redirect: `/book/${String(segments[1])}` },
          } as any);
        } else {
          router.replace('/(auth)/login');
        }
      } else if ((segments as any).length === 0 || ((segments as any).length === 1 && (segments[0] as any) === 'index')) {
        router.replace('/onboarding');
      }
    } else {
      const isAdmin = user?.role === 'admin';
      const isStaff = user?.role === 'staff';
      const isUser = user?.role === 'user';

      if (isAdmin && !inAdmin) {
        router.replace('/(admin)' as any);
      } else if (isStaff && !inScanner) {
        router.replace('/(scanner)' as any);
      } else if (isUser && inAuth && isSafeRedirectPath(requestedRedirect)) {
        router.replace(requestedRedirect as any);
      } else if (isUser && (inAuth || inOnboarding || inAdmin || inScanner)) {
        router.replace('/(tabs)' as any);
      } else if (isStaff && inAdmin) {
        // Strict guard: staff in admin section -> kick to scanner
        router.replace('/(scanner)' as any);
      } else if (isAdmin && inScanner) {
        // Admin in scanner section -> kick to admin
        router.replace('/(admin)' as any);
      }
    }
  }, [token, user, isLoading, segments, requestedRedirect]);

  useEffect(() => {
    // Handle foreground messages
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      showDialog({
        title: remoteMessage.notification?.title || 'New Notification',
        message: remoteMessage.notification?.body || 'You have a new update in GreyAdz.',
      });
    });

    return unsubscribe;
  }, [showDialog]);

  useEffect(() => {
    // Handle deep links from Razorpay Android SDK (greyadz-payment:///)
    // Razorpay triggers the app's scheme after payment; we intercept and redirect.
    const handleDeepLink = ({ url }: { url: string }) => {
      if (!url || !url.startsWith('greyadz-payment://')) return;
      try {
        const parsed = new URL(url);
        const txnId = parsed.searchParams.get('txn_id') ||
                      parsed.searchParams.get('razorpay_payment_id') ||
                      parsed.searchParams.get('razorpay_order_id');
        if (txnId) {
          router.replace(`/payment-result?txn_id=${txnId}` as any);
        } else {
          // bare greyadz-payment:/// with no payload → just go home
          router.replace('/(tabs)' as any);
        }
      } catch {
        router.replace('/(tabs)' as any);
      }
    };

    // Handle case where app was opened from background via the deep link
    Linking.getInitialURL().then(url => {
      if (url) handleDeepLink({ url });
    });

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [router]);

  return DialogComponent;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootRedirect />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#000' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(admin)" />
          <Stack.Screen name="(scanner)" />
          <Stack.Screen name="event/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen
            name="book/[id]"
            options={{
              animation: 'slide_from_bottom',
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            }}
          />
          <Stack.Screen
            name="payment-result"
            options={{
              animation: 'slide_from_bottom',
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            }}
          />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
