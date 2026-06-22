import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { locationSeeds } from "@/lib/inventory/seed";

export type IntegrationItem = {
  externalId: string;
  name: string;
  source: "TOAST" | "XTRACHEF";
  normalizedUnit?: string;
};

export type CountSession = {
  id: string;
  locationId: string;
  locationName: string;
  status: "OPEN" | "LOCKED";
  createdAt: string;
  updatedAt: string;
  lines: Array<{
    itemId: string;
    name: string;
    unit: string;
    parLevel: number;
    quantity: number;
  }>;
};

export type SyncRun = {
  id: string;
  source: "TOAST" | "XTRACHEF";
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  importedCount: number | null;
  errorMessage: string | null;
};

export type ItemMapping = {
  source: "TOAST" | "XTRACHEF";
  externalId: string;
  localItemId: string;
  localItemName: string;
  confidence: number;
};

type SyncSource = "TOAST" | "XTRACHEF";

type SyncStatus = "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED";

const sessions = new Map<string, CountSession>();
let integrationCatalog: IntegrationItem[] = [];
let lastToastSyncAt: string | null = null;
const mappingStore = new Map<string, ItemMapping>();
const syncRuns: SyncRun[] = [];

function nowIso(): string {
  return new Date().toISOString();
}

function toNumber(value: Prisma.Decimal | number): number {
  if (typeof value === "number") {
    return value;
  }
  return value.toNumber();
}

function toCountSessionFromMemory(value: CountSession): CountSession {
  return {
    ...value,
    lines: value.lines.map((line) => ({ ...line })),
  };
}

function toCountSessionFromDb(row: {
  id: string;
  locationId: string;
  locationName: string;
  status: "OPEN" | "LOCKED";
  createdAt: Date;
  updatedAt: Date;
  lines: Array<{
    itemId: string;
    name: string;
    unit: string;
    parLevel: Prisma.Decimal;
    quantity: Prisma.Decimal;
  }>;
}): CountSession {
  return {
    id: row.id,
    locationId: row.locationId,
    locationName: row.locationName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: row.lines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      unit: line.unit,
      parLevel: toNumber(line.parLevel),
      quantity: toNumber(line.quantity),
    })),
  };
}

async function withPrismaFallback<T>(
  prismaOperation: () => Promise<T>,
  fallbackOperation: () => T,
): Promise<T> {
  if (!process.env.DATABASE_URL) {
    return fallbackOperation();
  }

  try {
    return await prismaOperation();
  } catch {
    return fallbackOperation();
  }
}

function buildSessionSeed(locationId: string): CountSession {
  const location = locationSeeds.find((entry) => entry.id === locationId);
  if (!location) {
    throw new Error("Location was not found.");
  }

  const timestamp = Date.now();
  const sessionId = `cs_${location.id}_${timestamp}`;
  const currentTime = nowIso();

  return {
    id: sessionId,
    locationId: location.id,
    locationName: location.name,
    status: "OPEN",
    createdAt: currentTime,
    updatedAt: currentTime,
    lines: location.items.map((item) => ({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      parLevel: item.parLevel,
      quantity: 0,
    })),
  };
}

export function listLocations() {
  return locationSeeds.map((location) => ({
    id: location.id,
    name: location.name,
    itemCount: location.items.length,
  }));
}

export async function getLocalItems() {
  const uniqueItems = new Map<string, { id: string; name: string; unit: string }>();
  for (const location of locationSeeds) {
    for (const item of location.items) {
      uniqueItems.set(item.id, { id: item.id, name: item.name, unit: item.unit });
    }
  }
  return [...uniqueItems.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function createOrReuseOpenSession(locationId: string): Promise<CountSession> {
  return withPrismaFallback(
    async () => {
      const existing = await db.pilotCountSession.findFirst({
        where: { locationId, status: "OPEN" },
        include: { lines: true },
      });
      if (existing) {
        return toCountSessionFromDb(existing);
      }

      const seed = buildSessionSeed(locationId);
      const created = await db.pilotCountSession.create({
        data: {
          id: seed.id,
          locationId: seed.locationId,
          locationName: seed.locationName,
          status: seed.status,
          lines: {
            createMany: {
              data: seed.lines.map((line) => ({
                itemId: line.itemId,
                name: line.name,
                unit: line.unit,
                parLevel: line.parLevel,
                quantity: line.quantity,
              })),
            },
          },
        },
        include: { lines: true },
      });

      return toCountSessionFromDb(created);
    },
    () => {
      const existing = [...sessions.values()].find(
        (session) => session.locationId === locationId && session.status === "OPEN",
      );
      if (existing) {
        return toCountSessionFromMemory(existing);
      }

      const nextSession = buildSessionSeed(locationId);
      sessions.set(nextSession.id, nextSession);
      return toCountSessionFromMemory(nextSession);
    },
  );
}

export async function getSession(sessionId: string): Promise<CountSession | null> {
  return withPrismaFallback(
    async () => {
      const found = await db.pilotCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
      });
      return found ? toCountSessionFromDb(found) : null;
    },
    () => sessions.get(sessionId) ?? null,
  );
}

export async function updateSessionLine(
  sessionId: string,
  itemId: string,
  quantity: number,
): Promise<CountSession> {
  return withPrismaFallback(
    async () => {
      const session = await db.pilotCountSession.findUnique({ where: { id: sessionId } });
      if (!session) {
        throw new Error("Session was not found.");
      }
      if (session.status === "LOCKED") {
        throw new Error("Session is locked and cannot be changed.");
      }

      await db.pilotCountLine.update({
        where: {
          sessionId_itemId: {
            sessionId,
            itemId,
          },
        },
        data: {
          quantity,
        },
      });

      await db.pilotCountSession.update({ where: { id: sessionId }, data: { updatedAt: new Date() } });
      const updated = await db.pilotCountSession.findUnique({
        where: { id: sessionId },
        include: { lines: true },
      });
      if (!updated) {
        throw new Error("Session was not found.");
      }

      return toCountSessionFromDb(updated);
    },
    () => {
      const current = sessions.get(sessionId);
      if (!current) {
        throw new Error("Session was not found.");
      }
      if (current.status === "LOCKED") {
        throw new Error("Session is locked and cannot be changed.");
      }

      const next = {
        ...current,
        updatedAt: nowIso(),
        lines: current.lines.map((line) =>
          line.itemId === itemId ? { ...line, quantity } : line,
        ),
      };

      sessions.set(next.id, next);
      return toCountSessionFromMemory(next);
    },
  );
}

export async function lockSession(sessionId: string): Promise<CountSession> {
  return withPrismaFallback(
    async () => {
      const updated = await db.pilotCountSession.update({
        where: { id: sessionId },
        data: {
          status: "LOCKED",
          updatedAt: new Date(),
        },
        include: { lines: true },
      });

      return toCountSessionFromDb(updated);
    },
    () => {
      const current = sessions.get(sessionId);
      if (!current) {
        throw new Error("Session was not found.");
      }

      const next = {
        ...current,
        status: "LOCKED" as const,
        updatedAt: nowIso(),
      };

      sessions.set(next.id, next);
      return toCountSessionFromMemory(next);
    },
  );
}

export async function getIntegrationCatalog() {
  return withPrismaFallback(
    async () => {
      const rows = await db.pilotIntegrationItem.findMany({
        orderBy: [{ name: "asc" }],
      });

      const latestToast = await db.pilotIntegrationItem.findFirst({
        where: { source: "TOAST" },
        orderBy: { syncedAt: "desc" },
      });

      return {
        lastToastSyncAt: latestToast?.syncedAt.toISOString() ?? null,
        items: rows.map((row) => ({
          externalId: row.externalId,
          name: row.name,
          source: row.source,
          normalizedUnit: row.normalizedUnit ?? undefined,
        })) as IntegrationItem[],
      };
    },
    () => ({
      lastToastSyncAt,
      items: integrationCatalog,
    }),
  );
}

export async function upsertIntegrationItems(items: IntegrationItem[], source: SyncSource) {
  return withPrismaFallback(
    async () => {
      await db.$transaction(
        items.map((item) =>
          db.pilotIntegrationItem.upsert({
            where: {
              source_externalId: {
                source,
                externalId: item.externalId,
              },
            },
            update: {
              name: item.name,
              normalizedUnit: item.normalizedUnit,
              syncedAt: new Date(),
            },
            create: {
              source,
              externalId: item.externalId,
              name: item.name,
              normalizedUnit: item.normalizedUnit,
              syncedAt: new Date(),
            },
          }),
        ),
      );

      const totalCatalogItems = await db.pilotIntegrationItem.count();
      const latestToast =
        source === "TOAST"
          ? await db.pilotIntegrationItem.findFirst({
              where: { source: "TOAST" },
              orderBy: { syncedAt: "desc" },
            })
          : null;

      return {
        source,
        count: items.length,
        totalCatalogItems,
        syncedAt:
          source === "TOAST" ? latestToast?.syncedAt.toISOString() ?? nowIso() : nowIso(),
      };
    },
    () => {
      const existing = new Map(integrationCatalog.map((item) => [`${item.source}:${item.externalId}`, item]));
      for (const item of items) {
        existing.set(`${source}:${item.externalId}`, {
          ...item,
          source,
        });
      }

      integrationCatalog = [...existing.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (source === "TOAST") {
        lastToastSyncAt = nowIso();
      }

      return {
        source,
        count: items.length,
        totalCatalogItems: integrationCatalog.length,
        syncedAt: source === "TOAST" ? lastToastSyncAt : nowIso(),
      };
    },
  );
}

export async function upsertItemMapping(mapping: ItemMapping) {
  return withPrismaFallback(
    async () => {
      const saved = await db.pilotItemMapping.upsert({
        where: {
          source_externalId: {
            source: mapping.source,
            externalId: mapping.externalId,
          },
        },
        update: {
          localItemId: mapping.localItemId,
          localItemName: mapping.localItemName,
          confidence: mapping.confidence,
        },
        create: {
          source: mapping.source,
          externalId: mapping.externalId,
          localItemId: mapping.localItemId,
          localItemName: mapping.localItemName,
          confidence: mapping.confidence,
        },
      });

      return {
        source: saved.source,
        externalId: saved.externalId,
        localItemId: saved.localItemId,
        localItemName: saved.localItemName,
        confidence: saved.confidence,
      } as ItemMapping;
    },
    () => {
      const key = `${mapping.source}:${mapping.externalId}`;
      mappingStore.set(key, mapping);
      return mapping;
    },
  );
}

export async function listMappings(): Promise<ItemMapping[]> {
  return withPrismaFallback(
    async () => {
      const rows = await db.pilotItemMapping.findMany({
        orderBy: [{ source: "asc" }, { externalId: "asc" }],
      });

      return rows.map((row) => ({
        source: row.source,
        externalId: row.externalId,
        localItemId: row.localItemId,
        localItemName: row.localItemName,
        confidence: row.confidence,
      }));
    },
    () => [...mappingStore.values()],
  );
}

export async function listUnmappedIntegrationItems(source: SyncSource): Promise<IntegrationItem[]> {
  const [catalog, mappings] = await Promise.all([getIntegrationCatalog(), listMappings()]);
  const mapped = new Set(
    mappings.filter((entry) => entry.source === source).map((entry) => `${entry.source}:${entry.externalId}`),
  );

  return catalog.items.filter(
    (entry) => entry.source === source && !mapped.has(`${entry.source}:${entry.externalId}`),
  );
}

export async function startSyncRun(source: SyncSource): Promise<SyncRun> {
  return withPrismaFallback(
    async () => {
      const created = await db.pilotSyncRun.create({
        data: {
          source,
          status: "RUNNING",
          startedAt: new Date(),
        },
      });

      return {
        id: created.id,
        source: created.source,
        status: created.status,
        startedAt: created.startedAt.toISOString(),
        finishedAt: created.finishedAt?.toISOString() ?? null,
        importedCount: created.importedCount,
        errorMessage: created.errorMessage,
      };
    },
    () => {
      const run: SyncRun = {
        id: `sync_${Date.now()}`,
        source,
        status: "RUNNING",
        startedAt: nowIso(),
        finishedAt: null,
        importedCount: null,
        errorMessage: null,
      };
      syncRuns.unshift(run);
      return run;
    },
  );
}

export async function finishSyncRun(
  runId: string,
  status: SyncStatus,
  importedCount?: number,
  errorMessage?: string,
): Promise<void> {
  await withPrismaFallback(
    async () => {
      await db.pilotSyncRun.update({
        where: { id: runId },
        data: {
          status,
          importedCount,
          errorMessage,
          finishedAt: new Date(),
        },
      });
    },
    () => {
      const found = syncRuns.find((run) => run.id === runId);
      if (!found) {
        return;
      }

      found.status = status;
      found.importedCount = importedCount ?? null;
      found.errorMessage = errorMessage ?? null;
      found.finishedAt = nowIso();
    },
  );
}

export async function listSyncRuns(source?: SyncSource): Promise<SyncRun[]> {
  return withPrismaFallback(
    async () => {
      const rows = await db.pilotSyncRun.findMany({
        where: source ? { source } : undefined,
        orderBy: { startedAt: "desc" },
        take: 25,
      });

      return rows.map((row) => ({
        id: row.id,
        source: row.source,
        status: row.status,
        startedAt: row.startedAt.toISOString(),
        finishedAt: row.finishedAt?.toISOString() ?? null,
        importedCount: row.importedCount,
        errorMessage: row.errorMessage,
      }));
    },
    () => {
      return source ? syncRuns.filter((run) => run.source === source).slice(0, 25) : syncRuns.slice(0, 25);
    },
  );
}

function escapeCsv(value: string | number): string {
  const raw = String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

export async function exportSessionCsv(sessionId: string): Promise<{ fileName: string; csv: string }> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error("Session was not found.");
  }

  const header = [
    "session_id",
    "location",
    "status",
    "item_id",
    "item_name",
    "unit",
    "par_level",
    "quantity",
    "updated_at",
  ];

  const rows = session.lines.map((line) => [
    escapeCsv(session.id),
    escapeCsv(session.locationName),
    escapeCsv(session.status),
    escapeCsv(line.itemId),
    escapeCsv(line.name),
    escapeCsv(line.unit),
    escapeCsv(line.parLevel),
    escapeCsv(line.quantity),
    escapeCsv(session.updatedAt),
  ]);

  const csv = [header.map(escapeCsv).join(","), ...rows.map((entry) => entry.join(","))].join("\n");
  return {
    fileName: `${session.id}.csv`,
    csv,
  };
}
