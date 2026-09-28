import { createHmac, timingSafeEqual } from "node:crypto";
import type { StaffUser } from "./api/types";

// No Next request APIs here so the proxy can import it too.

export const STAFF_COOKIE = "cq_staff";

export interface StaffPayload {
  user: StaffUser;
  token: string;
  exp: number;
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return "dev-only-insecure-secret";
}

export function signToken(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyToken(value: string | undefined): StaffPayload | null {
  if (!value) return null;
  const [body, mac] = value.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StaffPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** Sections only administrators may open. */
export const ADMIN_PREFIXES = ["/app/operations", "/app/audit", "/app/config"];
