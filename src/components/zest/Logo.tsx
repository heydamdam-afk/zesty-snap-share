export function ZestLogo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <span className="font-display text-2xl font-bold text-primary leading-none">
        kapsul
      </span>
      <span className="text-primary text-2xl leading-none -mt-1">.</span>
    </div>
  );
}