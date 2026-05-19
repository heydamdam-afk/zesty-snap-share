import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const ACCENT = "#FF4842";
  const bottles = [
    { left: "12%", bg: "linear-gradient(180deg, #6FAE5E 0%, #2F6A2C 100%)", h: 96, d: "0s" },
    { left: "24%", bg: "linear-gradient(180deg, #C8B26B 0%, #6B5526 100%)", h: 80, d: "0.7s" },
    { left: "38%", bg: "linear-gradient(180deg, #D6E5EB 0%, #6FA8C1 100%)", h: 108, d: "1.4s" },
    { left: "52%", bg: "linear-gradient(180deg, #8FBE6E 0%, #3A7A3A 100%)", h: 88, d: "2.1s" },
    { left: "66%", bg: "linear-gradient(180deg, #E0C97A 0%, #8A6E2A 100%)", h: 100, d: "2.8s" },
    { left: "78%", bg: "linear-gradient(180deg, #C0DCE6 0%, #5E94AC 100%)", h: 84, d: "3.5s" },
    { left: "88%", bg: "linear-gradient(180deg, #B86C46 0%, #5A2E1A 100%)", h: 92, d: "1.0s" },
  ];
  const bubbles = [
    { left: "22%", top: "38%", s: 14, d: "0s" },
    { left: "70%", top: "26%", s: 22, d: "1.2s" },
    { left: "48%", top: "60%", s: 10, d: "0.6s" },
    { left: "18%", top: "70%", s: 26, d: "2.1s" },
    { left: "82%", top: "64%", s: 16, d: "3.0s" },
    { left: "36%", top: "80%", s: 12, d: "1.5s" },
  ];

  return (
    <div className="k4-shell">
      <style>{`
        .k4-shell { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; font-family: 'Public Sans', system-ui, -apple-system, sans-serif; color: #212B36; }
        .k4-left { background: #fff; display: flex; flex-direction: column; justify-content: center; padding: 60px 80px; position: relative; }
        .k4-logo { position: absolute; top: 36px; left: 80px; display: inline-flex; align-items: center; gap: 8px; font-family: 'Josefin Sans', sans-serif; font-weight: 700; font-size: 22px; color: ${ACCENT}; text-decoration: none; }
        .k4-logo-dot { width: 10px; height: 10px; border-radius: 50%; background: ${ACCENT}; }
        .k4-content { max-width: 460px; }
        .k4-title { font-family: 'Josefin Sans', sans-serif; font-weight: 700; font-size: clamp(56px, 7vw, 96px); line-height: 1; letter-spacing: -0.03em; color: #212B36; margin: 0 0 24px; }
        .k4-title sup { color: ${ACCENT}; font-size: 0.4em; vertical-align: super; letter-spacing: 0.04em; font-weight: 700; text-transform: uppercase; margin-left: 4px; }
        .k4-desc { font-size: 18px; line-height: 1.55; color: #637381; margin: 0 0 36px; max-width: 380px; }
        .k4-cta { display: inline-flex; align-items: center; justify-content: center; gap: 10px; background: ${ACCENT}; color: #fff; text-decoration: none; font-family: 'Josefin Sans', sans-serif; font-weight: 700; font-size: 16px; padding: 18px 32px; border-radius: 100px; border: none; cursor: pointer; box-shadow: 0 14px 30px rgba(255,72,66,0.32); transition: all 200ms ease; width: 100%; max-width: 360px; }
        .k4-cta:hover { transform: translateY(-1px); box-shadow: 0 18px 34px rgba(255,72,66,0.4); }
        .k4-second { margin-top: 22px; font-size: 14.5px; color: #919EAB; }
        .k4-second a { color: ${ACCENT}; font-weight: 600; text-decoration: none; padding: 0 4px; }
        .k4-second a:hover { text-decoration: underline; }
        .k4-right { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;
          background:
            radial-gradient(120% 80% at 30% 0%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 50%),
            radial-gradient(80% 60% at 80% 100%, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0) 60%),
            linear-gradient(180deg, #58B6D8 0%, #2E7BA8 55%, #1A4F7A 100%);
        }
        .k4-caustics { position: absolute; inset: 0; pointer-events: none;
          background:
            repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 14px),
            repeating-linear-gradient(75deg, rgba(255,255,255,0.04) 0 2px, transparent 2px 22px);
          mix-blend-mode: screen; opacity: 0.7;
        }
        .k4-bubble { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); animation: k4Float 10s ease-in-out infinite; pointer-events: none; }
        @keyframes k4Float { 0%, 100% { transform: translateY(0) translateX(0); opacity: 0.7; } 50% { transform: translateY(-22px) translateX(8px); opacity: 1; } }
        .k4-bottle { position: absolute; top: -8px; width: 22px; border-radius: 8px 8px 4px 4px; box-shadow: inset 4px 0 0 rgba(255,255,255,0.15), inset -4px 0 0 rgba(0,0,0,0.12), 0 6px 24px rgba(0,0,0,0.2); animation: k4Sway 6s ease-in-out infinite; transform-origin: top center; }
        .k4-bottle::before { content: ''; position: absolute; top: -14px; left: 50%; width: 8px; height: 18px; transform: translateX(-50%); background: inherit; border-radius: 2px 2px 0 0; box-shadow: inset 2px 0 0 rgba(255,255,255,0.18); }
        @keyframes k4Sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        .k4-caption { position: relative; z-index: 3; font-family: 'Josefin Sans', sans-serif; font-weight: 700; font-size: clamp(48px, 6.5vw, 96px); line-height: 1.02; letter-spacing: -0.025em; color: #fff; text-align: center; padding: 0 40px; max-width: 760px; text-shadow: 0 4px 24px rgba(0,0,0,0.25); margin: 0; }
        .k4-caption em { font-style: italic; font-weight: 700; color: #FFD9D6; }
        @media (max-width: 980px) {
          .k4-shell { grid-template-columns: 1fr; }
          .k4-left { order: 2; padding: 40px 28px 56px; }
          .k4-logo { position: static; margin-bottom: 24px; }
          .k4-right { order: 1; width: 100%; min-height: 320px; height: 50vh; max-height: 480px; }
          .k4-title { font-size: 64px; }
          .k4-desc { font-size: 16px; max-width: 100%; }
          .k4-content { max-width: 100%; }
          .k4-caption { font-size: clamp(36px, 9vw, 56px); padding: 0 24px; }
        }
        @media (max-width: 540px) {
          .k4-left { padding: 32px 20px 48px; }
          .k4-title { font-size: 52px; }
          .k4-cta { padding: 16px 24px; font-size: 15px; }
          .k4-right { min-height: 280px; height: 45vh; max-height: 400px; }
        }
      `}</style>

      <section className="k4-left">
        <Link to="/" className="k4-logo">
          <span className="k4-logo-dot" />
          Kapsul
        </Link>
        <div className="k4-content">
          <h1 className="k4-title">404<sup>erreur</sup></h1>
          <p className="k4-desc">La fête est finie, j'espère que tu t'es bien amusé. Aucun événement trouvé à cette adresse.</p>
          <Link to="/" className="k4-cta">Créer mon événement</Link>
          <p className="k4-second">
            Ou aller à votre <Link to="/">Dashboard&nbsp;?</Link>
          </p>
        </div>
      </section>

      <section className="k4-right" aria-hidden="true">
        <div className="k4-caustics" />
        {bottles.map((b, i) => (
          <div key={i} className="k4-bottle" style={{ left: b.left, background: b.bg, height: b.h, animationDelay: b.d }} />
        ))}
        {bubbles.map((b, i) => (
          <div key={i} className="k4-bubble" style={{ left: b.left, top: b.top, width: b.s, height: b.s, animationDelay: b.d }} />
        ))}
        <h2 className="k4-caption">
          Personne ne fait la <em>fête</em> ici&nbsp;!
        </h2>
      </section>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lovable App" },
      { name: "description", content: "Kapsul Photo Hub creates ephemeral event photo galleries. Guests upload photos via QR code." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Lovable App" },
      { property: "og:description", content: "Kapsul Photo Hub creates ephemeral event photo galleries. Guests upload photos via QR code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Lovable App" },
      { name: "twitter:description", content: "Kapsul Photo Hub creates ephemeral event photo galleries. Guests upload photos via QR code." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6f6f5bb-fa7e-4e41-b00b-6e7831a18884/id-preview-9af09840--4daa509d-17a4-4a16-b776-872270e66045.lovable.app-1778071739120.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/d6f6f5bb-fa7e-4e41-b00b-6e7831a18884/id-preview-9af09840--4daa509d-17a4-4a16-b776-872270e66045.lovable.app-1778071739120.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
