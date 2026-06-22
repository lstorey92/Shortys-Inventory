import { z } from "zod";
import { requireMinimumRole } from "@/lib/auth/role-guard";
import {
  getToastScheduleState,
  runToastSyncNow,
  setToastSchedule,
} from "@/lib/integrations/toast-scheduler";

const scheduleSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(5).max(1440),
  runNow: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    success: true,
    schedule: getToastScheduleState(),
  });
}

export async function POST(request: Request) {
  const forbidden = requireMinimumRole(request, "MANAGER");
  if (forbidden) {
    return forbidden;
  }

  try {
    const payload = scheduleSchema.parse(await request.json());
    const schedule = setToastSchedule(payload.enabled, payload.intervalMinutes);

    if (payload.runNow) {
      const updated = await runToastSyncNow();
      return Response.json({
        success: true,
        schedule: updated,
      });
    }

    return Response.json({ success: true, schedule });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Invalid schedule payload",
      },
      { status: 400 },
    );
  }
}
