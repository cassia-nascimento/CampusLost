"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  /** Contagem exibida numa pílula ao lado do rótulo. */
  count?: number;
}

export interface TabsProps {
  /** Prefixo estável dos ids; ligue cada `TabPanel` com o mesmo `group`. */
  group: string;
  label: string;
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

const tabId = (group: string, id: string) => `${group}-tab-${id}`;
const panelId = (group: string, id: string) => `${group}-panel-${id}`;

/** Abas (DESIGN §6.11): setas, Home/End e foco rotativo. O trilho rola na horizontal só por dentro. */
export function Tabs({ group, label, items, value, onChange, className }: TabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = items.findIndex((item) => item.id === value);
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    const target = items[next];
    onChange(target.id);
    refs.current[target.id]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn("flex overflow-x-auto border-b border-line", className)}
    >
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            ref={(node) => {
              refs.current[item.id] = node;
            }}
            id={tabId(group, item.id)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId(group, item.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              "touch-target -mb-px inline-flex shrink-0 items-center gap-2 border-b-[3px] px-4 text-body font-semibold whitespace-nowrap",
              selected ? "border-primary text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {item.label}
            {item.count !== undefined ? (
              <span className="rounded-full bg-sunken px-2 text-meta tabular text-ink">{item.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  group,
  id,
  active,
  children,
  className,
}: {
  group: string;
  id: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tabpanel"
      id={panelId(group, id)}
      aria-labelledby={tabId(group, id)}
      hidden={!active}
      tabIndex={0}
      className={className}
    >
      {children}
    </div>
  );
}
