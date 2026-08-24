package com.cobro.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.Log
import android.webkit.JavascriptInterface
import androidx.core.content.FileProvider
import com.cobro.app.printer.BluetoothPrinterManager
import com.cobro.app.printer.PrinterStatus
import com.getcapacitor.Bridge
import org.json.JSONObject
import java.io.File

/**
 * JavaScriptBridge — Puente nativo expuesto como window.Android en el frontend web.
 *
 * La impresión Bluetooth ESC/POS y el escaneo de códigos viven en plugins
 * Capacitor dedicados ("BluetoothPrinter" y "BarcodeScanner" — ver
 * plugins/BluetoothPrinterPlugin.kt y plugins/BarcodeScannerPlugin.kt), no
 * aquí, para no tener dos caminos duplicados hacia la misma funcionalidad.
 *
 * Ejemplo de uso desde CobroApp JavaScript:
 *   window.Android.openPosSettings()
 *   window.Android.vibrate(200)
 *   window.Android.getDeviceInfo()
 */
class JavaScriptBridge(
    private val context: Context,
    private val bridge: Bridge
) {

    private val printerManager: BluetoothPrinterManager by lazy {
        BluetoothPrinterManager.getInstance(context)
    }

    // ═══════════════════════════════════════════════════════════
    //  DIAGNÓSTICO TEMPORAL — DEBUG DE RENDIMIENTO
    // ═══════════════════════════════════════════════════════════
    // window.console.log/warn no está llegando a Logcat en este WebView (se
    // confirmó vacío incluso con console.error) — Log.d() nativo sí es 100%
    // confiable porque no depende de ningún puente de consola del WebView.
    // Quitar junto con las llamadas a window.Android.log(...) en el frontend
    // una vez resuelto el problema de rendimiento del POS que se está
    // diagnosticando.
    @JavascriptInterface
    fun log(message: String) {
        Log.d("PERF", message)
    }

    // ═══════════════════════════════════════════════════════════
    //  CONFIGURACIÓN POS
    // ═══════════════════════════════════════════════════════════

    /**
     * Abre la pantalla nativa de configuración POS (Jetpack Compose).
     */
    @JavascriptInterface
    fun openPosSettings() {
        bridge.activity.runOnUiThread {
            val intent = Intent(context, PosSettingsActivity::class.java)
            bridge.activity.startActivity(intent)
        }
    }

    /**
     * Verifica si Bluetooth está habilitado en el dispositivo.
     */
    @JavascriptInterface
    fun isBluetoothEnabled(): Boolean {
        return printerManager.isBluetoothEnabled()
    }

    /**
     * Solicita habilitar Bluetooth si está apagado.
     */
    @JavascriptInterface
    fun enableBluetooth() {
        printerManager.requestEnableBluetooth(bridge.activity)
    }

    // ═══════════════════════════════════════════════════════════
    //  DISPOSITIVO
    // ═══════════════════════════════════════════════════════════

    /**
     * Retorna información del dispositivo como JSON.
     */
    @JavascriptInterface
    fun getDeviceInfo(): String {
        return JSONObject().apply {
            put("manufacturer", Build.MANUFACTURER)
            put("model", Build.MODEL)
            put("androidVersion", Build.VERSION.RELEASE)
            put("sdkVersion", Build.VERSION.SDK_INT)
            put("appVersion", getAppVersion())
            put("isSunmi", isSunmiDevice())
            put("platform", "android")
        }.toString()
    }

    /**
     * Vibra el dispositivo por la duración especificada (ms).
     */
    @JavascriptInterface
    fun vibrate(duration: Long = 100) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(duration)
                }
            }
        } catch (_: Exception) {}
    }

    /**
     * Comparte contenido usando el Intent nativo de Android.
     */
    @JavascriptInterface
    fun share(title: String, text: String, url: String = "") {
        bridge.activity.runOnUiThread {
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_SUBJECT, title)
                putExtra(Intent.EXTRA_TEXT, if (url.isNotEmpty()) "$text\n$url" else text)
            }
            bridge.activity.startActivity(Intent.createChooser(intent, title))
        }
    }

    /**
     * Descarga un archivo al dispositivo.
     */
    @JavascriptInterface
    fun download(fileName: String, base64Data: String, mimeType: String) {
        try {
            val data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
            val downloadsDir = context.getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS)
            val file = File(downloadsDir, fileName)
            file.writeBytes(data)

            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, mimeType)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)

            notifyJS("cobro_download_result", mapOf("success" to true, "fileName" to fileName))
        } catch (e: Exception) {
            notifyJS("cobro_download_result", mapOf("success" to false, "error" to e.message))
        }
    }

    /**
     * Verifica si hay conexión a Internet activa.
     */
    @JavascriptInterface
    fun isOnline(): Boolean {
        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE)
            as android.net.ConnectivityManager
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS PRIVADOS
    // ═══════════════════════════════════════════════════════════

    /**
     * Dispara un CustomEvent en el JavaScript del WebView.
     * Permite comunicación nativo → JavaScript.
     */
    private fun notifyJS(eventName: String, data: Map<String, Any?>) {
        val json = JSONObject(data).toString().replace("'", "\\'")
        bridge.webView.post {
            bridge.webView.evaluateJavascript(
                """
                (function() {
                    try {
                        var detail = JSON.parse('${json.replace("\\", "\\\\")}');
                        window.dispatchEvent(new CustomEvent('$eventName', { detail: detail }));
                    } catch(e) { console.error('CobroApp Bridge error:', e); }
                })();
                """.trimIndent(),
                null
            )
        }
    }

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "2.0.0"
        } catch (_: Exception) { "2.0.0" }
    }

    private fun isSunmiDevice(): Boolean {
        return Build.MANUFACTURER.lowercase().contains("sunmi")
    }

    fun cleanup() {
        printerManager.disconnect()
    }
}
