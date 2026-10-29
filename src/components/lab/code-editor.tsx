import { useRef } from "react";

export function CodeEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const lines = Math.max(1, value.split("\n").length);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-well">
      <div className="flex h-96">
        <div
          ref={gutter}
          aria-hidden="true"
          className="w-11 shrink-0 overflow-hidden border-r border-line py-3 text-right font-mono text-sm text-muted select-none"
        >
          {Array.from({ length: lines }, (_, index) => (
            <div key={index} className="h-6 px-2 leading-6">
              {index + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={area}
          value={value}
          spellCheck={false}
          onScroll={(event) => {
            if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop;
          }}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            event.preventDefault();
            const el = event.currentTarget;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const next = `${value.slice(0, start)}    ${value.slice(end)}`;
            onChange(next);
            requestAnimationFrame(() => {
              el.selectionStart = start + 4;
              el.selectionEnd = start + 4;
            });
          }}
          placeholder="Paste a complete C, C++, or Python program"
          className="h-full min-h-0 w-full resize-none bg-transparent px-3 py-3 font-mono text-sm leading-6 text-ink outline-none placeholder:text-muted"
          aria-label="Program"
        />
      </div>
    </div>
  );
}
