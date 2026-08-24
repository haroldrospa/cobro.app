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
    fun connectByAddress(address: String, callback: (Boolean, String?) -> Unit) {
        scope.launch {
            val (success, error) = doConnect(address)
            callback(success, error)
        }
    }

    /**
     * Lógica de conexión real, como suspend function — la usa tanto
     * connectByAddress (callback público) como sendBytes (reintento interno
     * tras un envío fallido, ver más abajo). Antes esto vivía solo dentro de
     * connectByAddress con callback, y ensureConnected() intentaba
     * reutilizarlo lanzando OTRA corrutina con scope.launch y leyendo el
     * resultado de inmediato — como esa corrutina corre en paralelo, casi
     * siempre devolvía "false" antes de que la conexión real terminara. Con
     * suspend function directa ese bug de concurrencia desaparece solo.
     */
    @SuppressLint("MissingPermission")
    private suspend fun doConnect(address: String): Pair<Boolean, String?> {
        return try {
            closeSocket()

            val device = bluetoothAdapter?.getRemoteDevice(address)
                ?: return false to "Dispositivo no encontrado: $address"

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
            true to null

        } catch (e: IOException) {
            Log.e(TAG, "❌ Error conectando: ${e.message}")
            _status = PrinterStatus.ERROR
            closeSocket()
            false to "No se pudo conectar: ${e.message}"
        } catch (e: SecurityException) {
            Log.e(TAG, "❌ Permiso Bluetooth denegado: ${e.message}")
            _status = PrinterStatus.ERROR
            false to "Permiso Bluetooth requerido"
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

    // ═══════════════════════════════════════════════════════════
    //  IMPRESIÓN
    // ═══════════════════════════════════════════════════════════

    /**
     * Envía bytes directamente a la impresora. Si falla, reconecta una vez
     * y reintenta antes de rendirse — muchas impresoras térmicas ESC/POS
     * baratas cierran la conexión Bluetooth del otro lado después de cada
     * trabajo (o tras un rato inactivas), y `BluetoothSocket.isConnected`
     * en el lado local no siempre se entera a tiempo: el socket se ve
     * "conectado" hasta que de verdad se intenta escribir, momento en el
     * que falla con IOException ("Broken pipe" / "socket might closed").
     */
    private suspend fun sendBytes(data: ByteArray): Boolean {
        return withContext(Dispatchers.IO) {
            if (writeOnce(data)) return@withContext true

            val address = currentDevice?.address ?: getDefaultPrinterAddress()
            if (address != null && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++
                Log.d(TAG, "🔄 Envío falló, reconectando y reintentando (intento $reconnectAttempts/$MAX_RECONNECT_ATTEMPTS)...")
                val (reconnected, _) = doConnect(address)
                if (reconnected) return@withContext writeOnce(data)
            }
            false
        }
    }

    /** Un solo intento de escritura, sin reconectar. */
    private fun writeOnce(data: ByteArray): Boolean {
        return try {
            val stream = outputStream ?: return false
            stream.write(data)
            stream.flush()
            true
        } catch (e: IOException) {
            Log.e(TAG, "Error enviando bytes: ${e.message}")
            _status = PrinterStatus.ERROR
            closeSocket()
            false
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
     *
     * Se compone íntegramente con texto ESC/POS (fuente propia de la
     * impresora, nítida a cualquier resolución) — se probó también un
     * camino de "imagen completa" (renderizar la vista previa web entera y
     * mandarla como bitmap) para que el ticket impreso matcheara pixel a
     * pixel la vista previa con cajas de bordes reales, pero a 58mm
     * (~168 DPI reales) el texto chico salía consistentemente borroso al
     * convertir a blanco/negro, sin importar cuánto se ajustaran tamaños o
     * dithering — se descartó a pedido del usuario en favor de este
     * camino de texto, que sí es nítido y aprovecha bien el papel. El logo
     * es la excepción: sigue siendo una imagen (ver más abajo), la única
     * parte que consistentemente salió bien con ese enfoque.
     */
    fun printTicket(ticket: JSONObject, callback: (Boolean, String?) -> Unit) {
        scope.launch {
            _status = PrinterStatus.PRINTING
            try {
                // El ancho de papel puede venir en el propio ticket (para no
                // quedar desincronizado de la config de la app: 58/80/A4/Carta);
                // si no viene, se usa el guardado en SharedPreferences.
                val paperWidthMm = ticket.optInt("paperWidthMm", getPaperWidthMm())
                val paperWidth = if (paperWidthMm == 58)
                    EscPosEncoder.PaperWidth.MM_58 else EscPosEncoder.PaperWidth.MM_80

                val encoder = EscPosEncoder(paperWidth).initialize()
                printComposedTextTicket(encoder, ticket, paperWidth)

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
     * Compone el ticket línea por línea con comandos de texto ESC/POS
     * (bordes simulados con "=", negrita, doble tamaño, etc.) — ver el
     * comentario de printTicket() sobre por qué se usa texto nativo en vez
     * de renderizar la vista previa como imagen.
     */
    private fun printComposedTextTicket(
        encoder: EscPosEncoder,
        ticket: JSONObject,
        paperWidth: EscPosEncoder.PaperWidth
    ) {
        val lineWidth = paperWidth.charsPerLine

        // ── Logo (si existe en Base64) ──────────────────────
        val logoBase64 = ticket.optString("logoBase64", "")
        if (logoBase64.isNotEmpty()) {
            try {
                val logoBytes = Base64.decode(logoBase64, Base64.DEFAULT)
                val logoBitmap = BitmapFactory.decodeByteArray(logoBytes, 0, logoBytes.size)
                if (logoBitmap != null) {
                    encoder.align(EscPosEncoder.Alignment.CENTER)
                    // Centrado, bien por debajo de ancho completo para que
                    // no se vea desproporcionado — pero más grande que
                    // antes (0.5) a pedido del usuario.
                    encoder.image(logoBitmap, widthFraction = 0.65)
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

        // ── Caja de NCF / Comprobante — misma idea que la tarjeta
        // con borde de la vista previa web (Ajustes > Facturación):
        // electrónica vs regular cambia el rótulo, y más abajo
        // decide QR vs código de barras. El ESC/POS no tiene bordes
        // redondeados, así que se simula con una línea de "=".
        val isElectronic = ticket.optBoolean("isElectronic", false)
        val ncfLabel = if (isElectronic) "COMPROBANTE ELECTRONICO (e-NCF)" else "NCF / COMPROBANTE FISCAL"
        val boxBorder = "=".repeat(lineWidth)
        encoder.align(EscPosEncoder.Alignment.CENTER)
        encoder.line(boxBorder)
        encoder.bold(true)
        encoder.line(ncfLabel)
        if (ticket.has("invoiceNumber")) {
            encoder.doubleSize(true)
            encoder.line(ticket.getString("invoiceNumber"))
            encoder.doubleSize(false)
        }
        encoder.bold(false)
        encoder.line(boxBorder)

        // ── Datos de la transacción ──────────────────────────
        encoder.align(EscPosEncoder.Alignment.LEFT)

        val date = ticket.optString("date", "")
        val time = ticket.optString("time", "")
        if (date.isNotEmpty()) {
            encoder.twoColumns("Fecha:", "$date $time")
        }
        if (ticket.has("customer")) {
            encoder.twoColumns("Cliente:", ticket.getString("customer"))
        }
        if (ticket.has("cashier")) {
            encoder.twoColumns("Cajero:", ticket.getString("cashier"))
        }

        encoder.separator()

        // ── Encabezado de productos: "Articulos/Cant." | "Total",
        // igual que la vista previa (antes decía Cant/Producto/Precio
        // en 3 columnas con el PRECIO UNITARIO — ahora el importe de
        // la derecha es el TOTAL de la línea, y el precio unitario
        // baja a una sublínea chica "qty x precio", como la
        // insignia gris de la vista previa).
        encoder.bold(true)
        encoder.twoColumns("Articulos / Cant.", "Total")
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
                // El total de línea viene precalculado desde la app
                // (respeta descuentos por ítem); si no viene, qty×precio.
                val lineTotal = item.optDouble("total", qty * price)
                val discount = item.optDouble("discount", 0.0)

                val qtyStr = if (qty == qty.toLong().toDouble()) qty.toLong().toString() else "%.2f".format(qty)

                encoder.bold(true)
                encoder.twoColumns(name, formatCurrency(lineTotal))
                encoder.bold(false)
                encoder.smallFont(true)
                encoder.line("  $qtyStr x ${formatCurrency(price)}")
                encoder.smallFont(false)

                if (discount > 0) {
                    encoder.twoColumns("  Descuento:", "-${formatCurrency(discount)}")
                }
            }
        }

        // ── Totales ──────────────────────────────────────────
        encoder.separator()

        val subtotal = ticket.optDouble("subtotal", 0.0)
        val tax = ticket.optDouble("tax", 0.0)
        val taxRatePercent = ticket.optDouble("taxRatePercent", 18.0)
        val discount = ticket.optDouble("discount", 0.0)
        val total = ticket.optDouble("total", 0.0)

        if (subtotal > 0) {
            encoder.twoColumns("Subtotal:", formatCurrency(subtotal))
        }
        if (tax > 0) {
            val taxRateStr = if (taxRatePercent == taxRatePercent.toLong().toDouble())
                taxRatePercent.toLong().toString() else "%.2f".format(taxRatePercent)
            encoder.twoColumns("ITBIS ($taxRateStr%):", formatCurrency(tax))
        }
        if (discount > 0) {
            encoder.twoColumns("Descuento:", "-${formatCurrency(discount)}")
        }

        // Barra de TOTAL en video invertido (fondo negro / texto
        // blanco) — el equivalente ESC/POS de la barra negra de la
        // vista previa. Si la impresora no soporta GS B, simplemente
        // lo ignora y queda en negro sobre blanco normal (igual se
        // ve bien por el bold + doble tamaño).
        encoder.align(EscPosEncoder.Alignment.CENTER)
        encoder.invert(true)
        encoder.bold(true)
        encoder.doubleSize(true)
        encoder.line(" TOTAL ${formatCurrency(total)} ")
        encoder.doubleSize(false)
        encoder.bold(false)
        encoder.invert(false)
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

        // ── QR (electrónica, verificable por la DGII) o código de
        // barras (NCF regular) — nunca los dos, mismo criterio que
        // generateCleanInvoiceHTML.ts y la vista previa de Ajustes.
        val qrData = ticket.optString("qrData", "")
        val barcode = ticket.optString("barcode", "")
        if (qrData.isNotEmpty()) {
            encoder.align(EscPosEncoder.Alignment.CENTER)
            encoder.qrCode(qrData, size = if (paperWidth == EscPosEncoder.PaperWidth.MM_58) 5 else 6)
            encoder.smallFont(true)
            encoder.line("Comprobante autorizado por la DGII")
            encoder.smallFont(false)
        } else if (barcode.isNotEmpty()) {
            encoder.align(EscPosEncoder.Alignment.CENTER)
            encoder.barcode128(barcode)
        }

        // ── Pie de página — texto configurable (Ajustes >
        // Facturación > Texto de pie), con el mensaje genérico como
        // respaldo si no hay uno configurado; términos de pago solo
        // si están configurados, igual que en la vista previa.
        encoder.align(EscPosEncoder.Alignment.CENTER)
        val footerText = ticket.optString("footerText", "")
        encoder.line(if (footerText.isNotEmpty()) footerText else "Gracias por su compra")

        val paymentTermsDays = ticket.optString("paymentTermsDays", "")
        if (paymentTermsDays.isNotEmpty()) {
            encoder.smallFont(true)
            encoder.line("Terminos de pago: $paymentTermsDays dias")
            encoder.smallFont(false)
        }

        encoder.line("www.cobroapp.app")

        // ── Corte de papel ─────────────────────────────────
        // cut() ya avanza 4 líneas de margen antes de cortar (ver
        // EscPosEncoder.cut) — no hace falta feed extra acá encima.
        encoder.cut()
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
        // OJO: "RD$\$${...}" (como estaba antes) imprime DOS signos de
        // pesos — el primer $ ya es literal sin escapar (no le sigue letra
        // ni "{"), así que el \$ de al lado agrega uno de más
        // ("RD$$20.00" en vez de "RD$20.00", visible en tickets reales).
        // Concatenar con + en vez de interpolar evita esa ambigüedad.
        return "RD$" + String.format("%,.2f", amount)
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
