import { fetchToastMenus } from "@/lib/integrations/toast";
import { normalizeToastMenusToItems } from "@/lib/integrations/toast-normalize";
import { finishSyncRun, startSyncRun, upsertIntegrationItems } from "@/lib/inventory/store";

export async function performToastSync() {
  const run = await startSyncRun("TOAST");

  try {
    const payload = await fetchToastMenus();
    const normalized = normalizeToastMenusToItems(payload);
    const stats = await upsertIntegrationItems(normalized, "TOAST");
    await finishSyncRun(run.id, "SUCCESS", normalized.length);

    return {
      runId: run.id,
      stats,
      sample: normalized.slice(0, 15),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Toast sync failed";
    await finishSyncRun(run.id, "FAILED", undefined, message);
    throw new Error(message);
  }
}
