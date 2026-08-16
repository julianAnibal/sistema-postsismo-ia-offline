# ADR-060 — Privacidad, habeas data y anonimización
**Estado:** Borrador para aprobación (Gate P0 · DNA-62) · **Frente:** F1 Gobierno, datos y campo
**Fecha:** 2026-08-16 · **Marco:** Ley 1581/2012 (habeas data), Ley 1523/2012 Art. 45 parágrafo (privacidad dentro del sistema de información de gestión del riesgo)

## Contexto
El sistema maneja datos de personas en situación de vulnerabilidad extrema (damnificados), fotografías de viviendas, composición del hogar y ubicaciones. El Art. 45 (parágrafo) de la Ley 1523 exige observar habeas data dentro de los sistemas de información del riesgo; la Ley 1581 exige finalidad, consentimiento y mínimo dato. Un incidente de privacidad destruiría la confianza que el sistema necesita para operar.

## Decisión
1. **Consentimiento explícito y en lenguaje claro en el primer contacto**, declarando finalidad única: coordinar inspección y acceso a ayudas. Sin consentimiento, no se procesa.
2. **Mínimo dato:** solo se pide lo necesario para inspeccionar y priorizar. Nada de cédulas en el flujo ciudadano (el RUD oficial las gestiona el Estado).
3. **Separación física** (ADR-059): PII en almacén restringido con control de acceso y bitácora; datos operativos con coordenadas reducidas; el mapa público muestra SOLO agregados por zona — nunca casos individuales, nombres, teléfonos ni direcciones exactas (patrón validado por Respuesta Venezuela).
4. **Anonimización previa a cualquier uso secundario (entrenamiento, informes públicos, investigación):** remover EXIF, rostros, placas, documentos visibles; ubicación reducida; auditoría de una muestra por humano antes de cada publicación de dataset.
5. **Fotografías de menores o interiores con personas:** se difumina o descarta la imagen; la observación textual permanece.
6. **Retención:** datos operativos se conservan durante la declaratoria + reconstrucción (ventana legal Art. 64: hasta 12+12 meses); PII se elimina o re-consiente al cierre del evento.
7. **Derechos ARCO:** canal en el propio bot ("BORRAR MIS DATOS") con SLA de 15 días hábiles.

## Alternativas
- *Anonimizar "después", al exportar:* descartada — la separación tardía siempre gotea.
- *No manejar PII en absoluto:* descartada — sin contacto no hay despacho de inspección ni aviso a la familia; el valor operativo lo exige, con salvaguardas.

## Consecuencias
- El texto de consentimiento es un artefacto versionado del repo (revisión legal antes de producción).
- Los pipelines de entrenamiento consumen únicamente la vista anonimizada; CI falla si detecta campos PII en ese flujo.
- Todo acceso a la tabla PII queda registrado (quién, cuándo, por qué).
- El equipo designa un responsable de tratamiento de datos (rol, no persona): propuesto — líder F1.
