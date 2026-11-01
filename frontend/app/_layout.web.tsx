import 'react-native-gesture-handler';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../context/AuthContext';

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments.some((segment) => segment === '(auth)' || segment === 'login' || segment === 'signup');
    const inAdmin = segments.some((segment) => segment === '(admin)');
    const inScanner = segments.some((segment) => segment === '(scanner)');
    const inRestrictedUserTab = segments.some((segment) =>
      segment === 'tickets' || segment === 'notifications' || segment === 'profile'
    );

    if (!token) {
      if (inAdmin || inScanner || inRestrictedUserTab) {
        router.replace('/login');
      }
      return;
    }

    const isAdmin = user?.role === 'admin';
    const isStaff = user?.role === 'staff';
    const isUser = user?.role === 'user';

    if (isAdmin && !inAdmin) {
      router.replace('/(admin)' as any);
    } else if (isStaff && !inScanner) {
      router.replace('/(scanner)' as any);
    } else if (isUser && !inAuth && (inAdmin || inScanner)) {
      router.replace('/(tabs)' as any);
    }
  }, [isLoading, router, segments, token, user?.role]);

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
