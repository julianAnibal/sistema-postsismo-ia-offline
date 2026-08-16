import { pingFieldStorage } from "@/lib/data/field-storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Unauthenticated health endpoint suitable for Railway health checks. It
// verifies the Postgres connection and that the media directory is writable
// without leaking host paths, env variable names, or stack traces.
export async function GET() {
  const checks = await pingFieldStorage();
  const ok = Boolean(checks.storage) && Boolean(checks.media);
  const body = {
    status: ok ? "ok" : "degraded",
    service: "1000-ojos-field-backend",
    checks: {
      storage: checks.storage ? "ok" : "down",
      media: checks.media ? "ok" : "down",
    },
    time: new Date().toISOString(),
  };
  return Response.json(body, {
    status: ok ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
