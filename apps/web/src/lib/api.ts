/**
 * Authenticated HTTP client built on top of native `fetch`.
 *
 * Automatically injects `Authorization: Bearer <client token>` so callers
 * never have to touch `client.authStore` directly.
 */
import client from "./client";

type ApiError = { error?: string; message?: string };
type RequestOptions = RequestInit & { timeoutMs?: number };

function normalizePath(path: string): string {
  if (!path) return path;
  // Absolute URL (http/https) or protocol-relative URL
  if (/^(https?:)?\/\//i.test(path)) return path;
  // Already absolute in current origin
  if (path.startsWith("/")) return path;
  // Prevent accidental relative fetch from nested routes (e.g. /settings/api/...)
  return `/${path}`;
}

function isJsonResponse(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.includes("application/json") || contentType.includes("+json");
}

async function performRequest<T = void>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, headers: customHeaders, ...rest } = init;
  const normalizedPath = normalizePath(path);

  async function doFetch(url: string) {
    const headers = new Headers(customHeaders);
    if (!headers.has("Authorization") && client.authStore.token)
      headers.set("Authorization", `Bearer ${client.authStore.token}`);
    if (!headers.has("Content-Type") && !(rest.body instanceof FormData))
      headers.set("Content-Type", "application/json");
    return fetch(url, {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  }

  let res = await doFetch(normalizedPath);

  // Dev fallback: if /api resolves to app-shell HTML, retry against
  // Monline directly to bypass proxy/base-path mismatch.
  const firstContentType = res.headers.get("content-type") || "";
  const isLocalDevHost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  if (
    isLocalDevHost &&
    normalizedPath.startsWith("/api/") &&
    firstContentType.includes("text/html")
  ) {
    try {
      res = await doFetch(`http://localhost:8080${normalizedPath}`);
    } catch (_) {
      // Keep original response if direct retry fails
    }
  }

  const contentType = res.headers.get("content-type");

  if (!res.ok) {
    if (isJsonResponse(contentType)) {
      const data: ApiError = await res.json().catch(() => ({}));
      throw Object.assign(new Error(data.error ?? data.message ?? `HTTP ${res.status}`), {
        status: res.status,
        response: data,
      });
    }

    const raw = await res.text().catch(() => "");
    const snippet = raw.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(`HTTP ${res.status} (${contentType ?? "unknown"}) ${snippet}`);
  }

  // 204 No Content — nothing to parse
  if (res.status === 204) return undefined as T;

  if (!isJsonResponse(contentType)) {
    const raw = await res.text().catch(() => "");
    const snippet = raw.slice(0, 120).replace(/\s+/g, " ");
    throw new Error(
      `Expected JSON but received ${contentType ?? "unknown"} for ${res.url || normalizedPath}: ${snippet}`,
    );
  }

  return res.json() as Promise<T>;
}

async function request<T = void>(
  path: string,
  options: RequestOptions & { json?: unknown } = {},
): Promise<T> {
  const { timeoutMs = 30_000, signal, ...init } = options;
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Request timed out", "TimeoutError")),
    timeoutMs,
  );
  try {
    // Keep the deadline active while reading the response body as well.
    return await performRequest<T>(path, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export const api = {
  get: <T = void>(path: string, init?: RequestOptions) =>
    request<T>(path, { method: "GET", ...init }),
  post: <T = void>(path: string, json?: unknown, init?: RequestOptions) =>
    request<T>(path, { method: "POST", json, ...init }),
  put: <T = void>(path: string, json?: unknown, init?: RequestOptions) =>
    request<T>(path, { method: "PUT", json, ...init }),
  patch: <T = void>(path: string, json?: unknown, init?: RequestOptions) =>
    request<T>(path, { method: "PATCH", json, ...init }),
  del: <T = void>(path: string, init?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...init }),

  /**
   * Multipart/form-data upload — omits `Content-Type` so the browser sets
   * the boundary automatically.
   */
  postForm: <T = void>(path: string, body: FormData, init?: RequestOptions): Promise<T> =>
    request<T>(path, { method: "POST", body, ...init }),
};
