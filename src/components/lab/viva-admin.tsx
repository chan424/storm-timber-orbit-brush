import { useEffect, useState } from "react";
import { getBearerToken } from "@/lib/auth/client";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { parseQuestionBank } from "@/lib/lab/viva-parse";
import { addQuestions, awardOral, getStudentViva, listBank, type AdminVivaItem, type BankItem } from "@/lib/lab/viva-api";

function apiPath(path: string): string {
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname) ?? "";
  return `${prefix}${path}`;
}

function authHeaders(): Headers {
  const headers = new Headers();
  const token = getBearerToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

export function VivaBank() {
  const [items, setItems] = useState<BankItem[]>([]);
  const [counts, setCounts] = useState({ oralCount: 0, mcqCount: 0 });
  const [kind, setKind] = useState<"oral" | "mcq">("oral");
  const [prompt, setPrompt] = useState("");
  const [choices, setChoices] = useState(["", "", "", ""]);
  const [answer, setAnswer] = useState(0);
  const [bulk, setBulk] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const bank = await listBank();
    setItems(bank.items);
    setCounts({ oralCount: bank.oralCount, mcqCount: bank.mcqCount });
  }

  useEffect(() => {
    let cancelled = false;
    listBank()
      .then((bank) => {
        if (cancelled) return;
        setItems(bank.items);
        setCounts({ oralCount: bank.oralCount, mcqCount: bank.mcqCount });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the question bank.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function publish(questions: ReturnType<typeof parseQuestionBank>) {
    setBusy(true);
    setError("");
    try {
      const next = await addQuestions({ data: { questions } });
      setCounts(next);
      setPrompt("");
      setChoices(["", "", "", ""]);
      setBulk("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add questions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-line bg-sheet p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-semibold">Viva bank</h2>
          <p className="mt-1 text-sm text-muted">
            {counts.oralCount} spoken · {counts.mcqCount} choice. Each student is given 5 of each. Aim for about 60.
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-1 rounded-md bg-well p-1 w-fit">
        {(["oral", "mcq"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setKind(item)}
            className={`h-11 rounded-md px-4 text-sm font-semibold ${kind === item ? "bg-accent text-accent-fg" : "text-muted"}`}
          >
            {item === "oral" ? "Spoken" : "Choice"}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium" htmlFor="viva-prompt">
        Question
        <textarea
          id="viva-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={3}
          className="mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 text-base outline-none"
        />
      </label>
      {kind === "mcq" ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {choices.map((choice, index) => (
            <label key={index} className="block text-sm">
              <span className="font-medium">{String.fromCharCode(65 + index)}</span>
              <input
                value={choice}
                onChange={(event) =>
                  setChoices((prev) => prev.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))
                }
                className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3"
              />
              <span className="mt-1 flex items-center gap-2">
                <input type="radio" name="viva-answer" checked={answer === index} onChange={() => setAnswer(index)} />
                Correct
              </span>
            </label>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void publish([
            {
              kind,
              prompt: prompt.trim(),
              choices: kind === "mcq" ? choices.map((choice) => choice.trim()) : [],
              answer: kind === "mcq" ? answer : null,
            },
          ])
        }
        className="mt-4 h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
      >
        Add question
      </button>
      <label className="mt-6 block text-sm font-medium" htmlFor="viva-bulk">
        Or paste several. Start each with ORAL or MCQ. Choice questions need A) B) C) D) and a line ANSWER B.
        <textarea
          id="viva-bulk"
          value={bulk}
          onChange={(event) => setBulk(event.target.value)}
          rows={8}
          className="mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 font-mono text-sm outline-none"
        />
      </label>
      <button
        type="button"
        disabled={busy || bulk.trim().length === 0}
        onClick={() => {
          try {
            void publish(parseQuestionBank(bulk));
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not read those questions.");
          }
        }}
        className="mt-3 h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-50"
      >
        Add pasted questions
      </button>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {items.length > 0 ? (
        <ul className="mt-4 max-h-64 space-y-2 overflow-auto text-sm">
          {items.map((item) => (
            <li key={item.id} className="rounded-md bg-well px-3 py-2">
              <span className="font-medium">{item.kind === "oral" ? "Spoken" : "Choice"}.</span> {item.prompt}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function VivaReview({ studentId }: { studentId: string }) {
  const [items, setItems] = useState<AdminVivaItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getStudentViva({ data: { studentId } })
      .then((rows) => {
        if (!cancelled) setItems(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this viva.");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!items) return <p className="text-sm text-muted">Loading viva…</p>;
  if (items.length === 0) return <p className="text-sm text-muted">No viva paper yet.</p>;

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Viva</h3>
      {items.map((item, index) => (
        <article key={item.questionId} className="rounded-md bg-sheet p-4">
          <p className="text-sm font-medium text-muted">
            {index + 1}. {item.kind === "oral" ? "Spoken" : "Choice"}
            {item.awarded != null ? ` · ${item.awarded}/2` : ""}
          </p>
          <p className="mt-1 text-sm text-pretty">{item.prompt}</p>
          {item.kind === "oral" ? (
            item.hasVideo ? (
              <OralClip
                studentId={studentId}
                questionId={item.questionId}
                awarded={item.awarded}
                onAwarded={(marks) =>
                  setItems((prev) =>
                    prev?.map((row) => (row.questionId === item.questionId ? { ...row, awarded: marks } : row)) ?? prev,
                  )
                }
              />
            ) : (
              <p className="mt-2 text-sm text-muted">No recording yet.</p>
            )
          ) : (
            <p className="mt-2 text-sm text-muted">
              {item.selected == null ? "Not answered." : `Chose option ${String.fromCharCode(65 + item.selected)}.`}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}

function OralClip({
  studentId,
  questionId,
  awarded,
  onAwarded,
}: {
  studentId: string;
  questionId: number;
  awarded: number | null;
  onAwarded: (marks: number) => void;
}) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");
  const [marks, setMarks] = useState(awarded ?? 0);

  useEffect(() => {
    let url = "";
    let cancelled = false;
    fetch(apiPath(`/api/viva-video?questionId=${questionId}&studentId=${encodeURIComponent(studentId)}`), {
      headers: authHeaders(),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the recording.");
        const blob = await response.blob();
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the recording.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [questionId, studentId]);

  return (
    <div className="mt-3">
      {src ? <video src={src} controls className="aspect-video w-full max-w-md rounded-md bg-well" /> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {[0, 1, 2].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMarks(value)}
            className={`h-11 rounded-md px-3 text-sm font-semibold ${marks === value ? "bg-accent text-accent-fg" : "bg-well"}`}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            void awardOral({ data: { studentId, questionId, marks } })
              .then(() => onAwarded(marks))
              .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not save the mark."));
          }}
          className="h-11 rounded-md border border-line px-4 text-sm font-semibold"
        >
          Award
        </button>
      </div>
    </div>
  );
}
