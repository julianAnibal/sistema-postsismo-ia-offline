# Registro de evidencia y preparación de campo

> **Actualización posterior:** las secciones del APK original sin Gemma se
> conservan como evidencia histórica. El APK Android actual con Gemma nativo,
> su hash y la inferencia sin red están en
> [`CROSS-TASK-HANDOFF.md`](CROSS-TASK-HANDOFF.md) y
> [`android-gemma-apk-v1.json`](evidence/android-gemma-apk-v1.json).

**Corte:** 2026-08-16
**Decisión actual:** **NO-GO para diagnóstico, triaje, habitabilidad y despliegue de campo.**
**Sí está listo:** un prototipo local de captura y revisión humana, más una
tubería reproducible que puede rechazar un modelo cuando falla.

Este registro no equipara “compila”, “da una métrica alta” o “funciona en un
Mac” con capacidad profesional en un sismo. El expediente completo y la persona
autorizada son la unidad de decisión; una foto nunca es autoridad.

## Matriz de afirmaciones

| Afirmación | Estado | Prueba o razón |
| --- | --- | --- |
| La app web exportada funciona sin backend | Probado localmente | Exportación de producción, PWA, persistencia y consulta determinista sin modelo remoto. |
| Gemma 4 E2B genera borradores sin red después de instalarse | Probado una vez en Chrome/macOS; teléfono pendiente | Artefacto web de 2.008.432.640 bytes verificado por SHA-256, LiteRT-LM/WebGPU, servidor local devolviendo 404, hosts del modelo bloqueados y cero solicitudes durante una generación de 6,8 s. No prueba soporte ni consumo en teléfonos. |
| La ruta nativa evita guardar fotos Base64 en AsyncStorage | Implementada; humo Android en emulador aprobado; validación física pendiente | Guarda un archivo content-addressed en el sandbox, SHA-256 de sus bytes y solo metadatos/URI en el estado. Con modo avión y sin red activa, el selector importó una imagen, la persistió como archivo de app y verificó su integridad. Cámara, reapertura y matriz de codecs todavía requieren teléfonos. La ruta iOS no se compiló ni validó. |
| El proxy de 96 px usa cero modelo y cero red | Ejecutado una vez en Android API 35, en shadow mode | Con modo avión y sin red activa, el módulo Android procesó la imagen importada y la UI registró una medición sin señal extrema. Las pruebas puras cubren negro, blanco, textura y buffer inválido. iOS y web reportan no soportado; una ejecución de emulador no valida EXIF, otros codecs/API/OEM ni memoria física. |
| El CNN de 4.588 parámetros aprende las corrupciones sintéticas registradas | Probado solo como benchmark de desarrollo | ONNX de 25.542 bytes, paridad y test de parches de hormigón. |
| Ese CNN sirve como control de calidad de cámara | **Refutado / NO-GO** | 39,58% de controles limpios activaron alguna alerta con el primer umbral. El umbral v2 bajó las alertas, pero el límite inferior de recall de “sobreexposición” fue 52,26%, muy por debajo del 90% exigido. |
| La app detecta daño, mecanismo o severidad | **No probado y prohibido afirmar** | No existe dataset postsismo anotado, test independiente por edificio/evento ni modelo liberado. |
| La app decide seguridad, habitabilidad, evacuación o prioridad oficial | **Fuera de alcance** | La app registra observaciones y revisiones de prototipo. La decisión de autoridad ocurre fuera del sistema actual; no existe un evento de aprobación oficial implementado. |
| La exportación reducida es anónima, pública o segura por sí sola | **Falso** | Omite fotos, URI, coordenadas exactas, EXIF, notas libres y salida de modelo, pero conserva IDs, horas, hashes, conteos, necesidades, anotaciones, alias de dispositivo y cola. Está rotulada `restricted-personal-and-operational-data` y requiere receptor autorizado y canal cifrado aprobado. |
| El consumo es mínimo en teléfonos de campo | Pendiente | El APK no contiene runtime/modelo ML y se obtuvo un snapshot de emulador, pero faltan RAM pico, batería, térmica, inicio frío, cámara y operación sostenida en teléfonos físicos. |

## Experimento de calidad de captura

### Fuente y derechos

Se usó el mirror de Hugging Face
[`mohammadnajeeb/concrete_crack_images`](https://huggingface.co/datasets/mohammadnajeeb/concrete_crack_images)
en la revisión inmutable
`897883867b6cb1059b7a4b44fe2689e6a7944386`. El ZIP mide 49.121.094 bytes y
su SHA-256 es
`c6471f0341ad169c37f52058405661ac06f495438744c67be208fc110cd218c6`.
El upstream es [Mendeley Data v2](https://data.mendeley.com/datasets/5y9wdsg2zt/2),
DOI `10.17632/5y9wdsg2zt.2`, bajo CC-BY-4.0.

La licencia permite este benchmark, pero la semántica no permite afirmar
desempeño postsismo: son parches de hormigón y sus etiquetas crack/no-crack se
usaron solamente para estratificar. Nunca fueron salidas del modelo.

### Fuga y unidad estadística

- 8.000 registros: 5.600 train, 1.200 validación y 1.200 test;
- balance 50/50 del rótulo nuisance en cada split;
- 237 grupos de duplicados exactos que abarcan 491 archivos;
- 7.538 clusters después de agrupar pHash a distancia Hamming máxima 4;
- cero cluster compartido entre train, validación y test.

El mirror no conserva el ID de la foto madre de las 458 fotografías originales.
Por eso esta partición reduce fuga obvia, pero **no demuestra independencia de
escena**. El resultado tampoco puede convertirse en evidencia de geografía,
edificio, evento, inspector o dispositivo independiente.

### Candidato y prueba adversarial de la propia métrica

El candidato es un CNN depthwise de 4.588 parámetros con entrada RGB 96×96. El
ONNX FP32 mide 25.542 bytes; SHA-256
`64a057ef456befa9eda477e38511fc4d3fa228d1098884e9451bb77e835d116e`.
El checker ONNX aprobó y la diferencia absoluta máxima frente a PyTorch fue
`4,76837158203125e-6`.

El primer reporte dio AUROC macro 0,99843 y aprobó automáticamente. Una auditoría
posterior encontró que el denominador one-vs-rest mezclaba otras corrupciones con
los negativos. Medido correctamente sobre 1.200 controles sin transformar, 475
activaron alguna alerta: 39,58%, IC Wilson 95% [36,85%, 42,38%]. El reporte
original se preservó y una auditoría inmutable lo **supersedió como NO-GO**.

Se fijó un operating point v2 exclusivamente en validación. Allí la alerta sobre
controles limpios fue 1,50%, con límite superior 95% de 2,36%, pero el recall de
sobreexposición quedó en 55,08%, con límite inferior 95% de 52,26%. La puerta
exigía al menos 90% para cada defecto. La auditoría ejecutable concluyó
`do-not-open`; no se descargó ni abrió otro test y el modelo no se integró.

Esto es evidencia útil: una imagen naturalmente clara y una mezcla blanca
sintética no definen por sí solas una falla fotográfica observable. La siguiente
versión debe anclarse en un protocolo real (píxeles recortados, rango dinámico,
vista requerida y juicio del inspector), no simplemente aumentar parámetros.

### Rendimiento que sí se midió

En macOS ARM64, ONNX Runtime 1.24.3, CPU, un hilo y 1.000 ejecuciones: inicio de
sesión 34,47 ms; primera inferencia 1,55 ms; p50 0,125 ms; p95 0,385 ms; p99
0,912 ms; incremento RSS de sesión 6.406.144 bytes. Esto prueba que el artefacto
es pequeño en ese host. **No prueba latencia, RAM, batería o temperatura Android.**

El snapshot legible por máquina está en
[`docs/evidence/capture-quality-synthetic-v1.json`](evidence/capture-quality-synthetic-v1.json).

## APK Android y humo en emulador

Se construyó e instaló un APK local de prueba para `arm64-v8a`:

- artefacto: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`;
- tamaño: 30.200.904 bytes;
- SHA-256: `8347be1f058c55d78a9a001ca07ecd2b679703ae11ffef900999d6a28c5628d3`;
- paquete `co.sierraclara.campo`, `minSdk 24`, `targetSdk 36`;
- contiene el módulo `CaptureQualityProxy`, pero ningún `.onnx` o `.litertlm`;
- no solicita `INTERNET`, `RECORD_AUDIO` ni `SYSTEM_ALERT_WINDOW`;
- está firmado con el certificado **Android Debug**, así que no es un binario de
  distribución ni prueba una cadena de release.

En un emulador Android API 35 ARM64, el APK se instaló y el primer arranque en
frío de `MainActivity` terminó con estado `ok` en 6.037 ms. Después se activó
modo avión, `dumpsys connectivity` confirmó `Active default network: none` y un
nuevo arranque con proceso frío terminó `ok` en 1.388 ms. Un snapshot posterior
mostró PSS total de 83.707 KB y RSS de 211.784 KB, sin swap. Son observaciones
puntuales de una ejecución virtual —no picos— y **no son un benchmark de
teléfono** ni establecen RAM mínima, batería o comportamiento térmico.

Todavía sin red activa, se importó una imagen desde el selector del sistema. La
app la materializó como archivo de aplicación, verificó su SHA-256 y ejecutó el
puente Kotlin–Expo–TypeScript: la interfaz mostró `Proxy local: medido sin señal
extrema · no equivale a calidad aprobada`. No apareció un fatal ni un ANR de la
app en la ventana final de `logcat`. Esto prueba el camino nominal una vez; no
la matriz de orientaciones EXIF, codecs, APIs, fabricantes ni fallos.

El registro legible por máquina está en
[`docs/evidence/android-local-build-v1.json`](evidence/android-local-build-v1.json),
con capturas del [arranque sin red](evidence/android-emulator-airplane.png) y la
[medición del proxy nativo](evidence/android-native-proxy-smoke.png).

## Ruta móvil escogida

El modelo fallido no se empacó. La aplicación usa el camino que consume menos y
mantiene mayor honestidad:

1. metadatos y protocolo de captura;
2. proxy nativo Android con lado largo máximo de 96 px;
3. archivos binarios fuera de AsyncStorage en la ruta nativa; la PWA conserva
   un fallback Base64 limitado a 2,5 MB;
4. decodificación TypeScript del proxy JPEG limitada a 1 MP y 4 MB;
5. señales solo para extremos casi totalmente negros, blancos o uniformes;
6. shadow mode: registra, pero nunca aprueba una foto ni bloquea una inspección;
7. el cliente Android conserva cero runtime ML y cero modelo; la PWA añade un
   runtime LiteRT-LM local de aproximadamente 31 MB y un Gemma 4 E2B separado de
   1,87 GiB, guardado una sola vez en OPFS y nunca en el cache del service worker.

El proxy usa un módulo Expo local escrito para Android y `jpeg-js` con límites.
No usa `expo-image-manipulator`. En iOS y web queda explícitamente no soportado.
Un runtime ONNX queda aplazado porque no existe un modelo aprobado y cualquier
runtime debe medirse, fijarse por versión y validarse en el dispositivo exacto.

## Puertas que faltan para poder afirmar “funciona en campo”

1. **Protocolo y taxonomía:** profesionales colombianos definen vistas,
   exclusiones, observables y cuándo repetir una foto.
2. **Datos propios legalmente gobernados:** consentimiento/licencia, privacidad,
   IDs de edificio y evento, dispositivos, inspectores y adjudicación doble.
3. **Test realmente sellado:** eventos/territorios/dispositivos futuros, OOD,
   calibración, abstención e intervalos por unidad independiente.
4. **Hardware:** mínimo tres estratos ARM64 (bajo, medio y soportado), cámara,
   importación y reapertura con fixtures EXIF/codec, OOM, térmica, batería y
   corrida sostenida. El humo nominal de importación y modo avión ya pasó solo
   en el emulador API 35.
5. **Flujo humano:** ensayo humano solo frente a humano+herramienta, omisiones,
   falsas alertas, tiempo, overrides y carga por 100 expedientes.
6. **Seguridad operacional:** cifrado/retención, control de acceso, firma de
   paquetes, revocación, exportación y recuperación auditadas.

Hasta que todas esas puertas pasen, las palabras correctas son **prototipo local
de captura y apoyo**, no “IA que diagnostica edificaciones”.

## Reproducción

```bash
UV_PROJECT_ENVIRONMENT=.venv-validation uv sync --frozen
UV_PROJECT_ENVIRONMENT=.venv-validation zsh scripts/validate.sh
```

Ese recorrido aprobó 42 pruebas Python y 38 pruebas móviles en 11 archivos,
además de typecheck y exportación web. La compilación/instalación Android y el
humo de emulador son pruebas separadas; no se deben reinterpretar como prueba de
campo.

La evidencia Gemma legible por máquina y su captura están en
[`docs/evidence/gemma-e2b-web-v1.json`](evidence/gemma-e2b-web-v1.json) y
[`docs/evidence/gemma-e2b-offline-proof.png`](evidence/gemma-e2b-offline-proof.png).

Los comandos de adquisición, split, entrenamiento, evaluación y auditoría están
documentados en [`docs/training-runbook.md`](training-runbook.md). Los artefactos
pesados y los datos permanecen en `private-data/`; solo se versionan procedencia,
código, configuración y este snapshot de resultados.
