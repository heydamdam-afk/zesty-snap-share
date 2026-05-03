import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Calendar, MapPin, User, Share2, Check } from "lucide-react";
import { event } from "@/data/mock-event";

const EVENT_CODE = "JULIE2026";

export function QrPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/?code=${EVENT_CODE}`
      : `https://zeste.app/?code=${EVENT_CODE}`;

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 260,
      margin: 1,
      color: { dark: "#212B36", light: "#FFFFFF" },
    }).catch(() => {});
  }, [url]);

  const onShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: event.title,
          text: `Rejoignez la galerie photo : ${event.title}`,
          url,
        });
        return;
      }
    } catch {
      /* user cancel */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="px-6 pb-32 pt-6 text-center">
      <h2 className="font-display text-xl font-bold text-foreground">
        Partagez cet event !
      </h2>
      <div className="mx-auto mt-5 inline-block rounded-2xl bg-card p-4 shadow-card">
        <canvas ref={canvasRef} className="block" />
      </div>

      <p className="mt-5 text-xs uppercase tracking-wide text-muted-foreground">
        Code d'accès
      </p>
      <p className="font-display text-2xl font-bold text-primary">
        {EVENT_CODE}
      </p>

      <ul className="mx-auto mt-5 inline-flex flex-col gap-2 text-left text-sm text-muted-foreground">
        <li className="flex items-center gap-2">
          <Calendar className="h-4 w-4" /> {event.date}
        </li>
        <li className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> {event.location}
        </li>
        <li className="flex items-center gap-2">
          <User className="h-4 w-4" /> Contact : {event.host}
        </li>
      </ul>

      <button
        type="button"
        onClick={onShare}
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-card px-5 py-3 text-sm font-semibold text-foreground shadow-card transition active:scale-[0.99]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-primary" /> Lien copié !
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" /> Partager le lien
          </>
        )}
      </button>
    </div>
  );
}