import { Fragment, useEffect, useState } from "react";
import { exportMarks, listAll } from "@/lib/lab/api";
import { VivaBank, VivaReview } from "@/components/lab/viva-admin";
import type { AdminStudent } from "@/lib/lab/types";

const LANG: Record<string, string> = { c: "C", cpp: "C++", python: "Python" };

export function AdminBoard() {
  const [students, setStudents] = useState<AdminStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    listAll()
      .then((rows) => {
        if (!cancelled) setStudents(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the mark sheet.");
      })
      .finally(() => {
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

  const average = students.length
    ? Math.round(students.reduce((sum, student) => sum + student.total, 0) / students.length)
    : 0;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">Evaluation cell</p>
          <p className="font-serif text-3xl font-semibold tabular-nums">
            {students.length}
            <span className="text-lg font-medium text-muted"> students · avg {average}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="h-11 rounded-md border border-line bg-sheet px-4 text-sm font-semibold"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void onDownload()}
            disabled={busy}
            className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Preparing…" : "Download XLS"}
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">
        Blank cells are not submitted. Programs are out of 50. Viva choices are out of 10 and appear when the student presses Save. Oral is out of 10 after you award the recordings. The sheet total is programs plus those viva marks. The 60 a student sees immediately is programs plus choices.
      </p>
      {error ? (
        <p className="mt-4 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="mt-6 text-sm text-muted">Loading submissions…</p> : null}
      {!loading && students.length === 0 ? (
        <p className="mt-6 rounded-xl border border-line bg-sheet p-6 text-sm text-muted">No submissions yet.</p>
      ) : null}
      {students.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-sheet">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead className="border-b border-line text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">ID</th>
                {[1, 2, 3, 4, 5].map((n) => (
                  <th key={n} className="px-3 py-3 font-medium">
                    Exp {n}
                  </th>
                ))}
                <th className="px-3 py-3 font-medium">Choices</th>
                <th className="px-3 py-3 font-medium">Oral</th>
                <th className="px-4 py-3 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <Fragment key={student.studentId}>
                  <tr className="border-b border-line">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setOpen(open === student.studentId ? null : student.studentId)}
                        className="font-mono font-medium text-accent"
                      >
                        {student.studentId}
                      </button>
                      <p className="text-xs text-muted">{student.email}</p>
                    </td>
                    {student.marks.map((mark, index) => (
                      <td key={index} className="px-3 py-3 font-mono tabular-nums">
                        {mark == null ? "—" : mark}
                      </td>
                    ))}
                    <td className="px-3 py-3 font-mono tabular-nums">{student.vivaMcq == null ? "—" : student.vivaMcq}</td>
                    <td className="px-3 py-3 font-mono tabular-nums">{student.vivaOral == null ? "—" : student.vivaOral}</td>
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums">{student.total}</td>
                  </tr>
                  {open === student.studentId ? (
                    <tr className="border-b border-line">
                      <td colSpan={9} className="bg-well px-4 py-4">
                        <div className="space-y-4">
                          <VivaReview studentId={student.studentId} />
                          {student.experiments.map((experiment) => (
                            <article key={experiment.experiment} className="rounded-md bg-sheet p-4">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <h3 className="font-semibold">
                                  Experiment {experiment.experiment}
                                  <span className="ml-2 text-sm font-medium text-muted">
                                    {LANG[experiment.language] ?? experiment.language}
                                  </span>
                                </h3>
                                <p className="font-mono tabular-nums">{experiment.awardedMarks}/10</p>
                              </div>
                              <p className="mt-2 text-sm text-pretty">{experiment.aim}</p>
                              <p className="mt-2 text-sm text-pretty text-muted">{experiment.comment}</p>
                              {experiment.diagnostics.length ? (
                                <ul className="mt-2 text-sm text-danger">
                                  {experiment.diagnostics.map((issue) => (
                                    <li key={`${issue.line}-${issue.message}`}>
                                      Line {issue.line}: {issue.message}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}
                              <pre className="mt-3 max-h-80 overflow-auto rounded-md bg-well p-3 font-mono text-xs leading-5 whitespace-pre">
                                {experiment.code}
                              </pre>
                            </article>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <VivaBank />
    </div>
  );
}
