import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { ZestLogo } from "@/components/zest/Logo";

export const Route = createFileRoute("/closed")({
  head: () => ({
    meta: [
      { title: "Galerie fermée — Zest" },
      {
        name: "description",
        content: "Cette galerie Zest est maintenant fermée.",
      },
    ],
  }),
  component: ClosedGallery,
});

function ClosedGallery() {
  // TODO: brancher sur les vraies données event (date de fermeture, option DL)
  const closedDate = "27 Juin 2026";
  const downloadAvailable = true;

  const handleDownload = () => {
    console.log("download my photos");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between bg-secondary px-6 py-12">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-6 text-6xl" aria-hidden>
          🎉
        </div>

        <h1
          className="font-display font-bold leading-tight"
          style={{ fontSize: 28, color: "#212B36" }}
        >
          Cette galerie est
          <br />
          maintenant fermée
        </h1>

        <p
          className="mt-6 text-base"
          style={{ color: "#637381", fontWeight: 400 }}
        >
          Fermée le {closedDate}
        </p>

        <p
          className="mt-4 max-w-xs text-base"
          style={{ color: "#637381", fontWeight: 400 }}
        >
          Les photos ont été remises au propriétaire de l'événement.
        </p>

        {downloadAvailable && (
          <button
            type="button"
            onClick={handleDownload}
            className="mt-10 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition active:scale-95"
            style={{ backgroundColor: "#FF4842" }}
          >
            <Download className="h-4 w-4" />
            Télécharger mes photos
          </button>
        )}
      </div>

      <footer className="pt-10">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          Propulsé par <ZestLogo />
        </div>
      </footer>
    </main>
  );
}