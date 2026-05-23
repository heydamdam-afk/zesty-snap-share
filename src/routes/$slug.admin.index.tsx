import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$slug/admin/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/login",
      search: { redirect: `/${params.slug}/admin/dashboard` } as never,
    });
  },
  component: () => null,
});