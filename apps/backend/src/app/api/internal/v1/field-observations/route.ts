import { z } from "zod";
import { handleInternalRequest } from "@/lib/api/internal-handler";
import { InternalApiHttpError, zodDetails } from "@/lib/api/internal-response";
import {
  applyCorsHeaders,
  blockedCorsResponse,
  evaluateFieldCors,
  preflightResponse,
} from "@/lib/api/cors";
import { listFieldObservations, saveFieldReview } from "@/lib/data/field-observations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ReviewSchema = z.object({
  batchId: z.string().min(1).max(128),
  inspectionId: z.string().min(1).max(128),
  decision: z.enum(["approved", "corrected", "rejected"]),
  correctedDamageLevel: z.enum(["none", "light", "moderate", "severe", "unknown"]).optional(),
  notes: z.string().max(2_000).optional(),
}).strict();

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

  const response = await handleInternalRequest(request, () => {
    const operationId = new URL(request.url).searchParams.get("operation_id")?.trim();
    return listFieldObservations(operationId || undefined);
  });
  applyCorsHeaders(response.headers, corsDecision);
  return response;
}

export async function POST(request: Request) {
  const corsDecision = evaluateFieldCors(request);
  if (!corsDecision.ok) {
    return blockedCorsResponse(corsDecision);
  }

  const response = await handleInternalRequest(request, async () => {
    const parsed = ReviewSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new InternalApiHttpError(400, "invalid_query", "Review is invalid.", zodDetails(parsed.error.issues));
    }
    return saveFieldReview(parsed.data);
  });
  applyCorsHeaders(response.headers, corsDecision);
  return response;
}
