import { useEffect, useState } from "react";
import { CodeEditor } from "@/components/lab/code-editor";
import { VivaDesk } from "@/components/lab/viva-desk";
import { listMine, runExperiment } from "@/lib/lab/api";
import { getViva } from "@/lib/lab/viva-api";
import type { Lang, Submission } from "@/lib/lab/types";

type Slot = {
  experiment: number;
  aim: string;
  language: Lang;
  code: string;
  saved: Submission | null;
};

const LANGS: { id: Lang; label: string }[] = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "python", label: "Python" },
];

function blankSlots(): Slot[] {
  return [1, 2, 3, 4, 5].map((experiment) => ({
    experiment,
    aim: "",
    language: "python",
    code: "",
    saved: null,
  }));
}

export function StudentDesk({ studentId }: { studentId: string }) {
  const [slots, setSlots] = useState<Slot[]>(blankSlots);
  const [current, setCurrent] = useState(1);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [desk, setDesk] = useState<"programs" | "viva">("programs");
  const [viva, setViva] = useState<{ mcq: number | null; oral: number | null; saved: boolean }>({
    mcq: null,
    oral: null,
    saved: false,
  });

  useEffect(() => {
    let cancelled = false;
    listMine()
      .then((rows) => {
        if (cancelled) return;
        setSlots((prev) =>
          prev.map((slot) => {
            const saved = rows.find((row) => row.experiment === slot.experiment);
            if (!saved) return slot;
            return {
              experiment: slot.experiment,
              aim: saved.aim,
              language: saved.language,
              code: saved.code,
              saved,
            };
          }),
        );
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load submissions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getViva()
      .then((next) => {
        if (!cancelled) setViva({ mcq: next.mcqMarks, oral: next.oralMarks, saved: next.saved });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const slot = slots[current - 1] ?? slots[0];
  if (!slot) return null;
  const programs = slots.reduce((sum, item) => sum + (item.saved?.awardedMarks ?? 0), 0);
  const shown = programs + (viva.saved ? (viva.mcq ?? 0) : 0);

  function update(patch: Partial<Slot>) {
    setSlots((prev) => prev.map((item) => (item.experiment === current ? { ...item, ...patch } : item)));
  }

  async function onRun() {
    setError("");
    setRunning(true);
    try {
      const saved = await runExperiment({
        data: {
          experiment: slot.experiment,
          aim: slot.aim,
          language: slot.language,
          code: slot.code,
        },
      });
      setSlots((prev) =>
        prev.map((item) =>
          item.experiment === saved.experiment
            ? { experiment: saved.experiment, aim: saved.aim, language: saved.language, code: saved.code, saved }
            : item,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "The trace failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">Student ID</p>
          <p className="font-mono text-lg font-medium">{studentId}</p>
        </div>
        <div className="text-right">
          <p className="font-serif text-3xl font-semibold tabular-nums">
            {shown}
            <span className="text-lg font-medium text-muted"> / 60</span>
          </p>
          <p className="text-sm text-muted">
            Programs {programs}/50
            {viva.saved ? ` · choices ${viva.mcq ?? 0}/10` : " · choices not saved"}
            {viva.oral == null ? " · oral not marked" : ` · oral ${viva.oral}/10`}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-md bg-well p-1 sm:flex sm:w-fit" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={desk === "programs"}
          onClick={() => setDesk("programs")}
          className={`h-11 rounded-md px-4 text-sm font-semibold ${desk === "programs" ? "bg-accent text-accent-fg" : "text-muted"}`}
        >
          Programs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={desk === "viva"}
          onClick={() => setDesk("viva")}
          className={`h-11 rounded-md px-4 text-sm font-semibold ${desk === "viva" ? "bg-accent text-accent-fg" : "text-muted"}`}
        >
          Viva
        </button>
      </div>
      {desk === "viva" ? <VivaDesk onScore={setViva} /> : null}
      {desk === "programs" ? (

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <section aria-label="Experiments" className="flex gap-3 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {slots.map((item) => {
            const selected = item.experiment === current;
            return (
              <button
                key={item.experiment}
                type="button"
                onClick={() => setCurrent(item.experiment)}
                className={`w-56 shrink-0 rounded-xl border p-4 text-left lg:w-auto ${
                  selected ? "border-accent bg-accent-soft" : "border-line bg-sheet"
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Experiment {item.experiment}</span>
                  <Mark saved={item.saved} />
                </span>
                <span className="mt-2 block text-sm text-pretty text-muted line-clamp-3">
                  {item.saved?.comment || "Not submitted"}
                </span>
              </button>
            );
          })}
        </section>

        <section className="rounded-xl border border-line bg-sheet p-5 sm:p-6">
          {loading ? <p className="text-sm text-muted">Loading your experiments…</p> : null}
          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold">1. Experiment</p>
              <p className="mt-1 text-sm text-muted">Experiment {slot.experiment} of 5</p>
            </div>
            <label className="block" htmlFor="aim">
              <span className="text-sm font-semibold">2. Aim of the experiment</span>
              <textarea
                id="aim"
                value={slot.aim}
                onChange={(event) => update({ aim: event.target.value })}
                rows={3}
                placeholder="What this experiment demonstrates"
                className="mt-2 w-full rounded-md border border-line bg-sheet px-3 py-3 text-base text-ink outline-none placeholder:text-muted"
              />
            </label>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">3. Program</p>
                <div role="radiogroup" aria-label="Language" className="flex rounded-md border border-line p-1">
                  {LANGS.map((lang) => {
                    const active = slot.language === lang.id;
                    return (
                      <button
                        key={lang.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => update({ language: lang.id })}
                        className={`h-9 rounded-md px-3 text-sm font-semibold ${
                          active ? "bg-accent text-accent-fg" : "text-muted"
                        }`}
                      >
                        {lang.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-2">
                <CodeEditor value={slot.code} onChange={(code) => update({ code })} />
              </div>
            </div>
            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void onRun()}
              disabled={running || loading}
              className="flex h-11 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {running ? "Tracing…" : "Run"}
            </button>
            <p className="text-sm text-pretty text-muted">
              Run traces syntax and the errors that would stop a compiler or interpreter, then estimates how much of the code was written by AI. It does not execute the program.
            </p>
            {slot.saved ? <Result saved={slot.saved} /> : null}
          </div>
        </section>
      </div>
      ) : null}
    </div>
  );
}

function Mark({ saved }: { saved: Submission | null }) {
  if (!saved) return <span className="font-mono text-sm text-muted">—</span>;
  const tone = saved.awardedMarks >= 10 ? "text-ok" : saved.awardedMarks > 0 ? "text-warn" : "text-danger";
  return (
    <span className={`font-mono text-sm font-medium tabular-nums ${tone}`}>
      {saved.awardedMarks}/10
    </span>
  );
}

function Result({ saved }: { saved: Submission }) {
  const tone = saved.runsOk
    ? saved.deducted
      ? "border-warn bg-warn-soft text-warn"
      : "border-ok bg-ok-soft text-ok"
    : "border-danger bg-danger-soft text-danger";
  return (
    <div className={`rounded-md border px-4 py-3 ${tone}`}>
      <p className="font-semibold tabular-nums">{saved.awardedMarks} / 10</p>
      <p className="mt-1 text-sm text-ink">{saved.comment}</p>
      {saved.diagnostics.length ? (
        <ul className="mt-3 space-y-1 text-sm text-ink">
          {saved.diagnostics.map((issue) => (
            <li key={`${issue.line}-${issue.message}`}>
              Line {issue.line}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
