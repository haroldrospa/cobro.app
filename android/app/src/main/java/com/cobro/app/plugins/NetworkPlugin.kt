package com.cobro.app.plugins

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * NetworkPlugin — Plugin Capacitor para monitoreo de conectividad.
 *
 * Detecta pérdida y recuperación de conexión a Internet.
 * Emite el evento 'networkStatusChange' al JavaScript cuando cambia el estado.
 * El frontend web puede mostrar una pantalla offline al recibir este evento.
 */
@CapacitorPlugin(name = "Network")
class NetworkPlugin : Plugin() {

    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var connectivityManager: ConnectivityManager? = null
    private var isOnline = true

    override fun load() {
        connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        startMonitoring()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("connected", isNetworkAvailable())
                .put("connectionType", getConnectionType())
        )
    }

    private fun startMonitoring() {
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()

        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                if (!isOnline) {
                    isOnline = true
                    notifyStatusChange(true)
                }
            }

            override fun onLost(network: Network) {
                super.onLost(network)
                if (isOnline) {
                    isOnline = false
                    notifyStatusChange(false)
                }
            }

            override fun onUnavailable() {
                super.onUnavailable()
                if (isOnline) {
                    isOnline = false
                    notifyStatusChange(false)
                }
            }
        }

        try {
            connectivityManager?.registerNetworkCallback(request, networkCallback!!)
        } catch (_: Exception) {}

        // Estado inicial
        isOnline = isNetworkAvailable()
    }

    private fun notifyStatusChange(connected: Boolean) {
        val data = JSObject()
            .put("connected", connected)
            .put("connectionType", if (connected) getConnectionType() else "none")

        // Notificar al JavaScript del WebView
        notifyListeners("networkStatusChange", data)

        // También inyectar evento directo al WebView
        bridge?.let { bridge ->
            bridge.webView.post {
                bridge.webView.evaluateJavascript(
                    """
                    (function() {
                        window.dispatchEvent(new CustomEvent('cobro_network_change', {
                            detail: { connected: $connected, connectionType: '${if (connected) getConnectionType() else "none"}' }
                        }));
                    })();
                    """.trimIndent(),
                    null
                )
            }
        }
    }

    private fun isNetworkAvailable(): Boolean {
        val network = connectivityManager?.activeNetwork ?: return false
        val caps = connectivityManager?.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    private fun getConnectionType(): String {
        val network = connectivityManager?.activeNetwork ?: return "none"
        val caps = connectivityManager?.getNetworkCapabilities(network) ?: return "none"
        return when {
            caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
            caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
            else -> "unknown"
        }
    }

    override fun handleOnDestroy() {
        networkCallback?.let {
            try { connectivityManager?.unregisterNetworkCallback(it) } catch (_: Exception) {}
        }
        networkCallback = null
    }
}
