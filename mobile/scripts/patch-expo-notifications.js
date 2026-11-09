const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'build',
  'TopicSubscriptionModule.android.js'
);

const targetTsPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'src',
  'TopicSubscriptionModule.android.ts'
);

function patchFile(filePath, isTs) {
  if (fs.existsSync(filePath)) {
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
}

try {
  patchFile(targetPath, false);
  patchFile(targetTsPath, true);
} catch (err) {
  console.warn('[patch] Failed to patch expo-notifications:', err.message);
}
