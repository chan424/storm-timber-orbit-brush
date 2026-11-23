import { useEffect, useState } from "react";

type Upload = {
  student_id?: string;
  email?: string;
  kind: string;
  filename: string;
  bytes: number;
};

const SLOTS = [
  { kind: "mini", title: "Mini project", hint: "Upload the mini project as one zip file." },
  { kind: "major", title: "Project", hint: "Upload the project as one zip file." },
] as const;

export function ProjectDesk({ role }: { role: "admin" | "student" }) {
  const [rows, setRows] = useState<Upload[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const response = await fetch("/api/project-zip");
    if (!response.ok) throw new Error("Could not load project files.");
    const data = (await response.json()) as { uploads: Upload[] };
    setRows(data.uploads ?? []);
  }

  useEffect(() => {
    let cancelled = false;
    load().catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load project files.");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onFile(kind: string, file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(kind);
    try {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      const response = await fetch("/api/project-zip", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.text()) || "The upload failed.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed.");
    } finally {
      setBusy("");
    }
  }

  if (role === "admin") {
    return (
      <section className="mt-8">
        <h2 className="font-serif text-2xl font-semibold">Project files</h2>
        <p className="mt-1 text-sm text-muted">Zip files students uploaded for the mini project and the project.</p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-4 overflow-x-auto rounded-xl border border-line bg-sheet">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">File</th>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.student_id}-${row.kind}`} className="border-t border-line">
                  <td className="px-4 py-3 font-mono">{row.student_id}</td>
                  <td className="px-4 py-3">{row.filename}</td>
                  <td className="px-4 py-3">{row.kind === "mini" ? "Mini project" : "Project"}</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      className="font-semibold text-accent"
                      href={`/api/project-zip?kind=${row.kind}&studentId=${encodeURIComponent(row.student_id ?? "")}`}
                    >
                      Download
                    </a>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={4}>
                    No zip files yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 grid gap-4 sm:grid-cols-2">
      {SLOTS.map((slot) => {
        const saved = rows.find((row) => row.kind === slot.kind);
        return (
          <article key={slot.kind} className="rounded-xl border border-line bg-sheet p-5">
            <h2 className="font-serif text-2xl font-semibold">{slot.title}</h2>
            <p className="mt-1 text-sm text-muted">{slot.hint}</p>
            <p className="mt-3 text-sm">{saved ? saved.filename : "No file yet."}</p>
            <label className="mt-4 flex h-11 cursor-pointer items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg">
              {busy === slot.kind ? "Uploading…" : "Choose zip"}
              <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                disabled={busy !== ""}
                onChange={(event) => void onFile(slot.kind, event.target.files?.[0])}
              />
            </label>
          </article>
        );
      })}
      {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
    </section>
  );
}
