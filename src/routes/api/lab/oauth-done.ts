import { createFileRoute } from "@tanstack/react-router";
import { finishGoogle } from "@/lib/lab/google-handoff.server";

export const Route = createFileRoute("/api/lab/oauth-done")({
  server: {
    handlers: {
      GET: ({ request }) => finishGoogle(request),
    },
  },
});
