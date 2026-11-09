-- Migration: 20261109160000_withdrawal_fee_and_system_account.sql
-- Description: Ensure payout_requests, profiles, and system settings exist, handle fee deduction and routing

-- 1. Ensure profile columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_bank_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_account_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS payout_account_name TEXT;

-- 2. Ensure system_settings table and default withdrawal fee exist
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
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

INSERT INTO public.system_settings (key, value, description)
VALUES ('withdrawal_fee', '{"amount": 100, "type": "flat"}'::jsonb, 'Standard withdrawal processing fee')
ON CONFLICT (key) DO NOTHING;

-- 3. Ensure payout_requests table and columns exist
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

-- Enable RLS and policies for payout_requests
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payout requests" ON public.payout_requests;
CREATE POLICY "Users can view own payout requests" 
ON public.payout_requests FOR SELECT 
TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Users can create own payout requests" ON public.payout_requests;
CREATE POLICY "Users can create own payout requests" 
ON public.payout_requests FOR INSERT 
TO authenticated 
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update payout requests" ON public.payout_requests;
CREATE POLICY "Admins can update payout requests" 
ON public.payout_requests FOR UPDATE 
TO authenticated 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 4. Trigger for deducting wallet balance and fee on payout request placement
CREATE OR REPLACE FUNCTION public.handle_payout_request_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_total_deduction NUMERIC;
    v_sys_fee NUMERIC := 0;
BEGIN
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
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
    VALUES (NEW.wallet_id, -NEW.amount, 'withdrawal', 'Withdrawal Request');

    -- Insert wallet transaction for the fee
    IF NEW.fee_amount > 0 THEN
        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (NEW.wallet_id, -NEW.fee_amount, 'withdrawal_fee', 'Withdrawal Processing Fee');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_payout_request_insert ON public.payout_requests;
CREATE TRIGGER trigger_payout_request_insert
    BEFORE INSERT ON public.payout_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_payout_request_insert();


-- 5. Trigger for handling payout approval (crediting fee to admin/system account) or rejection (refunding user)
CREATE OR REPLACE FUNCTION public.handle_payout_request_status_change()
RETURNS TRIGGER AS $$
DECLARE
    v_total_refund NUMERIC;
    v_admin_wallet_id UUID;
BEGIN
    -- Case A: Payout is APPROVED or COMPLETED
    -- Transfer the processing fee to the system/admin wallet
    IF NEW.status IN ('approved', 'completed') AND (OLD.status IS NULL OR OLD.status NOT IN ('approved', 'completed')) THEN
        IF COALESCE(NEW.fee_amount, 0) > 0 THEN
            -- Find the system administrator wallet
            SELECT w.id INTO v_admin_wallet_id
            FROM public.wallets w
            JOIN public.user_roles ur ON ur.user_id = w.user_id
            WHERE ur.role = 'admin'
            ORDER BY w.created_at ASC
            LIMIT 1;

            -- If an admin wallet exists, credit the fee and log transaction
            IF v_admin_wallet_id IS NOT NULL THEN
                UPDATE public.wallets
                SET balance = balance + NEW.fee_amount,
                    updated_at = NOW()
                WHERE id = v_admin_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (
                    v_admin_wallet_id,
                    NEW.fee_amount,
                    'withdrawal_fee_income',
                    'Withdrawal processing fee from payout #' || NEW.id
                );
            END IF;
        END IF;

        -- Send notification to user
        INSERT INTO public.notifications (user_id, type, message, read, created_at)
        VALUES (
            NEW.user_id,
            'payout_approved',
            'Your withdrawal request of ₦' || NEW.amount || ' has been approved and disbursed to your bank account.',
            false,
            NOW()
        );

    -- Case B: Payout is REJECTED
    -- Refund both withdrawal amount and fee back to user's wallet
    ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
        v_total_refund := NEW.amount + COALESCE(NEW.fee_amount, 0);

        UPDATE public.wallets
        SET balance = balance + v_total_refund,
            updated_at = NOW()
        WHERE id = NEW.wallet_id;

        INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
        VALUES (
            NEW.wallet_id,
            v_total_refund,
            'payout_refund',
            'Refund of rejected withdrawal request #' || NEW.id
        );

        -- If fee had already been transferred to admin wallet, reverse it
        IF OLD.status IN ('approved', 'completed') AND COALESCE(NEW.fee_amount, 0) > 0 THEN
            SELECT w.id INTO v_admin_wallet_id
            FROM public.wallets w
            JOIN public.user_roles ur ON ur.user_id = w.user_id
            WHERE ur.role = 'admin'
            ORDER BY w.created_at ASC
            LIMIT 1;

            IF v_admin_wallet_id IS NOT NULL THEN
                UPDATE public.wallets
                SET balance = GREATEST(0, balance - NEW.fee_amount),
                    updated_at = NOW()
                WHERE id = v_admin_wallet_id;

                INSERT INTO public.wallet_transactions (wallet_id, amount, type, reference)
                VALUES (
                    v_admin_wallet_id,
                    -NEW.fee_amount,
                    'fee_reversal',
                    'Reversal of fee for rejected payout #' || NEW.id
                );
            END IF;
        END IF;

        -- Send notification to user
        INSERT INTO public.notifications (user_id, type, message, read, created_at)
        VALUES (
            NEW.user_id,
            'payout_rejected',
            'Your payout request of ₦' || NEW.amount || ' was rejected: ' || COALESCE(NEW.admin_notes, 'Contact support') || '. Funds (including fee) have been refunded to your wallet.',
            false,
            NOW()
        );
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
