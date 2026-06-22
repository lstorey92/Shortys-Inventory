import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().optional(),
  TOAST_TOKEN_URL: z.string().url().optional(),
  TOAST_CLIENT_ID: z.string().min(1).optional(),
  TOAST_CLIENT_SECRET: z.string().min(1).optional(),
  TOAST_SCOPE: z.string().default("menus:read menus:write"),
  TOAST_USER_ACCESS_TYPE: z.string().default("TOAST_MACHINE_CLIENT"),
  XTRACHEF_BASE_URL: z.string().url().optional(),
  XTRACHEF_API_KEY: z.string().optional(),
  TOAST_GET_MENUS_URL: z.string().url().optional(),
  TOAST_LIST_MENU_ITEMS_URL: z.string().url().optional(),
  TOAST_LOCATION_GUID: z.string().optional(),
  TOAST_RESTAURANT_GUID: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issueList = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${issueList}`);
}

export const env = parsed.data;

export function isToastConfigured(): boolean {
  return Boolean(env.TOAST_TOKEN_URL && env.TOAST_CLIENT_ID && env.TOAST_CLIENT_SECRET);
}

export function isXtraChefConfigured(): boolean {
  return Boolean(env.XTRACHEF_BASE_URL && env.XTRACHEF_API_KEY);
}
