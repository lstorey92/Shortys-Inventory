import { listLocations } from "@/lib/inventory/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ locations: listLocations() });
}
