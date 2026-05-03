export type TabId = "feed" | "gallery" | "guests" | "qr";

const TABS: { id: TabId; label: string }[] = [
  { id: "feed", label: "Feed" },
  { id: "gallery", label: "Galerie" },
  { id: "guests", label: "Invités" },
  { id: "qr", label: "QR Code" },
];

export function StickyTabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (t: TabId) => void;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-0 mt-4 border-b border-border bg-card">
      <div role="tablist" className="flex w-full">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={`relative flex-1 px-2 py-3 text-[13px] transition ${
                isActive
                  ? "font-semibold text-primary"
                  : "font-normal text-muted-foreground"
              }`}
            >
              {t.label}
              {isActive && (
                <span
                  className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}