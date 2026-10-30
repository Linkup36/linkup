import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { Linking } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getFreshAccessToken, handleAuthDeepLink } from '../services/supabase';
import { LocalStorage } from '../storage/localStorage';
import { navigateSafely } from '../navigation/navigationRef';

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
  setActiveRole: () => { },
  loading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
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
      let [profileRes, rolesRes, sellerVerifRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${userId},user_id.eq.${userId}`)
          .limit(1)
          .maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', userId),
        supabase
          .from('seller_verifications')
          .select('status')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Self-healing: If user is authenticated but profile row is missing in public.profiles
      if (!profileRes.data) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const authUser = userRes?.user;
          const metaName =
            authUser?.user_metadata?.display_name ||
            authUser?.user_metadata?.full_name ||
            (authUser?.email ? authUser.email.split('@')[0] : 'Linkup Member');
          const metaPhone = authUser?.user_metadata?.phone || null;

          const { data: createdProfile } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              display_name: metaName,
              phone: metaPhone,
              onboarding_completed: true,
            })
            .select('*')
            .maybeSingle();

          if (createdProfile) {
            profileRes = { data: createdProfile, error: null } as any;
          }

          // Ensure wallet exists
          await supabase.from('wallets').upsert({
            user_id: userId,
            balance: 0,
          });
        } catch (repairErr) {
          console.warn('[AuthContext] Profile repair attempt:', repairErr);
        }
      }

      if (profileRes.data) {
        setProfile(profileRes.data as UserProfile);
      }

      let fetchedRoles = (rolesRes.data || []).map((r: { role: string }) => r.role);

      // Self-healing: If user_roles has no roles yet, check user_metadata for role assigned at registration
      if (fetchedRoles.length === 0) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const assignedRole = userRes?.user?.user_metadata?.role;
          if (assignedRole && ['seller', 'logistics', 'promoter'].includes(assignedRole)) {
            await supabase.rpc('manage_user_roles', {
              p_user_id: userId,
              p_roles: [assignedRole, 'buyer'],
            });
            fetchedRoles = [assignedRole, 'buyer'];
          }
        } catch (roleRepairErr) {
          console.warn('[AuthContext] Role repair attempt:', roleRepairErr);
        }
      }

      if (profileRes.data?.role && !fetchedRoles.includes(profileRes.data.role)) {
        fetchedRoles.push(profileRes.data.role);
      }
      if (sellerVerifRes.data?.status === 'verified' && !fetchedRoles.includes('seller')) {
        fetchedRoles.push('seller');
      }

      const resolvedRoles = Array.from(new Set(['buyer', ...fetchedRoles]));
      setRoles(resolvedRoles);

      const savedRole = await LocalStorage.getItem<string>('linkup_active_role');
      if (savedRole && resolvedRoles.includes(savedRole)) {
        setActiveRoleState(savedRole);
      } else if (fetchedRoles.includes('seller')) {
        setActiveRoleState('seller');
      } else {
        setActiveRoleState(fetchedRoles[0] || 'buyer');
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

      if (_event === 'PASSWORD_RECOVERY') {
        navigateSafely('ResetPassword');
      }

      if (currentSession?.user?.id) {
        await fetchProfileAndRoles(currentSession.user.id);
      } else {
        setProfile(null);
        setRoles([]);
        setActiveRoleState(null);
      }
      setLoading(false);
    });

    // 3. Listen to incoming deep links (e.g. email verification link taps)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthDeepLink(url);
    });

    const urlListener = Linking.addEventListener('url', (event) => {
      if (event.url) handleAuthDeepLink(event.url);
    });

    return () => {
      subscription.unsubscribe();
      urlListener.remove();
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
