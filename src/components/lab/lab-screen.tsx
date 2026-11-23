import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { UserButton } from "@/lib/auth/gates";
import { listLabs } from "@/lib/lab/labs-api";
import { getAccess } from "@/lib/lab/api";
import type { LabDef } from "@/lib/lab/catalog";
import type { Access } from "@/lib/lab/types";
import { AdminBoard } from "@/components/lab/admin-board";
import { StudentDesk } from "@/components/lab/student-desk";

export function LabScreen({ slug }: { slug: string }) {
  const { user, isPending } = useCurrentUserState();
  const [lab, setLab] = useState<LabDef | null>(null);
  const [missing, setMissing] = useState(false);
  const [access, setAccess] = useState<Access | null>(null);

  useEffect(() => {
    let cancelled = false;
    listLabs()
      .then((labs) => {
        if (cancelled) return;
        const found = labs.find((item) => item.slug === slug) ?? null;
        setLab(found);
        setMissing(!found);
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    getAccess()
      .then((next) => {
        if (!cancelled) setAccess(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="h-1 bg-accent" />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link to="/" className="text-sm font-semibold tracking-wide text-accent uppercase">
              RGUKT Labs
            </Link>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-balance">{lab?.title ?? "Lab"}</h1>
          </div>
          <UserButton />
        </header>
        {isPending || (user && !access && !missing) ? <p className="mt-8 text-sm text-muted">Opening the lab…</p> : null}
        {missing ? <p className="mt-8 text-sm text-danger">That lab is not on the list.</p> : null}
        {!isPending && !user ? (
          <p className="mt-8 text-sm text-muted">
            <Link to="/" className="font-semibold text-accent">Sign in</Link> with a college account to evaluate this lab.
          </p>
        ) : null}
        {lab && access?.role === "admin" ? <AdminBoard lab={lab.slug} /> : null}
        {lab && access?.role === "student" ? <StudentDesk studentId={access.studentId ?? access.email} lab={lab} /> : null}
      </div>
    </div>
  );
}
