// MandateSeal admin auth — single shared password mode (MVP).
//
//   env MANDATESEAL_ADMIN_PASSWORD = the password
//   env MANDATESEAL_SESSION_SECRET = signing secret for the session cookie
//
// If MANDATESEAL_ADMIN_PASSWORD is empty/unset, the dashboard is OPEN
// (development mode).
//
// Session cookie format: `<random-token>.<hmac-sha256(token, secret)>`.
// We don't keep server state — the HMAC self-validates the token.
//
// IMPORTANT: this file is imported from Next.js middleware (Edge runtime), so
// it must only use Web-standard crypto APIs. No `node:crypto`.

export const SESSION_COOKIE = "mandateseal_session";

function getSessionSecret(): string {
  const s = process.env.MANDATESEAL_SESSION_SECRET;
  if (s && s.length >= 8) return s;
  return process.env.MANDATESEAL_ADMIN_PASSWORD ?? "mandateseal-dev-secret";
}

export function isAuthEnabled(): boolean {
  return !!process.env.MANDATESEAL_ADMIN_PASSWORD;
}

function ctEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function bytesToHex(buf: ArrayBuffer): string {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += arr[i].toString(16).padStart(2, "0");
  return s;
}

async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return bytesToHex(sig);
}

export function checkPassword(input: string): boolean {
  const expected = process.env.MANDATESEAL_ADMIN_PASSWORD ?? "";
  if (!expected) return true;
  return ctEqual(input, expected);
}

export async function issueSessionToken(): Promise<string> {
  const rand = new Uint8Array(24);
  crypto.getRandomValues(rand);
  const token = bytesToHex(rand.buffer);
  const mac = await hmacHex(getSessionSecret(), token);
  return `${token}.${mac}`;
}

export async function isValidSession(cookieValue: string | undefined | null): Promise<boolean> {
  if (!isAuthEnabled()) return true;
  if (!cookieValue) return false;
  const dot = cookieValue.indexOf(".");
  if (dot < 1) return false;
  const token = cookieValue.slice(0, dot);
  const mac = cookieValue.slice(dot + 1);
  const expected = await hmacHex(getSessionSecret(), token);
  return ctEqual(mac, expected);
}
