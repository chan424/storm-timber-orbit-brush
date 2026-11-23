export const ADMIN_EMAIL = "ncs@rguktong.ac.in";
export const ADMIN_EMAILS = ["ncs@rguktong.ac.in", "dataongole@gmail.com"] as const;
export const TEST_EMAIL = "test@rguktong.ac.in";
export const STUDENT_DOMAIN = "rguktong.ac.in";

export type PortalRole = "admin" | "student";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Student IDs are the mailbox name, e.g. o234747 from o234747@rguktong.ac.in. */
export function studentIdFromEmail(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  return local;
}

export function roleForEmail(email: string): PortalRole | null {
  const e = normalizeEmail(email);
  if (!e || e.includes(" ") || !e.includes("@")) return null;
  if ((ADMIN_EMAILS as readonly string[]).includes(e)) return "admin";
  if (e === TEST_EMAIL) return "student";
  const [local, domain, ...rest] = e.split("@");
  if (!local || rest.length > 0 || domain !== STUDENT_DOMAIN) return null;
  // Batches o21, o22, and o23 only, for example o234747@rguktong.ac.in.
  if (!/^o(21|22|23)[a-z0-9]{2,10}$/.test(local)) return null;
  return "student";
}
