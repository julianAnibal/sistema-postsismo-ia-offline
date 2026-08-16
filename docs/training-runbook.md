# Entrenamiento y gobierno de modelos

## Alcance

1000 ojos usa dos modelos independientes. El modelo visual sugiere condiciones
observables; el modelo de lenguaje redacta borradores estructurados y consulta
fuentes locales. Ninguno declara por si solo que una infraestructura es segura,
habitable o inhabitable.

Las leyes, protocolos y formularios no se memorizan mediante fine-tuning. Se
versionan como fuentes RAG locales para poder citar, actualizar y auditar cada
respuesta.

## Responsabilidades

- Movil/IA: captura, procedencia, saneamiento, entrenamiento y empaquetado.
- Ingenieria estructural: taxonomia, doble revision y conjunto de prueba.
- Web/datos: catalogo de versiones, almacenamiento privado y trazabilidad.
- Producto/riesgo: consentimiento, retencion, acceso y respuesta a incidentes.

## Puertas obligatorias

1. **Procedencia:** licencia o consentimiento documentado para cada fotografia.
2. **Privacidad:** EXIF eliminado y revision de rostros, placas y documentos.
3. **Calidad:** dos revisiones; desacuerdos resueltos por un tercer profesional.
4. **Particion:** por evento e infraestructura, nunca por fotografia individual.
5. **Seguridad:** 100% de JSON valido, solicitud de revision profesional y cero
   dictamenes automaticos en el conjunto bloqueado.
6. **Vision:** metricas por clase y analisis de falsos negativos criticos.
7. **Dispositivo:** memoria, temperatura, bateria, latencia y funcionamiento sin
   red probados en la matriz de telefonos objetivo.
8. **Publicacion:** hash SHA-256, version, aviso legal y posibilidad de retirar
   una version defectuosa.

## Preparacion de lenguaje

El formato fuente esta en `ml/schemas/language-record.schema.json`. Solo entran
ejemplos aprobados. La salida del asistente es JSON con `summary`,
`missing_fields`, `requires_expert_review` y `source_ids`.

```bash
python3 ml/scripts/pipeline.py validate --input private-data/training/language.jsonl
python3 ml/scripts/pipeline.py split \
  --input private-data/training/language.jsonl \
  --output private-data/training/splits
```

El conjunto `test` queda bloqueado. No se usa para escoger hiperparametros ni se
publica junto al dataset de trabajo.

## Preparacion visual

```bash
uv run ml/scripts/sanitize_images.py \
  --input private-data/raw-images \
  --output private-data/sanitized-images
```

La limpieza quita metadatos pero no autoriza automaticamente una fotografia.
La cola `privacy-review.csv` debe completarse manualmente. Las mascaras siguen
`ml/schemas/vision-annotation.schema.json` y luego se exportan al formato YOLO
segment.

## Trabajo GPU

```bash
uv run ml/jobs/train_sft_lora.py \
  --model-id MODELO_GEMMA_4_E2B_CONFIRMADO \
  --dataset-id ORGANIZACION/DATASET_PRIVADO \
  --hub-model-id ORGANIZACION/1000-ojos-language-lora

uv run ml/jobs/train_vision_segmentation.py \
  --data private-data/vision/dataset.yaml \
  --output private-data/runs/vision
```

Ambos trabajos conservan configuracion, semilla, version de datos, metricas y
artefactos. El adaptador LoRA se mantiene separado hasta superar la evaluacion;
luego se combina o convierte segun la ruta compatible con LiteRT-LM confirmada
para la version exacta de Gemma.

## Publicacion movil

La conversion a `.litertlm` depende de la arquitectura y version exacta del
checkpoint, por lo que no se simula con un cambio de extension. Una vez hecha
con AI Edge Torch/File Builder y validada:

```bash
python3 ml/scripts/package_model.py \
  --model private-data/export/1000-ojos-e2b.litertlm \
  --notice private-data/export/NOTICE.txt \
  --output private-data/release/1000-ojos-e2b-v1 \
  --id 1000-ojos-e2b \
  --version 1.0.0
```

El manifiesto resultante coincide con `ModelPackManifest` de la aplicacion. Se
debe agregar firma asimetrica antes de produccion: SHA-256 comprueba integridad,
pero no autoria.

## Datos de demostracion

`ml/data/demo` es sintetico y sirve exclusivamente para probar el recorrido. No
entrena un modelo util ni representa aprobacion profesional de casos reales.
