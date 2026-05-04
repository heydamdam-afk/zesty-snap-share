import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function AdminBookmark({ onContinue }: { onContinue: () => void }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}/admin` : "/admin";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div
        className="w-full max-w-[400px] rounded-2xl bg-white"
        style={{ padding: 32 }}
      >
        <div className="mb-4 text-center" style={{ fontSize: 48, lineHeight: 1 }}>
          🔐
        </div>
        <h1
          className="text-center"
          style={{
            fontFamily: '"Josefin Sans", system-ui, sans-serif',
            fontWeight: 700,
            fontSize: 24,
            color: "#212B36",
          }}
        >
          Votre espace admin est prêt !
        </h1>
        <p
          className="mx-auto mt-3 text-center"
          style={{
            fontFamily: '"Public Sans", system-ui, sans-serif',
            fontWeight: 400,
            fontSize: 14,
            color: "#637381",
            maxWidth: 320,
          }}
        >
          Bookmarquez ce lien pour y accéder facilement à tout moment :
        </p>

        <div
          className="mt-5 break-all text-center"
          style={{
            backgroundColor: "#F4F6F8",
            borderRadius: 8,
            padding: 16,
            fontFamily: '"Public Sans", system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 14,
            color: "#FF4842",
            userSelect: "all",
          }}
        >
          {url}
        </div>

        <button
          type="button"
          onClick={copy}
          className="mt-3 flex w-full items-center justify-center gap-2 transition"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #FF4842",
            color: copied ? "#00AB55" : "#FF4842",
            borderRadius: 8,
            padding: "12px 16px",
            fontFamily: '"Public Sans", system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Lien copié !
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" /> Copier le lien
            </>
          )}
        </button>

        <div
          className="mt-6"
          style={{
            backgroundColor: "#FFF8F0",
            borderRadius: 8,
            padding: 12,
            fontFamily: '"Public Sans", system-ui, sans-serif',
            fontWeight: 400,
            fontSize: 13,
            color: "#637381",
            lineHeight: 1.5,
          }}
        >
          <div>
            💡 <strong>iPhone</strong> : Safari → partager → « Sur l'écran d'accueil »
          </div>
          <div className="mt-1">
            💡 <strong>Android</strong> : Chrome → menu ⋮ → « Ajouter à l'écran d'accueil »
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 w-full transition hover:opacity-95"
          style={{
            backgroundColor: "#FF4842",
            color: "#FFFFFF",
            borderRadius: 8,
            padding: "14px 16px",
            fontFamily: '"Josefin Sans", system-ui, sans-serif',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          Accéder à ma galerie →
        </button>
      </div>
    </div>
  );
}

export const ADMIN_ONBOARDED_KEY = "zeste_admin_onboarded";