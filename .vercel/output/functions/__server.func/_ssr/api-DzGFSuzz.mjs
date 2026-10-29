import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-CHKht65o.mjs";
import { i as studentIdFromEmail, n as normalizeEmail, r as roleForEmail } from "./access-BgTZ6yz7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/api-DzGFSuzz.js
/** 10 for a clean trace. More than 75% AI deducts 5, and the score never goes below 0. */
function awardMarks(runsOk, aiPercent) {
	const base = runsOk ? 10 : 0;
	const deducted = aiPercent != null && aiPercent > 75 && base >= 5;
	return {
		base,
		awarded: deducted ? base - 5 : base,
		deducted
	};
}
function authorshipComment(opts) {
	if (opts.aiPercent == null) return opts.runsOk ? "Trace passed. Authorship review did not run, so no AI deduction was applied." : "Trace did not pass. Authorship review did not run, so no AI deduction was applied.";
	const human = 100 - opts.aiPercent;
	const note = (opts.note ?? "").replace(/\s+/g, " ").trim();
	let text = `AI ${opts.aiPercent}% · Human ${human}%.`;
	if (note) text += ` ${note}`;
	if (opts.deducted) text += " 5 marks deducted because the AI share is above 75%.";
	else if (opts.aiPercent > 75 && !opts.runsOk) text += " The program did not trace clean, so this experiment stays at 0.";
	return text;
}
async function loadProfile(userId) {
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const row = (await (await getSql())`
    select email, name from "user" where id = ${userId}
  `)[0];
	if (!row?.email) throw new Error("Unauthorized");
	const email = normalizeEmail(row.email);
	return {
		email,
		name: row.name ?? email,
		role: roleForEmail(email),
		studentId: studentIdFromEmail(email)
	};
}
function requireStudent(profile) {
	if (profile.role !== "student") throw new Error("Only an @rguktong.ac.in student ID can submit experiments.");
}
function requireAdmin(profile) {
	if (profile.role !== "admin") throw new Error("Only the evaluation cell can open the mark sheet.");
}
function asBool(value) {
	return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}
function asInt(value) {
	if (value == null || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? Math.round(n) : null;
}
function asStamp(value) {
	if (value instanceof Date) return value.toISOString();
	return value == null ? "" : String(value);
}
function parseIssues(raw) {
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.flatMap((item) => {
			if (!item || typeof item !== "object") return [];
			const line = asInt(item.line);
			const message = String(item.message ?? "");
			if (!line || !message) return [];
			return [{
				line,
				message
			}];
		});
	} catch {
		return [];
	}
}
function toSubmission(row) {
	const language = row.language === "c" || row.language === "cpp" ? row.language : "python";
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
		updatedAt: asStamp(row.updated_at)
	};
}
var getAccess_createServerFn_handler = createServerRpc({
	id: "148791e72a45ee0dd98992b6a3a62544c931d41e796274c574fe367d653ca7f4",
	name: "getAccess",
	filename: "src/lib/lab/api.ts"
}, (opts) => getAccess.__executeServer(opts));
var getAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getAccess_createServerFn_handler, async ({ context }) => {
	const profile = await loadProfile(context.userId);
	return {
		email: profile.email,
		name: profile.name,
		role: profile.role,
		studentId: profile.role === "student" ? profile.studentId : null
	};
});
var listMine_createServerFn_handler = createServerRpc({
	id: "e4751aa05be1d6bfd68599d72ed01a0f95d11309a1087ccae6b5bb081f79d87b",
	name: "listMine",
	filename: "src/lib/lab/api.ts"
}, (opts) => listMine.__executeServer(opts));
var listMine = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listMine_createServerFn_handler, async ({ context }) => {
	requireStudent(await loadProfile(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	return (await (await getSql())`
      select student_id, email, experiment, aim, language, code, runs_ok, base_marks,
             ai_percent, human_percent, ai_comment, deducted, awarded_marks, diagnostics, updated_at
      from lab_submissions
      where user_id = ${context.userId}
      order by experiment
    `).map(toSubmission);
});
var runExperiment_createServerFn_handler = createServerRpc({
	id: "ee37e0a96cd23ef5b6e8ed68607d459daed2eb046b1293d68e2cb34d3ef441a3",
	name: "runExperiment",
	filename: "src/lib/lab/api.ts"
}, (opts) => runExperiment.__executeServer(opts));
var runExperiment = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Invalid submission.");
	const body = input;
	const experiment = Number(body.experiment);
	const aim = String(body.aim ?? "").trim();
	const language = String(body.language ?? "");
	const code = String(body.code ?? "").replace(/\r\n/g, "\n");
	if (![
		1,
		2,
		3,
		4,
		5
	].includes(experiment)) throw new Error("Choose experiment 1 to 5.");
	if (aim.length < 3) throw new Error("Write the aim of the experiment.");
	if (aim.length > 1e3) throw new Error("The aim is too long.");
	if (language !== "c" && language !== "cpp" && language !== "python") throw new Error("Choose C, C++, or Python.");
	if (code.trim().length < 8) throw new Error("Paste the program.");
	if (code.length > 4e4) throw new Error("The program is too long.");
	return {
		experiment,
		aim,
		language,
		code
	};
}).middleware([authMiddleware]).handler(runExperiment_createServerFn_handler, async ({ context, data }) => {
	const profile = await loadProfile(context.userId);
	requireStudent(profile);
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const previous = (await sql`
      select updated_at from lab_submissions
      where user_id = ${context.userId} and experiment = ${data.experiment}
    `)[0]?.updated_at;
	if (previous) {
		const then = new Date(asStamp(previous)).getTime();
		if (Number.isFinite(then) && Date.now() - then < 1e4) throw new Error("Wait a few seconds before running this experiment again.");
	}
	const { traceProgram } = await import("./trace-CJ04v3Aj.mjs");
	const { reviewAuthorship } = await import("./ai-review-DwX-5gXI.mjs");
	const traced = traceProgram(data.code, data.language);
	const review = await reviewAuthorship({
		language: data.language,
		aim: data.aim,
		code: data.code
	});
	const scored = awardMarks(traced.ok, review.aiPercent);
	const comment = authorshipComment({
		aiPercent: review.aiPercent,
		note: review.note,
		deducted: scored.deducted,
		runsOk: traced.ok
	});
	const human = review.aiPercent == null ? null : 100 - review.aiPercent;
	const diagnostics = JSON.stringify(traced.issues);
	const saved = (await sql`
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
    `)[0];
	if (!saved) throw new Error("The submission could not be saved.");
	return toSubmission(saved);
});
var listAll_createServerFn_handler = createServerRpc({
	id: "029b2beacc6a0778c1d1b2567b6dfd6ee67dda1026bf498c867c40c0a27e051a",
	name: "listAll",
	filename: "src/lib/lab/api.ts"
}, (opts) => listAll.__executeServer(opts));
var listAll = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listAll_createServerFn_handler, async ({ context }) => {
	requireAdmin(await loadProfile(context.userId));
	return loadSheet();
});
var exportMarks_createServerFn_handler = createServerRpc({
	id: "4691472b7bf24c49d8d4738ed8c6669e35d1f65742f26de96e7f079fed847f69",
	name: "exportMarks",
	filename: "src/lib/lab/api.ts"
}, (opts) => exportMarks.__executeServer(opts));
var exportMarks = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(exportMarks_createServerFn_handler, async ({ context }) => {
	requireAdmin(await loadProfile(context.userId));
	return {
		filename: "DAA-RGUKT-Ongole-lab-marks.xls",
		xml: marksWorkbook(await loadSheet())
	};
});
async function loadSheet() {
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const rows = await sql`
    select student_id, email, experiment, aim, language, code, runs_ok, base_marks,
           ai_percent, human_percent, ai_comment, deducted, awarded_marks, diagnostics, updated_at
    from lab_submissions
    order by student_id, experiment
  `;
	const byId = /* @__PURE__ */ new Map();
	for (const row of rows) {
		const submission = toSubmission(row);
		let student = byId.get(row.student_id);
		if (!student) {
			student = {
				studentId: row.student_id,
				email: normalizeEmail(row.email),
				marks: [
					null,
					null,
					null,
					null,
					null
				],
				vivaMcq: null,
				vivaOral: null,
				total: 0,
				experiments: []
			};
			byId.set(row.student_id, student);
		}
		const index = submission.experiment - 1;
		if (index >= 0 && index < 5) student.marks[index] = submission.awardedMarks;
		const detail = {
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
			updatedAt: submission.updatedAt
		};
		student.experiments.push(detail);
	}
	const students = [...byId.values()];
	const vivaRows = await sql`
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
				marks: [
					null,
					null,
					null,
					null,
					null
				],
				vivaMcq: null,
				vivaOral: null,
				total: 0,
				experiments: []
			};
			byId.set(row.student_id, student);
			students.push(student);
		}
		student.vivaMcq = asInt(row.mcq);
		student.vivaOral = asInt(row.oral);
	}
	for (const student of students) {
		student.total = student.marks.reduce((sum, mark) => sum + (mark ?? 0), 0) + (student.vivaMcq ?? 0) + (student.vivaOral ?? 0);
		student.experiments.sort((a, b) => a.experiment - b.experiment);
	}
	students.sort((a, b) => a.studentId.localeCompare(b.studentId));
	return students;
}
function xmlEscape(value) {
	const amp = String.fromCharCode(38);
	return value.replaceAll("&", `${amp}amp;`).replaceAll("<", `${amp}lt;`).replaceAll(">", `${amp}gt;`).replaceAll("\"", `${amp}quot;`);
}
function marksWorkbook(students) {
	return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Marks">
<Table>
<Row>${[
		"ID",
		"Experiment 1",
		"Experiment 2",
		"Experiment 3",
		"Experiment 4",
		"Experiment 5",
		"Viva choices",
		"Viva oral",
		"Total"
	].map((header) => `<Cell><Data ss:Type="String">${xmlEscape(header)}</Data></Cell>`).join("")}</Row>
${students.map((student) => {
		return `<Row>${[
			`<Cell><Data ss:Type="String">${xmlEscape(student.studentId)}</Data></Cell>`,
			...student.marks.map((mark) => mark == null ? "<Cell></Cell>" : `<Cell><Data ss:Type="Number">${mark}</Data></Cell>`),
			student.vivaMcq == null ? "<Cell></Cell>" : `<Cell><Data ss:Type="Number">${student.vivaMcq}</Data></Cell>`,
			student.vivaOral == null ? "<Cell></Cell>" : `<Cell><Data ss:Type="Number">${student.vivaOral}</Data></Cell>`,
			`<Cell><Data ss:Type="Number">${student.total}</Data></Cell>`
		].join("")}</Row>`;
	}).join("")}
</Table>
</Worksheet>
</Workbook>`;
}
//#endregion
export { exportMarks_createServerFn_handler, getAccess_createServerFn_handler, listAll_createServerFn_handler, listMine_createServerFn_handler, runExperiment_createServerFn_handler };
