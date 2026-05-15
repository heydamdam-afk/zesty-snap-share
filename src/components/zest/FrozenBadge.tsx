export function FrozenBadge({ expireAt }: { expireAt: string | null | undefined }) {
  if (!expireAt) return null;
  const daysLeft = Math.floor(
    (new Date(expireAt).getTime() - Date.now()) / 86400000,
  );
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