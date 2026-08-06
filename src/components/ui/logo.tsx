"use client";

import Image from "next/image";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("themechange", callback);
  return () => window.removeEventListener("themechange", callback);
}

function getSnapshot() {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function getServerSnapshot() {
  return "light";
}

export function Logo({
  className = "",
  iconOnly = false,
  height = 32,
}: {
  className?: string;
  iconOnly?: boolean;
  height?: number;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (iconOnly) {
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Image src="/favicon.svg" alt="Evernaro" height={height} width={height} unoptimized priority />
      </span>
    );
  }

  const src = theme === "dark" ? "/Evernaro-dark.svg" : "/Evernaro-light.svg";
  const width = Math.round((height * 1200) / 360);
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image src={src} alt="Evernaro" height={height} width={width} unoptimized priority />
    </span>
  );
}
