import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../services/supabase';
import { useAuth } from '../../../context/AuthContext';
import { toast } from '../../../components/ui';
import * as Haptics from 'expo-haptics';

export interface PromoterStats {
  totalRevenue: number;
  availableBalance: number;
  escrowBalance: number;
  totalConversions: number;
  totalClicks: number;
}

export interface CommissionItem {
  id: string;
  order_id?: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface ReferralItem {
  id: string;
  status: string;
  created_at: string;
  order_id?: string;
  orders?: { buyer_id?: string };
  promoter_campaigns?: { product_id?: string };
}

export interface WithdrawalItem {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  admin_notes?: string;
  bank_name?: string;
  account_number?: string;
}

export interface ProductToPromote {
  id: string;
  title: string;
  price: number;
  images: string[];
  description?: string;
  inventory?: number;
  category?: string;
  commission_percent?: number;
}

export function usePromoterData() {
  const { user, profile } = useAuth();

  const [promoterCode, setPromoterCode] = useState<string>('');
  const [wallet, setWallet] = useState<{ balance: number; escrow_balance: number }>({
    balance: 0,
    escrow_balance: 0,
  });
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [products, setProducts] = useState<ProductToPromote[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Fetch or generate Promoter Code
  const fetchPromoterCode = useCallback(async (userId: string) => {
    try {
      const { data: codeData, error } = await supabase
        .from('promoter_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[usePromoterData] Error fetching code:', error);
      }

      if (codeData?.code) {
        setPromoterCode(codeData.code);
        return codeData.code;
      }

      // Generate new PX code
      const newCode = 'PX' + Math.random().toString(36).substring(2, 8).toUpperCase();
      try {
        await supabase.from('promoter_codes').insert({ user_id: userId, code: newCode });
      } catch (insertErr) {
        console.warn('[usePromoterData] insert promoter_codes warning:', insertErr);
      }
      setPromoterCode(newCode);
      return newCode;
    } catch (e) {
      console.warn('[usePromoterData] code exception:', e);
      const fallbackCode = userId.slice(0, 8).toUpperCase();
      setPromoterCode(fallbackCode);
      return fallbackCode;
    }
  }, []);

  // Fetch Wallet & Balances
  const fetchWallet = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('wallets')
        .select('balance, escrow_balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setWallet({
          balance: Number(data.balance || 0),
          escrow_balance: Number(data.escrow_balance || 0),
        });
      }
    } catch (e) {
      console.warn('[usePromoterData] wallet fetch warning:', e);
    }
  }, []);

  // Fetch Commission settlements
  const fetchCommissions = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('order_settlements')
        .select(`
          id,
          promoter_amount,
          status,
          created_at,
          order_id,
          orders!inner(promoter_id)
        `)
        .eq('orders.promoter_id', userId)
        .gt('promoter_amount', 0)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('[usePromoterData] settlements warning:', error);
        return;
      }

      const formatted: CommissionItem[] = (data || []).map((d: any) => ({
        id: d.id,
        order_id: d.order_id,
        amount: Number(d.promoter_amount || 0),
        status: d.status || 'paid',
        created_at: d.created_at,
      }));
      setCommissions(formatted);
    } catch (e) {
      console.warn('[usePromoterData] commissions exception:', e);
    }
  }, []);

  // Fetch Referrals click & conversions
  const fetchReferrals = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('referrals')
        .select('id, status, created_at, order_id, orders(buyer_id), promoter_campaigns(product_id)')
        .eq('promoter_id', userId)
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) {
        console.warn('[usePromoterData] referrals fetch warning:', error);
        return;
      }
      setReferrals((data as any) || []);
    } catch (e) {
      console.warn('[usePromoterData] referrals exception:', e);
    }
  }, []);

  // Fetch Payout Requests
  const fetchWithdrawals = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('id, amount, status, created_at, admin_notes, bank_name, account_number')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (error) {
        console.warn('[usePromoterData] payout_requests warning:', error);
        return;
      }
      setWithdrawals((data as any) || []);
    } catch (e) {
      console.warn('[usePromoterData] withdrawals exception:', e);
    }
  }, []);

  // Fetch Marketplace Products for Promotion
  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, title, price, images, description, inventory')
        .gt('inventory', 0)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        console.warn('[usePromoterData] products warning:', error);
        return;
      }

      const mapped: ProductToPromote[] = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title || 'Marketplace Item',
        price: Number(p.price || 0),
        images: Array.isArray(p.images) ? p.images : [],
        description: p.description || '',
        inventory: p.inventory || 1,
        commission_percent: 5, // Default standard 5% commission on Linkup Marketplace
      }));
      setProducts(mapped);
    } catch (e) {
      console.warn('[usePromoterData] products exception:', e);
    }
  }, []);

  // Master load
  const loadAll = useCallback(
    async (isRefresh = false) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        await Promise.allSettled([
          fetchPromoterCode(user.id),
          fetchWallet(user.id),
          fetchCommissions(user.id),
          fetchReferrals(user.id),
          fetchWithdrawals(user.id),
          fetchProducts(),
        ]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user, fetchPromoterCode, fetchWallet, fetchCommissions, fetchReferrals, fetchWithdrawals, fetchProducts]
  );

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Request Withdrawal Action
  const requestWithdrawal = async (params: {
    amount: number;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'User not signed in' };
    if (params.amount <= 0 || params.amount > wallet.balance) {
      return { success: false, error: `Invalid amount. Max available is ₦${wallet.balance.toLocaleString()}` };
    }
    if (params.amount < 1000) {
      return { success: false, error: 'Minimum withdrawal is ₦1,000' };
    }
    if (!params.bankName || !params.accountNumber || !params.accountName) {
      return { success: false, error: 'Please enter all bank payout details.' };
    }

    setWithdrawing(true);
    try {
      const { data, error } = await supabase.rpc('request_withdrawal', {
        p_user_id: user.id,
        p_amount: params.amount,
        p_bank_name: params.bankName,
        p_account_number: params.accountNumber,
        p_account_name: params.accountName,
      });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast.success('Withdrawal Submitted! 💸', {
        description: `₦${params.amount.toLocaleString()} will be transferred after processing.`,
      });

      // Reload wallet & withdrawals
      await Promise.all([fetchWallet(user.id), fetchWithdrawals(user.id)]);
      return { success: true };
    } catch (err: any) {
      console.warn('[usePromoterData] requestWithdrawal error:', err);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast.error('Withdrawal Failed', { description: err.message || 'Could not process request.' });
      return { success: false, error: err.message };
    } finally {
      setWithdrawing(false);
    }
  };

  const stats: PromoterStats = {
    totalRevenue: wallet.balance + wallet.escrow_balance,
    availableBalance: wallet.balance,
    escrowBalance: wallet.escrow_balance,
    totalConversions: referrals.filter((r) => r.status === 'conversion').length,
    totalClicks: referrals.length,
  };

  return {
    promoterCode,
    wallet,
    stats,
    commissions,
    referrals,
    withdrawals,
    products,
    loading,
    refreshing,
    withdrawing,
    refresh: () => loadAll(true),
    requestWithdrawal,
  };
}
