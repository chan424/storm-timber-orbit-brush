import assert from "node:assert/strict";
import test from "node:test";
import { traceProgram } from "./trace.ts";

const mergeSort = `
def merge(left, right):
    out = []
    i = 0
    j = 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i])
            i += 1
        else:
            out.append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out

def merge_sort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    return merge(merge_sort(arr[:mid]), merge_sort(arr[mid:]))

if __name__ == "__main__":
    data = [5, 1, 4, 2, 8]
    print(merge_sort(data))
`;

test("python merge sort passes", () => {
  const result = traceProgram(mergeSort, "python");
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("python helper defined later passes", () => {
  const result = traceProgram(
    "def main_logic():\n    return helper(3)\n\ndef helper(n):\n    return n + 1\n\nprint(main_logic())\n",
    "python",
  );
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("python undefined name fails", () => {
  const result = traceProgram("def f():\n    return missing + 1\nprint(f())\n", "python");
  assert.equal(result.ok, false);
  assert.ok(result.issues.some((issue) => issue.message.includes("missing")));
});

test("python syntax and print statement fail", () => {
  assert.equal(traceProgram("def f()\n    return 1\n", "python").ok, false);
  assert.equal(traceProgram('print "hello"\n', "python").ok, false);
  assert.equal(traceProgram('x = "unterminated\nprint(x)\n', "python").ok, false);
});

test("python f-string, class, heapq, and comprehension pass", () => {
  const code = `
import math
from heapq import heappush, heappop
import collections as col

class Node:
    def __init__(self, value):
        self.value = value
        self.left = None

def dijkstra(start):
    heap = []
    heappush(heap, (0, start))
    seen = set()
    while heap:
        dist, node = heappop(heap)
        if node in seen:
            continue
        seen.add(node)
    squares = [i * i for i in range(4) if i]
    label = f"dist {math.sqrt(4)} {col.deque([1])}"
    nested = f"k { {'a': 1}['a'] }"
    return squares, label, nested, Node(1)

print(dijkstra(0))
`;
  const result = traceProgram(code, "python");
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("python except and with pass", () => {
  const code = `
try:
    value = int("3")
except ValueError as exc:
    print(exc)
else:
    print(value)
`;
  const result = traceProgram(code, "python");
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("c program passes and rejects missing pieces", () => {
  const ok = `#include <stdio.h>
#include <stdlib.h>
int main(void) {
  int *a = malloc(4 * sizeof(int));
  if (!a) return 1;
  a[0] = 1;
  printf("%d\\n", a[0]);
  free(a);
  return 0;
}
`;
  assert.equal(traceProgram(ok, "c").ok, true, JSON.stringify(traceProgram(ok, "c").issues));
  assert.equal(traceProgram("#include <stdio.h>\nint main(void) {\n  printf(\"%d\\n\", 1)\n  return 0;\n}\n", "c").ok, false);
  const noMain = "#include <stdio.h>\nvoid greet(void) { printf(\"hi\\n\"); }\n";
  assert.equal(traceProgram(noMain, "c").ok, false);
  const noHeader = "int main(void) { printf(\"%d\\n\", 1); return 0; }\n";
  assert.equal(traceProgram(noHeader, "c").ok, false);
});

test("c++ iostream and brace-init pass", () => {
  const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> v{1, 2, 3};
  sort(v.begin(), v.end());
  for (int x : v) cout << x << "\\n";
  return 0;
}
`;
  const result = traceProgram(code, "cpp");
  assert.equal(result.ok, true, JSON.stringify(result.issues));
});

test("c++ cout without header fails", () => {
  const code = "int main() { cout << 1; return 0; }\n";
  assert.equal(traceProgram(code, "cpp").ok, false);
});

test("language mismatch fails", () => {
  assert.equal(traceProgram("#include <stdio.h>\nint main(void){return 0;}\n", "python").ok, false);
  assert.equal(traceProgram("def f():\n    return 1\nprint(f())\n", "c").ok, false);
});
