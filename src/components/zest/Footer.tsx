import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer
      className="flex items-center justify-center gap-1 text-center"
      style={{ padding: 24 }}
    >
      <span
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: "#919EAB",
        }}
      >
        Propulsé par
      </span>
      <span
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 600,
          fontSize: 12,
          color: "#919EAB",
        }}
      >
        Zeste
      </span>
      <span style={{ color: "#919EAB", fontSize: 12 }}>·</span>
      <Link
        to="/admin"
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: "#919EAB",
        }}
      >
        Admin
      </Link>
    </footer>
  );
}