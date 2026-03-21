const PROXY_URL = "https://proxy420.appspot.com/";

const CACHE_DB_NAME = "watchwall420.proxy420";
const CACHE_STORE_NAME = "responses";

type ProxyFetchTextArgs = {
  url: string;
  options?: RequestInit;
  ttlMs?: number | null;
};

type CacheEntry = {
  key: string;
  text: string;
  expiresAt: number | null;
};

export async function fetchTextThroughProxy(args: ProxyFetchTextArgs) {
  const cacheKey = getCacheKey(args);
  const cachedText = await getCachedText(cacheKey).catch(() => undefined);
  if (cachedText !== undefined) {
    return cachedText;
  }

  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: args.url,
      options: args.options,
    }),
  });
  const text = await response.text();

  await putCachedText(cacheKey, text, args.ttlMs ?? null).catch(() => undefined);

  return text;
}

export async function clearProxyCache() {
  if (typeof indexedDB === "undefined") {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(CACHE_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB delete blocked."));
  });
}

export async function getApproximateProxyCacheSizeBytes() {
  if (typeof indexedDB === "undefined") {
    return 0;
  }

  const entries = await withStore("readonly", (store) =>
    requestToPromise(store.getAll() as IDBRequest<CacheEntry[]>),
  );

  return entries.reduce(
    (total, entry) => total + entry.key.length * 2 + entry.text.length * 2 + 16,
    0,
  );
}

function getCacheKey(args: ProxyFetchTextArgs) {
  return JSON.stringify({
    url: args.url,
    options: normalizeOptions(args.options),
  });
}

function normalizeOptions(options: RequestInit | undefined) {
  if (!options) return null;

  const normalizedHeaders =
    options.headers instanceof Headers
      ? Object.fromEntries(options.headers.entries())
      : Array.isArray(options.headers)
        ? Object.fromEntries(options.headers)
        : options.headers ?? null;

  return {
    ...options,
    headers: normalizedHeaders,
  };
}

async function getCachedText(key: string) {
  const entry = await withStore("readonly", (store) => requestToPromise(store.get(key)));
  if (!entry) return undefined;

  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    await withStore("readwrite", (store) => requestToPromise(store.delete(key)));
    return undefined;
  }

  return entry.text;
}

async function putCachedText(key: string, text: string, ttlMs: number | null) {
  const expiresAt =
    ttlMs === null || ttlMs === undefined ? null : Date.now() + Math.max(ttlMs, 0);

  await withStore("readwrite", (store) =>
    requestToPromise(
      store.put({
        key,
        text,
        expiresAt,
      } satisfies CacheEntry),
    ),
  );
}

async function withStore<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is not available in this environment.");
  }

  const db = await openCacheDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(CACHE_STORE_NAME);

    action(store).then(resolve).catch(reject);
    transaction.onerror = () => reject(transaction.error);
  });
}

function openCacheDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
