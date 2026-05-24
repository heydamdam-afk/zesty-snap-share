import { Camera } from "lucide-react";
import { toast } from "sonner";
import { QUOTA_FULL_MESSAGE } from "@/components/zest/QuotaBanner";

export function FloatingUploadButton({
  onPick,
  disabled,
}: {
  onPick: (files: FileList) => void;
  disabled?: boolean;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6">
      <label
        className={`pointer-events-auto inline-flex w-full max-w-[360px] items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold text-primary-foreground transition active:scale-[0.99] ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        style={{
          backgroundColor: "var(--primary)",
          boxShadow: "var(--shadow-pop)",
          fontFamily: "var(--font-display)",
          opacity: disabled ? 0.4 : 1,
        }}
        onClick={(e) => {
          if (disabled) {
            e.preventDefault();
            toast.error(QUOTA_FULL_MESSAGE);
          }
        }}
      >
        <Camera className="h-5 w-5" />
        Ajouter mes photos
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,image/webp"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onPick(e.target.files);
              e.target.value = "";
            }
          }}
        />
      </label>
    </div>
  );
}