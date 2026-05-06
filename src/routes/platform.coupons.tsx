import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { generateAccessCode } from "@/lib/zest-create-event";
import { toast } from "sonner";
import { Plus, Trash2, Power } from "lucide-react";

export const Route = createFileRoute("/platform/coupons")({
  head: () => ({
    meta: [
      { title: "Coupons — Kapsul Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CouponsPage,
});

type Coupon = {
  id: string;
  code: string;
  type: string;
  max_uses: number | null;
  uses_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  note: string | null;
};

function CouponsPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newMax, setNewMax] = useState("");
  const [newExpires, setNewExpires] = useState("");
  const [newNote, setNewNote] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("event_coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setCoupons((data ?? []) as Coupon[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (cancel) return;
      if (!data.user) {
        navigate({ to: "/" });
        return;
      }
      const { data: ok } = await supabase.rpc("is_platform_admin", {
        _user_id: data.user.id,
      });
      if (cancel) return;
      setAllowed(!!ok);
      setAuthChecked(true);
      if (ok) await reload();
    })();
    return () => {
      cancel = true;
    };
  }, [navigate, reload]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = (newCode.trim() || generateAccessCode(10)).toUpperCase();
    if (!/^[A-Z0-9_-]{4,40}$/.test(code)) {
      toast.error("Code invalide (4-40 caractères, A-Z 0-9 _ -)");
      return;
    }
    const payload = {
      code,
      type: "free_event",
      max_uses: newMax ? parseInt(newMax, 10) : null,
      expires_at: newExpires ? new Date(newExpires).toISOString() : null,
      note: newNote.trim() || null,
      active: true,
    };
    const { error } = await supabase.from("event_coupons").insert(payload);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Coupon ${code} créé`);
    setNewCode("");
    setNewMax("");
    setNewExpires("");
    setNewNote("");
    setShowForm(false);
    await reload();
  };

  const toggle = async (c: Coupon) => {
    const { error } = await supabase
      .from("event_coupons")
      .update({ active: !c.active })
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else await reload();
  };

  const remove = async (c: Coupon) => {
    if (!window.confirm(`Supprimer ${c.code} ?`)) return;
    const { error } = await supabase
      .from("event_coupons")
      .delete()
      .eq("id", c.id);
    if (error) toast.error(error.message);
    else await reload();
  };

  if (!authChecked) return null;
  if (!allowed) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-xl text-foreground">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cette page est réservée aux administrateurs Kapsul.
          </p>
          <Link to="/" className="mt-4 inline-block text-sm text-primary">
            ← Retour
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ZestLogo />
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              Coupons
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Nouveau
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={create}
            className="mb-6 space-y-3 rounded-2xl bg-card p-5 shadow-card"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">
                  Code (vide = auto)
                </label>
                <input
                  type="text"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  placeholder="AUTO"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm uppercase"
                  maxLength={40}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">
                  Max utilisations (vide = illimité)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newMax}
                  onChange={(e) => setNewMax(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">
                  Expire le (optionnel)
                </label>
                <input
                  type="datetime-local"
                  value={newExpires}
                  onChange={(e) => setNewExpires(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs uppercase text-muted-foreground">
                  Note interne
                </label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="ex: ami de Marc"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  maxLength={200}
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Créer le coupon
            </button>
          </form>
        )}

        {loading && coupons.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">Chargement…</p>
        ) : coupons.length === 0 ? (
          <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
            Aucun coupon. Cliquez sur "Nouveau" pour en créer un.
          </p>
        ) : (
          <ul className="space-y-2">
            {coupons.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-4 shadow-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-foreground">
                      {c.code}
                    </span>
                    {!c.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        désactivé
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {c.uses_count}
                    {c.max_uses ? `/${c.max_uses}` : ""} utilisations
                    {c.expires_at &&
                      ` · expire ${new Date(c.expires_at).toLocaleDateString("fr-FR")}`}
                    {c.note && ` · ${c.note}`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(c)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  title={c.active ? "Désactiver" : "Activer"}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}