'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      setUser(data.user || null);
      return data.user || null;
    } catch (err) {
      console.error('[Auth] Failed to refresh user:', err);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const register = useCallback(
    async (data) => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, errors: result.errors || ['Registration failed'] };
        }
        setUser(result.user);
        toast({
          title: 'Welcome!',
          description: `Your account has been created, ${result.user.username}.`,
          variant: 'success',
        });
        return { success: true, user: result.user };
      } catch (err) {
        return { success: false, errors: ['Network error. Please try again.'] };
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const login = useCallback(
    async (data) => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) {
          return { success: false, errors: result.errors || ['Login failed'] };
        }
        setUser(result.user);
        toast({
          title: 'Welcome back!',
          description: `Logged in as ${result.user.username}.`,
          variant: 'success',
        });
        return { success: true, user: result.user };
      } catch (err) {
        return { success: false, errors: ['Network error. Please try again.'] };
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const logout = useCallback(
    async (redirectTo = '/') => {
      setLoading(true);
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
        toast({
          title: 'Logged out',
          variant: 'info',
        });
        if (redirectTo) {
          router.push(redirectTo);
        }
        return true;
      } catch (err) {
        return false;
      } finally {
        setLoading(false);
      }
    },
    [router, toast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export default AuthProvider;
