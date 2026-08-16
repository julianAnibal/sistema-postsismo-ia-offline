# Runbook del operador

## Requisitos

- `LINEAR_API_KEY` personal con acceso al equipo `DNA+art`.
- Codex CLI autenticado con ChatGPT.
- GitHub CLI autenticado con acceso al repositorio privado.
- OpenSymphony y Rust disponibles en `PATH`.
- Este repositorio debe tener al menos un commit en `main`.

## Preparar sesión

```bash
gh auth status
source ~/.zshrc
export LINEAR_API_KEY='lin_api_...'
cd sistema-postsismo-ia-offline
./scripts/doctor.sh
```

## Iniciar

```bash
./scripts/run.sh
```

En otra terminal:

```bash
./scripts/tui.sh
```

## Activar trabajo

1. Revisar dependencias y criterios en Linear.
2. Mover una tarea de `Backlog` a `Todo`.
3. Observar creación de workspace y transición a `In Progress`.
4. Revisar el único comentario `Agent Harness Workpad`.
5. Revisar la rama y validación cuando pase a `In Review`.
6. Mover a `Done` si se aprueba o a `In Progress` con feedback.

Las ADRs `DNA-58` a `DNA-61` ya están en `Todo`; no activar tareas dependientes
hasta resolverlas.

## Detener y recuperar

- Usar `Ctrl-C` para detener limpiamente.
- Consultar `opensymphony debug DNA-XX` para reabrir una ejecución.
- Ejecutar `opensymphony doctor` después de cambios de credenciales o versión.
- Los workspaces viven en `~/.opensymphony/workspaces/postsismo`.

## Incidente de credenciales

1. Detener OpenSymphony.
2. Revocar la key en Linear.
3. Revisar historial de terminal y archivos locales.
4. Generar una key nueva y exportarla sólo en la sesión.
5. Confirmar que `.env`, logs y workspaces no contienen la key.

## Colaboración por GitHub

Cada tarea usa una rama `work/DNA-XX`, la publica en GitHub y abre o actualiza
un pull request hacia `main`. La revisión del código ocurre en GitHub; Linear
conserva el estado, las dependencias y la aprobación humana de las decisiones.
