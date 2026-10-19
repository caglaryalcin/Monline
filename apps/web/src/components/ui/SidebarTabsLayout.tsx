import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { ThemedSelect } from "@/components/ui/themed-select";

export interface SidebarTabsLayoutItem<TValue extends string = string> {
  danger?: boolean;
  icon: LucideIcon;
  label: string;
  value: TValue;
}

interface SidebarTabsLayoutProps<TValue extends string = string> {
  activeValue: TValue;
  children: ReactNode;
  items: SidebarTabsLayoutItem<TValue>[];
  onValueChange: (value: TValue) => void;
  title: string;
}

export function SidebarTabsLayout<TValue extends string>({
  activeValue,
  children,
  items,
  onValueChange,
  title,
}: SidebarTabsLayoutProps<TValue>) {
  return (
    <div className="mx-auto flex min-h-0 min-w-0 max-w-6xl animate-in fade-in slide-in-from-bottom-4 flex-col gap-4 duration-500 xl:flex-row xl:gap-6">
      <aside className="w-full min-w-0 shrink-0 xl:sticky xl:top-0 xl:w-64 xl:self-start">
        <div className="xl:hidden">
          <ThemedSelect
            aria-label={title}
            value={activeValue}
            onChange={(event) => onValueChange(event.target.value as TValue)}
            className="h-11 w-full"
          >
            {items.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </ThemedSelect>
        </div>
        <nav aria-label={title} className="hidden flex-col space-y-1 xl:flex">
          {items.map((item) => {
            const isActive = activeValue === item.value;
            const Icon = item.icon;

            return (
              <button
                key={item.value}
                onClick={() => onValueChange(item.value)}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition-all duration-200 ${
                  item.danger
                    ? `border border-destructive/30 text-destructive ${isActive ? "bg-destructive/10 dark:bg-destructive/20" : "bg-destructive/5 dark:bg-destructive/10"}`
                    : isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-muted-foreground"
                }`}
              >
                <Icon
                  className={`h-4 w-4 ${isActive && !item.danger ? "text-primary-foreground" : "opacity-70"}`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="settings-content relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border bg-card p-5 shadow-sm lg:p-7">
        {children}
      </main>
    </div>
  );
}
