package com.cobro.app.plugins

import android.graphics.Outline
import android.util.DisplayMetrics
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * BarcodeScannerPlugin — escaneo de códigos con la cámara nativa (CameraX +
 * ML Kit) INCRUSTADA directamente sobre un <div> del WebView — no una
 * Activity ni ventana aparte. El JS mide su recuadro con
 * getBoundingClientRect() (ver BarcodeScannerPanel.tsx) y manda esas
 * coordenadas; acá se agrega un PreviewView como hermano del WebView, en la
 * misma jerarquía de vistas nativas, posicionado con esas coordenadas
 * (x/y absolutos vía View.x/View.y, tamaño vía LayoutParams) — así queda
 * dibujado exactamente encima de ese rectángulo, con el WebView (y el resto
 * de la UI de la app) alrededor sin taparse.
 *
 * Cada código detectado se manda a JS como evento ("barcodeScanned"), no
 * como resultado de una sola llamada — para eso está pensado el escaneo
 * continuo: JS decide cuándo aceptar cada código (por ejemplo con un
 * cooldown para no repetir el mismo código si sigue en cuadro).
 *
 * Uso desde JavaScript (ver src/utils/barcodeScanner.ts):
 *   await Plugins.BarcodeScanner.startEmbedded({ x, y, width, height, radius })
 *   Plugins.BarcodeScanner.addListener('barcodeScanned', ({ code }) => ...)
 *   await Plugins.BarcodeScanner.stopEmbedded()
 */
@CapacitorPlugin(name = "BarcodeScanner")
class BarcodeScannerPlugin : Plugin() {

    private var previewView: PreviewView? = null
    private var cameraExecutor: ExecutorService? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private var scanning = false

    private var lastNotifiedCode: String? = null
    private var lastNotifiedAtMs = 0L

    @PluginMethod
    fun startEmbedded(call: PluginCall) {
        val x = call.getDouble("x") ?: 0.0
        val y = call.getDouble("y") ?: 0.0
        val width = call.getDouble("width") ?: 0.0
        val height = call.getDouble("height") ?: 0.0
        val radius = call.getDouble("radius") ?: 0.0

        if (width <= 0 || height <= 0) {
            call.reject("width/height inválidos")
            return
        }

        activity.runOnUiThread {
            attachPreview(x, y, width, height, radius)
        }
        call.resolve()
    }

    @PluginMethod
    fun stopEmbedded(call: PluginCall) {
        activity.runOnUiThread { detachPreview() }
        call.resolve()
    }

    override fun handleOnDestroy() {
        activity.runOnUiThread { detachPreview() }
    }

    private fun attachPreview(xDp: Double, yDp: Double, wDp: Double, hDp: Double, radiusDp: Double) {
        detachPreview() // por si ya había una vista/cámara activa de una apertura anterior

        val density = context.resources.displayMetrics.density
        val webView = bridge.webView
        val parent = webView.parent as? ViewGroup ?: return

        val pv = PreviewView(context)
        previewView = pv

        val radiusPx = (radiusDp * density)
        pv.outlineProvider = object : ViewOutlineProvider() {
            override fun getOutline(view: View, outline: Outline) {
                outline.setRoundRect(0, 0, view.width, view.height, radiusPx.toFloat())
            }
        }
        pv.clipToOutline = true

        parent.addView(pv, ViewGroup.LayoutParams((wDp * density).toInt(), (hDp * density).toInt()))
        pv.x = (xDp * density).toFloat()
        pv.y = (yDp * density).toFloat()

        startCamera(pv)
    }

    private fun detachPreview() {
        scanning = false
        cameraProvider?.unbindAll()
        cameraProvider = null
        previewView?.let { (it.parent as? ViewGroup)?.removeView(it) }
        previewView = null
        cameraExecutor?.shutdown()
        cameraExecutor = null
        lastNotifiedCode = null
    }

    private fun startCamera(previewView: PreviewView) {
        scanning = true
        val executor = Executors.newSingleThreadExecutor()
        cameraExecutor = executor

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            if (!scanning) return@addListener // se canceló mientras cargaba

            val provider = cameraProviderFuture.get()
            cameraProvider = provider

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(executor) { imageProxy ->
                        if (!scanning) {
                            imageProxy.close()
                            return@setAnalyzer
                        }

                        val mediaImage = imageProxy.image
                        if (mediaImage != null) {
                            val inputImage = InputImage.fromMediaImage(
                                mediaImage,
                                imageProxy.imageInfo.rotationDegrees
                            )

                            BarcodeScanning.getClient().process(inputImage)
                                .addOnSuccessListener { barcodes ->
                                    barcodes.firstOrNull()?.rawValue?.let { value ->
                                        if (scanning) onCodeDetected(value)
                                    }
                                }
                                .addOnCompleteListener { imageProxy.close() }
                        } else {
                            imageProxy.close()
                        }
                    }
                }

            try {
                provider.unbindAll()
                provider.bindToLifecycle(
                    activity as LifecycleOwner,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalyzer
                )
            } catch (e: Exception) {
                notifyListeners("barcodeScanError", JSObject().put("message", e.message))
            }
        }, ContextCompat.getMainExecutor(context))
    }

    /** ML Kit analiza varios frames por segundo — evita mandar el mismo
     *  código repetido a JS mientras sigue dentro de cuadro. */
    private fun onCodeDetected(code: String) {
        val now = System.currentTimeMillis()
        if (code == lastNotifiedCode && now - lastNotifiedAtMs < 1500) return
        lastNotifiedCode = code
        lastNotifiedAtMs = now
        notifyListeners("barcodeScanned", JSObject().put("code", code))
    }
}
