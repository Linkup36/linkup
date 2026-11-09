-- 1. Ensure table has both 'notes' and 'note' to guarantee backward compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'send_order_tracking_logs' 
        AND column_name = 'note'
    ) THEN
        ALTER TABLE public.send_order_tracking_logs ADD COLUMN note TEXT;
    END IF;
END $$;

-- 2. Fix pay_send_order_with_wallet:
--    - Fix send_order_tracking_logs column: use 'notes' (and 'note')
--    - Fix rider notification query: select from public.user_roles instead of public.profiles (which has no 'role' column)
CREATE OR REPLACE FUNCTION public.pay_send_order_with_wallet(
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_order RECORD;
    v_wallet_id UUID;
    v_current_balance NUMERIC;
    v_required_amount NUMERIC;
    v_new_balance NUMERIC;
    v_log_msg TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'You must be logged in to pay with wallet balance.';
    END IF;

    -- Fetch order
    SELECT * INTO v_order
    FROM public.send_orders
    WHERE id = p_order_id;

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Package order % not found.', p_order_id;
    END IF;

    IF v_order.user_id != v_user_id THEN
        RAISE EXCEPTION 'Unauthorized to pay for this package order.';
    END IF;

    IF v_order.payment_status = 'paid' THEN
        RAISE EXCEPTION 'This package order has already been paid for.';
    END IF;

    v_required_amount := v_order.delivery_fee;
    IF v_required_amount IS NULL OR v_required_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid delivery fee for order %.', p_order_id;
    END IF;

    -- Lock the wallet row for update
    SELECT id, balance INTO v_wallet_id, v_current_balance
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found. Please contact support.';
    END IF;

    IF v_current_balance < v_required_amount THEN
        RAISE EXCEPTION 'Insufficient wallet balance. Total fee is ₦%, but your available balance is ₦%.',
            v_required_amount, v_current_balance;
    END IF;

    v_new_balance := v_current_balance - v_required_amount;

    -- 1. Deduct fee from wallet balance
    UPDATE public.wallets
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE id = v_wallet_id;

    -- 2. Insert wallet transaction record
    INSERT INTO public.wallet_transactions (
        wallet_id,
        amount,
        type,
        reference,
        created_at
    ) VALUES (
        v_wallet_id,
        v_required_amount,
        'send_payment',
        'Payment for SEND package ' || p_order_id,
        NOW()
    );

    -- 3. Mark package order as paid and searching for riders
    UPDATE public.send_orders
    SET status = 'finding_rider',
        payment_status = 'paid',
        payment_ref = 'WALLET_' || p_order_id || '_' || EXTRACT(EPOCH FROM NOW())::BIGINT,
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 4. Create tracking log using 'notes' column
    v_log_msg := 'Delivery fee of ₦' || v_required_amount || ' paid with wallet balance. Dispatch riders notified.';
    INSERT INTO public.send_order_tracking_logs (
        order_id,
        status,
        notes,
        note,
        created_at
    ) VALUES (
        p_order_id,
        'finding_rider',
        v_log_msg,
        v_log_msg,
        NOW()
    );

    -- 5. Broadcast in-app notification to active dispatch riders (logistics role in user_roles)
    INSERT INTO public.notifications (user_id, type, message, read, created_at)
    SELECT 
        DISTINCT user_id, 
        'delivery', 
        'New package delivery mission available: ₦' || v_required_amount || ' · ' || v_order.pickup_address, 
        false, 
        NOW()
    FROM public.user_roles
    WHERE role = 'logistics';

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'amount_paid', v_required_amount,
        'remaining_balance', v_new_balance
    );
END;
$$;
