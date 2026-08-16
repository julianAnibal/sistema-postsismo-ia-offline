# ADR-060 — Privacidad, habeas data y anonimización
**Estado:** ✅ **APROBADA** — 16-ago-2026 por German Burgos (Líder F1) · Gate P0 (DNA-62) pendiente de ADR-059 y ADR-061 · **Frente:** F1 Gobierno, datos y campo
**Equipo:** German Burgos · Julián Henao · Luis Rosal
**Fecha:** 2026-08-16 · **Marco:** Ley 1581/2012 · Ley 1523/2012 Art. 45 parágrafo

## Contexto
El sistema maneja datos de personas en vulnerabilidad extrema, fotografías de viviendas, composición del hogar y ubicaciones. El Art. 45 (parágrafo) de la Ley 1523 exige observar habeas data dentro de los sistemas de información del riesgo. Un incidente destruiría la confianza que el sistema necesita para operar.

## Decisión
1. **Consentimiento explícito y en lenguaje claro en el primer contacto**, con finalidad única: coordinar inspección y acceso a ayudas. Texto versionado en [`docs/consentimiento.md`](../consentimiento.md).
2. **Mínimo dato:** nada de cédulas en el flujo ciudadano (el RUD lo gestiona el Estado).
3. **Separación física** (ADR-059): PII en almacén restringido con bitácora; operativos con coordenadas reducidas; el mapa público muestra **solo agregados por zona**.
4. **Anonimización previa a todo uso secundario:** sin EXIF, sin rostros, placas ni documentos; ubicación reducida; auditoría humana de una muestra antes de publicar cualquier dataset.
5. **Menores y personas en la imagen:** se difumina o descarta la foto; la observación textual permanece.
6. **Retención:** operativos durante declaratoria + reconstrucción (ventana Art. 64: hasta 12+12 meses); PII se elimina o re-consiente al cierre del evento.
7. **Derechos ARCO:** palabra clave `BORRAR MIS DATOS` en el bot. **SLA: 15 días hábiles** (máximo legal de consulta; si el equipo operativo no puede sostenerlo, se automatiza el borrado antes de abrir a público — no se relaja el plazo).
8. **Responsable del tratamiento de datos:** **German Burgos** — Líder de Gobierno de Datos (frente F1). Es el único rol con acceso de lectura a la tabla PII sin ticket, responde por las solicitudes ARCO y autoriza cada publicación de dataset. Su relevo debe quedar por escrito en este ADR.

## Alternativas
- *Anonimizar al exportar:* descartada — la separación tardía gotea.
- *No manejar PII:* descartada — sin contacto no hay despacho ni aviso a la familia.

## Consecuencias
- CI falla si detecta campos PII en el flujo de entrenamiento.
- Todo acceso a PII queda registrado (quién, cuándo, por qué).
- El texto de consentimiento requiere revisión de un abogado antes de producción (pendiente).
