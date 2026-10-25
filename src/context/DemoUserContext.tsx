/**
 * FairFix Demo User Context
 * Provides instantaneous role & seeded user switching for live demonstrations.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types.js';

interface DemoUserContextType {
  users: User[];
  currentUser: User | null;
  currentRole: 'customer' | 'worker' | 'admin';
  loading: boolean;
  hideDemoControls: boolean;
  isAuthenticated: boolean;
  switchRole: (role: 'customer' | 'worker' | 'admin') => void;
  selectUser: (userId: string) => void;
  refreshUsers: () => Promise<void>;
  resetDatabase: () => Promise<void>;
  toggleHideDemoControls: () => void;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  registerAccount: (payload: { name: string; email: string; password: string; phone?: string; role?: 'customer' | 'worker'; categories?: string[]; lat?: number; lng?: number; base_rate?: number; radius_km?: number; }) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
}

const DemoUserContext = createContext<DemoUserContextType | undefined>(undefined);

export const DemoUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<'customer' | 'worker' | 'admin'>('customer');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(localStorage.getItem('fairfix_session_token'));
  });
  const [hideDemoControls, setHideDemoControls] = useState<boolean>(() => {
    return localStorage.getItem('fairfix_hide_demo_controls') === 'true';
  });

  const toggleHideDemoControls = () => {
    setHideDemoControls((prev) => {
      const next = !prev;
      localStorage.setItem('fairfix_hide_demo_controls', String(next));
      return next;
    });
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('fairfix_session_token');
      if (token) {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setCurrentUser(data.user as User);
            setCurrentRole(data.user.role);
            setIsAuthenticated(true);
            setLoading(false);
            return;
          }
        }
        localStorage.removeItem('fairfix_session_token');
        setIsAuthenticated(false);
      }

      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data: User[] = await res.json();
      setUsers(data);

      if (currentUser) {
        const updated = data.find((u) => u.id === currentUser.id);
        if (updated) {
          setCurrentUser(updated);
          return;
        }
      }

      const defaultUser = data.find((u) => u.role === currentRole) || data[0] || null;
      setCurrentUser(defaultUser);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const switchRole = (role: 'customer' | 'worker' | 'admin') => {
    setCurrentRole(role);
    const candidate = users.find((u) => u.role === role);
    if (candidate) {
      setCurrentUser(candidate);
    }
  };

  const selectUser = (userId: string) => {
    const selected = users.find((u) => u.id === userId);
    if (selected) {
      setCurrentUser(selected);
      setCurrentRole(selected.role);
      setIsAuthenticated(false);
      localStorage.removeItem('fairfix_session_token');
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.token || !data?.user) {
        return { ok: false, message: data?.error || 'Login failed.' };
      }
      localStorage.setItem('fairfix_session_token', data.token);
      setCurrentUser(data.user as User);
      setCurrentRole(data.user.role);
      setIsAuthenticated(true);
      await fetchUsers();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message || 'Login failed.' };
    }
  };

  const registerAccount = async (payload: { name: string; email: string; password: string; phone?: string; role?: 'customer' | 'worker'; categories?: string[]; lat?: number; lng?: number; base_rate?: number; radius_km?: number; }) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data?.token || !data?.user) {
        return { ok: false, message: data?.error || 'Registration failed.' };
      }
      localStorage.setItem('fairfix_session_token', data.token);
      setCurrentUser(data.user as User);
      setCurrentRole(data.user.role);
      setIsAuthenticated(true);
      await fetchUsers();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: (err as Error).message || 'Registration failed.' };
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('fairfix_session_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token },
        }).catch(() => undefined);
      }
    } finally {
      localStorage.removeItem('fairfix_session_token');
      setIsAuthenticated(false);
      const fallback = users.find((u) => u.role === 'customer') || users[0] || null;
      setCurrentUser(fallback);
      setCurrentRole('customer');
    }
  };

  const resetDatabase = async () => {
    setLoading(true);
    try {
      await fetch('/api/reset', { method: 'POST' }).catch(() => {});
      await fetchUsers();
    } finally {
      setLoading(false);
    }
  };

  return (
    <DemoUserContext.Provider
      value={{
        users,
        currentUser,
        currentRole,
        loading,
        hideDemoControls,
        isAuthenticated,
        switchRole,
        selectUser,
        refreshUsers: fetchUsers,
        resetDatabase,
        toggleHideDemoControls,
        loginWithEmail,
        registerAccount,
        logout,
      }}
    >
      {children}
    </DemoUserContext.Provider>
  );
};

export function useDemoUser() {
  const context = useContext(DemoUserContext);
  if (!context) {
    throw new Error('useDemoUser must be used within a DemoUserProvider');
  }
  return context;
}
