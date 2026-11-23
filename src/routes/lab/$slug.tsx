import { createFileRoute } from "@tanstack/react-router";
import { LabScreen } from "@/components/lab/lab-screen";

export const Route = createFileRoute("/lab/$slug")({
  component: LabPage,
});

function LabPage() {
  const { slug } = Route.useParams();
  return <LabScreen slug={slug} />;
}
