import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const native = Capacitor.isNativePlatform();

window.MathGeniusTTS = {
  isNative: () => native,
  speak: async (text, options = {}) => {
    if (!native || !text) return false;
    const base = {
      text: String(text), lang: 'ar-SA', rate: 0.85,
      pitch: 1.5, volume: 1.0, queueStrategy: 0
    };
    try {
      await TextToSpeech.speak({ ...base, ...options });
      return true;
    } catch (error) {
      console.warn('Native Arabic TTS failed:', error);
      try {
        await TextToSpeech.speak({ ...base, ...options, lang: 'ar' });
        return true;
      } catch (fallbackError) {
        console.warn('Arabic TTS fallback failed:', fallbackError);
        return false;
      }
    }
  },
  stop: async () => {
    if (!native) return;
    try { await TextToSpeech.stop(); }
    catch (error) { console.warn('Could not stop native TTS:', error); }
  }
};
