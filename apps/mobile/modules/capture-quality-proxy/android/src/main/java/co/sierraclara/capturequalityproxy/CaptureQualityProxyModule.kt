package co.sierraclara.capturequalityproxy

import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CaptureQualityProxyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CaptureQualityProxy")

    AsyncFunction("generateProxyAsync") Coroutine { uri: String ->
      val context = appContext.reactContext ?: throw CaptureProxyContextLostException()
      withContext(Dispatchers.IO) {
        ProxyDecoder.generate(context, appContext.cacheDirectory, uri)
      }
    }
  }
}
