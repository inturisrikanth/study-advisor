import { supabaseClient as supabase } from "../../../../lib/supabaseClient";

export function newClientTurnToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Attach Supabase Bearer token automatically
async function authHeaders(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

export async function postJSON<T>(url: string, body?: any): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { status: res.status, data });
  return data as T;
}

export async function getJSON<T>(url: string): Promise<T> {
  const headers = { ...(await authHeaders()) };
  const res = await fetch(url, { headers });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data?.error || "Request failed"), { status: res.status, data });
  return data as T;
}
