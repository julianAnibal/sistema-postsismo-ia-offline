package co.sierraclara.capturequalityproxy

import expo.modules.kotlin.exception.CodedException

internal open class CaptureProxyException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)

internal class InvalidProxyUriException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_INVALID_URI",
  "The capture proxy input must be a non-empty local URI."
)

internal class UnsupportedProxySchemeException(scheme: String?) : CaptureProxyException(
  "ERR_CAPTURE_PROXY_UNSUPPORTED_SCHEME",
  "The capture proxy supports only file and content URIs; received ${scheme ?: "no scheme"}."
)

internal class ProxyInputNotFoundException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_INPUT_NOT_FOUND",
  "The capture proxy input is not a readable regular file."
)

internal class ProxyInputAccessException(cause: Throwable? = null) : CaptureProxyException(
  "ERR_CAPTURE_PROXY_INPUT_ACCESS",
  "The capture proxy input could not be opened.",
  cause
)

internal class ProxyInputTooLargeException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_INPUT_TOO_LARGE",
  "The capture proxy input exceeds the 8 MiB safety limit."
)

internal class InvalidProxyDimensionsException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_INVALID_DIMENSIONS",
  "The capture proxy input has invalid or unsafe pixel dimensions."
)

internal class UnsupportedProxyFormatException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_UNSUPPORTED_FORMAT",
  "The capture proxy input format is not supported by the bounded decoder."
)

internal class AnimatedProxyInputException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_ANIMATED_INPUT",
  "Animated images are not supported as capture evidence proxies."
)

internal class ProxyDecodeException(cause: Throwable? = null) : CaptureProxyException(
  "ERR_CAPTURE_PROXY_DECODE_FAILED",
  "The capture proxy could not decode the image safely.",
  cause
)

internal class ProxyOutputException(cause: Throwable? = null) : CaptureProxyException(
  "ERR_CAPTURE_PROXY_OUTPUT_FAILED",
  "The capture proxy could not write its temporary JPEG.",
  cause
)

internal class ProxyOutOfMemoryException(cause: Throwable? = null) : CaptureProxyException(
  "ERR_CAPTURE_PROXY_OUT_OF_MEMORY",
  "The capture proxy stopped because the device could not reserve bounded image memory.",
  cause
)

internal class CaptureProxyContextLostException : CaptureProxyException(
  "ERR_CAPTURE_PROXY_CONTEXT_LOST",
  "The Android application context is no longer available."
)
