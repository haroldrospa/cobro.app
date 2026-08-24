package com.cobro.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.cobro.app.plugins.BarcodeScannerPlugin
import com.cobro.app.plugins.BluetoothPrinterPlugin
import com.cobro.app.plugins.CameraPlugin
import com.cobro.app.plugins.DevicePlugin
import com.cobro.app.plugins.NetworkPlugin
import com.getcapacitor.BridgeActivity

/**
 * CobroApp — MainActivity
 *
 * Punto de entrada principal. Extiende BridgeActivity de Capacitor para
 * mostrar la webapp de CobroApp en un WebView seguro, con todas las
 * capacidades nativas expuestas vía plugins Kotlin y JavaScript Bridge.
 *
 * Capacidades nativas:
 * - Impresión Bluetooth ESC/POS directa
 * - Escaneo de códigos de barras (cámara + USB + Sunmi)
 * - Firebase Cloud Messaging
 * - Gestión de archivos y cámara
 * - Monitoreo de red con pantalla offline
 * - POS Settings nativo en Jetpack Compose
 */
class MainActivity : BridgeActivity() {

    companion object {
        private const val PERMISSION_REQUEST_CODE = 1001
        private val REQUIRED_PERMISSIONS = buildList {
            // Bluetooth
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                add(Manifest.permission.BLUETOOTH_SCAN)
                add(Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                add(Manifest.permission.BLUETOOTH)
                add(Manifest.permission.BLUETOOTH_ADMIN)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
            // Camera
            add(Manifest.permission.CAMERA)
            // Storage
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.READ_MEDIA_IMAGES)
                add(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                add(Manifest.permission.READ_EXTERNAL_STORAGE)
                add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
            }
        }.toTypedArray()
    }

    // JavaScript Bridge — expone window.Android.* al frontend web
    private lateinit var jsBridge: JavaScriptBridge

    override fun onCreate(savedInstanceState: Bundle?) {
        // Instalar Splash Screen ANTES de super.onCreate
        installSplashScreen()

        // Registrar plugins nativos ANTES de super.onCreate (requerido por Capacitor v7)
        registerPlugin(BluetoothPrinterPlugin::class.java)
        registerPlugin(BarcodeScannerPlugin::class.java)
        registerPlugin(CameraPlugin::class.java)
        registerPlugin(DevicePlugin::class.java)
        registerPlugin(NetworkPlugin::class.java)

        super.onCreate(savedInstanceState)

        // El theme de arranque (AppTheme.NoActionBarLaunch, requerido por la
        // Splash Screen API) no desactivaba la action bar nativa como sí
        // hacen AppTheme/AppTheme.NoActionBar — Android pintaba una barra de
        // título nativa arriba de todo con el label de esta Activity
        // (title_activity_main = "CobroApp POS" en strings.xml), encima de
        // la propia UI de la webapp. El fix real está en el theme
        // (android:windowNoTitle/windowActionBar en styles.xml); esto es
        // solo respaldo por si el dispositivo igual expone una action bar.
        supportActionBar?.hide()
        actionBar?.hide()

        // Configurar WebView para máxima compatibilidad con CobroApp
        configureWebView()

        // Inyectar el JavaScript Bridge (window.Android.*)
        setupJavaScriptBridge()

        // Solicitar permisos necesarios
        requestAppPermissions()

        // Manejar Intent de escáner Sunmi si la app fue lanzada por uno
        handleScannerIntent(intent)
    }

    /**
     * Configura el WebView de Capacitor con todas las capacidades necesarias
     * para que CobroApp funcione correctamente:
     * - Cookies persistentes (sesión)
     * - LocalStorage / SessionStorage
     * - IndexedDB
     * - DOM Storage
     * - JavaScript habilitado
     * - HTTPS / Mixed content controlado
     */
    private fun configureWebView() {
        val webView: WebView = bridge.webView

        webView.settings.apply {
            // JavaScript (requerido)
            javaScriptEnabled = true

            // Almacenamiento local (sesión de CobroApp)
            domStorageEnabled = true
            databaseEnabled = true

            // Medios
            mediaPlaybackRequiresUserGesture = false

            // Contenido mixto — necesario si la webapp carga recursos externos
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE

            // Caché
            cacheMode = WebSettings.LOAD_DEFAULT

            // User Agent con identificador nativo
            userAgentString = "${userAgentString} CobroApp-Android/2.0"

            // Acceso a archivos
            allowFileAccess = true
            allowContentAccess = true
        }

        // Habilitar cookies (persistencia de sesión)
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }
    }

    /**
     * Inyecta el JavaScript Bridge en el WebView.
     * Esto expone window.Android con todos los métodos nativos.
     */
    private fun setupJavaScriptBridge() {
        jsBridge = JavaScriptBridge(this, bridge)
        bridge.webView.addJavascriptInterface(jsBridge, "Android")
    }

    /**
     * Solicita todos los permisos necesarios al usuario.
     */
    private fun requestAppPermissions() {
        val missing = REQUIRED_PERMISSIONS.filter { permission ->
            ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    /**
     * Maneja el resultado de la solicitud de permisos.
     */
    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            // Notificar al bridge sobre cambios en permisos Bluetooth
            val btPlugin = bridge.getPlugin("BluetoothPrinter")?.instance as? BluetoothPrinterPlugin
            btPlugin?.onPermissionsResult(permissions, grantResults)
        }
    }

    /**
     * Maneja Intents de escáneres externos (Sunmi, USB HID, etc.)
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleScannerIntent(intent)
    }

    private fun handleScannerIntent(intent: Intent?) {
        intent ?: return
        // Sunmi barcode scanner
        val barcodeData = intent.getStringExtra("data")
            ?: intent.getStringExtra("barcode_string")
            ?: return

        // Enviar el código al frontend vía JavaScript
        bridge.webView.post {
            bridge.webView.evaluateJavascript(
                """
                (function() {
                    var event = new CustomEvent('cobro_barcode', { detail: { code: '${barcodeData.replace("'", "\\'")}' } });
                    window.dispatchEvent(event);
                    if (window.Android && window.Android._barcodeCallback) {
                        window.Android._barcodeCallback('${barcodeData.replace("'", "\\'")}');
                    }
                })();
                """.trimIndent(),
                null
            )
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        // Limpiar recursos del bridge
        if (::jsBridge.isInitialized) {
            jsBridge.cleanup()
        }
    }
}
