# ADR-058 — Autoridad, límites de emisión y validación profesional
**Estado:** ✅ **APROBADA** — 16-ago-2026 por German Burgos (Líder F1) · Gate P0 (DNA-62) pendiente de ADR-059 y ADR-061 · **Frente:** F1 Gobierno, datos y campo
**Equipo:** German Burgos · Julián Henao · Luis Rosal
**Fecha:** 2026-08-16 · **Base legal:** Ley 1523/2012 (Arts. 61, 62, 77) · **Base gremial:** Comisión Técnica Nacional (CAMACOL y aliados)

## Contexto
La declaratoria de habitabilidad es un acto técnico-oficial (semáforo ATC-20/IDIGER bajo NSR-10; Art. 77 Ley 1523: demolición solo "previo informe técnico"). Un sistema que aparente emitir dictámenes crea riesgo legal y ético; uno que solo visualice no resuelve la cola (≈96.000 viviendas, ago-2026).

**Hecho nuevo (v2):** el gremio ya organizó la oferta profesional. CAMACOL Nacional, con la Sociedad Colombiana de Ingenieros, la Sociedad Colombiana de Arquitectos, AIS, ACI y CEER, abrió una **Comisión Técnica** que registra voluntarios (ingenieros, arquitectos, estudiantes) con **matrícula profesional, ubicación y disponibilidad**, declarando que su labor "es de carácter técnico y no sustituye las competencias de las autoridades". Es el mismo límite que este ADR fija — y es la fuente natural de verificación profesional.

## Decisión
1. **La IA nunca emite dictamen de habitabilidad ni las palabras "seguro/insegura".** Su salida es *prioridad de inspección* (ALTA/MEDIA/BAJA) + señales observadas + confianza.
2. **El veredicto lo emite un profesional habilitado**, que confirma o corrige en campo replicando la sección *Posting + Further Actions* del formato oficial.
3. **Validación profesional federada, no propia:** el sistema NO construye un registro paralelo de credenciales. El profesional se acredita declarando (a) matrícula profesional y (b) pertenencia a la Comisión Técnica Nacional u otra entidad del SNGRD (Cruz Roja, Defensa Civil, bomberos, gobernación/alcaldía). El coordinador de brigada valida contra el listado de la entidad; el sistema guarda el hash de la matrícula, nunca el documento.
4. **Sesgo conservador obligatorio:** ante duda o baja confianza, sube el nivel; nunca lo baja.
5. **Encaje institucional como complemento:** exportación interoperable a RUD/EDAN y consejos municipales (Arts. 46, 27-29); participación por la vía del Art. 62; el tablero sirve al seguimiento del Art. 61.
6. **Alineación de lenguaje con el gremio:** el sistema replica el disclaimer de la Comisión Técnica ("carácter técnico, no sustituye a las autoridades") en informes y en la app.

## Alternativas consideradas
- *IA clasifica habitabilidad:* descartada (acto reservado, riesgo de falso tranquilizador, inasegurable).
- *Registro propio de credenciales:* descartada — duplicaría un esfuerzo gremial ya existente, sin autoridad para validar matrículas; genera fricción y riesgo de suplantación.
- *Solo visualización:* descartada — no ataca la fila.

## Consecuencias
- "Prioridad de inspección" es vocabulario obligatorio en UI, prompts y docs.
- El alta de brigadista pide matrícula + entidad avaladora; el coordinador aprueba.
- Métrica principal de calidad: **falsos tranquilizadores = 0**.
- **Acción de relacionamiento:** contactar a la Comisión Técnica Nacional (CAMACOL y aliados) para ofrecer MilOjos como capa de despacho de sus voluntarios registrados. Ellos tienen la oferta; nosotros la fila priorizada.
