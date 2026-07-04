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

/**
 * Inicia los listeners globales para que la aplicación suene
 * al tocar botones, enlaces, tarjetas interactivas o al escribir.
 */
export const initGlobalAudio = () => {
    if (typeof window === 'undefined') return;

    // Prevenir reproducción doble por toques rápidos
    let lastPlayTime = 0;

    const handleInteraction = (e: Event) => {
        const now = Date.now();
        if (now - lastPlayTime < 30) return; // Debounce ultracorto

        // Analizar si el evento viene de un teclado o de un toque
        if (e.type === 'keydown') {
            const keyEvent = e as KeyboardEvent;
            // No sonar en teclas silenciosas (Shift, Ctrl, Alt, Meta)
            if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(keyEvent.key)) {
                return;
            }
            playTapSound();
            lastPlayTime = now;
            return;
        }

        // Para clicks/pointerdown, verificar si se tocó un elemento interactivo
        const target = e.target as HTMLElement;
        const isInteractive = target.closest('button') || 
                              target.closest('a') || 
                              target.closest('input') || 
                              target.closest('select') || 
                              target.closest('[role="button"]') ||
                              target.closest('.cursor-pointer') ||
                              getComputedStyle(target).cursor === 'pointer';

        if (isInteractive) {
            playTapSound();
            lastPlayTime = now;
        }
    };

    // Usar pointerdown para una respuesta táctil instantánea sin esperar al evento 'click'
    window.addEventListener('pointerdown', handleInteraction, { passive: true });
    window.addEventListener('keydown', handleInteraction, { passive: true });
};
