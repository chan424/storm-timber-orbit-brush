import { useState, type FormEvent } from "react";
import { authClient, signIn } from "@/lib/auth/client";
import { ADMIN_EMAIL, roleForEmail, studentIdFromEmail } from "@/lib/lab/access";

const BEARER_KEY = "grok-auth.bearer-token";

export function LoginCard({
  signedInAs,
}: {
  signedInAs?: string | null;
}) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const nextEmail = email.trim().toLowerCase();
    if (!roleForEmail(nextEmail)) {
      setError(`Use a student ID such as o234747@rguktong.ac.in, or ${ADMIN_EMAIL} for the evaluation cell.`);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      sessionStorage.removeItem(BEARER_KEY);
      await authClient.signOut().catch(() => undefined);
      sessionStorage.removeItem(BEARER_KEY);
      let token: string | null = null;
      const options = {
        onSuccess(ctx: { response: { headers: { get(name: string): string | null } } }) {
          token = ctx.response.headers.get("set-auth-token");
        },
      };
      if (mode === "up") {
        const { error: signUpError } = await authClient.signUp.email(
          {
            email: nextEmail,
            password,
            name: studentIdFromEmail(nextEmail) || "Student",
          },
          options,
        );
        if (signUpError) throw new Error(signUpError.message || "Could not create the account.");
      } else {
        const { error: signInError } = await authClient.signIn.email(
          { email: nextEmail, password },
          options,
        );
        if (signInError) throw new Error(signInError.message || "Could not sign in.");
      }
      if (token) sessionStorage.setItem(BEARER_KEY, token);
      window.location.assign("/");
    } catch (err) {
      setPending(false);
      setError(err instanceof Error ? err.message : "Could not sign in.");
    }
  }

  return (
    <div className="rounded-xl border border-line bg-sheet p-5 sm:p-6">
      <h2 className="font-serif text-2xl font-semibold text-balance">Sign in</h2>
      <p className="mt-2 text-sm text-pretty text-muted">
        Students use their RGUKT Ongole mail. The evaluation cell signs in as {ADMIN_EMAIL}.
      </p>
      {signedInAs ? (
        <p className="mt-4 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn" role="status">
          Signed in as {signedInAs}. That address is not on the lab roll. Use a college ID below.
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void signIn("grok-google", { callbackURL: "/" })}
        className="mt-5 flex h-11 w-full items-center justify-center rounded-md border border-line bg-sheet px-4 text-sm font-semibold text-ink transition-opacity hover:opacity-80"
      >
        Continue with Google
      </button>
      <p className="my-4 text-center text-xs font-medium tracking-wide text-muted uppercase">or email and password</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm font-medium" htmlFor="lab-email">
          Email
          <input
            id="lab-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="o234747@rguktong.ac.in"
            className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3 text-base text-ink outline-none placeholder:text-muted"
          />
        </label>
        <label className="block text-sm font-medium" htmlFor="lab-password">
          Password
          <input
            id="lab-password"
            type="password"
            autoComplete={mode === "up" ? "new-password" : "current-password"}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 h-11 w-full rounded-md border border-line bg-sheet px-3 text-base text-ink outline-none"
          />
        </label>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Checking the roll…" : mode === "up" ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "in" ? "up" : "in");
          setError("");
        }}
        className="mt-4 text-sm font-medium text-accent"
      >
        {mode === "in" ? "First time? Create an account" : "Already registered? Sign in"}
      </button>
    </div>
  );
}

export function Rules() {
  return (
    <ol className="mt-8 space-y-3 text-sm text-pretty text-muted">
      <li className="flex gap-3">
        <span className="font-mono text-xs text-accent">01</span>
        Five experiments. A clean trace is 10 marks.
      </li>
      <li className="flex gap-3">
        <span className="font-mono text-xs text-accent">02</span>
        C, C++, and Python are checked for errors that would stop a compiler or interpreter.
      </li>
      <li className="flex gap-3">
        <span className="font-mono text-xs text-accent">03</span>
        If more than 75% of the program reads as AI-written, 5 marks are deducted.
      </li>
      <li className="flex gap-3">
        <span className="font-mono text-xs text-accent">04</span>
        The total on screen is programs plus the viva choices, out of 60. Oral answers are 10 more, marked after the recordings are watched.
      </li>
    </ol>
  );
}
