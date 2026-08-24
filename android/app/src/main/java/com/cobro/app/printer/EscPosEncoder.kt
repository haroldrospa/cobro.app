package com.cobro.app.printer

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import java.io.ByteArrayOutputStream
import java.nio.charset.Charset

/**
 * EscPosEncoder — Encoder ESC/POS nativo en Kotlin.
 *
 * Genera comandos byte[] compatibles con el protocolo ESC/POS estándar.
 * Compatible con: XPrinter, Epson, Rongta, GOOJPRT, Netum, Sunmi,
 *                 POS-5890, POS-80 y cualquier impresora ESC/POS.
 *
 * Soporta:
 * - Texto con alineación (izquierda, centro, derecha)
 * - Negrita, doble tamaño
 * - Líneas separadoras
 * - Código de barras CODE128
 * - Código QR nativo ESC/POS
 * - Imagen bitmap (logo)
 * - Corte de papel
 * - Apertura de gaveta
 * - Tamaño de papel: 58mm (32 chars) / 80mm (48 chars)
 */
class EscPosEncoder(private val paperWidth: PaperWidth = PaperWidth.MM_80) {

    enum class PaperWidth(val charsPerLine: Int) {
        MM_58(32),
        MM_80(48)
    }

    enum class Alignment { LEFT, CENTER, RIGHT }

    private val buffer = ByteArrayOutputStream()
    private val charset: Charset = Charset.forName("UTF-8")

    companion object {
        // ── Comandos ESC/POS básicos ──────────────────────────────
        val INIT              = byteArrayOf(0x1B, 0x40)
        val LF                = byteArrayOf(0x0A)
        val CR                = byteArrayOf(0x0D)
        val ALIGN_LEFT        = byteArrayOf(0x1B, 0x61, 0x00)
        val ALIGN_CENTER      = byteArrayOf(0x1B, 0x61, 0x01)
        val ALIGN_RIGHT       = byteArrayOf(0x1B, 0x61, 0x02)
        val BOLD_ON           = byteArrayOf(0x1B, 0x45, 0x01)
        val BOLD_OFF          = byteArrayOf(0x1B, 0x45, 0x00)
        val DOUBLE_SIZE_ON    = byteArrayOf(0x1D, 0x21, 0x11)
        val DOUBLE_HEIGHT_ON  = byteArrayOf(0x1D, 0x21, 0x01)
        val DOUBLE_WIDTH_ON   = byteArrayOf(0x1D, 0x21, 0x10)
        val NORMAL_SIZE       = byteArrayOf(0x1D, 0x21, 0x00)
        val UNDERLINE_ON      = byteArrayOf(0x1B, 0x2D, 0x01)
        val UNDERLINE_OFF     = byteArrayOf(0x1B, 0x2D, 0x00)
        val INVERT_ON         = byteArrayOf(0x1D, 0x42, 0x01)
        val INVERT_OFF        = byteArrayOf(0x1D, 0x42, 0x00)
        val FONT_A            = byteArrayOf(0x1B, 0x4D, 0x00)
        val FONT_B            = byteArrayOf(0x1B, 0x4D, 0x01)

        // ── Corte de papel ────────────────────────────────────────
        val PAPER_CUT_FULL    = byteArrayOf(0x1D, 0x56, 0x00)
        val PAPER_CUT_PARTIAL = byteArrayOf(0x1D, 0x56, 0x01)
        val PAPER_FEED_CUT    = byteArrayOf(0x1D, 0x56, 0x42, 0x05)

        // ── Apertura de gaveta ────────────────────────────────────
        val CASH_DRAWER_1     = byteArrayOf(0x1B, 0x70, 0x00, 0x19, 0xFA.toByte())
        val CASH_DRAWER_2     = byteArrayOf(0x1B, 0x70, 0x01, 0x19, 0xFA.toByte())

        // ── Avance de papel ───────────────────────────────────────
        fun feedLines(n: Int): ByteArray = byteArrayOf(0x1B, 0x64, n.toByte())
    }

    // ═══════════════════════════════════════════════════════════
    //  MÉTODOS FLUENT (builder pattern)
    // ═══════════════════════════════════════════════════════════

    fun initialize(): EscPosEncoder {
        write(INIT)
        return this
    }

    fun align(alignment: Alignment): EscPosEncoder {
        write(
            when (alignment) {
                Alignment.LEFT -> ALIGN_LEFT
                Alignment.CENTER -> ALIGN_CENTER
                Alignment.RIGHT -> ALIGN_RIGHT
            }
        )
        return this
    }

    fun bold(enabled: Boolean): EscPosEncoder {
        write(if (enabled) BOLD_ON else BOLD_OFF)
        return this
    }

    fun doubleSize(enabled: Boolean): EscPosEncoder {
        write(if (enabled) DOUBLE_SIZE_ON else NORMAL_SIZE)
        return this
    }

    fun doubleHeight(enabled: Boolean): EscPosEncoder {
        write(if (enabled) DOUBLE_HEIGHT_ON else NORMAL_SIZE)
        return this
    }

    /** Fuente B (más chica que la normal) — para la sublínea "qty x precio
     *  unitario" bajo cada ítem, como la insignia chica de la vista previa. */
    fun smallFont(enabled: Boolean): EscPosEncoder {
        write(if (enabled) FONT_B else FONT_A)
        return this
    }

    fun underline(enabled: Boolean): EscPosEncoder {
        write(if (enabled) UNDERLINE_ON else UNDERLINE_OFF)
        return this
    }

    /** Modo invertido (fondo negro, texto blanco) — GS B n. Para destacar el
     *  total como la barra negra de la vista previa web. No todas las
     *  impresoras lo soportan; si no, simplemente lo ignoran y siguen
     *  imprimiendo en negro sobre blanco normal. */
    fun invert(enabled: Boolean): EscPosEncoder {
        write(if (enabled) INVERT_ON else INVERT_OFF)
        return this
    }

    fun text(text: String): EscPosEncoder {
        write(encodeText(text))
        return this
    }

    fun line(text: String = ""): EscPosEncoder {
        write(encodeText(text))
        write(LF)
        return this
    }

    fun emptyLine(n: Int = 1): EscPosEncoder {
        repeat(n) { write(LF) }
        return this
    }

    fun feed(lines: Int = 3): EscPosEncoder {
        write(feedLines(lines))
        return this
    }

    /**
     * Línea separadora con carácter repetido.
     */
    fun separator(char: Char = '-'): EscPosEncoder {
        val sep = char.toString().repeat(paperWidth.charsPerLine)
        write(encodeText(sep))
        write(LF)
        return this
    }

    /**
     * Imprime dos columnas: texto izquierdo y texto derecho.
     * Ejemplo: "Subtotal" | "RD$ 1,000.00"
     */
    fun twoColumns(left: String, right: String): EscPosEncoder {
        val maxWidth = paperWidth.charsPerLine
        val rightLen = right.length
        val leftLen = maxWidth - rightLen
        val leftTrunc = if (left.length > leftLen - 1) left.substring(0, leftLen - 1) else left
        val spaces = " ".repeat(maxWidth - leftTrunc.length - rightLen)
        write(encodeText("$leftTrunc$spaces$right"))
        write(LF)
        return this
    }

    /**
     * Imprime tres columnas: cantidad | producto | precio
     */
    fun threeColumns(qty: String, name: String, price: String): EscPosEncoder {
        val maxWidth = paperWidth.charsPerLine
        val qtyWidth = 4
        val priceWidth = 10
        val nameWidth = maxWidth - qtyWidth - priceWidth - 2

        val qtyStr = qty.padEnd(qtyWidth).take(qtyWidth)
        val nameStr = name.take(nameWidth).padEnd(nameWidth)
        val priceStr = price.padStart(priceWidth).take(priceWidth)

        write(encodeText("$qtyStr $nameStr $priceStr"))
        write(LF)
        return this
    }

    /**
     * Corte de papel (parcial por default para no dañar la impresora).
     */
    fun cut(full: Boolean = false): EscPosEncoder {
        write(feedLines(4))
        write(if (full) PAPER_CUT_FULL else PAPER_CUT_PARTIAL)
        return this
    }

    /**
     * Apertura de gaveta de efectivo.
     */
    fun openDrawer(pin: Int = 0): EscPosEncoder {
        write(if (pin == 0) CASH_DRAWER_1 else CASH_DRAWER_2)
        return this
    }

    // ═══════════════════════════════════════════════════════════
    //  CÓDIGO QR (ESC/POS nativo)
    // ═══════════════════════════════════════════════════════════

    /**
     * Imprime un código QR usando comandos ESC/POS nativos (GS ( k).
     * @param data Datos a codificar
     * @param size Tamaño del módulo (1-16, default 6)
     */
    fun qrCode(data: String, size: Int = 6): EscPosEncoder {
        val dataBytes = data.toByteArray(Charsets.UTF_8)
        val storeLen = dataBytes.size + 3
        val pL = (storeLen % 256).toByte()
        val pH = (storeLen / 256).toByte()

        // Modelo QR (Modelo 2)
        write(byteArrayOf(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00))
        // Tamaño del módulo
        write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, size.toByte()))
        // Corrección de errores (nivel M = 0x31)
        write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x31))
        // Almacenar datos
        write(byteArrayOf(0x1D, 0x28, 0x6B, pL, pH, 0x31, 0x50, 0x30))
        write(dataBytes)
        // Imprimir
        write(byteArrayOf(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30))
        write(LF)

        return this
    }

    // ═══════════════════════════════════════════════════════════
    //  CÓDIGO DE BARRAS (CODE128)
    // ═══════════════════════════════════════════════════════════

    /**
     * Imprime un código de barras CODE128.
     * @param data Datos del código de barras
     * @param height Altura en dots (default 60)
     */
    fun barcode128(data: String, height: Int = 60): EscPosEncoder {
        val dataBytes = data.toByteArray(Charsets.US_ASCII)
        // Configurar altura del código de barras
        write(byteArrayOf(0x1D, 0x68, height.toByte()))
        // Anchura (2 = normal)
        write(byteArrayOf(0x1D, 0x77, 0x02))
        // HRI text below barcode
        write(byteArrayOf(0x1D, 0x48, 0x02))
        // Imprimir CODE128: GS k {m} {n} {data}
        write(byteArrayOf(0x1D, 0x6B, 0x49, dataBytes.size.toByte()))
        write(dataBytes)
        write(LF)
        return this
    }

    // ═══════════════════════════════════════════════════════════
    //  IMAGEN (Logo del negocio)
    // ═══════════════════════════════════════════════════════════

    /**
     * Imprime una imagen Bitmap usando el comando ESC * (bit-image).
     * La imagen se convierte a blanco/negro con dithering.
     *
     * @param bitmap Imagen a imprimir
     * @param widthFraction Fracción del ancho del papel que puede ocupar
     *   como máximo (0.0-1.0). Para logos conviene bien por debajo de 1.0 —
     *   a ancho completo se ve desproporcionado/pixelado; la vista previa
     *   web tampoco lo muestra a ancho completo.
     */
    fun image(bitmap: Bitmap, widthFraction: Double = 1.0): EscPosEncoder {
        val fullDots = if (paperWidth == PaperWidth.MM_58) 384 else 576
        val maxDots = (fullDots * widthFraction.coerceIn(0.1, 1.0)).toInt()

        // Escalar la imagen
        val scaledBitmap = scaleBitmap(bitmap, maxDots)
        val bwBitmap = toBWBitmap(scaledBitmap)

        val width = bwBitmap.width
        val height = bwBitmap.height

        // Leer TODOS los píxeles de una sola vez a un array plano — ver el
        // comentario de toBWBitmap() más abajo sobre por qué esto importa
        // (evita cientos de miles de llamadas getPixel() sueltas acá abajo).
        val pixels = IntArray(width * height)
        bwBitmap.getPixels(pixels, 0, width, 0, 0, width, height)

        // Alinear al centro
        write(ALIGN_CENTER)

        // ESC * mode nL nH data
        // mode 33 = 24-dot double density: nL/nH declaran el ANCHO EN DOTS
        // (columnas) de esta franja — NO la cantidad de bytes. La impresora
        // ya sabe que en este modo le siguen 3 bytes por columna (24 dots
        // verticales / 8 bits). Antes acá se mandaba bytesPerRow*3 (una
        // cuenta de bytes, no de columnas) — la impresora esperaba menos
        // columnas de las que realmente se escribían después, se
        // desincronizaba, y el resto de los bytes de la imagen se
        // interpretaban como texto suelto (el "ruido" de símbolos en el
        // ticket impreso).
        for (y in 0 until height step 24) {
            write(byteArrayOf(0x1B, 0x2A, 33, (width % 256).toByte(), (width / 256).toByte()))
            // Junta la franja completa en un solo array y un solo write() —
            // antes se hacía un write() de 1 byte por cada (x, k), miles de
            // llamadas sueltas por franja para un ticket normal.
            val rowBytes = ByteArray(width * 3)
            var idx = 0
            for (x in 0 until width) {
                for (k in 0..2) {
                    var slice = 0
                    for (bit in 0..7) {
                        val py = y + k * 8 + bit
                        if (py < height) {
                            if (pixels[py * width + x] != Color.WHITE) {
                                slice = slice or (0x80 shr bit)
                            }
                        }
                    }
                    rowBytes[idx++] = slice.toByte()
                }
            }
            write(rowBytes)
            write(LF)
        }

        write(ALIGN_LEFT)
        bwBitmap.recycle()
        scaledBitmap.recycle()

        return this
    }

    // ═══════════════════════════════════════════════════════════
    //  BUILD
    // ═══════════════════════════════════════════════════════════

    /**
     * Retorna todos los bytes del buffer acumulados.
     */
    fun build(): ByteArray = buffer.toByteArray()

    /**
     * Resetea el buffer para reutilizar el encoder.
     */
    fun reset(): EscPosEncoder {
        buffer.reset()
        return this
    }

    // ═══════════════════════════════════════════════════════════
    //  HELPERS PRIVADOS
    // ═══════════════════════════════════════════════════════════

    private fun write(bytes: ByteArray) {
        buffer.write(bytes)
    }

    /**
     * Codifica texto eliminando caracteres incompatibles con ESC/POS.
     * Soporta caracteres latinos (vocales con tilde, ñ, etc.)
     */
    private fun encodeText(text: String): ByteArray {
        // Intentar encoding en ISO-8859-1 para mejor compatibilidad con impresoras
        return try {
            val cleaned = text
                .replace("á", "\u00E1").replace("é", "\u00E9")
                .replace("í", "\u00ED").replace("ó", "\u00F3")
                .replace("ú", "\u00FA").replace("ñ", "\u00F1")
                .replace("Á", "\u00C1").replace("É", "\u00C9")
                .replace("Í", "\u00CD").replace("Ó", "\u00D3")
                .replace("Ú", "\u00DA").replace("Ñ", "\u00D1")
                .replace("ü", "\u00FC").replace("Ü", "\u00DC")
            cleaned.toByteArray(Charset.forName("ISO-8859-1"))
        } catch (_: Exception) {
            text.toByteArray(Charsets.UTF_8)
        }
    }

    private fun scaleBitmap(bitmap: Bitmap, maxWidth: Int): Bitmap {
        if (bitmap.width <= maxWidth) return bitmap
        val ratio = maxWidth.toFloat() / bitmap.width.toFloat()
        val newHeight = (bitmap.height * ratio).toInt()
        return Bitmap.createScaledBitmap(bitmap, maxWidth, newHeight, true)
    }

    private fun toBWBitmap(source: Bitmap): Bitmap {
        val width = source.width
        val height = source.height
        val result = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)
        val paint = Paint().apply {
            isAntiAlias = false
            isFilterBitmap = false
        }
        // Fondo blanco
        canvas.drawColor(Color.WHITE)
        canvas.drawBitmap(source, 0f, 0f, paint)

        // Leyendo y escribiendo TODO el bitmap de una sola vez
        // (getPixels/setPixels) en vez de un getPixel()/setPixel() por cada
        // píxel individual. Esto último es un anti-patrón conocido de
        // Android: cada llamada cruza a código nativo (JNI) por separado, y
        // para una imagen de un ticket completo (cientos de miles de
        // píxeles) eso significaba más de un millón de llamadas sueltas —
        // en una tablet de gama baja eso se traducía en varios minutos
        // "imprimiendo" sin ningún error, solo procesando muy lento.
        val pixels = IntArray(width * height)
        result.getPixels(pixels, 0, width, 0, 0, width, height)

        // Escala de grises en punto flotante — hace falta precisión extra
        // para difundir el error de redondeo (dithering) sin perderlo.
        val gray = FloatArray(width * height)
        for (i in pixels.indices) {
            val p = pixels[i]
            gray[i] = Color.red(p) * 0.299f + Color.green(p) * 0.587f + Color.blue(p) * 0.114f
        }

        // Dithering Floyd-Steinberg en vez de un umbral plano (blanco si
        // brightness>=128, negro si no). Un umbral plano le queda bien a
        // fotos/degradados pero es duro con texto chico: cualquier trazo
        // fino que promedie "gris medio" al escalar la imagen desaparece
        // de golpe. Difundiendo el error de cada píxel a sus vecinos
        // (7/16 derecha, 3/16 abajo-izq, 5/16 abajo, 1/16 abajo-der) los
        // bordes de las letras se conservan mucho mejor a la resolución
        // real de una impresora térmica (~168 DPI en 58mm).
        for (y in 0 until height) {
            for (x in 0 until width) {
                val idx = y * width + x
                val old = gray[idx]
                val new = if (old < 128f) 0f else 255f
                pixels[idx] = if (new == 0f) Color.BLACK else Color.WHITE
                val error = old - new
                if (error == 0f) continue
                if (x + 1 < width) gray[idx + 1] += error * 7f / 16f
                if (y + 1 < height) {
                    if (x > 0) gray[idx + width - 1] += error * 3f / 16f
                    gray[idx + width] += error * 5f / 16f
                    if (x + 1 < width) gray[idx + width + 1] += error * 1f / 16f
                }
            }
        }
        result.setPixels(pixels, 0, width, 0, 0, width, height)
        return result
    }
}
