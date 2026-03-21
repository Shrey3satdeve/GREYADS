import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { auth, db } from '../utils/firebase';
import { onIdTokenChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const STORAGE_TOKEN_KEY = 'greyads_token';
const STORAGE_USER_KEY = 'greyads_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'staff' | 'admin';
  avatar_url?: string;
  phone?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  updateUser: (data: Partial<AuthUser>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Safety timeout to prevent splash screen hang
    const timer = setTimeout(() => {
      if (isLoading) setIsLoading(false);
    }, 6000);

    // Listen to Firebase Auth token changes
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const freshToken = await firebaseUser.getIdToken();
          await AsyncStorage.setItem(STORAGE_TOKEN_KEY, freshToken);
          setToken(freshToken);

          // Fetch or Create user profile in Firestore
          const userRef = doc(db, "users", firebaseUser.uid);
          const snap = await getDoc(userRef);

          let userData: AuthUser;

          if (snap.exists()) {
            const data = snap.data();
            const isDemoAdmin = data.email === 'admin@greyads.com';
            const isDemoStaff = data.email === 'staff@greyads.com';
            const realRole = isDemoAdmin ? 'admin' : (isDemoStaff ? 'staff' : (data.role || 'user'));

            userData = {
              id: snap.id,
              name: data.name,
              email: data.email,
              role: realRole,
              avatar_url: data.avatar_url,
              phone: data.phone,
              createdAt: data.created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
            };
          } else {
            // New user (provision in Firestore)
            const pendingRole = await AsyncStorage.getItem('pending_role');
            
            userData = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              role: (pendingRole as any) || 'user',
              avatar_url: firebaseUser.photoURL || undefined,
              createdAt: new Date().toISOString(),
            };
            await setDoc(userRef, {
              ...userData,
              created_at: serverTimestamp(),
            });
            await AsyncStorage.removeItem('pending_role');
          }

          await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
          setUser(userData);
        } else {
          await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
          await AsyncStorage.removeItem(STORAGE_USER_KEY);
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        console.error('Session error with Firebase:', error);
        setToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const login = async (newToken: string, newUser: AuthUser) => {
    await AsyncStorage.setItem(STORAGE_TOKEN_KEY, newToken);
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const updateUser = async (data: Partial<AuthUser>) => {
    if (!user || !token) return;
    const res = await api.patch('/auth/me', data);
    const nextUser = { ...user, ...res.user };
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        // May already be signed out
      }
      await AsyncStorage.removeItem(STORAGE_TOKEN_KEY);
      await AsyncStorage.removeItem(STORAGE_USER_KEY);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
