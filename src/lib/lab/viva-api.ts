import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeEmail, roleForEmail, studentIdFromEmail } from "@/lib/lab/access";
import type { DraftQuestion } from "@/lib/lab/viva-parse";

type Profile = {
  email: string;
  role: "admin" | "student" | null;
  studentId: string;
};

async function profileOf(userId: string): Promise<Profile> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ email: string }>`select email from "user" where id = ${userId}`;
  const email = normalizeEmail(rows[0]?.email ?? "");
  if (!email) throw new Error("Unauthorized");
  return { email, role: roleForEmail(email), studentId: studentIdFromEmail(email) };
}

function requireStudent(profile: Profile): asserts profile is Profile & { role: "student" } {
  if (profile.role !== "student") throw new Error("Only an @rguktong.ac.in student can open the viva.");
}

function requireAdmin(profile: Profile) {
  if (profile.role !== "admin") throw new Error("Only the evaluation cell can do that.");
}

export type VivaKind = "oral" | "mcq";

export type VivaCard = {
  id: number;
  index: number;
  kind: VivaKind;
  prompt: string;
  choices: string[];
  selected: number | null;
  awarded: number | null;
  hasVideo: boolean;
};

export type VivaPaper = {
  ready: boolean;
  oralCount: number;
  mcqCount: number;
  saved: boolean;
  mcqMarks: number | null;
  oralMarks: number | null;
  questions: VivaCard[];
};

export type BankItem = {
  id: number;
  kind: VivaKind;
  prompt: string;
};

type QuestionRow = {
  id: number | string;
  kind: string;
  prompt: string;
  choices: string;
  answer: number | string | null;
};

type AnswerRow = {
  question_id: number | string;
  choice: number | string | null;
  awarded: number | string | null;
  has_video: unknown;
};

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseChoices(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item));
  } catch {
    return [];
  }
}

function parseIds(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
  } catch {
    return [];
  }
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = copy[i];
    copy[i] = copy[j] as T;
    copy[j] = swap as T;
  }
  return copy;
}

function checkDraft(input: unknown): DraftQuestion[] {
  if (!input || typeof input !== "object") throw new Error("Invalid questions.");
  const list = (input as { questions?: unknown }).questions;
  if (!Array.isArray(list) || list.length === 0) throw new Error("Add at least one question.");
  if (list.length > 40) throw new Error("Add at most 40 questions at a time.");
  return list.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Question ${index + 1} is invalid.`);
    const row = item as Record<string, unknown>;
    const kind = row.kind === "oral" || row.kind === "mcq" ? row.kind : null;
    const prompt = String(row.prompt ?? "").trim();
    if (!kind) throw new Error(`Question ${index + 1} needs a type.`);
    if (prompt.length < 3 || prompt.length > 1000) throw new Error(`Question ${index + 1} needs a shorter prompt.`);
    if (kind === "oral") return { kind, prompt, choices: [], answer: null };
    const choices = Array.isArray(row.choices) ? row.choices.map((choice) => String(choice).trim()) : [];
    const answer = asInt(row.answer);
    if (choices.length !== 4 || choices.some((choice) => choice.length < 1 || choice.length > 300)) {
      throw new Error(`Question ${index + 1} needs four options.`);
    }
    if (answer == null || answer < 0 || answer > 3) throw new Error(`Question ${index + 1} needs a correct option.`);
    return { kind, prompt, choices, answer };
  });
}

async function counts() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ kind: string; n: unknown }>`
    select kind, count(*) as n from viva_questions group by kind
  `;
  let oralCount = 0;
  let mcqCount = 0;
  for (const row of rows) {
    const n = asInt(row.n) ?? 0;
    if (row.kind === "oral") oralCount = n;
    if (row.kind === "mcq") mcqCount = n;
  }
  return { oralCount, mcqCount };
}

export const getViva = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<VivaPaper> => {
    const profile = await profileOf(context.userId);
    requireStudent(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const bank = await counts();
    const existing = await sql<{ question_ids: string; saved_at: unknown }>`
      select question_ids, saved_at from viva_papers where user_id = ${context.userId}
    `;
    let ids = parseIds(existing[0]?.question_ids ?? "");
    if (!existing[0]) {
      if (bank.oralCount < 5 || bank.mcqCount < 5) {
        return { ready: false, ...bank, saved: false, mcqMarks: null, oralMarks: null, questions: [] };
      }
      const oral = await sql<{ id: number | string }>`select id from viva_questions where kind = 'oral'`;
      const mcq = await sql<{ id: number | string }>`select id from viva_questions where kind = 'mcq'`;
      ids = [
        ...shuffle(oral.map((row) => Number(row.id))).slice(0, 5),
        ...shuffle(mcq.map((row) => Number(row.id))).slice(0, 5),
      ];
      await sql`
        insert into viva_papers (user_id, student_id, email, question_ids)
        values (${context.userId}, ${profile.studentId}, ${profile.email}, ${JSON.stringify(ids)})
        on conflict (user_id) do nothing
      `;
      const stored = await sql<{ question_ids: string }>`
        select question_ids from viva_papers where user_id = ${context.userId}
      `;
      ids = parseIds(stored[0]?.question_ids ?? JSON.stringify(ids));
    }
    return loadPaper(context.userId, ids, existing[0]?.saved_at != null, bank);
  });

async function loadPaper(
  userId: string,
  ids: number[],
  saved: boolean,
  bank: { oralCount: number; mcqCount: number },
): Promise<VivaPaper> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  if (ids.length === 0) {
    return { ready: false, ...bank, saved: false, mcqMarks: null, oralMarks: null, questions: [] };
  }
  const questions = await sql.query<QuestionRow>(
    `select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
    ids,
  );
  const answers = await sql<AnswerRow>`
    select question_id, choice, awarded,
           (video is not null and length(video) > 0) as has_video
    from viva_answers where user_id = ${userId}
  `;
  const byId = new Map(questions.map((row) => [Number(row.id), row]));
  const byAnswer = new Map(answers.map((row) => [Number(row.question_id), row]));
  const cards: VivaCard[] = [];
  let mcqMarks = 0;
  let oralMarks = 0;
  let oralSet = 0;
  ids.forEach((id, index) => {
    const row = byId.get(id);
    if (!row) return;
    const answer = byAnswer.get(id);
    const kind: VivaKind = row.kind === "oral" ? "oral" : "mcq";
    const awarded = asInt(answer?.awarded);
    if (kind === "mcq" && awarded != null) mcqMarks += awarded;
    if (kind === "oral" && awarded != null) {
      oralMarks += awarded;
      oralSet += 1;
    }
    cards.push({
      id,
      index: index + 1,
      kind,
      prompt: row.prompt,
      choices: kind === "mcq" ? parseChoices(row.choices) : [],
      selected: asInt(answer?.choice),
      awarded,
      hasVideo: asBool(answer?.has_video),
    });
  });
  const savedFlag = saved || cards.some((card) => card.kind === "mcq" && card.awarded != null);
  return {
    ready: cards.length > 0,
    ...bank,
    saved: savedFlag,
    mcqMarks: savedFlag ? mcqMarks : null,
    oralMarks: oralSet > 0 ? oralMarks : null,
    questions: cards,
  };
}

export const saveViva = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Invalid viva.");
    const answers = (input as { answers?: unknown }).answers;
    if (!Array.isArray(answers)) throw new Error("Invalid viva.");
    return {
      answers: answers.map((item) => {
        if (!item || typeof item !== "object") throw new Error("Invalid answer.");
        const row = item as Record<string, unknown>;
        const questionId = Number(row.questionId);
        const choice = row.choice == null || row.choice === "" ? null : Number(row.choice);
        if (!Number.isInteger(questionId)) throw new Error("Invalid question.");
        if (choice != null && (!Number.isInteger(choice) || choice < 0 || choice > 3)) {
          throw new Error("Choose one of the four options.");
        }
        return { questionId, choice };
      }),
    };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<VivaPaper> => {
    const profile = await profileOf(context.userId);
    requireStudent(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const paper = await sql<{ question_ids: string }>`
      select question_ids from viva_papers where user_id = ${context.userId}
    `;
    const ids = parseIds(paper[0]?.question_ids ?? "");
    if (ids.length === 0) throw new Error("The viva is not open yet.");
    const allowed = new Set(ids);
    const questions = await sql.query<QuestionRow>(
      `select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
      ids,
    );
    const byId = new Map(questions.map((row) => [Number(row.id), row]));
    for (const answer of data.answers) {
      if (!allowed.has(answer.questionId)) continue;
      const question = byId.get(answer.questionId);
      if (!question || question.kind !== "mcq") continue;
      const correct = asInt(question.answer);
      const awarded = answer.choice != null && answer.choice === correct ? 2 : 0;
      await sql`
        insert into viva_answers (user_id, question_id, choice, awarded, updated_at)
        values (${context.userId}, ${answer.questionId}, ${answer.choice}, ${awarded}, now())
        on conflict (user_id, question_id) do update set
          choice = excluded.choice,
          awarded = excluded.awarded,
          updated_at = now()
      `;
    }
    await sql`update viva_papers set saved_at = now() where user_id = ${context.userId}`;
    return loadPaper(context.userId, ids, true, await counts());
  });

export const listBank = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ oralCount: number; mcqCount: number; items: BankItem[] }> => {
    const profile = await profileOf(context.userId);
    requireAdmin(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const bank = await counts();
    const rows = await sql<QuestionRow>`
      select id, kind, prompt, choices, answer from viva_questions order by id
    `;
    return {
      ...bank,
      items: rows.map((row) => ({
        id: Number(row.id),
        kind: row.kind === "oral" ? "oral" : "mcq",
        prompt: row.prompt,
      })),
    };
  });

export const addQuestions = createServerFn({ method: "POST" })
  .validator(checkDraft)
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const profile = await profileOf(context.userId);
    requireAdmin(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const bank = await counts();
    if (bank.oralCount + bank.mcqCount + data.length > 80) {
      throw new Error("The bank already has enough questions. Keep it near 60.");
    }
    for (const question of data) {
      await sql`
        insert into viva_questions (kind, prompt, choices, answer)
        values (
          ${question.kind},
          ${question.prompt},
          ${JSON.stringify(question.choices)},
          ${question.answer}
        )
      `;
    }
    return counts();
  });

export type AdminVivaItem = {
  questionId: number;
  kind: VivaKind;
  prompt: string;
  awarded: number | null;
  hasVideo: boolean;
  selected: number | null;
};

export const getStudentViva = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const studentId = String((input as { studentId?: unknown })?.studentId ?? "").trim();
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(studentId)) throw new Error("Unknown student.");
    return { studentId };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<AdminVivaItem[]> => {
    const profile = await profileOf(context.userId);
    requireAdmin(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const papers = await sql<{ user_id: string; question_ids: string }>`
      select user_id, question_ids from viva_papers where student_id = ${data.studentId}
    `;
    const paper = papers[0];
    if (!paper) return [];
    const ids = parseIds(paper.question_ids);
    if (ids.length === 0) return [];
    const questions = await sql.query<QuestionRow>(
      `select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
      ids,
    );
    const answers = await sql<AnswerRow>`
      select question_id, choice, awarded,
             (video is not null and length(video) > 0) as has_video
      from viva_answers where user_id = ${paper.user_id}
    `;
    const byId = new Map(questions.map((row) => [Number(row.id), row]));
    const byAnswer = new Map(answers.map((row) => [Number(row.question_id), row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      if (!row) return [];
      const answer = byAnswer.get(id);
      return [
        {
          questionId: id,
          kind: row.kind === "oral" ? "oral" as const : "mcq" as const,
          prompt: row.prompt,
          awarded: asInt(answer?.awarded),
          hasVideo: asBool(answer?.has_video),
          selected: asInt(answer?.choice),
        },
      ];
    });
  });

export const awardOral = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Invalid mark.");
    const row = input as Record<string, unknown>;
    const studentId = String(row.studentId ?? "").trim();
    const questionId = Number(row.questionId);
    const marks = Number(row.marks);
    if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(studentId)) throw new Error("Unknown student.");
    if (!Number.isInteger(questionId)) throw new Error("Unknown question.");
    if (![0, 1, 2].includes(marks)) throw new Error("Award 0, 1, or 2 marks.");
    return { studentId, questionId, marks };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }) => {
    const profile = await profileOf(context.userId);
    requireAdmin(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const papers = await sql<{ user_id: string; question_ids: string }>`
      select user_id, question_ids from viva_papers where student_id = ${data.studentId}
    `;
    const paper = papers[0];
    if (!paper) throw new Error("That student has no viva.");
    const ids = parseIds(paper.question_ids);
    if (!ids.includes(data.questionId)) throw new Error("That question is not on this viva.");
    const questions = await sql<{ kind: string }>`
      select kind from viva_questions where id = ${data.questionId}
    `;
    if (questions[0]?.kind !== "oral") throw new Error("Only a spoken answer is marked by hand.");
    await sql`
      insert into viva_answers (user_id, question_id, awarded, updated_at)
      values (${paper.user_id}, ${data.questionId}, ${data.marks}, now())
      on conflict (user_id, question_id) do update set
        awarded = excluded.awarded,
        updated_at = now()
    `;
    return { ok: true };
  });
