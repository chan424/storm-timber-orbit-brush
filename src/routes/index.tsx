import { createFileRoute } from "@tanstack/react-router";
import { PortalHome } from "@/components/lab/portal-home";

export const Route = createFileRoute("/")({ component: PortalHome });
