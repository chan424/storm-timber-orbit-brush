import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { normalizeEmail, roleForEmail, studentIdFromEmail } from "@/lib/lab/access";
import { authorshipComment, awardMarks } from "@/lib/lab/score";
import type { AdminExperiment, AdminStudent, Issue, Lang, Submission } from "@/lib/lab/types";

type Profile = {
  email: string;
  name: string;
  role: "admin" | "student" | null;
  studentId: string;
};

async function loadProfile(userId: string): Promise<Profile> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ email: string; name: string }>`
    select email, name from "user" where id = ${userId}
  `;
  const row = rows[0];
  if (!row?.email) throw new Error("Unauthorized");
  const email = normalizeEmail(row.email);
  return {
    email,
    name: row.name ?? email,
    role: roleForEmail(email),
    studentId: studentIdFromEmail(email),
  };
}

function requireStudent(profile: Profile): asserts profile is Profile & { role: "student" } {
  if (profile.role !== "student") {
    throw new Error("Only an @rguktong.ac.in student ID can submit experiments.");
  }
}

function requireAdmin(profile: Profile) {
  if (profile.role !== "admin") throw new Error("Only the evaluation cell can open the mark sheet.");
}

type SubmissionRow = {
  student_id: string;
  email: string;
  experiment: number | string;
  aim: string;
  language: string;
  code: string;
  runs_ok: unknown;
  base_marks: unknown;
  ai_percent: unknown;
  human_percent: unknown;
  ai_comment: string;
  deducted: unknown;
  awarded_marks: unknown;
  diagnostics: string;
  updated_at: unknown;
};

function asBool(value: unknown): boolean {
  return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asStamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}

function parseIssues(raw: string): Issue[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const line = asInt((item as { line?: unknown }).line);
      const message = String((item as { message?: unknown }).message ?? "");
      if (!line || !message) return [];
      return [{ line, message }];
    });
  } catch {
    return [];
  }
}

function toSubmission(row: SubmissionRow): Submission {
  const language: Lang = row.language === "c" || row.language === "cpp" ? row.language : "python";
  return {
    experiment: Number(row.experiment),
    aim: row.aim,
    language,
    code: row.code,
    runsOk: asBool(row.runs_ok),
    baseMarks: asInt(row.base_marks) ?? 0,
    awardedMarks: asInt(row.awarded_marks) ?? 0,
    aiPercent: asInt(row.ai_percent),
    humanPercent: asInt(row.human_percent),
    comment: row.ai_comment ?? "",
    deducted: asBool(row.deducted),
    diagnostics: parseIssues(row.diagnostics ?? "[]"),
    updatedAt: asStamp(row.updated_at),
  };
}

export const getAccess = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{
    email: string;
    name: string;
    role: "admin" | "student" | null;
    studentId: string | null;
  }> => {
    const profile = await loadProfile(context.userId);
    return {
      email: profile.email,
      name: profile.name,
      role: profile.role,
      studentId: profile.role === "student" ? profile.studentId : null,
    };
  });

export const listMine = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Submission[]> => {
    const profile = await loadProfile(context.userId);
    requireStudent(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<SubmissionRow>`
      select student_id, email, experiment, aim, language, code, runs_ok, base_marks,
             ai_percent, human_percent, ai_comment, deducted, awarded_marks, diagnostics, updated_at
      from lab_submissions
      where user_id = ${context.userId}
      order by experiment
    `;
    return rows.map(toSubmission);
  });

export const runExperiment = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (!input || typeof input !== "object") throw new Error("Invalid submission.");
    const body = input as Record<string, unknown>;
    const experiment = Number(body.experiment);
    const aim = String(body.aim ?? "").trim();
    const language = String(body.language ?? "");
    const code = String(body.code ?? "").replace(/\r\n/g, "\n");
    if (![1, 2, 3, 4, 5].includes(experiment)) throw new Error("Choose experiment 1 to 5.");
    if (aim.length < 3) throw new Error("Write the aim of the experiment.");
    if (aim.length > 1000) throw new Error("The aim is too long.");
    if (language !== "c" && language !== "cpp" && language !== "python") {
      throw new Error("Choose C, C++, or Python.");
    }
    if (code.trim().length < 8) throw new Error("Paste the program.");
    if (code.length > 40000) throw new Error("The program is too long.");
    return { experiment, aim, language: language as Lang, code };
  })
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<Submission> => {
    const profile = await loadProfile(context.userId);
    requireStudent(profile);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql<{ updated_at: unknown }>`
      select updated_at from lab_submissions
      where user_id = ${context.userId} and experiment = ${data.experiment}
    `;
    const previous = existing[0]?.updated_at;
    if (previous) {
      const then = new Date(asStamp(previous)).getTime();
      if (Number.isFinite(then) && Date.now() - then < 10000) {
        throw new Error("Wait a few seconds before running this experiment again.");
      }
    }

    const { traceProgram } = await import("./trace");
    const { reviewAuthorship } = await import("./ai-review");
    const traced = traceProgram(data.code, data.language);
    const review = await reviewAuthorship({
      language: data.language,
      aim: data.aim,
      code: data.code,
    });
    const scored = awardMarks(traced.ok, review.aiPercent);
    const comment = authorshipComment({
      aiPercent: review.aiPercent,
      note: review.note,
      deducted: scored.deducted,
      runsOk: traced.ok,
    });
    const human = review.aiPercent == null ? null : 100 - review.aiPercent;
    const diagnostics = JSON.stringify(traced.issues);

    const rows = await sql<SubmissionRow>`
      insert into lab_submissions (
        user_id, student_id, email, experiment, aim, language, code,
        runs_ok, base_marks, ai_percent, human_percent, ai_comment,
        deducted, awarded_marks, diagnostics, updated_at
      ) values (
        ${context.userId}, ${profile.studentId}, ${profile.email}, ${data.experiment},
        ${data.aim}, ${data.language}, ${data.code}, ${traced.ok}, ${scored.base},
        ${review.aiPercent}, ${human}, ${comment}, ${scored.deducted}, ${scored.awarded},
        ${diagnostics}, now()
      )
      on conflict (user_id, experiment) do update set
        student_id = excluded.student_id,
        email = excluded.email,
        aim = excluded.aim,
        language = excluded.language,
        code = excluded.code,
        runs_ok = excluded.runs_ok,
        base_marks = excluded.base_marks,
        ai_percent = excluded.ai_percent,
        human_percent = excluded.human_percent,
        ai_comment = excluded.ai_comment,
        deducted = excluded.deducted,
        awarded_marks = excluded.awarded_marks,
        diagnostics = excluded.diagnostics,
        updated_at = now()
      returning student_id, email, experiment, aim, language, code, runs_ok, base_marks,
                ai_percent, human_percent, ai_comment, deducted, awarded_marks, diagnostics, updated_at
    `;
    const saved = rows[0];
    if (!saved) throw new Error("The submission could not be saved.");
    return toSubmission(saved);
  });

export const listAll = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<AdminStudent[]> => {
    const profile = await loadProfile(context.userId);
    requireAdmin(profile);
    return loadSheet();
  });

export const exportMarks = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ filename: string; xml: string }> => {
    const profile = await loadProfile(context.userId);
    requireAdmin(profile);
    const students = await loadSheet();
    return {
      filename: "DAA-RGUKT-Ongole-lab-marks.xls",
      xml: marksWorkbook(students),
    };
  });

async function loadSheet(): Promise<AdminStudent[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<SubmissionRow>`
    select student_id, email, experiment, aim, language, code, runs_ok, base_marks,
           ai_percent, human_percent, ai_comment, deducted, awarded_marks, diagnostics, updated_at
    from lab_submissions
    order by student_id, experiment
  `;
  const byId = new Map<string, AdminStudent>();
  for (const row of rows) {
    const submission = toSubmission(row);
    let student = byId.get(row.student_id);
    if (!student) {
      student = {
        studentId: row.student_id,
        email: normalizeEmail(row.email),
        marks: [null, null, null, null, null],
        vivaMcq: null,
        vivaOral: null,
        total: 0,
        experiments: [],
      };
      byId.set(row.student_id, student);
    }
    const index = submission.experiment - 1;
    if (index >= 0 && index < 5) student.marks[index] = submission.awardedMarks;
    const detail: AdminExperiment = {
      experiment: submission.experiment,
      aim: submission.aim,
      language: submission.language,
      code: submission.code,
      awardedMarks: submission.awardedMarks,
      runsOk: submission.runsOk,
      comment: submission.comment,
      deducted: submission.deducted,
      diagnostics: submission.diagnostics,
      aiPercent: submission.aiPercent,
      updatedAt: submission.updatedAt,
    };
    student.experiments.push(detail);
  }
  const students = [...byId.values()];
  const vivaRows = await sql<{ student_id: string; email: string; mcq: unknown; oral: unknown }>`
    select p.student_id, p.email,
      case when p.saved_at is null then null else (
        select coalesce(sum(a.awarded), 0)
        from viva_answers a
        join viva_questions q on q.id = a.question_id
        where a.user_id = p.user_id and q.kind = 'mcq'
      ) end as mcq,
      (
        select sum(a.awarded)
        from viva_answers a
        join viva_questions q on q.id = a.question_id
        where a.user_id = p.user_id and q.kind = 'oral' and a.awarded is not null
      ) as oral
    from viva_papers p
  `;
  for (const row of vivaRows) {
    let student = byId.get(row.student_id);
    if (!student) {
      student = {
        studentId: row.student_id,
        email: normalizeEmail(row.email),
        marks: [null, null, null, null, null],
        vivaMcq: null,
        vivaOral: null,
        total: 0,
        experiments: [],
      };
      byId.set(row.student_id, student);
      students.push(student);
    }
    student.vivaMcq = asInt(row.mcq);
    student.vivaOral = asInt(row.oral);
  }
  for (const student of students) {
    const programs = student.marks.reduce<number>((sum, mark) => sum + (mark ?? 0), 0);
    student.total = programs + (student.vivaMcq ?? 0) + (student.vivaOral ?? 0);
    student.experiments.sort((a, b) => a.experiment - b.experiment);
  }
  students.sort((a, b) => a.studentId.localeCompare(b.studentId));
  return students;
}

function xmlEscape(value: string): string {
  const amp = String.fromCharCode(38);
  return value
    .replaceAll("&", `${amp}amp;`)
    .replaceAll("<", `${amp}lt;`)
    .replaceAll(">", `${amp}gt;`)
    .replaceAll('"', `${amp}quot;`);
}

function marksWorkbook(students: AdminStudent[]): string {
  const headers = [
    "ID",
    "Experiment 1",
    "Experiment 2",
    "Experiment 3",
    "Experiment 4",
    "Experiment 5",
    "Viva choices",
    "Viva oral",
    "Total",
  ];
  const headerRow = headers
    .map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`)
    .join("");
  const body = students
    .map((student) => {
      const cells = [
        `<Cell><Data ss:Type="String">${xmlEscape(student.studentId)}</Data></Cell>`,
        ...student.marks.map((mark) =>
          mark == null
            ? "<Cell></Cell>"
            : `<Cell><Data ss:Type="Number">${mark}</Data></Cell>`,
        ),
        student.vivaMcq == null ? "<Cell></Cell>" : `<Cell><Data ss:Type="Number">${student.vivaMcq}</Data></Cell>`,
        student.vivaOral == null ? "<Cell></Cell>" : `<Cell><Data ss:Type="Number">${student.vivaOral}</Data></Cell>`,
        `<Cell><Data ss:Type="Number">${student.total}</Data></Cell>`,
      ];
      return `<Row>${cells.join("")}</Row>`;
    })
    .join("");
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Marks">
<Table>
<Row>${headerRow}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`;
}
