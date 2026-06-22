import { env, isXtraChefConfigured } from "@/lib/env";

export async function fetchXtraChefHealth(): Promise<unknown> {
  if (!isXtraChefConfigured()) {
    throw new Error("XtraCHEF integration is not fully configured.");
  }

  const response = await fetch(`${env.XTRACHEF_BASE_URL!}/health`, {
    headers: {
      Authorization: `Bearer ${env.XTRACHEF_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`XtraCHEF health check failed with status ${response.status}`);
  }

  return response.json();
}
