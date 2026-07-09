package com.cobro.app.plugins

import android.app.Activity
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * BarcodeScannerPlugin — Plugin Capacitor para escaneo de códigos de barras.
 *
 * Abre BarcodeScannerActivity (CameraX + ML Kit) y retorna el código leído.
 * Uso desde JavaScript:
 *   const result = await Plugins.BarcodeScanner.scan({ mode: 'barcode' })
 *   console.log(result.code)
 */
@CapacitorPlugin(name = "BarcodeScanner")
class BarcodeScannerPlugin : Plugin() {

    // Guardamos el callbackId para recuperar la llamada en handleOnActivityResult
    private var savedCallbackId: String? = null

    @PluginMethod
    fun scan(call: PluginCall) {
        val mode = call.getString("mode", "barcode")

        // Guardar callbackId antes de invocar saveCall
        savedCallbackId = call.callbackId
        bridge.saveCall(call)
        call.setKeepAlive(true)

        val intent = Intent(context, com.cobro.app.BarcodeScannerActivity::class.java)
            .putExtra("mode", mode)
        activity.startActivityForResult(intent, SCAN_REQUEST_CODE)
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)
        if (requestCode != SCAN_REQUEST_CODE) return

        val callbackId = savedCallbackId ?: return
        val savedCall = bridge.getSavedCall(callbackId) ?: return

        if (resultCode == Activity.RESULT_OK) {
            val code = data?.getStringExtra("barcode") ?: ""
            savedCall.resolve(
                JSObject()
                    .put("code", code)
                    .put("cancelled", false)
            )
        } else {
            savedCall.resolve(
                JSObject()
                    .put("code", "")
                    .put("cancelled", true)
            )
        }

        bridge.releaseCall(savedCall)
        savedCallbackId = null
    }

    companion object {
        private const val SCAN_REQUEST_CODE = 2001
    }
}
