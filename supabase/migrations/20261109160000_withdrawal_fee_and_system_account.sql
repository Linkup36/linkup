-- Migration: 20261109160000_withdrawal_fee_and_system_account.sql
-- Description: Handle withdrawal processing fee deduction and routing to system account upon approval

-- 1. Ensure profile columns exist for cross-compatibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Trigger for deducting wallet balance and fee on payout request placement
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


-- 3. Trigger for handling payout approval (crediting fee to admin/system account) or rejection (refunding user)
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
