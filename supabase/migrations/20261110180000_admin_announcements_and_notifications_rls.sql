-- ========================================================================
-- MIGRATION: Admin Announcements & Notifications RLS
-- Allows admins to broadcast in-app announcements and insert notifications
-- ========================================================================

-- 1. Ensure RLS allows admins and users to insert notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications" ON public.notifications
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

-- 2. Atomic RPC function for instant broadcast announcement dispatch
CREATE OR REPLACE FUNCTION public.dispatch_admin_announcement(
    p_title TEXT,
    p_subject TEXT,
    p_content TEXT,
    p_target_audience TEXT DEFAULT 'all'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_campaign_id UUID;
    v_recipients_count INT := 0;
BEGIN
    -- Verify that caller has admin role
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = v_admin_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access denied: Admin privileges required.';
    END IF;

    -- 1. Insert campaign record into newsletter_campaigns
    INSERT INTO public.newsletter_campaigns (
        title,
        subject,
        content,
        target_audience,
        status,
        sent_by,
        sent_at
    ) VALUES (
        p_title,
        p_subject,
        p_content,
        p_target_audience,
        'sent',
        v_admin_id,
        NOW()
    )
    RETURNING id INTO v_campaign_id;

    -- 2. Bulk insert notifications for target audience in one fast set operation
    IF p_target_audience = 'all' THEN
        INSERT INTO public.notifications (user_id, type, message, read)
        SELECT p.id, 'announcement', p_subject || ': ' || p_content, false
        FROM public.profiles p;
        GET DIAGNOSTICS v_recipients_count = ROW_COUNT;
    ELSIF p_target_audience = 'sellers' THEN
        INSERT INTO public.notifications (user_id, type, message, read)
        SELECT ur.user_id, 'announcement', p_subject || ': ' || p_content, false
        FROM public.user_roles ur
        WHERE ur.role = 'seller';
        GET DIAGNOSTICS v_recipients_count = ROW_COUNT;
    ELSIF p_target_audience = 'logistics' THEN
        INSERT INTO public.notifications (user_id, type, message, read)
        SELECT ur.user_id, 'announcement', p_subject || ': ' || p_content, false
        FROM public.user_roles ur
        WHERE ur.role IN ('logistics', 'driver');
        GET DIAGNOSTICS v_recipients_count = ROW_COUNT;
    ELSIF p_target_audience = 'buyers' THEN
        INSERT INTO public.notifications (user_id, type, message, read)
        SELECT p.id, 'announcement', p_subject || ': ' || p_content, false
        FROM public.profiles p
        WHERE NOT EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = p.id AND ur.role IN ('seller', 'logistics', 'driver')
        )
        OR EXISTS (
            SELECT 1 FROM public.user_roles ur 
            WHERE ur.user_id = p.id AND ur.role = 'buyer'
        );
        GET DIAGNOSTICS v_recipients_count = ROW_COUNT;
    END IF;

    -- Update campaign with accurate counts
    UPDATE public.newsletter_campaigns
    SET recipients_count = v_recipients_count,
        success_count = v_recipients_count
    WHERE id = v_campaign_id;

    RETURN jsonb_build_object(
        'success', true,
        'campaign_id', v_campaign_id,
        'recipients_count', v_recipients_count
    );
END;
$$;

-- 3. Enable Realtime Change Data Capture (CDC) for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
END $$;


