import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  applyCorsHeaders,
  blockedCorsResponse,
  buildCorsHeaders,
  evaluateFieldCors,
  FIELD_CORS_HEADERS,
  FIELD_CORS_METHODS,
  parseAllowedOrigins,
  preflightResponse,
  resetFieldAllowedOriginsCache,
} from "../../src/lib/api/cors.js";

function makeRequest(init: { origin?: string; method?: string } = {}): Request {
  const headers = new Headers();
  if (init.origin !== undefined) headers.set("origin", init.origin);
  return new Request("https://backend.example.com/field-sync", {
    method: init.method ?? "POST",
    headers,
  });
}

describe("parseAllowedOrigins", () => {
  it("splits, trims, and drops empty entries", () => {
    const result = parseAllowedOrigins(" https://a.example , ,https://b.example\n");
    assert.deepEqual([...result], ["https://a.example", "https://b.example"]);
  });

  it("returns an empty set when the env is missing", () => {
    assert.equal(parseAllowedOrigins(undefined).size, 0);
    assert.equal(parseAllowedOrigins("").size, 0);
  });
});

describe("evaluateFieldCors", () => {
  const originalEnv = process.env.FIELD_ALLOWED_ORIGINS;
  beforeEach(() => {
    delete process.env.FIELD_ALLOWED_ORIGINS;
    resetFieldAllowedOriginsCache();
  });
  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.FIELD_ALLOWED_ORIGINS;
    } else {
      process.env.FIELD_ALLOWED_ORIGINS = originalEnv;
    }
    resetFieldAllowedOriginsCache();
  });

  it("treats native calls (no Origin header) as allowed without CORS headers", () => {
    const decision = evaluateFieldCors(makeRequest());
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.origin, null);
    }
    const headers = buildCorsHeaders(decision);
    assert.equal(headers.get("Access-Control-Allow-Origin"), null);
  });

  it("allows same-origin browser requests without requiring an allow-list entry", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "";
    resetFieldAllowedOriginsCache();
    const request = new Request("https://backend.example.org/api/internal/v1/field-observations", {
      method: "POST",
      headers: { origin: "https://backend.example.org" },
    });
    assert.deepEqual(evaluateFieldCors(request), { ok: true, origin: null });
  });

  it("recognizes the public same origin behind a trusted HTTPS proxy", () => {
    const request = new Request("http://internal-service:8080/api/internal/v1/field-observations", {
      method: "POST",
      headers: {
        origin: "https://backend.example.org",
        "x-forwarded-host": "backend.example.org",
        "x-forwarded-proto": "https",
      },
    });
    assert.deepEqual(evaluateFieldCors(request), { ok: true, origin: null });
  });

  it("allows browser origins listed in FIELD_ALLOWED_ORIGINS", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "https://app.example.org";
    resetFieldAllowedOriginsCache();
    const decision = evaluateFieldCors(makeRequest({ origin: "https://app.example.org" }));
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.origin, "https://app.example.org");
    }
    const headers = buildCorsHeaders(decision);
    assert.equal(headers.get("Access-Control-Allow-Origin"), "https://app.example.org");
    assert.equal(headers.get("Access-Control-Allow-Methods"), FIELD_CORS_METHODS.join(", "));
    assert.equal(headers.get("Access-Control-Allow-Headers"), FIELD_CORS_HEADERS.join(", "));
    assert.equal(headers.get("Access-Control-Max-Age"), "600");
    assert.match(headers.get("Vary") ?? "", /Origin/);
  });

  it("rejects browser origins that are not allow-listed", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "https://app.example.org";
    resetFieldAllowedOriginsCache();
    const decision = evaluateFieldCors(makeRequest({ origin: "https://attacker.example" }));
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.status, 403);
      assert.equal(decision.code, "cors_origin_not_allowed");
    }
  });

  it("rejects all browser origins when the allow-list is empty", () => {
    const decision = evaluateFieldCors(makeRequest({ origin: "https://app.example.org" }));
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.status, 403);
    }
  });

  it("matches origins case-insensitively and ignores trailing slashes", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "https://App.Example.Org/";
    resetFieldAllowedOriginsCache();
    const decision = evaluateFieldCors(makeRequest({ origin: "https://app.example.org" }));
    assert.equal(decision.ok, true);
  });
});

describe("applyCorsHeaders", () => {
  beforeEach(() => {
    delete process.env.FIELD_ALLOWED_ORIGINS;
    resetFieldAllowedOriginsCache();
  });
  afterEach(() => {
    delete process.env.FIELD_ALLOWED_ORIGINS;
    resetFieldAllowedOriginsCache();
  });

  it("merges Vary and ACAO into existing response headers", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "https://x.example";
    resetFieldAllowedOriginsCache();
    const target = new Headers({ "content-type": "application/json" });
    const decision = evaluateFieldCors(makeRequest({ origin: "https://x.example" }));
    assert.equal(decision.ok, true);
    if (decision.ok) {
      applyCorsHeaders(target, decision);
    }
    assert.equal(target.get("content-type"), "application/json");
    assert.equal(target.get("Access-Control-Allow-Origin"), "https://x.example");
    assert.match(target.get("Vary") ?? "", /Origin/);
  });
});

describe("blockedCorsResponse and preflightResponse", () => {
  beforeEach(() => {
    delete process.env.FIELD_ALLOWED_ORIGINS;
    resetFieldAllowedOriginsCache();
  });
  afterEach(() => {
    delete process.env.FIELD_ALLOWED_ORIGINS;
    resetFieldAllowedOriginsCache();
  });

  it("returns a JSON 403 with Vary: Origin when an origin is not allowed", () => {
    const decision = evaluateFieldCors(makeRequest({ origin: "https://attacker.example" }));
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      const response = blockedCorsResponse(decision);
      assert.equal(response.status, 403);
      assert.match(response.headers.get("Content-Type") ?? "", /application\/json/);
      assert.match(response.headers.get("Vary") ?? "", /Origin/);
    }
  });

  it("returns a 204 with CORS headers when an origin is allowed", () => {
    process.env.FIELD_ALLOWED_ORIGINS = "https://app.example.org";
    resetFieldAllowedOriginsCache();
    const decision = evaluateFieldCors(makeRequest({ origin: "https://app.example.org" }));
    assert.equal(decision.ok, true);
    if (decision.ok) {
      const response = preflightResponse(decision);
      assert.equal(response.status, 204);
      assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://app.example.org");
      assert.match(response.headers.get("Access-Control-Allow-Methods") ?? "", /POST/);
    }
  });
});
