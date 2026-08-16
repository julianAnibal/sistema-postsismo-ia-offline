# 🏠 MilOjos — ¿Puedo volver a casa?

**Agente de IA por WhatsApp que hace triaje estructural de viviendas después de un desastre y ordena la fila de inspección de los ingenieros — para que la capacidad escasa llegue primero donde más urge.**

> Hac[k]athon CTW·2026 · AI for Public Good · **Track 04: Planeta y Comunidad · Resiliencia** · Bogotá, 15–16 de agosto de 2026

| | |
|---|---|
| 🎬 **Video demo (1 min)** | `[COMPLETAR: link YouTube]` |
| 🌐 **Demo en vivo** | `[COMPLETAR: URL del tablero]` |
| 📱 **Probar el bot** | Envía `join [código-sandbox]` por WhatsApp al `[COMPLETAR: número Twilio]` |
| 👥 **Equipo** | German Burgos (estrategia, datos y gobierno) · Julián Henao (IA offline y plataforma) · Luis Rosal (producto y desarrollo) |

---

## 1. El problema (corte: 15 de agosto de 2026, 6:30 a.m.)

El terremoto Mw 7,4 del 10 de agosto —el de mayor magnitud registrada en Colombia en el siglo XXI— dejó, según la UNGRD:

- **294 muertos, 3.935 heridos, 320 desaparecidos**
- **115.461 personas afectadas** en 448 municipios de 15 departamentos
- **54.008 familias afectadas**
- **14.493 viviendas destruidas y 81.506 averiadas: ~96.000 viviendas golpeadas**

Cada una de esas viviendas necesita una **inspección técnica de habitabilidad** (metodología de semáforo tipo ATC-20, bajo norma NSR-10) antes de que su familia sepa si puede volver — y antes de poder acceder al **subsidio de arriendo**, que el Gobierno condiciona a esa verificación técnica.

La capacidad no alcanza: Manizales pidió públicamente **500 ingenieros voluntarios** para 2.000 edificios el día 2. La cola nacional es 50 veces mayor y el registro es **en papel**. La cola de viviendas reportadas creció **10 veces entre el 12 y el 15 de agosto** — no porque el daño creciera, sino porque contarlo a mano es el cuello de botella. Consecuencia humana: **familias durmiendo en la calle frente a casas que quizás están bien**, con réplicas encima y lluvias en camino.

La ONU (OCHA) lo resumió el 12 de agosto: *"todavía existen vacíos importantes de información. No se conocen con precisión el número de personas damnificadas […] ni las necesidades concretas de cada municipio."*

**El problema no es la falta de mapas de daño. Es que nadie ordena la fila.**

## 2. La solución

MilOjos hace tres cosas, en un solo ciclo:

1. **RECIBE.** La familia escribe por WhatsApp: envía fotos de su vivienda y responde ~12 preguntas guiadas destiladas del formulario oficial de inspección post-sismo (ATC-20). Sin apps, sin registro, sin enlaces — el canal que ya tiene en el bolsillo, resistente a señal pobre.
2. **PRIORIZA.** La IA analiza fotos + respuestas y calcula un **Índice de Prioridad de Inspección** que combina severidad del daño reportado, zona de riesgo sísmico (microzonificación), grado de daño satelital oficial (Copernicus EMSR916) y pronóstico de lluvia (IDEAM). La familia recibe su código de reporte, recomendaciones oficiales de seguridad y el paso a paso del RUD (gratuito — con mensaje anti-estafa).
3. **DESPACHA.** Los casos caen a un tablero-mapa como **cola de trabajo ordenada**: el ingeniero voluntario abre "mi ruta de hoy" en su celular, va primero donde más urge, y **confirma o corrige el triaje de la IA en tres toques**. La autoridad ve el avance en tiempo real y exporta CSV/KML interoperable.

**Una frase:** los demás mapas muestran el daño; MilOjos reparte el trabajo.

**El nombre es la arquitectura:** los **ojos del cielo** (satélite Copernicus/Vantor) dicen *dónde*; los **ojos de la calle** (miles de familias reportando por WhatsApp) dicen *cuál casa*; los **ojos expertos** (los ingenieros) deciden. Mil ojos mirando para que cada familia sepa si puede volver.

### Las tres caras (un producto, tres UX)

| Usuario | Interfaz | Momento clave |
|---|---|---|
| 👨‍👩‍👧 Familia damnificada | Conversación de WhatsApp | *"Tu reporte MO-1042 quedó registrado. Prioridad: ALTA. Mientras llega un ingeniero: no vuelvas a entrar…"* |
| 👷 Ingeniero/voluntario técnico | Lista "mi ruta de hoy" (web móvil) | Confirmar o corregir el semáforo de la IA en 3 toques — **el humano decide** |
| 🏛️ Autoridad (PMU/alcaldía/UNGRD) | Tablero en pantalla grande | 4 números + mapa por capas + cola asignable + exportar al RUD |

## 3. Dónde está la IA (núcleo, no decoración)

1. **Visión estructural asistida:** el modelo (Claude, vía API) analiza las fotos buscando patrones de daño documentados en la literatura post-sísmica —grietas diagonales en muros portantes, columnas con acero expuesto, pisos blandos, asentamientos— y los cruza con las respuestas del cuestionario.
2. **Conversación experta:** el flujo de preguntas es adaptativo (una a la vez, lenguaje de vecino, acepta notas de voz) y está destilado del formulario ATC-20 que hoy se diligencia en papel.
3. **Índice de Prioridad compuesto:**

```
Prioridad = Severidad_IA(fotos + cuestionario)      [0–100, sesgo conservador]
          × Factor_zona(microzonificación + EMSR916) [1,0 – 1,5]
          × Factor_clima(lluvia 72h IDEAM)           [1,0 – 1,3]
          × Factor_vulnerabilidad(hogar)             [1,0 – 1,4]
```

El factor de vulnerabilidad se activa con dos preguntas del flujo (menores de 5 años, adultos mayores, embarazo, discapacidad; tamaño del hogar) y ordena también la **fila de la ayuda humanitaria** (ver §7).

4. **Aprendizaje con humano en el lazo:** cada confirmación/corrección del ingeniero queda registrada como veredicto final y como señal para calibrar el triaje.

**Regla de diseño no negociable:** la IA **nunca** dice "tu casa es segura". Asigna *prioridad de inspección*. El veredicto de habitabilidad es del profesional (principio de precaución, Art. 3.8 de la Ley 1523; prevalencia de la vida humana, Art. 3.17).

## 4. Arquitectura

```
Familia 📱 WhatsApp
   │ fotos + respuestas (Twilio Sandbox)
   ▼
n8n (orquestador) ──► Claude API (visión + conversación + severidad)
   │                        │
   │                  JSON estructurado
   ▼                        ▼
Supabase (Postgres) ◄── Índice de Prioridad (zona × clima × vulnerabilidad)
   │ realtime
   ▼
Tablero web (v0/Next) ── mapa MapLibre: casos + capa EMSR916 + Vantor antes/después + lluvia
   │
   ├── Vista ingeniero: "mi ruta de hoy" + confirmación en 3 toques
   └── Exportar CSV/KML → RUD / sistemas oficiales (interoperabilidad, Art. 46)
```

**Stack:** Twilio WhatsApp Sandbox · n8n (flujo exportado en [`/n8n/milojos_flow.json`](./n8n/) `[COMPLETAR]`) · Claude API (prompts versionados en [`/prompts`](./prompts/) `[COMPLETAR]`) · Supabase (esquema en [`/db/schema.sql`](./db/) `[COMPLETAR]`) · v0/Next + MapLibre para el tablero · CapCut/HeyGen para el video.

### Datos integrados

| Fuente | Uso en MilOjos |
|---|---|
| **Copernicus EMS — activación EMSR916** (gradings oficiales de daño: Pereira, Cali, Quibdó, Buenaventura) | Capa macro del mapa + factor de zona del índice |
| **Imágenes ópticas Vantor/OpenAerialMap** (13 productos post-evento, GSD 0,33–0,64 m, CC BY-NC 4.0, endpoints TMS/WMTS) | Antes/después por manzana + chip visual en el expediente de cada caso |
| **Microzonificación sísmica** (Bogotá–IDIGER/Datos Abiertos, Manizales–UNal, Pereira–CEDIR/UNGRD) | Factor de zona |
| **IDEAM** (pronóstico de precipitación) | Factor clima: lluvia sobre estructura agrietada y ladera = prioridad sube |
| **Metodología ATC-20 / NSR-10** | Cuestionario y semáforo de habitabilidad |
| Sentinel-1 SAR (9 productos COG) | Roadmap: detección de cambios en eventos nublados |

## 5. Cómo correrlo

```bash
# 1. Clonar y configurar
git clone [COMPLETAR: url del repo] && cd milojos
cp .env.example .env   # TWILIO_SID, TWILIO_TOKEN, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY

# 2. Base de datos
#    Ejecutar db/schema.sql en Supabase (tablas: reportes, inspecciones, ingenieros)

# 3. Orquestador
#    Importar n8n/milojos_flow.json en n8n Cloud y activar el webhook
#    Apuntar el sandbox de WhatsApp de Twilio al webhook de n8n

# 4. Tablero
cd dashboard && npm install && npm run dev   # o el deploy en Vercel: [COMPLETAR]

# 5. Probar: enviar "hola" por WhatsApp al número del sandbox → seguir el flujo → ver el caso caer al mapa
```

*(MVP construido en 24 horas: los detalles finos de despliegue están en [`/docs/setup.md`](./docs/) `[COMPLETAR]`.)*

## 6. Guardrails éticos y de datos

- **La IA propone, el humano decide.** Nunca emitimos veredictos de habitabilidad; asignamos prioridad de inspección con **sesgo conservador** (ante la duda, sube la prioridad).
- **Datos mínimos y con consentimiento** explícito en el primer mensaje (Ley 1581 de 2012 y parágrafo del Art. 45 de la Ley 1523: habeas data dentro del propio sistema de información).
- **El mapa público muestra agregados** — nunca nombres, teléfonos ni direcciones exactas. El detalle solo lo ven ingenieros y autoridad autenticados.
- **Anti-estafa por diseño:** cada conversación recuerda que el registro RUD es gratuito y sin intermediarios.
- **Anti-desinformación:** el bot responde solo con fuentes oficiales (SGC, UNGRD, IDEAM) y aclara que las réplicas no se pueden predecir.
- Licencias respetadas: imágenes Vantor bajo CC BY-NC 4.0 (uso demostrativo/no comercial); en fase comercial se sustituyen por fuentes licenciadas o EMS.

## 7. Por qué esto es "bien público": el mandato legal (Ley 1523 de 2012)

- **Arts. 45–46:** la ley ordena desde 2012 un sistema de información de gestión del riesgo que responda por *"las estadísticas de afectación […] en las situaciones de emergencia"* (45.6) y **sistemas territoriales interoperables** (46). Catorce años después, la ONU reporta vacíos de información. MilOjos es ese instrumento, operativo en 24 horas y con exportación interoperable.
- **Art. 4 núms. 17 y 24:** la **evaluación de daños y análisis de necesidades (EDAN)** es servicio básico de la respuesta. MilOjos digitaliza su puerta de entrada y ordena su cola.
- **Art. 61:** el plan de acción específico para la recuperación es obligatorio y exige seguimiento — el tablero de MilOjos es su herramienta de seguimiento.
- **Art. 62:** la ley contempla que **privados y comunidad organizada participen en la ejecución del plan** — la vía de adopción de esta herramienta.
- **Art. 77:** los alcaldes solo pueden ordenar demoliciones *"previo informe técnico"* — nuestra cola es el camino más corto hacia ese informe.
- **Art. 48:** los criterios de distribución de recursos del Fondo Nacional deben incluir *"indicadores de vulnerabilidad"* — el factor de vulnerabilidad del índice los produce.
- **Arts. 2 y 3 (núms. 5, 8, 15, 17):** corresponsabilidad ciudadana, principio participativo, precaución, oportuna información y prevalencia de la vida humana: el marco de diseño de cada decisión del producto.
- **Ventana legal (Art. 64):** la declaratoria de desastre dura hasta 12 meses prorrogables por 12 más — esta no es una app de una semana; es infraestructura de la recuperación.

*(Análisis legal completo en [`/docs/marco_legal.md`](./docs/) — 14 puntos con citas textuales.)*

## 8. Sostenibilidad y escala

**Hoy (emergencia):** gratuito para familias e ingenieros voluntarios. El dato ya tiene compradores institucionales definidos por ley: UNGRD (Art. 18) y los consejos municipales/departamentales de gestión del riesgo (Arts. 27–29, obligatorios en todo el país).

**La plata ya existe; falta el dato para focalizarla:**
- El **subsidio de arriendo** anunciado está condicionado a inspección técnica de habitabilidad → cada inspección que MilOjos acelera es un subsidio que llega antes. El mismo expediente ordena dos filas: la del ingeniero y la de la ayuda.
- El **Banco Mundial ya donó US$200.000 no reembolsables específicamente para evaluación de daños**, dentro de ofertas internacionales por US$1.300 millones y ~US$517M en créditos de emergencia (BID, BM) — la cooperación está pagando por resolver exactamente esta cola.
- **Obras por Impuestos** se activó como vehículo de financiación de la reconstrucción.

**Mañana (recurrente):** SaaS de gestión del riesgo para entes territoriales (contratación ágil del régimen especial, Arts. 65–66); triaje masivo de reclamaciones para **aseguradoras**; **Sismo-Score** preventivo por dirección (microzonificación + año de construcción vs. NSR) para el mercado inmobiliario e hipotecario.

## 9. Roadmap: el reloj del desastre

| Modo | Ventana | Estado |
|---|---|---|
| 🔴 **VOLVER** — triaje de habitabilidad + cola de inspección + focalización de ayuda | Día 3 → mes 24 (Art. 64) | ✅ **Este MVP** |
| 🟠 **BUSCAR** — priorización de zonas para rescate con satélite + reportes (0–72 h) | Próximo evento | Diseñado; capa satelital ya integrada |
| 🟢 **RECONSTRUIR** — seguimiento del plan Art. 61, veeduría de recursos (Art. 3.15: donaciones recibidas/administradas/entregadas) | Mes 1+ | Roadmap |
| Técnico | — | SAR Sentinel-1 para eventos nublados · integración directa RUD · multi-amenaza (deslizamientos e inundaciones con IDEAM — La Niña) |

## 10. Limitaciones honestas de un MVP de 24 horas

Sandbox de WhatsApp (no número de producción) · muestra de datos de prueba, no reportes reales de damnificados · el índice usa umbrales heurísticos pendientes de calibración con ingenieros estructurales · la capa EMSR916/Vantor cubre las AOI publicadas, no los 448 municipios · nada de esto sustituye los protocolos oficiales del SNGRD: los alimenta.

## 11. Fuentes principales

UNGRD (cifras al 15-ago-2026 vía [Infobae, minuto a minuto](https://www.infobae.com/colombia/2026/08/14/temblor-de-74-en-colombia-el-10-de-agosto-se-actualizo-el-numero-de-fallecidos-en-todo-el-pais/)) · [OCHA/Noticias ONU (12-ago)](https://news.un.org/es/story/2026/08/1541802) · [Copernicus EMS — EMSR916](https://mapping.emergency.copernicus.eu/news/earthquake-in-colombia-emsr916/) · [OpenAerialMap / Vantor Open Data](https://openaerialmap.org/) · [Pulzo — Manizales pide 500 ingenieros](https://www.pulzo.com/nacion/buscan-ingenieros-arquitectos-voluntarios-para-ver-edificios-afectados-PP5271286) · [La FM — semáforo ATC-20/NSR-10](https://www.lafm.com.co/actualidad/terremoto-colombia-viviendas-identificar-antisismico-sistema-semaforos-riesgos-407626) · [El País — subsidio de arriendo condicionado a inspección](https://www.elpais.com.co/colombia/gobierno-prepara-subsidio-de-arriendo-para-damnificados-por-el-terremoto-asi-se-determinaran-los-beneficiarios-1202.html) · [El País — Banco Mundial US$200M](https://www.elpais.com.co/economia/colombia-recibira-200-millones-de-dolares-del-banco-mundial-tras-terremoto-asi-se-distribuiria-la-ayuda-1450.html) · Ley 1523 de 2012 (texto oficial, Función Pública) · [IDIGER](https://www.idiger.gov.co/escenarios-de-riesgo/sismico/en-bogota) · [Datos Abiertos Bogotá](https://datosabiertos.bogota.gov.co/dataset/respuesta-sismica) · [IDEAM](https://www.ideam.gov.co/)

---

*"En 1999, la ciudad de Armenia perdió 971 vidas. Este agosto, reconstruida bajo normas sismorresistentes, no perdió ninguna — mientras el país perdía 294 donde la vulnerabilidad persiste. Las normas salvaron a Armenia; los datos salvarán al resto. Somos MilOjos — que toda Colombia pueda volver a casa."*

**Licencia:** `[COMPLETAR: MIT / Apache-2.0]` · Hecho con ☕ en 24 horas en el Claustro de la Universidad del Rosario, Hac[k]athon CTW·2026.
