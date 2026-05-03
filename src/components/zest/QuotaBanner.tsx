import { AlertTriangle, Ban } from "lucide-react";

export function QuotaBanner({ used, total }: { used: number; total: number }) {
  const ratio = total > 0 ? used / total : 0;
  if (ratio < 0.9) return null;

  const full = ratio >= 1;
  const bg = full ? "#FFE4E1" : "#FFF4E0";
  const fg = full ? "#B71C1C" : "#FFA000";
  const Icon = full ? Ban : AlertTriangle;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
      style={{ backgroundColor: bg, color: fg }}
      role="status"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {full
          ? "Galerie pleine — plus de nouvelles photos acceptées"
          : "Galerie presque pleine"}
      </span>
      <span className="tabular-nums opacity-80">
        {used}/{total}
      </span>
    </div>
  );
}

export const QUOTA_FULL_MESSAGE =
  "La galerie ne peut plus accepter de nouvelles photos";