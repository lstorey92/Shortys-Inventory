"use client";

import { useEffect, useMemo, useState } from "react";

type LocationOption = {
  id: string;
  name: string;
  itemCount: number;
};

type SessionLine = {
  itemId: string;
  name: string;
  unit: string;
  parLevel: number;
  quantity: number;
};

type CountSession = {
  id: string;
  locationId: string;
  locationName: string;
  status: "OPEN" | "LOCKED";
  createdAt: string;
  updatedAt: string;
  lines: SessionLine[];
};

type LocalItem = {
  id: string;
  name: string;
  unit: string;
};

type ToastCandidate = {
  source: "TOAST" | "XTRACHEF";
  externalId: string;
  name: string;
  normalizedUnit?: string;
};

type MappingPayload = {
  localItems: LocalItem[];
  toastCandidates: ToastCandidate[];
};

type ScheduleState = {
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

async function loadLocations(): Promise<LocationOption[]> {
  const response = await fetch("/api/count/locations", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load locations");
  }
  const payload = (await response.json()) as { locations: LocationOption[] };
  return payload.locations;
}

async function startSession(locationId: string): Promise<CountSession> {
  const response = await fetch("/api/count/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locationId }),
  });

  if (!response.ok) {
    throw new Error("Failed to start count session");
  }

  const payload = (await response.json()) as { session: CountSession };
  return payload.session;
}

async function patchSession(sessionId: string, body: Record<string, unknown>): Promise<CountSession> {
  const response = await fetch(`/api/count/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Failed to update session");
  }

  const payload = (await response.json()) as { session: CountSession };
  return payload.session;
}

export function InventoryCountClient() {
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [session, setSession] = useState<CountSession | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toastSyncMessage, setToastSyncMessage] = useState<string>("Toast not synced in this session.");
  const [mappingData, setMappingData] = useState<MappingPayload>({ localItems: [], toastCandidates: [] });
  const [mappingChoice, setMappingChoice] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<ScheduleState>({
    enabled: false,
    intervalMinutes: 30,
    nextRunAt: null,
    lastRunAt: null,
    lastError: null,
  });

  useEffect(() => {
    void (async () => {
      try {
        const [next, mappingsResponse, scheduleResponse] = await Promise.all([
          loadLocations(),
          fetch("/api/mappings", { cache: "no-store" }),
          fetch("/api/integrations/toast/schedule", { cache: "no-store" }),
        ]);
        setLocations(next);
        if (next.length > 0) {
          setSelectedLocation(next[0].id);
        }

        if (mappingsResponse.ok) {
          const mappingsPayload = (await mappingsResponse.json()) as {
            localItems: LocalItem[];
            toastCandidates: ToastCandidate[];
          };
          setMappingData({
            localItems: mappingsPayload.localItems ?? [],
            toastCandidates: mappingsPayload.toastCandidates ?? [],
          });
        }

        if (scheduleResponse.ok) {
          const schedulePayload = (await scheduleResponse.json()) as { schedule: ScheduleState };
          setSchedule(schedulePayload.schedule);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredLines = useMemo(() => {
    if (!session) {
      return [];
    }

    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return session.lines;
    }

    return session.lines.filter((line) => line.name.toLowerCase().includes(normalized));
  }, [query, session]);

  const completion = useMemo(() => {
    if (!session || session.lines.length === 0) {
      return 0;
    }
    const entered = session.lines.filter((line) => line.quantity > 0).length;
    return Math.round((entered / session.lines.length) * 100);
  }, [session]);

  async function onCreateSession() {
    if (!selectedLocation) {
      return;
    }

    setError(null);
    try {
      const next = await startSession(selectedLocation);
      setSession(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  }

  async function onQuantityChange(itemId: string, quantity: number) {
    if (!session || Number.isNaN(quantity)) {
      return;
    }

    const optimistic = {
      ...session,
      lines: session.lines.map((line) => (line.itemId === itemId ? { ...line, quantity } : line)),
    };
    setSession(optimistic);

    setSavingItemId(itemId);
    try {
      const updated = await patchSession(session.id, { itemId, quantity });
      setSession(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Autosave failed");
    } finally {
      setSavingItemId(null);
    }
  }

  async function onLockSession() {
    if (!session) {
      return;
    }

    try {
      const locked = await patchSession(session.id, { lock: true });
      setSession(locked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to lock session");
    }
  }

  async function onSyncToast() {
    setError(null);
    try {
      const response = await fetch("/api/integrations/toast/sync", {
        method: "POST",
      });
      const payload = (await response.json()) as { success: boolean; stats?: { count: number }; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Toast sync failed");
      }

      setToastSyncMessage(`Toast sync complete. Imported ${payload.stats?.count ?? 0} items.`);

      const mappingsResponse = await fetch("/api/mappings", { cache: "no-store" });
      if (mappingsResponse.ok) {
        const mappingsPayload = (await mappingsResponse.json()) as {
          localItems: LocalItem[];
          toastCandidates: ToastCandidate[];
        };
        setMappingData({
          localItems: mappingsPayload.localItems ?? [],
          toastCandidates: mappingsPayload.toastCandidates ?? [],
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Toast sync failed";
      setToastSyncMessage(`Toast sync failed: ${message}`);
      setError(message);
    }
  }

  function onExportCsv() {
    if (!session) {
      return;
    }
    window.location.assign(`/api/count/sessions/${session.id}/export`);
  }

  async function onSaveMapping(candidate: ToastCandidate) {
    const selectedLocal = mappingChoice[candidate.externalId];
    if (!selectedLocal) {
      return;
    }

    const localItem = mappingData.localItems.find((entry) => entry.id === selectedLocal);
    if (!localItem) {
      return;
    }

    try {
      const response = await fetch("/api/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "TOAST",
          externalId: candidate.externalId,
          localItemId: localItem.id,
          localItemName: localItem.name,
          confidence: 100,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save mapping");
      }

      setMappingData((current) => ({
        ...current,
        toastCandidates: current.toastCandidates.filter((entry) => entry.externalId !== candidate.externalId),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mapping");
    }
  }

  async function onUpdateSchedule(nextEnabled: boolean, runNow = false) {
    try {
      const response = await fetch("/api/integrations/toast/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: nextEnabled,
          intervalMinutes: schedule.intervalMinutes,
          runNow,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update schedule");
      }

      const payload = (await response.json()) as { schedule: ScheduleState };
      setSchedule(payload.schedule);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update schedule");
    }
  }

  async function onIntervalChange(intervalMinutes: number) {
    setSchedule((current) => ({ ...current, intervalMinutes }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur sm:p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Shorty&apos;s Inventory Pilot</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mobile-first count workflow with autosave, multi-location support, and API-ready integration rails.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        ) : null}

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading locations...</p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
              Location
              <select
                className="h-12 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-offset-2 transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                value={selectedLocation}
                onChange={(event) => setSelectedLocation(event.target.value)}
              >
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.itemCount} items)
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="h-12 rounded-xl bg-orange-600 px-5 text-base font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onCreateSession}
              disabled={!selectedLocation}
            >
              Start or Resume Count
            </button>

            <button
              type="button"
              className="h-12 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              onClick={onSyncToast}
            >
              Sync Toast Menu
            </button>
          </div>
        )}

        <p className="mt-3 text-xs font-medium text-slate-500">{toastSyncMessage}</p>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Toast Sync Schedule</h2>
            <p className="text-sm text-slate-500">
              Last run: {schedule.lastRunAt ?? "Never"} | Next run: {schedule.nextRunAt ?? "Not scheduled"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600">
              Interval (min)
              <input
                type="number"
                min={5}
                max={1440}
                value={schedule.intervalMinutes}
                onChange={(event) => onIntervalChange(Number(event.target.value))}
                className="ml-2 h-10 w-24 rounded-lg border border-slate-300 px-2"
              />
            </label>
            <button
              type="button"
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700"
              onClick={() => onUpdateSchedule(!schedule.enabled)}
            >
              {schedule.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              className="h-10 rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white"
              onClick={() => onUpdateSchedule(schedule.enabled, true)}
            >
              Run Now
            </button>
          </div>
        </div>

        {schedule.lastError ? (
          <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {schedule.lastError}
          </p>
        ) : null}
      </section>

      {session ? (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Session {session.id} - {session.locationName}
              </h2>
              <p className="text-sm text-slate-500">
                Status: {session.status} | Progress: {completion}%
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                onClick={onExportCsv}
              >
                Export CSV
              </button>

              <button
                type="button"
                className="h-11 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onLockSession}
                disabled={session.status === "LOCKED"}
              >
                Lock Session
              </button>
            </div>
          </div>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            Search item
            <input
              type="search"
              placeholder="e.g. mozzarella"
              className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none ring-offset-2 transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="mt-4 space-y-3">
            {filteredLines.map((line) => (
              <article key={line.itemId} className="rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{line.name}</h3>
                    <p className="text-sm text-slate-500">
                      Par: {line.parLevel} {line.unit}
                    </p>
                  </div>

                  <label className="text-sm text-slate-600">
                    Count
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      inputMode="decimal"
                      className="mt-1 h-11 w-full min-w-32 rounded-xl border border-slate-300 px-3 text-base text-slate-900 outline-none ring-offset-2 transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                      value={line.quantity}
                      onChange={(event) => onQuantityChange(line.itemId, Number(event.target.value))}
                      disabled={session.status === "LOCKED"}
                    />
                  </label>

                  <p className="text-sm text-slate-500">
                    {savingItemId === line.itemId ? "Saving..." : "Saved"}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Toast Item Mapping</h2>
          <p className="text-sm text-slate-500">Pending: {mappingData.toastCandidates.length}</p>
        </div>

        <div className="mt-4 space-y-3">
          {mappingData.toastCandidates.slice(0, 12).map((candidate) => (
            <article key={candidate.externalId} className="rounded-xl border border-slate-200 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{candidate.name}</p>
                  <p className="text-xs text-slate-500">External ID: {candidate.externalId}</p>
                </div>

                <select
                  className="h-10 min-w-52 rounded-lg border border-slate-300 px-2 text-sm"
                  value={mappingChoice[candidate.externalId] ?? ""}
                  onChange={(event) =>
                    setMappingChoice((current) => ({
                      ...current,
                      [candidate.externalId]: event.target.value,
                    }))
                  }
                >
                  <option value="">Select local item</option>
                  {mappingData.localItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.unit})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="h-10 rounded-lg bg-orange-600 px-3 text-sm font-semibold text-white"
                  onClick={() => onSaveMapping(candidate)}
                >
                  Map
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
