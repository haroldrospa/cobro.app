// Helper de plataforma compartido — evita que cada wrapper de plugin nativo
// (impresora Bluetooth, escáner de código de barras, etc.) reimplemente su
// propia detección de Android nativo.
import { Capacitor } from '@capacitor/core';

/** true solo dentro de la app nativa de Android empaquetada con Capacitor. */
export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}
