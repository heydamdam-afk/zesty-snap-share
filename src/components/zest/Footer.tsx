import { Link } from "@tanstack/react-router";

export function Footer({
  slug,
}: {
  eventId?: string;
  eventTitle?: string;
  slug?: string;
}) {
  const redirect = slug ? `/${slug}/admin/dashboard` : undefined;
  return (
    <footer
      className="flex items-center justify-center gap-1 text-center"
      style={{ padding: 24 }}
    >
      <Link
        to="/login"
        search={redirect ? ({ redirect } as never) : undefined}
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: "#919EAB",
          textDecoration: "none",
        }}
        className="hover:underline"
      >
        Organisateur ? Connectez-vous
      </Link>
    </footer>
  );
}