# Entrenamiento de 1000 ojos

Este directorio implementa el recorrido reproducible de datos y modelos de
1000 ojos. Separa deliberadamente dos problemas:

- `language`: ajuste LoRA para redactar borradores estructurados, detectar
  campos faltantes y negarse a emitir dictamenes sin revision profesional.
- `vision`: segmentacion de condiciones visibles en fotografias. Sus salidas
  son sugerencias y nunca un dictamen de habitabilidad.

El telefono ejecuta inferencia. El entrenamiento se realiza en una maquina con
GPU o en un trabajo remoto.

## Demostracion local

```bash
python3 -m unittest discover -s ml/tests -v
python3 ml/scripts/pipeline.py demo
```

La demostracion valida los ejemplos sinteticos, crea una particion agrupada por
evento e infraestructura, prepara JSONL para SFT, evalua predicciones de control
y produce un manifiesto de paquete. No descarga modelos ni necesita GPU.

## Entrenamiento real

1. Copiar exportaciones anonimizadas a `private-data/training/`.
2. Validarlas con `python3 ml/scripts/pipeline.py validate --input RUTA`.
3. Crear particiones con `python3 ml/scripts/pipeline.py split --input RUTA`.
4. Publicar el dataset privado y lanzar `ml/jobs/train_sft_lora.py` en una GPU.
5. Preparar imagenes y mascaras YOLO y lanzar
   `ml/jobs/train_vision_segmentation.py`.
6. Evaluar en un conjunto bloqueado antes de convertir o publicar modelos.

Los comandos, criterios de aceptacion y formato de anotacion se detallan en
[`docs/training-runbook.md`](../docs/training-runbook.md).
