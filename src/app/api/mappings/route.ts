import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/role-guard";
import {
  getLocalItems,
  listMappings,
  listUnmappedIntegrationItems,
  upsertItemMapping,
} from "@/lib/inventory/store";

const mappingSchema = z.object({
  source: z.enum(["TOAST", "XTRACHEF"]),
  externalId: z.string().min(1),
  localItemId: z.string().min(1),
  localItemName: z.string().min(1),
  confidence: z.number().int().min(1).max(100).default(100),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const [mappings, localItems, toastCandidates] = await Promise.all([
    listMappings(),
    getLocalItems(),
    listUnmappedIntegrationItems("TOAST"),
  ]);

  return Response.json({
    success: true,
    mappings,
    localItems,
    toastCandidates: toastCandidates.slice(0, 100),
  });
}

export async function POST(request: Request) {
  const forbidden = requireMinimumRole(request, "MANAGER");
  if (forbidden) {
    return forbidden;
  }

  try {
    const payload = mappingSchema.parse(await request.json());
    const mapping = await upsertItemMapping(payload);

    return Response.json({
      success: true,
      mapping,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid mapping payload",
      },
      { status: 400 },
    );
  }
}
