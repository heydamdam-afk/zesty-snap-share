import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import type { FeedPost } from "@/hooks/useEventFeed";

export function Gallery({ posts }: { posts: FeedPost[] }) {
  const photos = posts.filter((p) => p.url_medium);
  if (photos.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted-foreground">
        Aucune photo pour le moment.
      </p>
    );
  }
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
            src={p.url_medium!}
            alt={p.contenu_texte ?? ""}
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
              {(p.invites?.prenom?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="text-[11px] font-medium drop-shadow">
              {p.invites?.prenom ?? "Invité"}
            </span>
          </div>
          {/* Likes (bas droite) */}
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[11px] text-white">
            <Heart className="h-3 w-3 fill-white" />
            {p.nb_likes}
          </div>
        </motion.button>
      ))}
    </div>
  );
}