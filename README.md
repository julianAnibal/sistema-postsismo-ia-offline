# OpenSymphony Harness: Sistema Postsismo IA Offline

Harness local para convertir el proyecto de Linear en decisiones revisables y
tareas de implementación aisladas. Usa OpenSymphony con el Codex app-server y
mantiene las tareas de alto riesgo bloqueadas por ADRs aprobadas.

## Estado de la instalación

- OpenSymphony: 2.11.3
- Rust: 1.97.1
- Codex CLI: 0.142.5, autenticado con ChatGPT
- Tracker: Linear, equipo `DNA+art`
- Proyecto: [Sistema Postsismo IA Offline](https://linear.app/dnaart/project/sistema-postsismo-ia-offline-d12fe65705e4)
- Ejecutor: Codex app-server local
- OpenHands: no instalado; es opcional
- Repositorio remoto: [julianAnibal/sistema-postsismo-ia-offline](https://github.com/julianAnibal/sistema-postsismo-ia-offline), privado

## Qué quedó creado

- cinco hitos, desde gobierno hasta validación territorial;
- epic `DNA-56`;
- tareas `DNA-57` a `DNA-80` con criterios de aceptación;
- relaciones `blockedBy` para proteger el camino crítico;
- cuatro ADR P0 en `Todo`;
- implementación posterior en `Backlog` hasta aprobación.

## Primer arranque

OpenSymphony necesita una API key personal de Linear en la terminal. La conexión
OAuth de la aplicación de escritorio no expone esa clave al proceso local.

```bash
gh auth login
git clone https://github.com/julianAnibal/sistema-postsismo-ia-offline.git
cd sistema-postsismo-ia-offline
source ~/.zshrc
export LINEAR_API_KEY='lin_api_...'
./scripts/doctor.sh
./scripts/run.sh
```

En otra terminal:

```bash
cd sistema-postsismo-ia-offline
./scripts/tui.sh
```

Detener el orquestador con `Ctrl-C`. No usar `Ctrl-Z`, porque puede dejar el
proceso suspendido y conservar recursos abiertos.

## Flujo

```text
Backlog -> Todo -> In Progress -> In Review -> Done
```

- El operador mueve una tarea elegida de `Backlog` a `Todo`.
- OpenSymphony verifica dependencias y crea un espacio aislado.
- Codex documenta o implementa, valida, publica una rama y abre un PR.
- La tarea pasa a `In Review`.
- Una persona aprueba y mueve a `Done`, o devuelve a `In Progress`.

## Límite actual

El harness está instalado y configurado, pero no debe ejecutarse hasta exportar
`LINEAR_API_KEY`. La estación operadora también debe mantener autenticado
GitHub CLI para clonar el repositorio privado y publicar ramas de trabajo. La
revisión humana ocurre en GitHub y la aprobación de decisiones se conserva en
Linear.

## Documentación

- [Resumen del producto](docs/product-brief.md)
- [Grafo de tareas](docs/task-graph.md)
- [Trabajo coordinado para tres personas](docs/team-workflow.md)
- [Runbook](docs/runbook.md)
- [Prueba de funcionamiento](docs/proof-of-life.md)
- [Registro de decisiones](docs/decisions/README.md)
