# Product Brief

## Propósito

Construir un sistema offline de captura, asistencia visual, revisión profesional
y consolidación georreferenciada para evaluación postsismo y necesidades de la
población afectada.

## Arquitectura acordada

| Capa | Decisión inicial |
|---|---|
| Piloto | ODK Collect y ODK Central privado |
| Móvil | React Native con compilación nativa |
| Datos locales | SQLite cifrada, migraciones y outbox |
| IA | ONNX Runtime Mobile; modelos pequeños y auditables |
| Mapa móvil | MapLibre Native con paquetes autorizados |
| Núcleo | API versionada, PostgreSQL/PostGIS y objetos privados |
| Web maestra | Next.js/OpenLayers existente con consola autenticada |
| Formulario | IDIGER/UNGRD canónico; cruce ATC-20 |

## Cadena de evidencia

```text
evento -> asignación -> edificio -> inspección -> observación -> evidencia
       -> sugerencia IA -> conclusión profesional -> aprobación -> acción
```

Cada eslabón conserva fuente, versión, autor, hora, ubicación, incertidumbre y
auditoría. No se fusionan automáticamente las autoridades de una noticia, un
reporte ciudadano, una inferencia remota y una inspección profesional.

## Límites

- Crack-Seg localiza posibles grietas; no diagnostica seguridad global.
- La IA no emite clasificación oficial ni detecta personas atrapadas.
- Edificación, hogar, persona, rescate y publicación son dominios separados.
- Una foto sin escala no mide de forma confiable el ancho de una grieta.
- OpenStreetMap es fuente cartográfica, no servidor gratuito de mapas offline.

## Estrategia

1. Aprobar gobierno, esquema, privacidad y licencias.
2. Ejecutar piloto ODK y producir aprendizaje verificable.
3. Construir móvil, IA y sincronización según datos del piloto.
4. Integrar backend, revisión, casos humanos e informes.
5. Ejecutar simulacro extremo a extremo y decisión go/no-go.
