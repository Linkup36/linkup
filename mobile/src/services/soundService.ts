import { Platform } from 'react-native';
import { LocalStorage } from '../storage/localStorage';
import { LINKUP_NOTIFICATION_SOUND_BASE64 } from '../assets/sounds/notificationSound';

const STORAGE_KEY = 'linkup_sound_enabled';
export const LINKUP_SOUND_PLAYBACK_RATE = 1.25; // 1.25x speed (snappy, energetic & natural)

let nativePlayer: any = null;
let webAudio: any = null;

// Auto-unlock web audio on first user gesture so async websocket background events are not blocked by autoplay policy
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const unlockWebAudio = () => {
    try {
      if (!webAudio && (window as any).Audio) {
        webAudio = new (window as any).Audio(LINKUP_NOTIFICATION_SOUND_BASE64);
        webAudio.load();
      }
    } catch {}
    window.removeEventListener('click', unlockWebAudio);
    window.removeEventListener('touchstart', unlockWebAudio);
    window.removeEventListener('keydown', unlockWebAudio);
  };
  window.addEventListener('click', unlockWebAudio, { once: true });
  window.addEventListener('touchstart', unlockWebAudio, { once: true });
  window.addEventListener('keydown', unlockWebAudio, { once: true });
}

/**
 * Checks if in-app notification sound is enabled in user preferences
 */
export async function isSoundEnabled(): Promise<boolean> {
  try {
    const stored = await LocalStorage.getItem<boolean>(STORAGE_KEY);
    return stored !== false; // Enabled by default
  } catch {
    return true;
  }
}

/**
 * Persists user notification sound preference
 */
export async function setSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await LocalStorage.setItem(STORAGE_KEY, enabled);
  } catch (err) {
    console.warn('[SoundService] Failed to persist sound preference:', err);
  }
}

/**
 * Toggles sound preference and returns the next value.
 * Plays the signature LinkUp chime when enabled.
 */
export async function toggleSoundEnabled(): Promise<boolean> {
  const current = await isSoundEnabled();
  const next = !current;
  await setSoundEnabled(next);
  if (next) {
    playLinkUpNotificationSound().catch(() => {});
  }
  return next;
}

/**
 * Plays the professional LinkUp notification chime sound.
 */
export async function playLinkUpNotificationSound(): Promise<void> {
  try {
    const enabled = await isSoundEnabled();
    if (!enabled) return;

    // Web Platform
    if (Platform.OS === 'web') {
      try {
        if (!webAudio && typeof window !== 'undefined' && (window as any).Audio) {
          webAudio = new (window as any).Audio(LINKUP_NOTIFICATION_SOUND_BASE64);
        }
        if (webAudio) {
          webAudio.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
          webAudio.currentTime = 0;
          await webAudio.play().catch((err: any) => {
            console.warn('[SoundService] Web audio play blocked by autoplay policy:', err);
          });
        }
      } catch (webErr) {
        console.warn('[SoundService] Web audio playback error:', webErr);
      }
      return;
    }

    // Native Mobile (Android & iOS) via expo-audio
    try {
      const { createAudioPlayer, setAudioModeAsync } = require('expo-audio');
      await setAudioModeAsync({
        playsInSilentMode: true,
      }).catch(() => {});

      if (!nativePlayer) {
        try {
          nativePlayer = createAudioPlayer(require('../../assets/sounds/linkup-notification.mp3'));
        } catch (assetErr) {
          nativePlayer = createAudioPlayer(LINKUP_NOTIFICATION_SOUND_BASE64);
        }
      }

      if (nativePlayer) {
        try {
          if (typeof nativePlayer.setPlaybackRate === 'function') {
            nativePlayer.setPlaybackRate(LINKUP_SOUND_PLAYBACK_RATE);
          } else {
            nativePlayer.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
          }
        } catch {}

        if (typeof nativePlayer.seekTo === 'function') {
          await nativePlayer.seekTo(0).catch(() => {});
        }
        nativePlayer.play();
      }
    } catch (nativeErr) {
      console.warn('[SoundService] Native audio playback error:', nativeErr);
    }
  } catch (err) {
    console.warn('[SoundService] Unexpected error in playLinkUpNotificationSound:', err);
  }
}

