import Image from "next/image";

/**
 * Drop your logo file at /public/logo-aurelia.png and it will render here
 * automatically. Until then, a type-mark fallback is shown so the UI never
 * looks broken.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      className="relative flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface-raised"
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo-aurelia.png"
        alt="AURELIA"
        width={size}
        height={size}
        className="h-full w-full object-cover"
        onError={(e) => {
          // Hide broken image if the file hasn't been added yet;
          // the fallback glyph behind it remains visible.
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <span
        className="font-display absolute text-foreground/80"
        style={{ fontSize: size * 0.5 }}
        aria-hidden
      >
        A
      </span>
    </div>
  );
}
