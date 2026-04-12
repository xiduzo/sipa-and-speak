import { createFileRoute } from "@tanstack/react-router";

import AlumniSignInForm from "@/components/alumni-sign-in-form";

export const Route = createFileRoute("/alumni-login")({
  component: RouteComponent,
});

function RouteComponent() {
  return <AlumniSignInForm />;
}
