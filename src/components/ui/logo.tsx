import Image from "next/image";

export function Logo({
  className = "",
  iconOnly = false,
  height = 32,
}: {
  className?: string;
  iconOnly?: boolean;
  height?: number;
}) {
  const src = iconOnly ? "/evernaro-icon.svg" : "/evernaro.svg";
  const alt = "Evernaro";
  const width = iconOnly ? height : height * 3;
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image src={src} alt={alt} height={height} width={width} unoptimized priority />
    </span>
  );
}
