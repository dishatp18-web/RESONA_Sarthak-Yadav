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
  switchRole: (role: 'customer' | 'worker' | 'admin') => void;
  selectUser: (userId: string) => void;
  refreshUsers: () => Promise<void>;
  resetDatabase: () => Promise<void>;
  toggleHideDemoControls: () => void;
}

const DemoUserContext = createContext<DemoUserContextType | undefined>(undefined);

export const DemoUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentRole, setCurrentRole] = useState<'customer' | 'worker' | 'admin'>('customer');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data: User[] = await res.json();
      setUsers(data);

      // Keep current user or pick first matching current role
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
    }
  };

  const resetDatabase = async () => {
    setLoading(true);
    try {
      await fetch('/api/reset', { method: 'POST' }).catch(() => {});
      // In case /api/reset is mapped or we trigger re-seed
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
        switchRole,
        selectUser,
        refreshUsers: fetchUsers,
        resetDatabase,
        toggleHideDemoControls,
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
