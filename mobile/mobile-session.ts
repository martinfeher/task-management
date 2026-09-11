export type MobileTask = {
  id: string;
  name: string;
  completed: boolean;
  dueDate: string | null;
  recurrenceRule: string | null;
  listId: string;
};

const API_DEDUPE_MS = 5_000;
const LIST_SNAPSHOT_TTL_MS = 30_000;

export type MobileListSnapshot = {
  listId: string;
  listTitle: string;
  tasks: MobileTask[];
  fetchedAt: number;
};

type ApiDedupeStore = {
  inFlight: Map<string, Promise<unknown>>;
  recent: Map<string, { value: unknown; fetchedAt: number }>;
};

type MobileGlobalStore = {
  apiDedupe: ApiDedupeStore;
  listSnapshot: MobileListSnapshot | null;
  loadInFlight: Promise<void> | null;
};

const STORE_KEY = "__todolistMobileStore";

function getStore(): MobileGlobalStore {
  const globalScope = globalThis as typeof globalThis & {
    [STORE_KEY]?: MobileGlobalStore;
  };

  if (!globalScope[STORE_KEY]) {
    globalScope[STORE_KEY] = {
      apiDedupe: {
        inFlight: new Map(),
        recent: new Map(),
      },
      listSnapshot: null,
      loadInFlight: null,
    };
  }

  return globalScope[STORE_KEY];
}

export function readMobileListSnapshot(): MobileListSnapshot | null {
  const snapshot = getStore().listSnapshot;
  if (!snapshot) return null;

  if (Date.now() - snapshot.fetchedAt > LIST_SNAPSHOT_TTL_MS) {
    getStore().listSnapshot = null;
    return null;
  }

  return snapshot;
}

export function writeMobileListSnapshot(snapshot: MobileListSnapshot) {
  getStore().listSnapshot = snapshot;
}

export function clearMobileListSnapshot(listId?: string) {
  const store = getStore();

  if (!listId || store.listSnapshot?.listId === listId) {
    store.listSnapshot = null;
  }

  if (listId) {
    store.apiDedupe.recent.delete(`tasks:list:${listId}`);
    store.apiDedupe.inFlight.delete(`tasks:list:${listId}`);
    return;
  }

  store.apiDedupe.recent.clear();
  store.apiDedupe.inFlight.clear();
}

export async function dedupeMobileRequest<T>(
  cacheKey: string,
  request: () => Promise<T>,
): Promise<T> {
  const { apiDedupe } = getStore();
  const inFlight = apiDedupe.inFlight.get(cacheKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const recent = apiDedupe.recent.get(cacheKey);
  if (recent && Date.now() - recent.fetchedAt < API_DEDUPE_MS) {
    return recent.value as T;
  }

  const promise = request()
    .then((value) => {
      apiDedupe.recent.set(cacheKey, {
        value,
        fetchedAt: Date.now(),
      });
      return value;
    })
    .finally(() => {
      if (apiDedupe.inFlight.get(cacheKey) === promise) {
        apiDedupe.inFlight.delete(cacheKey);
      }
    });

  apiDedupe.inFlight.set(cacheKey, promise);
  return promise;
}

export function getMobileLoadInFlight() {
  return getStore().loadInFlight;
}

export function setMobileLoadInFlight(promise: Promise<void> | null) {
  getStore().loadInFlight = promise;
}
