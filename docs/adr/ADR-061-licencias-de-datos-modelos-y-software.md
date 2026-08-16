# ADR-061 — Licencias de datos, modelos y software
**Estado:** Borrador para aprobación (Gate P0 · DNA-62) · **Frente:** F2 Móvil, offline e IA
**Fecha:** 2026-08-16 · **Base:** inventario de fuentes del hackathon CTW-2026 (eval/fotos/FUENTES.md)

## Contexto
El sistema combina modelos abiertos, datasets públicos, imágenes de terceros y normas técnicas. Cada pieza tiene términos distintos; mezclarlos sin registro crea riesgo al pasar de demo a producto (y el proyecto aspira a fase comercial/institucional).

## Decisión
Mantener un **registro de licencias versionado (este ADR + tabla viva)** y aplicar la regla: *nada entra al producto sin fila en la tabla*.

| Activo | Licencia/términos | Uso permitido aquí | Restricción clave |
|---|---|---|---|
| Gemma (3n/E2B u versión vigente) | Gemma Terms of Use (Google) | Ejecución local, fine-tuning LoRA, despliegue | Cumplir política de uso; citar; verificar versión exacta antes de publicar |
| LiteRT-LM / AI Edge Torch | Apache-2.0 (verificar por componente) | Conversión y ejecución móvil | Atribución |
| ATC-20 (formatos) | © Applied Technology Council — uso NO comercial permitido con aviso | Metodología del cuestionario en piloto | Fase comercial: licenciar o migrar 100% al formato oficial colombiano (IDIGER/AIS) |
| EMS-98 (escala y láminas) | Publicación científica ESC; SGC la aloja públicamente | Set de calibración con cita | Citar fuente y no alterar contenido |
| Copernicus EMS (EMSR916) | Libre con atribución (Copernicus) | Capa de daño en mapa e índice | Atribuir "© European Union, Copernicus EMS" |
| Imágenes Vantor/OpenAerialMap | CC BY-NC 4.0 | Demo, calibración, uso cívico no comercial | **NO comercial**: en fase de ingresos, sustituir por fuentes licenciadas |
| Fotos de prensa (Semana, Infobae, El Tiempo) | © de cada medio | Evaluación interna únicamente | **No redistribuir en repo público**; citar URL en tablas |
| SDNET2018 / Crack-Seg | Académicas/abiertas (verificar cada una) | Pre-entrenamiento visión | Citar paper; revisar términos por dataset |
| Datos abiertos (IDEAM, Datos Abiertos Bogotá, DANE, Colombia en Mapas) | Licencias de datos abiertos gov.co | Factores del índice, capas | Atribución a la entidad |
| Mapa del Terremoto (Naboo) | Datos abiertos desde 2026-11-30 | Integración posterior | Esperar apertura o acuerdo previo |
| OpenStreetMap (si se usa base) | ODbL | Mapas base | Atribución y share-alike sobre datos derivados |
| Código propio | Por definir: **MIT propuesta** para el harness/docs; evaluar cláusula distinta para el core si hay tesis comercial | — | Decisión explícita antes del primer release |

Reglas:
1. Todo dataset de entrenamiento registra la procedencia POR IMAGEN (campo `source_license`).
2. Los assets NC (Vantor, ATC-20) se marcan para sustitución en el hito de comercialización.
3. Las fotos aportadas por ciudadanos: el consentimiento (ADR-060) incluye licencia de uso al proyecto para operación y mejora del sistema — no para reventa.

## Alternativas
- *"Resolver licencias cuando toque":* descartada — el costo de rehacer un dataset contaminado supera 100× el de registrar al ingreso.

## Consecuencias
- CI valida que `eval/` y datasets tengan manifiesto de fuentes.
- El README público lleva sección de atribuciones.
- Revisión de esta tabla en cada hito (M2-M5).
