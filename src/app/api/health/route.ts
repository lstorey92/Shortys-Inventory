import { isToastConfigured, isXtraChefConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    status: "ok",
    now: new Date().toISOString(),
    integrations: {
      toastConfigured: isToastConfigured(),
      xtraChefConfigured: isXtraChefConfigured(),
    },
  });
}
