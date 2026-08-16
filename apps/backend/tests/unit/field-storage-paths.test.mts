import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { __testing } from "../../src/lib/data/field-storage.js";

const { ensureAbsoluteWithinRoot, ensureWithinRoot } = __testing;

describe("ensureWithinRoot", () => {
  const root = mkdtempSync(join(tmpdir(), "field-media-test-"));

  it("accepts a safe relative path", () => {
    const resolved = ensureWithinRoot(root, "operation-1/batch-1/media.jpg");
    assert.ok(resolved.startsWith(root));
    assert.ok(resolved.endsWith("operation-1/batch-1/media.jpg"));
  });

  it("strips a leading slash before resolving", () => {
    const resolved = ensureWithinRoot(root, "/operation-1/batch-1/media.jpg");
    assert.ok(resolved.startsWith(root));
  });

  it("rejects '..' segments", () => {
    assert.throws(() => ensureWithinRoot(root, "../etc/passwd"), /escapes/i);
  });

  it("rejects embedded '..' segments", () => {
    assert.throws(() => ensureWithinRoot(root, "operation-1/../batch-1/media.jpg"), /escapes/i);
  });

  it("rejects an input that resolves above the root", () => {
    assert.throws(() => ensureWithinRoot(root, "operation-1/../../escape.txt"), /escapes/i);
  });
});

describe("ensureAbsoluteWithinRoot", () => {
  const root = mkdtempSync(join(tmpdir(), "field-media-read-test-"));

  it("accepts a stored absolute path below the media root", () => {
    assert.equal(
      ensureAbsoluteWithinRoot(root, join(root, "operation-1", "batch-1", "media.jpg")),
      join(root, "operation-1", "batch-1", "media.jpg"),
    );
  });

  it("rejects relative and outside stored paths", () => {
    assert.throws(() => ensureAbsoluteWithinRoot(root, "operation-1/media.jpg"), /absolute/i);
    assert.throws(() => ensureAbsoluteWithinRoot(root, join(root, "..", "outside.jpg")), /escapes/i);
  });
});
