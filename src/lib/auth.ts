import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { ADMIN_COOKIE, SESSION_TTL_SECONDS, createSessionToken, verifySessionToken, type AdminSession } from "./session-token";

export { ADMIN_COOKIE, verifySessionToken, type AdminSession };

/** Reads the admin session from the request cookies (server components / actions / route handlers). */
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}

export async function requireAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function setSessionCookie(admin: AdminSession): Promise<void> {
  const store = await cookies();
  store.set(ADMIN_COOKIE, await createSessionToken(admin), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

// A real bcrypt hash of a random string; compared against when the username is unknown so
// login timing doesn't reveal whether an account exists.
const DUMMY_HASH = "$2a$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW";

export async function verifyCredentials(username: string, password: string): Promise<AdminSession | null> {
  const normalised = username.trim().toLowerCase();
  const rows = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.username, normalised)).limit(1);
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return null;
  return { id: user.id, username: user.username, email: user.email };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
