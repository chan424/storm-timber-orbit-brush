const ADMINS = ["ncs@rguktong.ac.in", "dataongole@gmail.com"];
const DOMAIN = "rguktong.ac.in";

const DEFAULT_LABS = [
  { slug: "c", code: "C", title: "C Programming", language: "c", choose: false, aims: ["Print a pattern and the sum of a series using loops.", "Search and sort an array of integers.", "Use pointers to swap values and reverse a string.", "Store student records with structures.", "Read and write a text file."] },
  { slug: "cpp", code: "C++", title: "C++ Programming", language: "cpp", choose: false, aims: ["Write a class with a constructor and print its fields.", "Overload a function and an operator.", "Inherit a base class and override a method.", "Store values in a vector and sort them.", "Read records from a file into objects."] },
  { slug: "java", code: "Java", title: "Java Programming", language: "java", choose: false, aims: ["Print a multiplication table from a class with main.", "Use an array and a method to find the largest value.", "Create a class with a constructor and two methods.", "Extend a class and call the parent constructor.", "Catch an exception around integer input."] },
  { slug: "python", code: "Py", title: "Python Programming", language: "python", choose: false, aims: ["Compute factorial and Fibonacci with functions.", "Filter and sort a list of numbers.", "Count words in a sentence using a dictionary.", "Read a CSV-like text file and print totals.", "Define a class with an instance method."] },
  { slug: "cn", code: "CN", title: "Computer Networks", language: "python", choose: false, aims: ["Write a TCP echo client and server.", "Write a UDP client that sends one datagram.", "Compute an even parity bit for a bit string.", "Simulate stop-and-wait with sequence numbers.", "Parse a dotted IPv4 address and print the octets."] },
  { slug: "os", code: "OS", title: "Operating Systems", language: "c", choose: false, aims: ["Compute FCFS average waiting time for a list of bursts.", "Compute SJF average waiting time.", "Simulate round robin with a fixed quantum.", "Implement a producer-consumer buffer with counters.", "Show the difference between fork-style process ids using printed steps."] },
  { slug: "se", code: "SE", title: "Software Engineering", language: "python", choose: false, aims: ["Estimate effort with basic COCOMO from size and constants.", "Compute cyclomatic complexity from edges, nodes, and components.", "Turn a requirement sentence into numbered test cases.", "Apply a boundary-value check to an input range.", "Print a traceability row from requirement id to test id."] },
  { slug: "daa", code: "DAA", title: "Design and Analysis of Algorithms", language: "python", choose: true, aims: ["Sort a list with merge sort and print the steps.", "Find a shortest path with Dijkstra's algorithm.", "Solve 0/1 knapsack with dynamic programming.", "Build a Huffman tree and print the codes.", "Place N queens so that none attack each other."] },
];

const LANGS = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
];

const app = document.querySelector("#app");
const signout = document.querySelector("#signout");
let editing = null;
let currentExp = 1;

function session() {
  try { return JSON.parse(sessionStorage.getItem("rgukt-session") || "null"); } catch { return null; }
}
function setSession(value) {
  if (!value) sessionStorage.removeItem("rgukt-session");
  else sessionStorage.setItem("rgukt-session", JSON.stringify(value));
}
function roleFor(email) {
  const e = String(email || "").trim().toLowerCase();
  if (ADMINS.includes(e)) return "admin";
  if (e.endsWith("@" + DOMAIN) && e.split("@")[0]) return "student";
  return null;
}
function labs() {
  const saved = JSON.parse(localStorage.getItem("rgukt-labs") || "null");
  if (!Array.isArray(saved)) return DEFAULT_LABS.map((lab) => ({ ...lab, aims: [...lab.aims] }));
  return DEFAULT_LABS.map((lab) => {
    const row = saved.find((item) => item.slug === lab.slug);
    return row ? { ...lab, ...row, aims: Array.isArray(row.aims) && row.aims.length === 5 ? row.aims : lab.aims } : { ...lab, aims: [...lab.aims] };
  });
}
function saveLabs(next) {
  localStorage.setItem("rgukt-labs", JSON.stringify(next));
}
function answers() {
  return JSON.parse(localStorage.getItem("rgukt-answers") || "{}");
}
function saveAnswer(email, slug, experiment, value) {
  const all = answers();
  const key = email + "|" + slug;
  const list = Array.isArray(all[key]) ? all[key] : [];
  const rest = list.filter((item) => item.experiment !== experiment);
  rest.push(value);
  all[key] = rest;
  localStorage.setItem("rgukt-answers", JSON.stringify(all));
}
function mine(email, slug) {
  const key = email + "|" + slug;
  return answers()[key] || [];
}

function route() {
  const hash = location.hash.replace(/^#/, "") || "/";
  const lab = hash.match(/^\/lab\/([a-z0-9-]+)$/);
  return lab ? { name: "lab", slug: lab[1] } : { name: "home" };
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" }[ch]));
}

signout.addEventListener("click", () => {
  setSession(null);
  location.hash = "/";
  render();
});
window.addEventListener("hashchange", render);

function render() {
  const who = session();
  signout.hidden = !who;
  const page = route();
  if (page.name === "lab") renderLab(page.slug, who);
  else renderHome(who);
}

function renderHome(who) {
  const list = labs().map((lab) => `
    <article class="lab">
      <p class="code">${esc(lab.code)}</p>
      <h3>${esc(lab.title)}</h3>
      <div class="row">
        <a class="button" href="#/lab/${esc(lab.slug)}">Open lab</a>
        ${who && who.role === "admin" ? `<button type="button" class="ghost" data-edit="${esc(lab.slug)}">${editing === lab.slug ? "Close" : "Edit"}</button>` : ""}
      </div>
      ${who && who.role === "admin" && editing === lab.slug ? editor(lab) : ""}
    </article>`).join("");
  app.innerHTML = `
    <div class="home">
      <section>
        <p class="lead">A common desk for the CSE labs. Sign in, then open a lab.</p>
        <div class="labs">${list}</div>
      </section>
      ${who ? `<aside class="card"><h2>Signed in</h2><p class="muted">${esc(who.email)}</p><p class="muted">${who.role === "admin" ? "Use Edit on a lab to change its name or experiments." : "Open a lab and press Evaluate. The mark appears on that experiment."}</p></aside>` : signInCard()}
    </div>`;
  bindHome();
}

function signInCard() {
  return `<form id="signin" class="card stack">
    <h2>Sign in</h2>
    <p class="muted">Use a college ID such as o234747@rguktong.ac.in. The lab admin is ncs@rguktong.ac.in.</p>
    <label>Email<input id="email" type="email" required placeholder="o234747@rguktong.ac.in" /></label>
    <p id="sign-error" class="error" hidden></p>
    <button class="primary" type="submit">Continue</button>
  </form>`;
}

function editor(lab) {
  const options = LANGS.map((lang) => `<option value="${lang.id}" ${lang.id === lab.language ? "selected" : ""}>${lang.label}</option>`).join("");
  const aims = lab.aims.map((aim, i) => `<label>Experiment ${i + 1}<input data-aim="${i}" value="${esc(aim)}" /></label>`).join("");
  return `<form class="editor" data-save="${esc(lab.slug)}">
    <label>Title<input name="title" value="${esc(lab.title)}" /></label>
    <label>Language<select name="language">${options}</select></label>
    ${aims}
    <button class="primary" type="submit">Save lab</button>
  </form>`;
}

function bindHome() {
  const form = document.querySelector("#signin");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const email = document.querySelector("#email").value.trim().toLowerCase();
      const role = roleFor(email);
      const error = document.querySelector("#sign-error");
      if (!role) {
        error.hidden = false;
        error.textContent = "Use an @rguktong.ac.in college ID, or ncs@rguktong.ac.in for the admin.";
        return;
      }
      setSession({ email, role });
      render();
    });
  }
  document.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      editing = editing === button.dataset.edit ? null : button.dataset.edit;
      render();
    });
  });
  document.querySelectorAll("[data-save]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const slug = form.dataset.save;
      const next = labs().map((lab) => {
        if (lab.slug !== slug) return lab;
        const aims = [...form.querySelectorAll("[data-aim]")].map((input) => input.value.trim());
        return { ...lab, title: form.title.value.trim() || lab.title, language: form.language.value, aims };
      });
      saveLabs(next);
      editing = null;
      render();
    });
  });
}

function renderLab(slug, who) {
  const lab = labs().find((item) => item.slug === slug);
  if (!lab) {
    app.innerHTML = `<p class="error">That lab is not on the list. <a class="back" href="#/">Back to labs</a></p>`;
    return;
  }
  if (!who) {
    app.innerHTML = `<p class="muted" style="margin-top:1.5rem"><a class="back" href="#/">Sign in</a> with a college account to open ${esc(lab.title)}.</p>`;
    return;
  }
  if (who.role === "admin") {
    app.innerHTML = `<p style="margin-top:1.5rem"><a class="back" href="#/">RGUKT Labs</a></p><h2 style="margin-top:0.6rem">${esc(lab.title)}</h2><p class="muted">Students evaluate programs here. Use Edit on the lab list to change this lab.</p>`;
    return;
  }
  const saved = mine(who.email, lab.slug);
  const slot = saved.find((item) => item.experiment === currentExp);
  const total = saved.reduce((sum, item) => sum + (item.marks || 0), 0);
  const buttons = lab.aims.map((aim, index) => {
    const n = index + 1;
    const row = saved.find((item) => item.experiment === n);
    return `<button type="button" class="exp ${n === currentExp ? "on" : ""}" data-exp="${n}"><span>Experiment ${n}<b class="mark">${row ? row.marks + "/10" : "—"}</b></span></button>`;
  }).join("");
  const language = lab.choose
    ? `<label>Language<select id="language">${LANGS.filter((lang) => lang.id !== "java").map((lang) => `<option value="${lang.id}">${lang.label}</option>`).join("")}</select></label>`
    : `<p class="muted">Language: ${esc(LANGS.find((lang) => lang.id === lab.language)?.label || lab.language)}</p>`;
  app.innerHTML = `
    <p style="margin-top:1.5rem"><a class="back" href="#/">RGUKT Labs</a></p>
    <div style="display:flex;justify-content:space-between;gap:1rem;align-items:end">
      <h2>${esc(lab.title)}</h2>
      <p class="total">${total}<span class="muted"> / 50</span></p>
    </div>
    <div class="desk">
      <div class="stack">${buttons}</div>
      <section class="card stack">
        <p><strong>Experiment ${currentExp}.</strong> ${esc(lab.aims[currentExp - 1] || "")}</p>
        ${language}
        <label>Program<textarea id="code" placeholder="Paste the program">${slot ? esc(slot.code) : ""}</textarea></label>
        <p id="run-error" class="error" hidden></p>
        <button id="evaluate" class="primary" type="button">Evaluate</button>
        <div id="result"></div>
      </section>
    </div>`;
  if (slot) showResult(slot);
  document.querySelectorAll("[data-exp]").forEach((button) => {
    button.addEventListener("click", () => {
      currentExp = Number(button.dataset.exp);
      render();
    });
  });
  document.querySelector("#evaluate").addEventListener("click", () => {
    const code = document.querySelector("#code").value;
    const language = lab.choose ? document.querySelector("#language").value : lab.language;
    const result = evaluateProgram(code, language);
    const record = { experiment: currentExp, code, language, ...result };
    saveAnswer(who.email, lab.slug, currentExp, record);
    render();
  });
}

function showResult(slot) {
  const box = document.querySelector("#result");
  if (!box || slot.marks == null) return;
  const tone = slot.marks >= 10 ? "ok" : slot.marks > 0 ? "warn" : "bad";
  const lines = (slot.issues || []).map((issue) => `<li>${esc(issue)}</li>`).join("");
  box.innerHTML = `<div class="result ${tone}"><strong>${slot.marks} / 10</strong><p>${esc(slot.comment)}</p>${lines ? `<ul>${lines}</ul>` : ""}</div>`;
}

function evaluateProgram(code, language) {
  const text = String(code || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const issues = [];
  if (text.trim().length < 8) issues.push("Paste the program.");
  if (language === "python") {
    if (/^\s*#\s*include\b/m.test(text)) issues.push("This looks like C or C++.");
    if (!/\b(def|print|for|while|if|class|import)\b/.test(text)) issues.push("This does not look like a Python program.");
  } else if (language === "java") {
    if (!/\bclass\s+[A-Za-z_]\w*/.test(text)) issues.push("A Java program needs a class.");
    if (!/\bmain\s*\(/.test(text)) issues.push("Add a main method.");
  } else {
    if (/^\s*(def|import)\s+/m.test(text) && !/#\s*include/.test(text)) issues.push("This looks like Python.");
    if (!/\bmain\s*\(/.test(text)) issues.push("Add a main function.");
    if (!/#\s*include\b/.test(text)) issues.push("Add the library header.");
  }
  issues.push(...braceIssues(text));
  const ok = issues.length === 0;
  const ai = aiPercent(text);
  const deducted = ok && ai > 75;
  const marks = ok ? (deducted ? 5 : 10) : 0;
  let comment = ok
    ? `Trace passed. AI ${ai}% · Human ${100 - ai}%.`
    : `This program would not run. ${issues.length} issue${issues.length === 1 ? "" : "s"} found.`;
  if (deducted) comment += " 5 marks deducted because the AI share is above 75%.";
  return { marks, issues: issues.slice(0, 6), ai, comment };
}

function braceIssues(code) {
  let depth = 0;
  let quote = null;
  const issues = [];
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (ch === "\\") { i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;
    if (depth < 0) return ["A closing brace has no match."];
  }
  if (quote) issues.push("A string is not closed.");
  if (depth > 0) issues.push("A brace is still open.");
  return issues;
}

function aiPercent(code) {
  const lines = code.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 4) return 20;
  let score = 15;
  const comments = lines.filter((line) => line.startsWith("#") || line.startsWith("//") || line.startsWith("/*")).length;
  if (comments / lines.length > 0.35) score += 30;
  if (/as an ai|generated by|chatgpt|copilot/i.test(code)) score += 50;
  if (/TODO: implement|pass\s*$/m.test(code)) score += 15;
  const unique = new Set(lines);
  if (unique.size < lines.length * 0.55) score += 20;
  return Math.max(0, Math.min(99, score));
}

render();
