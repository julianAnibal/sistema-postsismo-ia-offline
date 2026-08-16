# Sierra Clara Field

Prototipo DNA-84 de captura post-sismo para teléfono y web instalable. Funciona
sin servidor con datos sintéticos y conserva los cambios en el dispositivo.

## Ejecutar

```bash
npm ci
npm run web
```

Abra `http://localhost:8081` o el puerto mostrado por Expo. Para producir la
PWA:

```bash
npm run export:web
```

El resultado queda en `dist/` e incluye manifiesto, iconos, service worker y la
redirección para una aplicación de página única.

## Qué funciona

- catálogo local de infraestructura con búsqueda y estados;
- inspección manual multieje, población y necesidades agregadas;
- cámara o importación de una imagen con huella SHA-256;
- evidencia inmutable y anotación manual en registros separados;
- consulta local sobre una biblioteca aprobada, con fuentes visibles;
- capas separadas para cobertura, daño revisado, IA pendiente y necesidades;
- cola local idempotente y exportación de manifiesto JSON;
- persistencia después de recargar e instalación PWA donde el navegador lo
  permita.

## Límites deliberados

- No hay un servidor de operación configurado.
- No se distribuye todavía un modelo ONNX ni un paquete generativo.
- La aplicación no emite habitabilidad, diagnóstico estructural ni aprobación
  oficial.
- Las fotos del prototipo se guardan como copias locales comprimidas. La
  implementación nativa debe migrarlas a archivos cifrados y dejar en la base
  solo su manifiesto y ubicación.
- Los mapas usan una cuadrícula sintética y no envían puntos a servicios de
  mapas públicos.

Los contratos para incorporar ONNX Runtime Mobile y LiteRT-LM viven en
`src/ai/contracts.ts`. Cualquier resultado futuro debe conservar identificador
de modelo, hash y confianza, y permanecer como sugerencia separada del registro
humano.

La evidencia de ejecución responsive está en
[`docs/dna-84-proof.md`](../../docs/dna-84-proof.md).
