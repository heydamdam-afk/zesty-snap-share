export function Avatar({
  initials,
  size = "md",
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-12 w-12 text-sm",
  };
  return (
    <div
      className={`${sizes[size]} ${className ?? ""} inline-flex items-center justify-center rounded-full bg-gradient-coral font-semibold text-primary-foreground shadow-soft ring-2 ring-background`}
    >
      {initials}
    </div>
  );
}