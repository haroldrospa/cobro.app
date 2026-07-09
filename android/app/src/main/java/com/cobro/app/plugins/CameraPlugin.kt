package com.cobro.app.plugins

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * CameraPlugin — Plugin Capacitor para cámara y selección de archivos.
 *
 * Permite:
 * - takePhoto: Captura una foto con la cámara y retorna la URI local
 * - pickFile: Abre el selector de archivos del sistema (PDF, Excel, imágenes, etc.)
 */
@CapacitorPlugin(name = "Camera")
class CameraPlugin : Plugin() {

    private var photoUri: Uri? = null
    // Guardamos el callbackId para recuperar la llamada en handleOnActivityResult
    private var savedCallbackId: String? = null

    @PluginMethod
    fun takePhoto(call: PluginCall) {
        // Guardar el callbackId ANTES de saveCall
        savedCallbackId = call.callbackId
        bridge.saveCall(call)
        call.setKeepAlive(true)

        val photoFile = createImageFile()
        photoUri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            photoFile
        )

        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
        }
        activity.startActivityForResult(intent, PHOTO_REQUEST_CODE)
    }

    @PluginMethod
    fun pickFile(call: PluginCall) {
        savedCallbackId = call.callbackId
        bridge.saveCall(call)
        call.setKeepAlive(true)

        val mimeTypes = call.getArray("mimeTypes")
            ?.toList<String>()
            ?.toTypedArray()
            ?: arrayOf("*/*")

        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
            if (mimeTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes)
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        activity.startActivityForResult(
            Intent.createChooser(intent, "Seleccionar archivo"),
            FILE_REQUEST_CODE
        )
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)

        val callbackId = savedCallbackId ?: return

        when (requestCode) {
            PHOTO_REQUEST_CODE -> {
                val savedCall = bridge.getSavedCall(callbackId) ?: return
                if (resultCode == Activity.RESULT_OK) {
                    val uri = photoUri
                    if (uri != null) {
                        savedCall.resolve(
                            JSObject()
                                .put("uri", uri.toString())
                                .put("cancelled", false)
                        )
                    } else {
                        savedCall.reject("Photo capture failed")
                    }
                } else {
                    savedCall.resolve(JSObject().put("cancelled", true))
                }
                bridge.releaseCall(savedCall)
                photoUri = null
                savedCallbackId = null
            }

            FILE_REQUEST_CODE -> {
                val savedCall = bridge.getSavedCall(callbackId) ?: return
                if (resultCode == Activity.RESULT_OK) {
                    val uri = data?.data
                    if (uri != null) {
                        val fileName = getFileName(uri)
                        savedCall.resolve(
                            JSObject()
                                .put("uri", uri.toString())
                                .put("name", fileName)
                                .put("cancelled", false)
                        )
                    } else {
                        savedCall.reject("File selection failed")
                    }
                } else {
                    savedCall.resolve(JSObject().put("cancelled", true))
                }
                bridge.releaseCall(savedCall)
                savedCallbackId = null
            }
        }
    }

    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val storageDir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES)
        return File.createTempFile("COBRO_${timeStamp}_", ".jpg", storageDir)
    }

    private fun getFileName(uri: Uri): String {
        return try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
                cursor.moveToFirst()
                cursor.getString(nameIndex)
            } ?: uri.lastPathSegment ?: "archivo"
        } catch (_: Exception) { "archivo" }
    }

    companion object {
        private const val PHOTO_REQUEST_CODE = 3001
        private const val FILE_REQUEST_CODE  = 3002
    }
}
