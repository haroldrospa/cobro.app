// Wrapper tipado sobre el plugin nativo Capacitor "BarcodeScanner"
// (android/app/src/main/java/com/cobro/app/plugins/BarcodeScannerPlugin.kt),
// que incrusta la cámara nativa (CameraX + ML Kit) directamente sobre un
// <div> del WebView (ver BarcodeScannerPanel.tsx) — no una Activity ni
// ventana aparte — y reconoce códigos de barras y QR sin restricción de
// formato.
//
// Solo funciona dentro de la app nativa de Android — ver isAndroidNative()
// en src/utils/platform.ts.

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export interface BarcodeScanResult {
  code: string;
  cancelled: boolean;
}

/** Rectángulo destino en píxeles CSS, tal cual lo entrega
 *  getBoundingClientRect() — el lado nativo lo convierte a px físicos. */
export interface EmbeddedScanRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Radio de esquina (px CSS) para recortar la vista de cámara nativa a
   *  juego con el `rounded-xl` del recuadro. */
  radius?: number;
}

interface BarcodeScannerNativePlugin {
  scan(options: { mode?: 'barcode' | 'qr' }): Promise<BarcodeScanResult>;
  startEmbedded(options: EmbeddedScanRect): Promise<void>;
  stopEmbedded(): Promise<void>;
  addListener(
    eventName: 'barcodeScanned',
    listenerFunc: (data: { code: string }) => void
  ): Promise<PluginListenerHandle> & PluginListenerHandle;
}

const BarcodeScannerNative = registerPlugin<BarcodeScannerNativePlugin>('BarcodeScanner');

/**
 * Abre el escáner nativo de pantalla completa (Activity aparte) y espera a
 * que el usuario escanee un código o cancele. No se usa desde
 * BarcodeScannerPanel (que usa el modo incrustado, ver abajo) — queda
 * disponible por si algún flujo puntual necesita un scan de una sola vez.
 */
export async function scanWithNativeCamera(): Promise<string | null> {
  const result = await BarcodeScannerNative.scan({ mode: 'barcode' });
  return result.cancelled || !result.code ? null : result.code;
}

/**
 * Incrusta la vista de cámara nativa exactamente sobre el rectángulo dado
 * (coordenadas de getBoundingClientRect() del recuadro placeholder en el
 * DOM). Queda escaneando en continuo — los códigos detectados llegan vía
 * onBarcodeScanned(), no como resultado de esta promesa.
 */
export function startEmbeddedNativeScan(rect: EmbeddedScanRect): Promise<void> {
  return BarcodeScannerNative.startEmbedded(rect);
}

/** Quita la vista de cámara nativa y libera la cámara. */
export function stopEmbeddedNativeScan(): Promise<void> {
  return BarcodeScannerNative.stopEmbedded();
}

/** Se dispara con cada código detectado mientras el escaneo incrustado está
 *  activo. Devuelve el handle para des-suscribirse (handle.remove()). */
export function onBarcodeScanned(callback: (code: string) => void): Promise<PluginListenerHandle> & PluginListenerHandle {
  return BarcodeScannerNative.addListener('barcodeScanned', (data) => callback(data.code));
}
