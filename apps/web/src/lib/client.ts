import type { User } from "@/types";

type QueryOptions = {
  owner?: string;
  filter?: string;
  sort?: string;
  expand?: string;
  fields?: string;
  signal?: AbortSignal;
};
type Page<T> = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};
type Session = { token: string; record: User; remember: boolean };
type Listener = (token: string, model: unknown) => void;
const SESSION_KEY = "monline_session";
const listeners = new Set<Listener>();
let current: Session | null = null;
try {
  current = JSON.parse(
    sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || "null",
  ) as Session | null;
} catch {
  /* Storage may be unavailable. */
}
function publish(value: Session | null) {
  current = value;
  try {
    if (value?.remember) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
      sessionStorage.removeItem(SESSION_KEY);
    } else {
      localStorage.removeItem(SESSION_KEY);
      if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
      else sessionStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* Keep an in-memory session. */
  }
  for (const listener of listeners) listener(value?.token || "", value?.record || null);
}
window.addEventListener("storage", (event) => {
  if (event.key !== SESSION_KEY) return;
  if (event.storageArea !== localStorage || (current && !current.remember)) return;
  try {
    current = JSON.parse(event.newValue || "null") as Session | null;
  } catch {
    current = null;
  }
  for (const listener of listeners) listener(current?.token || "", current?.record || null);
});
export class ClientError extends Error {
  status: number;
  response: { message?: string; error?: string; data?: Record<string, unknown> };
  constructor(status: number, response: ClientError["response"]) {
    super(response.message || response.error || `HTTP ${status}`);
    this.status = status;
    this.response = response;
  }
}
async function send<T>(
  url: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController(),
    abort = () => controller.abort(options.signal?.reason);
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const form = options.body instanceof FormData;
    const headers = new Headers();
    if (current?.token) headers.set("Authorization", `Bearer ${current.token}`);
    if (options.body !== undefined && !form) headers.set("Content-Type", "application/json");
    const response = await fetch(url, {
      method: options.method || "GET",
      headers,
      credentials: "same-origin",
      body: form
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      signal: controller.signal,
    });
    const result = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new ClientError(response.status, result || {});
    return result as T;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
function queryString(options: QueryOptions, page: number, perPage: number) {
  const query = new URLSearchParams({ page: String(page), perPage: String(perPage) });
  for (const field of ["filter", "sort", "expand", "fields"] as const) {
    const value = options[field];
    if (value) query.set(field, value);
  }
  if (options.owner) query.set("owner", options.owner);
  return query;
}
type FileRecord = { id: string; collectionId?: string; collectionName?: string };
function fileUrl(
  record: FileRecord,
  filename: string,
  options: { token?: string; thumb?: string } = {},
) {
  const url = `/api/files/${encodeURIComponent(record.collectionName || record.collectionId || "")}/${encodeURIComponent(record.id)}/${encodeURIComponent(filename)}`;
  return options.token ? `${url}?token=${encodeURIComponent(options.token)}` : url;
}
const client = {
  baseUrl: typeof window !== "undefined" ? window.location.origin : "http://localhost:8080",
  authStore: {
    get isValid() {
      return !!current?.token && !!current?.record?.id;
    },
    get token() {
      return current?.token || "";
    },
    get model() {
      return current?.record || null;
    },
    clear() {
      publish(null);
    },
    save(token: string, record: User, remember = false) {
      publish({ token, record, remember });
    },
    onChange(callback: Listener, fireImmediately = false) {
      listeners.add(callback);
      if (fireImmediately) callback(current?.token || "", current?.record || null);
      return () => {
        listeners.delete(callback);
      };
    },
  },
  send,
  filter(expression: string, params: Record<string, unknown>) {
    return expression.replace(/\{:(\w+)\}/g, (_, key: string) =>
      JSON.stringify(params[key] ?? null),
    );
  },
  collection(name: string) {
    const base = `/api/data/${encodeURIComponent(name)}`;
    return {
      getOne: <T>(id: string, options: QueryOptions = {}) =>
        send<T>(`${base}/${encodeURIComponent(id)}?${queryString(options, 1, 1)}`, options),
      getList: <T = Record<string, unknown>>(page = 1, perPage = 30, options: QueryOptions = {}) =>
        send<Page<T>>(`${base}?${queryString(options, page, perPage)}`, options),
      async getFullList<T>(options: QueryOptions = {}): Promise<T[]> {
        const items: T[] = [];
        let page = 1;
        for (;;) {
          const result = await send<Page<T>>(`${base}?${queryString(options, page, 500)}`, options);
          items.push(...result.items);
          if (page >= result.totalPages) return items;
          page++;
        }
      },
      create: <T>(body: unknown) => send<T>(base, { method: "POST", body }),
      update: <T>(id: string, body: unknown) =>
        send<T>(`${base}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
      delete: (id: string) => send<void>(`${base}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    };
  },
  files: {
    getUrl: fileUrl,
    getURL: fileUrl,
    getToken: async () =>
      (await send<{ token: string }>("/api/auth/file-token", { method: "POST" })).token,
  },
};
export default client;
