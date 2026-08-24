# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ════════════════════════════════════════════════════════════════════
# CobroApp — reglas para minifyEnabled/shrinkResources
#
# Todo lo de abajo protege código que solo se invoca por REFLEXIÓN
# (el WebView llamando al bridge JS, o Capacitor descubriendo plugins),
# que R8 no puede ver analizando las referencias normales del código.
# Sin esto, la app compilaría bien pero fallaría en tiempo de ejecución
# (bridge JS roto, plugins de impresión/escaneo sin responder, etc.).
# ════════════════════════════════════════════════════════════════════

# JavaScriptBridge — el WebView llama estos métodos por nombre desde JS
# (addJavascriptInterface); si se renombran o se eliminan por "no usados"
# se rompe window.Android.* completo en el frontend.
-keepclassmembers class com.cobro.app.JavaScriptBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.cobro.app.JavaScriptBridge

# Plugins nativos propios (impresión Bluetooth, escáner, cámara, device,
# red) — Capacitor los descubre y llama sus @PluginMethod por reflexión,
# nunca por referencia directa en el código Kotlin.
-keep class com.cobro.app.plugins.** { *; }
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}

# FirebaseMessagingService — lo instancia el sistema por el nombre
# declarado en AndroidManifest.xml, no el código de la app.
-keep class com.cobro.app.CobroFirebaseMessagingService { *; }

# Capacitor / Cordova bridge — refuerzo por si el AAR no trae ya sus
# propias consumer-rules completas para esta versión.
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**
-keep class org.apache.cordova.** { *; }
-dontwarn org.apache.cordova.**

# ML Kit (decodificación de códigos de barra) y CameraX — usan callbacks
# internos vía reflexión propia del framework.
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# Jetpack Compose (PosSettingsActivity)
-dontwarn androidx.compose.**

# Warnings ruidosos y no fatales de dependencias transitivas que no
# siempre traen todos los metadatos que R8 espera.
-dontwarn kotlinx.coroutines.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
