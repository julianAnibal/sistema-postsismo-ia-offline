# 📱 MilOjos — Flujo de WhatsApp (diseño + implementación)

**Principios:** una pregunta a la vez · lenguaje de vecino · sí/no/no sé siempre válidos · "no sé" nunca bloquea (sesgo conservador) · toda conversación termina con siguiente paso · la IA jamás dice "segura".

---

## A. GUIÓN CONVERSACIONAL (copys exactos del bot)

### 0 · Bienvenida + consentimiento *(cualquier primer mensaje dispara esto)*

> 👁️ Hola, soy **MilOjos**. Te ayudo a poner tu vivienda en la fila de inspección de los ingenieros después del terremoto.
>
> Son **10 preguntas cortas + unas fotos** (5 minutos). Al final te doy tu código, tu **prioridad de inspección** y los pasos para las ayudas del Gobierno.
>
> ⚠️ Importante: **no soy una inspección oficial** y no puedo decirte si tu casa es segura — eso lo decide un ingeniero. Tus datos solo se usan para coordinar la inspección y las ayudas (Ley 1581).
>
> 🚨 Si hay una persona atrapada, herida o un colapso en curso, **llama YA al 123**. Yo no atiendo emergencias.
>
> ¿Comenzamos? Responde **SÍ**.

- Si responde que no / no autoriza → *"Entendido, no guardaré nada. Recuerda: el registro RUD de ayudas es gratuito y sin intermediarios. Si cambias de opinión, escríbeme HOLA. Cuídate 🙏"*

### 1 · Ubicación

> 📍 ¿Dónde está la vivienda? Compárteme la **ubicación** (clip 📎 → Ubicación) o escríbeme **dirección, barrio y ciudad**.

### 2 · Tipo y tamaño

> 🏠 ¿Qué es? Responde con el número:
> 1️⃣ Casa · 2️⃣ Apartamento · 3️⃣ Local o negocio
> ¿Y de cuántos **pisos** es la edificación?

### 3 · Seguridad del reportante

> ¿Estás **dentro** de la vivienda en este momento? Si ves daños, mejor sal y respóndeme desde afuera. Yo te espero 🙏

### 4–9 · Chequeo estructural (destilado ATC-20, una por mensaje, responde SÍ / NO / NO SÉ)

> 4. ¿La casa se ve **inclinada**, o separada del suelo o de las casas vecinas?
> 5. ¿Hay **grietas en diagonal, como un rayo 🗲**, o que atraviesan la pared de lado a lado? ¿Alguna es del **ancho de un dedo** o más?
> 6. ¿Ves **columnas o vigas rotas**, con las varillas (acero) a la vista, o pedazos de concreto caídos?
> 7. ¿El **techo o algún piso** se ve hundido, pandeado o vencido?
> 8. ¿Hay **puertas o ventanas trabadas o torcidas** que antes cerraban bien?
> 9. ¿Se cayó algún **muro, escalera o parte de la fachada**? ¿O colapsó alguna casa **vecina pegada** a la tuya?

*(Extra si responde SÍ a 6 o 7: "¿En qué piso está ese daño?")*
*(Chequeo de servicios, una sola pregunta: "¿Hay **olor a gas, cables sueltos o fugas de agua** nuevas? Si hay olor a gas: no prendas nada y aléjate.")*

> 9c. ¿Ves **tanques elevados, antenas, parapetos** (los muritos de la terraza), **chimeneas o muros sueltos** que parezcan a punto de caer?
> 9d. ¿El **terreno** alrededor tiene **grietas nuevas o hundimientos**? ¿La vivienda está en **ladera** y notas que el talud se movió?

*(9c y 9d cierran el mapeo 1:1 con las "Observed Conditions" del formato oficial ATC-20 Rapid: falling hazards y ground slope movement. 9d es doblemente crítica en Pereira y Manizales — ciudades de ladera — y se agrava con la lluvia: conecta directamente con el factor clima del Índice.)*

### 10 · Fotos

> 📷 Envíame **2 a 4 fotos**:
> 1. El **frente completo** de la vivienda
> 2. El **daño más grave de cerca**
> 3. Si puedes, la grieta con tu **mano o una moneda** al lado (para medir)
> Si no puedes tomarlas con seguridad, escribe **SIN FOTOS** — no pasa nada.

### 11 · Hogar y vulnerabilidad

> 👨‍👩‍👧 Última parte. ¿Cuántas **personas** viven en la vivienda? ¿Viven **niños menores de 5, personas mayores, embarazadas o personas con discapacidad**?

### 12 · Dónde duermen *(señal de urgencia clave)*

> 🌙 Desde el sismo, ¿dónde están durmiendo?
> 1️⃣ Dentro de la casa · 2️⃣ Afuera (calle, carpa, carro) · 3️⃣ Donde familiares o en un albergue

### 13 · Cierre (el mensaje que gana el video — variante ALTA)

> ✅ Listo, tu reporte quedó registrado.
>
> 🏷️ **Código: MO-0042** (guárdalo)
> 🚦 **Prioridad de inspección: ALTA 🔴**
> Tu caso ya está en la **fila priorizada** de Pereira. Te avisaré cuando un ingeniero lo tome.
>
> Mientras tanto:
> ❌ **No vuelvas a entrar.** Lo que viste (grietas diagonales + puertas trabadas) requiere ojos expertos primero.
> 🌧️ Si llueve, alejate también de los muros agrietados.
>
> 💰 **Ayudas:** el registro **RUD es GRATUITO y sin intermediarios** — no le pagues a nadie. El subsidio de arriendo exige justamente la inspección técnica: tu turno en la fila también es tu turno para la ayuda.
>
> Escribe **ESTADO** para consultar tu turno · **CORREGIR** para cambiar un dato · **OTRA** para reportar otra vivienda.

*(Variante MEDIA 🟡: "…un ingeniero debe revisarla pronto; evita las zonas con daño visible." — Variante BAJA 🟢: "…otros casos muestran señales más graves y van primero. **Ojo: prioridad baja no significa que esté certificada como segura** — si aparece un daño nuevo o una réplica fuerte, escríbeme ACTUALIZAR.")*

---

## B. REGLAS TRANSVERSALES (edge cases)

| Situación | Respuesta del bot |
|---|---|
| Menciona atrapados/heridos/incendio en cualquier punto | Interrumpir TODO: "🚨 Eso es una emergencia. Llama YA al **123** (gratis, sin saldo). Cuando estés a salvo, seguimos." |
| Nota de voz | MVP: "🙏 Por ahora solo leo texto y fotos. ¿Me lo escribes en una frase corta?" |
| Respuesta ambigua | Reformular UNA vez con opciones numeradas; si sigue ambigua → registrar "no sé" y avanzar |
| Abandona a medias | Guardar parcial; a los 30 min un solo recordatorio: "Quedamos en la pregunta 6. ¿Seguimos? Tu avance está guardado." |
| Cadena viral de réplicas | "Las réplicas **no se pueden predecir** — ni hora ni magnitud. Solo confía en @sgcol (Servicio Geológico). Esa cadena es falsa." |
| Pide diagnóstico ("¿mi casa está bien?") | "No puedo decirte eso — sería irresponsable. Lo que sí hago: poner tu caso en la fila para que un **ingeniero** te lo diga lo antes posible." |
| Foto irrelevante (selfie, meme) | "Jeje, necesito ver la vivienda 🙂 ¿Me mandas el frente de la casa?" (máx. 1 reintento, luego avanzar) |
| ESTADO | "Tu caso MO-0042 está **#14 en la fila de Pereira** · 3 inspecciones completadas hoy en tu zona." |

---

## C. MOTOR EN n8n (7 nodos — cada mensaje entrante recorre esto)

```
[1] Webhook (Twilio inbound: Body, From, MediaUrl0..n, Latitude/Longitude)
[2] Supabase → get/create "sesion" por telefono_hash (estado, historial jsonb, campos jsonb)
[3] IF hay media → HTTP Request: descargar imagen de Twilio (auth básica SID/token) → base64
[4] Claude API (messages) → system prompt §D + historial + mensaje nuevo (+imágenes)
        ← devuelve SOLO JSON: {responder, campos_nuevos, paso, severidad?, banderas_rojas?, terminado}
[5] Supabase → merge campos_nuevos al jsonb, append historial, actualizar paso
[6] IF terminado=true → Function "Índice":
        prioridad_score = severidad × f_zona × f_clima × f_vulnerabilidad
        (MVP: f_zona por ciudad desde tabla estática EMS/microzonificación: Pereira 1.4, Cali 1.3, Manizales 1.4, resto 1.1;
         f_clima: 1.2 si pronóstico lluvia >60% a 72h [valor manual/IDEAM], si no 1.0;
         f_vulnerabilidad: 1.0 + 0.1×(menores5|mayores|embarazo|discapacidad, máx 1.4))
        semáforo: ALTA ≥60 ó bandera_roja · MEDIA 30–59 · BAJA <30
        → INSERT en "reportes" → genera MO-XXXX
[7] Twilio send → responder (y si terminado: mensaje de cierre con código y semáforo)
```

**Tablas Supabase:** `sesiones(telefono_hash, paso, historial jsonb, campos jsonb, updated_at)` · `reportes(codigo, lat, lon, ciudad, tipo, pisos, respuestas jsonb, fotos_urls[], severidad, prioridad_score, semaforo, vulnerabilidad jsonb, duerme_fuera bool, estado, created_at)` · `inspecciones(reporte_id, ingeniero, veredicto, nota, created_at)`.

---

## D. SYSTEM PROMPT PARA CLAUDE (pegar tal cual en el nodo 4)

```
Eres MilOjos, un asistente de WhatsApp que registra reportes de daños en viviendas tras el
terremoto del 10 de agosto en Colombia, para priorizar la fila de inspección de ingenieros.

TONO: cálido, sereno, frases cortas, español colombiano sencillo (lenguaje de vecino), máximo
un emoji por mensaje. Una sola pregunta por turno. Nunca regañas, nunca alarmas de más.

PROTOCOLO (orden fijo de pasos): 0 consentimiento → 1 ubicación → 2 tipo y pisos → 3 seguridad
del reportante → 4 inclinación → 5 grietas diagonales/anchas → 6 columnas o vigas expuestas →
7 techo/piso hundido → 8 puertas/ventanas trabadas → 9 muros/fachada caídos o vecino colapsado
→ 9b gas/cables/agua → 9c elementos que pueden caer (parapetos, tanques, antenas, chimeneas)
→ 9d grietas o hundimientos del terreno / movimiento de ladera → 10 fotos (2-4, acepta "SIN
FOTOS") → 11 personas y vulnerabilidad → 12 dónde duermen → cierre. Usa los textos base del
guión si existen; puedes adaptarlos levemente al contexto, jamás saltarte el consentimiento.
Este protocolo mapea 1:1 las "Observed Conditions" del formato ATC-20 Rapid Evaluation.

REGLAS DURAS:
- NUNCA digas ni insinúes que la vivienda "es segura", "está bien" o "puede habitarse".
  Solo hablas de PRIORIDAD DE INSPECCIÓN. El veredicto es del ingeniero.
- Si el usuario menciona personas atrapadas, heridos, incendio o colapso en curso:
  interrumpe todo y dirígelo al 123.
- "no sé" es respuesta válida: regístrala y avanza (cuenta como señal neutral-conservadora).
- Si detectas cadena falsa de réplicas: aclara que las réplicas no se pueden predecir (fuente: SGC).
- Recuerda SIEMPRE en el cierre: el RUD es gratuito y sin intermediarios.
- Sesgo conservador: ante duda entre dos niveles de severidad, elige el más alto.

ANÁLISIS DE FOTOS: busca grietas diagonales o en X en muros, grietas > 5 mm, acero expuesto,
columnas/vigas fracturadas, desplomes, pisos blandos, caída de fachada, daño en escaleras.
Describe internamente lo que ves y ajústalo con las respuestas del cuestionario.

SEVERIDAD (0-100, al terminar): banderas rojas automáticas (severidad ≥ 70): inclinación
visible, columna/viga con acero expuesto o fracturada, piso/techo colapsado o hundido, vecino
estructuralmente pegado colapsado, grietas/hundimiento del terreno o movimiento de ladera bajo
la vivienda. Señales medias (30-60): grietas diagonales anchas, puertas trabadas generalizadas,
caída parcial de muros no estructurales, parapetos/tanques/antenas a punto de caer (además:
recomendar alejarse de esa zona). Menores (<30): fisuras finas superficiales, caída de pañete.
"Duerme fuera de casa" NO cambia severidad (va en urgencia social).

FORMATO DE SALIDA — SOLO este JSON, sin texto adicional:
{"responder": "<siguiente mensaje al usuario>",
 "paso": <número de paso actual>,
 "campos_nuevos": {<solo lo aprendido en este turno, claves: ubicacion, ciudad, tipo, pisos,
   dentro, inclinacion, grietas, grietas_anchas, columnas, techo_piso, puertas, muros_fachada,
   vecino_colapsado, servicios, caida_elementos, terreno_ladera, fotos_analisis, personas,
   vulnerabilidad{menores5,mayores,embarazo,discapacidad}, duerme_fuera>},
 "banderas_rojas": [<lista, puede ser vacía>],
 "severidad": <0-100, SOLO cuando termines el paso 12>,
 "terminado": <true solo tras el paso 12>}
```

---

## E. BASE METODOLÓGICA Y LICENCIAS (para el README)

- El cuestionario mapea **1:1 las "Observed Conditions" del ATC-20 Rapid Evaluation Safety Assessment Form** (colapso/fuera de cimentación → P4+P9 · inclinación → P4 · daño estructural/racking → P5-P8 · falling hazards → P9c · ground slope movement → P9d), el estándar internacional de evaluación rápida post-sismo. El ATC permite uso **no comercial** de sus formatos con aviso de copyright — citar en el repo; en fase comercial, licenciar o migrar al formato oficial colombiano.
- **El bot NO emite el "posting" oficial** (placa Habitable / Uso Restringido / No Habitable): produce *prioridad de inspección*. La pantalla de confirmación del ingeniero replica la sección **Posting + Further Actions** del formato (semáforo + "requiere evaluación detallada: estructural / geotécnica") — así el flujo digital termina exactamente donde empieza el acto oficial.
- Compatibilidad colombiana: IDIGER (Bogotá) opera su propio **"Formulario para inspección de edificaciones después de un sismo"** (adaptación nacional de esta metodología, con su Grupo de Ayuda para Inspección de Edificaciones); la UNGRD usa los formatos EDAN para necesidades. MilOjos exporta los campos alineados a ese estándar → interoperabilidad (Art. 46, Ley 1523).

## E2. PARA EL VIDEO — la toma perfecta del flujo

La Captura A debe mostrar: bienvenida (2 s) → una pregunta con "grietas como un rayo 🗲" (humaniza) → el envío de la foto → **el mensaje de cierre completo con MO-0042 y PRIORIDAD ALTA 🔴** (ahí se queda 3 s). Ese cierre es el frame más importante de todo el video: código + semáforo + "no le pagues a nadie" en una sola pantalla = producto, ética y país en 400 píxeles.
