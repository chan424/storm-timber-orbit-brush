import { createFileRoute, Navigate } from "@tanstack/react-router";
import { PortalHome } from "@/components/lab/portal-home";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: LoginRoute });

function LoginRoute() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <PortalHome />;
  if (user) return <Navigate to="/" />;
  return <PortalHome />;
}
