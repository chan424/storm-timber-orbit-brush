import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { listLabs, saveLab } from "@/lib/lab/labs-api";
import type { LabDef } from "@/lib/lab/catalog";
import type { Lang } from "@/lib/lab/types";

const LANGS: { id: Lang; label: string }[] = [
  { id: "c", label: "C" },
  { id: "cpp", label: "C++" },
  { id: "java", label: "Java" },
  { id: "python", label: "Python" },
];

export function Catalog({ role }: { role: "admin" | "student" | null }) {
  const [labs, setLabs] = useState<LabDef[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    listLabs()
      .then((rows) => {
        if (!cancelled) setLabs(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load the labs.");
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4">
        <h2 className="font-serif text-2xl font-semibold">Labs</h2>
        {role === "admin" ? <p className="text-sm text-muted">Use Edit to change a lab.</p> : null}
      </div>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {labs.map((lab) => (
          <article key={lab.slug} className="rounded-xl border border-line bg-sheet p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs font-medium tracking-wide text-accent uppercase">{lab.code}</p>
                <h3 className="mt-1 font-serif text-xl font-semibold text-balance">{lab.title}</h3>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/lab/$slug"
                params={{ slug: lab.slug }}
                className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg"
              >
                {role === "admin" ? "Open sheet" : "Open lab"}
              </Link>
              {role === "admin" ? (
                <button
                  type="button"
                  onClick={() => setEditing(editing === lab.slug ? null : lab.slug)}
                  className="inline-flex h-11 items-center rounded-md border border-line px-4 text-sm font-semibold"
                >
                  {editing === lab.slug ? "Close" : "Edit"}
                </button>
              ) : null}
            </div>
            {editing === lab.slug ? (
              <LabEditor
                lab={lab}
                onSaved={(next) => {
                  setLabs((prev) => prev.map((item) => (item.slug === next.slug ? next : item)));
                  setEditing(null);
                }}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function LabEditor({ lab, onSaved }: { lab: LabDef; onSaved: (lab: LabDef) => void }) {
  const [title, setTitle] = useState(lab.title);
  const [blurb, setBlurb] = useState(lab.blurb);
  const [language, setLanguage] = useState<Lang>(lab.language);
  const [aims, setAims] = useState<string[]>([...lab.aims]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await saveLab({ data: { slug: lab.slug, title, blurb, language, aims } });
      onSaved({ ...lab, title, blurb, language, aims: aims as LabDef["aims"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the lab.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-line pt-4">
      <label className="block text-sm font-medium">
        Title
        <input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3" />
      </label>
      <label className="block text-sm font-medium">
        Description
        <textarea value={blurb} onChange={(event) => setBlurb(event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-line bg-sheet px-3 py-2" />
      </label>
      <label className="block text-sm font-medium">
        Language
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as Lang)}
          className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3"
        >
          {LANGS.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>
      {aims.map((aim, index) => (
        <label key={index} className="block text-sm font-medium">
          Experiment {index + 1}
          <input
            value={aim}
            onChange={(event) => setAims((prev) => prev.map((item, i) => (i === index ? event.target.value : item)))}
            className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3"
          />
        </label>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button type="submit" disabled={pending} className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50">
        {pending ? "Saving…" : "Save lab"}
      </button>
    </form>
  );
}
