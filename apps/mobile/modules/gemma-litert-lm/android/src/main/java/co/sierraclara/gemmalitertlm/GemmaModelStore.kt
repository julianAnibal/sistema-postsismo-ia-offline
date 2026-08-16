package co.sierraclara.gemmalitertlm

import android.content.Context
import android.net.Uri
import android.os.StatFs
import android.system.Os
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

internal object GemmaModelSpec {
  const val MODEL_ID = "litert-community/gemma-4-E2B-it-litert-lm"
  const val REVISION = "6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94"
  const val FILE_NAME = "gemma-4-E2B-it.litertlm"
  const val SIZE_BYTES = 2_588_147_712L
  const val SHA256 = "181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c"
  const val RUNTIME = "com.google.ai.edge.litertlm:litertlm-android:0.16.0"
  const val DOWNLOAD_URL =
    "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/$REVISION/$FILE_NAME"
}

internal data class GemmaStoredStatus(
  val installed: Boolean,
  val availableBytes: Long,
  val modelFile: File
)

internal class GemmaModelStore(
  private val onProgress: (phase: String, completedBytes: Long) -> Unit
) {
  private fun modelDirectory(context: Context) = File(context.filesDir, "gemma-litert-lm")
  private fun modelFile(context: Context) = File(modelDirectory(context), GemmaModelSpec.FILE_NAME)
  private fun stagingFile(context: Context) = File(modelDirectory(context), "${GemmaModelSpec.FILE_NAME}.partial")
  private fun preferences(context: Context) =
    context.getSharedPreferences("gemma_litert_lm", Context.MODE_PRIVATE)

  fun inspect(context: Context): GemmaStoredStatus {
    val file = modelFile(context)
    val prefs = preferences(context)
    val metadataMatches =
      prefs.getString("modelId", null) == GemmaModelSpec.MODEL_ID &&
        prefs.getString("revision", null) == GemmaModelSpec.REVISION &&
        prefs.getString("fileName", null) == GemmaModelSpec.FILE_NAME &&
        prefs.getLong("sizeBytes", -1L) == GemmaModelSpec.SIZE_BYTES &&
        prefs.getString("sha256", null) == GemmaModelSpec.SHA256
    val hasExpectedShape = metadataMatches && file.isFile && file.length() == GemmaModelSpec.SIZE_BYTES
    val installed = hasExpectedShape && verifyIdentityOrRehash(file, prefs)
    return GemmaStoredStatus(
      installed = installed,
      availableBytes = StatFs(context.filesDir.absolutePath).availableBytes,
      modelFile = file
    )
  }

  private fun verifyIdentityOrRehash(
    file: File,
    prefs: android.content.SharedPreferences
  ): Boolean {
    val currentLastModified = file.lastModified()
    val currentInode = runCatching { Os.stat(file.absolutePath).st_ino }.getOrDefault(-1L)
    val storedLastModified = prefs.getLong("verifiedLastModified", -1L)
    val storedInode = prefs.getLong("verifiedInode", -1L)
    if (
      currentLastModified > 0L &&
      currentInode > 0L &&
      storedLastModified == currentLastModified &&
      storedInode == currentInode
    ) {
      return true
    }

    val actualSha256 = runCatching { sha256(file) }.getOrNull() ?: return false
    if (actualSha256 != GemmaModelSpec.SHA256) return false
    return prefs.edit()
      .putLong("verifiedLastModified", currentLastModified)
      .putLong("verifiedInode", currentInode)
      .commit()
  }

  private fun sha256(file: File): String {
    val digest = MessageDigest.getInstance("SHA-256")
    FileInputStream(file).use { raw ->
      BufferedInputStream(raw, BUFFER_BYTES).use { input ->
        val buffer = ByteArray(BUFFER_BYTES)
        while (true) {
          val count = input.read(buffer)
          if (count < 0) break
          if (count > 0) digest.update(buffer, 0, count)
        }
      }
    }
    return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
  }

  fun installFromNetwork(context: Context): GemmaStoredStatus {
    inspect(context).takeIf { it.installed }?.let { return it }
    val connection = (URL(GemmaModelSpec.DOWNLOAD_URL).openConnection() as HttpURLConnection).apply {
      instanceFollowRedirects = true
      connectTimeout = 30_000
      readTimeout = 120_000
      requestMethod = "GET"
      setRequestProperty("Accept-Encoding", "identity")
      setRequestProperty("User-Agent", "1000-Ojos-Android/1.0 LiteRT-LM")
    }

    try {
      val status = connection.responseCode
      if (status !in 200..299) {
        throw GemmaDownloadException("No se pudo descargar Gemma (HTTP $status).")
      }
      val contentLength = connection.contentLengthLong
      if (contentLength > 0 && contentLength != GemmaModelSpec.SIZE_BYTES) {
        throw GemmaIntegrityException(
          "El servidor devolvió $contentLength bytes; se esperaban ${GemmaModelSpec.SIZE_BYTES}."
        )
      }
      return connection.inputStream.use { input ->
        installStream(context, input, "downloading")
      }
    } catch (error: GemmaNativeException) {
      throw error
    } catch (error: Exception) {
      throw GemmaDownloadException("La descarga de Gemma se interrumpió.", error)
    } finally {
      connection.disconnect()
    }
  }

  fun installFromUri(context: Context, uriValue: String): GemmaStoredStatus {
    inspect(context).takeIf { it.installed }?.let { return it }
    val uri = Uri.parse(uriValue)
    val input = when (uri.scheme?.lowercase()) {
      "content" -> context.contentResolver.openInputStream(uri)
      "file" -> uri.path?.let { path -> FileInputStream(File(path)) }
      else -> null
    } ?: throw GemmaImportException("Seleccione un archivo .litertlm local legible.")

    return try {
      input.use { installStream(context, it, "importing") }
    } catch (error: GemmaNativeException) {
      throw error
    } catch (error: Exception) {
      throw GemmaImportException("No se pudo importar el archivo Gemma seleccionado.", error)
    }
  }

  private fun installStream(
    context: Context,
    source: InputStream,
    phase: String
  ): GemmaStoredStatus {
    val directory = modelDirectory(context)
    if (!directory.exists() && !directory.mkdirs()) {
      throw GemmaStorageException("No se pudo crear el almacenamiento privado de Gemma.")
    }

    val staging = stagingFile(context)
    if (staging.exists() && !staging.delete()) {
      throw GemmaStorageException("No se pudo limpiar una instalación incompleta anterior.")
    }
    val current = inspect(context)
    if (!current.installed && current.modelFile.exists()) {
      current.modelFile.delete()
      preferences(context).edit().clear().commit()
    }

    val requiredBytes = GemmaModelSpec.SIZE_BYTES + STORAGE_RESERVE_BYTES
    val availableBytes = StatFs(context.filesDir.absolutePath).availableBytes
    if (availableBytes < requiredBytes) {
      throw GemmaStorageException(
        "Espacio insuficiente: Gemma requiere al menos ${requiredBytes / (1024 * 1024)} MiB libres."
      )
    }

    val digest = MessageDigest.getInstance("SHA-256")
    var completed = 0L
    var nextProgress = 0L
    onProgress(phase, 0L)

    try {
      BufferedInputStream(source, BUFFER_BYTES).use { input ->
        FileOutputStream(staging).use { fileOutput ->
          BufferedOutputStream(fileOutput, BUFFER_BYTES).use { output ->
            val buffer = ByteArray(BUFFER_BYTES)
            while (true) {
              val count = input.read(buffer)
              if (count < 0) break
              if (count == 0) continue
              completed += count
              if (completed > GemmaModelSpec.SIZE_BYTES) {
                throw GemmaIntegrityException("El archivo supera el tamaño fijado para Gemma 4 E2B.")
              }
              digest.update(buffer, 0, count)
              output.write(buffer, 0, count)
              if (completed >= nextProgress) {
                onProgress(phase, completed)
                nextProgress = completed + PROGRESS_INTERVAL_BYTES
              }
            }
            output.flush()
            fileOutput.fd.sync()
          }
        }
      }

      onProgress("verifying", completed)
      if (completed != GemmaModelSpec.SIZE_BYTES) {
        throw GemmaIntegrityException(
          "El archivo está incompleto: se recibieron $completed de ${GemmaModelSpec.SIZE_BYTES} bytes."
        )
      }
      val sha256 = digest.digest().joinToString("") { byte -> "%02x".format(byte) }
      if (sha256 != GemmaModelSpec.SHA256) {
        throw GemmaIntegrityException("La huella SHA-256 no coincide con el modelo Android fijado.")
      }

      val destination = modelFile(context)
      if (destination.exists() && !destination.delete()) {
        throw GemmaStorageException("No se pudo reemplazar el modelo anterior.")
      }
      if (!staging.renameTo(destination)) {
        throw GemmaStorageException("No se pudo finalizar la instalación verificada de Gemma.")
      }
      val destinationInode = runCatching { Os.stat(destination.absolutePath).st_ino }.getOrDefault(-1L)
      val committed = preferences(context).edit()
        .putString("modelId", GemmaModelSpec.MODEL_ID)
        .putString("revision", GemmaModelSpec.REVISION)
        .putString("fileName", GemmaModelSpec.FILE_NAME)
        .putLong("sizeBytes", GemmaModelSpec.SIZE_BYTES)
        .putString("sha256", GemmaModelSpec.SHA256)
        .putLong("verifiedAt", System.currentTimeMillis())
        .putLong("verifiedLastModified", destination.lastModified())
        .putLong("verifiedInode", destinationInode)
        .commit()
      if (!committed) {
        destination.delete()
        throw GemmaStorageException("No se pudo guardar la verificación local de Gemma.")
      }
      return inspect(context)
    } catch (error: Exception) {
      staging.delete()
      throw error
    }
  }

  companion object {
    private const val BUFFER_BYTES = 1024 * 1024
    private const val PROGRESS_INTERVAL_BYTES = 16L * 1024 * 1024
    private const val STORAGE_RESERVE_BYTES = 256L * 1024 * 1024
  }
}
