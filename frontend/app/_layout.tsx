import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
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
      if (!inAuth && !inOnboarding && !inPublicBrowse && segments.length > 0) {
        router.replace('/onboarding');
      }
    } else {
      if (user?.role === 'admin' && !inAdmin) {
        router.replace('/(admin)' as any);
      } else if (user?.role === 'staff' && !inScanner) {
        router.replace('/(scanner)' as any);
      } else if (user?.role === 'user' && (inAuth || inOnboarding || inAdmin || inScanner)) {
        router.replace('/(tabs)' as any);
      }
    }
  }, [token, user, isLoading, segments]);

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
