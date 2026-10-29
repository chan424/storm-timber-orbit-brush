export type Lang = "c" | "cpp" | "python";

export type Role = "admin" | "student";

export type Issue = {
  line: number;
  message: string;
};

export type Access = {
  email: string;
  name: string;
  role: Role | null;
  studentId: string | null;
};

export type Submission = {
  experiment: number;
  aim: string;
  language: Lang;
  code: string;
  runsOk: boolean;
  baseMarks: number;
  awardedMarks: number;
  aiPercent: number | null;
  humanPercent: number | null;
  comment: string;
  deducted: boolean;
  diagnostics: Issue[];
  updatedAt: string;
};

export type AdminExperiment = {
  experiment: number;
  aim: string;
  language: Lang;
  code: string;
  awardedMarks: number;
  runsOk: boolean;
  comment: string;
  deducted: boolean;
  diagnostics: Issue[];
  aiPercent: number | null;
  updatedAt: string;
};

export type AdminStudent = {
  studentId: string;
  email: string;
  marks: Array<number | null>;
  vivaMcq: number | null;
  vivaOral: number | null;
  total: number;
  experiments: AdminExperiment[];
};
