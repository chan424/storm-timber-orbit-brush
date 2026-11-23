import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { normalizeEmail, roleForEmail, studentIdFromEmail } from "@/lib/lab/access";

const MAX_BYTES = 12_000_000;

async function caller(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) return null;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from "user" where id = ${session.user.id}`;
  const email = normalizeEmail(rows[0]?.email ?? session.user.email ?? "");
  const role = roleForEmail(email);
  if (!role) return null;
  return { userId: session.user.id, email, role, studentId: studentIdFromEmail(email) };
}

function kindOf(value: string | null): "mini" | "major" | null {
  if (value === "mini" || value === "major") return value;
  return null;
}

export const Route = createFileRoute("/api/project-zip")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const who = await caller(request);
        if (!who || who.role !== "student") return new Response("Unauthorized", { status: 401 });
        const form = await request.formData();
        const kind = kindOf(String(form.get("kind") ?? ""));
        const file = form.get("file");
        if (!kind || !(file instanceof File)) return new Response("Choose a zip file.", { status: 400 });
        const filename = file.name.trim().slice(0, 180);
        if (!filename.toLowerCase().endsWith(".zip")) return new Response("Upload a .zip file.", { status: 400 });
        if (file.size < 1 || file.size > MAX_BYTES) return new Response("Keep the zip under 12 MB.", { status: 413 });
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const body = Buffer.from(await file.arrayBuffer()).toString("base64");
        await sql`
          insert into project_uploads (user_id, student_id, email, kind, filename, bytes, body, updated_at)
          values (${who.userId}, ${who.studentId}, ${who.email}, ${kind}, ${filename}, ${file.size}, ${body}, now())
          on conflict (user_id, kind) do update set
            student_id = excluded.student_id,
            email = excluded.email,
            filename = excluded.filename,
            bytes = excluded.bytes,
            body = excluded.body,
            updated_at = now()
        `;
        return Response.json({ ok: true, filename, bytes: file.size });
      },
      GET: async ({ request }) => {
        const who = await caller(request);
        if (!who) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const kind = kindOf(url.searchParams.get("kind"));
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        if (!kind) {
          if (who.role === "admin") {
            const rows = await sql<{ student_id: string; email: string; kind: string; filename: string; bytes: number }>`
              select student_id, email, kind, filename, bytes
              from project_uploads
              order by student_id, kind
            `;
            return Response.json({ uploads: rows });
          }
          const rows = await sql<{ kind: string; filename: string; bytes: number }>`
            select kind, filename, bytes from project_uploads where user_id = ${who.userId}
          `;
          return Response.json({ uploads: rows });
        }
        const studentId = who.role === "admin" ? (url.searchParams.get("studentId")?.trim() || who.studentId) : who.studentId;
        if (!studentId) return new Response("Missing student", { status: 400 });
        const rows = await sql<{ filename: string; body: string }>`
          select filename, body from project_uploads
          where student_id = ${studentId} and kind = ${kind}
        `;
        const row = rows[0];
        if (!row) return new Response("Not found", { status: 404 });
        const bytes = Buffer.from(row.body, "base64");
        return new Response(bytes, {
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${row.filename.replace(/"/g, "")}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
