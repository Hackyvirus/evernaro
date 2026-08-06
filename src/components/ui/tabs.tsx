"use client";

import { ReactNode, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (id: string) => void;
}

export function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div>
      <div className="border-b border-border">
        <nav aria-label="Tabs" className="flex justify-center gap-6 overflow-x-auto sm:justify-start">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActive(tab.id);
                onChange?.(tab.id);
              }}
              className={`cursor-pointer border-b-2 px-1 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                active === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-text-secondary hover:text-text"
              }`}
              aria-current={active === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="pt-4">{activeTab?.content}</div>
    </div>
  );
}
