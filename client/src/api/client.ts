// Minimal fetch wrapper that attaches the stored bearer token and parses JSON errors.

export class ApiError extends Error {
  code: string;
  details?: unknown;
  status: number;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getToken(): string | null {
  return localStorage.getItem("dcl_token");
}

export function setToken(tok: string | null) {
  if (tok) localStorage.setItem("dcl_token", tok);
  else localStorage.removeItem("dcl_token");
}

// In dev, Vite proxies /api to the backend. In production the SPA is on a
// different origin from the API, so prefix all calls with VITE_API_URL.
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function fullUrl(path: string): string {
  if (!API_BASE) return path;
  return path.startsWith("http") ? path : `${API_BASE}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((init.headers as Record<string, string>) ?? {})
  };
  if (init.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(fullUrl(path), { ...init, headers });
  const ct = res.headers.get("content-type") ?? "";
  const payload: any = ct.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const err = payload && typeof payload === "object" ? payload : {};
    throw new ApiError(res.status, err.code ?? "HTTP_ERROR", err.error ?? `HTTP ${res.status}`, err.details);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body == null ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" })
};

export async function downloadBlob(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(fullUrl(path), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!res.ok) throw new ApiError(res.status, "DOWNLOAD_FAILED", `HTTP ${res.status}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
