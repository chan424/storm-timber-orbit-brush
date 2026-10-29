export const ADMIN_EMAIL = "dataongole@gmail.com";
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
  if (e === ADMIN_EMAIL) return "admin";
  const [local, domain, ...rest] = e.split("@");
  if (!local || rest.length > 0 || domain !== STUDENT_DOMAIN) return null;
  if (!/^[a-z0-9][a-z0-9._+-]{0,63}$/.test(local)) return null;
  return "student";
}
