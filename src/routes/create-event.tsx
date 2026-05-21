import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { PLANS, formatPrice, type PlanCode } from '@/lib/plans';
import { slugify, generateAccessCode } from '@/lib/zest-create-event';

export const Route = createFileRoute('/create-event')({
  head: () => ({
    meta: [
      { title: 'Créer un événement — Kapsul' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: CreateEventPage,
});

const FormSchema = z.object({
  titre: z.string().trim().min(3, '3 caractères minimum').max(120),
  eventDate: z.string().min(1, 'Date requise'),
  lieu: z.string().trim().min(1, 'Lieu requis').max(200),
  codeAcces: z.string().trim().min(4).max(20).regex(/^[A-Z0-9]+$/, 'Lettres majuscules / chiffres uniquement'),
  email: z.string().email('Email invalide').max(255),
});

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  // local YYYY-MM-DD for date input min
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function CreateEventPage() {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>('essentiel');
  const [titre, setTitre] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [lieu, setLieu] = useState('');
  const [codeAcces, setCodeAcces] = useState(() => generateAccessCode(6));
  const [email, setEmail] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const plan = useMemo(() => PLANS.find((p) => p.code === selectedPlan)!, [selectedPlan]);
  const minDate = todayIso();

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancel) return;
      const userEmail = data.session?.user?.email;
      if (userEmail && !email) setEmail(userEmail);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const handleCoverPick = (file: File | null) => {
    if (!file) return setCoverFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type.toLowerCase())) {
      toast.error('JPG, PNG ou WebP uniquement');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop lourde (max 5 Mo)');
      return;
    }
    setCoverFile(file);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = FormSchema.safeParse({ titre, eventDate, lieu, codeAcces, email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide');
      return;
    }
    const dateValue = new Date(parsed.data.eventDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateValue < today) {
      setError('La date ne peut pas être dans le passé');
      return;
    }

    setSubmitting(true);
    try {
      const slug = slugify(parsed.data.titre);
      let coverUrl: string | null = null;
      if (coverFile) {
        try {
          const ext = coverFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
          const path = `covers/pending/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('event-photos')
            .upload(path, coverFile, { upsert: false, contentType: coverFile.type });
          if (upErr) throw upErr;
          const { data: pub } = supabase.storage.from('event-photos').getPublicUrl(path);
          coverUrl = pub.publicUrl;
        } catch (e) {
          console.warn('cover upload failed', e);
          toast.warning('Photo non enregistrée, on continue sans');
        }
      }

      const payload = {
        planCode: selectedPlan,
        email: parsed.data.email,
        payload: {
          titre: parsed.data.titre,
          slug,
          code_acces: parsed.data.codeAcces.toUpperCase(),
          event_date: dateValue.toISOString(),
          lieu: parsed.data.lieu,
          cover_url: coverUrl,
        },
      };
      sessionStorage.setItem('kapsul_pending_form', JSON.stringify(payload));
      navigate({ to: '/create-event/checkout' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 pt-6 pb-16">
        <div className="mb-6 flex justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Retour</Link>
        </div>

        {/* Plan selector */}
        <div className="-mx-5 mb-7 overflow-x-auto px-5">
          <div className="flex gap-3">
            {PLANS.map((p) => {
              const isSelected = p.code === selectedPlan;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setSelectedPlan(p.code)}
                  className={`relative min-w-[112px] shrink-0 rounded-2xl border-2 px-3 py-3 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
                >
                  {p.is_top && (
                    <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      TOP
                    </span>
                  )}
                  <div className={`text-xs font-bold uppercase tracking-wide ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                    {p.nom}
                  </div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">{formatPrice(p.prix_cents)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{p.description_courte}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.max_invites ? `≈ ${p.max_invites} invités` : 'Invités illimités'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Créez votre événement</h1>
        <p className="mt-1 text-sm text-muted-foreground">Quelques infos sur votre événement et c'est parti.</p>

        <div className="my-5 rounded-xl border-l-4 border-primary bg-primary/5 px-4 py-3 text-sm text-foreground">
          💡 {plan.description_usage}
        </div>

        <form onSubmit={submit} noValidate className="space-y-5">
          {error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <Field
            label="Nom de l'événement"
            htmlFor="titre"
            hint={
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" /> Définitif après création
              </span>
            }
          >
            <input
              id="titre"
              type="text"
              required
              maxLength={120}
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Mariage de Julie & Thomas"
              className={inputCls}
            />
          </Field>

          <Field label="Date de l'événement" htmlFor="eventDate">
            <input
              id="eventDate"
              type="date"
              required
              min={minDate}
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

          <Field
            label="Code d'accès invités"
            htmlFor="codeAcces"
            hint={<span className="text-xs text-muted-foreground">Ce que vos invités saisiront pour rejoindre la galerie</span>}
          >
            <input
              id="codeAcces"
              type="text"
              required
              maxLength={20}
              value={codeAcces}
              onChange={(e) => setCodeAcces(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              placeholder="MARIAGE2026"
              className={`${inputCls} font-mono uppercase tracking-wider`}
            />
          </Field>

          <Field label="Photo de couverture (optionnel)" htmlFor="cover">
            <input
              id="cover"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleCoverPick(e.target.files?.[0] ?? null)}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-xs file:font-semibold file:text-foreground"
            />
            {coverFile && (
              <p className="mt-1 text-xs text-primary">
                ✓ {coverFile.name} ({(coverFile.size / 1024 / 1024).toFixed(2)} Mo)
              </p>
            )}
          </Field>

          <Field label="Votre email" htmlFor="email">
            <input
              id="email"
              type="email"
              required
              maxLength={255}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className={inputCls}
            />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-[0_12px_28px_hsl(var(--primary)/0.28)] transition-all disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : plan.prix_cents === 0 ? (
              'Créer mon événement →'
            ) : (
              'Continuer vers le paiement →'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        {hint}
      </div>
      {children}
    </div>
  );
}