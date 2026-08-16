import { z } from "zod";
import { createHash } from "node:crypto";
import { checkInternalApiAuth } from "@/lib/api/internal-auth";
import { handleInternalRequest } from "@/lib/api/internal-handler";
import { internalError, InternalApiHttpError, zodDetails } from "@/lib/api/internal-response";
import {
  applyCorsHeaders,
  blockedCorsResponse,
  evaluateFieldCors,
  preflightResponse,
} from "@/lib/api/cors";
import { getFieldMedia, storeFieldMedia } from "@/lib/data/field-observations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_MEDIA_BYTES = 15_000_000;
const HeadersSchema = z.object({
  operationId: z.string().min(1).max(128),
  batchId: z.string().min(1).max(128),
  mediaId: z.string().min(1).max(128),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const QuerySchema = z.object({
  batchId: z.string().min(1).max(128),
  mediaId: z.string().min(1).max(128),
});

export async function OPTIONS(request: Request) {
  const decision = evaluateFieldCors(request);
  if (!decision.ok) {
    return blockedCorsResponse(decision);
  }
  return preflightResponse(decision as Extract<typeof decision, { ok: true }>);
}

export async function GET(request: Request) {
  const corsDecision = evaluateFieldCors(request);
  if (!corsDecision.ok) {
    return blockedCorsResponse(corsDecision);
  }

  let response: Response;
  const authFailure = checkInternalApiAuth(request);
  if (authFailure) {
    response = internalError(authFailure.status, authFailure.code, authFailure.message);
  } else {
    try {
      const url = new URL(request.url);
      const parsed = QuerySchema.safeParse({
        batchId: url.searchParams.get("batch_id"),
        mediaId: url.searchParams.get("media_id"),
      });
      if (!parsed.success) {
        throw new InternalApiHttpError(
          400,
          "invalid_query",
          "Media query is invalid.",
          zodDetails(parsed.error.issues),
        );
      }
      const media = await getFieldMedia(parsed.data);
      response = new Response(new Uint8Array(media.body), {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Content-Length": String(media.byteSize),
          "Content-Type": media.mimeType,
          "X-Content-SHA256": media.sha256,
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      response = error instanceof InternalApiHttpError
        ? internalError(error.status, error.code, error.message, error.details)
        : internalError(500, "internal_server_error", "Internal API request failed.");
    }
  }

  applyCorsHeaders(response.headers, corsDecision);
  return response;
}

export async function PUT(request: Request) {
  const corsDecision = evaluateFieldCors(request);
  if (!corsDecision.ok) {
    return blockedCorsResponse(corsDecision);
  }

  const response = await handleInternalRequest(request, async () => {
    const parsed = HeadersSchema.safeParse({
      operationId: request.headers.get("x-operation-id"),
      batchId: request.headers.get("x-batch-id"),
      mediaId: request.headers.get("x-media-id"),
      sha256: request.headers.get("x-content-sha256"),
      mimeType: request.headers.get("content-type"),
    });
    if (!parsed.success) {
      throw new InternalApiHttpError(400, "invalid_query", "Media headers are invalid.", zodDetails(parsed.error.issues));
    }
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_MEDIA_BYTES) {
      throw new InternalApiHttpError(413, "invalid_query", "Media file is too large.");
    }
    let body: ArrayBuffer;
    try {
      body = await request.arrayBuffer();
    } catch {
      throw new InternalApiHttpError(400, "invalid_query", "Media request body could not be read.");
    }
    if (body.byteLength === 0 || body.byteLength > MAX_MEDIA_BYTES) {
      throw new InternalApiHttpError(413, "invalid_query", "Media file is empty or too large.");
    }
    const actualSha256 = createHash("sha256").update(Buffer.from(body)).digest("hex");
    if (actualSha256 !== parsed.data.sha256.toLowerCase()) {
      throw new InternalApiHttpError(400, "invalid_query", "Media SHA-256 does not match the uploaded bytes.");
    }
    return storeFieldMedia({ ...parsed.data, body });
  });

  applyCorsHeaders(response.headers, corsDecision);
  return response;
}
