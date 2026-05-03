import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { Photo } from "@/data/mock-event";

export function Gallery({ photos }: { photos: Photo[] }) {
  return (
    <div className="columns-2 gap-3 sm:columns-3 [&>*]:mb-3">
      {photos.map((p, i) => (
        <motion.button
          key={p.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.4 }}
          className="group relative block w-full overflow-hidden rounded-2xl bg-muted shadow-card"
        >
          <img
            src={p.src}
            alt={p.caption ?? ""}
            loading="lazy"
            className="w-full transition duration-500 group-hover:scale-[1.03]"
            style={{ aspectRatio: `${p.width} / ${p.height}` }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-3 text-xs text-white opacity-0 transition group-hover:opacity-100">
            <span className="truncate font-medium">{p.author}</span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 fill-white" />
              {p.likes}
            </span>
          </div>
        </motion.button>
      ))}
    </div>
  );
}