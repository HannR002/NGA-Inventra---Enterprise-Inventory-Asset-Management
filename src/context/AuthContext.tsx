import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, RoleType } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  role: RoleType;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  switchRole: (newRole: RoleType) => Promise<void>;
  logout: () => void;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<RoleType>(() => {
    return (localStorage.getItem('inventra_role') as RoleType) || 'SUPER_ADMIN';
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.getMe();
      setUser(res.user);
      setRole(res.user.role);
    } catch {
      // If unauthenticated, bootstrap default demo role
      try {
        const switchRes = await api.switchRole(role);
        setUser(switchRes.user);
        setRole(switchRes.user.role);
      } catch (e) {
        console.warn('Auth initialization fallback:', e);
      }
    } finally {
      setIsLoading(false);
    }
  }, [role]);

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, password);
      setUser(res.user);
      setRole(res.user.role);
    } finally {
      setIsLoading(false);
    }
  };

  const switchRole = async (newRole: RoleType) => {
    setIsLoading(true);
    try {
      const res = await api.switchRole(newRole);
      setUser(res.user);
      setRole(res.user.role);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const can = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN') return true;
    return Boolean(user.permissions && user.permissions.includes(permission));
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      switchRole,
      logout,
      can
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
