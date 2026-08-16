package co.sierraclara.gemmalitertlm

import expo.modules.kotlin.exception.CodedException

internal open class GemmaNativeException(
  code: String,
  message: String,
  cause: Throwable? = null
) : CodedException(code, message, cause)

internal class GemmaContextLostException : GemmaNativeException(
  "ERR_GEMMA_CONTEXT_LOST",
  "El contexto Android ya no está disponible."
)

internal class GemmaNotInstalledException : GemmaNativeException(
  "ERR_GEMMA_NOT_INSTALLED",
  "Instale y verifique Gemma 4 E2B antes de cargarlo."
)

internal class GemmaBusyException : GemmaNativeException(
  "ERR_GEMMA_BUSY",
  "Gemma ya está procesando otra operación."
)

internal class GemmaStorageException(message: String, cause: Throwable? = null) :
  GemmaNativeException("ERR_GEMMA_STORAGE", message, cause)

internal class GemmaDownloadException(message: String, cause: Throwable? = null) :
  GemmaNativeException("ERR_GEMMA_DOWNLOAD", message, cause)

internal class GemmaImportException(message: String, cause: Throwable? = null) :
  GemmaNativeException("ERR_GEMMA_IMPORT", message, cause)

internal class GemmaIntegrityException(message: String) :
  GemmaNativeException("ERR_GEMMA_INTEGRITY", message)

internal class GemmaInitializationException(cause: Throwable) : GemmaNativeException(
  "ERR_GEMMA_INITIALIZATION",
  "Gemma no pudo inicializarse con GPU ni con el respaldo CPU en este teléfono.",
  cause
)

internal class GemmaGenerationException(cause: Throwable) : GemmaNativeException(
  "ERR_GEMMA_GENERATION",
  "Gemma no pudo completar la respuesta local (${cause.javaClass.simpleName}: ${cause.message ?: "sin detalle"}).",
  cause
)
