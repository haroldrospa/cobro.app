package com.cobro.app.printer

import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.io.OutputStream
import java.util.UUID

/**
 * BluetoothPrinterManager — Manager singleton de conexión ESC/POS Bluetooth.
 *
 * Responsabilidades:
 * - Descubrir impresoras Bluetooth emparejadas
 * - Conectar/reconectar automáticamente
 * - Imprimir tickets ESC/POS formateados
 * - Persistir impresora predeterminada en SharedPreferences
 * - Exponer estado de la impresora en tiempo real
 */
class BluetoothPrinterManager private constructor(private val context: Context) {

    companion object {
        private const val TAG = "BluetoothPrinter"
        private const val PREFS_NAME = "cobro_printer_prefs"
        private const val PREF_DEFAULT_PRINTER_ADDRESS = "default_printer_address"
        private const val PREF_DEFAULT_PRINTER_NAME = "default_printer_name"
        private const val PREF_PAPER_WIDTH = "paper_width_mm"
        private const val PREF_AUTO_PRINT = "auto_print"
        private const val PREF_SOUND_ENABLED = "sound_enabled"
        private const val PREF_VIBRATION_ENABLED = "vibration_enabled"

        // UUID estándar para comunicación Bluetooth Serial Port Profile (SPP)
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

        // Máximo de intentos de reconexión automática
        private const val MAX_RECONNECT_ATTEMPTS = 3
        private const val RECONNECT_DELAY_MS = 2000L

        @Volatile
        private var instance: BluetoothPrinterManager? = null

        fun getInstance(context: Context): BluetoothPrinterManager {
            return instance ?: synchronized(this) {
                instance ?: BluetoothPrinterManager(context.applicationContext).also { instance = it }
            }
        }
    }

    private val bluetoothManager: BluetoothManager =
        context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    private val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter
    private val prefs: SharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val scope = CoroutineScope(Dispatchers.IO + Job())

    private var socket: BluetoothSocket? = null
    private var outputStream: OutputStream? = null
    private var currentDevice: BluetoothDevice? = null
    private var _status: PrinterStatus = PrinterStatus.DISCONNECTED
    private var reconnectAttempts = 0

    val status: PrinterStatus get() = _status

    // ═══════════════════════════════════════════════════════════
    //  ESTADO
    // ═══════════════════════════════════════════════════════════


    fun isBluetoothEnabled(): Boolean = bluetoothAdapter?.isEnabled == true

    fun requestEnableBluetooth(activity: Activity) {
        val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
        activity.startActivityForResult(intent, 3001)
    }

    // ═══════════════════════════════════════════════════════════
    //  CONFIGURACIÓN (SharedPreferences)
    // ═══════════════════════════════════════════════════════════

    fun setDefaultPrinter(address: String) {
        val name = getPairedDevices().find { it.address == address }?.name ?: address
        prefs.edit()
            .putString(PREF_DEFAULT_PRINTER_ADDRESS, address)
            .putString(PREF_DEFAULT_PRINTER_NAME, name)
            .apply()
    }

    fun getDefaultPrinterAddress(): String? = prefs.getString(PREF_DEFAULT_PRINTER_ADDRESS, null)

    fun getCurrentPrinterInfo(): BluetoothDevice? = currentDevice

    fun getPaperWidthMm(): Int = prefs.getInt(PREF_PAPER_WIDTH, 80)

    fun setPaperWidthMm(mm: Int) {
        prefs.edit().putInt(PREF_PAPER_WIDTH, mm).apply()
    }

    fun isAutoPrintEnabled(): Boolean = prefs.getBoolean(PREF_AUTO_PRINT, false)
    fun setAutoPrint(enabled: Boolean) = prefs.edit().putBoolean(PREF_AUTO_PRINT, enabled).apply()

    fun isSoundEnabled(): Boolean = prefs.getBoolean(PREF_SOUND_ENABLED, true)
    fun setSoundEnabled(enabled: Boolean) = prefs.edit().putBoolean(PREF_SOUND_ENABLED, enabled).apply()

    fun isVibrationEnabled(): Boolean = prefs.getBoolean(PREF_VIBRATION_ENABLED, true)
    fun setVibrationEnabled(enabled: Boolean) = prefs.edit().putBoolean(PREF_VIBRATION_ENABLED, enabled).apply()

    // ═══════════════════════════════════════════════════════════
    //  DISPOSITIVOS BLUETOOTH
    // ═══════════════════════════════════════════════════════════

    /**
     * Retorna la lista de impresoras Bluetooth emparejadas como JSON array.
     */
    @SuppressLint("MissingPermission")
    fun getPairedPrinters(): String {
        val devices = getPairedDevices()
        val array = org.json.JSONArray()
        devices.forEach { device ->
            array.put(JSONObject().apply {
                put("name", device.name ?: "Dispositivo desconocido")
                put("address", device.address)
                put("isDefault", device.address == getDefaultPrinterAddress())
                put("isConnected", device.address == currentDevice?.address && _status == PrinterStatus.CONNECTED)
            })
        }
        return array.toString()
    }

    @SuppressLint("MissingPermission")
    private fun getPairedDevices(): List<BluetoothDevice> {
        return try {
            bluetoothAdapter?.bondedDevices?.toList() ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  CONEXIÓN
    // ═══════════════════════════════════════════════════════════

    /**
     * Conecta a una impresora por dirección MAC.
     */
    @SuppressLint("MissingPermission")
    fun connectByAddress(address: String, callback: (Boolean, String?) -> Unit) {
        scope.launch {
            try {
                // Cerrar conexión anterior
                closeSocket()

                val device = bluetoothAdapter?.getRemoteDevice(address)
                    ?: run {
                        callback(false, "Dispositivo no encontrado: $address")
                        return@launch
                    }

                _status = PrinterStatus.CONNECTING

                val newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                bluetoothAdapter?.cancelDiscovery()

                newSocket.connect()

                socket = newSocket
                outputStream = newSocket.outputStream
                currentDevice = device
                _status = PrinterStatus.CONNECTED
                reconnectAttempts = 0

                Log.d(TAG, "✅ Conectado a: ${device.name} ($address)")
                callback(true, null)

            } catch (e: IOException) {
                Log.e(TAG, "❌ Error conectando: ${e.message}")
                _status = PrinterStatus.ERROR
                closeSocket()
                callback(false, "No se pudo conectar: ${e.message}")
            } catch (e: SecurityException) {
                Log.e(TAG, "❌ Permiso Bluetooth denegado: ${e.message}")
                _status = PrinterStatus.ERROR
                callback(false, "Permiso Bluetooth requerido")
            }
        }
    }

    /**
     * Intenta conectar automáticamente a la impresora predeterminada.
     */
    fun autoConnect(callback: ((Boolean, String?) -> Unit)? = null) {
        val address = getDefaultPrinterAddress() ?: return
        if (_status == PrinterStatus.CONNECTED) return
        connectByAddress(address) { success, error ->
            callback?.invoke(success, error)
        }
    }

    /**
     * Desconecta la impresora actual.
     */
    fun disconnect() {
        scope.launch {
            closeSocket()
            _status = PrinterStatus.DISCONNECTED
            currentDevice = null
        }
    }

    private fun closeSocket() {
        try {
            outputStream?.close()
            socket?.close()
        } catch (_: IOException) {}
        outputStream = null
        socket = null
    }

    /**
     * Verifica si la conexión está activa y reconecta si es necesario.
     */
    private suspend fun ensureConnected(): Boolean {
        if (_status == PrinterStatus.CONNECTED && socket?.isConnected == true) return true

        val address = getDefaultPrinterAddress() ?: currentDevice?.address ?: return false
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            _status = PrinterStatus.ERROR
            return false
        }

        reconnectAttempts++
        Log.d(TAG, "🔄 Reconectando (intento $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS)...")
        delay(RECONNECT_DELAY_MS)

        var connected = false
        connectByAddress(address) { success, _ -> connected = success }
        return connected
    }

    // ═══════════════════════════════════════════════════════════
    //  IMPRESIÓN
    // ═══════════════════════════════════════════════════════════

    /**
     * Envía bytes directamente a la impresora.
     */
    private suspend fun sendBytes(data: ByteArray): Boolean {
        return withContext(Dispatchers.IO) {
            try {
                val stream = outputStream ?: run {
                    if (!ensureConnected()) return@withContext false
                    outputStream ?: return@withContext false
                }
                stream.write(data)
                stream.flush()
                true
            } catch (e: IOException) {
                Log.e(TAG, "Error enviando bytes: ${e.message}")
                _status = PrinterStatus.ERROR
                false
            }
        }
    }

    /**
     * Imprime un ticket completo a partir de un JSONObject.
     *
     * Estructura esperada del JSON:
     * {
     *   businessName, logoBase64, address, rnc, phone,
     *   customer, cashier, invoiceNumber, date, time,
     *   items: [{name, qty, price, discount}],
     *   subtotal, tax, discount, total,
     *   paymentMethod, barcode, qrData
     * }
     */
    fun printTicket(ticket: JSONObject, callback: (Boolean, String?) -> Unit) {
        scope.launch {
            _status = PrinterStatus.PRINTING
            try {
                val paperWidth = if (getPaperWidthMm() == 58)
                    EscPosEncoder.PaperWidth.MM_58 else EscPosEncoder.PaperWidth.MM_80

                val encoder = EscPosEncoder(paperWidth).initialize()

                // ── Logo (si existe en Base64) ──────────────────────
                val logoBase64 = ticket.optString("logoBase64", "")
                if (logoBase64.isNotEmpty()) {
                    try {
                        val logoBytes = Base64.decode(logoBase64, Base64.DEFAULT)
                        val logoBitmap = BitmapFactory.decodeByteArray(logoBytes, 0, logoBytes.size)
                        if (logoBitmap != null) {
                            encoder.align(EscPosEncoder.Alignment.CENTER)
                            encoder.image(logoBitmap)
                            encoder.emptyLine()
                        }
                    } catch (_: Exception) {}
                }

                // ── Cabecera del negocio ─────────────────────────────
                encoder
                    .align(EscPosEncoder.Alignment.CENTER)
                    .bold(true)
                    .doubleSize(true)
                    .line(ticket.optString("businessName", "CobroApp POS"))
                    .doubleSize(false)
                    .bold(false)

                if (ticket.has("address")) {
                    encoder.line(ticket.getString("address"))
                }
                if (ticket.has("rnc")) {
                    encoder.line("RNC: ${ticket.getString("rnc")}")
                }
                if (ticket.has("phone")) {
                    encoder.line("Tel: ${ticket.getString("phone")}")
                }

                encoder.emptyLine()

                // ── Número de factura ────────────────────────────────
                encoder
                    .align(EscPosEncoder.Alignment.CENTER)
                    .bold(true)
                    .line("*** FACTURA ***")
                    .bold(false)

                // ── Datos de la transacción ──────────────────────────
                encoder.align(EscPosEncoder.Alignment.LEFT)
                encoder.separator()

                val date = ticket.optString("date", "")
                val time = ticket.optString("time", "")
                if (date.isNotEmpty()) {
                    encoder.twoColumns("Fecha:", "$date $time")
                }
                if (ticket.has("invoiceNumber")) {
                    encoder.twoColumns("No. Factura:", ticket.getString("invoiceNumber"))
                }
                if (ticket.has("customer")) {
                    encoder.twoColumns("Cliente:", ticket.getString("customer"))
                }
                if (ticket.has("cashier")) {
                    encoder.twoColumns("Cajero:", ticket.getString("cashier"))
                }

                encoder.separator()

                // ── Encabezado de productos ──────────────────────────
                encoder.bold(true)
                encoder.threeColumns("Cant", "Producto", "Precio")
                encoder.bold(false)
                encoder.separator('-')

                // ── Items del ticket ─────────────────────────────────
                val items = ticket.optJSONArray("items")
                if (items != null) {
                    for (i in 0 until items.length()) {
                        val item = items.getJSONObject(i)
                        val qty = item.optDouble("qty", 1.0)
                        val name = item.optString("name", "")
                        val price = item.optDouble("price", 0.0)
                        val discount = item.optDouble("discount", 0.0)

                        val qtyStr = if (qty == qty.toLong().toDouble()) qty.toLong().toString() else "%.2f".format(qty)
                        val priceStr = formatCurrency(price)
                        encoder.threeColumns(qtyStr, name, priceStr)

                        if (discount > 0) {
                            encoder.threeColumns("", "  Descuento:", "-${formatCurrency(discount)}")
                        }
                    }
                }

                // ── Totales ──────────────────────────────────────────
                encoder.separator()

                val subtotal = ticket.optDouble("subtotal", 0.0)
                val tax = ticket.optDouble("tax", 0.0)
                val discount = ticket.optDouble("discount", 0.0)
                val total = ticket.optDouble("total", 0.0)

                if (subtotal > 0) {
                    encoder.twoColumns("Subtotal:", formatCurrency(subtotal))
                }
                if (tax > 0) {
                    encoder.twoColumns("ITBIS (18%):", formatCurrency(tax))
                }
                if (discount > 0) {
                    encoder.twoColumns("Descuento:", "-${formatCurrency(discount)}")
                }

                encoder.bold(true)
                encoder.doubleSize(true)
                encoder.align(EscPosEncoder.Alignment.CENTER)
                encoder.line("Total: ${formatCurrency(total)}")
                encoder.doubleSize(false)
                encoder.bold(false)
                encoder.align(EscPosEncoder.Alignment.LEFT)

                // ── Método de pago ───────────────────────────────────
                if (ticket.has("paymentMethod")) {
                    encoder.separator()
                    encoder.twoColumns("Pago:", ticket.getString("paymentMethod"))
                    if (ticket.has("amountPaid")) {
                        encoder.twoColumns("Recibido:", formatCurrency(ticket.getDouble("amountPaid")))
                    }
                    if (ticket.has("change")) {
                        encoder.twoColumns("Cambio:", formatCurrency(ticket.getDouble("change")))
                    }
                }

                encoder.emptyLine()

                // ── Código QR ────────────────────────────────────────
                val qrData = ticket.optString("qrData", "")
                if (qrData.isNotEmpty()) {
                    encoder.align(EscPosEncoder.Alignment.CENTER)
                    encoder.qrCode(qrData, size = if (paperWidth == EscPosEncoder.PaperWidth.MM_58) 5 else 6)
                }

                // ── Código de barras ─────────────────────────────────
                val barcode = ticket.optString("barcode", "")
                if (barcode.isNotEmpty()) {
                    encoder.align(EscPosEncoder.Alignment.CENTER)
                    encoder.barcode128(barcode)
                }

                // ── Pie de página ────────────────────────────────────
                encoder
                    .align(EscPosEncoder.Alignment.CENTER)
                    .emptyLine()
                    .line("Gracias por su compra")
                    .line("www.cobroapp.app")
                    .emptyLine(2)

                // ── Corte de papel ───────────────────────────────────
                encoder.cut()

                // ── Enviar a la impresora ────────────────────────────
                val success = sendBytes(encoder.build())
                _status = if (success) PrinterStatus.CONNECTED else PrinterStatus.ERROR
                callback(success, if (!success) "Error al enviar datos a la impresora" else null)

            } catch (e: Exception) {
                Log.e(TAG, "Error imprimiendo ticket: ${e.message}", e)
                _status = PrinterStatus.ERROR
                callback(false, e.message)
            }
        }
    }

    /**
     * Imprime una página de prueba.
     */
    fun printTestPage(callback: (Boolean, String?) -> Unit) {
        scope.launch {
            _status = PrinterStatus.PRINTING
            val paperWidth = if (getPaperWidthMm() == 58)
                EscPosEncoder.PaperWidth.MM_58 else EscPosEncoder.PaperWidth.MM_80

            val bytes = EscPosEncoder(paperWidth)
                .initialize()
                .align(EscPosEncoder.Alignment.CENTER)
                .bold(true)
                .doubleSize(true)
                .line("COBRO APP POS")
                .doubleSize(false)
                .bold(false)
                .emptyLine()
                .separator()
                .line("Prueba de impresion")
                .line("Papel: ${getPaperWidthMm()}mm")
                .separator()
                .twoColumns("Estado:", "OK")
                .twoColumns("Conexion:", "Bluetooth")
                .twoColumns("Protocolo:", "ESC/POS")
                .twoColumns("Version:", "2.0")
                .separator()
                .align(EscPosEncoder.Alignment.CENTER)
                .qrCode("https://cobroapp.app", 4)
                .emptyLine()
                .line("www.cobroapp.app")
                .emptyLine(2)
                .cut()
                .build()

            val success = sendBytes(bytes)
            _status = if (success) PrinterStatus.CONNECTED else PrinterStatus.ERROR
            callback(success, if (!success) "Error en prueba de impresión" else null)
        }
    }

    /**
     * Abre la gaveta de efectivo.
     */
    fun openCashDrawer(callback: (Boolean, String?) -> Unit) {
        scope.launch {
            val bytes = EscPosEncoder().openDrawer().build()
            val success = sendBytes(bytes)
            callback(success, if (!success) "Error abriendo gaveta" else null)
        }
    }

    private fun formatCurrency(amount: Double): String {
        return "RD$\$${String.format("%,.2f", amount)}"
    }
}

/**
 * Estado de la impresora Bluetooth.
 */
enum class PrinterStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    PRINTING,
    ERROR
}
