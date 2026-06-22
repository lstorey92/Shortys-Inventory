import { fetchToastAccessToken } from "@/lib/integrations/toast";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = await fetchToastAccessToken();
    return Response.json({
      success: true,
      tokenType: token.token_type,
      scope: token.scope,
      expiresInSeconds: token.expires_in,
    });
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
