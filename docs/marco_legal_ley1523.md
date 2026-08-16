# Marco legal — MilOjos y la Ley 1523 de 2012
*(Sección lista para pegar en el README del repo. Verificada contra el texto oficial de la ley — Gestor Normativo de Función Pública, con las modificaciones de la Ley 2474 de 2025.)*

## Por qué MilOjos tiene mandato legal

**MilOjos operacionaliza obligaciones que la Ley 1523 de 2012 (Política Nacional de Gestión del Riesgo de Desastres) impone desde hace 14 años y que el terremoto del 10 de agosto de 2026 dejó en evidencia como incumplidas o desbordadas:**

1. **Art. 45 — Sistema Nacional de Información para la Gestión del Riesgo.** La UNGRD debe poner en marcha un sistema de información que, entre otros, *"responda a las necesidades de información sobre las estadísticas de afectación y de apoyos brindados […] en las situaciones de emergencia"* (num. 6) y *"articule los sistemas de información de las entidades nacionales, departamentales, distritales y municipales"* (num. 7). Al 12-ago-2026, OCHA/ONU reportó que no se conoce con precisión el número de damnificados ni las necesidades por municipio. **MilOjos es exactamente ese instrumento de estadística de afectación en emergencia, para la vivienda.**

2. **Art. 46 — Sistemas de información territoriales.** Las autoridades departamentales, distritales y municipales *"crearán sistemas de información para la gestión del riesgo de desastres en el ámbito de su jurisdicción, garantizando la interoperabilidad con el sistema nacional"*. **MilOjos nace interoperable por diseño** (exporta CSV/GeoJSON compatibles con los estándares del sistema nacional y el flujo RUD).

3. **Art. 4 núm. 24 ("Respuesta") y núm. 17 ("Preparación").** La ley define la **evaluación de daños y análisis de necesidades (EDAN)** como servicio básico de la respuesta. MilOjos digitaliza y prioriza la puerta de entrada de ese servicio, hoy en papel (metodología semáforo/ATC-20 bajo NSR-10), con humano en el lazo.

4. **Art. 77 — Orden de demolición.** Los alcaldes, *"previo informe técnico"*, pueden ordenar demoler construcciones que amenacen ruina. Ese informe técnico exige inspección profesional: **la cola priorizada de MilOjos es el mecanismo para llegar a ese informe más rápido donde más urge** (8.385 viviendas en evaluación al 12-ago; Manizales solicitó 500 ingenieros voluntarios).

## Por qué la participación ciudadana del bot es legalmente legítima

5. **Art. 2 — Corresponsabilidad.** *"Los habitantes del territorio nacional, corresponsables de la gestión del riesgo, actuarán con precaución, solidaridad, autoprotección"*. El reporte ciudadano vía WhatsApp estructura esa corresponsabilidad.
6. **Art. 3 núm. 5 — Principio participativo.** Es **deber** de las autoridades *"reconocer, facilitar y promover la organización y participación de comunidades"* y *"es deber de todas las personas hacer parte del proceso de gestión del riesgo en su comunidad"*.
7. **Art. 3 núm. 15 — Principio de oportuna información.** Es **obligación** de las autoridades del sistema *"mantener debidamente informadas a todas las personas"* sobre riesgo, gestión de desastres y acciones de rehabilitación. El bot devuelve a cada familia información oficial (recomendaciones, pasos del RUD gratuito, alertas anti-estafa) — cerrando además la puerta a la desinformación viral.
8. **Art. 62 — Participación de entidades.** En el acto que declara el desastre se determinará *"la forma y modalidades en que podrán participar las entidades y personas jurídicas privadas y la comunidad organizada en la ejecución del plan"*. **La ley contempla explícitamente que actores privados y comunitarios ejecuten parte del plan de recuperación** — la vía de adopción de MilOjos.

## El periodo legal actual (por qué esto vive meses, no días)

9. **Art. 56:** el Presidente declaró la **situación de desastre** por decreto (10-ago-2026), activando el régimen especial. **Art. 57:** alcaldes/gobernadores declararon **calamidad pública** (p. ej. Pereira) previo concepto de sus consejos de gestión del riesgo.
10. **Art. 61 — Plan de acción específico para la recuperación:** UNGRD (nacional) y gobernaciones/alcaldías (territorial) **deben** elaborar planes de rehabilitación y reconstrucción *"de obligatorio cumplimiento por todas las entidades públicas o privadas que deban contribuir a su ejecución"*, con seguimiento y evaluación a cargo de la UNGRD. **El tablero de MilOjos es una herramienta de seguimiento de ese plan.**
11. **Art. 64 — Retorno a la normalidad:** la declaratoria de desastre dura **hasta 12 meses, prorrogables por 12 más** (calamidad: 6+6), y aun al declarar la normalidad pueden mantenerse las normas especiales durante la rehabilitación y reconstrucción. **Ventana legal de operación: hasta 2 años.**
12. **Arts. 65-66 — Régimen especial:** durante la declaratoria rige contratación especial ágil (remisión al art. 13 de la Ley 1150 de 2007) para actividades de respuesta, rehabilitación y reconstrucción → **una entidad puede adoptar MilOjos en semanas, no en años.** (Complementos del régimen: Art. 82 acceso obligatorio a redes de telecomunicaciones; Art. 89 donaciones administradas conforme al plan de acción.)

## Alineación con el Track 04 (Planeta y Comunidad · Resiliencia)

13. **Art. 4 núm. 1 — "Adaptación":** la propia ley define la adaptación como el ajuste de sistemas humanos *"con el fin de moderar perjuicios"*, orientada a *"la reducción de la vulnerabilidad o al mejoramiento de la resiliencia en respuesta a los cambios observados o esperados del clima"*, y precisa que para eventos hidrometeorológicos **la adaptación al cambio climático corresponde a la gestión del riesgo de desastres**. El Índice de Prioridad de MilOjos (daño reportado × microzonificación × grado EMS × pronóstico IDEAM) es, en términos de la ley, **una herramienta de adaptación y resiliencia comunitaria**.

## Protección de datos (guardrail de diseño)

14. **Art. 45, parágrafo:** las entidades que producen y usan información del sistema *"deben garantizar la observancia de las limitaciones de acceso y uso referidas al derecho de habeas data, privacidad"*. MilOjos pide el mínimo dato necesario, con consentimiento explícito en el primer mensaje (Ley 1581 de 2012), nunca publica datos personales en el mapa público, y la IA no emite veredictos de habitabilidad: asigna prioridad de inspección; **el ingeniero decide** (principio de precaución, Art. 3 núm. 8; prevalencia de la vida humana, Art. 3 núm. 17).

---
*Cliente institucional definido por la propia ley: UNGRD (Art. 18), consejos departamentales, distritales y municipales de gestión del riesgo (Arts. 27-29 — con coordinador obligatorio y, en municipios de más de 250.000 habitantes, dependencia dedicada), financiables vía Fondo Nacional y fondos territoriales de gestión del riesgo (Arts. 47, 51 — subcuentas de Manejo de Desastres y de Recuperación — y 54).*
