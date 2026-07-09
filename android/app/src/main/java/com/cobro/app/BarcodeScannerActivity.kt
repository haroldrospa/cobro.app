package com.cobro.app

import android.app.Activity
import android.content.Intent
import android.os.Bundle
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
 * Se lanza desde JavaScriptBridge.scanBarcode() o scanQRCode().
 * Al leer un código, retorna el resultado vía setResult() y finaliza.
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

        // Layout simple con PreviewView a pantalla completa
        val previewView = PreviewView(this)
        setContentView(previewView)

        cameraExecutor = Executors.newSingleThreadExecutor()
        startCamera(previewView)
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
