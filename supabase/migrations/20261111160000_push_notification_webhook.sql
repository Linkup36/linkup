-- ==============================================================================
-- DATABASE TRIGGER: DISPATCH PUSH NOTIFICATION ON NOTIFICATIONS TABLE INSERT
-- Automatically forwards every new record in public.notifications to the 
-- `send-push` Edge Function via pg_net so background/offline devices get real-time OS push.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION "public"."send_push_notification_webhook"()
RETURNS trigger AS $$
DECLARE
  v_push_url TEXT := 'https://dahuvbojcmcylpsryyoe.supabase.co/functions/v1/send-push';
  v_anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhaHV2Ym9qY21jeWxwc3J5eW9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2MTU4NDYsImV4cCI6MjEwNjE5MTg0Nn0.cWZYYDyz7rPHxAv-6ah6lkkV4cYIBEV4Q0BoKwHOrsA';
BEGIN
  -- Forward notification details to send-push edge function
  PERFORM net.http_post(
    url := v_push_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    )
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Resilient safeguard: Never block database transactions if net.http_post fails
    RAISE WARNING 'send_push_notification_webhook failed: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if already exists for idempotency
DROP TRIGGER IF EXISTS "send_push_on_notification" ON "public"."notifications";

-- Create trigger on notifications table
CREATE TRIGGER "send_push_on_notification"
  AFTER INSERT ON "public"."notifications"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."send_push_notification_webhook"();

