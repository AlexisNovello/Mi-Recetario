import { createFileRoute } from "@tanstack/react-router";
import { PanelAdmin } from "@/components/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administración · Mi Recetario" }, { name: "robots", content: "noindex" }] }),
  component: PanelAdmin,
});
