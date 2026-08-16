# Flujo de trabajo para tres personas

## Objetivo

Tres personas trabajan en paralelo sin dividir la fuente de verdad. Linear
define alcance, dependencias y aprobaciones; GitHub conserva codigo, decisiones,
revision y evidencia ejecutable.

## Frentes y responsables provisionales

| Frente | Responsable | Alcance principal | Tareas lideradas |
|---|---|---|---|
| F1 Gobierno, datos y campo | Tercer colaborador (nombre y usuario GitHub pendientes) | autoridad, privacidad, formularios, piloto y go/no-go | DNA-58, DNA-60, DNA-62, DNA-63, DNA-66, DNA-80 |
| F2 Movil, offline e IA | Julian (`@julianAnibal`) | harness, mapas, aplicacion movil, captura, IA local y sincronizacion | DNA-57, DNA-61, DNA-65, DNA-67, DNA-68, DNA-69, DNA-70, DNA-71, DNA-74 |
| F3 Plataforma, web e informes | Luis (usuario GitHub pendiente) | ODK Central, API, datos, consola, informes y validacion | DNA-59, DNA-64, DNA-72, DNA-73, DNA-75, DNA-76, DNA-77, DNA-78, DNA-79 |

La asignacion es un punto de partida por arquitectura. Cada responsable lidera
la entrega, pero no aprueba en solitario sus propias decisiones.

## Trabajo conjunto obligatorio

- DNA-58 a DNA-61: cada ADR tiene un autor y revision de las otras dos personas.
- DNA-62: no se cierra hasta demostrar que una tarea bloqueada no se despacha.
- DNA-66: los tres participan en el simulacro ODK y su retrospectiva.
- DNA-74: F2 lidera el cliente y F3 aprueba el contrato servidor.
- DNA-76: F3 genera el informe y F1 valida semantica y autoridad.
- DNA-78 y DNA-79: los tres ejecutan el piloto, recuperacion y capacitacion.
- DNA-80: decision conjunta; ningun agente puede aprobarla.

## Contrato Git y Linear

1. Elegir una tarea sin bloqueos y moverla de `Backlog` a `Todo` en Linear.
2. Crear una rama desde `main`: `work/DNA-XX-descripcion-corta`.
3. Mantener una sola tarea principal activa por persona.
4. Incluir `DNA-XX` al inicio de cada commit relevante.
5. Publicar la rama y abrir un PR titulado `[DNA-XX][F1|F2|F3] Resultado`.
6. Enlazar la URL exacta de Linear y completar la plantilla del PR.
7. Solicitar al menos una revision de otro frente; nadie aprueba su propio PR.
8. Resolver comentarios y esperar la validacion automatica antes de integrar.
9. Integrar con squash y conservar `DNA-XX` en el mensaje final.
10. Una persona, no el agente, mueve la tarea de `In Review` a `Done`.

## Proteccion de `main`

La validación `Validate 1000 Ojos` se ejecuta en cada push y pull request. GitHub
no permite reglas obligatorias de proteccion para este repositorio privado con
el plan actual; requiere GitHub Pro o visibilidad publica. Mientras siga
privado, el equipo aplica estas reglas operativas:

- no hacer push directo a `main` despues de la configuracion inicial;
- integrar solamente PRs con validacion verde y una revision cruzada;
- usar squash merge y conservar el identificador `DNA-XX`;
- no hacer force push ni borrar `main`.

El propietario debe activar la proteccion de rama en cuanto el plan lo permita.

## Limites de concurrencia

- Maximo tres tareas humanas activas, una por persona.
- Maximo dos agentes OpenSymphony simultaneos, como fija `WORKFLOW.md`.
- La tercera persona prioriza revision, decisiones o trabajo de campo cuando los
  dos agentes estan ocupados.
- Una tarea bloqueada no se inicia para llenar capacidad.

## Revision cruzada sugerida

| Cambio liderado por | Revisor principal | Enfoque de revision |
|---|---|---|
| F1 Gobierno, datos y campo | F3 | esquema, trazabilidad, privacidad y auditabilidad |
| F2 Movil, offline e IA | F1 | seguridad de campo, limites de IA y uso operativo |
| F3 Plataforma, web e informes | F2 | contratos offline, rendimiento y sincronizacion |

Para cambios de seguridad, privacidad, licencias o decision territorial se
requieren las tres personas.

## Identidades pendientes

Cuando Luis y la tercera persona acepten la invitacion, registrar sus usuarios
GitHub en este documento y en `.github/CODEOWNERS`. No guardar correos personales
en el repositorio.
