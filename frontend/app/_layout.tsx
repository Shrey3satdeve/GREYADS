import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';

function RootRedirect() {
  const { user, token, isLoading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;
    const first = segments[0] as string | undefined;
    const inAuth = first === '(auth)';
    const inAdmin = first === '(admin)';
    const inScanner = first === '(scanner)';
    const inTabs = first === '(tabs)';
    const inOnboarding = first === 'onboarding';

    if (!token) {
      if (!inAuth && !inOnboarding && first !== undefined) {
        router.replace('/onboarding');
      }
    } else {
      if (user?.role === 'admin' && !inAdmin) {
        router.replace('/(admin)/');
      } else if (user?.role === 'staff' && !inScanner) {
        router.replace('/(scanner)/');
      } else if (user?.role === 'user' && (inAuth || inOnboarding)) {
        router.replace('/(tabs)/');
      }
    }
  }, [token, user, isLoading, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#000' }}>
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
          <Stack.Screen name="ticket/[id]" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
