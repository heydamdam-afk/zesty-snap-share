import { useState } from "react";
import { Heart, MessageCircle, Share2, MoreHorizontal, Send, Smile, ImagePlus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "./Avatar";
import type { Photo } from "@/data/mock-event";

export function PostCard({ photo }: { photo: Photo }) {
  const [liked, setLiked] = useState(!!photo.liked);
  const [count, setCount] = useState(photo.likes);

  const toggle = () => {
    setLiked((v) => !v);
    setCount((c) => (liked ? c - 1 : c + 1));
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className="overflow-hidden rounded-3xl bg-card shadow-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Avatar initials={photo.initials} />
          <div>
            <p className="text-sm font-semibold text-foreground">{photo.author}</p>
            <p className="text-xs text-muted-foreground">{photo.date}</p>
          </div>
        </div>
        <button className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {photo.caption && (
        <p className="px-4 pb-3 text-sm text-foreground/90">{photo.caption}</p>
      )}

      {/* Image */}
      <div className="relative bg-muted">
        <img
          src={photo.src}
          alt={photo.caption ?? ""}
          loading="lazy"
          className="w-full object-cover"
          style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={toggle}
            className="group flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-secondary"
          >
            <motion.span
              key={String(liked)}
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
            >
              <Heart
                className={`h-5 w-5 transition ${
                  liked ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"
                }`}
              />
            </motion.span>
            <span className="text-sm font-medium text-foreground">{count}</span>
          </button>
          <button className="flex items-center gap-2 rounded-full px-3 py-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground">
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-medium">{photo.comments.length}</span>
          </button>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground">
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments */}
      <AnimatePresence initial={false}>
        {photo.comments.length > 0 && (
          <div className="space-y-2 border-t border-border bg-muted/40 px-4 py-3">
            {photo.comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar initials={c.initials} size="sm" />
                <div className="min-w-0 flex-1 rounded-2xl bg-card px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-foreground">{c.author}</p>
                    <p className="text-[10px] text-muted-foreground">{c.date}</p>
                  </div>
                  <p className="text-sm text-foreground/90">{c.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Compose */}
      <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
        <Avatar initials="ML" size="sm" />
        <div className="flex flex-1 items-center gap-1 rounded-full bg-secondary px-3 py-1.5">
          <input
            placeholder="Écrire un commentaire…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground">
            <Smile className="h-4 w-4" />
          </button>
          <button className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-foreground">
            <ImagePlus className="h-4 w-4" />
          </button>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft transition hover:scale-105">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}