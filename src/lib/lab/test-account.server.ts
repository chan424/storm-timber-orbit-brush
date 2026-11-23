import { auth } from "@/lib/auth/server";

const TEST_EMAIL = "test@rguktong.ac.in";
const TEST_PASSWORD = "test123";

let pending: Promise<void> | null = null;

/** Creates the shared testing account once. Later calls do nothing. */
export function ensureTestAccount(): Promise<void> {
  if (!pending) {
    pending = create().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

async function create(): Promise<void> {
  const existing = await auth.api.signInEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD },
  }).catch(() => null);
  if (existing && "user" in existing && existing.user) return;
  await auth.api.signUpEmail({
    body: { email: TEST_EMAIL, password: TEST_PASSWORD, name: "test" },
  });
}
