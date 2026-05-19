import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/gros-evenement")({
  head: () => ({
    meta: [
      { title: "Grand événement — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GrosEvenement,
});

const ACCENT = "#FF4842";

const QUESTIONS: { id: string; label: string; conditional?: "count" | "duration" }[] = [
  { id: "q1", label: "Plus de 200 invités attendus", conditional: "count" },
  { id: "q2", label: "Durée de l'événement supérieure à 4 jours", conditional: "duration" },
  { id: "q3", label: "Je veux conserver les photos plus d'1 mois après l'événement" },
  { id: "q4", label: "Plus de 2 000 photos attendues" },
  { id: "q5", label: "Plusieurs organisateurs pour gérer la galerie" },
  { id: "q6", label: "Je veux ma propre marque / mon propre domaine (marque blanche)" },
];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  border: "1.5px solid #E0E0E0",
  borderRadius: 8,
  fontFamily: '"Public Sans", sans-serif',
  fontSize: 14,
  color: "#212B36",
  background: "#fff",
  outline: "none",
  transition: "all 0.18s",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontFamily: '"Public Sans", sans-serif',
  fontSize: 13,
  color: "#637381",
  display: "block",
  margin: "14px 0 6px",
};

function GrosEvenement() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [count, setCount] = useState("");
  const [duration, setDuration] = useState<"" | "<4" | ">=4">("");
  const [forcedB, setForcedB] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", eventName: "", date: "", guests: "", message: "" });

  const checkedCount = useMemo(() => Object.values(checked).filter(Boolean).length, [checked]);
  const mode: null | "A" | "B" = useMemo(() => {
    if (checkedCount === 0) return null;
    if (forcedB) return "B";
    return checkedCount <= 2 ? "A" : "B";
  }, [checkedCount, forcedB]);

  const toggle = (id: string) => {
    setChecked((c) => {
      const next = { ...c, [id]: !c[id] };
      if (!next[id]) {
        if (id === "q1") setCount("");
        if (id === "q2") setDuration("");
      }
      return next;
    });
    setForcedB(false);
  };

  const setField = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <header
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "18px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #EEF0F2",
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: '"Josefin Sans", sans-serif',
            fontWeight: 700,
            fontSize: 24,
            color: ACCENT,
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: ACCENT }} />
          Kapsul
        </Link>
        <Link
          to="/"
          style={{ fontFamily: '"Public Sans", sans-serif', fontSize: 13, color: "#637381", textDecoration: "none" }}
        >
          ← Retour aux tarifs
        </Link>
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "60px 24px 100px" }}>
        <h1
          style={{
            fontFamily: '"Josefin Sans", sans-serif',
            fontWeight: 700,
            fontSize: 36,
            letterSpacing: "-0.02em",
            color: "#212B36",
            margin: "0 0 10px",
          }}
        >
          Vous organisez un grand événement ?
        </h1>
        <p style={{ fontFamily: '"Public Sans", sans-serif', fontSize: 16, color: "#637381", margin: "0 0 36px" }}>
          Répondez à ces questions, on s'occupe du reste.
        </p>

        <div>
          {QUESTIONS.map((q) => {
            const isChecked = !!checked[q.id];
            return (
              <div key={q.id}>
                <div
                  onClick={() => toggle(q.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    padding: "18px",
                    border: `1.5px solid ${isChecked ? ACCENT : "#E5E8EB"}`,
                    borderRadius: 14,
                    cursor: "pointer",
                    transition: "all 0.18s",
                    background: isChecked ? "rgba(255,72,66,0.08)" : "#fff",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      border: `2px solid ${isChecked ? ACCENT : "#C4CDD5"}`,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      marginTop: 1,
                      background: isChecked ? ACCENT : "#fff",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      transition: "all 0.18s",
                    }}
                  >
                    {isChecked ? "✓" : ""}
                  </span>
                  <span
                    style={{
                      fontFamily: '"Public Sans", sans-serif',
                      fontSize: 15,
                      color: "#212B36",
                      fontWeight: isChecked ? 600 : 500,
                      flex: 1,
                    }}
                  >
                    {q.label}
                  </span>
                </div>

                {isChecked && q.conditional === "count" && (
                  <div
                    style={{
                      margin: "-4px 0 14px 36px",
                      padding: "14px 16px",
                      background: "#F4F6F8",
                      borderRadius: 10,
                      animation: "gefade 0.25s ease",
                    }}
                  >
                    <label
                      style={{
                        fontFamily: '"Public Sans", sans-serif',
                        fontSize: 13,
                        color: "#637381",
                        display: "block",
                        marginBottom: 6,
                      }}
                    >
                      Combien d'invités attendez-vous ?
                    </label>
                    <input
                      type="number"
                      min={200}
                      placeholder="ex : 350"
                      value={count}
                      onChange={(e) => setCount(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                )}
                {isChecked && q.conditional === "duration" && (
                  <div
                    style={{
                      margin: "-4px 0 14px 36px",
                      padding: "14px 16px",
                      background: "#F4F6F8",
                      borderRadius: 10,
                      animation: "gefade 0.25s ease",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: '"Public Sans", sans-serif',
                        fontSize: 13,
                        color: "#637381",
                        marginBottom: 8,
                      }}
                    >
                      Précisez la durée :
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(
                        [
                          { v: "<4" as const, l: "Moins de 4 jours" },
                          { v: ">=4" as const, l: "4 jours et plus" },
                        ] as const
                      ).map((opt) => {
                        const active = duration === opt.v;
                        return (
                          <button
                            key={opt.v}
                            onClick={() => setDuration(opt.v)}
                            style={{
                              padding: "10px 18px",
                              border: `1.5px solid ${active ? ACCENT : "#E0E0E0"}`,
                              borderRadius: 100,
                              background: active ? "rgba(255,72,66,0.1)" : "#fff",
                              cursor: "pointer",
                              fontFamily: '"Public Sans", sans-serif',
                              fontSize: 13,
                              color: active ? ACCENT : "#212B36",
                              fontWeight: active ? 600 : 400,
                              transition: "all 0.18s",
                            }}
                          >
                            {opt.l}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          {submitted ? (
            <div
              style={{
                marginTop: 36,
                background: "rgba(0,171,85,0.1)",
                color: "#00AB55",
                padding: 24,
                borderRadius: 14,
                textAlign: "center",
                fontFamily: '"Public Sans", sans-serif',
                fontWeight: 600,
                animation: "gefadeup 0.4s ease",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#00AB55",
                  color: "#fff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                  fontWeight: 700,
                  marginBottom: 12,
                }}
              >
                ✓
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontFamily: '"Josefin Sans", sans-serif',
                  color: "#212B36",
                  marginBottom: 6,
                }}
              >
                Votre demande a bien été envoyée.
              </div>
              <div style={{ fontWeight: 400, color: "#637381", fontSize: 14 }}>Réponse sous 24h.</div>
            </div>
          ) : mode === "A" ? (
            <div
              style={{
                marginTop: 36,
                background: "#fff",
                border: `2px solid ${ACCENT}`,
                borderRadius: 16,
                padding: 32,
                animation: "gefadeup 0.4s ease",
              }}
            >
              <div
                style={{
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 12,
                  color: ACCENT,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                Notre recommandation
              </div>
              <h2
                style={{
                  fontFamily: '"Josefin Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: 26,
                  color: "#212B36",
                  margin: "0 0 8px",
                  letterSpacing: "-0.02em",
                }}
              >
                L'offre Illimitée est faite pour vous
              </h2>
              <p
                style={{
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 15,
                  color: "#637381",
                  margin: "0 0 22px",
                }}
              >
                Photos illimitées · 1 mois à partir du 1er jour de l'événement
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    fontFamily: '"Josefin Sans", sans-serif',
                    fontWeight: 700,
                    fontSize: 48,
                    color: "#212B36",
                    letterSpacing: "-0.03em",
                  }}
                >
                  199€
                </span>
              </div>
              <p
                style={{
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 13,
                  color: "#919EAB",
                  margin: "0 0 24px",
                }}
              >
                Paiement unique — pas d'abonnement
              </p>
              <Link
                to="/create-event"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "15px 24px",
                  border: "none",
                  borderRadius: 100,
                  fontFamily: '"Public Sans", sans-serif',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  background: ACCENT,
                  color: "#fff",
                  boxShadow: "0 8px 20px rgba(255,72,66,0.3)",
                  textAlign: "center",
                  textDecoration: "none",
                  boxSizing: "border-box",
                }}
              >
                Je prends l'offre Illimitée →
              </Link>
              <div style={{ textAlign: "center" }}>
                <button
                  onClick={() => setForcedB(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#637381",
                    textDecoration: "underline",
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: "inherit",
                    fontSize: 13,
                    marginTop: 14,
                  }}
                >
                  Besoin d'encore plus ? Demandez un devis
                </button>
              </div>
            </div>
          ) : mode === "B" ? (
            <div
              style={{
                marginTop: 36,
                background: "#F4F6F8",
                borderRadius: 16,
                padding: 32,
                animation: "gefadeup 0.4s ease",
              }}
            >
              <h2
                style={{
                  fontFamily: '"Josefin Sans", sans-serif',
                  fontWeight: 700,
                  fontSize: 26,
                  color: "#212B36",
                  margin: "0 0 8px",
                  letterSpacing: "-0.02em",
                }}
              >
                Votre événement mérite une offre sur-mesure
              </h2>
              <p
                style={{
                  fontFamily: '"Public Sans", sans-serif',
                  fontSize: 14,
                  color: "#637381",
                  margin: "0 0 24px",
                }}
              >
                Réponse sous 24h — gratuit et sans engagement
              </p>

              <label style={labelStyle}>Votre nom</label>
              <input style={inputStyle} value={form.name} onChange={(e) => setField("name", e.target.value)} />
              <label style={labelStyle}>Votre email *</label>
              <input style={inputStyle} type="email" required value={form.email} onChange={(e) => setField("email", e.target.value)} />
              <label style={labelStyle}>Nom de l'événement</label>
              <input style={inputStyle} value={form.eventName} onChange={(e) => setField("eventName", e.target.value)} />
              <label style={labelStyle}>Date de l'événement</label>
              <input style={inputStyle} type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
              <label style={labelStyle}>Nombre d'invités estimé</label>
              <input style={inputStyle} type="number" value={form.guests} onChange={(e) => setField("guests", e.target.value)} />
              <label style={labelStyle}>Message libre (optionnel)</label>
              <textarea
                style={{ ...inputStyle, resize: "vertical" }}
                rows={4}
                placeholder="Précisez vos besoins..."
                value={form.message}
                onChange={(e) => setField("message", e.target.value)}
              />

              <button
                onClick={() => {
                  if (!form.email) {
                    alert("L'email est obligatoire");
                    return;
                  }
                  setSubmitted(true);
                }}
                style={{
                  marginTop: 18,
                  width: "100%",
                  padding: "15px 24px",
                  border: "none",
                  borderRadius: 100,
                  fontFamily: '"Public Sans", sans-serif',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: "pointer",
                  background: "#212B36",
                  color: "#fff",
                }}
              >
                Envoyer ma demande →
              </button>
            </div>
          ) : null}
        </div>
      </main>

      <style>{`
        @keyframes gefade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gefadeup { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 540px) { h1 { font-size: 28px !important; } }
      `}</style>
    </div>
  );
}
