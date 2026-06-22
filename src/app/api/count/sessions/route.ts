import { createOrReuseOpenSession } from "@/lib/inventory/store";
import { requireMinimumRole } from "@/lib/auth/role-guard";
import { z } from "zod";

const createSessionSchema = z.object({
  locationId: z.string().min(1),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const forbidden = requireMinimumRole(request, "STAFF");
  if (forbidden) {
    return forbidden;
  }

  try {
    const body = await request.json();
    const parsed = createSessionSchema.parse(body);
    const session = await createOrReuseOpenSession(parsed.locationId);
    return Response.json({ session });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 },
    );
  }
}
