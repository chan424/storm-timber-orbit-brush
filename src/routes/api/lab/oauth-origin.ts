import { createFileRoute } from "@tanstack/react-router";
import { canonicalOrigin } from "@/lib/lab/google-handoff.server";

export const Route = createFileRoute("/api/lab/oauth-origin")({
  server: {
    handlers: {
      GET: () => Response.json({ origin: canonicalOrigin() ?? "" }),
    },
  },
});
