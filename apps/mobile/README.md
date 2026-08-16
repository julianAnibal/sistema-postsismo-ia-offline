# 1000 Ojos

Prototipo DNA-84 de captura post-sismo para teléfono y web instalable. Funciona
sin servidor con datos sintéticos y conserva los cambios en el dispositivo.

## Ejecutar

```bash
npm ci
npm run web
```

Abra `http://localhost:8081` o el puerto mostrado por Expo. Para producir la
PWA:

```bash
npm run export:web
```

El resultado queda en `dist/` e incluye manifiesto, iconos, service worker y la
redirección para una aplicación de página única.

## Qué funciona

- catálogo local de infraestructura con búsqueda y estados;
- inspección manual multieje, población y necesidades agregadas;
- cámara o importación de una imagen con SHA-256 calculado sobre los bytes reales;
- archivo fotográfico content-addressed en el sandbox de la ruta nativa, sin
  Base64 en AsyncStorage; la PWA usa un fallback inline limitado a 2,5 MB. El
  APK Android se probó en emulador, pero la ruta iOS no se compiló ni validó;
- prechequeo de dimensiones, resolución, proporción y tamaño;
- en Android, módulo nativo que genera un proxy de lado largo máximo 96 px y
  medición determinista de extremos casi negros, blancos o uniformes, en shadow
  mode, sin modelo ni red y sin afirmar que una foto quedó aprobada. iOS y web
  reportan esta medición como no soportada;
- metadatos inmutables de GPS, precisión, altitud, rumbo, velocidad,
  movimiento, dispositivo y EXIF disponible, con estado explícito cuando un
  sensor no está autorizado o disponible; GPS y movimiento solo se capturan
  para una foto tomada en vivo, nunca se inventan para una imagen importada;
- evidencia inmutable y anotación manual en registros separados;
- borrador determinista, detección de campos faltantes y contradicciones sin
  cargar un modelo de lenguaje;
- en la PWA, instalación por streaming del paquete oficial Gemma 4 E2B web en
  OPFS, verificación SHA-256, carga LiteRT-LM/WebGPU desde recursos locales y
  generación incremental. El modelo no se duplica en Cache Storage y no forma
  parte del APK Android;
- consulta local sobre un corpus semilla de prototipo con procedencia visible;
- validación de metadatos declarados de memoria, almacenamiento y CPU para
  preseleccionar un paquete futuro; no equivale a medir el consumo ni a fijar la
  RAM mínima de un teléfono soportado;
- capas separadas para cobertura, daño revisado, IA pendiente y necesidades;
- cola local idempotente y exportación JSON reducida de sensibilidad
  restringida;
- persistencia después de recargar e instalación PWA donde el navegador lo
  permita;
- escrituras serializadas y aviso visible si el almacenamiento local rechaza
  un guardado.

## Límites deliberados

- No hay un servidor de operación configurado.
- No se distribuye un modelo ONNX. El candidato visual sintético fue rechazado
  por sus puertas de falsas alertas/recall y no se integró. Gemma 4 E2B sí está
  conectado a la PWA como descarga/importación separada de 1,87 GiB; requiere
  HTTPS, WebGPU, OPFS y espacio suficiente antes de perder conectividad.
- El APK disponible es una compilación local `arm64-v8a` firmada con Android
  Debug. No es un artefacto de distribución; no contiene modelo y no solicita
  permisos de Internet, micrófono o superposición.
- El corpus documental precargado es demostrativo, no una biblioteca aprobada
  para operación; cada fuente futura requiere versión, hash y revisión.
- La aplicación no emite habitabilidad, diagnóstico estructural ni aprobación
  oficial.
- Los archivos nativos quedan aislados por el sistema operativo, pero la app
  aún no añade cifrado propio ni una política de retención productiva.
- La exportación reducida omite fotos, URI, GPS exacto, EXIF y notas libres,
  pero conserva IDs, horas, hashes, conteos, necesidades, anotaciones, alias de
  dispositivo y cola. No es anónima, pública ni segura por sí sola: requiere un
  receptor autorizado y un canal cifrado aprobado.
- Los umbrales de capacidad del teléfono son una preselección conservadora;
  nunca sustituyen el benchmark térmico, de memoria y batería del paquete
  exacto en un dispositivo físico.
- Los mapas usan una cuadrícula sintética y no envían puntos a servicios de
  mapas públicos.

Los contratos de ONNX Runtime Mobile y LiteRT-LM viven en
`src/ai/contracts.ts`. La PWA fija Gemma 4 E2B a revisión, tamaño y SHA-256
exactos; usa LiteRT-LM `0.15.0` porque la publicación NPM `0.16.0` no contiene
los archivos del runtime. Cualquier resultado permanece como borrador separado
del registro humano. La prueba offline está en
[`docs/evidence/gemma-e2b-web-v1.json`](../../docs/evidence/gemma-e2b-web-v1.json).

La evidencia de ejecución responsive está en
[`docs/dna-84-proof.md`](../../docs/dna-84-proof.md).
El estado científico y las afirmaciones permitidas están en
[`docs/field-readiness-evidence.md`](../../docs/field-readiness-evidence.md).
