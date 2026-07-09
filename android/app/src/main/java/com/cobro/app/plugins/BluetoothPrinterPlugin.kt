package com.cobro.app.plugins

import com.cobro.app.printer.BluetoothPrinterManager
import com.cobro.app.printer.PrinterStatus
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONObject

/**
 * BluetoothPrinterPlugin — Plugin Capacitor para impresión ESC/POS Bluetooth.
 *
 * Disponible desde Capacitor como:
 *   import { Plugins } from '@capacitor/core'
 *   const { BluetoothPrinter } = Plugins
 *   await BluetoothPrinter.printTicket({ ticket: {...} })
 */
@CapacitorPlugin(name = "BluetoothPrinter")
class BluetoothPrinterPlugin : Plugin() {

    private val printerManager: BluetoothPrinterManager by lazy {
        BluetoothPrinterManager.getInstance(context)
    }

    @PluginMethod
    fun printTicket(call: PluginCall) {
        val ticketObj = call.getObject("ticket")
            ?: run { call.reject("ticket is required"); return }

        val ticket = JSONObject(ticketObj.toString())
        printerManager.printTicket(ticket) { success, error ->
            if (success) {
                call.resolve(JSObject().put("success", true))
            } else {
                call.reject(error ?: "Print failed")
            }
        }
    }

    @PluginMethod
    fun printTestPage(call: PluginCall) {
        printerManager.printTestPage { success, error ->
            if (success) call.resolve() else call.reject(error ?: "Test print failed")
        }
    }

    @PluginMethod
    fun connectPrinter(call: PluginCall) {
        val address = call.getString("address")
            ?: run { call.reject("address is required"); return }

        printerManager.connectByAddress(address) { success, error ->
            if (success) {
                call.resolve(JSObject().put("connected", true).put("address", address))
            } else {
                call.reject(error ?: "Connection failed")
            }
        }
    }

    @PluginMethod
    fun disconnectPrinter(call: PluginCall) {
        printerManager.disconnect()
        call.resolve()
    }

    @PluginMethod
    fun getPrinterStatus(call: PluginCall) {
        val info = printerManager.getCurrentPrinterInfo()
        call.resolve(
            JSObject()
                .put("status", printerManager.status.name)
                .put("printerName", info?.name ?: "")
                .put("address", info?.address ?: "")
        )
    }

    @PluginMethod
    fun getPairedPrinters(call: PluginCall) {
        val printers = printerManager.getPairedPrinters()
        call.resolve(JSObject().put("printers", printers))
    }

    @PluginMethod
    fun selectPrinter(call: PluginCall) {
        val address = call.getString("address")
            ?: run { call.reject("address is required"); return }
        printerManager.setDefaultPrinter(address)
        printerManager.connectByAddress(address) { success, error ->
            if (success) call.resolve() else call.reject(error ?: "Failed to select printer")
        }
    }

    @PluginMethod
    fun openCashDrawer(call: PluginCall) {
        printerManager.openCashDrawer { success, error ->
            if (success) call.resolve() else call.reject(error ?: "Failed to open drawer")
        }
    }

    @PluginMethod
    fun isBluetoothEnabled(call: PluginCall) {
        call.resolve(JSObject().put("enabled", printerManager.isBluetoothEnabled()))
    }

    fun onPermissionsResult(permissions: Array<out String>, grantResults: IntArray) {
        // Intentar auto-conectar a impresora predeterminada tras obtener permisos BT
        val btConnectIndex = permissions.indexOf("android.permission.BLUETOOTH_CONNECT")
        if (btConnectIndex != -1 && grantResults.getOrNull(btConnectIndex) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            printerManager.autoConnect()
        }
    }
}
