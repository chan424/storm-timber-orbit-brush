export type DraftQuestion = {
  kind: "oral" | "mcq";
  prompt: string;
  choices: string[];
  answer: number | null;
};

const KIND = /^(oral|spoken|mcq|choice)$/i;
const OPTION = /^([A-D])[).]\s*(.+)$/i;
const ANSWER = /^answer\s+([A-D])$/i;

export function parseQuestionBank(raw: string): DraftQuestion[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (KIND.test(line.trim())) {
      if (current) blocks.push(current);
      current = [line.trim()];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current);
  if (blocks.length === 0) throw new Error("Start each question with ORAL or MCQ.");

  return blocks.map((block, index) => {
    const where = `Question ${index + 1}`;
    const head = block[0]?.trim().toLowerCase() ?? "";
    const kind: DraftQuestion["kind"] = head === "oral" || head === "spoken" ? "oral" : "mcq";
    const promptLines: string[] = [];
    const choices = ["", "", "", ""];
    let answer: number | null = null;
    for (const line of block.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (promptLines.length) promptLines.push("");
        continue;
      }
      const option = OPTION.exec(trimmed);
      if (option && kind === "mcq") {
        const slot = option[1].toUpperCase().charCodeAt(0) - 65;
        choices[slot] = option[2].trim();
        continue;
      }
      const marked = ANSWER.exec(trimmed);
      if (marked && kind === "mcq") {
        answer = marked[1].toUpperCase().charCodeAt(0) - 65;
        continue;
      }
      promptLines.push(trimmed);
    }
    const prompt = promptLines.join("\n").trim();
    if (prompt.length < 3) throw new Error(`${where} needs a question.`);
    if (prompt.length > 1000) throw new Error(`${where} is too long.`);
    if (kind === "oral") return { kind, prompt, choices: [], answer: null };
    if (choices.some((choice) => choice.length < 1)) {
      throw new Error(`${where} needs options A) B) C) and D).`);
    }
    if (answer == null) throw new Error(`${where} needs a line like ANSWER B.`);
    return { kind, prompt, choices, answer };
  });
}
