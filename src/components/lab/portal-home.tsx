import { useEffect, useState, type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { LoginCard } from "@/components/lab/login-panel";
import { Catalog } from "@/components/lab/catalog";
import { getAccess } from "@/lib/lab/api";
import type { Access } from "@/lib/lab/types";

const BEARER_KEY = "grok-auth.bearer-token";

export function PortalHome() {
  const claiming = useGoogleHandoff();
  const { user, isPending } = useCurrentUserState();
  if (claiming || isPending) {
    return (
      <Frame>
        <p className="mt-8 text-sm text-muted">Signing in…</p>
      </Frame>
    );
  }
  if (!user) {
    return (
      <Frame>
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Intro />
          <LoginCard />
        </div>
        <Catalog role={null} />
      </Frame>
    );
  }
  return <SignedIn />;
}

function useGoogleHandoff(): boolean {
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("handoff");
    if (!code) return;
    setClaiming(true);
    const finish = async () => {
      try {
        const response = await fetch("/api/lab/oauth-finish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const token = response.headers.get("set-auth-token");
        if (token) sessionStorage.setItem(BEARER_KEY, token);
      } catch {
        /* The next load shows the sign-in form if the code was not accepted. */
      }
      const url = new URL(window.location.href);
      url.searchParams.delete("handoff");
      window.location.replace(`${url.pathname}${url.search}${url.hash}`);
    };
    void finish();
  }, []);
  return claiming;
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
      <Catalog role={access.role} />
    </Frame>
  );
}

function Intro() {
  return (
    <div>
      <p className="max-w-xl text-base text-pretty text-muted">
        A common desk for the CSE labs. Sign in, then open a lab.
      </p>
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
              RGUKT Labs
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
