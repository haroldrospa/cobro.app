/**
 * Utilidad de audio para reproducir sonidos de interacción en la aplicación (UI).
 * Usa un sonido base64 para evitar dependencias externas o problemas de carga de red.
 */

// Sonido sutil de "Tick/Tap" muy corto.
const tapSoundBase64 = "data:audio/wav;base64,UklGRlIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTEAAAAAAQICAgICBAQEBAQEBgYGBgYICAkJCQkKCQkJCQkJCQkJCQkJBwYEBAMCAQAAAA==";

let tapAudio: HTMLAudioElement | null = null;

export const playTapSound = () => {
    try {
        if (typeof window === 'undefined') return;
        
        if (!tapAudio) {
            tapAudio = new Audio(tapSoundBase64);
            // Ajustar volumen para que sea muy sutil y no moleste
            tapAudio.volume = 0.4;
        }

        // Si ya está reproduciendo, reiniciar para permitir múltiples toques rápidos
        tapAudio.currentTime = 0;
        
        // El navegador requiere interacción previa del usuario para reproducir audio, 
        // pero como esto se llama en un evento onClick, siempre funcionará.
        const playPromise = tapAudio.play();
        
        if (playPromise !== undefined) {
            playPromise.catch((error) => {
                // Silenciar errores (ej. auto-play restrictions si se llama programáticamente sin click)
                console.debug("Audio play blocked by browser:", error);
            });
        }
    } catch (e) {
        console.debug("Error playing tap sound", e);
    }
};
