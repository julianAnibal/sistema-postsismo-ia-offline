// Browser-safe CORS for the 1000 ojos field routes.
//
// Decisions:
// - Native clients (no Origin) and same-origin requests are always allowed.
// - Browser requests with an Origin header must list the origin in
//   `FIELD_ALLOWED_ORIGINS` (comma-separated, exact match). Anything else
//   returns 403 and the standard envelope.
// - We never set `Access-Control-Allow-Credentials`: authentication uses a
//   server-issued Bearer token, so cookies/CSRF are not in scope.
// - `Vary: Origin` is always appended because the allowed origin may differ
//   between requests.

const DEFAULT_ALLOWED_METHODS = ["GET", "POST", "PUT", "OPTIONS"] as const;
const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "content-type",
  "x-operation-id",
  "x-batch-id",
  "x-media-id",
  "x-content-sha256",
  "x-source-role",
] as const;

export type CorsDecision =
  | { ok: true; origin: string | null }
  | { ok: false; status: 403; code: "cors_origin_not_allowed"; message: string };

let cachedAllowedOrigins: ReadonlySet<string> | null = null;

export function parseAllowedOrigins(raw: string | undefined | null): ReadonlySet<string> {
  if (!raw) return new Set();
  const values = raw
    .split(/[,\n]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.replace(/\/$/, "").toLowerCase());
  return new Set(values);
}

export function getFieldAllowedOrigins(): ReadonlySet<string> {
  if (cachedAllowedOrigins) return cachedAllowedOrigins;
  cachedAllowedOrigins = parseAllowedOrigins(process.env.FIELD_ALLOWED_ORIGINS);
  return cachedAllowedOrigins;
}

export function resetFieldAllowedOriginsCache(): void {
  cachedAllowedOrigins = null;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/$/, "").toLowerCase();
}

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function requestOrigins(request: Request): ReadonlySet<string> {
  const url = new URL(request.url);
  const origins = new Set<string>([normalizeOrigin(url.origin)!]);
  const forwardedProtocol = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProtocol || url.protocol.replace(/:$/, "");
  const hosts = [
    firstForwardedValue(request.headers.get("x-forwarded-host")),
    firstForwardedValue(request.headers.get("host")),
  ];
  for (const host of hosts) {
    if (!host) continue;
    try {
      const origin = normalizeOrigin(new URL(`${protocol}://${host}`).origin);
      if (origin) origins.add(origin);
    } catch {
      // Ignore malformed proxy headers and continue with the request URL.
    }
  }
  return origins;
}

export function evaluateFieldCors(request: Request): CorsDecision {
  const originHeader = normalizeOrigin(request.headers.get("origin"));
  if (originHeader === null) {
    return { ok: true, origin: null };
  }
  if (requestOrigins(request).has(originHeader)) {
    return { ok: true, origin: null };
  }
  const allowed = getFieldAllowedOrigins();
  if (allowed.size === 0) {
    return {
      ok: false,
      status: 403,
      code: "cors_origin_not_allowed",
      message: "No browser origins are allowed for this field endpoint.",
    };
  }
  if (!allowed.has(originHeader)) {
    return {
      ok: false,
      status: 403,
      code: "cors_origin_not_allowed",
      message: "This origin is not allowed by FIELD_ALLOWED_ORIGINS.",
    };
  }
  return { ok: true, origin: originHeader };
}

export function buildCorsHeaders(decision: CorsDecision): Headers {
  const headers = new Headers();
  headers.set("Vary", "Origin");
  if (!decision.ok) return headers;
  if (decision.origin) {
    headers.set("Access-Control-Allow-Origin", decision.origin);
    headers.set("Access-Control-Allow-Methods", DEFAULT_ALLOWED_METHODS.join(", "));
    headers.set("Access-Control-Allow-Headers", DEFAULT_ALLOWED_HEADERS.join(", "));
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

export function applyCorsHeaders(target: Headers, decision: CorsDecision): void {
  for (const [name, value] of buildCorsHeaders(decision).entries()) {
    target.set(name, value);
  }
}

export function blockedCorsResponse(decision: Extract<CorsDecision, { ok: false }>): Response {
  const headers = buildCorsHeaders(decision);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(
    JSON.stringify({
      error: {
        code: decision.code,
        message: decision.message,
      },
    }),
    { status: decision.status, headers },
  );
}

export function preflightResponse(decision: Extract<CorsDecision, { ok: true }>): Response {
  const headers = buildCorsHeaders(decision);
  headers.set("Content-Length", "0");
  return new Response(null, { status: 204, headers });
}

export const FIELD_CORS_METHODS = DEFAULT_ALLOWED_METHODS;
export const FIELD_CORS_HEADERS = DEFAULT_ALLOWED_HEADERS;
