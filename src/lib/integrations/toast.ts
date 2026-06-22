import { env, isToastConfigured } from "@/lib/env";

export type ToastTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

let cachedToken: { token: ToastTokenResponse; expiresAt: number } | null = null;

function getToastAuthHeader(): string {
  const credentials = `${env.TOAST_CLIENT_ID}:${env.TOAST_CLIENT_SECRET}`;
  const encoded = Buffer.from(credentials).toString("base64");
  return `Basic ${encoded}`;
}

export async function fetchToastAccessToken(forceRefresh = false): Promise<ToastTokenResponse> {
  if (!isToastConfigured()) {
    throw new Error("Toast OAuth is not fully configured.");
  }

  const now = Date.now();
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: env.TOAST_SCOPE,
    userAccessType: env.TOAST_USER_ACCESS_TYPE,
  });

  const response = await fetch(env.TOAST_TOKEN_URL!, {
    method: "POST",
    headers: {
      Authorization: getToastAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Toast token request failed (${response.status}): ${payload}`);
  }

  const token = (await response.json()) as ToastTokenResponse;
  cachedToken = {
    token,
    expiresAt: now + token.expires_in * 1000,
  };

  return token;
}

export async function fetchToastMenus(): Promise<unknown> {
  if (!env.TOAST_GET_MENUS_URL) {
    throw new Error("TOAST_GET_MENUS_URL is not configured.");
  }

  const token = await fetchToastAccessToken();
  const response = await fetch(env.TOAST_GET_MENUS_URL, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Toast menu fetch failed with status ${response.status}`);
  }

  return response.json();
}
