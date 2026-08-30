const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export function apiHref(path: string): string {
  return `${baseUrl}${path}`;
}

export class ApiError extends Error {
  public constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const csrfToken = typeof document === "undefined" ? null : readCookie("tn_csrf");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken ? { "x-csrf-token": csrfToken } : {}),
      ...(init.headers || {}),
    },
  });
  const body = response.headers.get("content-type")?.includes("application/json")
    ? await response.json()
    : await response.text();
  if (!response.ok) {
    const error = typeof body === "object" && body && "error" in body
      ? (body as { error: { code?: string; message?: string } }).error
      : {};
    throw new ApiError(response.status, error.code || "REQUEST_FAILED", error.message || "La demande n'a pas abouti.");
  }
  return body as T;
}

export function readCookie(name: string): string | null {
  const prefix = `${name}=`;
  const entry = document.cookie.split("; ").find((item) => item.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}
