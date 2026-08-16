# ADR-058 — Autoridad, límites de emisión y encaje institucional
**Estado:** Borrador para aprobación (Gate P0 · DNA-62) · **Frente:** F1 Gobierno, datos y campo
**Fecha:** 2026-08-16 · **Decisores:** equipo MilOjos/1000ojos · **Consultado:** marco legal Ley 1523 (docs/marco_legal_ley1523.md)

## Contexto
El sistema produce triaje de daños post-sismo con IA a partir de reportes ciudadanos y capturas de brigada. En Colombia, la declaratoria de habitabilidad de una edificación es un acto técnico-oficial (metodología semáforo ATC-20/IDIGER bajo NSR-10, Art. 77 Ley 1523: demolición solo "previo informe técnico"). Un sistema que aparente emitir dictámenes crea riesgo legal, ético y reputacional; uno que solo "muestre mapas" no resuelve el cuello de botella (96.000 viviendas en cola, ago-2026).

## Decisión
1. **La IA del sistema NUNCA emite dictámenes de habitabilidad ni la palabra "seguro/insegura".** Su salida es exclusivamente *prioridad de inspección* (ALTA/MEDIA/BAJA) + señales observadas + confianza.
2. **El único emisor de veredictos es un profesional habilitado** (ingeniero/arquitecto con matrícula), que confirma o corrige en la interfaz de campo; su acto replica la sección *Posting + Further Actions* del formato oficial (ATC-20/IDIGER).
3. **Sesgo conservador obligatorio:** ante duda o baja confianza (foto deficiente, datos incompletos), el sistema eleva el nivel de prioridad; jamás lo reduce.
4. **Encaje institucional como complemento, no sustituto:** el sistema alimenta los flujos oficiales (RUD/EDAN, consejos municipales de gestión del riesgo — Arts. 27-29 Ley 1523) mediante exportación interoperable (Art. 46). La vía de participación es el Art. 62 (ejecución del plan por privados y comunidad organizada) y el Art. 61 (seguimiento del plan de acción específico).
5. **Mensajería anti-estafa y anti-rumor integrada:** todo cierre al ciudadano recuerda que el RUD es gratuito y que las réplicas no son predecibles (fuente: SGC).

## Alternativas consideradas
- *A. La IA clasifica habitabilidad directamente:* descartada — riesgo legal (acto técnico reservado), riesgo de "falso tranquilizador" con consecuencias fatales, inasegurable.
- *B. Sistema solo-visualización sin priorización:* descartada — ya existe (Copernicus EMS, agregadores); no ataca la fila de inspección.
- *C. (Elegida) IA prioriza + humano emite:* preserva utilidad y legalidad; convierte cada confirmación en dato etiquetado.

## Consecuencias
- El vocabulario "prioridad de inspección" es obligatorio en UI, prompts, docs y comunicaciones.
- La interfaz del profesional exige matrícula (COPNIA/CPNAA) en el registro de brigada.
- Toda métrica de calidad reporta **falsos tranquilizadores** como indicador principal (meta: 0).
- El disclaimer legal aparece en el primer contacto con el ciudadano y en cada informe.
