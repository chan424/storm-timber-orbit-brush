import { createFileRoute } from "@tanstack/react-router";
import { claimGoogle } from "@/lib/lab/google-handoff.server";

export const Route = createFileRoute("/api/lab/oauth-finish")({
  server: {
    handlers: {
      POST: ({ request }) => claimGoogle(request),
    },
  },
});
