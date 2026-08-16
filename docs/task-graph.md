# Task Graph

## Hitos

| Hito | Resultado |
|---|---|
| M1 Gobierno y harness | OpenSymphony operativo y ADRs P0 aprobadas |
| M2 Piloto ODK | Flujo de campo medido antes de construir toda la app |
| M3 Núcleo móvil offline | Captura, datos, mapas, IA y sync local |
| M4 Consola e informes | Backend, revisión, población e informe verificable |
| M5 Validación territorial | Simulacro, endurecimiento y decisión go/no-go |

## Camino crítico

```mermaid
flowchart TD
  H["DNA-57 Harness"] --> G["DNA-62 Gate P0"]
  A["DNA-58 Autoridad"] --> G
  S["DNA-59 Esquema"] --> G
  P["DNA-60 Privacidad"] --> G
  L["DNA-61 Licencias"] --> G
  G --> F["DNA-63 Formularios ODK"]
  P --> C["DNA-64 ODK Central"]
  L --> M["DNA-65 Mapa piloto"]
  F --> O["DNA-66 Simulacro ODK"]
  C --> O
  M --> O
  O --> R["DNA-67 Esqueleto móvil"]
  R --> D["DNA-68 SQLite"]
  D --> Y["DNA-74 Sincronización"]
  B["DNA-72 Backend"] --> Y
  Y --> W["DNA-75 Consola"]
  W --> E["DNA-78 Piloto E2E"]
  E --> X["DNA-79 Endurecimiento"]
  X --> N["DNA-80 Go/No-Go"]
```

## Regla de despacho

Sólo `Todo`, `In Progress` e `In Review` son estados activos para el harness.
Las tareas de implementación permanecen en `Backlog` hasta que una persona
confirme que sus dependencias y aprobaciones están completas.

## Frentes

- **F1 Gobierno, datos y campo:** DNA-58, 60, 62, 63, 66 y 80.
- **F2 Móvil, offline e IA:** DNA-57, 61, 65, 67, 68, 69, 70, 71 y 74.
- **F3 Plataforma, web e informes:** DNA-59, 64, 72, 73, 75, 76, 77, 78 y 79.

La asignación, las revisiones cruzadas y el contrato de ramas/PR están en
[`team-workflow.md`](team-workflow.md).
