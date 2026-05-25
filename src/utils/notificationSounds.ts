// Advanced notification sound generator using Web Audio API
// Generates high-quality synthesized sounds instead of using base64 WAV files

export type NotificationSoundType = 'chime' | 'bell' | 'ding' | 'alert';

export const soundLabels: Record<NotificationSoundType, string> = {
  chime: 'Campanilla',
  bell: 'Campana',
  ding: 'Ding',
  alert: 'Alerta',
};

/**
 * Generates a pleasant chime sound using Web Audio API
 */
const generateChime = (context: AudioContext, volume: number): void => {
  const now = context.currentTime;

  // Create oscillators for a two-tone chime
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gainNode = context.createGain();

  // Set frequencies (C5 and E5 for a pleasant interval)
  osc1.frequency.setValueAtTime(523.25, now); // C5
  osc2.frequency.setValueAtTime(659.25, now); // E5

  // Use sine wave for smooth, pleasant tone
  osc1.type = 'sine';
  osc2.type = 'sine';

  // Configure envelope (ADSR)
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01); // Attack
  gainNode.gain.exponentialRampToValueAtTime(volume * 0.1, now + 0.3); // Decay
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6); // Release

  // Connect nodes
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(context.destination);

  // Start and stop
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.7);
  osc2.stop(now + 0.7);
};

/**
 * Generates a bell sound
 */
const generateBell = (context: AudioContext, volume: number): void => {
  const now = context.currentTime;

  // Create multiple oscillators for rich bell tone
  const fundamental = context.createOscillator();
  const harmonic1 = context.createOscillator();
  const harmonic2 = context.createOscillator();
  const gainNode = context.createGain();

  // Bell frequencies (fundamental + harmonics)
  fundamental.frequency.setValueAtTime(440, now); // A4
  harmonic1.frequency.setValueAtTime(880, now); // A5
  harmonic2.frequency.setValueAtTime(1320, now); // E6

  fundamental.type = 'sine';
  harmonic1.type = 'sine';
  harmonic2.type = 'sine';

  // Bell envelope - sharp attack, long decay
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.5, now + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.2);

  // Create gain nodes for harmonics
  const gain1 = context.createGain();
  const gain2 = context.createGain();
  gain1.gain.value = 0.3;
  gain2.gain.value = 0.15;

  // Connect
  fundamental.connect(gainNode);
  harmonic1.connect(gain1).connect(gainNode);
  harmonic2.connect(gain2).connect(gainNode);
  gainNode.connect(context.destination);

  // Play
  fundamental.start(now);
  harmonic1.start(now);
  harmonic2.start(now);
  fundamental.stop(now + 1.3);
  harmonic1.stop(now + 1.3);
  harmonic2.stop(now + 1.3);
};

/**
 * Generates a short, pleasant ding
 */
const generateDing = (context: AudioContext, volume: number): void => {
  const now = context.currentTime;

  const osc = context.createOscillator();
  const gainNode = context.createGain();

  // High, pleasant frequency
  osc.frequency.setValueAtTime(1046.5, now); // C6
  osc.type = 'sine';

  // Short, crisp envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.4, now + 0.005);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

  osc.connect(gainNode);
  gainNode.connect(context.destination);

  osc.start(now);
  osc.stop(now + 0.5);
};

/**
 * Generates an alert sound (more urgent)
 */
const generateAlert = (context: AudioContext, volume: number): void => {
  const now = context.currentTime;

  // Create oscillators for urgent two-tone alert
  const osc1 = context.createOscillator();
  const osc2 = context.createOscillator();
  const gainNode = context.createGain();

  // Alternating frequencies for urgency
  osc1.frequency.setValueAtTime(800, now);
  osc1.frequency.setValueAtTime(600, now + 0.15);
  osc1.frequency.setValueAtTime(800, now + 0.3);

  osc2.frequency.setValueAtTime(600, now);
  osc2.frequency.setValueAtTime(800, now + 0.15);
  osc2.frequency.setValueAtTime(600, now + 0.3);

  osc1.type = 'square';
  osc2.type = 'square';

  // Pulsing envelope
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
  gainNode.gain.setValueAtTime(volume * 0.3, now + 0.14);
  gainNode.gain.setValueAtTime(0, now + 0.15);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.16);
  gainNode.gain.setValueAtTime(volume * 0.3, now + 0.29);
  gainNode.gain.setValueAtTime(0, now + 0.3);
  gainNode.gain.linearRampToValueAtTime(volume * 0.3, now + 0.31);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(context.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.6);
  osc2.stop(now + 0.6);
};

/**
 * Main function to play notification sounds
 */
export const playNotificationSound = (
  soundType: NotificationSoundType = 'chime',
  enabled: boolean = true,
  volume: number = 0.7
): void => {
  if (!enabled) return;

  try {
    // Create audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContext();

    // Normalize volume
    const normalizedVolume = Math.max(0, Math.min(1, volume));

    // Generate the appropriate sound
    switch (soundType) {
      case 'chime':
        generateChime(context, normalizedVolume);
        break;
      case 'bell':
        generateBell(context, normalizedVolume);
        break;
      case 'ding':
        generateDing(context, normalizedVolume);
        break;
      case 'alert':
        generateAlert(context, normalizedVolume);
        break;
      default:
        generateChime(context, normalizedVolume);
    }
  } catch (e) {
    console.warn('Could not play notification sound:', e);
  }
};
