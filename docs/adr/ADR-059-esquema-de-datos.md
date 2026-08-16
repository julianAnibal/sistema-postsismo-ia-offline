# ADR-059 — Esquema de datos canónico
**Estado:** Borrador para aprobación (Gate P0 · DNA-62) · **Frente:** F3 Plataforma
**Fecha:** 2026-08-16 · **Base:** expediente MilOjos (hackathon CTW-2026) + esquema de entrenamiento (docs/roadmap_entrenamiento)

## Contexto
El sistema captura evaluaciones en campo (ODK/brigada), reportes ciudadanos (WhatsApp) y verificaciones profesionales. El mismo dato debe servir para: (a) operar la fila de inspección, (b) alimentar informes oficiales (RUD/EDAN), (c) producir dataset de entrenamiento auditable. Sin un esquema canónico, cada frente inventa campos y el dato pierde valor probatorio y de entrenamiento.

## Decisión
Adoptar un **esquema canónico único por inspección**, con separación estricta entre datos operativos y datos personales:

```json
{
  "inspection_id": "INS-2026-000184",
  "event_id": "SISMO-2026-08-10",
  "source": "odk|whatsapp|brigada",
  "building_type": "mamposteria_no_reforzada",
  "component": "muro_portante",
  "observation": "fisura diagonal junto al vano",
  "damage_type": "fisuracion_diagonal",
  "geometry": "diagonal|vertical|horizontal|escalonada",
  "severity_observed": "leve|moderada|severa",
  "priority_ai": "ALTA|MEDIA|BAJA",
  "confidence": 0.82,
  "red_flags": ["acero_expuesto"],
  "vulnerability": {"menores5": true, "mayores": false, "embarazo": false, "discapacidad": false, "habitantes": 4},
  "latitude_reduced": 4.61,
  "longitude_reduced": -74.08,
  "photos": ["photo_01"],
  "weather_factor": 1.2,
  "zone_factor": 1.4,
  "review": {"status": "approved|corrected|pending", "reviewer_role": "ingeniero_estructural", "reviewer_license": "hash", "corrections": []}
}
```

Reglas duras:
1. **Datos personales (nombres, teléfonos, dirección exacta, rostros, placas) viven en una tabla separada con acceso controlado** y se vinculan por `inspection_id`; NUNCA entran al dataset de entrenamiento. Coordenadas se reducen a 2 decimales (~1,1 km) fuera del ámbito operativo.
2. **Taxonomía multi-dimensión para imágenes** (tipo de infraestructura, sistema estructural, elemento, material, daño, geometría, severidad, máscara/caja, calidad de foto, estado de revisión) — nunca una clase única "grave/leve", nunca la etiqueta "edificio_seguro".
3. Toda corrección profesional queda versionada (quién, cuándo, qué cambió) — es a la vez trazabilidad legal y candidato de entrenamiento.
4. Identificadores: `inspection_id` secuencial por evento; `event_id` con fecha del sismo; exportación CSV/GeoJSON alineada a vocabulario EDAN/DIVIPOLA para interoperar (Art. 46 Ley 1523) y con capas externas (Copernicus EMS, Mapa del Terremoto).

## Alternativas
- *Esquemas por frente (móvil/backend/IA separados):* descartado — divergencia garantizada, dataset inservible.
- *Guardar todo junto (PII incluida) y filtrar al exportar:* descartado — un solo leak contamina el dataset completo; la separación debe ser física, no cosmética.

## Consecuencias
- ODK forms, SQLite móvil, backend y consola implementan ESTE esquema (validación en CI con JSON Schema).
- El dataset de entrenamiento se deriva con un job que excluye PII por construcción.
- Los conjuntos de entrenamiento/validación/prueba se separan por edificio, evento y zona (sin fugas).
