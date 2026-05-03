import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { Photo } from "@/data/mock-event";

export function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <div className="grid grid-cols-2 gap-[2px]">
      {photos.map((p, i) => (
        <motion.button
          key={p.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.02, duration: 0.25 }}
          className="group relative block aspect-square w-full overflow-hidden bg-muted"
        >
          <img
            src={p.src}
            alt={p.caption ?? ""}
            loading="lazy"
            className="h-full w-full object-cover"
          />
          {/* Gradient bas pour lisibilité overlay */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
            }}
          />
          {/* Overlay auteur (bas gauche) */}
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 text-white">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-coral text-[9px] font-bold">
              {p.initials}
            </span>
            <span className="text-[11px] font-medium drop-shadow">
              {p.author.split(" ")[0]}
            </span>
          </div>
          {/* Likes (bas droite) */}
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[11px] text-white">
            <Heart className="h-3 w-3 fill-white" />
            {p.likes}
          </div>
        </motion.button>
      ))}
    </div>
  );
}