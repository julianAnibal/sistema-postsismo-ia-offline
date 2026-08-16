# 1000 Ojos

Prototipo DNA-84 de captura post-sismo para teléfono y web instalable. Funciona
sin servidor con datos sintéticos y conserva los cambios en el dispositivo.

## Ejecutar

```bash
npm ci
npm run web
```

## Sincronización de campo

En la vista **Envíos**, configure la URL HTTPS de la web operativa y el token entregado al dispositivo. En iOS y Android la credencial queda en Keychain/Keystore; en la versión web solo vive durante la sesión del navegador.

La aplicación reintenta al recuperar conectividad. Primero sube cada fotografía con su SHA-256 y después envía el lote estructurado. La cola local solo se elimina cuando el servidor confirma el lote completo. No incluya `SUPABASE_SERVICE_ROLE_KEY` ni otra llave de infraestructura en esta aplicación.

`eas.json` define instaladores internos (`preview`, APK) y de tiendas (`production`). La generación requiere iniciar sesión en una cuenta Expo/EAS autorizada.

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
- metadatos inmutables de GPS, precisión, altitud, rumbo, velocidad,
  movimiento, dispositivo y EXIF disponible, con estado explícito cuando un
  sensor no está autorizado o disponible;
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
