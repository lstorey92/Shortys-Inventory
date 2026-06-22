import { getSession, lockSession, updateSessionLine } from "@/lib/inventory/store";
import { requireMinimumRole } from "@/lib/auth/role-guard";
import { z } from "zod";

const patchSchema = z.object({
  itemId: z.string().min(1).optional(),
  quantity: z.number().min(0).optional(),
  lock: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

type SessionRouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: SessionRouteContext) {
  const { sessionId } = await context.params;
  const session = await getSession(sessionId);

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ session });
}

export async function PATCH(request: Request, context: SessionRouteContext) {
  const forbidden = requireMinimumRole(request, "STAFF");
  if (forbidden) {
    return forbidden;
  }

  try {
    const { sessionId } = await context.params;
    const payload = patchSchema.parse(await request.json());

    if (payload.lock) {
      const locked = await lockSession(sessionId);
      return Response.json({ session: locked });
    }

    if (!payload.itemId || payload.quantity === undefined) {
      return Response.json(
        { error: "itemId and quantity are required when lock is false" },
        { status: 400 },
      );
    }

    const updated = await updateSessionLine(sessionId, payload.itemId, payload.quantity);
    return Response.json({ session: updated });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
