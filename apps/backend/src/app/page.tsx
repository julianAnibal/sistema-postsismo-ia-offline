import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 720, margin: "64px auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>1000 Ojos backend</h1>
      <p>Servicio privado de sincronización, evidencia y revisión operativa.</p>
      <p><Link href="/field-review">Abrir consola de revisión</Link></p>
    </main>
  );
}
