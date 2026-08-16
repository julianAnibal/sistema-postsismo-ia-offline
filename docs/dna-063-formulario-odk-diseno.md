# DNA-63 — Diseño del formulario ODK (preparación)
**Frente:** F1 Gobierno, datos y campo · **Depende de:** Gate P0 (DNA-62) · **Habilita:** DNA-66 (simulacro)
**Estado:** Preparación — listo para construir apenas abra el Gate

## Qué es y por qué ODK
ODK (Open Data Kit) es el estándar de captura de datos en campo sin internet: se diseña el formulario en una hoja de cálculo (**XLSForm**), se publica en un servidor (ODK Central) y los brigadistas lo llenan desde el celular **offline**; los datos se sincronizan cuando hay señal. Es lo que usan ONGs y gobiernos en emergencias — no hay que inventarlo.

**Regla de oro del piloto:** medir el flujo de campo con ODK ANTES de construir la app propia (hito M2). Si el formulario funciona en papel-digital, la app tiene sentido; si no, la app no lo arregla.

## Estructura propuesta (derivada 1:1 del ATC-20 y del cuestionario de MilOjos)

**Grupo 0 · Identificación**
`inspection_id` (auto) · `event_id` (SISMO-2026-08-10) · `fecha_hora` (auto) · `inspector_matricula` (hash) · `entidad_avaladora` (Comisión Técnica / Cruz Roja / alcaldía…) · `tipo_visita` (primera / seguimiento)

**Grupo 1 · Ubicación y edificación**
GPS (auto, precisión) · dirección · barrio · municipio (DIVIPOLA) · `building_type` (mampostería no reforzada / confinada / pórtico concreto / adobe-tapia / acero / madera / mixto) · pisos sobre y bajo nivel · año aproximado o época constructiva (pre-1984 / 1984-1998 / post-NSR-98) · uso (vivienda / comercio / mixto / institucional) · n.º de unidades y unidades no habitables

**Grupo 2 · Condiciones observadas** (las 5 del ATC-20, cada una: ninguno/leve · moderado · severo)
1. Colapso, colapso parcial o edificación fuera de su cimentación
2. Edificación o piso inclinado
3. Daño en muros u otro daño estructural (fisuración diagonal, aplastamiento, acero expuesto)
4. Chimenea, parapeto, tanque, antena u otro elemento con riesgo de caída
5. Movimiento o agrietamiento del terreno / talud

**Grupo 3 · Detalle por elemento** (repetible — un registro por elemento dañado)
`component` (columna/viga/muro portante/muro divisorio/losa/cubierta/escalera/cimentación) · `damage_type` (fisuración / grieta / aplastamiento / desprendimiento / pandeo / desplazamiento / corrosión) · `geometry` (diagonal / vertical / horizontal / escalonada) · ancho aproximado (mm, con referencia visual) · pasante sí/no · **foto obligatoria con escala** (moneda o tarjeta)

**Grupo 4 · Habitabilidad y acciones** (solo el profesional)
`posting` (INSPECCIONADA verde / USO RESTRINGIDO amarillo / NO SEGURA roja) · restricciones textuales exactas como quedan en la placa · barricadas requeridas (dónde) · evaluación detallada recomendada (estructural / geotécnica / otra) · comentarios

**Grupo 5 · Hogar y vulnerabilidad** (para focalizar ayuda — ADR-060 aplica)
habitantes · menores de 5 · mayores de 60 · embarazo · discapacidad · dónde duermen desde el sismo · requiere albergue sí/no

**Grupo 6 · Protocolo fotográfico** (mínimo 4)
1. Fachada completa · 2. Vista general del interior · 3. Daño principal en detalle con escala · 4. Contexto de la manzana / vecinos. *Opcional:* terreno y talud.

## Reglas de validación a codificar en el XLSForm
- Si `colapso = severo` o `inclinación = severo` o `acero expuesto = sí` → `posting` no puede ser verde (regla dura, `constraint`).
- Foto obligatoria cuando cualquier condición ≠ ninguno.
- GPS con precisión > 30 m obliga a confirmar dirección manualmente.
- Ningún campo pide cédula del habitante (ADR-060).
- Toda pregunta con opción "no sé" que no bloquee el avance.

## Entregables de DNA-63
1. `forms/edan_estructural_v1.xlsx` (XLSForm) + su versión publicada en ODK Central.
2. Diccionario de campos alineado a ADR-059 (mapeo XLSForm → esquema canónico).
3. Guía de campo de 1 página para el brigadista (protocolo fotográfico + qué NO decidir).
4. 5 casos de prueba llenados en simulacro interno antes de DNA-66.

## Criterio de aceptación sugerido
Un brigadista sin entrenamiento previo completa una inspección en **≤ 8 minutos**, sin internet, y el registro exporta al esquema canónico sin campos vacíos obligatorios.
