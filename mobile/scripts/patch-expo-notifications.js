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

function patchExpoConstants() {
  const constantsGradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-constants',
    'scripts',
    'get-app-config-android.gradle'
  );
  if (!fs.existsSync(constantsGradlePath)) return;
  const content = fs.readFileSync(constantsGradlePath, 'utf8');
  if (content.includes("hasProperty('libraryVariants')")) return;

  const patched = content
    .replace(
      /project\.android\.libraryVariants\.all \{ variant ->[\s\S]*?project\.android\.sourceSets\.maybeCreate\(variant\.name\)\.assets\.srcDirs \+= assetsDir\s*\}/,
      `def hasVariants = project.android.hasProperty('libraryVariants')

  if (hasVariants) {
    project.android.libraryVariants.all { variant ->
      def assetsDir = file("$buildDir/generated/assets/expo-constants/\${variant.name}")
      def configMode = variant.buildType.name == "debug" || variant.buildType.name == "debugOptimized" ? "development" : "production"

      def createConfigTask = tasks.register("create\${variant.name.capitalize()}ExpoConfig", Exec) {
        description = 'expo-constants: Create app.config.'

        doFirst {
          assetsDir.deleteDir()
          assetsDir.mkdirs()
        }

        outputs.upToDateWhen { false }
        outputs.dir assetsDir
        workingDir projectRoot

        if (Os.isFamily(Os.FAMILY_WINDOWS)) {
          commandLine("cmd", "/c", *nodeExecutableAndArgs, "$expoConstantsDir/scripts/getAppConfig.js", projectRoot, assetsDir, "android", "false", configMode)
        } else {
          commandLine(*nodeExecutableAndArgs, "$expoConstantsDir/scripts/getAppConfig.js", projectRoot, assetsDir, "android", "false", configMode)
        }
      }

      variant.preBuildProvider.configure { it.dependsOn(createConfigTask) }
      project.android.sourceSets.maybeCreate(variant.name).assets.srcDirs += assetsDir
    }
  } else {
    ['debug', 'release'].each { variantName ->
      def assetsDir = file("$buildDir/generated/assets/expo-constants/\${variantName}")
      def configMode = variantName == "debug" ? "development" : "production"

      def createConfigTask = tasks.register("create\${variantName.capitalize()}ExpoConfig", Exec) {
        description = 'expo-constants: Create app.config.'

        doFirst {
          assetsDir.deleteDir()
          assetsDir.mkdirs()
        }

        outputs.upToDateWhen { false }
        outputs.dir assetsDir
        workingDir projectRoot

        if (Os.isFamily(Os.FAMILY_WINDOWS)) {
          commandLine("cmd", "/c", *nodeExecutableAndArgs, "$expoConstantsDir/scripts/getAppConfig.js", projectRoot, assetsDir, "android", "false", configMode)
        } else {
          commandLine(*nodeExecutableAndArgs, "$expoConstantsDir/scripts/getAppConfig.js", projectRoot, assetsDir, "android", "false", configMode)
        }
      }

      tasks.matching { it.name.toLowerCase().contains("prebuild") }.configureEach { it.dependsOn(createConfigTask) }
      project.android.sourceSets.maybeCreate(variantName).assets.srcDirs += assetsDir
    }
  }`
    )
    .replace(
      /project\.android\.libraryVariants\.all \{ variant ->\s*if \(!variant\.buildType\.debuggable\) \{\s*return\s*\}\s*variant\.preBuildProvider\.configure \{ it\.dependsOn\(createFingerprintTask\) \}\s*project\.android\.sourceSets\.maybeCreate\(variant\.buildType\.name\)\.assets\.srcDirs \+= fingerprintAssetsDir\s*\}/,
      `if (hasVariants) {
    project.android.libraryVariants.all { variant ->
      if (!variant.buildType.debuggable) {
        return
      }
      variant.preBuildProvider.configure { it.dependsOn(createFingerprintTask) }
      project.android.sourceSets.maybeCreate(variant.buildType.name).assets.srcDirs += fingerprintAssetsDir
    }
  } else {
    tasks.matching { it.name.toLowerCase().contains("debug") && it.name.toLowerCase().contains("prebuild") }.configureEach { it.dependsOn(createFingerprintTask) }
    project.android.sourceSets.maybeCreate("debug").assets.srcDirs += fingerprintAssetsDir
  }`
    );

  fs.writeFileSync(constantsGradlePath, patched);
  console.log('[patch] Patched expo-constants get-app-config-android.gradle for AGP 9+ compatibility.');
}

function patchExpoModulesCore() {
  const coreGradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    'expo-modules-core',
    'android',
    'build.gradle'
  );
  if (!fs.existsSync(coreGradlePath)) return;
  const content = fs.readFileSync(coreGradlePath, 'utf8');
  if (content.includes("hasProperty('ndkDirectory')")) return;

  const patched = content.replace(
    'def stripBinary = PrebuiltNativeLibs.findLlvmStrip(android.ndkDirectory)',
    "def stripBinary = PrebuiltNativeLibs.findLlvmStrip(android.hasProperty('ndkDirectory') ? android.ndkDirectory : (android.hasProperty('ndkPath') ? (android.ndkPath ? file(android.ndkPath) : null) : null))"
  );

  fs.writeFileSync(coreGradlePath, patched);
  console.log('[patch] Patched expo-modules-core android/build.gradle for AGP 9+ compatibility.');
}

function patchKotlinAndroidPlugin(pkgName) {
  const gradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    pkgName,
    'android',
    'build.gradle'
  );
  if (!fs.existsSync(gradlePath)) return;
  let content = fs.readFileSync(gradlePath, 'utf8');
  if (content.includes('!project.extensions.findByName("kotlin")')) return;

  const regex = /^\s*apply\s+plugin:\s*['"]kotlin-android['"]\s*$/m;
  if (regex.test(content)) {
    const replacement = `if (!project.plugins.hasPlugin("kotlin-android") && !project.extensions.findByName("kotlin")) {\n    apply plugin: 'kotlin-android'\n}`;
    content = content.replace(regex, replacement);
    fs.writeFileSync(gradlePath, content);
    console.log(`[patch] Patched kotlin-android plugin guard in ${pkgName}.`);
  }
}

function patchAsyncStorage() {
  const asyncStorageNextDir = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-async-storage',
    'async-storage',
    'android',
    'src',
    'main',
    'java',
    'com',
    'reactnativecommunity',
    'asyncstorage',
    'next'
  );
  if (fs.existsSync(asyncStorageNextDir)) {
    fs.rmSync(asyncStorageNextDir, { recursive: true, force: true });
    console.log('[patch] Removed unused async-storage next/ Room files for AGP 9 compatibility.');
  }

  const asyncStorageGradlePath = path.join(
    __dirname,
    '..',
    'node_modules',
    '@react-native-async-storage',
    'async-storage',
    'android',
    'build.gradle'
  );
  if (fs.existsSync(asyncStorageGradlePath)) {
    let content = fs.readFileSync(asyncStorageGradlePath, 'utf8');
    if (!content.includes("exclude '**/next/**'")) {
      content = content.replace(
        "sourceSets.main {",
        "sourceSets.main {\n        java.exclude '**/next/**'"
      );
      fs.writeFileSync(asyncStorageGradlePath, content);
      console.log('[patch] Added exclude **/next/** to async-storage build.gradle.');
    }
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
  patchExpoConstants();
  patchExpoModulesCore();
  patchAsyncStorage();

  const kotlinPluginPkgs = [
    'react-native-maps',
    'react-native-webview',
    'react-native-screens',
    'react-native-gesture-handler',
    'react-native-safe-area-context',
  ];
  for (const pkg of kotlinPluginPkgs) {
    patchKotlinAndroidPlugin(pkg);
  }
} catch (err) {
  console.warn('[patch] Failed to patch dependencies:', err.message);
}


