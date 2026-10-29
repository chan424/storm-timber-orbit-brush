import { useEffect, useRef, useState } from "react";
import { getBearerToken } from "@/lib/auth/client";
import { previewPathPrefix } from "@/lib/preview-path-prefix";
import { getViva, saveViva, type VivaCard, type VivaPaper } from "@/lib/lab/viva-api";

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

export function VivaDesk({
  onScore,
}: {
  onScore: (score: { mcq: number | null; oral: number | null; saved: boolean }) => void;
}) {
  const [paper, setPaper] = useState<VivaPaper | null>(null);
  const [cursor, setCursor] = useState(0);
  const [choices, setChoices] = useState<Record<number, number | null>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const onScoreRef = useRef(onScore);
  onScoreRef.current = onScore;

  useEffect(() => {
    let cancelled = false;
    getViva()
      .then((next) => {
        if (cancelled) return;
        setPaper(next);
        const picked: Record<number, number | null> = {};
        for (const card of next.questions) picked[card.id] = card.selected;
        setChoices(picked);
        onScoreRef.current({ mcq: next.mcqMarks, oral: next.oralMarks, saved: next.saved });
      })
      .catch((err: unknown) => {
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
      const next = await saveViva({
        data: {
          answers: paper.questions
            .filter((item) => item.kind === "mcq")
            .map((item) => ({ questionId: item.id, choice: choices[item.id] ?? null })),
        },
      });
      setPaper(next);
      onScore({ mcq: next.mcqMarks, oral: next.oralMarks, saved: next.saved });
      const shown = next.mcqMarks ?? 0;
      setNote(`Saved. Viva choices are ${shown}/10, and that is included in the 60.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  function markVideo(questionId: number) {
    setPaper((prev) =>
      prev
        ? {
            ...prev,
            questions: prev.questions.map((item) => (item.id === questionId ? { ...item, hasVideo: true } : item)),
          }
        : prev,
    );
  }

  if (error && !paper) return <p className="mt-8 text-sm text-danger">{error}</p>;
  if (!paper) return <p className="mt-8 text-sm text-muted">Loading the viva…</p>;
  if (!paper.ready || !card) {
    return (
      <p className="mt-8 rounded-xl border border-line bg-sheet p-6 text-sm text-muted">
        The viva opens when the evaluation cell has published at least five spoken questions and five choice questions.
        The bank has {paper.oralCount} spoken and {paper.mcqCount} choice questions.
      </p>
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">
            Question {card.index} of {paper.questions.length}
          </p>
          <p className="font-serif text-2xl font-semibold">{card.kind === "oral" ? "Spoken answer" : "Choice question"}</p>
        </div>
        <p className="text-sm text-muted">Each question is 2 marks. Five are recorded. Five are choices.</p>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {paper.questions.map((item, index) => {
          const active = index === cursor;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCursor(index)}
              className={`h-11 shrink-0 rounded-md px-3 text-sm font-semibold ${
                active ? "bg-accent text-accent-fg" : "bg-well text-ink"
              }`}
            >
              {item.index}
              {item.kind === "oral" ? (item.hasVideo ? " · saved" : " · cam") : item.awarded != null ? ` · ${item.awarded}` : ""}
            </button>
          );
        })}
      </div>
      <section className="mt-4 rounded-xl border border-line bg-sheet p-5 sm:p-6">
        <p className="text-base text-pretty">{card.prompt}</p>
        {card.kind === "mcq" ? (
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Options">
            {card.choices.map((choice, index) => {
              const selected = choices[card.id] === index;
              return (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setChoices((prev) => ({ ...prev, [card.id]: index }))}
                  className={`flex min-h-11 w-full items-center rounded-md border px-3 text-left text-sm ${
                    selected ? "border-accent bg-accent-soft" : "border-line bg-sheet"
                  }`}
                >
                  <span className="mr-3 font-mono text-muted">{String.fromCharCode(65 + index)}</span>
                  {choice}
                </button>
              );
            })}
            {card.awarded != null ? (
              <p className="text-sm font-medium">{card.awarded === 2 ? "Correct. 2 marks." : "Not the right option. 0 marks."}</p>
            ) : null}
          </div>
        ) : (
          <Capture questionId={card.id} hasVideo={card.hasVideo} awarded={card.awarded} onSaved={() => markVideo(card.id)} />
        )}
        {error ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        {note ? <p className="mt-4 text-sm text-ok">{note}</p> : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCursor((index) => Math.max(0, index - 1))}
            disabled={cursor === 0}
            className="h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => setCursor((index) => Math.min(paper.questions.length - 1, index + 1))}
            disabled={cursor === paper.questions.length - 1}
            className="h-11 rounded-md border border-line px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={saving}
            className="h-11 rounded-md bg-accent px-6 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Capture({
  questionId,
  hasVideo,
  awarded,
  onSaved,
}: {
  questionId: number;
  hasVideo: boolean;
  awarded: number | null;
  onSaved: () => void;
}) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [localSaved, setLocalSaved] = useState(hasVideo);
  const [error, setError] = useState("");

  useEffect(() => {
    setLocalSaved(hasVideo);
  }, [hasVideo, questionId]);

  useEffect(() => {
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

  async function upload(blob: Blob) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("questionId", String(questionId));
      body.set("file", blob, "answer.webm");
      const response = await fetch(apiPath("/api/viva-video"), { method: "POST", headers: authHeaders(), body });
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
      }
      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
        ? "video/webm;codecs=vp8,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "";
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 350_000 } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        stopTracks();
        setRecording(false);
        if (blob.size > 0) void upload(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      const started = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 45) recorder.stop();
      }, 250);
    } catch {
      setError("Allow the camera and microphone, then try Capture again.");
    }
  }

  return (
    <div className="mt-4">
      <video ref={previewRef} muted playsInline className="aspect-video w-full max-w-md rounded-md bg-well" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {recording ? (
          <button
            type="button"
            onClick={() => recorderRef.current?.stop()}
            className="h-11 rounded-md bg-danger px-4 text-sm font-semibold text-accent-fg"
          >
            Stop · {seconds}s
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="h-11 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-50"
          >
            {busy ? "Saving recording…" : localSaved ? "Capture again" : "Capture"}
          </button>
        )}
        <p className="text-sm text-muted">
          {localSaved ? "Recording saved." : "Up to 45 seconds from this laptop camera."}
          {awarded != null ? ` Marked ${awarded}/2.` : " Waiting for the evaluation cell."}
        </p>
      </div>
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
