import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "./index";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion organisateur — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Landing,
});