# Modelos y datos de 1000 Ojos

Este directorio es una tubería gobernada de experimentación, no un modelo
operativo. La aplicación ya funciona con reglas deterministas; un artefacto de
IA solo se incorpora cuando demuestra una mejora en un test sellado y en la
matriz de teléfonos.

Las tareas permanecen separadas:

- `capture-quality`: futura ayuda estrecha para repetir una foto deficiente;
- `visible-condition-segmentation`: futura máscara de una condición realmente
  visible, sin severidad ni diagnóstico;
- `language-drafting`: borrador estructurado con campos y fuentes preservados;
- reglas, formularios y conocimiento cambiante: deterministas o recuperados de
  un corpus local versionado, no memorizados por fine-tuning.

El teléfono solo ejecuta inferencia. El saneamiento, entrenamiento, calibración
y publicación ocurren fuera del dispositivo.

## Demostración local

```bash
UV_PROJECT_ENVIRONMENT=.venv-validation uv sync --frozen
UV_PROJECT_ENVIRONMENT=.venv-validation uv run python -m unittest discover -s ml/tests -v
UV_PROJECT_ENVIRONMENT=.venv-validation uv run python ml/scripts/pipeline.py demo
```

La demostración usa nueve registros sintéticos, aísla eventos completos entre
train/validation/test, evalúa salidas de control y genera un placeholder con
`released: false`. No descarga modelos ni necesita GPU y no prueba utilidad
postsismo. En el corte documentado aprobaron 42 pruebas Python.

## Experimento real ejecutado: calidad sintética

La tubería ya adquirió una fuente CC-BY-4.0 fijada por revisión y SHA-256,
agrupó duplicados exactos y perceptuales antes de transformar, entrenó un CNN
depthwise de 4.588 parámetros y exportó ONNX con paridad comprobada. Este trabajo
demuestra la tubería, no utilidad de campo.

La prueba además hizo algo esencial: **rechazó el modelo**. La auditoría corrigió
un denominador de falsas alertas; el operating point v2 posterior incumplió el
recall mínimo de sobreexposición. Por tanto:

- el test de desafío siguiente permanece sin abrir;
- el modelo tiene `modelReleased: false` y no está en la app;
- no se permite afirmar calidad de cámara real, daño, severidad o desempeño
  postsismo;
- la app conserva un proxy determinista de 96 px, sin runtime ML, en shadow
  mode.

Vea el registro numérico y los hashes en
[`docs/field-readiness-evidence.md`](../docs/field-readiness-evidence.md).

## Partición y fuga

La unidad segura por defecto es `event_id`: ningún evento puede aparecer en más
de una partición. La preparación detecta IDs duplicados, exige al menos tres
grupos y emite membresía y solapamientos auditables.

```bash
python3 ml/scripts/prepare_dataset.py \
  --input private-data/training/language.jsonl \
  --output private-data/training/splits
```

El modo heredado por evento e infraestructura es más débil y exige una decisión
explícita:

```bash
python3 ml/scripts/prepare_dataset.py \
  --input private-data/training/language.jsonl \
  --output private-data/training/legacy-splits \
  --group-fields event_id,infrastructure_id \
  --allow-legacy-grouping
```

En datasets reales también se deben controlar ráfagas, recortes, hashes
perceptuales, fuente, dispositivo, inspector, territorio y edificio antes de
considerar sellado un conjunto.

## Manifiesto móvil

La publicación está **cerrada por diseño** en este corte. El API y el CLI fallan
cerrados ante cualquier intento de marcar un paquete como liberado hasta que
exista una validación ejecutable del formato LiteRT-LM, paridad e inicialización
en el runtime Android exacto. No se documenta un flujo de release porque hoy no
existe. Una extensión `.litertlm` y un reporte que se declara aprobado no
bastan.

El empaquetador solo puede producir candidatos `released: false`. Estos pueden
conservar para revisión:

- `manifestVersion`, ID, versión, runtime, tarea permitida, SHA-256 y tamaño;
- declaraciones de memoria pico, memoria del dispositivo y espacio libre,
  pendientes de medición en el hardware exacto;
- arquitecturas CPU compatibles;
- aviso de licencia dentro del paquete;
- métrica, valor, release de datos, reporte JSON y SHA-256 del reporte;
- `released: false` y `status: unreleased` inequívocos.

Los placeholders admiten recursos cero solo con `released: false`. Una tarea de
habitabilidad o un reporte no verificable se rechaza. Para adjuntar evaluación,
el reporte debe estar unido a hashes de modelo, predicciones y manifiesto de test,
sin IDs faltantes, extra o duplicados; el release de datos y la métrica deben
coincidir con el CLI. El directorio candidato aparece de forma atómica. Los
futuros paquetes ONNX visuales requieren otro flujo de conversión y benchmark.

Ejemplo de empaquetado de un **candidato no liberado**, únicamente después de
convertir y medir un checkpoint exacto:

```bash
python3 ml/scripts/package_model.py \
  --model private-data/export/1000-ojos.litertlm \
  --notice private-data/export/NOTICE.txt \
  --output private-data/candidates/1000-ojos-v1 \
  --id 1000-ojos-language \
  --version 1.0.0 \
  --task language-drafting \
  --estimated-peak-memory-bytes MEDIDO_EN_HARDWARE \
  --minimum-memory-bytes MEDIDO_EN_HARDWARE \
  --minimum-free-storage-bytes MEDIDO_EN_HARDWARE \
  --supported-cpu-architectures arm64-v8a \
  --evaluation-metric field_fidelity \
  --evaluation-value 0.99 \
  --evaluation-dataset-release-id sealed-events-v1 \
  --evaluation-report private-data/evaluation/report.json
```

Los marcadores `MEDIDO_EN_HARDWARE` no son números sugeridos: deben sustituirse
por resultados reproducibles. El comando solo produce un candidato
`released: false`; no habilita publicación.

## Orden de trabajo real

1. Validar formularios, reglas y borrador determinista en campo.
2. Aprobar procedencia, privacidad, taxonomía observable y releases de datos.
3. Probar primero un asistente de calidad de captura en shadow mode.
4. Entrenar una sola máscara visible para un material y protocolo soportados.
5. Evaluar por evento, edificio, territorio, dispositivo y condiciones OOD,
   incluyendo abstención e intervalos de confianza.
6. Ejecutar un estudio humano solo frente a humano+IA.
7. Considerar LoRA de Gemma únicamente si plantilla + esquema + recuperación
   local fallan de forma medida y el ajuste mejora el test sellado.
8. Convertir, medir y empaquetar el artefacto exacto; nunca renombrar una
   extensión para simular compatibilidad.

Los criterios completos están en
[`docs/training-runbook.md`](../docs/training-runbook.md).
