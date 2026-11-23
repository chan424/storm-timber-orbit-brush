import { createFileRoute } from "@tanstack/react-router";
import { startGoogle } from "@/lib/lab/google-handoff.server";

export const Route = createFileRoute("/api/lab/oauth-start")({
  server: {
    handlers: {
      GET: ({ request }) => startGoogle(request),
    },
  },
});
