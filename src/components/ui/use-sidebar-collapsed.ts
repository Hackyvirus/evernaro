"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "sidebar-collapsed";
const EVENT = "sidebarcollapsedchange";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot() {
  return false;
}

export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function setCollapsed(next: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // ignore — collapse state just won't persist across reloads
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return [collapsed, setCollapsed];
}
