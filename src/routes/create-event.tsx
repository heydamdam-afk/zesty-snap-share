import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { uploadOnePhoto } from "@/lib/zest-actions";
import {
  slugify,
  ensureUniqueSlug,
  ensureUniqueCode,
  validateCoupon,
  createEventWithCoupon,
} from "@/lib/zest-create-event";
import { toast } from "sonner";
import { Loader2, Check, X } from "lucide-react";

export const Route = createFileRoute("/create-event")({
  head: () => ({
    meta: [
      { title: "Créer un événement — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CreateEventPage,
});

const FormSchema = z.object({
  titre: z.string().trim().min(3, "3 caractères minimum").max(120),
  eventDate: z.string().min(1, "Date requise"),
  lieu: z.string().trim().min(1, "Lieu requis").max(200),
  contact: z.string().trim().min(1, "Contact requis").max(200),
  couponCode: z
    .string()
    .trim()
    .min(4, "Coupon requis")
    .max(40)
    .regex(/^[A-Z0-9_-]+$/i, "Format invalide"),
});

function CreateEventPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [titre, setTitre] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [lieu, setLieu] = useState("");
  const [contact, setContact] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponState, setCouponState] = useState<
    "idle" | "checking" | "valid" | "invalid"
  >("idle");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancel) return;
      if (!data.session?.user) {
        navigate({ to: "/" });
        return;
      }
      setAuthChecked(true);
    })();
    return () => {
      cancel = true;
    };
  }, [navigate]);

  // Validate coupon (debounced)
  useEffect(() => {
    const code = couponCode.trim();
    if (!code) {
      setCouponState("idle");
      setCouponMsg(null);
      return;
    }
    setCouponState("checking");
    const t = setTimeout(async () => {
      const res = await validateCoupon(code);
      if (res.valid) {
        setCouponState("valid");
        setCouponMsg("✓ Coupon valide — création gratuite");
      } else {
        setCouponState("invalid");
        const reasons: Record<string, string> = {
          empty: "Code vide",
          not_found: "Code introuvable",
          inactive: "Coupon désactivé",
          expired: "Coupon expiré",
          exhausted: "Coupon épuisé",
        };
        setCouponMsg(reasons[res.reason] ?? "Coupon invalide");
      }
    }, 400);
    return () => clearTimeout(t);
  }, [couponCode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = FormSchema.safeParse({
      titre,
      eventDate,
      lieu,
      contact,
      couponCode,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Formulaire invalide");
      return;
    }
    if (couponState !== "valid") {
      setError("Veuillez saisir un coupon valide");
      return;
    }

    const eventDateIso = new Date(parsed.data.eventDate).toISOString();
    if (Number.isNaN(new Date(parsed.data.eventDate).getTime())) {
      setError("Date invalide");
      return;
    }

    setSubmitting(true);
    try {
      const baseSlug = slugify(parsed.data.titre);
      const slug = await ensureUniqueSlug(baseSlug);
      const codeAcces = await ensureUniqueCode();

      // Upload cover si fourni — on a besoin d'un eventId pour R2,
      // donc on upload après création. Pour simplifier, on crée d'abord
      // l'event puis on update cover_url. Ici, on ne peut pas update events
      // (pas de policy). Compromis : on upload via un eventId temporaire = slug.
      // Mieux : créer l'event sans cover, puis cover via le dashboard admin.
      let coverUrl: string | null = null;
      if (coverFile) {
        toast.info("Photo de couverture : à ajouter ensuite via le tableau de bord admin");
      }

      const result = await createEventWithCoupon({
        titre: parsed.data.titre,
        slug,
        codeAcces,
        eventDate: eventDateIso,
        lieu: parsed.data.lieu,
        coverUrl,
        contact: parsed.data.contact,
        couponCode: parsed.data.couponCode,
      });

      // Upload cover after event creation (eventId now exists)
      if (coverFile) {
        try {
          const up = await uploadOnePhoto(coverFile, result.event_id);
          // Update via RPC ? Pas implémenté — on garde le compromis ci-dessus.
          void up;
        } catch (e) {
          console.warn("cover upload failed", e);
        }
      }

      navigate({
        to: "/create-event/success",
        search: { slug: result.slug, code: result.code_acces } as never,
      });
    } catch (err) {
      console.error("create_event_with_coupon failed:", err);
      const anyErr = err as { message?: string; details?: string; hint?: string; code?: string } | null;
      const raw =
        anyErr?.message ||
        anyErr?.details ||
        anyErr?.hint ||
        (err instanceof Error ? err.message : "") ||
        "Erreur inconnue";
      // Extract known error keys even if wrapped in a longer message
      const knownKeys = [
        "coupon_invalid","coupon_inactive","coupon_expired","coupon_exhausted",
        "slug_taken","code_taken","invalid_titre","invalid_slug","invalid_code_acces",
        "invalid_event_date","invalid_lieu","invalid_contact","invalid_cover_url",
        "not_authenticated","no_email",
      ];
      const found = knownKeys.find((k) => raw.includes(k));
      const msg = found ?? raw;
      const map: Record<string, string> = {
        coupon_invalid: "Coupon invalide",
        coupon_inactive: "Coupon désactivé",
        coupon_expired: "Coupon expiré",
        coupon_exhausted: "Coupon épuisé",
        slug_taken: "Ce nom est déjà pris, modifiez le titre",
        code_taken: "Conflit code d'accès, réessayez",
        invalid_titre: "Titre invalide",
        invalid_slug: "Slug invalide",
        invalid_code_acces: "Code d'accès invalide",
        invalid_event_date: "Date invalide",
        invalid_lieu: "Lieu invalide",
        invalid_contact: "Contact invalide",
        invalid_cover_url: "URL de couverture invalide",
        not_authenticated: "Vous devez être connecté",
        no_email: "Compte sans email",
      };
      setError(map[msg] ?? `Erreur : ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked) return null;

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="mb-6 flex items-center gap-2">
          <ZestLogo />
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            Nouvel event
          </span>
        </div>

        <div className="w-full rounded-3xl bg-card/95 p-7 shadow-card backdrop-blur">
          <h1 className="font-display text-2xl text-foreground">
            Créez votre événement
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Quelques infos et vous obtenez un QR code à partager.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {error && (
              <div
                className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}

            <Field label="Titre de l'événement" htmlFor="titre">
              <input
                id="titre"
                type="text"
                required
                maxLength={120}
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                placeholder="Mariage Sabrina & Thomas"
                className={inputCls}
              />
            </Field>

            <Field label="Date" htmlFor="eventDate">
              <input
                id="eventDate"
                type="datetime-local"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="Lieu" htmlFor="lieu">
              <input
                id="lieu"
                type="text"
                required
                maxLength={200}
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                placeholder="Château de Versailles"
                className={inputCls}
              />
            </Field>

            <Field label="Contact (email ou téléphone)" htmlFor="contact">
              <input
                id="contact"
                type="text"
                required
                maxLength={200}
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="contact@event.fr"
                className={inputCls}
              />
            </Field>

            <Field label="Photo de couverture (optionnel)" htmlFor="cover">
              <input
                id="cover"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground"
              />
            </Field>

            <Field label="Code coupon" htmlFor="coupon">
              <div className="relative">
                <input
                  id="coupon"
                  type="text"
                  required
                  maxLength={40}
                  value={couponCode}
                  onChange={(e) =>
                    setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
                  }
                  placeholder="VOTRE-COUPON"
                  className={`${inputCls} pr-10 font-mono uppercase tracking-wider`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {couponState === "checking" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {couponState === "valid" && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                  {couponState === "invalid" && (
                    <X className="h-4 w-4 text-destructive" />
                  )}
                </span>
              </div>
              {couponMsg && (
                <p
                  className={`mt-1 text-xs ${
                    couponState === "valid"
                      ? "text-primary"
                      : couponState === "invalid"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {couponMsg}
                </p>
              )}
            </Field>

            <button
              type="submit"
              disabled={submitting || couponState !== "valid"}
              className="w-full rounded-xl bg-primary px-5 py-3.5 text-base font-semibold text-primary-foreground shadow-soft transition disabled:opacity-50"
            >
              {submitting ? "Création…" : "Créer mon événement"}
            </button>

            <p className="text-center text-xs text-muted-foreground">
              🚧 Plan payant à venir — un coupon est requis pour le moment.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-base focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  );
}