import { toast } from "sonner";

const reported = new Set<string>();

/**
 * Diagnostic centralisé pour les images qui ne se chargent pas.
 * - Log la cause probable (URL relative, mixed content, hôte distant…)
 * - Tente un HEAD pour récupérer le statut HTTP réel et le content-type
 * - Affiche UN seul toast par URL pour ne pas spammer
 */
export async function reportImageError(
  src: string | null | undefined,
  context: string,
) {
  if (!src) {
    console.warn(`[img-error] ${context} — src vide`);
    toast.error(`Image manquante (${context}) — aucune URL`);
    return;
  }
  if (reported.has(src)) return;
  reported.add(src);

  const info: Record<string, unknown> = {
    context,
    src,
    pageProtocol: typeof window !== "undefined" ? window.location.protocol : "n/a",
    online: typeof navigator !== "undefined" ? navigator.onLine : "n/a",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
  };

  // Détections rapides côté client
  const reasons: string[] = [];
  if (src.startsWith("//")) reasons.push("URL protocol-relative");
  if (src.startsWith("http://") && info.pageProtocol === "https:") {
    reasons.push("Mixed content (HTTP sur page HTTPS)");
  }
  if (!/^https?:\/\//i.test(src) && !src.startsWith("/") && !src.startsWith("blob:") && !src.startsWith("data:")) {
    reasons.push("URL relative inattendue");
  }

  // Tente un HEAD pour obtenir le statut HTTP
  let httpStatus: number | string = "?";
  let contentType: string | null = null;
  try {
    const res = await fetch(src, { method: "HEAD", mode: "cors" });
    httpStatus = res.status;
    contentType = res.headers.get("content-type");
    if (!res.ok) reasons.push(`HTTP ${res.status}`);
    if (contentType && !contentType.startsWith("image/")) {
      reasons.push(`Content-Type non-image: ${contentType}`);
    }
  } catch (e) {
    httpStatus = "network/CORS";
    reasons.push(`fetch HEAD a échoué (${e instanceof Error ? e.message : "network/CORS"})`);
  }

  console.error("[img-error]", { ...info, httpStatus, contentType, reasons });

  const cause = reasons.length > 0 ? reasons.join(" · ") : "cause inconnue";
  toast.error(`Image impossible à charger (${context})`, {
    description: `${cause}\n${src.slice(0, 120)}${src.length > 120 ? "…" : ""}`,
    duration: 8000,
  });
}