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

const ASPECT_W = 1200;
const ASPECT_H = 360;

export function Logo({
  className = "",
  iconOnly = false,
  height,
  width,
}: {
  className?: string;
  iconOnly?: boolean;
  height?: number;
  width?: number;
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  let logoHeight: number;
  let logoWidth: number;

  if (iconOnly) {
    logoHeight = height ?? 32;
    logoWidth = width ?? logoHeight;
    return (
      <span className={`inline-flex items-center ${className}`}>
        <Image src="/favicon.svg" alt="Evernaro" height={logoHeight} width={logoWidth} unoptimized priority />
      </span>
    );
  }

  if (width) {
    logoWidth = width;
    logoHeight = height ?? Math.round((width * ASPECT_H) / ASPECT_W);
  } else {
    logoHeight = height ?? 32;
    logoWidth = Math.round((logoHeight * ASPECT_W) / ASPECT_H);
  }

  const src = theme === "dark" ? "/Evernaro-dark.svg" : "/Evernaro-light.svg";
  return (
    <span className={`inline-flex items-center ${className}`}>
      <Image src={src} alt="Evernaro" height={logoHeight} width={logoWidth} unoptimized priority />
    </span>
  );
}
