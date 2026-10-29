type Review = { aiPercent: number; note: string } | { aiPercent: null; note: string };

const SYSTEM = `You estimate how much of a student lab program was written by an AI assistant rather than typed by the student. Calibrate from the writing, not from whether the algorithm is correct.
0-30: uneven spacing, course-lab shortcuts, small slips, terse or missing comments.
31-60: mixed; some polished stretches and some human mess.
61-75: mostly polished, with visible human edits.
76-100: uniform textbook voice, a docstring on every function, generic names, and complexity essays.
Return only a JSON object with integer ai_percent from 0 to 100 and comment: one or two plain sentences, under 240 characters, no markdown, telling faculty what looks AI-written and what looks human. If the sample is too small to judge, use 40 and say so.`;

export async function reviewAuthorship(input: {
  language: string;
  aim: string;
  code: string;
}): Promise<Review> {
  const sample = input.code.trim();
  if (sample.replace(/\s/g, "").length < 40) {
    return {
      aiPercent: null,
      note: "Too little code to estimate authorship.",
    };
  }
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { aiPercent: null, note: "Authorship review is unavailable." };
  }

  const user = `Language: ${input.language}\nAim: ${input.aim.slice(0, 500)}\n\nCode:\n${sample.slice(0, 8000)}`;
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: user },
  ];

  let text = await complete(apiKey, messages, true);
  if (text == null) text = await complete(apiKey, messages, false);
  if (!text) return { aiPercent: null, note: "Authorship review did not return a result." };

  const parsed = parseReview(text);
  if (!parsed) return { aiPercent: null, note: "Authorship review did not return a result." };
  return parsed;
}

async function complete(
  apiKey: string,
  messages: { role: string; content: string }[],
  jsonMode: boolean,
): Promise<string | null> {
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(20000),
      body: JSON.stringify({
        model: "grok-4.5",
        temperature: 0,
        max_tokens: 300,
        messages,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    return readContent(body.choices?.[0]?.message?.content);
  } catch {
    return null;
  }
}

function readContent(content: unknown): string | null {
  if (typeof content === "string" && content.trim()) return content;
  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join("");
    return text.trim() ? text : null;
  }
  return null;
}

function parseReview(text: string): Review | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as { ai_percent?: unknown; comment?: unknown };
    const ai = Math.round(Number(obj.ai_percent));
    const note = String(obj.comment ?? "").replace(/\s+/g, " ").trim();
    if (!Number.isFinite(ai) || !note) return null;
    return { aiPercent: Math.min(100, Math.max(0, ai)), note: note.slice(0, 400) };
  } catch {
    return null;
  }
}
