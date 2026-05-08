import { motion } from "framer-motion";
import { Heart, Trash2 } from "lucide-react";
import type { FeedPost } from "@/hooks/useEventFeed";
import { deletePost } from "@/lib/zest-admin";
import { reportImageError } from "@/lib/image-diagnostics";

type FlatPhoto = {
  postId: string;
  photoId: string;
  url: string;
  fullUrl: string | null;
  authorPrenom: string | null;
  authorDeviceId: string | null;
  nbLikes: number;
};

export function Gallery({
  posts,
  isAdmin = false,
  currentDeviceId,
  onChanged,
}: {
  posts: FeedPost[];
  isAdmin?: boolean;
  currentDeviceId?: string;
  onChanged?: () => void | Promise<void>;
}) {
  const photos: FlatPhoto[] = posts.flatMap((p) => {
    const list = p.photos.length > 0
      ? p.photos.map((ph) => ({
          postId: p.id,
          photoId: ph.id,
          url: ph.url_medium ?? ph.url_full ?? "",
          fullUrl: ph.url_full,
        }))
      : p.url_medium
        ? [{ postId: p.id, photoId: p.id, url: p.url_medium, fullUrl: p.url_full }]
        : [];
    return list
      .filter((ph) => ph.url)
      .map((ph) => ({
        ...ph,
        authorPrenom: p.invites?.prenom ?? null,
        authorDeviceId: p.invites?.device_id ?? null,
        nbLikes: p.nb_likes,
      }));
  });
  if (photos.length === 0) {
    return (
      <p className="px-6 py-12 text-center text-sm text-muted-foreground">
        Aucune photo pour le moment.
      </p>
    );
  }
  const remove = async (id: string, asOwner: boolean) => {
    if (!window.confirm("Supprimer cette publication ?")) return;
    try {
      await deletePost(id, asOwner ? currentDeviceId : undefined);
      await onChanged?.();
    } catch (e) {
      console.error(e);
      window.alert("Suppression impossible");
    }
  };
  return (
    <div className="grid grid-cols-2 gap-[2px]">
      {photos.map((p, i) => (
        <motion.button
          key={p.photoId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.02, duration: 0.25 }}
          className="group relative block aspect-square w-full overflow-hidden bg-muted"
        >
          <img
            src={p.url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              void reportImageError(el.src, `galerie (post ${p.postId.slice(0, 8)})`);
            }}
          />
          {/* Gradient bas pour lisibilité overlay */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
            }}
          />
          {(isAdmin || (currentDeviceId && p.authorDeviceId === currentDeviceId)) && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                const asOwner = !isAdmin;
                void remove(p.postId, asOwner);
              }}
              title="Supprimer cette publication"
              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-destructive shadow hover:bg-destructive hover:text-destructive-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </span>
          )}
          {/* Overlay auteur (bas gauche) */}
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5 text-white">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-gradient-coral text-[9px] font-bold">
              {(p.authorPrenom?.[0] ?? "?").toUpperCase()}
            </span>
            <span className="text-[11px] font-medium drop-shadow">
              {p.authorPrenom ?? "Invité"}
            </span>
          </div>
          {/* Likes (bas droite) */}
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-[11px] text-white">
            <Heart className="h-3 w-3 fill-white" />
            {p.nbLikes}
          </div>
        </motion.button>
      ))}
    </div>
  );
}