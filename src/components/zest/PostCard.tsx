import { useState } from "react";
import { Heart, MessageCircle, Send, Trash2, Shield, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import type { FeedPost } from "@/hooks/useEventFeed";
import { addComment, deleteOwnComment, toggleLike } from "@/lib/zest-actions";
import { deletePost, deleteCommentAsAdmin } from "@/lib/zest-admin";
import type { GuestSession } from "@/lib/zest-session";
import { reportImageError } from "@/lib/image-diagnostics";
import Lightbox from "./Lightbox";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h} h`;
  return `Il y a ${Math.floor(h / 24)} j`;
}

function initialsOf(name?: string | null) {
  return (name?.[0] ?? "?").toUpperCase();
}

export function PostCard({
  post,
  guest,
  isAdmin = false,
  onChanged,
}: {
  post: FeedPost;
  guest: GuestSession;
  isAdmin?: boolean;
  onChanged?: () => void | Promise<void>;
}) {
  const [liked, setLiked] = useState(post.liked_by_me);
  const [count, setCount] = useState(post.nb_likes);
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const author = post.invites?.prenom ?? "Invité";

  const onToggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      await toggleLike({
        photoId: post.id,
        inviteId: guest.invite.id,
        deviceId: guest.invite.device_id,
        currentlyLiked: liked,
      });
    } catch (e) {
      setLiked(liked);
      setCount(post.nb_likes);
      console.error(e);
    }
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await addComment({ photoId: post.id, inviteId: guest.invite.id, contenu: text });
      setDraft("");
    } finally {
      setBusy(false);
    }
  };

  const removeComment = async (id: string) => {
    await deleteOwnComment(id, guest.invite.device_id);
  };

  const adminDeletePost = async () => {
    if (!window.confirm("Supprimer ce post ?")) return;
    try {
      await deletePost(post.id);
      await onChanged?.();
      toast.success("Post supprimé");
    } catch (e) {
      console.error("[adminDeletePost]", e);
      toast.error(`Suppression impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
  };

  const isMine = post.invites?.device_id === guest.invite.device_id;

  const ownerDeletePost = async () => {
    if (!window.confirm("Supprimer ce post ?")) return;
    try {
      await deletePost(post.id, guest.invite.device_id);
      await onChanged?.();
      toast.success("Post supprimé");
    } catch (e) {
      console.error("[ownerDeletePost]", e);
      toast.error(`Suppression impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
  };

  const adminDeleteComment = async (id: string) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    try {
      await deleteCommentAsAdmin(id);
      await onChanged?.();
      toast.success("Commentaire supprimé");
    } catch (e) {
      console.error("[adminDeleteComment]", e);
      toast.error(`Suppression impossible : ${e instanceof Error ? e.message : "erreur inconnue"}`);
    }
  };

  // Prefer the new post_photos[] (sorted by position). Fall back to the
  // legacy single-photo columns for any historical post that wasn't migrated.
  const photos = post.photos.length > 0
    ? post.photos
    : post.url_medium
      ? [{ id: "legacy", position: 0, url_miniature: post.url_miniature, url_medium: post.url_medium, url_full: post.url_full }]
      : [];
  const isPhoto = photos.length > 0;
  const [photoIdx, setPhotoIdx] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const current = photos[Math.min(photoIdx, photos.length - 1)];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden rounded-3xl bg-card shadow-card"
    >
      <div className="flex items-center gap-3 p-4">
        <Avatar initials={initialsOf(author)} src={post.invites?.avatar_url ?? null} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">{author}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
        </div>
        {isAdmin && (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/90 px-2 py-0.5 text-[10px] font-semibold text-background">
            <Shield className="h-3 w-3" /> admin
          </span>
        )}
      </div>

      {post.contenu_texte && (
        <p className="px-4 pb-3 text-sm text-foreground/90">{post.contenu_texte}</p>
      )}

      {isPhoto && (
        <div className="relative w-full bg-muted">
          <img
            key={current?.id}
            src={current?.url_medium ?? current?.url_full ?? ""}
            alt={post.contenu_texte ?? ""}
            loading="lazy"
            onClick={() => setLightboxIndex(photoIdx)}
            className="w-full cursor-pointer object-cover"
            onError={(e) => {
              const el = e.currentTarget;
              void reportImageError(el.src, `feed photo (post ${post.id.slice(0, 8)})`);
            }}
          />
          {photos.length > 1 && (
            <>
              {photoIdx > 0 && (
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => Math.max(0, i - 1))}
                  aria-label="Photo précédente"
                  className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {photoIdx < photos.length - 1 && (
                <button
                  type="button"
                  onClick={() => setPhotoIdx((i) => Math.min(photos.length - 1, i + 1))}
                  aria-label="Photo suivante"
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                {photos.map((p, i) => (
                  <span
                    key={p.id}
                    className={`h-1.5 w-1.5 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/50"}`}
                  />
                ))}
              </div>
              <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground">
                {photoIdx + 1}/{photos.length}
              </span>
            </>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 px-4 py-3">
        <button
          onClick={onToggleLike}
          className="group flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-secondary"
        >
          <Heart
            className={`h-5 w-5 transition ${
              liked ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"
            }`}
          />
          <span className="text-sm font-medium text-foreground">{count}</span>
        </button>
        <button
          onClick={() => setShowComments((v) => !v)}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition hover:bg-secondary ${
            showComments ? "text-primary" : "text-muted-foreground"
          }`}
        >
          <MessageCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{post.comments.length}</span>
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={adminDeletePost}
            title="Supprimer ce post"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {!isAdmin && isMine && (
          <button
            type="button"
            onClick={ownerDeletePost}
            title="Supprimer mon post"
            className="ml-auto grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {showComments && (
          <motion.section
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            {post.comments.length > 0 && (
              <ul className="space-y-3 px-4 py-3">
                {post.comments.map((c) => {
                  const cName = c.invites?.prenom ?? "Invité";
                  const isMine = c.invite_id === guest.invite.id;
                  return (
                    <li key={c.id} className="flex gap-2">
                      <Avatar initials={initialsOf(cName)} src={c.invites?.avatar_url ?? null} size="sm" />
                      <div className="min-w-0 flex-1 rounded-lg rounded-tl-none bg-secondary px-3 py-2">
                        <p className="text-xs font-semibold text-foreground">{cName}</p>
                        <p className="text-sm text-foreground/90">{c.contenu}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">
                            {timeAgo(c.created_at)}
                          </p>
                          {(isMine || isAdmin) && (
                            <button
                              onClick={() => isAdmin && !isMine ? adminDeleteComment(c.id) : removeComment(c.id)}
                              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:text-primary"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="flex items-center gap-2 border-t border-border bg-card px-4 py-3">
              <Avatar initials={guest.initial} src={guest.invite.avatar_url} size="sm" />
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                placeholder="Écrire un commentaire…"
                className="flex-1 rounded-full bg-secondary px-3 py-1.5 text-sm focus:outline-none"
              />
              <button
                onClick={submit}
                disabled={!draft.trim() || busy}
                className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </motion.article>
  );
}