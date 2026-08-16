# 🧠 MilOjos — Cómo "entrenamos" la IA que identifica el riesgo de la edificación
**Documento de trabajo para el equipo** · v1 · 16-ago-2026

## La idea en una frase
Hoy **no entrenamos pesos de un modelo** (eso toma semanas y datos que no existen): **codificamos el criterio del ingeniero** dentro de un modelo de visión preentrenado, **lo calibramos** contra un set dorado etiquetado por nosotros, y **diseñamos el ciclo** para que cada corrección de un ingeniero real se vuelva dato de entrenamiento del modelo propio de mañana. Tres fases: dictar → probar → aprender.

---

## FASE 1 — HOY · Dictar el criterio (prompt = conocimiento experto codificado)

**El cerebro:** un modelo de visión preentrenado — Claude vía API (online) o **Gemma 3 local con Ollama** (Modo Sin Señal). El mismo prompt sirve para ambos.

**Pieza 1 · La rúbrica (qué mirar).** Escala de severidad 0-100 con anclas verificables, destilada de ATC-20 y EMS-98:

| Severidad | Señales (cualquiera aplica) | Semáforo |
|---|---|---|
| 80–100 | Colapso parcial · acero expuesto o columna/viga fracturada · daño en nudo columna-placa · edificación inclinada o fuera de su base · grietas/hundimiento del terreno o ladera bajo la vivienda | **ALTA 🔴** |
| 60–79 | Grietas diagonales o en X **anchas (>5 mm) o pasantes** en muros portantes · desprendimiento de piezas en altura (dinteles, parapetos, tanques) · piso/techo pandeado | **ALTA 🔴** |
| 30–59 | Grietas diagonales finas en muros estructurales · puertas/ventanas trabadas generalizadas · caída parcial de muros no estructurales o fachada menor | **MEDIA 🟡** |
| 10–29 | Fisuras superficiales del pañete/acabados · caída de repello o cielorrasos menores | **BAJA 🟢** |
| 0–9 | Sin señales visibles de daño | **BAJA 🟢** |

**Banderas rojas** (fuerzan ALTA sin importar el puntaje): inclinación visible · acero expuesto · daño en nudo · piso colapsado · vecino estructural pegado colapsado · terreno/ladera en movimiento.
**Regla de desempate:** ante duda entre dos niveles, SIEMPRE el más alto (sesgo conservador).
**Límite absoluto:** el modelo asigna *prioridad de inspección*, jamás dice "la vivienda es segura" — eso es del ingeniero.

**Pieza 2 · Few-shot (ejemplos resueltos dentro del prompt).** Los modelos clasifican mucho mejor si ven casos calificados. Pegar este bloque en el system prompt (Claude y Gemma):

```
EJEMPLOS CALIBRADOS:
1) Muro de bloques con grietas diagonales anchas en patrón X, bloques desplazados y triturados
   → severidad 82, ALTA. Razón: falla por cortante en mampostería, grietas pasantes.
2) Edificio de ladrillo 5 pisos: ladrillos desprendidos sobre el dintel de una ventana en piso
   alto, grieta horizontal en muro estructural → severidad 65, ALTA. Razón: peligro de caída
   de piezas en altura + grieta en elemento estructural (caso limítrofe: sube por conservadurismo).
3) Columna de sótano con fisura vertical continua en la arista, sin acero expuesto ni
   aplastamiento → severidad 45, MEDIA. Razón: daño aparentemente superficial, pero en elemento
   crítico: inspección prioritaria dentro de MEDIA.
4) Columna con recubrimiento desprendido en la CABEZA (nudo columna-placa), material triturado
   y fisura diagonal descendente → severidad 90, ALTA (bandera roja). Razón: daño en nudo,
   punto clásico de falla estructural.
5) Pared interior con fisuras finas del pañete, puertas cierran bien, sin patrón diagonal
   → severidad 15, BAJA. Razón: daño de acabados, sin señales estructurales.
```

**Pieza 3 · Contrato de salida.** Responder SOLO JSON: `{"severidad": 0-100, "semaforo": "ALTA|MEDIA|BAJA", "banderas_rojas": [...], "razon": "2 líneas en lenguaje simple", "confianza": "alta|media|baja"}`. Si `confianza=baja` (foto borrosa, oscura), el sistema sube un nivel el semáforo y lo anota.

---

## FASE 2 — HOY · Probar el criterio (calibración con set dorado)

1. **Set:** 18 fotos en `/eval` → ~9 de prensa (Semana/Infobae, casos graves y medios) + ~5 del PDF EMS-98 (¡ya vienen etiquetadas por grado! mapeo: G1-2→BAJA, G3→MEDIA, G4-5→ALTA) + ~4 propias sanas (controles). Marcar las sintéticas/ilustrativas como "sintética".
2. **Etiquetado ciego:** el equipo (ideal con el ing. civil) etiqueta ANTES de correr la IA. Nadie mira la respuesta del modelo antes de etiquetar.
3. **Correr y comparar.** Llenar la tabla del README (caso · señales · etiqueta experta · veredicto IA · ¿acuerdo?).
4. **Métricas que importan:** % de acuerdo (esperado 80-90%) y — la estrella — **falsos tranquilizadores = 0** (casos donde la IA quedó POR DEBAJO del criterio experto). Desacuerdos hacia arriba son aceptables por diseño.
5. **Si aparece 1 falso tranquilizador:** se agrega la regla/ejemplo que lo cubre al prompt, se re-corre TODO el set y se reportan ambas rondas. Documentar la iteración suma credibilidad, no la resta.

---

## FASE 3 — MAÑANA · El entrenamiento real (flywheel de datos)

- **Cada corrección del ingeniero en campo = 1 dato de entrenamiento perfecto:** entrada (fotos + cuestionario) → etiqueta (veredicto profesional + posting oficial ATC-20/IDIGER). El "mapeo humano" de los 3 toques no es solo control de calidad: es la **fábrica del dataset**.
- **Con ~2.000-5.000 casos corregidos:** se afina un modelo propio. Opciones: *fine-tuning* ligero de Gemma 3 con LoRA (ajustar un modelo grande con pocos datos y poca máquina, sin re-entrenarlo entero) o un clasificador visual pequeño y especializado.
- **Datasets públicos de arranque:** SDNET2018 (~56.000 imágenes de grietas en concreto, Utah State) · fotos graduadas del EMS-98 · xBD/xView2 (daño desde satélite, para la capa cielo).
- **Métrica de producción:** *recall* de ALTA (que ningún caso grave se escape) por encima de la precisión — el costo de un falso tranquilizador se pondera 10× frente a una falsa alarma. Matriz de confusión por ciudad y tipo constructivo.
- **Gobernanza permanente:** el modelo propio hereda las mismas reglas — prioridad sí, habitabilidad jamás; humano decide; sesgo conservador auditado en cada versión.

---

## Reparto de tareas (próximas horas)

| Quién | Qué |
|---|---|
| **Dev** | Pegar rúbrica + few-shot + contrato JSON en el prompt (Claude y nodo Gemma/Ollama) · regla de confianza baja |
| **German** | Liderar etiquetado ciego del set dorado · llenar la tabla de calibración · integrarla al README |
| **Ing. civil** (si hay) | Validar las etiquetas del set y la tabla de severidad · ser "el veredicto experto" |
| **Diseñador** | Nada aquí — sigue en video/tablero |

**La frase para el jurado:** *"No entrenamos un modelo en 24 horas: codificamos la rúbrica ATC-20 en un modelo de visión, lo calibramos contra un set dorado con cero falsos tranquilizadores, y cada corrección de un ingeniero en campo se convierte en dato de entrenamiento. En tres meses de operación, MilOjos tendría el mayor dataset de daños post-sísmicos etiquetado por expertos de Colombia — y el modelo se entrena solo mientras trabaja."*
