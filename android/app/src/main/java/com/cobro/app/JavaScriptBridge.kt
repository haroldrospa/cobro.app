package com.cobro.app

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
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
 * Ejemplo de uso desde CobroApp JavaScript:
 *   window.Android.printTicket(JSON.stringify(ticket))
 *   window.Android.scanBarcode()
 *   window.Android.openCashDrawer()
 *   window.Android.getPrinterStatus()
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
    //  IMPRESIÓN BLUETOOTH ESC/POS
    // ═══════════════════════════════════════════════════════════

    /**
     * Imprime un ticket ESC/POS directamente en la impresora Bluetooth.
     *
     * @param ticketJson JSON con la estructura del ticket:
     * {
     *   "businessName": "Mi Negocio",
     *   "address": "Calle Principal #1",
     *   "rnc": "123456789",
     *   "phone": "809-000-0000",
     *   "customer": "Juan Pérez",
     *   "cashier": "Admin",
     *   "invoiceNumber": "001-001-0000001",
     *   "date": "2024-01-15",
     *   "time": "10:30 AM",
     *   "items": [{ "name": "Producto", "qty": 2, "price": 100.00, "discount": 0 }],
     *   "subtotal": 200.00,
     *   "tax": 30.00,
     *   "discount": 0,
     *   "total": 230.00,
     *   "paymentMethod": "Efectivo",
     *   "barcode": "0000000001",
     *   "qrData": "https://cobroapp.app/inv/001"
     * }
     */
    @JavascriptInterface
    fun printTicket(ticketJson: String) {
        try {
            val ticket = JSONObject(ticketJson)
            printerManager.printTicket(ticket) { success, error ->
                notifyJS(
                    "cobro_print_result",
                    mapOf("success" to success, "error" to (error ?: ""))
                )
            }
        } catch (e: Exception) {
            notifyJS("cobro_print_result", mapOf("success" to false, "error" to e.message))
        }
    }

    /**
     * Imprime una página de prueba para verificar la conexión con la impresora.
     */
    @JavascriptInterface
    fun printTestPage() {
        printerManager.printTestPage { success, error ->
            notifyJS("cobro_print_result", mapOf("success" to success, "error" to (error ?: "")))
        }
    }

    /**
     * Conecta a una impresora Bluetooth por dirección MAC.
     */
    @JavascriptInterface
    fun connectPrinter(address: String) {
        printerManager.connectByAddress(address) { success, error ->
            notifyJS(
                "cobro_printer_connected",
                mapOf("success" to success, "address" to address, "error" to (error ?: ""))
            )
        }
    }

    /**
     * Desconecta la impresora actual.
     */
    @JavascriptInterface
    fun disconnectPrinter() {
        printerManager.disconnect()
        notifyJS("cobro_printer_connected", mapOf("success" to false, "address" to ""))
    }

    /**
     * Retorna el estado actual de la impresora como JSON string.
     * {"status": "CONNECTED"|"DISCONNECTED"|"PRINTING"|"ERROR", "printerName": "XPrinter-...", "address": "..."}
     */
    @JavascriptInterface
    fun getPrinterStatus(): String {
        val info = printerManager.getCurrentPrinterInfo()
        return JSONObject().apply {
            put("status", printerManager.status.name)
            put("printerName", info?.name ?: "")
            put("address", info?.address ?: "")
        }.toString()
    }

    /**
     * Retorna la lista de impresoras Bluetooth emparejadas.
     * Retorna JSON array: [{"name": "XPrinter", "address": "00:11:22:33:44:55"}, ...]
     */
    @JavascriptInterface
    fun getPairedPrinters(): String {
        return printerManager.getPairedPrinters()
    }

    /**
     * Selecciona una impresora como predeterminada y se conecta.
     */
    @JavascriptInterface
    fun selectPrinter(address: String) {
        printerManager.setDefaultPrinter(address)
        connectPrinter(address)
    }

    /**
     * Abre la gaveta de efectivo vía señal ESC/POS.
     */
    @JavascriptInterface
    fun openCashDrawer() {
        printerManager.openCashDrawer { success, error ->
            notifyJS("cobro_drawer_result", mapOf("success" to success, "error" to (error ?: "")))
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  ESCÁNER DE CÓDIGOS DE BARRAS
    // ═══════════════════════════════════════════════════════════

    /**
     * Abre el escáner de cámara para leer códigos de barras.
     * Cuando lee un código, dispara el evento 'cobro_barcode' en el frontend.
     */
    @JavascriptInterface
    fun scanBarcode() {
        bridge.activity.runOnUiThread {
            val intent = Intent(context, BarcodeScannerActivity::class.java).apply {
                putExtra("mode", "barcode")
            }
            bridge.activity.startActivityForResult(intent, SCANNER_REQUEST_CODE)
        }
    }

    /**
     * Abre el escáner de cámara para leer códigos QR.
     */
    @JavascriptInterface
    fun scanQRCode() {
        bridge.activity.runOnUiThread {
            val intent = Intent(context, BarcodeScannerActivity::class.java).apply {
                putExtra("mode", "qr")
            }
            bridge.activity.startActivityForResult(intent, QR_REQUEST_CODE)
        }
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

    companion object {
        const val SCANNER_REQUEST_CODE = 2001
        const val QR_REQUEST_CODE = 2002
    }
}
