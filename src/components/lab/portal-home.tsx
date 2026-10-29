import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard, Rules } from "@/components/lab/login-panel";
import { AdminBoard } from "@/components/lab/admin-board";
import { StudentDesk } from "@/components/lab/student-desk";
import { getAccess } from "@/lib/lab/api";
import type { Access } from "@/lib/lab/types";

export function PortalHome() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Frame />;
  if (!user) {
    return (
      <Frame wide>
        <Intro />
        <div className="mt-8 lg:mt-0">
          <LoginCard />
        </div>
      </Frame>
    );
  }
  return <SignedIn />;
}

function SignedIn() {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getAccess()
      .then((next) => {
        if (!cancelled) setAccess(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open the portal.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Frame>
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      </Frame>
    );
  }
  if (!access) return <Frame />;
  if (!access.role) {
    return (
      <Frame wide>
        <Intro />
        <div className="mt-8 lg:mt-0">
          <LoginCard signedInAs={access.email} />
        </div>
      </Frame>
    );
  }
  return (
    <Frame>
      {access.role === "admin" ? <AdminBoard /> : <StudentDesk studentId={access.studentId ?? access.email} />}
    </Frame>
  );
}

function Intro() {
  return (
    <div>
      <p className="max-w-xl text-base text-pretty text-muted">
        Design and Analysis of Algorithms. Paste each experiment, run the trace, and keep the mark beside the program.
      </p>
      <Rules />
    </div>
  );
}

function Frame({ children, wide = false }: { children?: ReactNode; wide?: boolean }) {
  return (
    <div className="relative min-h-screen bg-paper text-ink">
      <div className="h-1 bg-accent" />
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent uppercase">RGUKT Ongole</p>
            <h1 className="mt-2 max-w-3xl font-serif text-3xl leading-tight font-semibold text-balance sm:text-4xl">
              DAA RGUKT ONGOLE LAB EVALUATION PORTAL
            </h1>
          </div>
          <UserButton />
        </header>
        <div className={wide ? "mt-8 lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:items-start lg:gap-12" : ""}>
          {children}
        </div>
      </div>
    </div>
  );
}
