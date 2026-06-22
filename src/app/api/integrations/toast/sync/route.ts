import {
  getIntegrationCatalog,
  listSyncRuns,
} from "@/lib/inventory/store";
import { requireMinimumRole } from "@/lib/auth/role-guard";
import { performToastSync } from "@/lib/integrations/toast-sync-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const [catalog, runs] = await Promise.all([getIntegrationCatalog(), listSyncRuns("TOAST")]);
  return Response.json({
    success: true,
    lastToastSyncAt: catalog.lastToastSyncAt,
    catalogCount: catalog.items.length,
    sample: catalog.items.slice(0, 20),
    recentRuns: runs,
  });
}

export async function POST(request: Request) {
  const forbidden = requireMinimumRole(request, "MANAGER");
  if (forbidden) {
    return forbidden;
  }

  try {
    const result = await performToastSync();

    return Response.json({
      success: true,
      runId: result.runId,
      stats: result.stats,
      sample: result.sample,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Toast sync failed";

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
