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
    </footer>
  );
}