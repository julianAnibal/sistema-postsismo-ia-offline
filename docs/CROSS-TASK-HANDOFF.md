# Handoff canónico: sistema postsismo, Gemma y proyecto 1000 Ojos

**Corte verificable:** 2026-08-16 08:19 COT
**Repositorio:** `sistema-postsismo-ia-offline`
**Rama local:** `work/DNA-84-mobile-prototype`
**HEAD de partida:** `a1f17e1f96eb4c6a6d470d72a050f6dc47e3f59c`
**Estado Git:** trabajo deliberadamente sin commit, push, PR ni despliegue; el árbol contiene cambios previos del usuario, del proyecto compañero y de esta tarea.

Este documento es el handoff que debe leer primero cualquier otra tarea que
integre este trabajo. Distingue lo que se ejecutó, lo que solo está
implementado, lo que fue refutado y lo que aún no se puede afirmar.

## Resultado ejecutivo

Ya existe un APK Android ARM64 de prueba que:

- conserva Gemma 4 E2B, como pidió el usuario;
- instala el modelo exacto por separado, comprueba tamaño y SHA-256 y lo guarda
  en almacenamiento privado;
- carga LiteRT-LM nativo;
- genera un borrador completamente sin red después de instalar el modelo;
- deja la salida como borrador con revisión profesional obligatoria;
- conserva disponible el asistente determinista cuando Gemma no es apropiado;
- evita cargar Gemma en teléfonos físicos que no superen una preselección
  conservadora de memoria y almacenamiento.

La prueba final se ejecutó en un emulador Android API 35 ARM64 con
`Active default network: none`. La primera generación después de cargar el
modelo tardó 15,7 segundos en CPU. El proceso siguió vivo y no apareció un
fatal ni un ANR. Esto prueba el recorrido técnico nominal del APK; **no prueba
todavía consumo mínimo, soporte general ni calidad profesional en teléfonos
físicos**.

El producto sigue siendo un sistema de captura, asistencia, revisión y
consolidación. No es diagnóstico estructural autónomo, dictamen de
habitabilidad, triaje oficial, reemplazo de EDAN/RUD ni fuente de autoridad.

## Artefactos actuales

| Artefacto | Estado verificado | Identidad |
| --- | --- | --- |
| APK Android de prueba | Construido, firmado, instalado y ejecutado | `1000-ojos-gemma-arm64-test.apk`, 51.915.832 bytes, SHA-256 `b004f09d81bb817bd321553678d49913ed0e579841f9e17239b24fa49458db58` |
| Aplicación | Inspeccionada con herramientas Android | `co.sierraclara.campo`, versión `1.0.0`, minSdk 24, targetSdk 36, solo `arm64-v8a` |
| Firma | V2 válida, pero de prueba | certificado `CN=Android Debug`, SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Runtime Android | Incluido en el APK | `com.google.ai.edge.litertlm:litertlm-android:0.16.0`; `liblitertlm_jni.so` de 21.529.640 bytes |
| Modelo Android | Descargado una vez y verificado; no embebido | `gemma-4-E2B-it.litertlm`, 2.588.147.712 bytes, SHA-256 `181938105e0eefd105961417e8da75903eacda102c4fce9ce90f50b97139a63c` |
| Modelo web/PWA | Probado previamente en Chrome/macOS | `gemma-4-E2B-it-web.litertlm`, 2.008.432.640 bytes, SHA-256 `3a08e8d94e23b814ae5414469c370c503813949acb8ceaa17e4ebf8a35af35b5` |
| Revisión de modelo | Fijada en ambas plataformas | `litert-community/gemma-4-E2B-it-litert-lm` @ `6b78abd019e61a1ca4cbe3b212d2c9ce8ff38a94` |

Rutas:

- APK: `apps/mobile/android/app/build/outputs/apk/release/1000-ojos-gemma-arm64-test.apk`
- evidencia legible por máquina: `docs/evidence/android-gemma-apk-v1.json`
- captura de inferencia Android sin red: `docs/evidence/android-gemma-cpu-inference.png`
- evidencia web/PWA: `docs/evidence/gemma-e2b-web-v1.json`
- captura web/PWA: `docs/evidence/gemma-e2b-offline-proof.png`

## Trabajo realizado por capa

### 1. Integridad y procedencia de evidencia

La ruta nativa dejó de guardar fotografías Base64 en AsyncStorage. El sistema
ahora:

- calcula SHA-256 sobre bytes reales;
- escribe archivos privados con nombre content-addressed `<sha256>.<ext>`;
- guarda en el estado solo URI local, tamaño, tipo, procedencia e integridad;
- aplica límites de 8 MiB en nativo y 2,5 MB al fallback inline de la PWA;
- valida que las URI estén dentro de ubicaciones permitidas;
- reabre y re-hashea evidencia al cargar, migrar y exportar;
- marca explícitamente `verified`, `missing` o `tampered`;
- bloquea la exportación reducida si la reverificación falla;
- migra la evidencia v1 de forma transaccional;
- persiste el estado semilla antes de borrar durante un reset y reporta
  residuos que no pudieron eliminarse.

Archivos principales: `apps/mobile/src/storage/evidenceFiles.ts`,
`evidenceFilePolicy.ts`, `migrations.ts`, `useFieldStore.ts` y los tipos de
dominio.

### 2. Revisión humana y mutabilidad

Editar una ficha o agregar evidencia después de revisarla la devuelve a
`draft` y elimina `reviewedAt`. Solo una acción explícita vuelve a marcarla
`reviewed`. Esto evita mostrar como revisada una versión que cambió después.

No existe todavía identidad criptográfica del revisor, firma profesional,
sucesor append-only completo ni evento de decisión de autoridad. Por ello
`reviewed` significa revisión del prototipo, no aprobación oficial.

### 3. Exportación y privacidad

La exportación `restricted-reduced-manifest-v1` omite fotos, URI, coordenadas
exactas, EXIF, notas libres, sensores exactos y salida de modelo. Conserva IDs,
horas, hashes, conteos, necesidades, anotaciones, alias de dispositivo y cola.
Por eso está rotulada `restricted-personal-and-operational-data`: no es pública,
anónima ni segura por sí sola. Requiere receptor autorizado y canal cifrado.

### 4. Captura de bajo costo en Android

Se sustituyó la ruta de redimensionado que cargaba primero el bitmap completo
por un módulo Expo Android local:

- proxy de lado largo máximo 96 px;
- API 28+: `ImageDecoder` con tamaño objetivo y allocator software;
- API 24–27: bounds pass de `BitmapFactory`, `inSampleSize` potencia de dos,
  orientación EXIF y escala final;
- soporte para las ocho orientaciones EXIF;
- entrada máxima 8 MiB, salida máxima 512 KiB, dimensión máxima 32.768 y
  80 megapíxeles;
- archivo proxy temporal sin EXIF y limpieza en `finally`;
- señales deterministas solo para extremos casi negros, blancos o uniformes;
- shadow mode: registra una medición, pero no aprueba ni bloquea una foto.

Esto reduce mucho los buffers explícitamente contabilizados, pero no es una
medición de RAM pico. Faltan codecs, EXIF, APIs, fabricantes y teléfonos reales.
iOS y web reportan este proxy como no soportado.

### 5. Asistente determinista y conocimiento local

El modo por defecto no necesita un modelo. Produce borradores en español,
campos faltantes, contradicciones y referencias de fuente. Distingue fuentes
aprobadas de referencias de prototipo y exige revisión humana. La arquitectura
permite RAG local con chunks y fuentes, pero no presenta la mera recuperación
como cita auditada ni verdad estructural.

### 6. Gemma web/PWA

La PWA conserva Gemma 4 E2B para acceso universal cuando WebGPU está
disponible. La prueba anterior:

- fijó revisión, tamaño y SHA-256 exactos;
- usó `@litert-lm/core@0.15.0` y backend `GPU_ARTISAN`;
- guardó el modelo en OPFS, fuera del cache del service worker;
- generó en 6,8 segundos en Chrome/macOS;
- mantuvo bloqueados los hosts del modelo, obtuvo 404 del servidor de prueba y
  observó cero solicitudes durante la generación.

No equivale a soporte móvil: el almacenamiento del navegador es revocable, la
primera visita no es offline y WebGPU/ejecución en segundo plano varían. Gemma
no debe ser parte obligatoria del paquete base de la PWA.

### 7. Gemma nativo en Android

Se añadió `apps/mobile/modules/gemma-litert-lm` y el puente
`gemmaRuntime.native.ts`.

Instalación del modelo:

- descarga o importa el `.litertlm` exacto;
- transmite en buffers de 1 MiB, sin Base64;
- calcula SHA-256 durante la escritura;
- exige tamaño y hash exactos;
- usa `.partial`, `fsync` y rename atómico;
- serializa instalaciones concurrentes;
- conserva tamaño, mtime e inode y vuelve a hashear si cambia la identidad;
- guarda el modelo en el sandbox y no lo incluye en el APK.

Ejecución:

- contexto máximo de motor: 2.048 tokens;
- salida máxima: 256 tokens;
- `topK=16`, `topP=0.9`, temperatura `0.15`, seed fija, thinking desactivado;
- prompts truncados conservadoramente para no desbordar contexto;
- prueba OpenCL antes de crear el motor;
- GPU cuando OpenCL está disponible; CPU directa cuando no lo está;
- hasta cuatro hilos CPU, dejando un core libre;
- fallback GPU→CPU si una falla ocurre antes del primer token;
- cancelación, cierre de conversación y descarga del motor;
- streaming de texto a React Native mediante la API pública `MessageCallback`.

El callback directo es intencional. LiteRT-LM 0.16.0 tiene un defecto upstream
en su adaptador Flow: llama `SendChannel.close$default` en una ubicación binaria
incompatible con coroutines 1.10.2. El primer humo real lo detectó. La solución
evita únicamente ese adaptador y usa la API callback que llega directo a JNI,
sin subir coroutines globalmente por encima del BOM de Expo. Referencia:
[LiteRT-LM #2812](https://github.com/google-ai-edge/LiteRT-LM/issues/2812).

### 8. Protección de recursos

La política conserva el asistente determinista y solo preselecciona Gemma en
un teléfono físico cuando puede medir al menos 6 GiB de RAM total y 4 GiB de
almacenamiento libre. Los botones de instalar y cargar se deshabilitan en un
teléfono físico que no supera esa puerta. El emulador se permite
explícitamente para pruebas.

Esta es una puerta conservadora, no una certificación. El humo final del
emulador observó:

- antes de generar: RSS 603.620 KiB y PSS 520.894 KiB;
- high-water mark del proceso después de generar: 1.834.444 KiB;
- después de generar: RSS 1.680.264 KiB y PSS 1.620.208 KiB.

Son snapshots de un AVD, no medición instrumentada de pico ni promesa para un
teléfono. Google publica cifras móviles orientativas, pero runtime, KV cache,
contexto, drivers y SO agregan memoria.

### 9. Tubería ML fail-closed

Se añadió un proyecto Python 3.12 reproducible con `pyproject.toml` y
`uv.lock`. Incluye:

- schemas versionados;
- sanitización y preparación de dataset;
- splits por grupos/eventos;
- validación de IDs únicos, faltantes y extra;
- evaluación atada a hashes de modelo, predicciones, dataset y manifiesto
  sellado;
- empaquetado atómico que rechaza reportes incompletos;
- estado `released: false` para placeholders y demos;
- CI que instala el entorno declarado antes de ejecutar pruebas.

No existe todavía un modelo liberado para daño visible, severidad, mecanismo,
habitabilidad o triaje.

### 10. Candidato de calidad de captura refutado

Se entrenó un benchmark pequeño solo para tensionar la tubería:

- 8.000 parches de hormigón;
- 7.538 clusters tras deduplicación aproximada y cero cluster compartido entre
  splits;
- CNN depthwise de 4.588 parámetros;
- ONNX de 25.542 bytes;
- AUROC de desarrollo alta y paridad máxima de `4,768e-6`.

La auditoría correcta refutó su utilidad operacional. El primer umbral alertó
en 39,58% de controles limpios. La recalibración v2 redujo falsos avisos, pero
el límite inferior de recall para sobreexposición fue 52,26%, frente a una
puerta de 90%. Resultado: `do-not-open`; no se abrió otro test y el modelo no se
integró. Una imagen clara sintética no define por sí sola mala captura.

Crack-Seg y datasets de fisuras genéricas sirven como baseline de plumbing, no
como evidencia de elemento, mecanismo, severidad o desempeño postsismo. El
entrenamiento útil debe usar edificios/eventos independientes, controles de
fuga por fuente/dispositivo/inspector, eventos futuros sellados, calibración,
OOD, abstención y ensayo humano+herramienta.

## Pruebas ejecutadas

Validación final después de los cambios Android y de la puerta de recursos:

- `npm test`: 39/39 pruebas en 11 archivos;
- TypeScript estricto: aprobado;
- `git diff --check`: aprobado;
- `:app:assembleRelease -PreactNativeArchitectures=arm64-v8a`: aprobado;
- firma APK v2: verificada;
- instalación `adb install -r`: `Success`;
- modelo Android: tamaño y SHA-256 verificados;
- carga con OpenCL ausente: CPU seleccionada deliberadamente;
- inferencia final: 15,7 s, `Active default network: none`, proceso vivo, sin
  fatal ni ANR.

El harness completo se volvió a ejecutar sobre el árbol final: aprobó 42/42
pruebas Python, exportación web y pipeline demo fail-closed. La evaluación demo
queda correctamente incompleta por carecer de manifiesto sellado y hash de
modelo, y el paquete permanece `released: false`. `expo-doctor` aprobó 21/21
comprobaciones en la revisión inmediatamente anterior.

`npm audit` sigue reportando 18 entradas: 7 moderadas, 11 altas y 0 críticas
sobre 576 dependencias. La corrección automática propone cambios mayores o
downgrades incompatibles de Expo/React Native, por lo que no se aplicó sin una
migración controlada.

## Lo reportado por el proyecto compañero

La siguiente información fue entregada por el usuario desde otra tarea y **no
fue revalidada desde este repositorio**:

- backend Railway con PostgreSQL y volumen persistente de 5 GB:
  `https://backend-production-0d88.up.railway.app`;
- health, almacenamiento, media, auth, CORS y persistencia tras reinicio
  reportados como aprobados;
- suite backend reportada: 44/44;
- frontend Vercel: `https://1000-ojos-postsismo.vercel.app`;
- assets, service worker, CORS y layouts 360/390/430/768 reportados como
  revisados;
- correcciones de sincronización ya hechas allí: IDs de retry estables,
  batch-before-media, protección contra duplicados/conflictos, validación de
  metadatos, cache de service worker más seguro y SHA-256 de bytes reales.

Pendientes reportados por esa tarea:

1. redeploy de Vercel con el arreglo SHA más reciente;
2. cerrar la validación final interrumpida;
3. ejecutar una captura/subida/sync real Vercel → Railway → PostgreSQL y
   comprobar persistencia después de reiniciar.

## Reglas de integración con el proyecto compañero

No sobrescribir silenciosamente los cambios de sincronización ya presentes en
el proyecto desplegado. En particular, preservar:

- IDs de retry estables;
- orden batch antes de media;
- semántica de duplicados y conflictos;
- validación de metadatos de media;
- SHA-256 calculado sobre bytes, nunca sobre texto Base64;
- configuración de endpoints y CORS del despliegue;
- cambios de service worker posteriores a ese despliegue.

Orden recomendado:

1. inventariar el diff de ambos árboles y aislar contratos compartidos;
2. integrar primero tipos, migraciones, evidencia y tests;
3. adaptar el outbox actual sin reemplazar su semántica idempotente;
4. integrar el asistente determinista y luego Gemma detrás de feature flags;
5. regenerar el árbol Android y volver a construir el APK;
6. ejecutar una prueba real captura→media→batch→DB→restart;
7. solo después desplegar frontend o backend.

El árbol `apps/mobile/android/`, el APK y los binarios grandes están
gitignored. Un commit o un handoff Git **no transportará automáticamente el APK
ni el modelo**. El receptor debe recibir el APK por un canal de artefactos o
regenerarlo, y debe descargar/importar el modelo exacto por separado.

## Instalación y prueba en teléfonos

El APK actual es una compilación local de prueba, no una release distribuible.
Para un teléfono conectado por ADB:

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/release/1000-ojos-gemma-arm64-test.apk
```

Comprobar antes de instalar:

```bash
shasum -a 256 apps/mobile/android/app/build/outputs/apk/release/1000-ojos-gemma-arm64-test.apk
```

El resultado debe ser:

```text
b004f09d81bb817bd321553678d49913ed0e579841f9e17239b24fa49458db58
```

Recorrido:

1. instalar el APK en Android ARM64;
2. abrir `SIM-001` y llegar a **Asistente local eficiente**;
3. con Wi-Fi y energía, descargar Gemma o importar exactamente
   `gemma-4-E2B-it.litertlm`;
4. esperar la verificación SHA-256;
5. pulsar **Cargar Gemma en memoria**;
6. escribir una pregunta y pedir el borrador;
7. desactivar toda red y repetir;
8. registrar modelo del teléfono, RAM, Android, SoC, tiempo, PSS/RSS, OOM,
   temperatura y batería.

Aunque minSdk es 24, para la primera matriz se recomienda probar equipos ARM64
con 8 GB de RAM y al menos 4 GB libres. La puerta de la app acepta candidatos
físicos desde 6 GiB; ninguno de esos valores es todavía una garantía de soporte.
Desinstalar la app elimina el modelo del sandbox. Una descarga interrumpida no
se reanuda y debe comenzar de nuevo.

## Afirmaciones que siguen prohibidas

No afirmar todavía:

- diagnóstico estructural;
- habitabilidad o estabilidad;
- seguridad de ingreso;
- triaje o prioridad postsismo oficial;
- reemplazo EDAN/RUD;
- precisión postsismo de visión;
- soporte iOS;
- consumo mínimo en teléfonos;
- compatibilidad con todos los Android ARM64;
- release distribuible o publicable en Play Store;
- privacidad pública/anónima de la exportación;
- calidad profesional de los borradores de Gemma.

La inferencia final demuestra que el runtime y el flujo funcionan. La respuesta
no fue adjudicada por profesionales y no constituye validación de utilidad,
seguridad ni exactitud. Las siguientes puertas reales son la matriz física de
teléfonos, el ensayo humano+herramienta, la firma de release, el cierre de
dependencias y la aceptación end-to-end contra el backend desplegado.

## Fuentes técnicas primarias

- [Gemma 4 y memoria orientativa](https://ai.google.dev/gemma/docs/core)
- [LiteRT-LM Kotlin 0.16.0](https://github.com/google-ai-edge/LiteRT-LM/blob/v0.16.0/docs/api/kotlin/getting_started.md)
- [Modelo Gemma 4 E2B LiteRT-LM](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm)
- [Defecto upstream del adaptador Flow](https://github.com/google-ai-edge/LiteRT-LM/issues/2812)
