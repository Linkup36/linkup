const fs = require('fs');
const path = require('path');

const expoNotificationsDir = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications'
);

// 1. Patch TopicSubscriptionModule for Expo Go compatibility
const topicBuildPath = path.join(
  expoNotificationsDir,
  'build',
  'TopicSubscriptionModule.android.js'
);

const topicSrcPath = path.join(
  expoNotificationsDir,
  'src',
  'TopicSubscriptionModule.android.ts'
);

function patchTopicSubscription(filePath, isTs) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('try {')) {
    const patched = isTs
      ? `import { requireNativeModule } from 'expo-modules-core';
import type { TopicSubscriptionModule } from './TopicSubscriptionModule.types';

let mod: TopicSubscriptionModule;
try {
  mod = requireNativeModule<TopicSubscriptionModule>('ExpoTopicSubscriptionModule');
} catch (e) {
  mod = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null),
  } as any;
}

export default mod;
`
      : `import { requireNativeModule } from 'expo-modules-core';

let mod;
try {
  mod = requireNativeModule('ExpoTopicSubscriptionModule');
} catch (e) {
  mod = {
    addListener: () => {},
    removeListeners: () => {},
    subscribeToTopicAsync: () => Promise.resolve(null),
    unsubscribeFromTopicAsync: () => Promise.resolve(null),
  };
}

export default mod;
`;
    fs.writeFileSync(filePath, patched);
    console.log(`[patch] Patched ${path.basename(filePath)} for Expo Go compatibility.`);
  }
}

// 2. Suppress Expo Go startup console.warn in index.js / index.ts
function patchIndexWarning(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('console.warn(message);')) {
    const patched = content.replace(
      'console.warn(message);',
      '// Suppressed in Expo Go: console.warn(message);'
    );
    fs.writeFileSync(filePath, patched);
    console.log(`[patch] Silenced Expo Go startup warning in ${path.basename(filePath)}.`);
  }
}

// 3. Guard setNotificationChannelAsync on Android against missing NotificationsChannelsProvider in Expo Go
function patchSetNotificationChannel(filePath, isTs) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('isRunningInExpoGo')) {
    const patched = isTs
      ? `import { isRunningInExpoGo } from 'expo';
import { UnavailabilityError } from 'expo-modules-core';

import NotificationChannelManager from './NotificationChannelManager';
import type {
  NotificationChannelInput,
  NotificationChannel,
} from './NotificationChannelManager.types';
import { AndroidImportance } from './NotificationChannelManager.types';

export async function setNotificationChannelAsync(
  channelId: string,
  channel: NotificationChannelInput
): Promise<NotificationChannel | null> {
  if (isRunningInExpoGo()) {
    return null;
  }
  if (!NotificationChannelManager.setNotificationChannelAsync) {
    throw new UnavailabilityError('Notifications', 'setNotificationChannelAsync');
  }

  if (channel?.importance === AndroidImportance.UNSPECIFIED) {
    console.warn(
      \`Warning: You are setting the importance of the notification channel "\${channelId}" to "UNSPECIFIED". \` +
        \`This may lead to errors on some Android versions. \` +
        \`It's recommended to instead use AndroidImportance.DEFAULT.\`
    );
  }
  try {
    return await NotificationChannelManager.setNotificationChannelAsync(channelId, channel);
  } catch {
    return null;
  }
}
`
      : `import { isRunningInExpoGo } from 'expo';
import { UnavailabilityError } from 'expo-modules-core';
import NotificationChannelManager from './NotificationChannelManager';
import { AndroidImportance } from './NotificationChannelManager.types';
export async function setNotificationChannelAsync(channelId, channel) {
    if (isRunningInExpoGo()) {
        return null;
    }
    if (!NotificationChannelManager.setNotificationChannelAsync) {
        throw new UnavailabilityError('Notifications', 'setNotificationChannelAsync');
    }
    if (channel?.importance === AndroidImportance.UNSPECIFIED) {
        console.warn(\`Warning: You are setting the importance of the notification channel "\${channelId}" to "UNSPECIFIED". \` +
            \`This may lead to errors on some Android versions. \` +
            \`It's recommended to instead use AndroidImportance.DEFAULT.\`);
    }
    try {
        return await NotificationChannelManager.setNotificationChannelAsync(channelId, channel);
    } catch {
        return null;
    }
}
//# sourceMappingURL=setNotificationChannelAsync.android.js.map
`;
    fs.writeFileSync(filePath, patched);
    console.log(`[patch] Patched ${path.basename(filePath)} for Expo Go channel compatibility.`);
  }
}

try {
  patchTopicSubscription(topicBuildPath, false);
  patchTopicSubscription(topicSrcPath, true);
  patchIndexWarning(path.join(expoNotificationsDir, 'build', 'index.js'));
  patchIndexWarning(path.join(expoNotificationsDir, 'src', 'index.ts'));
  patchSetNotificationChannel(
    path.join(expoNotificationsDir, 'build', 'setNotificationChannelAsync.android.js'),
    false
  );
  patchSetNotificationChannel(
    path.join(expoNotificationsDir, 'src', 'setNotificationChannelAsync.android.ts'),
    true
  );
} catch (err) {
  console.warn('[patch] Failed to patch expo-notifications:', err.message);
}
