import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getFreshAccessToken } from '../services/supabase';
import { LocalStorage } from '../storage/localStorage';

export interface UserProfile {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  role?: string | null;
  address?: string | null;
  city_id?: string | null;
  zone_id?: string | null;
  onboarding_completed?: boolean;
  kyc_status?: 'pending' | 'verified' | 'rejected' | 'none';
  wallet_balance?: number;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  roles: string[];
  activeRole: string | null;
  setActiveRole: (role: string | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  roles: [],
  activeRole: null,
  setActiveRole: () => {},
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  getToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [activeRole, setActiveRoleState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchLock = useRef<string | null>(null);

  const setActiveRole = async (role: string | null) => {
    setActiveRoleState(role);
    if (role) {
      await LocalStorage.setItem('linkup_active_role', role);
    } else {
      await LocalStorage.removeItem('linkup_active_role');
    }
  };

  const fetchProfileAndRoles = async (userId: string) => {
    if (fetchLock.current === userId) return;
    fetchLock.current = userId;

    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data as UserProfile);
      }

      if (rolesRes.data) {
        const fetchedRoles = rolesRes.data.map((r: { role: string }) => r.role);
        const resolvedRoles = fetchedRoles.includes('buyer') ? fetchedRoles : ['buyer', ...fetchedRoles];
        setRoles(resolvedRoles);

        const savedRole = await LocalStorage.getItem<string>('linkup_active_role');
        if (savedRole && resolvedRoles.includes(savedRole)) {
          setActiveRoleState(savedRole);
        } else {
          setActiveRoleState(resolvedRoles[0] || 'buyer');
        }
      }
    } catch (err) {
      console.error('[AuthContext] Failed to load profile & roles:', err);
    } finally {
      fetchLock.current = null;
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfileAndRoles(user.id);
    }
  };

  useEffect(() => {
    // 1. Initial session retrieval
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user?.id) {
        fetchProfileAndRoles(initialSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Real-time auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user?.id) {
        await fetchProfileAndRoles(currentSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setActiveRoleState(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      await LocalStorage.removeItem('linkup_active_role');
      setProfile(null);
      setRoles([]);
      setActiveRoleState(null);
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        roles,
        activeRole,
        setActiveRole,
        loading,
        signOut,
        refreshProfile,
        getToken: getFreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
