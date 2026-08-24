package com.cobro.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * BarcodeScannerActivity — Escáner de códigos de barras usando ML Kit + CameraX.
 *
 * Se lanza desde el plugin Capacitor "BarcodeScanner"
 * (ver plugins/BarcodeScannerPlugin.kt), llamado desde JS vía
 * src/utils/barcodeScanner.ts. Al leer un código, retorna el resultado vía
 * setResult() y finaliza.
 *
 * Ventana flotante chica (no pantalla completa) — ver
 * res/values/styles.xml:AppTheme.ScannerFloating y configureFloatingWindow()
 * más abajo. La resolución real que analiza ML Kit no depende del tamaño en
 * pantalla del PreviewView — CameraX le sigue pasando frames a resolución
 * completa del sensor aunque la ventana se vea chica.
 */
class BarcodeScannerActivity : ComponentActivity() {

    private lateinit var cameraExecutor: ExecutorService
    private var scanning = true

    companion object {
        const val RESULT_CODE = "barcode"
        const val MODE_BARCODE = "barcode"
        const val MODE_QR = "qr"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val previewView = PreviewView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }

        // Botón chico para cancelar sin depender del botón atrás del sistema
        // (tocar fuera del recuadro también cancela, ver setFinishOnTouchOutside).
        val closeButton = TextView(this).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#66000000"))
            }
            layoutParams = FrameLayout.LayoutParams(dp(30), dp(30)).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = dp(8)
                marginEnd = dp(8)
            }
            setOnClickListener { finish() } // sin setResult previo → RESULT_CANCELED
        }

        val root = FrameLayout(this).apply {
            addView(previewView)
            addView(closeButton)
        }
        setContentView(root)

        // IMPORTANTE: llamar a window.setLayout/setGravity aquí mismo (antes
        // de que la ventana quede adjunta al WindowManager) no "pega" — el
        // propio framework pisa esos WindowManager.LayoutParams en su primer
        // paso de layout. post{} lo aplica un frame después, ya con la
        // ventana adjunta, que es cuando realmente se respeta.
        root.post { configureFloatingWindow() }

        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera(previewView)
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    /** Encoge y posiciona la ventana de la Activity como un recuadro flotante
     *  cerca de arriba, en vez de dejarla a pantalla completa (theme
     *  AppTheme.ScannerFloating en el manifest habilita que pueda flotar). */
    private fun configureFloatingWindow() {
        val dm = resources.displayMetrics
        val widthPx = (dm.widthPixels * 0.92).toInt()
        val heightPx = (dm.heightPixels * 0.42).toInt()

        window.apply {
            setLayout(widthPx, heightPx)
            setGravity(Gravity.TOP)
            setBackgroundDrawable(
                GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = dp(16).toFloat()
                    setColor(Color.parseColor("#0F0F1A"))
                }
            )
            attributes = attributes.apply { y = (dm.heightPixels * 0.16).toInt() }
        }
        setFinishOnTouchOutside(true)
    }

    private fun startCamera(previewView: PreviewView) {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }

            val imageAnalyzer = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
                .also {
                    it.setAnalyzer(cameraExecutor) { imageProxy ->
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

                            val scanner = BarcodeScanning.getClient()
                            scanner.process(inputImage)
                                .addOnSuccessListener { barcodes ->
                                    barcodes.firstOrNull()?.let { barcode ->
                                        val value = barcode.rawValue ?: return@let
                                        if (scanning) {
                                            scanning = false
                                            returnResult(value)
                                        }
                                    }
                                }
                                .addOnCompleteListener { imageProxy.close() }
                        } else {
                            imageProxy.close()
                        }
                    }
                }

            try {
                cameraProvider.unbindAll()
                cameraProvider.bindToLifecycle(
                    this,
                    CameraSelector.DEFAULT_BACK_CAMERA,
                    preview,
                    imageAnalyzer
                )
            } catch (e: Exception) {
                returnError("Error iniciando cámara: ${e.message}")
            }

        }, ContextCompat.getMainExecutor(this))
    }

    private fun returnResult(code: String) {
        val intent = Intent().putExtra(RESULT_CODE, code)
        setResult(Activity.RESULT_OK, intent)
        runOnUiThread { finish() }
    }

    private fun returnError(error: String) {
        val intent = Intent().putExtra("error", error)
        setResult(Activity.RESULT_CANCELED, intent)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        cameraExecutor.shutdown()
    }
}
