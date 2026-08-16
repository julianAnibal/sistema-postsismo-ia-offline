# Product Brief

## Propósito

Construir un sistema offline de captura, asistencia visual, revisión profesional
y consolidación georreferenciada para evaluación postsismo y necesidades de la
población afectada.

## Arquitectura propuesta

La selección móvil detallada está en la ADR propuesta
[DNA-81](decisions/DNA-81-mobile-runtime-local-ai.md). No se considera aceptada
hasta completar las dependencias, la revisión cruzada y el benchmark en los
teléfonos del piloto.

| Capa | Decisión inicial |
|---|---|
| Piloto | ODK Collect y ODK Central privado |
| Móvil | React Native + Expo con compilación nativa; sin daemon permanente |
| Datos locales | SQLite/SQLCipher, WAL, migraciones, archivos privados y outbox |
| IA | ONNX Runtime React Native con niveles A/B/C y modo manual siempre disponible |
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
- No se promete compatibilidad universal; se publica una matriz medida por nivel.
- La PWA es contingencia, no la única copia de una inspección crítica.
- Edificación, hogar, persona, rescate y publicación son dominios separados.
- Una foto sin escala no mide de forma confiable el ancho de una grieta.
- OpenStreetMap es fuente cartográfica, no servidor gratuito de mapas offline.

## Estrategia

1. Aprobar gobierno, esquema, privacidad y licencias.
2. Ejecutar piloto ODK y producir aprendizaje verificable.
3. Construir móvil, IA y sincronización según datos del piloto.
4. Integrar backend, revisión, casos humanos e informes.
5. Ejecutar simulacro extremo a extremo y decisión go/no-go.
