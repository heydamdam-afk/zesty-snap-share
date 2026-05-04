import { useState } from "react";
import { OrganisateurLoginModal } from "./OrganisateurLoginModal";

export function Footer({
  eventId,
  eventTitle,
  slug,
}: {
  eventId?: string;
  eventTitle?: string;
  slug?: string;
}) {
  const [open, setOpen] = useState(false);
  const canOpenModal = !!(eventId && eventTitle && slug);
  return (
    <>
    <footer
      className="flex items-center justify-center gap-1 text-center"
      style={{ padding: 24 }}
    >
      <span
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: "#919EAB",
        }}
      >
        Propulsé par
      </span>
      <span
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 600,
          fontSize: 12,
          color: "#919EAB",
        }}
      >
        Zeste
      </span>
      <span style={{ color: "#919EAB", fontSize: 12 }}>·</span>
      <button
        type="button"
        onClick={() => canOpenModal && setOpen(true)}
        disabled={!canOpenModal}
        style={{
          fontFamily: '"Public Sans", system-ui, sans-serif',
          fontWeight: 400,
          fontSize: 12,
          color: "#919EAB",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: canOpenModal ? "pointer" : "default",
        }}
        className="hover:underline"
      >
        Organisateur ? Connectez-vous
      </button>
    </footer>
    {canOpenModal && (
      <OrganisateurLoginModal
        open={open}
        onClose={() => setOpen(false)}
        eventId={eventId!}
        eventTitle={eventTitle!}
        slug={slug!}
      />
    )}
    </>
  );
}