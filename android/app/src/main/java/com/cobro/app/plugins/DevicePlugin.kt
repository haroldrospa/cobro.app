package com.cobro.app.plugins

import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * DevicePlugin — Plugin Capacitor para información y utilidades del dispositivo.
 */
@CapacitorPlugin(name = "Device")
class DevicePlugin : Plugin() {

    @PluginMethod
    fun getInfo(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("manufacturer", Build.MANUFACTURER)
                .put("model", Build.MODEL)
                .put("androidVersion", Build.VERSION.RELEASE)
                .put("sdkVersion", Build.VERSION.SDK_INT)
                .put("platform", "android")
                .put("isSunmi", Build.MANUFACTURER.lowercase().contains("sunmi"))
                .put("appVersion", getAppVersion())
        )
    }

    @PluginMethod
    fun vibrate(call: PluginCall) {
        val duration = call.getLong("duration") ?: 100L
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE)
                    as android.os.VibratorManager
                vibratorManager.defaultVibrator.vibrate(
                    android.os.VibrationEffect.createOneShot(duration, android.os.VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(android.content.Context.VIBRATOR_SERVICE) as android.os.Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(android.os.VibrationEffect.createOneShot(duration, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(duration)
                }
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject("Vibration failed: ${e.message}")
        }
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val title = call.getString("title", "Compartir")
        val text = call.getString("text", "")
        val url = call.getString("url", "")

        val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(android.content.Intent.EXTRA_SUBJECT, title)
            putExtra(android.content.Intent.EXTRA_TEXT, if (url?.isNotEmpty() == true) "$text\n$url" else text)
        }
        activity.startActivity(android.content.Intent.createChooser(intent, title))
        call.resolve()
    }

    private fun getAppVersion(): String {
        return try {
            context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "2.0.0"
        } catch (_: Exception) { "2.0.0" }
    }
}
