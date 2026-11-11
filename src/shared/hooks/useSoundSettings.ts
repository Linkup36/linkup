import { useState, useEffect } from "react";
import { toast } from "sonner";

const STORAGE_KEY = "linkup_sound_enabled";
export const LINKUP_SOUND_PLAYBACK_RATE = 1.25; // 1.25x speed (snappy, energetic & natural)

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
let audioElement: HTMLAudioElement | null = null;

const initAudio = () => {
  if (audioCtx || audioElement) return;
  
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      audioElement = new Audio("/sounds/linkup-notification.mp3");
      audioElement.crossOrigin = "anonymous";
      audioElement.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
      
      const track = audioCtx.createMediaElementSource(audioElement);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 2.0; // 200% volume
      
      track.connect(gainNode).connect(audioCtx.destination);
    } else {
      // Fallback for older browsers
      audioElement = new Audio("/sounds/linkup-notification.mp3");
      audioElement.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
      audioElement.volume = 1.0;
    }
  } catch (error) {
    console.warn("Failed to initialize audio:", error);
    if (!audioElement) {
      audioElement = new Audio("/sounds/linkup-notification.mp3");
      audioElement.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
    }
  }
};

// Auto-unlock Web Audio on first user interaction so async background websocket events can play sound
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    initAudio();
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    window.removeEventListener("click", unlockAudio);
    window.removeEventListener("touchstart", unlockAudio);
    window.removeEventListener("keydown", unlockAudio);
  };
  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("touchstart", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
}

export function useSoundSettings() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== "false"; // Enabled by default unless explicitly disabled
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(soundEnabled));
  }, [soundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const newState = !prev;
      
      if (newState) {
        initAudio();
        
        if (audioCtx && audioCtx.state === 'suspended') {
          audioCtx.resume().catch(e => console.warn("Failed to resume audio context:", e));
        }

        if (audioElement) {
          audioElement.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
          audioElement.currentTime = 0;
          audioElement.play().catch(error => {
            console.warn("Failed to play audio:", error);
          });
        }
        
        toast.success("Notification sounds enabled!");
      } else {
        toast.info("Notification sounds muted");
      }
      
      return newState;
    });
  };

  return { soundEnabled, toggleSound };
}

export const playNotificationSound = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== "false") {
      initAudio();
      
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      
      if (audioElement) {
        audioElement.playbackRate = LINKUP_SOUND_PLAYBACK_RATE;
        audioElement.currentTime = 0;
        audioElement.play().catch(err => {
          console.warn("[SoundSettings] Audio play blocked or failed:", err);
        });
      }
    }
  } catch { }
};
