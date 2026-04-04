import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import '@react-native-firebase/functions';
import messaging from '@react-native-firebase/messaging';
import { Linking, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

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

    if (!token) {
      if ((segments as any).length === 0 || ((segments as any).length === 1 && (segments[0] as any) === 'index')) {
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
  }, [token, user, isLoading, segments]);

  useEffect(() => {
    // Handle foreground messages
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      Alert.alert(
        remoteMessage.notification?.title || 'New Notification',
        remoteMessage.notification?.body || 'You have a new update in GreyAdz.'
      );
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Handle deep links from Razorpay Android SDK (greyadz-payment:///)
    // Razorpay triggers the app's scheme after payment; we intercept and redirect.
    const handleDeepLink = ({ url }: { url: string }) => {
      if (!url || !url.startsWith('greyadz-payment://')) return;
      try {
        const parsed = new URL(url);
        const txnId = parsed.searchParams.get('txn_id') ||
                      parsed.searchParams.get('razorpay_payment_id');
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

  return null;
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
            <Stack.Screen name="book/[id]" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="payment-result" options={{ animation: 'slide_from_bottom' }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
