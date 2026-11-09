-- ========================================================================
-- MIGRATION: Escrow Rider Funding Tied Strictly to Buyer Delivery Confirmation
-- Fraud Prevention: Disables rider escrow funding on shipment assignment.
-- Logistics cut is credited to rider escrow ONLY when buyer confirms completion.
-- ========================================================================

-- 1. DROP the legacy trigger that funded rider escrow on assignment
DROP TRIGGER IF EXISTS tr_fund_rider_escrow ON public.shipments;

-- 2. Neutralize handle_rider_escrow_funding so status='assigned' cannot fund escrow
CREATE OR REPLACE FUNCTION public.handle_rider_escrow_funding()
RETURNS TRIGGER AS $$
BEGIN
    -- No-op: Courier escrow funding on assignment is retired to prevent fraud.
    -- Logistics earnings are now credited strictly upon buyer delivery confirmation.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the buyer confirmation escrow trigger function on public.orders
CREATE OR REPLACE FUNCTION public.handle_rider_escrow_on_buyer_confirmation()
RETURNS TRIGGER AS $$
DECLARE
    v_shipment RECORD;
    v_rider_wallet_id UUID;
    v_rider_fee NUMERIC := 0;
    v_escrow_exists BOOLEAN;
BEGIN
    -- Only execute when order status becomes 'completed' (Buyer physical confirmation)
    IF NEW.status::TEXT = 'completed' AND (OLD.status IS NULL OR OLD.status::TEXT != 'completed') THEN
        FOR v_shipment IN 
            SELECT id, rider_id, delivery_fee, rider_fee_breakdown 
            FROM public.shipments 
            WHERE order_id = NEW.id AND rider_id IS NOT NULL
        LOOP
            -- 1. Determine courier fee from settlements, shipment breakdown, or shipping fee
            SELECT rider_amount INTO v_rider_fee 
            FROM public.order_settlements 
            WHERE order_id = NEW.id LIMIT 1;

            IF v_rider_fee IS NULL OR v_rider_fee <= 0 THEN
                v_rider_fee := COALESCE(
                    (v_shipment.rider_fee_breakdown->>'total')::NUMERIC, 
                    v_shipment.delivery_fee, 
                    NEW.shipping_fee, 
                    0
                );
            END IF;

            IF v_rider_fee > 0 THEN
                -- 2. Find or create rider wallet
                SELECT id INTO v_rider_wallet_id 
                FROM public.wallets 
                WHERE user_id = v_shipment.rider_id OR seller_id = v_shipment.rider_id 
                LIMIT 1;

                IF v_rider_wallet_id IS NULL THEN
                    INSERT INTO public.wallets (user_id, balance, escrow_balance)
                    VALUES (v_shipment.rider_id, 0, 0)
                    RETURNING id INTO v_rider_wallet_id;
                END IF;

                -- 3. Check idempotency: avoid double-funding if already held
                SELECT EXISTS (
                    SELECT 1 FROM public.escrow_transactions 
                    WHERE order_id = NEW.id AND wallet_id = v_rider_wallet_id
                ) INTO v_escrow_exists;

                IF NOT v_escrow_exists THEN
                    -- Credit rider's escrow balance strictly upon buyer confirmation
                    UPDATE public.wallets 
                    SET escrow_balance = escrow_balance + v_rider_fee,
                        version = version + 1,
                        updated_at = NOW()
                    WHERE id = v_rider_wallet_id;

                    INSERT INTO public.escrow_transactions (order_id, wallet_id, amount, status)
                    VALUES (NEW.id, v_rider_wallet_id, v_rider_fee, 'held');

                    INSERT INTO public.notifications (user_id, type, message, read, created_at)
                    VALUES (
                        v_shipment.rider_id,
                        'escrow_credit',
                        'Delivery payout of ₦' || v_rider_fee || ' has been placed in your escrow wallet following buyer confirmation for Order #' || LEFT(NEW.id::TEXT, 8) || '.',
                        false,
                        NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to public.orders status change
DROP TRIGGER IF EXISTS tr_fund_rider_escrow_on_buyer_confirmation ON public.orders;
CREATE TRIGGER tr_fund_rider_escrow_on_buyer_confirmation
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_rider_escrow_on_buyer_confirmation();

-- 5. Harden complete_order_and_settle RPC to enforce buyer authorization
CREATE OR REPLACE FUNCTION public.complete_order_and_settle(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order record;
    v_caller_id UUID;
    v_is_admin BOOLEAN := false;
BEGIN
    v_caller_id := auth.uid();

    -- Fetch order
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Security: Only the buyer or an administrator may trigger final delivery completion
    IF v_caller_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM public.user_roles WHERE user_id = v_caller_id AND role = 'admin'
        ) INTO v_is_admin;

        IF v_order.buyer_id != v_caller_id AND NOT v_is_admin THEN
            RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only the buyer can confirm order delivery');
        END IF;
    END IF;

    IF v_order.status = 'completed' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order is already completed');
    END IF;

    -- Mark shipment as delivered if not already
    UPDATE public.shipments
    SET status = 'delivered', updated_at = NOW()
    WHERE order_id = p_order_id AND status != 'delivered';

    -- Update order status to completed
    -- This fires tr_fund_rider_escrow_on_buyer_confirmation to fund courier escrow
    -- and handle_order_completion_settlement to process settlement
    UPDATE public.orders 
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_order_and_settle(UUID) TO authenticated, service_role;

