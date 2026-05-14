export function FrozenBadge({ frozenAt }: { frozenAt: string | null | undefined }) {
  if (!frozenAt) return null;
  const daysSinceFrozen = Math.floor(
    (Date.now() - new Date(frozenAt).getTime()) / 86400000,
  );
  const daysLeft = 37 - daysSinceFrozen;
  if (daysLeft > 37) return null;
  const text =
    daysLeft <= 0
      ? "🔒 Clôturé — suppression imminente"
      : `🔒 Clôturé — suppression dans ${daysLeft} jours`;
  return (
    <span
      className="inline-flex items-center whitespace-nowrap align-middle"
      style={{
        backgroundColor: "#FFF3E0",
        color: "#E65100",
        borderRadius: 100,
        fontSize: 11,
        padding: "2px 10px",
      }}
    >
      {text}
    </span>
  );
}