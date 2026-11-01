import { createFileRoute } from "@tanstack/react-router";
import { Root } from "@/app/Root";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return <Root />;
}
