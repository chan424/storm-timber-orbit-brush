import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/lib/auth/server";
import { normalizeEmail, roleForEmail, studentIdFromEmail } from "@/lib/lab/access";

const MAX_BYTES = 4_000_000;

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

export const Route = createFileRoute("/api/viva-video")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const who = await caller(request);
        if (!who || who.role !== "student") return new Response("Unauthorized", { status: 401 });
        const form = await request.formData();
        const questionId = Number(form.get("questionId"));
        const file = form.get("file");
        if (!Number.isInteger(questionId) || !(file instanceof File)) {
          return new Response("Missing recording", { status: 400 });
        }
        if (file.size < 1 || file.size > MAX_BYTES) {
          return new Response("Keep the recording under 45 seconds.", { status: 413 });
        }
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const papers = await sql<{ question_ids: string }>`
          select question_ids from viva_papers where user_id = ${who.userId}
        `;
        let ids: number[] = [];
        try {
          const parsed = JSON.parse(papers[0]?.question_ids ?? "[]") as unknown;
          if (Array.isArray(parsed)) ids = parsed.map((item) => Number(item));
        } catch {
          ids = [];
        }
        if (!ids.includes(questionId)) return new Response("That question is not on your viva.", { status: 403 });
        const kinds = await sql<{ kind: string }>`select kind from viva_questions where id = ${questionId}`;
        if (kinds[0]?.kind !== "oral") return new Response("Only a spoken question is recorded.", { status: 400 });
        const video = Buffer.from(await file.arrayBuffer()).toString("base64");
        const videoType = file.type || "video/webm";
        await sql`
          insert into viva_answers (user_id, question_id, video, video_type, updated_at)
          values (${who.userId}, ${questionId}, ${video}, ${videoType}, now())
          on conflict (user_id, question_id) do update set
            video = excluded.video,
            video_type = excluded.video_type,
            updated_at = now()
        `;
        return Response.json({ ok: true });
      },
      GET: async ({ request }) => {
        const who = await caller(request);
        if (!who) return new Response("Unauthorized", { status: 401 });
        const url = new URL(request.url);
        const questionId = Number(url.searchParams.get("questionId"));
        const studentId = url.searchParams.get("studentId")?.trim() ?? "";
        if (!Number.isInteger(questionId)) return new Response("Missing question", { status: 400 });
        const { getSql } = await import("@/lib/db");
        const sql = await getSql();
        const targetId = who.role === "admin" ? studentId : who.studentId;
        if (!targetId) return new Response("Missing student", { status: 400 });
        if (who.role === "student" && studentId && studentId !== who.studentId) {
          return new Response("Unauthorized", { status: 401 });
        }
        const papers = await sql<{ user_id: string }>`
          select user_id from viva_papers where student_id = ${targetId}
        `;
        const userId = papers[0]?.user_id;
        if (!userId) return new Response("Not found", { status: 404 });
        const rows = await sql<{ video: string | null; video_type: string | null }>`
          select video, video_type from viva_answers
          where user_id = ${userId} and question_id = ${questionId}
        `;
        const video = rows[0]?.video;
        if (!video) return new Response("Not found", { status: 404 });
        const bytes = new Uint8Array(Buffer.from(video, "base64"));
        return new Response(bytes, {
          headers: {
            "Content-Type": rows[0]?.video_type || "video/webm",
            "Cache-Control": "private, max-age=60",
          },
        });
      },
    },
  },
});
