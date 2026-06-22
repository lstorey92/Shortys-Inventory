import { exportSessionCsv } from "@/lib/inventory/store";
import { requireMinimumRole } from "@/lib/auth/role-guard";

export const dynamic = "force-dynamic";

type SessionRouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(request: Request, context: SessionRouteContext) {
  const forbidden = requireMinimumRole(request, "STAFF");
  if (forbidden) {
    return forbidden;
  }

  try {
    const { sessionId } = await context.params;
    const { fileName, csv } = await exportSessionCsv(sessionId);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=${fileName}`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 400 },
    );
  }
}
