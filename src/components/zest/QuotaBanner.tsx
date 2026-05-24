export const QUOTA_FULL_MESSAGE =
  "La galerie est pleine — contactez l'organisateur";

export function QuotaBanner({
  used,
  total,
  variant,
  upgradeHref = "#",
}: {
  used: number;
  total: number;
  variant: "admin" | "guest";
  upgradeHref?: string;
}) {
  if (total <= 0) return null;
  const percent = Math.round((used / total) * 100);
  if (percent < 90) return null;
  const full = percent >= 100;

  const style = full
    ? {
        backgroundColor: "rgba(255,72,66,0.12)",
        borderLeft: "4px solid #FF4842",
        color: "#B71C1C",
      }
    : {
        backgroundColor: "rgba(255,160,0,0.18)",
        borderLeft: "4px solid #FFA000",
        color: "#8a5a00",
      };

  let text: React.ReactNode;
  if (variant === "admin") {
    text = full ? (
      <>
        🚫 Quota atteint — uploads bloqués ·{" "}
        <a href={upgradeHref} className="font-semibold underline">
          Upgrader maintenant
        </a>
      </>
    ) : (
      <>
        ⚠️ Galerie presque pleine — {percent}% utilisé ·{" "}
        <a href={upgradeHref} className="font-semibold underline">
          Upgrader mon offre
        </a>
      </>
    );
  } else {
    text = full
      ? "La galerie ne peut plus accepter de nouvelles photos. Contactez l'organisateur."
      : "La galerie est presque pleine — contactez l'organisateur";
  }

  return (
    <div
      className="px-4 py-3 text-sm font-medium"
      style={style}
      role="status"
    >
      {text}
    </div>
  );
}