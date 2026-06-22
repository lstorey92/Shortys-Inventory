import { performToastSync } from "@/lib/integrations/toast-sync-service";

type ScheduleState = {
  enabled: boolean;
  intervalMinutes: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
};

const state: ScheduleState = {
  enabled: false,
  intervalMinutes: 30,
  nextRunAt: null,
  lastRunAt: null,
  lastError: null,
};

let timer: NodeJS.Timeout | null = null;

function computeNextRun(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

async function executeRun() {
  try {
    await performToastSync();
    state.lastRunAt = new Date().toISOString();
    state.lastError = null;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : "Toast scheduled sync failed";
  } finally {
    if (state.enabled) {
      state.nextRunAt = computeNextRun(state.intervalMinutes);
    }
  }
}

function clearExistingTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function getToastScheduleState() {
  return { ...state };
}

export function setToastSchedule(enabled: boolean, intervalMinutes: number) {
  clearExistingTimer();
  state.enabled = enabled;
  state.intervalMinutes = intervalMinutes;

  if (!enabled) {
    state.nextRunAt = null;
    return getToastScheduleState();
  }

  state.nextRunAt = computeNextRun(intervalMinutes);
  timer = setInterval(() => {
    void executeRun();
  }, intervalMinutes * 60 * 1000);

  return getToastScheduleState();
}

export async function runToastSyncNow() {
  await executeRun();
  return getToastScheduleState();
}
