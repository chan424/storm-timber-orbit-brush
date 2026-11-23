import { createFileRoute } from "@tanstack/react-router";
import { claimGoogle } from "@/lib/lab/google-handoff.server";

export const Route = createFileRoute("/api/lab/oauth-finish")({
  server: {
    handlers: {
      OPTIONS: ({ request }) => {
        const origin = request.headers.get("origin") ?? "";
        const headers = new Headers({
          "access-control-allow-origin": origin,
          "access-control-allow-headers": "content-type",
          "access-control-allow-methods": "POST, OPTIONS",
        });
        return new Response(null, { status: 204, headers });
      },
      POST: ({ request }) => claimGoogle(request),
    },
  },
});