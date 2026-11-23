import type { Lang } from "@/lib/lab/types";

export type LabDef = {
  slug: string;
  code: string;
  title: string;
  blurb: string;
  language: Lang;
  chooseLanguage: boolean;
  viva: boolean;
  aims: [string, string, string, string, string];
};

export const LABS: LabDef[] = [
  {
    slug: "c",
    code: "C",
    title: "C Programming",
    blurb: "Control flow, arrays, pointers, and files. Paste the program and the mark appears at once.",
    language: "c",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Print a pattern and the sum of a series using loops.",
      "Search and sort an array of integers.",
      "Use pointers to swap values and reverse a string.",
      "Store student records with structures.",
      "Read and write a text file.",
    ],
  },
  {
    slug: "cpp",
    code: "C++",
    title: "C++ Programming",
    blurb: "Classes, constructors, and the standard library. The trace and the AI check run when you evaluate.",
    language: "cpp",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Write a class with a constructor and print its fields.",
      "Overload a function and an operator.",
      "Inherit a base class and override a method.",
      "Store values in a vector and sort them.",
      "Read records from a file into objects.",
    ],
  },
  {
    slug: "java",
    code: "Java",
    title: "Java Programming",
    blurb: "Classes and the main method. A clean class is 10 marks. More than 75% AI deducts 5.",
    language: "java",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Print a multiplication table from a class with main.",
      "Use an array and a method to find the largest value.",
      "Create a class with a constructor and two methods.",
      "Extend a class and call the parent constructor.",
      "Catch an exception around integer input.",
    ],
  },
  {
    slug: "python",
    code: "Py",
    title: "Python Programming",
    blurb: "Functions, lists, and files. Evaluate prints the mark beside the program.",
    language: "python",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Compute factorial and Fibonacci with functions.",
      "Filter and sort a list of numbers.",
      "Count words in a sentence using a dictionary.",
      "Read a CSV-like text file and print totals.",
      "Define a class with an instance method.",
    ],
  },
  {
    slug: "cn",
    code: "CN",
    title: "Computer Networks",
    blurb: "Sockets and simple protocol programs in Python. Marks are shown as soon as the answer is evaluated.",
    language: "python",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Write a TCP echo client and server.",
      "Write a UDP client that sends one datagram.",
      "Compute an even parity bit for a bit string.",
      "Simulate stop-and-wait with sequence numbers.",
      "Parse a dotted IPv4 address and print the octets.",
    ],
  },
  {
    slug: "os",
    code: "OS",
    title: "Operating Systems",
    blurb: "Scheduling and process programs in C. A clean trace is 10 marks for that experiment.",
    language: "c",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Compute FCFS average waiting time for a list of bursts.",
      "Compute SJF average waiting time.",
      "Simulate round robin with a fixed quantum.",
      "Implement a producer-consumer buffer with counters.",
      "Show the difference between fork-style process ids using printed steps.",
    ],
  },
  {
    slug: "se",
    code: "SE",
    title: "Software Engineering",
    blurb: "Small programs that check requirements, estimation, and test cases. The mark is saved on the sheet.",
    language: "python",
    chooseLanguage: false,
    viva: false,
    aims: [
      "Estimate effort with basic COCOMO from size and constants.",
      "Compute cyclomatic complexity from edges, nodes, and components.",
      "Turn a requirement sentence into numbered test cases.",
      "Apply a boundary-value check to an input range.",
      "Print a traceability row from requirement id to test id.",
    ],
  },
  {
    slug: "daa",
    code: "DAA",
    title: "Design and Analysis of Algorithms",
    blurb: "Five algorithm programs plus the viva. C, C++, or Python. The mark is shown as soon as you evaluate.",
    language: "python",
    chooseLanguage: true,
    viva: true,
    aims: [
      "Sort a list with merge sort and print the steps.",
      "Find a shortest path with Dijkstra's algorithm.",
      "Solve 0/1 knapsack with dynamic programming.",
      "Build a Huffman tree and print the codes.",
      "Place N queens so that none attack each other.",
    ],
  },
];

const bySlug = new Map(LABS.map((lab) => [lab.slug, lab]));

export function labBySlug(slug: string): LabDef | null {
  return bySlug.get(slug) ?? null;
}

export function isLabSlug(slug: string): slug is string {
  return bySlug.has(slug);
}
