# DNA-84: prueba del prototipo móvil

Validación ejecutada el 2026-08-15 con datos sintéticos.

## Resultado

Sierra Clara abre como aplicación web responsive, mantiene los datos en el
dispositivo y produce una PWA exportable. La prueba recorrió una ficha de
infraestructura, cambió su clasificación manual, consultó la biblioteca local,
guardó la revisión y confirmó su persistencia después de recargar.

## Evidencia visual

### Teléfono, 390 x 844

![Lista de infraestructura en teléfono](screenshots/dna-84-mobile.png)

### Escritorio, 1365 x 768

![Mapa de cobertura en escritorio](screenshots/dna-84-desktop-map.png)

## Comprobaciones

- 5 pruebas unitarias aprobadas.
- TypeScript estricto sin errores.
- Exportación web de producción completada.
- Manifiesto PWA visible con iconos de 192 y 512 píxeles.
- Cambio de 3/6 a 4/6 inspecciones revisadas después de guardar.
- Persistencia confirmada tras recargar el navegador.
- Capa de cobertura y capa de daño revisado con denominadores independientes.
- Consulta local devolvió una respuesta y su fuente, sin usar un modelo remoto.
- Cola local creó un único cambio idempotente para la inspección editada.

## Límites observados

La cámara y el selector de archivos requieren una prueba manual en un teléfono
físico. No se instaló un paquete ONNX o generativo y la interfaz lo informa sin
fabricar predicciones. La publicación remota requiere volver a autenticar la
cuenta de alojamiento; el build local está listo en `apps/mobile/dist/`.
