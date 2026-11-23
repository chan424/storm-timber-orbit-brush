import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { roleForEmail, normalizeEmail } from "@/lib/lab/access";
import { LABS, labBySlug, type LabDef } from "@/lib/lab/catalog";
import type { Lang } from "@/lib/lab/types";

export type LabCard = LabDef & { earned: number | null };

function parseAims(raw: string, fallback: LabDef["aims"]): LabDef["aims"] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 5) return fallback;
    const aims = parsed.map((item) => String(item ?? "").trim());
    if (aims.some((aim) => aim.length < 3 || aim.length > 300)) return fallback;
    return aims as LabDef["aims"];
  } catch {
    return fallback;
  }
}

async function mergedLabs(): Promise<LabDef[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ slug: string; title: string; blurb: string; language: string; aims: string }>`
    select slug, title, blurb, language, aims from lab_catalog
  `;
  const saved = new Map(rows.map((row) => [row.slug, row]));
  return LABS.map((lab) => {
    const row = saved.get(lab.slug);
    if (!row) return lab;
    const language = row.language === "c" || row.language === "cpp" || row.language === "python" || row.language === "java"
      ? row.language
      : lab.language;
    return {
      ...lab,
      title: row.title.trim().slice(0, 80) || lab.title,
      blurb: row.blurb.trim().slice(0, 280) || lab.blurb,
      language,
      aims: parseAims(row.aims, lab.aims),
    };
  });
}

export const listLabs = createServerFn({ method: "GET" }).handler(async (): Promise<LabDef[]> => {
  return mergedLabs();
});

export const labProgress = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Array<{ slug: string; earned: number }>> => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ lab: string; earned: unknown }>`
      select lab, coalesce(sum(awarded_marks), 0) as earned
      from lab_submissions
      where user_id = ${context.userId}
      group by lab
    `;
    return rows.map((row) => ({
      slug: row.lab,
      earned: Number(row.earned) || 0,
    }));
  });

export const saveLab = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Invalid lab.");
    const body = input as Record<string, unknown>;
    const slug = String(body.slug ?? "");
    const base = labBySlug(slug);
    if (!base) throw new Error("Unknown lab.");
    const title = String(body.title ?? "").trim();
    const blurb = String(body.blurb ?? "").trim();
    const language = String(body.language ?? "");
    const aims = Array.isArray(body.aims) ? body.aims.map((item) => String(item ?? "").trim()) : [];
    if (title.length < 2 || title.length > 80) throw new Error("Give the lab a short title.");
    if (blurb.length < 8 || blurb.length > 280) throw new Error("Write a short description.");
    if (language !== "c" && language !== "cpp" && language !== "python" && language !== "java") {
      throw new Error("Choose a language.");
    }
    if (aims.length !== 5 || aims.some((aim) => aim.length < 3 || aim.length > 300)) {
      throw new Error("Each lab needs five aims.");
    }
    return { slug, title, blurb, language: language as Lang, aims: aims as LabDef["aims"] };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const users = await sql<{ email: string }>`select email from "user" where id = ${context.userId}`;
    const email = normalizeEmail(users[0]?.email ?? "");
    if (roleForEmail(email) !== "admin") throw new Error("Only the lab admin can edit a lab.");
    await sql`
      insert into lab_catalog (slug, title, blurb, language, aims, updated_at)
      values (${data.slug}, ${data.title}, ${data.blurb}, ${data.language}, ${JSON.stringify(data.aims)}, now())
      on conflict (slug) do update set
        title = excluded.title,
        blurb = excluded.blurb,
        language = excluded.language,
        aims = excluded.aims,
        updated_at = now()
    `;
    return { ok: true };
  });

export async function labForSlug(slug: string): Promise<LabDef | null> {
  const labs = await mergedLabs();
  return labs.find((lab) => lab.slug === slug) ?? null;
}
