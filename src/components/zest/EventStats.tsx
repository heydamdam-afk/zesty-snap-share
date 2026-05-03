export function EventStats({
  guests,
  photos,
  likes,
}: {
  guests: number;
  photos: number;
  likes: number;
}) {
  const items = [
    { icon: "👥", value: guests, label: "invités" },
    { icon: "📸", value: photos, label: "photos" },
    { icon: "❤️", value: likes, label: "likes" },
  ];
  return (
    <div
      className="mx-3 mt-3 flex items-center justify-around rounded-xl px-4 py-3"
      style={{ backgroundColor: "var(--bg-neutral)" }}
    >
      {items.map((it, i) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center leading-tight">
            <span className="text-base">{it.icon}</span>
            <span className="mt-0.5 text-base font-bold text-foreground">
              {it.value}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {it.label}
            </span>
          </div>
          {i < items.length - 1 && (
            <span className="ml-3 h-8 w-px bg-border" aria-hidden />
          )}
        </div>
      ))}
    </div>
  );
}