# Entrenamiento, evaluación y gobierno de IA

## Estado y límite

Este documento define puertas de experimentación; no aprueba entrenar ni
publicar un modelo. La aplicación es un sistema de captura y apoyo. Ninguna
salida automática decide habitabilidad, estabilidad, evacuación, prioridad
oficial o aprobación de autoridad.

La unidad de decisión profesional es el expediente de inspección, no una foto.
Una imagen puede soportar solamente lo visible dentro de su encuadre y protocolo.

## Arquitectura de menor costo

El orden de ejecución busca valor antes que parámetros:

1. **Reglas deterministas siempre disponibles.** Formularios, campos faltantes,
   contradicciones y borradores estructurados sin reservar RAM para un modelo.
2. **Prechequeo de captura.** La versión actual revisa metadatos y, solo en
   Android, mide un proxy de lado largo máximo 96 px sin modelo para registrar
   extremos casi negros, blancos o uniformes. iOS y web reportan esta medición
   como no soportada. Está en shadow mode: no aprueba ni rechaza una foto. Un
   modelo estrecho solo podrá incorporarse después de superar datos reales,
   falsas alertas limpias y benchmark físico.
3. **Visión compacta opcional.** Solo propone una región de condición visible y
   puede abstenerse; no produce severidad ni diagnóstico.
4. **Recuperación documental local.** Corpus oficial, versionado y con hash; las
   citas permitidas son los IDs realmente recuperados.
5. **Lenguaje opcional.** Se considera solo si plantilla + esquema + recuperación
   fallan de forma medible. El teléfono puede funcionar sin este paquete.
6. **Humano autorizado.** Revisa y corrige; una futura firma/conclusión sucesora
   requiere un flujo gobernado que aún no está implementado. La decisión de
   autoridad permanece fuera del sistema actual y la IA nunca la adquiere por
   ser aceptada.

## Separación de constructos

No se mezclan estas capas en una sola etiqueta:

- `visible_observation`: región, patrón, material visible, escala y calidad;
- `field_context`: elemento declarado, uso, acceso y vistas disponibles;
- `expert_interpretation`: hipótesis o conclusión profesional;
- `operational_triage`: prioridad dentro de una capacidad de revisión conocida;
- `authority_decision`: decisión oficial y responsable, externa al sistema
  actual y no implementada como evento de la app.

El objetivo de un modelo solo puede contener información soportada por sus
entradas. `unknown`, `not_visible`, `not_observed` y `not_accessible` son valores
reales, no negativos implícitos.

## Puertas obligatorias

1. **Finalidad y procedencia:** consentimiento o licencia de entrenamiento,
   redistribución y retención por cada fuente.
2. **Privacidad:** copia de entrenamiento desidentificada, PIA, acceso mínimo,
   borrado/exclusión trazable y revisión de fachadas, interiores, documentos,
   reflejos, rostros, placas y ubicación.
3. **Taxonomía observable:** guía de anotación, versión, ejemplos frontera y
   exclusiones. ATC-20 y formularios colombianos no se convierten directamente
   en clases fotográficas.
4. **Revisión:** primera lectura ciega, dos revisores y adjudicación; sugerencia
   IA, observación humana, conclusión profesional y autoridad son eventos
   append-only distintos.
5. **Partición:** por evento antes de recortar o aumentar. También se deduplican
   ráfagas, recortes, videos, compresiones y casi duplicados; se auditan edificio,
   territorio, fuente, dispositivo e inspector.
6. **Evaluación sellada:** test de prevalencia real, conjunto enriquecido de
   casos críticos y conjunto OOD/desafío separados. Umbrales y prompts se fijan
   antes de abrir el test.
7. **Calibración y abstención:** score, probabilidad calibrada, calidad de
   captura y certeza del revisor son campos diferentes.
8. **Flujo humano+IA:** estudio humano solo frente a humano+IA, con primera
   lectura ciega, muestra de negativos, tiempo, overrides, falsas alertas y carga
   por 100 inspecciones.
9. **Dispositivo:** RAM pico, almacenamiento, inicio en frío, OOM, temperatura,
   batería, latencia y operación sostenida sin red en la matriz soportada.
10. **Publicación:** manifiesto, SHA-256, reporte de evaluación sellado, licencia,
    firma futura, rollback y revocación.

Una muestra no se aprueba por “2.000 fotos” o “cero errores”. Con cero fallos en
`n` casos críticos independientes, el límite superior unilateral aproximado al
95% sigue siendo `3/n`. Se reportan intervalos agrupados por edificio/evento y
curvas de aprendizaje, no solo promedios por foto.

## Preparación de datos de lenguaje

El esquema fuente está en `ml/schemas/language-record.schema.json`. Solo entran
ejemplos revisados y sin PII.

```bash
python3 ml/scripts/pipeline.py validate \
  --input private-data/training/language.jsonl

python3 ml/scripts/prepare_dataset.py \
  --input private-data/training/language.jsonl \
  --output private-data/training/splits
```

El default aísla eventos completos y exige al menos tres eventos. El CLI imprime
los grupos de cada partición y cualquier solapamiento. El test se bloquea y no se
usa para escoger hiperparámetros.

La evaluación de lenguaje exige JSON exacto, tipos correctos, revisión humana,
lenguaje seguro, fidelidad frente a campos esperados y `source_ids` contenidos
en las fuentes recuperadas. El reporte distingue una prueba estructural sin
ground truth de una evaluación con evidencia supervisada completa.

## Preparación visual

```bash
uv run ml/scripts/sanitize_images.py \
  --input private-data/raw-images \
  --output private-data/sanitized-images
```

Eliminar EXIF no concede derechos ni anonimiza una vivienda. La cola de
privacidad debe completarse antes de anotar.

El primer experimento visual recomendado es calidad de captura. El segundo es
una sola salida como `possible_visible_crack_mask` para un material y protocolo
soportados, en shadow mode. Crack-Seg puede probar la tubería, pero sus 4.029
imágenes y clase única no validan elementos, mecanismos, severidad ni desempeño
postsismo.

Métricas mínimas:

- Dice/IoU y recall por lesión, tamaño y material;
- falsos positivos por imagen y alertas por 100 inspecciones;
- omisiones críticas con intervalos agrupados;
- estratos de territorio, evento, dispositivo, luz, operador y calidad;
- curva riesgo-cobertura al abstenerse;
- calibración y degradación OOD.

`ml/jobs/train_vision_segmentation.py` es un scaffold, no una arquitectura
aprobada. Su checkpoint, licencia, exportación ONNX y presupuesto móvil deben
resolverse antes de un entrenamiento real.

### Resultado del primer experimento de calidad

Se ejecutó un benchmark legalmente reutilizable, reproducible y deliberadamente
estrecho con 8.000 parches de hormigón bajo CC-BY-4.0. El CNN depthwise de 4.588
parámetros produjo un ONNX de 25.542 bytes y separó bien cuatro corrupciones
sintéticas. Sin embargo, la primera puerta usó un denominador de falsos positivos
incorrecto: 475/1.200 controles limpios activaron alguna alerta. El reporte se
preservó y fue supersedido como NO-GO.

Un operating point v2 fijado en validación redujo esa tasa a 18/1.200, pero el
límite inferior Wilson 95% del recall de sobreexposición fue solo 0,5226 frente
al mínimo 0,90. La auditoría concluyó `do-not-open`; el siguiente test no se abrió
y el ONNX no se distribuye. El resultado completo está en
[`field-readiness-evidence.md`](field-readiness-evidence.md).

Comandos reproducibles, después de adquirir y preparar la fuente:

```bash
python3 ml/scripts/train_capture_quality.py \
  --split-manifest private-data/capture-quality/split-v1.json \
  --output private-data/capture-quality/candidate-v1

python3 ml/scripts/evaluate_capture_quality.py \
  --candidate private-data/capture-quality/candidate-v1-locked

python3 ml/scripts/audit_capture_quality_report.py \
  --candidate private-data/capture-quality/candidate-v1-locked

python3 ml/scripts/lock_capture_quality_operating_point.py \
  --candidate private-data/capture-quality/candidate-v1-locked \
  --output private-data/capture-quality/operating-v2

python3 ml/scripts/audit_capture_quality_operating_point.py \
  --operating-point private-data/capture-quality/operating-v2/operating-point.json \
  --output private-data/capture-quality/operating-v2/VALIDATION-AUDIT-RECOMPUTED.json
```

La última auditoría recalculó las métricas directamente desde checkpoint,
manifiesto de split, configuración y modelo, verificó sus SHA-256 y volvió a
producir `challengeEligible: false`. No confía solo en el JSON del operating
point.

Los directorios de salida son inmutables: para repetir se usa un ID/directorio
nuevo. Nunca se borra o reescribe un test para convertir un fallo en aprobación.

## Gemma y LoRA

Gemma 4 E2B existe, es multimodal y admite PEFT/LoRA, pero “E2B” expresa
parámetros efectivos, no el tamaño literal almacenado. La ruta inicial de texto
solo ajustaría comportamiento; no enseñaría a percibir fisuras.

Antes de LoRA se compara el baseline determinista + JSON Schema + recuperación.
Si LoRA demuestra una mejora sellada:

```bash
uv run ml/jobs/train_sft_lora.py \
  --model-id google/gemma-4-E2B-it \
  --dataset-id ORGANIZACION/DATASET_PRIVADO \
  --hub-model-id ORGANIZACION/1000-ojos-language-lora
```

Se entrena fuera del teléfono. Para exportar, se fusiona el adaptador en un
checkpoint Hugging Face completo salvo que una ruta de carga de adaptadores haya
sido validada expresamente. El nombre actual del conversor es **LiteRT Torch**
(`litert-torch`). El tutorial oficial de fine-tuning usa otro tamaño de Gemma;
por eso E2B + LoRA + multimodal + Android requiere un spike de conversión,
paridad y dispositivo exacto.

Google estima para E2B alrededor de 1,1 GB de carga base multimodal y 0,84 GB
solo texto, sin runtime ni caché KV. La app usa una preselección conservadora de
RAM/almacenamiento, pero únicamente el manifiesto medido y un benchmark físico
pueden habilitar un paquete. El modelo y el índice documental deben estar
provisionados antes de perder conectividad.

## Recuperación documental

El RAG en Android puede ejecutarse completamente en el dispositivo, pero el SDK
AI Edge RAG está marcado como deprecado. La arquitectura mantiene interfaces
reemplazables para chunking, embeddings, almacén vectorial y recuperación. Las
obligaciones críticas permanecen en reglas; RAG no convierte una cita en válida
por sí solo.

Cada fragmento necesita jurisdicción, vigencia, versión, URL oficial, hash y
estado de aprobación. El generador solo puede devolver IDs recuperados y el
validador comprueba esa pertenencia.

## Empaquetado móvil

Renombrar un archivo no lo convierte a `.litertlm`. Después de conversión,
paridad y benchmark del checkpoint exacto se puede crear un **candidato no
liberado**:

```bash
python3 ml/scripts/package_model.py \
  --model private-data/export/1000-ojos.litertlm \
  --notice private-data/export/NOTICE.txt \
  --output private-data/candidates/1000-ojos-v1 \
  --id 1000-ojos-language \
  --version 1.0.0 \
  --task language-drafting \
  --estimated-peak-memory-bytes MEDIDO \
  --minimum-memory-bytes MEDIDO \
  --minimum-free-storage-bytes MEDIDO \
  --supported-cpu-architectures arm64-v8a \
  --evaluation-metric METRICA_PRE_REGISTRADA \
  --evaluation-value VALOR \
  --evaluation-dataset-release-id RELEASE_SELLADO \
  --evaluation-report private-data/evaluation/report.json
```

El CLI anterior solo empaqueta `language-drafting` en `.litertlm`; un futuro
ONNX visual requiere su propio flujo medido. El resultado conserva
`released: false`. La ruta de liberación falla cerrada y no se documenta como
flujo disponible: primero hay que validar el contenedor con las herramientas
LiteRT-LM, comprobar paridad e inicializarlo en el runtime y dispositivo
objetivo. La evaluación debe atar hashes de modelo, predicciones y manifiesto
sellado, además de rechazar IDs faltantes, extra o repetidos. El paquete se arma
en staging. SHA-256 prueba integridad, no autoría; aún se requiere firma
asimétrica y un proceso externo de autorización.

## Estado implementado

- reglas, borrador determinista, prechequeo de metadatos y proxy de píxeles sin
  modelo en shadow mode: implementados;
- almacenamiento fotográfico nativo eficiente y esquema local v2:
  implementados en código; APK Android probado en emulador, iOS y hardware
  físico pendientes;
- partición por evento, reporte de fuga y manifiesto gobernado: implementados;
- candidato sintético de calidad: entrenado, auditado y **rechazado**; no se
  integra ni publica;
- corpus documental aprobado: no disponible; el contenido actual es semilla de
  prototipo;
- modelo de daño/segmentación o Gemma: no entrenado ni distribuido;
- prueba física de archivos, proxy y cualquier inferencia futura: pendiente;
- aprobación de ADR y release: pendiente de revisión humana.

## Referencias técnicas

- [Gemma 4](https://ai.google.dev/gemma/docs/core)
- [Ajuste de Gemma](https://ai.google.dev/gemma/docs/tune)
- [Conversión generativa con LiteRT](https://developers.google.com/edge/litert/conversion/pytorch/genai)
- [LiteRT-LM en Android](https://developers.google.com/edge/litert-lm/android)
- [RAG en dispositivo](https://developers.google.com/edge/mediapipe/solutions/genai/rag)
- [Crack-Seg](https://docs.ultralytics.com/datasets/segment/crack-seg)
- [NIST AI RMF](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
