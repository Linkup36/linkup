-- ==============================================================================
-- 1. FIX ORDERS RLS POLICY
-- Allows riders to view any order that is awaiting a courier
-- ==============================================================================
DROP POLICY IF EXISTS "Logistics view orders" ON public.orders;

CREATE POLICY "Logistics view orders" ON public.orders FOR SELECT
TO authenticated
USING (
    status = 'awaiting_agent'
    OR buyer_id = auth.uid()
    OR seller_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('logistics', 'admin')
    )
);

-- ==============================================================================
-- 2. FIX ORDER RECIPIENT RLS POLICY
-- Allows delivery addresses of awaiting orders to be read by couriers
-- ==============================================================================
DROP POLICY IF EXISTS "Logistics view order recipients" ON public.order_recipient;

CREATE POLICY "Logistics view order recipients" ON public.order_recipient FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = order_recipient.order_id 
        AND (o.status = 'awaiting_agent' OR o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
    OR EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role IN ('logistics', 'admin')
    )
);

-- ==============================================================================
-- 3. FIX SHIPMENTS RLS POLICY (CRITICAL)
-- Allows couriers to see ALL pending unassigned missions regardless of zone!
-- ==============================================================================
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Logistics view zone shipments" ON public.shipments;
DROP POLICY IF EXISTS "Allow view shipments" ON public.shipments;
DROP POLICY IF EXISTS "Admins can view all shipments" ON public.shipments;

CREATE POLICY "Allow view shipments" ON public.shipments FOR SELECT
TO authenticated
USING (
    -- Any pending unassigned shipment is visible to couriers
    status = 'pending'
    -- Assigned rider can view
    OR rider_id = auth.uid()
    -- Merchant/seller can view
    OR seller_id = auth.uid()
    -- Order buyer or seller can view
    OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = shipments.order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid() OR o.status = 'awaiting_agent')
    )
    -- Logistics or Admin role holders can view any shipment
    OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role IN ('logistics', 'admin')
    )
);

-- ==============================================================================
-- 4. ENSURE CURRENT RIDER HAS 'logistics' ROLE ASSIGNED
-- ==============================================================================
INSERT INTO public.user_roles (user_id, role)
VALUES ('aa744c6c-38f0-46c1-9f31-769ed6e053d5', 'logistics')
ON CONFLICT (user_id, role) DO NOTHING;

-- ==============================================================================
-- 5. BACKFILL ALL EXISTING 'awaiting_agent' ORDERS INTO SHIPMENTS
-- Ensures orders with status 'awaiting_agent' immediately have shipment rows
-- ==============================================================================
INSERT INTO public.shipments (
    order_id,
    seller_id,
    status,
    delivery_fee,
    zone_id,
    delivery_address,
    pickup_address,
    created_at,
    updated_at
)
SELECT 
    o.id,
    o.seller_id,
    'pending'::public.shipment_status,
    COALESCE(o.shipping_fee, 1500),
    r.zone_id,
    COALESCE(r.address_line, 'Customer Address'),
    COALESCE(p.address, 'Seller Pickup Point'),
    o.created_at,
    NOW()
FROM public.orders o
LEFT JOIN (
    SELECT DISTINCT ON (order_id) order_id, zone_id, address_line
    FROM public.order_recipient
    ORDER BY order_id, created_at DESC
) r ON r.order_id = o.id
LEFT JOIN public.profiles p ON p.id = o.seller_id
WHERE o.status = 'awaiting_agent'
AND NOT EXISTS (
    SELECT 1 FROM public.shipments s WHERE s.order_id = o.id
);
