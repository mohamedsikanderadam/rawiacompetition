import { SignJWT, jwtVerify } from "jose";

/** Edge-safe session token helpers (no database or Node-only imports) — used by proxy.ts too. */
export const ADMIN_COOKIE = "rawia_admin";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type AdminSession = { id: number; username: string; email: string };

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(admin: AdminSession): Promise<string> {
  return new SignJWT({ username: admin.username, email: admin.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(admin.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined): Promise<AdminSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const id = Number(payload.sub);
    if (!Number.isInteger(id) || typeof payload.email !== "string" || typeof payload.username !== "string") return null;
    return { id, username: payload.username, email: payload.email };
  } catch {
    return null;
  }
}
