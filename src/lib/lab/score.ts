/** 10 for a clean trace. More than 75% AI deducts 5, and the score never goes below 0. */
export function awardMarks(runsOk: boolean, aiPercent: number | null): {
  base: number;
  awarded: number;
  deducted: boolean;
} {
  const base = runsOk ? 10 : 0;
  const deducted = aiPercent != null && aiPercent > 75 && base >= 5;
  return { base, awarded: deducted ? base - 5 : base, deducted };
}

export function authorshipComment(opts: {
  aiPercent: number | null;
  note: string | null;
  deducted: boolean;
  runsOk: boolean;
}): string {
  if (opts.aiPercent == null) {
    return opts.runsOk
      ? "Trace passed. Authorship review did not run, so no AI deduction was applied."
      : "Trace did not pass. Authorship review did not run, so no AI deduction was applied.";
  }
  const human = 100 - opts.aiPercent;
  const note = (opts.note ?? "").replace(/\s+/g, " ").trim();
  let text = `AI ${opts.aiPercent}% · Human ${human}%.`;
  if (note) text += ` ${note}`;
  if (opts.deducted) {
    text += " 5 marks deducted because the AI share is above 75%.";
  } else if (opts.aiPercent > 75 && !opts.runsOk) {
    text += " The program did not trace clean, so this experiment stays at 0.";
  }
  return text;
}
