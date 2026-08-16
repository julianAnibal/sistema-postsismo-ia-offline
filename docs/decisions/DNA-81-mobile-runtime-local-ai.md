# DNA-81: Runtime móvil, IA local y distribución de campo

- Estado: `Proposed`
- Fecha: 2026-08-15
- Responsable: F2 Móvil, offline e IA
- Revisores requeridos: F1 Gobierno y campo; F3 Plataforma web
- Decisión en Linear: [DNA-81](https://linear.app/dnaart/issue/DNA-81/adr-seleccionar-runtime-movil-ia-local-y-distribucion-de-campo)
- Depende de: DNA-58, DNA-59, DNA-60 y DNA-61

## Resumen

Se propone una aplicación instalada para Android e iOS, construida con React
Native y Expo mediante compilaciones nativas. La interfaz, el formulario, la
base de datos y el modelo aprobado viajan o se descargan al teléfono y funcionan
sin internet. No se usará un servidor HTTP permanente en el teléfono como
arquitectura principal.

La IA local será asistiva y degradable: ONNX Runtime React Native intentará usar
aceleración nativa, podrá caer a CPU y se desactivará cuando el dispositivo no
cumpla el presupuesto de memoria, temperatura o batería. La captura manual y la
revisión profesional siempre seguirán disponibles.

## Problema que resuelve

El equipo necesita que una persona pueda instalar la herramienta con un enlace
o QR, abrirla con un toque, evaluar muchas infraestructuras sin red, conservar
fotos y formularios de forma segura y sincronizar cuando vuelva la conexión. La
misma solución debe atender teléfonos desiguales y no prometer un diagnóstico
que la cámara o el modelo no pueden sustentar.

## Restricciones verificadas

1. iOS no permite mantener un proceso de red arbitrario ejecutándose de forma
   indefinida en segundo plano. Las tareas de fondo son programadas y limitadas
   por el sistema operativo.
2. Android permite trabajo diferible con WorkManager. Un servicio prolongado en
   primer plano exige una notificación visible y también tiene restricciones.
3. Una PWA no ofrece la misma aceleración de IA en todos los navegadores. ONNX
   Runtime Web puede usar WASM ampliamente, pero WebGPU no está disponible en
   Safari/iOS ni en todos los navegadores móviles.
4. El almacenamiento web puede ser desalojado por el navegador. No debe ser la
   única copia de inspecciones críticas.
5. SQLite nativa persiste entre reinicios. Expo permite WAL, FTS y SQLCipher,
   aunque SQLCipher requiere una nueva compilación nativa.
6. Las actualizaciones OTA pueden sustituir JavaScript, estilos y activos
   compatibles. Una dependencia nativa o un cambio de runtime requiere un nuevo
   binario firmado.

Por estas restricciones, “web como daemon” se interpreta como una experiencia
web instalada y autocontenida, no como un servidor local permanente expuesto en
el teléfono.

## Decisión propuesta

### Aplicación principal

- React Native con TypeScript y Expo Router.
- Expo prebuild/dev client y binarios firmados; no depender de Expo Go.
- Paquetes nativos para cámara, ubicación, archivos, SQLite, mapas e inferencia.
- UI y contratos compartibles con la consola web, sin forzar un único runtime.
- Android e iOS son clientes del mismo protocolo de sincronización.

### Persistencia local

- `expo-sqlite` con SQLCipher, WAL, claves foráneas y migraciones versionadas.
- La clave de base de datos se protege con Keystore/Keychain y no se incluye en
  código, logs, backups sin cifrar ni actualizaciones OTA.
- Fotos y derivados se guardan como archivos privados; SQLite conserva rutas,
  hash SHA-256, tamaño, MIME, estado de carga y relación de evidencia.
- La mutación de negocio y su entrada de outbox se escriben en una sola
  transacción.
- Ningún original se elimina antes de ACK del servidor, validación de checksum y
  cumplimiento de la política de retención aprobada.

### IA en el teléfono

- Runtime inicial: `onnxruntime-react-native`.
- Modelo: artefacto ONNX cuantizado, firmado, versionado y acompañado por una
  ficha de modelo; no se fija aún una arquitectura hasta medir candidatos.
- Crack-Seg se usa como línea base para localizar grietas visibles. Sus 4.029
  imágenes y su única clase `crack` no cubren habitabilidad, mecanismos de falla,
  daños ocultos, tipologías locales ni personas atrapadas.
- Ultralytics no entra a producción hasta que DNA-61 defina AGPL-3.0, licencia
  Enterprise o una alternativa compatible.
- El resultado se muestra como `sugerencia IA`, nunca como dictamen, placard,
  habitabilidad o autorización de ocupación.

La IA generativa es un módulo opcional separado:

- Gemma 4 E2B para equipos intermedios y E4B para equipos de capacidad alta;
- LiteRT-LM como runtime móvil de Android/iOS;
- nombre de producto `Asistente local`, con motor intercambiable;
- RAG sobre documentos aprobados y herramientas locales con argumentos validados;
- salidas como borrador estructurado, nunca escritura, sello o publicación
  autónoma;
- licencias y origen en avisos técnicos, sin convertir marcas de terceros en la
  identidad visible de la aplicación.

La arquitectura de fotografías, taxonomía, dataset y mapas está en
[`local-ai-data-pipeline.md`](../local-ai-data-pipeline.md).

#### Niveles de ejecución

| Nivel | Ejecución | Experiencia |
|---|---|---|
| A | ONNX con Core ML o NNAPI cuando el modelo sea compatible | Máscara local y métricas dentro del presupuesto validado |
| B | ONNX en CPU | Imagen reducida, una inferencia a la vez y aviso de mayor espera |
| C | Sin inferencia local | Captura guiada, formulario completo y análisis posterior |

Todos los teléfonos admitidos deben cumplir el nivel C. Los niveles A y B sólo
se habilitan después de una prueba de arranque y un benchmark del modelo exacto.
La aplicación no debe cerrarse, bloquear la captura ni inventar un resultado si
la IA falla.

### Sincronización

- Acción visible `Sincronizar ahora` con progreso, pendientes, reintentos y
  cancelación segura.
- Trabajo oportunista con WorkManager en Android y BGTaskScheduler en iOS.
- No se promete una hora exacta de ejecución en segundo plano.
- Metadatos, alertas operativas y miniaturas se priorizan antes de originales.
- Cargas reanudables por partes, checksum, claves de idempotencia y cursores de
  cambios.
- Los conflictos que puedan alterar una conclusión, autoridad o persona se
  detienen para revisión; no gana silenciosamente el último escritor.

### Instalación y actualización

| Canal | Uso |
|---|---|
| Play interno/cerrado o MDM Android | Ruta preferida para operación controlada |
| APK firmado por enlace o QR | Piloto supervisado; requiere gestionar permiso de instalación |
| TestFlight, App Store o MDM iOS | Únicas rutas operativas razonables en iPhone |
| PWA | Respaldo de captura manual y consulta, no base crítica ni paridad de IA |

GitHub Actions producirá artefactos reproducibles. La publicación productiva,
los cambios de modelo y las migraciones destructivas conservarán aprobación
humana. EAS Update o un servidor compatible con Expo Updates distribuirá cambios
OTA compatibles y permitirá reversión. Cambios nativos generan una versión nueva
en la tienda o MDM.

### PWA de contingencia

La PWA podrá abrirse o instalarse rápidamente y reutilizar contratos, estilos y
validaciones. En modo contingencia:

- la captura manual es prioritaria;
- la inferencia, si existe, usa WASM y menor resolución;
- se advierte que el navegador puede desalojar datos;
- se ofrece exportación cifrada cuando no existe sincronización;
- no se expone un puerto HTTP a la red local.

## Alternativas consideradas

| Opción | Ventaja | Riesgo | Resultado |
|---|---|---|---|
| PWA pura | Instalación inmediata y una base web | Almacenamiento desalojable, fondo limitado y aceleración desigual | Rechazada como cliente principal |
| Capacitor | Reutiliza una aplicación web dentro de contenedores nativos | IA nativa exige puente propio y aumenta la superficie crítica | Alternativa si cambia la prioridad hacia paridad web |
| React Native + Expo nativo | Paquete oficial de ONNX RN, UI nativa y acceso directo a capacidades del equipo | Mantiene binarios móviles y pruebas por plataforma | Propuesta |
| Swift/Kotlin separados | Máximo control y rendimiento | Duplica desarrollo y validación para un equipo de tres | Reserva para módulos que demuestren necesidad |
| Servidor local permanente | Una URL local podría servir la UI | No es portable en segundo plano y expone una superficie de red | Rechazada como núcleo |

ExecuTorch se conserva como candidato de benchmark si ONNX Runtime no cumple
calidad o rendimiento, pero no se incorpora de inicio por la complejidad de sus
backends y exportación.

## Compatibilidad y prueba obligatoria

No se publicará la frase “funciona en cualquier teléfono”. La aprobación debe
definir una matriz real y tres perfiles medidos:

- Android de entrada ARM64 con memoria limitada;
- Android intermedio y Android con acelerador disponible;
- iPhone más antiguo permitido por el deployment target y un iPhone actual;
- modo avión desde arranque en frío;
- batería baja, almacenamiento bajo, temperatura elevada y app terminada;
- modelo compatible, modelo incompatible y modelo dañado;
- al menos 100 infraestructuras asignadas y 20 inspecciones con medios en una
  jornada simulada.

Para cada equipo se registran latencia p50/p95, memoria pico, temperatura,
batería por inspección, cierres, tamaño de modelo, tiempo de arranque y calidad.
Los umbrales numéricos se fijan con el territorio y los teléfonos del piloto,
antes de aceptar esta ADR.

## Consecuencias

### Positivas

- El trabajo de campo no depende de red ni de que el sistema operativo sostenga
  un servidor local.
- Un teléfono incapaz de ejecutar IA sigue siendo útil y seguro.
- SQLite permite buscar, paginar y conservar muchas infraestructuras sin cargar
  todo en memoria.
- El runtime de visión queda intercambiable mediante ONNX y manifiestos.

### Costos y riesgos

- Habrá compilaciones y pruebas separadas para Android e iOS.
- SQLCipher, ONNX y MapLibre requieren dev client/binario, no Expo Go.
- La sincronización en segundo plano es oportunista; la UX debe permitir una
  operación visible y supervisada.
- OTA no sustituye pruebas de migración ni revisión de modelos.
- Crack-Seg exige ampliación y validación territorial antes de uso operativo.

## Condiciones para aceptar

- DNA-58 define usuarios, autoridad, territorio y tipos de infraestructura.
- DNA-59 aprueba el esquema canónico que vivirá en SQLite.
- DNA-60 aprueba cifrado, retención, revocación y tratamiento de fotos/GPS.
- DNA-61 resuelve licencias de runtime, modelo, dataset, mapas y distribución.
- F1 valida el flujo y lenguaje de seguridad.
- F3 valida contratos, idempotencia, cargas y conflictos.
- F2 ejecuta el benchmark reproducible en la matriz piloto.

## Reversión

Si React Native/ONNX no cumple en los teléfonos del piloto, se conserva el
esquema SQLite, el protocolo de sincronización y la UX manual. El módulo de IA
puede cambiar a ExecuTorch, a un módulo Kotlin/Swift o a análisis posterior sin
invalidar inspecciones. Una actualización fallida vuelve al bundle, modelo y
migración compatibles anteriores; nunca se hace downgrade destructivo de datos.

## Fuentes técnicas

- [Capacitor: runtime nativo multiplataforma](https://capacitorjs.com/docs)
- [Apple: límites y estrategias de ejecución en segundo plano](https://developer.apple.com/forums/thread/685525)
- [Apple BGTaskScheduler](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler)
- [Android: tareas persistentes y WorkManager](https://developer.android.com/develop/background-work/background-tasks/persistent)
- [ONNX Runtime Mobile](https://onnxruntime.ai/docs/get-started/with-mobile.html)
- [ONNX Runtime para React Native](https://onnxruntime.ai/docs/get-started/with-javascript/react-native.html)
- [ONNX Runtime Web: soporte por navegador](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)
- [Expo SQLite y SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- [Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)
- [Expo Updates y compatibilidad de runtime](https://docs.expo.dev/eas-update/runtime-versions/)
- [MapLibre React Native OfflineManager](https://maplibre.org/maplibre-react-native/docs/modules/offline-manager/)
- [Almacenamiento web y desalojo](https://web.dev/articles/storage-for-the-web)
- [Ultralytics Crack-Seg](https://docs.ultralytics.com/es/datasets/segment/crack-seg/)
- [Opciones de licencia Ultralytics](https://www.ultralytics.com/license)
- [Gemma 4: memoria y capacidades móviles](https://ai.google.dev/gemma/docs/core)
- [Gemma 4: licencia Apache 2.0](https://ai.google.dev/gemma/apache_2)
- [LiteRT-LM](https://developers.google.com/edge/litert-lm)
