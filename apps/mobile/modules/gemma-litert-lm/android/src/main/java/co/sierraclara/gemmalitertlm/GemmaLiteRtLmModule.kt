package co.sierraclara.gemmalitertlm

import android.content.Context
import android.os.SystemClock
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Conversation
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.LogSeverity
import com.google.ai.edge.litertlm.Message
import com.google.ai.edge.litertlm.MessageCallback
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.ai.edge.litertlm.ThinkingConfig
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class GemmaLiteRtLmModule : Module() {
  private val engineMutex = Mutex()
  private val generationMutex = Mutex()
  private val installMutex = Mutex()
  private val stateLock = Any()
  private val store = GemmaModelStore { phase, completedBytes ->
    sendEvent(
      EVENT_INSTALL_PROGRESS,
      mapOf(
        "phase" to phase,
        "completedBytes" to completedBytes.toDouble(),
        "totalBytes" to GemmaModelSpec.SIZE_BYTES.toDouble()
      )
    )
  }

  @Volatile private var engine: Engine? = null
  @Volatile private var activeConversation: Conversation? = null
  @Volatile private var activeBackend: String? = null

  override fun definition() = ModuleDefinition {
    Name("GemmaLiteRtLm")
    Events(EVENT_INSTALL_PROGRESS, EVENT_GENERATION_CHUNK)

    AsyncFunction("inspectAsync") Coroutine { ->
      withContext(Dispatchers.IO) { statusMap(requireContext()) }
    }

    AsyncFunction("installFromNetworkAsync") Coroutine { ->
      val context = requireContext()
      unloadInternal()
      installMutex.withLock {
        withContext(Dispatchers.IO) {
          store.installFromNetwork(context)
          statusMap(context)
        }
      }
    }

    AsyncFunction("installFromUriAsync") Coroutine { uri: String ->
      val context = requireContext()
      unloadInternal()
      installMutex.withLock {
        withContext(Dispatchers.IO) {
          store.installFromUri(context, uri)
          statusMap(context)
        }
      }
    }

    AsyncFunction("initializeAsync") Coroutine { ->
      val context = requireContext()
      initializeInternal(context)
      statusMap(context)
    }

    AsyncFunction("generateAsync") Coroutine {
      generationId: String,
      systemPrompt: String,
      prompt: String ->
      generateInternal(generationId, systemPrompt, prompt)
    }

    Function("cancelGeneration") {
      try {
        activeConversation?.cancelProcess()
      } catch (_: Exception) {
        // A concurrent completion already released the conversation.
      }
    }

    AsyncFunction("unloadAsync") Coroutine { ->
      unloadInternal()
    }

    OnDestroy {
      shutdownNow()
    }
  }

  private fun requireContext(): Context =
    appContext.reactContext ?: throw GemmaContextLostException()

  private fun statusMap(context: Context): Map<String, Any?> {
    val status = store.inspect(context)
    return mapOf(
      "installed" to status.installed,
      "availableBytes" to status.availableBytes.toDouble(),
      "modelId" to GemmaModelSpec.MODEL_ID,
      "revision" to GemmaModelSpec.REVISION,
      "fileName" to GemmaModelSpec.FILE_NAME,
      "sizeBytes" to GemmaModelSpec.SIZE_BYTES.toDouble(),
      "sha256" to GemmaModelSpec.SHA256,
      "runtime" to GemmaModelSpec.RUNTIME,
      "backend" to activeBackend
    )
  }

  private suspend fun initializeInternal(context: Context) = engineMutex.withLock {
    if (engine != null) return@withLock
    val stored = withContext(Dispatchers.IO) { store.inspect(context) }
    if (!stored.installed) throw GemmaNotInstalledException()

    val cacheDirectory = File(context.cacheDir, "gemma-4-e2b-litert-lm").apply { mkdirs() }
    Engine.setNativeMinLogSeverity(LogSeverity.ERROR)
    var gpuError: Throwable? = null
    val initialized = withContext(Dispatchers.IO) {
      val threads = cpuThreadCount()
      try {
        if (!canLoadOpenCl()) {
          Log.i(TAG, "OpenCL is unavailable; initializing LiteRT-LM on CPU")
          createEngine(stored.modelFile, cacheDirectory, Backend.CPU(threadCount = threads)) to "CPU"
        } else try {
          createEngine(stored.modelFile, cacheDirectory, Backend.GPU()) to "GPU"
        } catch (error: Throwable) {
          gpuError = error
          createEngine(stored.modelFile, cacheDirectory, Backend.CPU(threadCount = threads)) to "CPU"
        }
      } catch (cpuError: Throwable) {
        gpuError?.let { cpuError.addSuppressed(it) }
        throw GemmaInitializationException(cpuError)
      }
    }
    engine = initialized.first
    activeBackend = initialized.second
  }

  private fun canLoadOpenCl(): Boolean = try {
    System.loadLibrary("OpenCL")
    true
  } catch (_: Throwable) {
    false
  }

  private fun cpuThreadCount(): Int =
    (Runtime.getRuntime().availableProcessors() - 1).coerceIn(1, 4)

  private fun createEngine(modelFile: File, cacheDirectory: File, backend: Backend): Engine {
    val candidate = Engine(
      EngineConfig(
        modelPath = modelFile.absolutePath,
        backend = backend,
        maxNumTokens = 2_048,
        cacheDir = cacheDirectory.absolutePath
      )
    )
    return try {
      candidate.initialize()
      candidate
    } catch (error: Throwable) {
      if (candidate.isInitialized()) {
        try {
          candidate.close()
        } catch (_: Exception) {
          // Preserve the initialization failure as the actionable cause.
        }
      }
      throw error
    }
  }

  private suspend fun generateInternal(
    generationId: String,
    systemPrompt: String,
    prompt: String
  ): Map<String, Any> = generationMutex.withLock {
    engine ?: throw GemmaNotInstalledException()
    if (prompt.isBlank()) throw GemmaGenerationException(IllegalArgumentException("Empty prompt"))
    val startedAt = SystemClock.elapsedRealtime()
    val text = StringBuilder()
    try {
      try {
        generateOnce(
          currentEngine = engine ?: throw GemmaNotInstalledException(),
          generationId = generationId,
          systemPrompt = systemPrompt,
          prompt = prompt,
          text = text
        )
      } catch (gpuError: Throwable) {
        if (activeBackend != "GPU" || text.isNotEmpty()) throw gpuError
        Log.w(TAG, "GPU generation failed before the first token; retrying on CPU", gpuError)
        initializeCpuFallback(requireContext())
        try {
          generateOnce(
            currentEngine = engine ?: throw GemmaNotInstalledException(),
            generationId = generationId,
            systemPrompt = systemPrompt,
            prompt = prompt,
            text = text
          )
        } catch (cpuError: Throwable) {
          cpuError.addSuppressed(gpuError)
          throw cpuError
        }
      }
      mapOf(
        "text" to text.toString().trim(),
        "elapsedMilliseconds" to (SystemClock.elapsedRealtime() - startedAt).toDouble(),
        "backend" to (activeBackend ?: "unknown")
      )
    } catch (error: GemmaNativeException) {
      throw error
    } catch (error: Throwable) {
      Log.e(TAG, "LiteRT-LM generation failed", error)
      throw GemmaGenerationException(error)
    }
  }

  private suspend fun generateOnce(
    currentEngine: Engine,
    generationId: String,
    systemPrompt: String,
    prompt: String,
    text: StringBuilder
  ) {
    val conversation = withContext(Dispatchers.Default) {
      currentEngine.createConversation(
        ConversationConfig(
          systemInstruction = Contents.of(systemPrompt),
          samplerConfig = SamplerConfig(
            topK = 16,
            topP = 0.9,
            temperature = 0.15,
            seed = 1_000
          ),
          maxOutputToken = 256,
          thinkingConfig = ThinkingConfig(enableThinking = false, thinkingTokenBudget = 0)
        )
      )
    }
    synchronized(stateLock) { activeConversation = conversation }
    try {
      withContext(Dispatchers.Default) {
        suspendCancellableCoroutine { continuation ->
          val completed = AtomicBoolean(false)
          continuation.invokeOnCancellation {
            if (completed.compareAndSet(false, true)) {
              try {
                conversation.cancelProcess()
              } catch (_: Exception) {
                // The native callback completed concurrently with cancellation.
              }
            }
          }
          conversation.sendMessageAsync(prompt, object : MessageCallback {
            override fun onMessage(message: Message) {
              if (completed.get()) return
              val chunk = message.toString()
              if (chunk.isEmpty()) return
              text.append(chunk)
              sendEvent(
                EVENT_GENERATION_CHUNK,
                mapOf(
                  "generationId" to generationId,
                  "text" to text.toString(),
                  "chunk" to chunk
                )
              )
            }

            override fun onDone() {
              if (completed.compareAndSet(false, true)) continuation.resume(Unit)
            }

            override fun onError(error: Throwable) {
              if (completed.compareAndSet(false, true)) continuation.resumeWithException(error)
            }
          })
        }
      }
    } finally {
      synchronized(stateLock) {
        if (activeConversation === conversation) activeConversation = null
      }
      if (conversation.isAlive) {
        try {
          conversation.close()
        } catch (_: Exception) {
          // Native resources were already released by cancellation or teardown.
        }
      }
    }
  }

  private suspend fun initializeCpuFallback(context: Context) = engineMutex.withLock {
    closeEngine()
    val stored = withContext(Dispatchers.IO) { store.inspect(context) }
    if (!stored.installed) throw GemmaNotInstalledException()
    val cacheDirectory = File(context.cacheDir, "gemma-4-e2b-litert-lm").apply { mkdirs() }
    val threads = cpuThreadCount()
    val cpuEngine = withContext(Dispatchers.IO) {
      createEngine(stored.modelFile, cacheDirectory, Backend.CPU(threadCount = threads))
    }
    engine = cpuEngine
    activeBackend = "CPU"
  }

  private suspend fun unloadInternal() {
    try {
      activeConversation?.cancelProcess()
    } catch (_: Exception) {
      // The generation may have completed between the read and cancellation.
    }
    generationMutex.withLock {
      engineMutex.withLock {
        closeEngine()
      }
    }
  }

  private fun closeEngine() {
    val current = engine
    engine = null
    activeBackend = null
    if (current?.isInitialized() == true) {
      try {
        current.close()
      } catch (_: Exception) {
        // The process is already tearing down; no recoverable state remains.
      }
    }
  }

  private fun shutdownNow() {
    try {
      activeConversation?.cancelProcess()
    } catch (_: Exception) {
      // Best-effort lifecycle cleanup.
    }
    closeEngine()
  }

  companion object {
    private const val TAG = "GemmaLiteRtLm"
    private const val EVENT_INSTALL_PROGRESS = "onGemmaInstallProgress"
    private const val EVENT_GENERATION_CHUNK = "onGemmaGenerationChunk"
  }
}
