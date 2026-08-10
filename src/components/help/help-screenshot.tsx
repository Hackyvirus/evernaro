import Image from "next/image";

interface HelpScreenshotProps {
  src: string;
  alt: string;
  caption?: string;
}

export function HelpScreenshot({ src, alt, caption }: HelpScreenshotProps) {
  return (
    <figure className="my-6 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="relative aspect-[1440/900] w-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-contain object-top"
          sizes="(max-width: 430px) 100vw, (max-width: 768px) 100vw, 800px"
          priority={false}
        />
      </div>
      {caption && (
        <figcaption className="border-t border-border px-3 py-3 text-sm text-text-secondary sm:px-4">{caption}</figcaption>
      )}
    </figure>
  );
}
