package com.cobro.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.util.Log

/**
 * CobroFirebaseMessagingService — Servicio de Firebase Cloud Messaging.
 *
 * Maneja notificaciones push para:
 * - Nuevas ventas
 * - Alertas de inventario
 * - Recordatorios de cobro
 * - Mensajes administrativos
 *
 * Crea canales de notificación para Android 8.0+.
 */
class CobroFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        private const val TAG = "CobroFCM"

        // Canales de notificación
        const val CHANNEL_GENERAL    = "cobro_general"
        const val CHANNEL_SALES      = "cobro_ventas"
        const val CHANNEL_ALERTS     = "cobro_alertas"
        const val CHANNEL_REMINDERS  = "cobro_recordatorios"

        /**
         * Crea todos los canales de notificación al inicializar la app.
         * Debe llamarse en Application.onCreate() o MainActivity.onCreate().
         */
        fun createNotificationChannels(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val channels = listOf(
                NotificationChannel(CHANNEL_GENERAL, "General", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Notificaciones generales de CobroApp"
                    enableLights(true)
                    lightColor = android.graphics.Color.parseColor("#6366F1")
                },
                NotificationChannel(CHANNEL_SALES, "Ventas", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Notificaciones de nuevas ventas y transacciones"
                    enableLights(true)
                    lightColor = android.graphics.Color.parseColor("#22C55E")
                    enableVibration(true)
                },
                NotificationChannel(CHANNEL_ALERTS, "Alertas", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Alertas de inventario bajo y avisos importantes"
                    enableLights(true)
                    lightColor = android.graphics.Color.parseColor("#F59E0B")
                    enableVibration(true)
                },
                NotificationChannel(CHANNEL_REMINDERS, "Recordatorios", NotificationManager.IMPORTANCE_DEFAULT).apply {
                    description = "Recordatorios de cobro y vencimientos"
                    enableLights(true)
                    lightColor = android.graphics.Color.parseColor("#6366F1")
                }
            )

            channels.forEach { manager.createNotificationChannel(it) }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels(this)
    }

    /**
     * Se llama cuando se recibe un nuevo token FCM.
     * Debe enviarse al backend de CobroApp para actualizar el registro del dispositivo.
     */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(TAG, "📱 Nuevo FCM Token: $token")
        // El token se almacena en SharedPreferences para enviarlo al backend
        getSharedPreferences("cobro_fcm", MODE_PRIVATE)
            .edit()
            .putString("fcm_token", token)
            .apply()
    }

    /**
     * Se llama cuando se recibe un mensaje mientras la app está en primer plano.
     */
    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        Log.d(TAG, "📨 Mensaje FCM recibido de: ${message.from}")

        val title = message.notification?.title ?: message.data["title"] ?: "CobroApp"
        val body  = message.notification?.body  ?: message.data["body"]  ?: ""
        val type  = message.data["type"] ?: "general"
        val url   = message.data["url"]  ?: ""

        showNotification(title, body, type, url)
    }

    private fun showNotification(title: String, body: String, type: String, url: String) {
        val channelId = when (type) {
            "sale", "venta"             -> CHANNEL_SALES
            "alert", "alerta"           -> CHANNEL_ALERTS
            "reminder", "recordatorio"  -> CHANNEL_REMINDERS
            else                        -> CHANNEL_GENERAL
        }

        // Intent que abre la app al tocar la notificación
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            if (url.isNotEmpty()) putExtra("notification_url", url)
            putExtra("notification_type", type)
        }

        val pendingIntent = PendingIntent.getActivity(
            this, System.currentTimeMillis().toInt(), intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setColor(android.graphics.Color.parseColor("#6366F1"))
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }
}
