"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileSearch, KeyRound, LoaderCircle, Printer, RefreshCw, Save, ShieldCheck, X } from "lucide-react";
import styles from "../../app/field-review/field-review.module.css";

type FieldMedia = {
  id: string;
  sha256: string;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
  capturedAt: string | null;
  provenance: string | null;
  href: string;
};

type FieldReview = {
  decision: "approved" | "corrected" | "rejected";
  correctedDamageLevel: string | null;
  notes: string;
  reviewedAt: string;
};

type Observation = {
  id: string;
  batchId: string;
  operationId: string;
  receivedAt: string;
  infrastructure?: { code?: string; name?: string; type?: string; sector?: string; latitude?: number; longitude?: number };
  inspection: {
    damageLevel?: string;
    observation?: string;
    status?: string;
    access?: string;
    element?: string;
    condition?: string;
    observability?: string;
    viewType?: string;
    notes?: string;
    estimatedOccupants?: number;
    peopleNeedingSupport?: number;
    needs?: string[];
  };
  media: FieldMedia[];
  mediaCount: number;
  mediaExpectedCount: number;
  review: FieldReview | null;
};

type Envelope = { data?: Observation[]; error?: { message?: string } };
type ReviewEnvelope = { data?: FieldReview; error?: { message?: string } };

const tones: Record<string, string> = {
  severe: "#b42318",
  moderate: "#d97706",
  light: "#2563eb",
  none: "#16805c",
  unknown: "#667085",
};

const levelLabels: Record<string, string> = {
  all: "Todas",
  severe: "Severo",
  moderate: "Moderado",
  light: "Leve",
  none: "Sin daño observado",
  unknown: "Sin clasificar",
};

export default function FieldReviewConsole() {
  const [token, setToken] = useState("");
  const [observations, setObservations] = useState<Observation[]>([]);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("Ingrese el token operativo para cargar datos privados.");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Observation | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const mediaUrlsRef = useRef<Record<string, string>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviewDecision, setReviewDecision] = useState<FieldReview["decision"]>("approved");
  const [correctedDamageLevel, setCorrectedDamageLevel] = useState("unknown");
  const [reviewNotes, setReviewNotes] = useState("");

  const replaceMediaUrls = (next: Record<string, string>) => {
    Object.values(mediaUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    mediaUrlsRef.current = next;
    setMediaUrls(next);
  };

  useEffect(() => () => {
    Object.values(mediaUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        Object.values(mediaUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
        mediaUrlsRef.current = {};
        setMediaUrls({});
        setSelected(null);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [selected]);

  const load = async () => {
    setLoading(true);
    setStatus("Cargando evidencia…");
    try {
      const response = await fetch("/api/internal/v1/field-observations", {
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json() as Envelope;
      if (!response.ok || !payload.data) {
        setStatus(payload.error?.message ?? "No fue posible cargar la evidencia.");
        return;
      }
      setObservations(payload.data);
      setStatus(`${payload.data.length} inspecciones recibidas.`);
    } catch {
      setStatus("No fue posible conectar con la consola privada.");
    } finally {
      setLoading(false);
    }
  };

  const review = async (
    item: Observation,
    decision: FieldReview["decision"],
    options: { correctedDamageLevel?: string; notes?: string } = {},
  ) => {
    let response: Response;
    try {
      response = await fetch("/api/internal/v1/field-observations", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          batchId: item.batchId,
          inspectionId: item.id,
          decision,
          correctedDamageLevel: decision === "corrected" ? options.correctedDamageLevel : undefined,
          notes: options.notes,
        }),
      });
    } catch {
      setStatus("No fue posible conectar con el servicio de revisión.");
      return false;
    }
    const payload = await response.json() as ReviewEnvelope;
    if (!response.ok || !payload.data) {
      setStatus(payload.error?.message ?? "No se guardó la revisión.");
      return false;
    }
    const savedReview = payload.data;
    setObservations((current) => current.map((observation) => (
      observation.batchId === item.batchId && observation.id === item.id
        ? { ...observation, review: savedReview }
        : observation
    )));
    setSelected((current) => current?.batchId === item.batchId && current.id === item.id
      ? { ...current, review: savedReview }
      : current);
    setStatus(`Revisión ${decision === "approved" ? "aprobada" : decision === "rejected" ? "rechazada" : "corregida"} y guardada.`);
    return true;
  };

  const openObservation = async (item: Observation) => {
    replaceMediaUrls({});
    setSelected(item);
    setReviewDecision(item.review?.decision ?? "approved");
    setCorrectedDamageLevel(item.review?.correctedDamageLevel ?? item.inspection.damageLevel ?? "unknown");
    setReviewNotes(item.review?.notes ?? "");
    if (item.media.length === 0) return;

    setDetailLoading(true);
    const nextUrls: Record<string, string> = {};
    try {
      for (const media of item.media) {
        const response = await fetch(media.href, {
          headers: { authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("media_load_failed");
        nextUrls[media.id] = URL.createObjectURL(await response.blob());
      }
      replaceMediaUrls(nextUrls);
    } catch {
      Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url));
      setStatus("No fue posible abrir toda la evidencia fotográfica.");
    } finally {
      setDetailLoading(false);
    }
  };

  const closeObservation = () => {
    replaceMediaUrls({});
    setSelected(null);
  };

  const visible = useMemo(
    () => observations.filter((item) => filter === "all" || item.inspection.damageLevel === filter),
    [filter, observations],
  );
  const totals = useMemo(() => ({
    occupants: visible.reduce((sum, item) => sum + (item.inspection.estimatedOccupants ?? 0), 0),
    support: visible.reduce((sum, item) => sum + (item.inspection.peopleNeedingSupport ?? 0), 0),
    media: visible.reduce((sum, item) => sum + item.mediaCount, 0),
  }), [visible]);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><strong>1000 ojos</strong><span>Revisión de evidencia de campo</span></div>
        <div className={styles.headerState}><span><ShieldCheck size={15} /> Acceso privado</span><button type="button" aria-label="Imprimir informe" title="Imprimir informe" onClick={() => window.print()}><Printer size={18} /></button></div>
      </header>
      <section className={styles.auth}>
        <div className={styles.authTitle}><KeyRound size={18} /><label htmlFor="field-token">Token operativo</label></div>
        <input id="field-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" />
        <button type="button" onClick={() => void load()} disabled={!token || loading}>{loading ? <LoaderCircle className={styles.spin} size={17} /> : observations.length ? <RefreshCw size={17} /> : <ShieldCheck size={17} />}{loading ? "Cargando" : observations.length ? "Actualizar" : "Abrir consola"}</button>
        <p role="status">{status}</p>
      </section>
      <section className={styles.summary} aria-label="Resumen">
        <div><span>Inspecciones</span><strong>{visible.length}</strong></div>
        <div><span>Población estimada</span><strong>{totals.occupants}</strong></div>
        <div><span>Requieren apoyo</span><strong>{totals.support}</strong></div>
        <div><span>Fotografías</span><strong>{totals.media}</strong></div>
      </section>
      <nav className={styles.filters} aria-label="Filtrar severidad">
        {["all", "severe", "moderate", "light", "none", "unknown"].map((level) => (
          <button key={level} type="button" aria-pressed={filter === level} onClick={() => setFilter(level)}>
            {level !== "all" ? <span style={{ background: tones[level] }} /> : null}{levelLabels[level]}
          </button>
        ))}
      </nav>
      <section className={styles.mapSection} aria-labelledby="field-map-title">
        <div className={styles.sectionHeading}><div><p>Territorio</p><h1 id="field-map-title">Mapa de afectaciones</h1></div><span>{visible.length} registros visibles</span></div>
        <div className={styles.map} aria-label="Mapa de calor de afectaciones">
          {visible.map((item) => {
            const lat = item.infrastructure?.latitude;
            const lon = item.infrastructure?.longitude;
            if (typeof lat !== "number" || typeof lon !== "number") return null;
            const x = Math.max(2, Math.min(98, ((lon + 79) / 13) * 100));
            const y = Math.max(2, Math.min(98, ((13 - lat) / 14) * 100));
            return <span key={item.id} title={item.infrastructure?.name} style={{ left: `${x}%`, top: `${y}%`, background: tones[item.inspection.damageLevel ?? "unknown"] }} />;
          })}
          <p>Evidencia georreferenciada de campo. No representa cifras oficiales.</p>
        </div>
      </section>
      <section className={styles.tableWrap}>
        <div className={styles.sectionHeading}><div><p>Cola de revisión</p><h2>Inspecciones recibidas</h2></div><span>Decisión humana obligatoria</span></div>
        <table>
          <thead><tr><th>Infraestructura</th><th>Tipo</th><th>Daño observado</th><th>Población</th><th>Evidencia</th><th>Revisión</th></tr></thead>
          <tbody>{visible.map((item) => (
            <tr key={`${item.batchId}-${item.id}`}>
              <td>{item.infrastructure?.name ?? item.id}</td>
              <td>{item.infrastructure?.type ?? "Sin tipo"}</td>
              <td><span className={styles.damage} style={{ borderColor: tones[item.inspection.damageLevel ?? "unknown"] }}>{levelLabels[item.inspection.damageLevel ?? "unknown"]}</span></td>
              <td>{item.inspection.peopleNeedingSupport ?? 0} / {item.inspection.estimatedOccupants ?? 0}</td>
              <td><span className={styles.mediaCount}><Camera size={15} /> {item.mediaCount} / {item.mediaExpectedCount}</span></td>
              <td><button type="button" className={styles.reviewOpen} onClick={() => void openObservation(item)}><FileSearch size={16} /> Revisar</button>{item.review ? <span className={styles.reviewBadge} data-decision={item.review.decision}>{item.review.decision === "approved" ? "Aprobada" : item.review.decision === "rejected" ? "Rechazada" : "Corregida"}</span> : null}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>
      {selected ? (
        <div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeObservation(); }}>
          <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="field-review-detail-title">
            <header className={styles.dialogHeader}>
              <div><p>Expediente privado</p><h2 id="field-review-detail-title">{selected.infrastructure?.name ?? selected.id}</h2><span>{selected.infrastructure?.code ?? selected.id} · {selected.operationId}</span></div>
              <button type="button" aria-label="Cerrar expediente" onClick={closeObservation}><X size={20} /></button>
            </header>
            <div className={styles.dialogBody}>
              <section className={styles.evidencePanel} aria-labelledby="field-evidence-title">
                <div className={styles.panelHeading}><div><p>Evidencia</p><h3 id="field-evidence-title">Fotografías verificadas</h3></div><span>{selected.mediaCount} cargadas de {selected.mediaExpectedCount}</span></div>
                {detailLoading ? <div className={styles.evidenceState}><LoaderCircle className={styles.spin} size={22} /> Abriendo evidencia privada…</div> : null}
                {!detailLoading && selected.media.length === 0 ? <div className={styles.evidenceState}>No hay archivos fotográficos cargados para esta inspección.</div> : null}
                <div className={styles.mediaGrid}>
                  {selected.media.map((media, index) => mediaUrls[media.id] ? (
                    <figure key={media.id}>
                      <Image src={mediaUrls[media.id]} alt={`Evidencia ${index + 1} de ${selected.infrastructure?.name ?? selected.id}`} width={960} height={720} unoptimized />
                      <figcaption><strong>{media.provenance === "camera" ? "Cámara" : "Archivo importado"}</strong><span>{media.capturedAt ? new Date(media.capturedAt).toLocaleString("es-CO") : "Fecha de captura no disponible"}</span><code title={media.sha256}>SHA-256 {media.sha256.slice(0, 12)}…</code></figcaption>
                    </figure>
                  ) : null)}
                </div>
              </section>
              <aside className={styles.recordPanel}>
                <section>
                  <p>Observación de campo</p>
                  <h3>Datos registrados</h3>
                  <dl>
                    <div><dt>Daño observado</dt><dd>{levelLabels[selected.inspection.damageLevel ?? "unknown"]}</dd></div>
                    <div><dt>Acceso</dt><dd>{selected.inspection.access ?? "Sin dato"}</dd></div>
                    <div><dt>Elemento</dt><dd>{selected.inspection.element ?? "Sin dato"}</dd></div>
                    <div><dt>Condición</dt><dd>{selected.inspection.condition ?? "Sin dato"}</dd></div>
                    <div><dt>Observabilidad</dt><dd>{selected.inspection.observability ?? "Sin dato"}</dd></div>
                    <div><dt>Población</dt><dd>{selected.inspection.peopleNeedingSupport ?? 0} requieren apoyo / {selected.inspection.estimatedOccupants ?? 0} estimadas</dd></div>
                    <div><dt>Ubicación</dt><dd>{typeof selected.infrastructure?.latitude === "number" && typeof selected.infrastructure?.longitude === "number" ? `${selected.infrastructure.latitude.toFixed(5)}, ${selected.infrastructure.longitude.toFixed(5)}` : "Sin coordenadas"}</dd></div>
                    <div><dt>Notas de brigada</dt><dd>{selected.inspection.notes || "Sin notas"}</dd></div>
                  </dl>
                </section>
                <form className={styles.reviewForm} onSubmit={(event) => {
                  event.preventDefault();
                  void review(selected, reviewDecision, { correctedDamageLevel, notes: reviewNotes });
                }}>
                  <p>Decisión profesional</p>
                  <h3>Revisión humana obligatoria</h3>
                  <label htmlFor="review-decision">Decisión</label>
                  <select id="review-decision" value={reviewDecision} onChange={(event) => setReviewDecision(event.target.value as FieldReview["decision"])}>
                    <option value="approved">Aprobar observación</option>
                    <option value="corrected">Aprobar con corrección</option>
                    <option value="rejected">Rechazar evidencia</option>
                  </select>
                  {reviewDecision === "corrected" ? <><label htmlFor="corrected-level">Nivel corregido</label><select id="corrected-level" value={correctedDamageLevel} onChange={(event) => setCorrectedDamageLevel(event.target.value)}>{["none", "light", "moderate", "severe", "unknown"].map((level) => <option key={level} value={level}>{levelLabels[level]}</option>)}</select></> : null}
                  <label htmlFor="review-notes">Notas de revisión</label>
                  <textarea id="review-notes" maxLength={2000} rows={4} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} placeholder="Justificación, correcciones o próximos pasos" />
                  <button type="submit"><Save size={17} /> Guardar decisión</button>
                  {selected.review ? <small>Última revisión: {new Date(selected.review.reviewedAt).toLocaleString("es-CO")}</small> : <small>La observación sigue pendiente hasta guardar una decisión.</small>}
                </form>
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
