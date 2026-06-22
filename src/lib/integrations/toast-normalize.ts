import type { IntegrationItem } from "@/lib/inventory/store";

type UnknownRecord = Record<string, unknown>;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  return typeof value === "object" && value !== null ? (value as UnknownRecord) : {};
}

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function normalizeToastMenusToItems(payload: unknown): IntegrationItem[] {
  const results: IntegrationItem[] = [];
  const root = asRecord(payload);
  const menus = asArray(root.menus ?? payload);

  for (const menuEntry of menus) {
    const menu = asRecord(menuEntry);
    const groups = asArray(menu.menuGroups ?? menu.groups);

    for (const groupEntry of groups) {
      const group = asRecord(groupEntry);
      const items = asArray(group.menuItems ?? group.items);

      for (const itemEntry of items) {
        const item = asRecord(itemEntry);
        const externalId =
          pickString(item.guid) || pickString(item.id) || pickString(item.externalId) || pickString(item.itemGuid);
        const name = pickString(item.name, "Unnamed Toast Item");

        if (!externalId || !name) {
          continue;
        }

        results.push({
          externalId,
          name,
          source: "TOAST",
          normalizedUnit: "each",
        });
      }
    }
  }

  const deduped = new Map<string, IntegrationItem>();
  for (const item of results) {
    deduped.set(item.externalId, item);
  }

  return [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name));
}
