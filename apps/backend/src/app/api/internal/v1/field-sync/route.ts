import { FieldSyncBatchSchema } from "@/lib/api/field-sync-contracts";
import { handleInternalRequest } from "@/lib/api/internal-handler";
import { InternalApiHttpError, zodDetails } from "@/lib/api/internal-response";
import {
  applyCorsHeaders,
  blockedCorsResponse,
  evaluateFieldCors,
  preflightResponse,
} from "@/lib/api/cors";
import { storeFieldSyncBatch } from "@/lib/data/field-sync-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BATCH_BYTES = 1_500_000;

export async function OPTIONS(request: Request) {
  const decision = evaluateFieldCors(request);
  if (!decision.ok) {
    return blockedCorsResponse(decision);
  }
  return preflightResponse(decision as Extract<typeof decision, { ok: true }>);
}

export async function POST(request: Request) {
  const corsDecision = evaluateFieldCors(request);
  if (!corsDecision.ok) {
    return blockedCorsResponse(corsDecision);
  }

  const response = await handleInternalRequest(request, async () => {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BATCH_BYTES) {
      throw new InternalApiHttpError(413, "invalid_query", "Field synchronization batch is too large.");
    }

    let rawBody: string;
    try {
      rawBody = await request.text();
    } catch {
      throw new InternalApiHttpError(400, "invalid_query", "Request body must be valid JSON.");
    }
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BATCH_BYTES) {
      throw new InternalApiHttpError(413, "invalid_query", "Field synchronization batch is too large.");
    }

    let input: unknown;
    try {
      input = JSON.parse(rawBody);
    } catch {
      throw new InternalApiHttpError(400, "invalid_query", "Request body must be valid JSON.");
    }

    const parsed = FieldSyncBatchSchema.safeParse(input);
    if (!parsed.success) {
      throw new InternalApiHttpError(
        400,
        "invalid_query",
        "Field synchronization batch is invalid.",
        zodDetails(parsed.error.issues),
      );
    }

    return storeFieldSyncBatch(parsed.data);
  });

  applyCorsHeaders(response.headers, corsDecision);
  return response;
}
