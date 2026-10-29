import { o as __toESM } from "../_runtime.mjs";
import { J as require_react, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as getServerFnById, i as TSS_SERVER_FUNCTION, r as createServerFn } from "./ssr.mjs";
import { t as authMiddleware } from "./middleware-CHKht65o.mjs";
import { i as studentIdFromEmail, r as roleForEmail, t as ADMIN_EMAIL } from "./access-BgTZ6yz7.mjs";
import { a as signOut, i as signIn, r as getBearerToken, t as authClient } from "./client-Hb_FAdbz.mjs";
import { i as hasGateSessionMarker } from "./server-BBDdgfjA.mjs";
import { n as previewPathPrefix } from "./router-BonlVZrR.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/portal-home-DBToIGhf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Current user + loading state. Same behavior in live preview and when deployed:
*   - Auth enabled -> the real signed-in user; `user` is `null` while
*                            the session resolves (`isPending: true`) and when
*                            signed out (`isPending: false`). Session comes from
*                            Better Auth `useSession()` → `/api/auth/get-session`
*                            (cookie when deployed; bearer in live preview).
*   - Auth disabled (`VITE_AUTH_ENABLED=false`) -> `DEV_USER`, never pending.
*
* Protect a route by waiting out `isPending` before acting on `user` —
* redirecting on `user: null` alone bounces signed-in visitors to sign-in on
* every hard reload:
*
*   import { RedirectToSignIn } from "@/lib/auth/gates";
*   const { user, isPending } = useCurrentUserState();
*   if (isPending) return null;              // still resolving — don't redirect yet
*   if (!user) return <RedirectToSignIn />;  // definitely signed out
*
* `authEnabled` is a module-level constant fixed at load, so the guarded hook
* call keeps a stable hook order across every render of a given component.
*/
function useCurrentUserState() {
	return useSessionUserState();
}
function useSessionUserState() {
	const { data, isPending } = authClient.useSession();
	const id = data?.user.id;
	const displayName = data?.user.name ?? null;
	const primaryEmail = data?.user.email ?? null;
	const profileImageUrl = data?.user.image ?? null;
	const user = (0, import_react.useMemo)(() => id ? {
		id,
		displayName,
		primaryEmail,
		profileImageUrl,
		isDevFallback: false
	} : null, [
		id,
		displayName,
		primaryEmail,
		profileImageUrl
	]);
	return (0, import_react.useMemo)(() => ({
		user,
		isPending
	}), [user, isPending]);
}
/**
* Convenience view of `useCurrentUserState().user` for display (e.g.
* `user?.displayName ?? "Guest"`). NOTE: `null` means *loading OR signed out* —
* for redirects/guards use `useCurrentUserState()` and check `isPending`.
*/
function useCurrentUser() {
	return useCurrentUserState().user;
}
var subscribeToNothing = () => () => {};
var noGateSessionOnServer = () => false;
/**
* Minimal signed-in identity chip + sign-out. Restyle freely (see the
* `design-ui` skill). Sign-out is only shown when auth is enabled (the
* disabled-auth dev user has nothing to sign out of) and the session is not
* gate-materialized — behind the gate the next request signs the viewer
* straight back in, so a sign-out control there is a broken loop.
*/
function UserButton() {
	const user = useCurrentUser();
	const [signingOut, setSigningOut] = (0, import_react.useState)(false);
	const gateSession = (0, import_react.useSyncExternalStore)(subscribeToNothing, hasGateSessionMarker, noGateSessionOnServer);
	if (!user) return null;
	const label = user.displayName ?? user.primaryEmail ?? "Account";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-2",
		children: [
			user.profileImageUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: user.profileImageUrl,
				alt: "",
				className: "h-8 w-8 rounded-full object-cover"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "grid h-8 w-8 place-items-center rounded-full bg-black/10 text-sm font-medium dark:bg-white/20",
				children: label.charAt(0).toUpperCase()
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-sm font-medium",
				children: label
			}),
			!gateSession && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: signingOut,
				onClick: () => {
					setSigningOut(true);
					signOut().catch(() => setSigningOut(false));
				},
				className: "cursor-pointer text-sm underline-offset-4 opacity-70 hover:underline disabled:cursor-wait disabled:no-underline",
				children: signingOut ? "Signing out…" : "Sign out"
			})
		]
	});
}
var BEARER_KEY = "grok-auth.bearer-token";
function LoginCard({ signedInAs }) {
	const [mode, setMode] = (0, import_react.useState)("in");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [pending, setPending] = (0, import_react.useState)(false);
	async function onSubmit(event) {
		event.preventDefault();
		setError("");
		const nextEmail = email.trim().toLowerCase();
		if (!roleForEmail(nextEmail)) {
			setError(`Use a student ID such as o234747@rguktong.ac.in, or ${ADMIN_EMAIL} for the evaluation cell.`);
			return;
		}
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}
		setPending(true);
		try {
			sessionStorage.removeItem(BEARER_KEY);
			await authClient.signOut().catch(() => void 0);
			sessionStorage.removeItem(BEARER_KEY);
			let token = null;
			const options = { onSuccess(ctx) {
				token = ctx.response.headers.get("set-auth-token");
			} };
			if (mode === "up") {
				const { error: signUpError } = await authClient.signUp.email({
					email: nextEmail,
					password,
					name: studentIdFromEmail(nextEmail) || "Student"
				}, options);
				if (signUpError) throw new Error(signUpError.message || "Could not create the account.");
			} else {
				const { error: signInError } = await authClient.signIn.email({
					email: nextEmail,
					password
				}, options);
				if (signInError) throw new Error(signInError.message || "Could not sign in.");
			}
			if (token) sessionStorage.setItem(BEARER_KEY, token);
			window.location.assign("/");
		} catch (err) {
			setPending(false);
			setError(err instanceof Error ? err.message : "Could not sign in.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-xl border border-line bg-sheet p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "font-serif text-2xl font-semibold text-balance",
				children: "Sign in"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm text-pretty text-muted",
				children: [
					"Students use their RGUKT Ongole mail. The evaluation cell signs in as ",
					ADMIN_EMAIL,
					"."
				]
			}),
			signedInAs ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn",
				role: "status",
				children: [
					"Signed in as ",
					signedInAs,
					". That address is not on the lab roll. Use a college ID below."
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void signIn("grok-google", { callbackURL: "/" }),
				className: "mt-5 flex h-11 w-full items-center justify-center rounded-md border border-line bg-sheet px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-80",
				children: "Continue with Google"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "my-4 text-center text-xs font-medium tracking-wide text-muted uppercase",
				children: "or email and password"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				onSubmit,
				className: "space-y-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm font-medium",
						htmlFor: "lab-email",
						children: ["Email", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "lab-email",
							type: "email",
							autoComplete: "username",
							required: true,
							value: email,
							onChange: (event) => setEmail(event.target.value),
							placeholder: "o234747@rguktong.ac.in",
							className: "mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3 text-base text-ink outline-none placeholder:text-muted"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block text-sm font-medium",
						htmlFor: "lab-password",
						children: ["Password", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "lab-password",
							type: "password",
							autoComplete: mode === "up" ? "new-password" : "current-password",
							required: true,
							minLength: 8,
							value: password,
							onChange: (event) => setPassword(event.target.value),
							className: "mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3 text-base text-ink outline-none"
						})]
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-danger",
						role: "alert",
						children: error
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: pending,
						className: "flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50",
						children: pending ? "Checking the roll…" : mode === "up" ? "Create account" : "Sign in"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => {
					setMode(mode === "in" ? "up" : "in");
					setError("");
				},
				className: "mt-4 text-sm font-medium text-accent",
				children: mode === "in" ? "First time? Create an account" : "Already registered? Sign in"
			})
		]
	});
}
function Rules() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
		className: "mt-8 space-y-3 text-sm text-pretty text-muted",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-accent",
					children: "01"
				}), "Five experiments. A clean trace is 10 marks."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-accent",
					children: "02"
				}), "C, C++, and Python are checked for errors that would stop a compiler or interpreter."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-accent",
					children: "03"
				}), "If more than 75% of the program reads as AI-written, 5 marks are deducted."]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "flex gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-xs text-accent",
					children: "04"
				}), "The total on screen is programs plus the viva choices, out of 60. Oral answers are 10 more, marked after the recordings are watched."]
			})
		]
	});
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var getAccess = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("148791e72a45ee0dd98992b6a3a62544c931d41e796274c574fe367d653ca7f4"));
var listMine = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("e4751aa05be1d6bfd68599d72ed01a0f95d11309a1087ccae6b5bb081f79d87b"));
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
}).middleware([authMiddleware]).handler(createSsrRpc("ee37e0a96cd23ef5b6e8ed68607d459daed2eb046b1293d68e2cb34d3ef441a3"));
var listAll = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("029b2beacc6a0778c1d1b2567b6dfd6ee67dda1026bf498c867c40c0a27e051a"));
var exportMarks = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("4691472b7bf24c49d8d4738ed8c6669e35d1f65742f26de96e7f079fed847f69"));
var KIND = /^(oral|spoken|mcq|choice)$/i;
var OPTION = /^([A-D])[).]\s*(.+)$/i;
var ANSWER = /^answer\s+([A-D])$/i;
function parseQuestionBank(raw) {
	const lines = raw.replace(/\r\n/g, "\n").split("\n");
	const blocks = [];
	let current = null;
	for (const line of lines) {
		if (KIND.test(line.trim())) {
			if (current) blocks.push(current);
			current = [line.trim()];
			continue;
		}
		if (current) current.push(line);
	}
	if (current) blocks.push(current);
	if (blocks.length === 0) throw new Error("Start each question with ORAL or MCQ.");
	return blocks.map((block, index) => {
		const where = `Question ${index + 1}`;
		const head = block[0]?.trim().toLowerCase() ?? "";
		const kind = head === "oral" || head === "spoken" ? "oral" : "mcq";
		const promptLines = [];
		const choices = [
			"",
			"",
			"",
			""
		];
		let answer = null;
		for (const line of block.slice(1)) {
			const trimmed = line.trim();
			if (!trimmed) {
				if (promptLines.length) promptLines.push("");
				continue;
			}
			const option = OPTION.exec(trimmed);
			if (option && kind === "mcq") {
				const slot = option[1].toUpperCase().charCodeAt(0) - 65;
				choices[slot] = option[2].trim();
				continue;
			}
			const marked = ANSWER.exec(trimmed);
			if (marked && kind === "mcq") {
				answer = marked[1].toUpperCase().charCodeAt(0) - 65;
				continue;
			}
			promptLines.push(trimmed);
		}
		const prompt = promptLines.join("\n").trim();
		if (prompt.length < 3) throw new Error(`${where} needs a question.`);
		if (prompt.length > 1e3) throw new Error(`${where} is too long.`);
		if (kind === "oral") return {
			kind,
			prompt,
			choices: [],
			answer: null
		};
		if (choices.some((choice) => choice.length < 1)) throw new Error(`${where} needs options A) B) C) and D).`);
		if (answer == null) throw new Error(`${where} needs a line like ANSWER B.`);
		return {
			kind,
			prompt,
			choices,
			answer
		};
	});
}
function asInt(value) {
	if (value == null || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? Math.round(n) : null;
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
var getViva = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("594d0afb1f063a04837fbb6895bd9c9c079dfc69c625b619e2e8172f654eac2b"));
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
}).middleware([authMiddleware]).handler(createSsrRpc("d43b555925568a7b2cbd3d3261a63576382a6fcf486bf3e4acdd88704900963c"));
var listBank = createServerFn({ method: "GET" }).middleware([authMiddleware]).handler(createSsrRpc("96b4b56854f4758b71fd26e8fb5ab9d646cfc7b4e34f91034887b0d15cf83e57"));
var addQuestions = createServerFn({ method: "POST" }).validator(checkDraft).middleware([authMiddleware]).handler(createSsrRpc("5558380e3231c0a7db2136a3aaa5299fde071157be1f8e92cff49580f9a35fea"));
var getStudentViva = createServerFn({ method: "POST" }).validator((input) => {
	const studentId = String(input?.studentId ?? "").trim();
	if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(studentId)) throw new Error("Unknown student.");
	return { studentId };
}).middleware([authMiddleware]).handler(createSsrRpc("37106dab884caa95bed27cbf1fbdee24099a610e0897754f3558f2722cea475d"));
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
}).middleware([authMiddleware]).handler(createSsrRpc("6a15c2e8dff9c50e895a1ca74ddbc6e6582eadf33beac0656a48fe53ec74ffb9"));
function apiPath$1(path) {
	return `${previewPathPrefix(window.location.hostname, window.location.pathname) ?? ""}${path}`;
}
function authHeaders$1() {
	const headers = new Headers();
	const token = getBearerToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
}
function VivaBank() {
	const [items, setItems] = (0, import_react.useState)([]);
	const [counts, setCounts] = (0, import_react.useState)({
		oralCount: 0,
		mcqCount: 0
	});
	const [kind, setKind] = (0, import_react.useState)("oral");
	const [prompt, setPrompt] = (0, import_react.useState)("");
	const [choices, setChoices] = (0, import_react.useState)([
		"",
		"",
		"",
		""
	]);
	const [answer, setAnswer] = (0, import_react.useState)(0);
	const [bulk, setBulk] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	async function refresh() {
		const bank = await listBank();
		setItems(bank.items);
		setCounts({
			oralCount: bank.oralCount,
			mcqCount: bank.mcqCount
		});
	}
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		listBank().then((bank) => {
			if (cancelled) return;
			setItems(bank.items);
			setCounts({
				oralCount: bank.oralCount,
				mcqCount: bank.mcqCount
			});
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the question bank.");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	async function publish(questions) {
		setBusy(true);
		setError("");
		try {
			const next = await addQuestions({ data: { questions } });
			setCounts(next);
			setPrompt("");
			setChoices([
				"",
				"",
				"",
				""
			]);
			setBulk("");
			await refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not add questions.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "mt-8 rounded-xl border border-line bg-sheet p-5 sm:p-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-serif text-2xl font-semibold",
					children: "Viva bank"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [
						counts.oralCount,
						" spoken · ",
						counts.mcqCount,
						" choice. Each student is given 5 of each. Aim for about 60."
					]
				})] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex gap-1 rounded-md bg-well p-1 w-fit",
				children: ["oral", "mcq"].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setKind(item),
					className: `h-11 rounded-md px-4 text-sm font-semibold ${kind === item ? "bg-accent text-accent-fg" : "text-muted"}`,
					children: item === "oral" ? "Spoken" : "Choice"
				}, item))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 block text-sm font-medium",
				htmlFor: "viva-prompt",
				children: ["Question", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					id: "viva-prompt",
					value: prompt,
					onChange: (event) => setPrompt(event.target.value),
					rows: 3,
					className: "mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 text-base outline-none"
				})]
			}),
			kind === "mcq" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 grid gap-2 sm:grid-cols-2",
				children: choices.map((choice, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: String.fromCharCode(65 + index)
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							value: choice,
							onChange: (event) => setChoices((prev) => prev.map((item, itemIndex) => itemIndex === index ? event.target.value : item)),
							className: "mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "mt-1 flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "radio",
								name: "viva-answer",
								checked: answer === index,
								onChange: () => setAnswer(index)
							}), "Correct"]
						})
					]
				}, index))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: busy,
				onClick: () => void publish([{
					kind,
					prompt: prompt.trim(),
					choices: kind === "mcq" ? choices.map((choice) => choice.trim()) : [],
					answer: kind === "mcq" ? answer : null
				}]),
				className: "mt-4 h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50",
				children: "Add question"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-6 block text-sm font-medium",
				htmlFor: "viva-bulk",
				children: ["Or paste several. Start each with ORAL or MCQ. Choice questions need A) B) C) D) and a line ANSWER B.", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
					id: "viva-bulk",
					value: bulk,
					onChange: (event) => setBulk(event.target.value),
					rows: 8,
					className: "mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 font-mono text-sm outline-none"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: busy || bulk.trim().length === 0,
				onClick: () => {
					try {
						publish(parseQuestionBank(bulk));
					} catch (err) {
						setError(err instanceof Error ? err.message : "Could not read those questions.");
					}
				},
				className: "mt-3 h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-50",
				children: "Add pasted questions"
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-danger",
				children: error
			}) : null,
			items.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-4 max-h-64 space-y-2 overflow-auto text-sm",
				children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-md bg-well px-3 py-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "font-medium",
							children: [item.kind === "oral" ? "Spoken" : "Choice", "."]
						}),
						" ",
						item.prompt
					]
				}, item.id))
			}) : null
		]
	});
}
function VivaReview({ studentId }) {
	const [items, setItems] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getStudentViva({ data: { studentId } }).then((rows) => {
			if (!cancelled) setItems(rows);
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this viva.");
		});
		return () => {
			cancelled = true;
		};
	}, [studentId]);
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-danger",
		children: error
	});
	if (!items) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "Loading viva…"
	});
	if (items.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-muted",
		children: "No viva paper yet."
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
			className: "font-semibold",
			children: "Viva"
		}), items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
			className: "rounded-md bg-sheet p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm font-medium text-muted",
					children: [
						index + 1,
						". ",
						item.kind === "oral" ? "Spoken" : "Choice",
						item.awarded != null ? ` · ${item.awarded}/2` : ""
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-pretty",
					children: item.prompt
				}),
				item.kind === "oral" ? item.hasVideo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OralClip, {
					studentId,
					questionId: item.questionId,
					awarded: item.awarded,
					onAwarded: (marks) => setItems((prev) => prev?.map((row) => row.questionId === item.questionId ? {
						...row,
						awarded: marks
					} : row) ?? prev)
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: "No recording yet."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted",
					children: item.selected == null ? "Not answered." : `Chose option ${String.fromCharCode(65 + item.selected)}.`
				})
			]
		}, item.questionId))]
	});
}
function OralClip({ studentId, questionId, awarded, onAwarded }) {
	const [src, setSrc] = (0, import_react.useState)("");
	const [error, setError] = (0, import_react.useState)("");
	const [marks, setMarks] = (0, import_react.useState)(awarded ?? 0);
	(0, import_react.useEffect)(() => {
		let url = "";
		let cancelled = false;
		fetch(apiPath$1(`/api/viva-video?questionId=${questionId}&studentId=${encodeURIComponent(studentId)}`), { headers: authHeaders$1() }).then(async (response) => {
			if (!response.ok) throw new Error("Could not load the recording.");
			const blob = await response.blob();
			if (cancelled) return;
			url = URL.createObjectURL(blob);
			setSrc(url);
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the recording.");
		});
		return () => {
			cancelled = true;
			if (url) URL.revokeObjectURL(url);
		};
	}, [questionId, studentId]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3",
		children: [
			src ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				src,
				controls: true,
				className: "aspect-video w-full max-w-md rounded-md bg-well"
			}) : null,
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-danger",
				children: error
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-2 flex flex-wrap items-center gap-2",
				children: [[
					0,
					1,
					2
				].map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setMarks(value),
					className: `h-11 rounded-md px-3 text-sm font-semibold ${marks === value ? "bg-accent text-accent-fg" : "bg-well"}`,
					children: value
				}, value)), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						awardOral({ data: {
							studentId,
							questionId,
							marks
						} }).then(() => onAwarded(marks)).catch((err) => setError(err instanceof Error ? err.message : "Could not save the mark."));
					},
					className: "h-11 rounded-md border border-line px-4 text-sm font-semibold",
					children: "Award"
				})]
			})
		]
	});
}
var LANG = {
	c: "C",
	cpp: "C++",
	python: "Python"
};
function AdminBoard() {
	const [students, setStudents] = (0, import_react.useState)([]);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [error, setError] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [open, setOpen] = (0, import_react.useState)(null);
	async function load() {
		setError("");
		setLoading(true);
		try {
			setStudents(await listAll());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not load the mark sheet.");
		} finally {
			setLoading(false);
		}
	}
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		listAll().then((rows) => {
			if (!cancelled) setStudents(rows);
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the mark sheet.");
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	async function onDownload() {
		setBusy(true);
		setError("");
		try {
			const file = await exportMarks();
			const blob = new Blob([file.xml], { type: "application/vnd.ms-excel" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = file.filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not download the sheet.");
		} finally {
			setBusy(false);
		}
	}
	const average = students.length ? Math.round(students.reduce((sum, student) => sum + student.total, 0) / students.length) : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-muted",
					children: "Evaluation cell"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "font-serif text-3xl font-semibold tabular-nums",
					children: [students.length, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-lg font-medium text-muted",
						children: [" students · avg ", average]
					})]
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void load(),
						className: "h-11 rounded-md border border-line bg-sheet px-4 text-sm font-semibold",
						children: "Refresh"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void onDownload(),
						disabled: busy,
						className: "h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50",
						children: busy ? "Preparing…" : "Download XLS"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-3 text-sm text-muted",
				children: "Blank cells are not submitted. Programs are out of 50. Viva choices are out of 10 and appear when the student presses Save. Oral is out of 10 after you award the recordings. The sheet total is programs plus those viva marks. The 60 a student sees immediately is programs plus choices."
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-danger",
				role: "alert",
				children: error
			}) : null,
			loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 text-sm text-muted",
				children: "Loading submissions…"
			}) : null,
			!loading && students.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-6 rounded-xl border border-line bg-sheet p-6 text-sm text-muted",
				children: "No submissions yet."
			}) : null,
			students.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-6 overflow-x-auto rounded-xl border border-line bg-sheet",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[44rem] border-collapse text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "border-b border-line text-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "ID"
							}),
							[
								1,
								2,
								3,
								4,
								5
							].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("th", {
								className: "px-3 py-3 font-medium",
								children: ["Exp ", n]
							}, n)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 font-medium",
								children: "Choices"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-3 py-3 font-medium",
								children: "Oral"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3 font-medium",
								children: "Total"
							})
						] })
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: students.map((student) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "px-4 py-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setOpen(open === student.studentId ? null : student.studentId),
									className: "font-mono font-medium text-accent",
									children: student.studentId
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs text-muted",
									children: student.email
								})]
							}),
							student.marks.map((mark, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-3 font-mono tabular-nums",
								children: mark == null ? "—" : mark
							}, index)),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-3 font-mono tabular-nums",
								children: student.vivaMcq == null ? "—" : student.vivaMcq
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-3 py-3 font-mono tabular-nums",
								children: student.vivaOral == null ? "—" : student.vivaOral
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 font-mono font-semibold tabular-nums",
								children: student.total
							})
						]
					}), open === student.studentId ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
						className: "border-b border-line",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							colSpan: 9,
							className: "bg-well px-4 py-4",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "space-y-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VivaReview, { studentId: student.studentId }), student.experiments.map((experiment) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "rounded-md bg-sheet p-4",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "flex flex-wrap items-baseline justify-between gap-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
												className: "font-semibold",
												children: [
													"Experiment ",
													experiment.experiment,
													/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
														className: "ml-2 text-sm font-medium text-muted",
														children: LANG[experiment.language] ?? experiment.language
													})
												]
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
												className: "font-mono tabular-nums",
												children: [experiment.awardedMarks, "/10"]
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm text-pretty",
											children: experiment.aim
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm text-pretty text-muted",
											children: experiment.comment
										}),
										experiment.diagnostics.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
											className: "mt-2 text-sm text-danger",
											children: experiment.diagnostics.map((issue) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
												"Line ",
												issue.line,
												": ",
												issue.message
											] }, `${issue.line}-${issue.message}`))
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
											className: "mt-3 max-h-80 overflow-auto rounded-md bg-well p-3 font-mono text-xs leading-5 whitespace-pre",
											children: experiment.code
										})
									]
								}, experiment.experiment))]
							})
						})
					}) : null] }, student.studentId)) })]
				})
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(VivaBank, {})
		]
	});
}
function CodeEditor({ value, onChange }) {
	const area = (0, import_react.useRef)(null);
	const gutter = (0, import_react.useRef)(null);
	const lines = Math.max(1, value.split("\n").length);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "overflow-hidden rounded-md border border-line bg-well",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex h-96",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				ref: gutter,
				"aria-hidden": "true",
				className: "w-11 shrink-0 overflow-hidden border-r border-line py-3 text-right font-mono text-sm text-muted select-none",
				children: Array.from({ length: lines }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-6 px-2 leading-6",
					children: index + 1
				}, index))
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
				ref: area,
				value,
				spellCheck: false,
				onScroll: (event) => {
					if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
				},
				onChange: (event) => onChange(event.target.value),
				onKeyDown: (event) => {
					if (event.key !== "Tab") return;
					event.preventDefault();
					const el = event.currentTarget;
					const start = el.selectionStart;
					const end = el.selectionEnd;
					onChange(`${value.slice(0, start)}    ${value.slice(end)}`);
					requestAnimationFrame(() => {
						el.selectionStart = start + 4;
						el.selectionEnd = start + 4;
					});
				},
				placeholder: "Paste a complete C, C++, or Python program",
				className: "h-full min-h-0 w-full resize-none bg-transparent px-3 py-3 font-mono text-sm leading-6 text-ink outline-none placeholder:text-muted",
				"aria-label": "Program"
			})]
		})
	});
}
function apiPath(path) {
	return `${previewPathPrefix(window.location.hostname, window.location.pathname) ?? ""}${path}`;
}
function authHeaders() {
	const headers = new Headers();
	const token = getBearerToken();
	if (token) headers.set("Authorization", `Bearer ${token}`);
	return headers;
}
function VivaDesk({ onScore }) {
	const [paper, setPaper] = (0, import_react.useState)(null);
	const [cursor, setCursor] = (0, import_react.useState)(0);
	const [choices, setChoices] = (0, import_react.useState)({});
	const [error, setError] = (0, import_react.useState)("");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [note, setNote] = (0, import_react.useState)("");
	const onScoreRef = (0, import_react.useRef)(onScore);
	onScoreRef.current = onScore;
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getViva().then((next) => {
			if (cancelled) return;
			setPaper(next);
			const picked = {};
			for (const card of next.questions) picked[card.id] = card.selected;
			setChoices(picked);
			onScoreRef.current({
				mcq: next.mcqMarks,
				oral: next.oralMarks,
				saved: next.saved
			});
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the viva.");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	const card = paper?.questions[cursor];
	async function onSave() {
		if (!paper) return;
		setSaving(true);
		setError("");
		setNote("");
		try {
			const next = await saveViva({ data: { answers: paper.questions.filter((item) => item.kind === "mcq").map((item) => ({
				questionId: item.id,
				choice: choices[item.id] ?? null
			})) } });
			setPaper(next);
			onScore({
				mcq: next.mcqMarks,
				oral: next.oralMarks,
				saved: next.saved
			});
			const shown = next.mcqMarks ?? 0;
			setNote(`Saved. Viva choices are ${shown}/10, and that is included in the 60.`);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save.");
		} finally {
			setSaving(false);
		}
	}
	function markVideo(questionId) {
		setPaper((prev) => prev ? {
			...prev,
			questions: prev.questions.map((item) => item.id === questionId ? {
				...item,
				hasVideo: true
			} : item)
		} : prev);
	}
	if (error && !paper) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-8 text-sm text-danger",
		children: error
	});
	if (!paper) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "mt-8 text-sm text-muted",
		children: "Loading the viva…"
	});
	if (!paper.ready || !card) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
		className: "mt-8 rounded-xl border border-line bg-sheet p-6 text-sm text-muted",
		children: [
			"The viva opens when the evaluation cell has published at least five spoken questions and five choice questions. The bank has ",
			paper.oralCount,
			" spoken and ",
			paper.mcqCount,
			" choice questions."
		]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm font-medium text-muted",
					children: [
						"Question ",
						card.index,
						" of ",
						paper.questions.length
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-serif text-2xl font-semibold",
					children: card.kind === "oral" ? "Spoken answer" : "Choice question"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Each question is 2 marks. Five are recorded. Five are choices."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex gap-2 overflow-x-auto pb-1",
				children: paper.questions.map((item, index) => {
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setCursor(index),
						className: `h-11 shrink-0 rounded-md px-3 text-sm font-semibold ${index === cursor ? "bg-accent text-accent-fg" : "bg-well text-ink"}`,
						children: [item.index, item.kind === "oral" ? item.hasVideo ? " · saved" : " · cam" : item.awarded != null ? ` · ${item.awarded}` : ""]
					}, item.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "mt-4 rounded-xl border border-line bg-sheet p-5 sm:p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-base text-pretty",
						children: card.prompt
					}),
					card.kind === "mcq" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-2",
						role: "radiogroup",
						"aria-label": "Options",
						children: [card.choices.map((choice, index) => {
							const selected = choices[card.id] === index;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "radio",
								"aria-checked": selected,
								onClick: () => setChoices((prev) => ({
									...prev,
									[card.id]: index
								})),
								className: `flex min-h-11 w-full items-center rounded-md border px-3 text-left text-sm ${selected ? "border-accent bg-accent-soft" : "border-line bg-sheet"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mr-3 font-mono text-muted",
									children: String.fromCharCode(65 + index)
								}), choice]
							}, choice);
						}), card.awarded != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm font-medium",
							children: card.awarded === 2 ? "Correct. 2 marks." : "Not the right option. 0 marks."
						}) : null]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Capture, {
						questionId: card.id,
						hasVideo: card.hasVideo,
						awarded: card.awarded,
						onSaved: () => markVideo(card.id)
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-danger",
						role: "alert",
						children: error
					}) : null,
					note ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 text-sm text-ok",
						children: note
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 flex flex-wrap gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setCursor((index) => Math.max(0, index - 1)),
								disabled: cursor === 0,
								className: "h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-40",
								children: "Previous"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setCursor((index) => Math.min(paper.questions.length - 1, index + 1)),
								disabled: cursor === paper.questions.length - 1,
								className: "h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-40",
								children: "Next"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void onSave(),
								disabled: saving,
								className: "h-11 rounded-md bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-50",
								children: saving ? "Saving…" : "Save"
							})
						]
					})
				]
			})
		]
	});
}
function Capture({ questionId, hasVideo, awarded, onSaved }) {
	const previewRef = (0, import_react.useRef)(null);
	const streamRef = (0, import_react.useRef)(null);
	const recorderRef = (0, import_react.useRef)(null);
	const chunksRef = (0, import_react.useRef)([]);
	const timerRef = (0, import_react.useRef)(null);
	const [recording, setRecording] = (0, import_react.useState)(false);
	const [seconds, setSeconds] = (0, import_react.useState)(0);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [localSaved, setLocalSaved] = (0, import_react.useState)(hasVideo);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		setLocalSaved(hasVideo);
	}, [hasVideo, questionId]);
	(0, import_react.useEffect)(() => {
		return () => {
			if (timerRef.current) window.clearInterval(timerRef.current);
			const recorder = recorderRef.current;
			if (recorder && recorder.state === "recording") recorder.stop();
			else streamRef.current?.getTracks().forEach((track) => track.stop());
		};
	}, []);
	function stopTracks() {
		if (timerRef.current) window.clearInterval(timerRef.current);
		timerRef.current = null;
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;
		if (previewRef.current) previewRef.current.srcObject = null;
	}
	async function upload(blob) {
		setBusy(true);
		setError("");
		try {
			const body = new FormData();
			body.set("questionId", String(questionId));
			body.set("file", blob, "answer.webm");
			const response = await fetch(apiPath("/api/viva-video"), {
				method: "POST",
				headers: authHeaders(),
				body
			});
			if (!response.ok) throw new Error(await response.text());
			setLocalSaved(true);
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save the recording.");
		} finally {
			setBusy(false);
		}
	}
	async function start() {
		setError("");
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
			setError("This browser cannot record from the camera.");
			return;
		}
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: { facingMode: "user" },
				audio: true
			});
			streamRef.current = stream;
			if (previewRef.current) {
				previewRef.current.srcObject = stream;
				await previewRef.current.play();
			}
			const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus") ? "video/webm;codecs=vp8,opus" : MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "";
			const recorder = new MediaRecorder(stream, mime ? {
				mimeType: mime,
				videoBitsPerSecond: 35e4
			} : void 0);
			chunksRef.current = [];
			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.onstop = () => {
				const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
				stopTracks();
				setRecording(false);
				if (blob.size > 0) upload(blob);
			};
			recorderRef.current = recorder;
			recorder.start();
			setRecording(true);
			setSeconds(0);
			const started = Date.now();
			timerRef.current = window.setInterval(() => {
				const elapsed = Math.floor((Date.now() - started) / 1e3);
				setSeconds(elapsed);
				if (elapsed >= 45) recorder.stop();
			}, 250);
		} catch {
			setError("Allow the camera and microphone, then try Capture again.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
				ref: previewRef,
				muted: true,
				playsInline: true,
				className: "aspect-video w-full max-w-md rounded-md bg-well"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center gap-2",
				children: [recording ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => recorderRef.current?.stop(),
					className: "h-11 rounded-md bg-danger px-4 text-sm font-semibold text-accent-fg",
					children: [
						"Stop · ",
						seconds,
						"s"
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => void start(),
					disabled: busy,
					className: "h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50",
					children: busy ? "Saving recording…" : localSaved ? "Capture again" : "Capture"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted",
					children: [localSaved ? "Recording saved." : "Up to 45 seconds from this laptop camera.", awarded != null ? ` Marked ${awarded}/2.` : " Waiting for the evaluation cell."]
				})]
			}),
			error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-sm text-danger",
				children: error
			}) : null
		]
	});
}
var LANGS = [
	{
		id: "c",
		label: "C"
	},
	{
		id: "cpp",
		label: "C++"
	},
	{
		id: "python",
		label: "Python"
	}
];
function blankSlots() {
	return [
		1,
		2,
		3,
		4,
		5
	].map((experiment) => ({
		experiment,
		aim: "",
		language: "python",
		code: "",
		saved: null
	}));
}
function StudentDesk({ studentId }) {
	const [slots, setSlots] = (0, import_react.useState)(blankSlots);
	const [current, setCurrent] = (0, import_react.useState)(1);
	const [loading, setLoading] = (0, import_react.useState)(true);
	const [running, setRunning] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)("");
	const [desk, setDesk] = (0, import_react.useState)("programs");
	const [viva, setViva] = (0, import_react.useState)({
		mcq: null,
		oral: null,
		saved: false
	});
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		listMine().then((rows) => {
			if (cancelled) return;
			setSlots((prev) => prev.map((slot) => {
				const saved = rows.find((row) => row.experiment === slot.experiment);
				if (!saved) return slot;
				return {
					experiment: slot.experiment,
					aim: saved.aim,
					language: saved.language,
					code: saved.code,
					saved
				};
			}));
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not load submissions.");
		}).finally(() => {
			if (!cancelled) setLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getViva().then((next) => {
			if (!cancelled) setViva({
				mcq: next.mcqMarks,
				oral: next.oralMarks,
				saved: next.saved
			});
		}).catch(() => void 0);
		return () => {
			cancelled = true;
		};
	}, []);
	const slot = slots[current - 1] ?? slots[0];
	if (!slot) return null;
	const programs = slots.reduce((sum, item) => sum + (item.saved?.awardedMarks ?? 0), 0);
	const shown = programs + (viva.saved ? viva.mcq ?? 0 : 0);
	function update(patch) {
		setSlots((prev) => prev.map((item) => item.experiment === current ? {
			...item,
			...patch
		} : item));
	}
	async function onRun() {
		setError("");
		setRunning(true);
		try {
			const saved = await runExperiment({ data: {
				experiment: slot.experiment,
				aim: slot.aim,
				language: slot.language,
				code: slot.code
			} });
			setSlots((prev) => prev.map((item) => item.experiment === saved.experiment ? {
				experiment: saved.experiment,
				aim: saved.aim,
				language: saved.language,
				code: saved.code,
				saved
			} : item));
		} catch (err) {
			setError(err instanceof Error ? err.message : "The trace failed.");
		} finally {
			setRunning(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-medium text-muted",
					children: "Student ID"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-lg font-medium",
					children: studentId
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "text-right",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "font-serif text-3xl font-semibold tabular-nums",
						children: [shown, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-lg font-medium text-muted",
							children: " / 60"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted",
						children: [
							"Programs ",
							programs,
							"/50",
							viva.saved ? ` · choices ${viva.mcq ?? 0}/10` : " · choices not saved",
							viva.oral == null ? " · oral not marked" : ` · oral ${viva.oral}/10`
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-2 gap-1 rounded-md bg-well p-1 sm:flex sm:w-fit",
				role: "tablist",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": desk === "programs",
					onClick: () => setDesk("programs"),
					className: `h-11 rounded-md px-4 text-sm font-semibold ${desk === "programs" ? "bg-accent text-accent-fg" : "text-muted"}`,
					children: "Programs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": desk === "viva",
					onClick: () => setDesk("viva"),
					className: `h-11 rounded-md px-4 text-sm font-semibold ${desk === "viva" ? "bg-accent text-accent-fg" : "text-muted"}`,
					children: "Viva"
				})]
			}),
			desk === "viva" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VivaDesk, { onScore: setViva }) : null,
			desk === "programs" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
					"aria-label": "Experiments",
					className: "flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible",
					children: slots.map((item) => {
						const selected = item.experiment === current;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setCurrent(item.experiment),
							className: `w-56 shrink-0 rounded-xl border p-4 text-left lg:w-auto ${selected ? "border-accent bg-accent-soft" : "border-line bg-sheet"}`,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-sm font-semibold",
									children: ["Experiment ", item.experiment]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mark, { saved: item.saved })]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mt-2 block text-sm text-pretty text-muted line-clamp-3",
								children: item.saved?.comment || "Not submitted"
							})]
						}, item.experiment);
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "rounded-xl border border-line bg-sheet p-5 sm:p-6",
					children: [loading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted",
						children: "Loading your experiments…"
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "space-y-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-semibold",
								children: "1. Experiment"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-sm text-muted",
								children: [
									"Experiment ",
									slot.experiment,
									" of 5"
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "block",
								htmlFor: "aim",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-sm font-semibold",
									children: "2. Aim of the experiment"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
									id: "aim",
									value: slot.aim,
									onChange: (event) => update({ aim: event.target.value }),
									rows: 3,
									placeholder: "What this experiment demonstrates",
									className: "mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 text-base text-ink outline-none placeholder:text-muted"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center justify-between gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-semibold",
									children: "3. Program"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									role: "radiogroup",
									"aria-label": "Language",
									className: "flex rounded-md border border-line p-1",
									children: LANGS.map((lang) => {
										const active = slot.language === lang.id;
										return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											type: "button",
											role: "radio",
											"aria-checked": active,
											onClick: () => update({ language: lang.id }),
											className: `h-9 rounded-md px-3 text-sm font-semibold ${active ? "bg-accent text-accent-fg" : "text-muted"}`,
											children: lang.label
										}, lang.id);
									})
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CodeEditor, {
									value: slot.code,
									onChange: (code) => update({ code })
								})
							})] }),
							error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-danger",
								role: "alert",
								children: error
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void onRun(),
								disabled: running || loading,
								className: "flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50",
								children: running ? "Tracing…" : "Run"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm text-pretty text-muted",
								children: "Run traces syntax and the errors that would stop a compiler or interpreter, then estimates how much of the code was written by AI. It does not execute the program."
							}),
							slot.saved ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Result, { saved: slot.saved }) : null
						]
					})]
				})]
			}) : null
		]
	});
}
function Mark({ saved }) {
	if (!saved) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: "font-mono text-sm text-muted",
		children: "—"
	});
	const tone = saved.awardedMarks >= 10 ? "text-ok" : saved.awardedMarks > 0 ? "text-warn" : "text-danger";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: `font-mono text-sm font-medium tabular-nums ${tone}`,
		children: [saved.awardedMarks, "/10"]
	});
}
function Result({ saved }) {
	const tone = saved.runsOk ? saved.deducted ? "border-warn bg-warn-soft text-warn" : "border-ok bg-ok-soft text-ok" : "border-danger bg-danger-soft text-danger";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: `rounded-md border px-4 py-3 ${tone}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-semibold tabular-nums",
				children: [saved.awardedMarks, " / 10"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-sm text-ink",
				children: saved.comment
			}),
			saved.diagnostics.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-3 space-y-1 text-sm text-ink",
				children: saved.diagnostics.map((issue) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
					"Line ",
					issue.line,
					": ",
					issue.message
				] }, `${issue.line}-${issue.message}`))
			}) : null
		]
	});
}
function PortalHome() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, {});
	if (!user) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Frame, {
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Intro, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 lg:mt-0",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginCard, {})
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SignedIn, {});
}
function SignedIn() {
	const [access, setAccess] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)("");
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		getAccess().then((next) => {
			if (!cancelled) setAccess(next);
		}).catch((err) => {
			if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the portal.");
		});
		return () => {
			cancelled = true;
		};
	}, []);
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "text-sm text-danger",
		role: "alert",
		children: error
	}) });
	if (!access) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, {});
	if (!access.role) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Frame, {
		wide: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Intro, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-8 lg:mt-0",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginCard, { signedInAs: access.email })
		})]
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, { children: access.role === "admin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminBoard, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StudentDesk, { studentId: access.studentId ?? access.email }) });
}
function Intro() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "max-w-xl text-base text-pretty text-muted",
		children: "Design and Analysis of Algorithms. Paste each experiment, run the trace, and keep the mark beside the program."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Rules, {})] });
}
function Frame({ children, wide = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative min-h-screen bg-paper text-ink",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-1 bg-accent" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-start justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm font-semibold tracking-wide text-accent uppercase",
					children: "RGUKT Ongole"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-2 max-w-3xl font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl",
					children: "DAA RGUKT ONGOLE LAB EVALUATION PORTAL"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(UserButton, {})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: wide ? "mt-8 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:items-start lg:gap-12" : "",
				children
			})]
		})]
	});
}
//#endregion
export { useCurrentUserState as n, PortalHome as t };
