import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { auth, db } from '../utils/firebase';
import { onIdTokenChanged, signOut } from '@react-native-firebase/auth';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, onSnapshot, arrayUnion,
} from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

const STORAGE_TOKEN_KEY = 'greyads_token';
const STORAGE_USER_KEY  = 'greyads_user';

export type UserRole = 'user' | 'staff' | 'admin';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, user: AuthUser) => Promise<void>;
  updateUser: (data: Partial<Pick<AuthUser, 'name' | 'email' | 'phone' | 'avatar_url'>>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function resolveRole(rawRole: string | undefined): UserRole {
  if (rawRole === 'admin' || rawRole === 'superuser') return 'admin';
  if (rawRole === 'staff') return 'staff';
  return 'user';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastManualLoginRef = useRef<number>(0);
  const pendingLogoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenRef = useRef<string | null>(null);
  const userRef = useRef<AuthUser | null>(null);

  useEffect(() => {
    tokenRef.current = token;
    userRef.current = user;
  }, [token, user]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const entries = await AsyncStorage.multiGet([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
        const cachedToken = entries[0]?.[1] || null;
        const cachedUser = entries[1]?.[1] ? JSON.parse(entries[1][1]) as AuthUser : null;

        if (!isMounted) {
          return;
        }

        if (cachedToken) {
          setToken(cachedToken);
        }

        if (cachedUser) {
          setUser(cachedUser);
        }

        // Remove artificial startup delay and unblock routing as soon as cache is restored.
        setIsLoading(false);
      } catch (error) {
        console.warn('[AuthContext] Failed to restore cached session:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          if (pendingLogoutTimeoutRef.current) {
            clearTimeout(pendingLogoutTimeoutRef.current);
            pendingLogoutTimeoutRef.current = null;
          }

          const isEmailProvider = firebaseUser.providerData?.some(
            (p: any) => p.providerId === 'password',
          );

          if (isEmailProvider && !firebaseUser.emailVerified) {
            console.warn('[AuthContext] Email not verified - session refused.');
            await signOut(auth);
            await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
            if (isMounted) {
              setToken(null);
              setUser(null);
              setIsLoading(false);
            }
            return;
          }

          const freshToken = await firebaseUser.getIdToken();
          await AsyncStorage.setItem(STORAGE_TOKEN_KEY, freshToken);
          if (isMounted) {
            setToken(freshToken);
          }

          const userRef = doc(db, 'users', firebaseUser.uid);
          const snap = await getDoc(userRef);
          let userData: AuthUser;

          if (snap.exists()) {
            const data: any = snap.data();
            userData = {
              id: snap.id,
              name: data.name || firebaseUser.displayName || 'User',
              email: data.email || firebaseUser.email || '',
              role: resolveRole(data.role),
              avatar_url: data.avatar_url || firebaseUser.photoURL || undefined,
              phone: data.phone || firebaseUser.phoneNumber || undefined,
              createdAt: data.created_at?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            };

            if (firebaseUser.phoneNumber && !data.phone) {
              await updateDoc(userRef, {
                phone: firebaseUser.phoneNumber,
                ...(firebaseUser.email && !data.email ? { email: firebaseUser.email } : {}),
              });
            }
          } else {
            userData = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              phone: firebaseUser.phoneNumber || undefined,
              role: 'user',
              avatar_url: firebaseUser.photoURL || undefined,
              createdAt: new Date().toISOString(),
            };

            const toSave = Object.fromEntries(
              Object.entries(userData).filter(([, value]) => value !== undefined),
            );
            await setDoc(userRef, { ...toSave, created_at: serverTimestamp() });
          }

          await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
          if (isMounted) {
            setUser(userData);
          }

          try {
            const authStatus = await messaging().requestPermission();
            const enabled =
              authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
              authStatus === messaging.AuthorizationStatus.PROVISIONAL;

            if (enabled) {
              const fcmToken = await messaging().getToken();
              if (fcmToken) {
                await updateDoc(userRef, {
                  fcm_tokens: arrayUnion(fcmToken),
                  updated_at: serverTimestamp(),
                });
              }
            }
          } catch (pushErr) {
            console.warn('[AuthContext] Push registration failed (non-fatal):', pushErr);
          }
        } else {
          const timeSinceManualLogin = Date.now() - lastManualLoginRef.current;
          const hasCachedSession = Boolean(tokenRef.current || userRef.current);
          const isTransientState = timeSinceManualLogin < (hasCachedSession ? 20_000 : 5_000);

          if (!isTransientState && !pendingLogoutTimeoutRef.current) {
            pendingLogoutTimeoutRef.current = setTimeout(async () => {
              pendingLogoutTimeoutRef.current = null;

              if (auth.currentUser) {
                return;
              }

              console.log('[AuthContext] Firebase session expired - clearing stored credentials.');
              await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);

              if (isMounted) {
                setToken(null);
                setUser(null);
                setIsLoading(false);
              }
            }, 3_000);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Session setup error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (pendingLogoutTimeoutRef.current) {
        clearTimeout(pendingLogoutTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!token || !user?.id) return;

    const userRef = doc(db, 'users', user.id);
    const unsubscribe = onSnapshot(
      userRef,
      async (snap) => {
        if (!snap.exists()) return;
        const data: any = snap.data();

        if (data.is_revoked) {
          console.warn('[AuthContext] Account revoked server-side. Forcing logout.');
          await logout();
          return;
        }

        const updatedRole = resolveRole(data.role);
        if (updatedRole !== user.role || data.name !== user.name) {
          const freshUser: AuthUser = {
            ...user,
            role: updatedRole,
            name: data.name || user.name,
            avatar_url: data.avatar_url || user.avatar_url,
            phone: data.phone || user.phone,
          };
          setUser(freshUser);
          await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(freshUser));
        }
      },
      (error) => {
        console.error('[AuthContext] User snapshot error:', error);
      },
    );

    return () => unsubscribe();
  }, [token, user?.id, user?.role, user?.name, user?.avatar_url, user?.phone]);

  const login = async (newToken: string, newUser: AuthUser) => {
    lastManualLoginRef.current = Date.now();
    if (pendingLogoutTimeoutRef.current) {
      clearTimeout(pendingLogoutTimeoutRef.current);
      pendingLogoutTimeoutRef.current = null;
    }
    await AsyncStorage.setItem(STORAGE_TOKEN_KEY, newToken);
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setIsLoading(false);
  };

  const updateUser = async (data: Partial<Pick<AuthUser, 'name' | 'email' | 'phone' | 'avatar_url'>>) => {
    if (!user || !token) return;

    const safeData: Record<string, any> = {};
    if (data.name !== undefined) safeData.name = data.name;
    if (data.email !== undefined) safeData.email = data.email;
    if (data.phone !== undefined) safeData.phone = data.phone;
    if (data.avatar_url !== undefined) safeData.avatar_url = data.avatar_url;

    const res = await api.patch('/auth/me', safeData);
    const nextUser: AuthUser = { ...user, ...res.user, role: resolveRole(res.user?.role) };
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      try {
        await GoogleSignin.signOut();
      } catch {
        // already signed out
      }
      await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
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
};
