import { Link, Stack, useRouter, usePathname, useGlobalSearchParams } from 'expo-router';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const path = usePathname();
  const params = useGlobalSearchParams();
  const { user, token, isLoading } = useAuth();

  useEffect(() => {
    console.log('[NotFound] Caught Unmatched Route:', { path, params, token: !!token, role: user?.role });
    
    // Automatically redirect back based on user role
    const timer = setTimeout(() => {
      if (isLoading) return;
      handleGlobalRedirect();
    }, 2000);
    return () => clearTimeout(timer);
  }, [path, params, token, user, isLoading]);

  const handleGlobalRedirect = () => {
    console.log('[NotFound] Manual Redirect Triggered');
    if (!token) {
      router.replace('/onboarding');
    } else if (user?.role === 'admin') {
      router.replace('/(admin)');
    } else if (user?.role === 'staff') {
      router.replace('/(scanner)');
    } else {
      // Explicitly target the discover tab
      router.replace('/(tabs)');
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.message}>We couldn't find the page you were looking for.</Text>
        
        <TouchableOpacity 
          style={styles.link} 
          onPress={() => {
            console.log('[NotFound] Button Pressed');
            handleGlobalRedirect();
          }}
        >
          <Text style={styles.linkText}>Go back to safety</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 30,
  },
  link: {
    paddingVertical: 15,
    paddingHorizontal: 30,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  linkText: {
    fontSize: 16,
    color: '#000',
    fontWeight: 'bold',
  },
});
