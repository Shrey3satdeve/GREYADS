import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_TOKEN_KEY = 'greyads_token';
const STORAGE_USER_KEY = 'greyads_user';

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
  updateUser: (data: Partial<Pick<AuthUser, 'name' | 'phone' | 'avatar_url'>>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [storedToken, storedUser] = await AsyncStorage.multiGet([
          STORAGE_TOKEN_KEY,
          STORAGE_USER_KEY,
        ]);
        const tokenValue = storedToken?.[1] || null;
        const rawUser = storedUser?.[1];
        const parsedUser = rawUser ? JSON.parse(rawUser) : null;

        if (!mounted) return;
        setToken(tokenValue);
        setUser(parsedUser);
      } catch (error) {
        console.error('[AuthContext.web] Bootstrap failed:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (nextToken: string, nextUser: AuthUser) => {
    await AsyncStorage.setItem(STORAGE_TOKEN_KEY, nextToken);
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
    setIsLoading(false);
  };

  const updateUser = async (data: Partial<Pick<AuthUser, 'name' | 'phone' | 'avatar_url'>>) => {
    if (!user) return;
    const nextUser = { ...user, ...data };
    await AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([STORAGE_TOKEN_KEY, STORAGE_USER_KEY]);
    setToken(null);
    setUser(null);
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
