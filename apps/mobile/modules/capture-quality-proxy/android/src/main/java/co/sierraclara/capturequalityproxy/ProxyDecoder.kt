package co.sierraclara.capturequalityproxy

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorSpace
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import androidx.annotation.RequiresApi
import androidx.exifinterface.media.ExifInterface
import java.io.Closeable
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

internal object ProxyDecoder {
  private const val PROXY_LONG_EDGE = 96
  private const val JPEG_QUALITY = 90
  private const val STREAM_BUFFER_BYTES = 32 * 1024
  private const val MAX_INPUT_BYTES = 8L * 1024L * 1024L
  private const val MAX_OUTPUT_BYTES = 512L * 1024L
  private const val MAX_SOURCE_DIMENSION = 32_768
  private const val MAX_SOURCE_PIXELS = 80_000_000L

  private val imageDecoderMimeTypes = setOf(
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif"
  )

  private val bitmapFactoryMimeTypes = setOf(
    "image/jpeg",
    "image/png"
  )

  fun generate(context: Context, cacheDirectory: File, inputUri: String): Map<String, Any?> {
    val startedAt = SystemClock.elapsedRealtime()
    try {
      val parsedUri = parseLocalUri(inputUri)
      PreparedInput.create(context, cacheDirectory, parsedUri).use { prepared ->
        val bounds = readBounds(prepared.file)
        val exif = readExifTransform(prepared.file)
        val decoded = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          decodeWithImageDecoder(prepared.file, bounds, exif)
        } else {
          decodeWithBitmapFactory(prepared.file, bounds, exif)
        }

        try {
          val output = writeTemporaryJpeg(cacheDirectory, decoded.bitmap)
          return mapOf(
            "uri" to Uri.fromFile(output.file).toString(),
            "width" to decoded.bitmap.width,
            "height" to decoded.bitmap.height,
            "encodedWidth" to bounds.width,
            "encodedHeight" to bounds.height,
            "sourceWidth" to decoded.sourceWidth,
            "sourceHeight" to decoded.sourceHeight,
            "decodedWidth" to decoded.decodedWidth,
            "decodedHeight" to decoded.decodedHeight,
            "inputBytes" to prepared.bytes,
            "encodedBytes" to output.bytes,
            "decoder" to decoded.decoder,
            "requestedSampleSize" to decoded.requestedSampleSize,
            "exifOrientation" to exif.orientation,
            "orientationApplied" to (exif.orientation != ExifInterface.ORIENTATION_NORMAL),
            "processingMilliseconds" to (SystemClock.elapsedRealtime() - startedAt)
          )
        } finally {
          decoded.bitmap.recycleSafely()
        }
      }
    } catch (error: CaptureProxyException) {
      throw error
    } catch (error: OutOfMemoryError) {
      throw ProxyOutOfMemoryException(error)
    } catch (error: SecurityException) {
      throw ProxyInputAccessException(error)
    } catch (error: IOException) {
      throw ProxyDecodeException(error)
    }
  }

  private fun parseLocalUri(rawUri: String): Uri {
    if (rawUri.isBlank()) throw InvalidProxyUriException()
    val uri = try {
      Uri.parse(rawUri)
    } catch (_: RuntimeException) {
      throw InvalidProxyUriException()
    }
    val scheme = uri.scheme?.lowercase(Locale.ROOT)
    if (scheme != "file" && scheme != "content") {
      throw UnsupportedProxySchemeException(scheme)
    }
    if (scheme == "file" && !uri.authority.isNullOrEmpty()) {
      throw InvalidProxyUriException()
    }
    if (scheme == "content" && uri.authority.isNullOrBlank()) {
      throw InvalidProxyUriException()
    }
    return uri
  }

  private fun readBounds(file: File): ImageBounds {
    val options = BitmapFactory.Options().apply {
      inJustDecodeBounds = true
    }
    try {
      FileInputStream(file).buffered(STREAM_BUFFER_BYTES).use { stream ->
        BitmapFactory.decodeStream(stream, null, options)
      }
    } catch (error: IOException) {
      throw ProxyInputAccessException(error)
    }
    validateDimensions(options.outWidth, options.outHeight)
    val mimeType = options.outMimeType?.lowercase(Locale.ROOT)
      ?: throw UnsupportedProxyFormatException()
    return ImageBounds(options.outWidth, options.outHeight, mimeType)
  }

  private fun validateDimensions(width: Int, height: Int) {
    if (width <= 0 || height <= 0) throw InvalidProxyDimensionsException()
    if (width > MAX_SOURCE_DIMENSION || height > MAX_SOURCE_DIMENSION) {
      throw InvalidProxyDimensionsException()
    }
    if (width.toLong() * height.toLong() > MAX_SOURCE_PIXELS) {
      throw InvalidProxyDimensionsException()
    }
  }

  private fun readExifTransform(file: File): ExifTransform {
    val orientation = try {
      ExifInterface(file).getAttributeInt(
        ExifInterface.TAG_ORIENTATION,
        ExifInterface.ORIENTATION_NORMAL
      )
    } catch (_: IOException) {
      ExifInterface.ORIENTATION_NORMAL
    }
    return when (orientation) {
      ExifInterface.ORIENTATION_NORMAL -> ExifTransform(orientation, false, 0)
      ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> ExifTransform(orientation, true, 0)
      ExifInterface.ORIENTATION_ROTATE_180 -> ExifTransform(orientation, false, 180)
      ExifInterface.ORIENTATION_FLIP_VERTICAL -> ExifTransform(orientation, true, 180)
      ExifInterface.ORIENTATION_TRANSPOSE -> ExifTransform(orientation, true, 270)
      ExifInterface.ORIENTATION_ROTATE_90 -> ExifTransform(orientation, false, 90)
      ExifInterface.ORIENTATION_TRANSVERSE -> ExifTransform(orientation, true, 90)
      ExifInterface.ORIENTATION_ROTATE_270 -> ExifTransform(orientation, false, 270)
      else -> ExifTransform(ExifInterface.ORIENTATION_NORMAL, false, 0)
    }
  }

  @RequiresApi(Build.VERSION_CODES.P)
  private fun decodeWithImageDecoder(
    file: File,
    bounds: ImageBounds,
    exif: ExifTransform
  ): DecodedProxy {
    if (bounds.mimeType !in imageDecoderMimeTypes) throw UnsupportedProxyFormatException()

    var sourceWidth = displayWidth(bounds, exif)
    var sourceHeight = displayHeight(bounds, exif)
    var target = targetSize(sourceWidth, sourceHeight)
    val bitmap = try {
      ImageDecoder.decodeBitmap(ImageDecoder.createSource(file)) { decoder, info, _ ->
        if (info.isAnimated) throw AnimatedProxyInputException()
        if (info.mimeType.lowercase(Locale.ROOT) !in imageDecoderMimeTypes) {
          throw UnsupportedProxyFormatException()
        }
        validateDimensions(info.size.width, info.size.height)
        sourceWidth = info.size.width
        sourceHeight = info.size.height
        target = targetSize(sourceWidth, sourceHeight)
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        decoder.setTargetColorSpace(ColorSpace.get(ColorSpace.Named.SRGB))
        decoder.setTargetSize(target.width, target.height)
      }
    } catch (error: CaptureProxyException) {
      throw error
    } catch (error: OutOfMemoryError) {
      throw ProxyOutOfMemoryException(error)
    } catch (error: IOException) {
      throw ProxyDecodeException(error)
    } catch (error: RuntimeException) {
      throw ProxyDecodeException(error)
    }

    val decodedWidth = bitmap.width
    val decodedHeight = bitmap.height
    val finalBitmap = try {
      renderOpaqueTarget(bitmap, target)
    } catch (error: Throwable) {
      bitmap.recycleSafely()
      throw error
    }
    if (finalBitmap !== bitmap) bitmap.recycleSafely()
    return DecodedProxy(
      bitmap = finalBitmap,
      sourceWidth = sourceWidth,
      sourceHeight = sourceHeight,
      decodedWidth = decodedWidth,
      decodedHeight = decodedHeight,
      decoder = "image-decoder",
      requestedSampleSize = null
    )
  }

  private fun decodeWithBitmapFactory(
    file: File,
    bounds: ImageBounds,
    exif: ExifTransform
  ): DecodedProxy {
    if (bounds.mimeType !in bitmapFactoryMimeTypes) throw UnsupportedProxyFormatException()
    val sampleSize = calculateSampleSize(bounds.width, bounds.height)
    val options = BitmapFactory.Options().apply {
      inJustDecodeBounds = false
      inSampleSize = sampleSize
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inScaled = false
      inMutable = false
    }
    val decoded = try {
      FileInputStream(file).buffered(STREAM_BUFFER_BYTES).use { stream ->
        BitmapFactory.decodeStream(stream, null, options)
      } ?: throw ProxyDecodeException()
    } catch (error: CaptureProxyException) {
      throw error
    } catch (error: OutOfMemoryError) {
      throw ProxyOutOfMemoryException(error)
    } catch (error: IOException) {
      throw ProxyDecodeException(error)
    } catch (error: RuntimeException) {
      throw ProxyDecodeException(error)
    }

    var oriented: Bitmap? = null
    try {
      oriented = applyExifTransform(decoded, exif)
      val target = targetSize(oriented.width, oriented.height)
      val finalBitmap = renderOpaqueTarget(oriented, target)
      val result = DecodedProxy(
        bitmap = finalBitmap,
        sourceWidth = displayWidth(bounds, exif),
        sourceHeight = displayHeight(bounds, exif),
        decodedWidth = decoded.width,
        decodedHeight = decoded.height,
        decoder = "bitmap-factory",
        requestedSampleSize = sampleSize
      )
      if (oriented !== finalBitmap) oriented.recycleSafely()
      if (decoded !== oriented && decoded !== finalBitmap) decoded.recycleSafely()
      return result
    } catch (error: Throwable) {
      if (oriented !== decoded) oriented?.recycleSafely()
      decoded.recycleSafely()
      throw error
    }
  }

  private fun calculateSampleSize(width: Int, height: Int): Int {
    val longEdge = max(width, height)
    var sampleSize = 1
    while (sampleSize <= Int.MAX_VALUE / 2 && longEdge / (sampleSize * 2) >= PROXY_LONG_EDGE) {
      sampleSize *= 2
    }
    return sampleSize
  }

  private fun applyExifTransform(source: Bitmap, exif: ExifTransform): Bitmap {
    if (!exif.flippedHorizontally && exif.rotationDegrees == 0) return source
    val matrix = Matrix()
    if (exif.flippedHorizontally) {
      matrix.setScale(-1f, 1f)
      if (exif.rotationDegrees != 0) matrix.postRotate(exif.rotationDegrees.toFloat())
    } else {
      matrix.setRotate(exif.rotationDegrees.toFloat())
    }
    return try {
      Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    } catch (error: OutOfMemoryError) {
      throw ProxyOutOfMemoryException(error)
    } catch (error: RuntimeException) {
      throw ProxyDecodeException(error)
    }
  }

  private fun renderOpaqueTarget(source: Bitmap, target: PixelSize): Bitmap {
    if (source.width == target.width && source.height == target.height && !source.hasAlpha()) {
      return source
    }
    val output = try {
      Bitmap.createBitmap(target.width, target.height, Bitmap.Config.ARGB_8888)
    } catch (error: OutOfMemoryError) {
      throw ProxyOutOfMemoryException(error)
    }
    try {
      val canvas = Canvas(output)
      canvas.drawColor(Color.WHITE)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG or Paint.DITHER_FLAG)
      canvas.drawBitmap(
        source,
        null,
        Rect(0, 0, target.width, target.height),
        paint
      )
      output.setHasAlpha(false)
      return output
    } catch (error: Throwable) {
      output.recycleSafely()
      throw error
    }
  }

  private fun targetSize(width: Int, height: Int): PixelSize {
    validateDimensions(width, height)
    val requestedLongEdge = min(PROXY_LONG_EDGE, max(width, height))
    return if (width >= height) {
      PixelSize(
        requestedLongEdge,
        max(1, (height.toDouble() * requestedLongEdge.toDouble() / width.toDouble()).roundToInt())
      )
    } else {
      PixelSize(
        max(1, (width.toDouble() * requestedLongEdge.toDouble() / height.toDouble()).roundToInt()),
        requestedLongEdge
      )
    }
  }

  private fun displayWidth(bounds: ImageBounds, exif: ExifTransform): Int =
    if (exif.rotationDegrees == 90 || exif.rotationDegrees == 270) bounds.height else bounds.width

  private fun displayHeight(bounds: ImageBounds, exif: ExifTransform): Int =
    if (exif.rotationDegrees == 90 || exif.rotationDegrees == 270) bounds.width else bounds.height

  private fun writeTemporaryJpeg(cacheDirectory: File, bitmap: Bitmap): ProxyOutput {
    val output = try {
      File.createTempFile("capture-quality-proxy-", ".jpg", cacheDirectory)
    } catch (error: IOException) {
      throw ProxyOutputException(error)
    }
    var complete = false
    try {
      FileOutputStream(output).buffered(STREAM_BUFFER_BYTES).use { stream ->
        if (!bitmap.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, stream)) {
          throw ProxyOutputException()
        }
      }
      val bytes = output.length()
      if (bytes <= 0L || bytes > MAX_OUTPUT_BYTES) throw ProxyOutputException()
      complete = true
      return ProxyOutput(output, bytes)
    } catch (error: CaptureProxyException) {
      throw error
    } catch (error: IOException) {
      throw ProxyOutputException(error)
    } finally {
      if (!complete) output.deleteQuietly()
    }
  }

  private fun Bitmap.recycleSafely() {
    if (!isRecycled) recycle()
  }

  private fun File.deleteQuietly() {
    try {
      delete()
    } catch (_: SecurityException) {
      // Cache cleanup must never hide the original decoding result or error.
    }
  }

  private data class ImageBounds(val width: Int, val height: Int, val mimeType: String)

  private data class ExifTransform(
    val orientation: Int,
    val flippedHorizontally: Boolean,
    val rotationDegrees: Int
  )

  private data class PixelSize(val width: Int, val height: Int)

  private data class DecodedProxy(
    val bitmap: Bitmap,
    val sourceWidth: Int,
    val sourceHeight: Int,
    val decodedWidth: Int,
    val decodedHeight: Int,
    val decoder: String,
    val requestedSampleSize: Int?
  )

  private data class ProxyOutput(val file: File, val bytes: Long)

  private class PreparedInput private constructor(
    val file: File,
    val bytes: Long,
    private val temporary: Boolean
  ) : Closeable {
    override fun close() {
      if (temporary) file.deleteQuietly()
    }

    companion object {
      fun create(context: Context, cacheDirectory: File, uri: Uri): PreparedInput {
        return when (uri.scheme?.lowercase(Locale.ROOT)) {
          "file" -> fromFileUri(uri)
          "content" -> fromContentUri(context, cacheDirectory, uri)
          else -> throw UnsupportedProxySchemeException(uri.scheme)
        }
      }

      private fun fromFileUri(uri: Uri): PreparedInput {
        val path = uri.path?.takeIf { it.isNotBlank() } ?: throw InvalidProxyUriException()
        val file = File(path)
        val bytes = try {
          if (!file.exists() || !file.isFile || !file.canRead()) throw ProxyInputNotFoundException()
          file.length()
        } catch (error: SecurityException) {
          throw ProxyInputAccessException(error)
        }
        validateInputBytes(bytes)
        return PreparedInput(file, bytes, false)
      }

      private fun fromContentUri(
        context: Context,
        cacheDirectory: File,
        uri: Uri
      ): PreparedInput {
        val staged = try {
          File.createTempFile("capture-quality-input-", ".bin", cacheDirectory)
        } catch (error: IOException) {
          throw ProxyInputAccessException(error)
        }
        var complete = false
        try {
          val input = try {
            context.contentResolver.openInputStream(uri)
          } catch (error: SecurityException) {
            throw ProxyInputAccessException(error)
          } ?: throw ProxyInputAccessException()
          var total = 0L
          input.use { source ->
            FileOutputStream(staged).buffered(STREAM_BUFFER_BYTES).use { destination ->
              val buffer = ByteArray(STREAM_BUFFER_BYTES)
              while (true) {
                val count = source.read(buffer)
                if (count < 0) break
                if (count == 0) {
                  val singleByte = source.read()
                  if (singleByte < 0) break
                  if (total >= MAX_INPUT_BYTES) throw ProxyInputTooLargeException()
                  destination.write(singleByte)
                  total += 1L
                  continue
                }
                if (total > MAX_INPUT_BYTES - count.toLong()) throw ProxyInputTooLargeException()
                destination.write(buffer, 0, count)
                total += count.toLong()
              }
            }
          }
          validateInputBytes(total)
          complete = true
          return PreparedInput(staged, total, true)
        } catch (error: CaptureProxyException) {
          throw error
        } catch (error: IOException) {
          throw ProxyInputAccessException(error)
        } finally {
          if (!complete) staged.deleteQuietly()
        }
      }

      private fun validateInputBytes(bytes: Long) {
        if (bytes <= 0L) throw ProxyInputNotFoundException()
        if (bytes > MAX_INPUT_BYTES) throw ProxyInputTooLargeException()
      }
    }
  }
}
