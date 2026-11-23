import { randomBytes, randomUUID } from "node:crypto";
import { auth, SESSION_TOKEN_COOKIE } from "@/lib/auth/server";

const RETURN_ORIGINS = new Set(["https://dataong.in", "https://www.dataong.in"]);

export function canonicalOrigin(): string | null {
  const raw = process.env.BETTER_AUTH_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function allowedReturn(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!RETURN_ORIGINS.has(url.origin)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function requestHost(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return forwarded.split(",")[0]?.trim().toLowerCase().replace(/:\d+$/, "") ?? "";
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return trimmed.slice(eq + 1);
  }
  return null;
}

export async function startGoogle(request: Request): Promise<Response> {
  const canonical = canonicalOrigin();
  const back = allowedReturn(new URL(request.url).searchParams.get("return"));
  if (!canonical || !back) return new Response("Google sign-in cannot start from this address.", { status: 400 });
  // Do not bounce to the canonical host here. On the published site that host
  // header does not match the public address, so the bounce redirected to itself.
  const done = new URL("/api/lab/oauth-done", canonical);
  done.searchParams.set("return", back);
  const apiRes = await auth.api.signInWithOAuth2({
    body: {
      providerId: "grok-google",
      callbackURL: done.toString(),
      errorCallbackURL: `${back}/?error=google`,
    },
    headers: request.headers,
    asResponse: true,
  });
  if (!apiRes.ok) {
    return Response.redirect(`${back}/?error=google`, 302);
  }
  const body = (await apiRes.json().catch(() => null)) as { url?: string } | null;
  if (!body?.url) return Response.redirect(`${back}/?error=google`, 302);
  const headers = new Headers({ location: body.url, "cache-control": "no-store" });
  for (const cookie of apiRes.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return new Response(null, { status: 302, headers });
}

export async function finishGoogle(request: Request): Promise<Response> {
  const canonical = canonicalOrigin();
  const back = allowedReturn(new URL(request.url).searchParams.get("return"));
  if (!canonical || !back) return Response.redirect("https://dataong.in/?error=google", 302);
  const session = await auth.api.getSession({ headers: request.headers });
  const token = readCookie(request, SESSION_TOKEN_COOKIE);
  if (!session?.user || !token || /[\s;,]/.test(token)) {
    return Response.redirect(`${back}/?error=google`, 302);
  }
  const code = randomBytes(32).toString("base64url");
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const expires = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  await sql`
    insert into "verification" ("id", "identifier", "value", "expiresAt", "createdAt", "updatedAt")
    values (${randomUUID()}, ${`lab-handoff:${code}`}, ${token}, ${expires}, now(), now())
  `;
  return Response.redirect(`${back}/?handoff=${encodeURIComponent(code)}`, 302);
}

export async function claimGoogle(request: Request): Promise<Response> {
  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    if (typeof body.code === "string") code = body.code;
  } catch {
    code = "";
  }
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(code)) return new Response("Missing code", { status: 400 });
  const origin = request.headers.get("origin") ?? "";
  const host = requestHost(request);
  const onCollegeSite =
    RETURN_ORIGINS.has(origin) || host === "dataong.in" || host === "www.dataong.in";
  if (!onCollegeSite) return new Response("Wrong host", { status: 400 });
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ value: string; expiresAt?: string | Date; expiresat?: string | Date }>`
    delete from "verification"
    where "identifier" = ${`lab-handoff:${code}`}
    returning "value", "expiresAt"
  `;
  const row = rows[0];
  const expiresAt = row ? new Date(row.expiresAt ?? row.expiresat ?? 0).getTime() : 0;
  if (!row || !Number.isFinite(expiresAt) || expiresAt < Date.now() || /[\s;,]/.test(row.value)) {
    return new Response("This Google sign-in expired. Try again.", { status: 400 });
  }
  const headers = new Headers({
    "content-type": "application/json",
    "cache-control": "no-store",
    "set-auth-token": row.value,
  });
  headers.append(
    "set-cookie",
    `${SESSION_TOKEN_COOKIE}=${row.value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=604800`,
  );
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
