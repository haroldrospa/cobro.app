/**
 * Utilidad de audio para reproducir sonidos de interacción en la aplicación (UI).
 * Usa Web Audio API para generar un "click/pop" premium con cero latencia.
 */

let audioCtx: AudioContext | null = null;

export const playTapSound = () => {
    try {
        if (typeof window === 'undefined') return;

        if (!audioCtx) {
            // Inicializar AudioContext (soporte para Safari antiguo con webkit)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContextClass) return;
            audioCtx = new AudioContextClass();
        }

        // Si el contexto está suspendido (políticas del navegador), reanudarlo
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        // Sonido Premium "Tick/Pop" (similar a iOS)
        // Caída rápida de frecuencia para un sonido orgánico y percusivo
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.04);

        // Envolvente de volumen muy corta y aguda
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.005); // Ataque ultra rápido
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04); // Caída rápida

        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.05);

    } catch (e) {
        console.debug("Error playing tap sound", e);
    }
};
