// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const record = body.record || body;
    const target_user_id = body.target_user_id || record.user_id;
    const title = body.title || record.title || "🔔 LinkUp Alert";
    const message = body.message || record.message || "";
    const url = body.url || record.data?.url || "/";
    const icon = body.icon || record.data?.icon;
    const sound = body.sound || record.data?.sound || "linkup_notification.mp3";

    if (!target_user_id || (!message && !title)) {
      throw new Error("Missing required fields: target_user_id (or record.user_id), message");
    }

    const results: Record<string, any> = {
      expoPush: null,
      webPush: null,
    };

    // 1. Check for Mobile Expo Push Token on User Profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("push_token")
      .eq("id", target_user_id)
      .maybeSingle();

    if (profile?.push_token && String(profile.push_token).startsWith("ExponentPushToken[")) {
      try {
        const expoMessage = {
          to: profile.push_token,
          sound: sound || "linkup_notification.mp3",
          channelId: "linkup_notifications",
          title: title,
          body: message,
          priority: "high",
          data: { url: url || "/" },
        };

        const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(expoMessage),
        });

        results.expoPush = { ok: expoRes.ok, status: expoRes.status };
      } catch (expoErr: any) {
        console.error("Expo push delivery error:", expoErr.message);
        results.expoPush = { error: expoErr.message };
      }
    }

    // 2. Check for Web Push Subscriptions (Browser)
    const { data: subscriptions } = await adminClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", target_user_id);

    if (subscriptions && subscriptions.length > 0) {
      const VAPID_PUBLIC_KEY =
        Deno.env.get("VITE_VAPID_PUBLIC_KEY") ||
        "BN5R1dEKhws8X8qALinzM9C5WuzhOly2Cz1jHaxKlSgDq2fqRw9GpJD568A2OU9mk1KO6e0qtqst2BAMlczr5Os";
      const VAPID_PRIVATE_KEY =
        Deno.env.get("VAPID_PRIVATE_KEY") ||
        "2Kht47zHqBrClD1ObR90d0Rc2vbIGYhQ4FpzhkKsENY";

      webpush.setVapidDetails(
        "mailto:admin@linkupng.com",
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
      );

      const payload = JSON.stringify({
        title,
        body: message,
        icon: icon || "/logoo.jpeg",
        data: { url: url || "/" },
      });

      const webResults = await Promise.allSettled(
        subscriptions.map((sub: any) =>
          webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
        )
      );

      results.webPush = { count: webResults.length };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("send-push error:", error);
    return new Response(JSON.stringify({ error: error.message, success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

