import { r as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-CcvdN_gc.mjs";
import { t as authMiddleware } from "./middleware-CHKht65o.mjs";
import { i as studentIdFromEmail, n as normalizeEmail, r as roleForEmail } from "./access-BgTZ6yz7.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/viva-api-DI0209bh.js
async function profileOf(userId) {
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const rows = await (await getSql())`select email from "user" where id = ${userId}`;
	const email = normalizeEmail(rows[0]?.email ?? "");
	if (!email) throw new Error("Unauthorized");
	return {
		email,
		role: roleForEmail(email),
		studentId: studentIdFromEmail(email)
	};
}
function requireStudent(profile) {
	if (profile.role !== "student") throw new Error("Only an @rguktong.ac.in student can open the viva.");
}
function requireAdmin(profile) {
	if (profile.role !== "admin") throw new Error("Only the evaluation cell can do that.");
}
function asBool(value) {
	return value === true || value === "t" || value === "true" || value === 1 || value === "1";
}
function asInt(value) {
	if (value == null || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? Math.round(n) : null;
}
function parseChoices(raw) {
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((item) => String(item));
	} catch {
		return [];
	}
}
function parseIds(raw) {
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
	} catch {
		return [];
	}
}
function shuffle(items) {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i -= 1) {
		const j = Math.floor(Math.random() * (i + 1));
		const swap = copy[i];
		copy[i] = copy[j];
		copy[j] = swap;
	}
	return copy;
}
function checkDraft(input) {
	if (!input || typeof input !== "object") throw new Error("Invalid questions.");
	const list = input.questions;
	if (!Array.isArray(list) || list.length === 0) throw new Error("Add at least one question.");
	if (list.length > 40) throw new Error("Add at most 40 questions at a time.");
	return list.map((item, index) => {
		if (!item || typeof item !== "object") throw new Error(`Question ${index + 1} is invalid.`);
		const row = item;
		const kind = row.kind === "oral" || row.kind === "mcq" ? row.kind : null;
		const prompt = String(row.prompt ?? "").trim();
		if (!kind) throw new Error(`Question ${index + 1} needs a type.`);
		if (prompt.length < 3 || prompt.length > 1e3) throw new Error(`Question ${index + 1} needs a shorter prompt.`);
		if (kind === "oral") return {
			kind,
			prompt,
			choices: [],
			answer: null
		};
		const choices = Array.isArray(row.choices) ? row.choices.map((choice) => String(choice).trim()) : [];
		const answer = asInt(row.answer);
		if (choices.length !== 4 || choices.some((choice) => choice.length < 1 || choice.length > 300)) throw new Error(`Question ${index + 1} needs four options.`);
		if (answer == null || answer < 0 || answer > 3) throw new Error(`Question ${index + 1} needs a correct option.`);
		return {
			kind,
			prompt,
			choices,
			answer
		};
	});
}
async function counts() {
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const rows = await (await getSql())`
    select kind, count(*) as n from viva_questions group by kind
  `;
	let oralCount = 0;
	let mcqCount = 0;
	for (const row of rows) {
		const n = asInt(row.n) ?? 0;
		if (row.kind === "oral") oralCount = n;
		if (row.kind === "mcq") mcqCount = n;
	}
	return {
		oralCount,
		mcqCount
	};
}
var getViva_createServerFn_handler = createServerRpc({
	id: "594d0afb1f063a04837fbb6895bd9c9c079dfc69c625b619e2e8172f654eac2b",
	name: "getViva",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => getViva.__executeServer(opts));
var getViva = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(getViva_createServerFn_handler, async ({ context }) => {
	const profile = await profileOf(context.userId);
	requireStudent(profile);
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const bank = await counts();
	const existing = await sql`
      select question_ids, saved_at from viva_papers where user_id = ${context.userId}
    `;
	let ids = parseIds(existing[0]?.question_ids ?? "");
	if (!existing[0]) {
		if (bank.oralCount < 5 || bank.mcqCount < 5) return {
			ready: false,
			...bank,
			saved: false,
			mcqMarks: null,
			oralMarks: null,
			questions: []
		};
		const oral = await sql`select id from viva_questions where kind = 'oral'`;
		const mcq = await sql`select id from viva_questions where kind = 'mcq'`;
		ids = [...shuffle(oral.map((row) => Number(row.id))).slice(0, 5), ...shuffle(mcq.map((row) => Number(row.id))).slice(0, 5)];
		await sql`
        insert into viva_papers (user_id, student_id, email, question_ids)
        values (${context.userId}, ${profile.studentId}, ${profile.email}, ${JSON.stringify(ids)})
        on conflict (user_id) do nothing
      `;
		ids = parseIds((await sql`
        select question_ids from viva_papers where user_id = ${context.userId}
      `)[0]?.question_ids ?? JSON.stringify(ids));
	}
	return loadPaper(context.userId, ids, existing[0]?.saved_at != null, bank);
});
async function loadPaper(userId, ids, saved, bank) {
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	if (ids.length === 0) return {
		ready: false,
		...bank,
		saved: false,
		mcqMarks: null,
		oralMarks: null,
		questions: []
	};
	const questions = await sql.query(`select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids);
	const answers = await sql`
    select question_id, choice, awarded,
           (video is not null and length(video) > 0) as has_video
    from viva_answers where user_id = ${userId}
  `;
	const byId = new Map(questions.map((row) => [Number(row.id), row]));
	const byAnswer = new Map(answers.map((row) => [Number(row.question_id), row]));
	const cards = [];
	let mcqMarks = 0;
	let oralMarks = 0;
	let oralSet = 0;
	ids.forEach((id, index) => {
		const row = byId.get(id);
		if (!row) return;
		const answer = byAnswer.get(id);
		const kind = row.kind === "oral" ? "oral" : "mcq";
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
			hasVideo: asBool(answer?.has_video)
		});
	});
	const savedFlag = saved || cards.some((card) => card.kind === "mcq" && card.awarded != null);
	return {
		ready: cards.length > 0,
		...bank,
		saved: savedFlag,
		mcqMarks: savedFlag ? mcqMarks : null,
		oralMarks: oralSet > 0 ? oralMarks : null,
		questions: cards
	};
}
var saveViva_createServerFn_handler = createServerRpc({
	id: "d43b555925568a7b2cbd3d3261a63576382a6fcf486bf3e4acdd88704900963c",
	name: "saveViva",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => saveViva.__executeServer(opts));
var saveViva = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Invalid viva.");
	const answers = input.answers;
	if (!Array.isArray(answers)) throw new Error("Invalid viva.");
	return { answers: answers.map((item) => {
		if (!item || typeof item !== "object") throw new Error("Invalid answer.");
		const row = item;
		const questionId = Number(row.questionId);
		const choice = row.choice == null || row.choice === "" ? null : Number(row.choice);
		if (!Number.isInteger(questionId)) throw new Error("Invalid question.");
		if (choice != null && (!Number.isInteger(choice) || choice < 0 || choice > 3)) throw new Error("Choose one of the four options.");
		return {
			questionId,
			choice
		};
	}) };
}).middleware([authMiddleware]).handler(saveViva_createServerFn_handler, async ({ context, data }) => {
	requireStudent(await profileOf(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const ids = parseIds((await sql`
      select question_ids from viva_papers where user_id = ${context.userId}
    `)[0]?.question_ids ?? "");
	if (ids.length === 0) throw new Error("The viva is not open yet.");
	const allowed = new Set(ids);
	const questions = await sql.query(`select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids);
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
var listBank_createServerFn_handler = createServerRpc({
	id: "96b4b56854f4758b71fd26e8fb5ab9d646cfc7b4e34f91034887b0d15cf83e57",
	name: "listBank",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => listBank.__executeServer(opts));
var listBank = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(listBank_createServerFn_handler, async ({ context }) => {
	requireAdmin(await profileOf(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const bank = await counts();
	const rows = await sql`
      select id, kind, prompt, choices, answer from viva_questions order by id
    `;
	return {
		...bank,
		items: rows.map((row) => ({
			id: Number(row.id),
			kind: row.kind === "oral" ? "oral" : "mcq",
			prompt: row.prompt
		}))
	};
});
var addQuestions_createServerFn_handler = createServerRpc({
	id: "5558380e3231c0a7db2136a3aaa5299fde071157be1f8e92cff49580f9a35fea",
	name: "addQuestions",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => addQuestions.__executeServer(opts));
var addQuestions = createServerFn({ method: "POST" }).validator(checkDraft).middleware([authMiddleware]).handler(addQuestions_createServerFn_handler, async ({ context, data }) => {
	requireAdmin(await profileOf(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const bank = await counts();
	if (bank.oralCount + bank.mcqCount + data.length > 80) throw new Error("The bank already has enough questions. Keep it near 60.");
	for (const question of data) await sql`
        insert into viva_questions (kind, prompt, choices, answer)
        values (
          ${question.kind},
          ${question.prompt},
          ${JSON.stringify(question.choices)},
          ${question.answer}
        )
      `;
	return counts();
});
var getStudentViva_createServerFn_handler = createServerRpc({
	id: "37106dab884caa95bed27cbf1fbdee24099a610e0897754f3558f2722cea475d",
	name: "getStudentViva",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => getStudentViva.__executeServer(opts));
var getStudentViva = createServerFn({ method: "POST" }).validator((input) => {
	const studentId = String(input?.studentId ?? "").trim();
	if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(studentId)) throw new Error("Unknown student.");
	return { studentId };
}).middleware([authMiddleware]).handler(getStudentViva_createServerFn_handler, async ({ context, data }) => {
	requireAdmin(await profileOf(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const paper = (await sql`
      select user_id, question_ids from viva_papers where student_id = ${data.studentId}
    `)[0];
	if (!paper) return [];
	const ids = parseIds(paper.question_ids);
	if (ids.length === 0) return [];
	const questions = await sql.query(`select id, kind, prompt, choices, answer from viva_questions where id in (${ids.map((_, i) => `$${i + 1}`).join(",")})`, ids);
	const answers = await sql`
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
		return [{
			questionId: id,
			kind: row.kind === "oral" ? "oral" : "mcq",
			prompt: row.prompt,
			awarded: asInt(answer?.awarded),
			hasVideo: asBool(answer?.has_video),
			selected: asInt(answer?.choice)
		}];
	});
});
var awardOral_createServerFn_handler = createServerRpc({
	id: "6a15c2e8dff9c50e895a1ca74ddbc6e6582eadf33beac0656a48fe53ec74ffb9",
	name: "awardOral",
	filename: "src/lib/lab/viva-api.ts"
}, (opts) => awardOral.__executeServer(opts));
var awardOral = createServerFn({ method: "POST" }).validator((input) => {
	if (!input || typeof input !== "object") throw new Error("Invalid mark.");
	const row = input;
	const studentId = String(row.studentId ?? "").trim();
	const questionId = Number(row.questionId);
	const marks = Number(row.marks);
	if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(studentId)) throw new Error("Unknown student.");
	if (!Number.isInteger(questionId)) throw new Error("Unknown question.");
	if (![
		0,
		1,
		2
	].includes(marks)) throw new Error("Award 0, 1, or 2 marks.");
	return {
		studentId,
		questionId,
		marks
	};
}).middleware([authMiddleware]).handler(awardOral_createServerFn_handler, async ({ context, data }) => {
	requireAdmin(await profileOf(context.userId));
	const { getSql } = await import("./db-xxBUyVt6.mjs").then((n) => n.t).then((n) => n.t);
	const sql = await getSql();
	const paper = (await sql`
      select user_id, question_ids from viva_papers where student_id = ${data.studentId}
    `)[0];
	if (!paper) throw new Error("That student has no viva.");
	if (!parseIds(paper.question_ids).includes(data.questionId)) throw new Error("That question is not on this viva.");
	if ((await sql`
      select kind from viva_questions where id = ${data.questionId}
    `)[0]?.kind !== "oral") throw new Error("Only a spoken answer is marked by hand.");
	await sql`
      insert into viva_answers (user_id, question_id, awarded, updated_at)
      values (${paper.user_id}, ${data.questionId}, ${data.marks}, now())
      on conflict (user_id, question_id) do update set
        awarded = excluded.awarded,
        updated_at = now()
    `;
	return { ok: true };
});
//#endregion
export { addQuestions_createServerFn_handler, awardOral_createServerFn_handler, getStudentViva_createServerFn_handler, getViva_createServerFn_handler, listBank_createServerFn_handler, saveViva_createServerFn_handler };
