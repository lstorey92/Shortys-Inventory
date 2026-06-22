import { fetchXtraChefHealth } from "@/lib/integrations/xtrachef";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const health = await fetchXtraChefHealth();
    return Response.json({ success: true, health });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
