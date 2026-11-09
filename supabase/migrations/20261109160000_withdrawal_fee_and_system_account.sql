-- Migration: 20261109160000_withdrawal_fee_and_system_account.sql
-- Description: Self-contained migration for payout requests, withdrawal fees, and system account routing

-- 1. Ensure public.profiles has required columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'buyer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_account_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_account_name TEXT;

-- 2. Ensure public.system_settings exists with withdrawal_fee
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read system settings" ON public.system_settings;
CREATE POLICY "Public can read system settings" ON public.system_settings
    FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Admins can manage system settings" ON public.system_settings;
CREATE POLICY "Admins can manage system settings" ON public.system_settings
    FOR ALL TO authenticated USING (true);

INSERT INTO public.system_settings (key, value, description)
VALUES ('withdrawal_fee', '{"amount": 100, "type": "flat"}'::jsonb, 'Standard withdrawal processing fee')
ON CONFLICT (key) DO NOTHING;

-- 3. Ensure public.wallets and public.wallet_transactions exist
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    escrow_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Safely allow system wallet without user foreign key constraint
ALTER TABLE public.wallets ALTER COLUMN user_id DROP NOT NULL;

-- Seed/Ensure System Revenue Wallet exists (id: 00000000-0000-0000-0000-000000000000)
INSERT INTO public.wallets (id, balance, escrow_balance)
VALUES ('00000000-0000-0000-0000-000000000000', 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own wallet" ON public.wallets;
CREATE POLICY "Users view own wallet" ON public.wallets 
    FOR SELECT TO authenticated 
    USING (user_id = auth.uid() OR id = '00000000-0000-0000-0000-000000000000');

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL,
    reference TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can view own wallet transactions" ON public.wallet_transactions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.wallets
            WHERE wallets.id = wallet_transactions.wallet_id
              AND (wallets.user_id = auth.uid() OR wallets.id = '00000000-0000-0000-0000-000000000000')
        )
    );

-- 4. Ensure public.payout_requests exists
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    wallet_id UUID REFERENCES public.wallets(id),
    amount NUMERIC(10, 2) NOT NULL,
    fee_amount NUMERIC(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    bank_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    account_name TEXT NOT NULL,
    admin_notes TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10, 2) DEFAULT 0;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS wallet_id UUID REFERENCES public.wallets(id);
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view payout requests" ON public.payout_requests;
CREATE POLICY "Users can view payout requests" 
ON public.payout_requests FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Users can create own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create own payout requests" 
ON public.payout_requests FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins and service can update payout requests" ON public.payout_requests;
CREATE POLICY "Admins and service can update payout requests" 
ON public.payout_requests FOR UPDATE 
TO authenticated 
USING (true);

-- 5. Ensure public.notifications exists
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 6. Trigger: Deduct amount + fee from user wallet on payout placement
CREATE OR REPLACE FUNCTION public.handle_payout_request_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_total_deduction NUMERIC;
    v_sys_fee NUMERIC := 0;
BEGIN
    -- If wallet_id not provided, look up from user_id
    IF NEW.wallet_id IS NULL THEN
        SELECT id INTO NEW.wallet_id
        FROM public.wallets
        WHERE user_id = NEW.user_id
        LIMIT 1;
    END IF;

    -- If fee_amount is NULL or 0, resolve from system_settings
    IF NEW.fee_amount IS NULL OR NEW.fee_amount = 0 THEN
        SELECT COALESCE((value->>'amount')::NUMERIC, 100) INTO v_sys_fee
        FROM public.system_settings
        WHERE key = 'withdrawal_fee';
        NEW.fee_amount := COALESCE(v_sys_fee, 0);
    END IF;

    v_total_deduction := NEW.amount + COALESCE(NEW.fee_amount, 0);

    -- Check if user's wallet has sufficient balance to cover amount and fee
    IF NOT EXISTS (
        SELECT 1 FROM public.wallets 
        WHERE id = NEW.wallet_id AND balance >= v_total_deduction
    ) THEN
        RAISE EXCEPTION 'Insufficient balance to cover withdrawal amount (₦%) and fee (₦%)', NEW.amount, NEW.fee_amount;
    END IF;

    -- Deduct total (amount + fee) from user's balance
    UPDATE public.wallets
    SET balance = balance - v_total_deduction,
        updated_at = NOW()
    WHERE id = NEW.wallet_id;

    -- Insert wallet transaction for the withdrawal
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
    VALUES (NEW.wallet_id, -NEW.amount, 'withdrawal', 'Withdrawal Request #' || SUBSTRING(NEW.id::text, 1, 8), 'pending');

    -- Insert wallet transaction for the fee
    IF NEW.fee_amount > 0 THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
        VALUES (NEW.wallet_id, -NEW.fee_amount, 'withdrawal_fee', 'Withdrawal Processing Fee', 'pending');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_payout_request_insert ON public.payout_requests;
CREATE TRIGGER trigger_payout_request_insert
    BEFORE INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payout_request_insert();

-- 7. Trigger: Route fee to system account on approval; refund user on rejection
CREATE OR REPLACE FUNCTION public.handle_payout_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_total_refund NUMERIC;
    v_sys_wallet UUID := '00000000-0000-0000-0000-000000000000';
    v_target_wallet UUID;
BEGIN
    v_target_wallet := COALESCE(NEW.wallet_id, (SELECT id FROM public.wallets WHERE user_id = NEW.user_id LIMIT 1));

    -- Case A: Payout is APPROVED or COMPLETED
    IF NEW.status IN ('approved', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'completed')) THEN
        -- Mark user pending transactions as completed
        IF v_target_wallet IS NOT NULL THEN
            UPDATE public.wallet_transactions
            SET status = 'completed'
            WHERE wallet_id = v_target_wallet
              AND type IN ('withdrawal', 'withdrawal_fee')
              AND status = 'pending';
        END IF;

        IF COALESCE(NEW.fee_amount, 0) > 0 THEN
            -- Ensure system revenue wallet exists
            INSERT INTO public.wallets (id, balance, escrow_balance)
            VALUES (v_sys_wallet, 0, 0)
            ON CONFLICT (id) DO NOTHING;

            -- Credit fee to system revenue wallet
            UPDATE public.wallets
            SET balance = balance + NEW.fee_amount,
                updated_at = NOW()
            WHERE id = v_sys_wallet;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
            VALUES (
                v_sys_wallet,
                NEW.fee_amount,
                'withdrawal_fee_income',
                'Withdrawal fee from payout #' || NEW.id,
                'completed'
            );
        END IF;

        -- Send notification to user (defensive)
        BEGIN
            INSERT INTO public.notifications (user_id, type, message, read, created_at)
            VALUES (
                NEW.user_id,
                'payout_approved',
                'Your withdrawal request of ₦' || NEW.amount || ' has been approved and disbursed to your bank account.',
                false,
                NOW()
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

    -- Case B: Payout is REJECTED
    ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
        v_total_refund := NEW.amount + COALESCE(NEW.fee_amount, 0);

        IF v_target_wallet IS NOT NULL THEN
            -- Refund amount + fee to user's wallet
            UPDATE public.wallets
            SET balance = balance + v_total_refund,
                updated_at = NOW()
            WHERE id = v_target_wallet;

            -- Mark prior pending transactions as cancelled
            UPDATE public.wallet_transactions
            SET status = 'cancelled'
            WHERE wallet_id = v_target_wallet
              AND type IN ('withdrawal', 'withdrawal_fee')
              AND status = 'pending';

            -- Add refund transaction
            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
            VALUES (
                v_target_wallet,
                v_total_refund,
                'payout_refund',
                'Refund of rejected withdrawal request #' || NEW.id,
                'completed'
            );
        END IF;

        -- If fee had already been credited to system wallet, reverse it
        IF OLD.status IN ('approved', 'completed') AND COALESCE(NEW.fee_amount, 0) > 0 THEN
            UPDATE public.wallets
            SET balance = GREATEST(0, balance - NEW.fee_amount),
                updated_at = NOW()
            WHERE id = v_sys_wallet;

            INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference, status)
            VALUES (
                v_sys_wallet,
                -NEW.fee_amount,
                'fee_reversal',
                'Reversal of fee for rejected payout #' || NEW.id,
                'completed'
            );
        END IF;

        -- Send notification to user (defensive)
        BEGIN
            INSERT INTO public.notifications (user_id, type, message, read, created_at)
            VALUES (
                NEW.user_id,
                'payout_rejected',
                'Your payout request of ₦' || NEW.amount || ' was rejected: ' || COALESCE(NEW.admin_notes, 'Contact support') || '. Funds (including fee) have been refunded to your wallet.',
                false,
                NOW()
            );
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_payout_request_status ON public.payout_requests;
DROP TRIGGER IF EXISTS trigger_payout_request_update ON public.payout_requests;
CREATE TRIGGER trg_payout_request_status
    AFTER UPDATE OF status ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payout_request_status_change();
