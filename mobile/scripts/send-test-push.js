#!/usr/bin/env node
/**
 * LinkUp Marketplace - Test Push Notification Dispatcher
 * Usage:
 *   node mobile/scripts/send-test-push.js [ExponentPushToken]
 */

const token = process.argv[2];

if (!token) {
  console.log('------------------------------------------------------------');
  console.log('LinkUp Push Notification Tester');
  console.log('------------------------------------------------------------');
  console.log('Please provide your ExponentPushToken as an argument.');
  console.log('Example:');
  console.log('  node mobile/scripts/send-test-push.js ExponentPushToken[xxxxxxxxxxxxxx]');
  console.log('\nYou can copy your token directly from the Notifications screen inside the app!');
  console.log('------------------------------------------------------------');
  process.exit(1);
}

async function sendPush() {
  console.log(`[LinkUp Push] Sending test alert to: ${token}...`);

  const payload = {
    to: token,
    sound: 'default',
    title: '🚀 LinkUp Real-Time Alert',
    body: 'Your package #ORD-9821 was dispatched and courier is 3 mins away!',
    data: {
      type: 'order_status',
      orderId: 'ORD-9821',
      timestamp: Date.now(),
    },
    priority: 'high',
    channelId: 'default',
  };

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log('[LinkUp Push] Server response:');
    console.dir(result, { depth: null });

    if (result.data?.status === 'ok') {
      console.log('✅ Push notification successfully queued by Expo Cloud!');
      console.log('Check your physical Android phone screen now for the popup.');
    } else {
      console.warn('⚠️ Push response notice:', result);
    }
  } catch (err) {
    console.error('❌ Failed to dispatch push:', err);
  }
}

sendPush();
